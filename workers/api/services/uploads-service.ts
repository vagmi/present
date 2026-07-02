// File uploads to a Cloudflare R2 bucket. The bucket is PRIVATE — objects are
// never exposed via a public r2.dev URL. Reads go back through the authed
// Worker (see `get`), which re-checks org scoping on every request. Keys are
// org-prefixed so one org can never read or overwrite another's objects. Never
// trust the client filename for the key — generate it.
// Copy to: workers/api/services/uploads-service.ts
import { newId } from "~/lib/id";
import { ValidationError } from "./errors";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export interface UploadInput {
  filename: string;
  contentType: string;
  size: number;
  body: ReadableStream | ArrayBuffer | Blob;
}

export interface UploadsServiceDeps {
  bucket: R2Bucket;
}

export function createUploadsService({ bucket }: UploadsServiceDeps) {
  return {
    async put(
      orgId: string,
      presentationId: string,
      file: UploadInput,
    ): Promise<{ key: string }> {
      if (!ALLOWED_TYPES.has(file.contentType)) {
        throw new ValidationError(`unsupported file type: ${file.contentType}`);
      }
      if (file.size > MAX_BYTES) {
        throw new ValidationError("file too large (max 5 MB)");
      }

      const ext = extFromName(file.filename);
      // Scoped by org AND presentation, unguessable — the client name is only
      // used for the extension. The presentation segment lets us list a deck's
      // own uploads (see `list`) without a database table.
      const key = `${orgId}/${presentationId}/${newId()}${ext}`;

      await bucket.put(key, file.body, {
        httpMetadata: { contentType: file.contentType },
      });

      // No public URL — the bucket is private. Callers reference the key and
      // fetch bytes through the authed `/api/uploads/:key` endpoint.
      return { key };
    },

    /** List the objects uploaded within a presentation (by key prefix). The
     * prefix begins with the caller's org id, so this can never surface another
     * org's objects. Newest first. */
    async list(
      orgId: string,
      presentationId: string,
    ): Promise<{ key: string }[]> {
      const listed = await bucket.list({
        prefix: `${orgId}/${presentationId}/`,
        limit: 1000,
      });
      // Keys embed a ULID (time-sortable); reverse for newest-first.
      return listed.objects
        .map((o) => ({ key: o.key }))
        .sort((a, b) => (a.key < b.key ? 1 : -1));
    },

    async get(orgId: string, key: string): Promise<R2ObjectBody | null> {
      // Enforce org scoping: refuse keys outside the org's prefix.
      if (!key.startsWith(`${orgId}/`)) {
        throw new ValidationError("key does not belong to this organization");
      }
      // null when the object is missing — the controller turns this into a 404.
      return bucket.get(key);
    },

    async delete(orgId: string, key: string): Promise<void> {
      // Enforce org scoping: refuse keys outside the org's prefix.
      if (!key.startsWith(`${orgId}/`)) {
        throw new ValidationError("key does not belong to this organization");
      }
      await bucket.delete(key);
    },
  };
}

export type UploadsService = ReturnType<typeof createUploadsService>;

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = name.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}
