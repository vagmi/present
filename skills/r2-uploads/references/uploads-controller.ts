// /api/uploads — accept a multipart file upload, store it in a PRIVATE R2
// bucket, and serve it back through this authed endpoint. Nothing is publicly
// reachable: every read re-checks the caller's org against the key prefix.
// Copy to: workers/api/controllers/uploads-controller.ts
import { Hono } from "hono";
import { ValidationError } from "../services/errors";
import type { ApiEnv } from "../types";

export function createUploadsController() {
  const app = new Hono<ApiEnv>();

  app.post("/", async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("expected a 'file' field");
    }

    const { key } = await c.var.services.uploads.put(c.var.orgId, {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      body: file.stream(),
    });

    return c.json({ key }, 201);
  });

  // Stream a private object back to the authed caller. The service enforces
  // that `key` belongs to this org before R2 is ever touched.
  app.get("/:key{.+}", async (c) => {
    const object = await c.var.services.uploads.get(
      c.var.orgId,
      c.req.param("key"),
    );
    if (!object) {
      return c.json({ error: "not found" }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    // Private cache only: the response is scoped to this user's session.
    headers.set("cache-control", "private, max-age=3600");
    return new Response(object.body, { headers });
  });

  app.delete("/:key{.+}", async (c) => {
    await c.var.services.uploads.delete(c.var.orgId, c.req.param("key"));
    return c.json({ ok: true });
  });

  return app;
}
