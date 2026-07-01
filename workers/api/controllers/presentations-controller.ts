import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ApiEnv } from "../types";
import {
  presentationCreateSchema,
  presentationUpdateSchema,
} from "../validation";

/** /api/presentations — CRUD. Mounted inside the authed group, so
 * c.var.{orgId,org,userId,services} are always present. Controllers stay thin:
 * validate input, call a service, shape the JSON response. Copy this file
 * when you add your own resource. */
export function createPresentationsController() {
  const app = new Hono<ApiEnv>();

  app.get("/", async (c) => {
    const presentations = await c.var.services.presentations.list(c.var.orgId);
    return c.json({ presentations });
  });

  app.post("/", zValidator("json", presentationCreateSchema), async (c) => {
    const input = c.req.valid("json");
    const presentation = await c.var.services.presentations.create(
      c.var.orgId,
      c.var.org.plan,
      c.var.userId,
      input,
    );
    return c.json({ presentation }, 201);
  });

  app.get("/:id", async (c) => {
    const presentation = await c.var.services.presentations.get(
      c.var.orgId,
      c.req.param("id"),
    );
    return c.json({ presentation });
  });

  app.patch("/:id", zValidator("json", presentationUpdateSchema), async (c) => {
    const presentation = await c.var.services.presentations.update(
      c.var.orgId,
      c.req.param("id"),
      c.req.valid("json"),
    );
    return c.json({ presentation });
  });

  app.delete("/:id", async (c) => {
    await c.var.services.presentations.delete(c.var.orgId, c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}
