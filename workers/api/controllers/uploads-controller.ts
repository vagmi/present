// /api/uploads — accept a multipart file upload, store it in a PRIVATE R2
// bucket, and serve it back through this authed endpoint. Nothing is publicly
// reachable: every read re-checks the caller's org against the key prefix.
// Copy to: workers/api/controllers/uploads-controller.ts
import { Hono } from "hono";
import type { ApiEnv } from "../types";

/** /api/uploads — serves and deletes private objects by key. Uploads happen on
 * the presentation-scoped route (see presentation-uploads-controller). */
export function createUploadsController() {
  const app = new Hono<ApiEnv>();

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
