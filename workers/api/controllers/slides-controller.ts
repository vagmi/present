import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ApiEnv } from "../types";
import { slideReorderSchema, slideSceneSchema } from "../validation";

/** /api/presentations/:presentationId/slides — CRUD + reorder. Mounted inside
 * the authed group under a presentation, so both `presentationId` and the
 * usual c.var.{orgId,services} are available. Controllers stay thin: validate
 * input, call a service, shape the JSON response. */
export function createSlidesController() {
  const app = new Hono<ApiEnv>();

  // `presentationId` comes from the mount path (guaranteed present), but Hono
  // types mounted params as possibly-undefined — normalize it once.
  const presentationId = (c: { req: { param(k: string): string | undefined } }) =>
    c.req.param("presentationId") ?? "";

  app.get("/", async (c) => {
    const slides = await c.var.services.slides.list(
      c.var.orgId,
      presentationId(c),
    );
    return c.json({ slides });
  });

  app.post("/", async (c) => {
    const slide = await c.var.services.slides.add(
      c.var.orgId,
      presentationId(c),
    );
    return c.json({ slide }, 201);
  });

  app.post("/reorder", zValidator("json", slideReorderSchema), async (c) => {
    const { orderedIds } = c.req.valid("json");
    const slides = await c.var.services.slides.reorder(
      c.var.orgId,
      presentationId(c),
      orderedIds,
    );
    return c.json({ slides });
  });

  app.post("/:slideId/duplicate", async (c) => {
    const slide = await c.var.services.slides.duplicate(
      c.var.orgId,
      c.req.param("slideId"),
    );
    return c.json({ slide }, 201);
  });

  app.get("/:slideId", async (c) => {
    const slide = await c.var.services.slides.get(
      c.var.orgId,
      c.req.param("slideId"),
    );
    return c.json({ slide });
  });

  app.patch("/:slideId", zValidator("json", slideSceneSchema), async (c) => {
    const { scene } = c.req.valid("json");
    const slide = await c.var.services.slides.updateScene(
      c.var.orgId,
      c.req.param("slideId"),
      scene,
    );
    return c.json({ slide });
  });

  app.delete("/:slideId", async (c) => {
    await c.var.services.slides.delete(c.var.orgId, c.req.param("slideId"));
    return c.json({ ok: true });
  });

  return app;
}
