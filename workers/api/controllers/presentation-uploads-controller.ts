import { Hono } from "hono";
import { ValidationError } from "../services/errors";
import type { ApiEnv } from "../types";

/** /api/presentations/:presentationId/uploads — accept a multipart file upload
 * scoped to a presentation, and list that presentation's uploaded images so the
 * editor can re-pick them. Objects live in a PRIVATE R2 bucket; bytes are served
 * back through the org-scoped /api/uploads/:key endpoint. */
export function createPresentationUploadsController() {
  const app = new Hono<ApiEnv>();

  // `presentationId` comes from the mount path (Hono types it as maybe-absent).
  const pid = (c: { req: { param(k: string): string | undefined } }) =>
    c.req.param("presentationId") ?? "";

  app.get("/", async (c) => {
    const uploads = await c.var.services.uploads.list(c.var.orgId, pid(c));
    return c.json({ uploads });
  });

  app.post("/", async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("expected a 'file' field");
    }

    const { key } = await c.var.services.uploads.put(c.var.orgId, pid(c), {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      body: file.stream(),
    });

    return c.json({ key }, 201);
  });

  return app;
}
