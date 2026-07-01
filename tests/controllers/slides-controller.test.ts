import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { domainErrorHandler } from "../../workers/api/controllers/error-handler";
import { createSlidesController } from "../../workers/api/controllers/slides-controller";
import { NotFoundError } from "../../workers/api/services/errors";
import type { ApiEnv } from "../../workers/api/types";
import { fakeSlide, mockSlidesService } from "../helpers/mocks";

/** Mount the controller the way createApi does — nested under a presentation,
 * so `presentationId` comes from the mount path. */
function makeApp(slides = mockSlidesService()) {
  const app = new Hono<ApiEnv>();
  app.onError(domainErrorHandler);
  app.use(async (c, next) => {
    c.set("orgId", "org_test_1");
    c.set("services", { slides } as never);
    await next();
  });
  app.route("/presentations/:presentationId/slides", createSlidesController());
  return { app, slides };
}

const BASE = "/presentations/pres_1/slides";

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("slides controller", () => {
  it("GET lists slides for the presentation", async () => {
    const { app, slides } = makeApp();
    slides.list.mockResolvedValue([fakeSlide()]);

    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slides: unknown[] };
    expect(body.slides).toHaveLength(1);
    expect(slides.list).toHaveBeenCalledWith("org_test_1", "pres_1");
  });

  it("POST adds a slide and returns 201", async () => {
    const { app, slides } = makeApp();
    slides.add.mockResolvedValue(fakeSlide());

    const res = await app.request(BASE, { method: "POST" });
    expect(res.status).toBe(201);
    expect(slides.add).toHaveBeenCalledWith("org_test_1", "pres_1");
  });

  it("POST /reorder passes orderedIds through", async () => {
    const { app, slides } = makeApp();
    slides.reorder.mockResolvedValue([fakeSlide()]);

    const res = await app.request(
      `${BASE}/reorder`,
      json("POST", { orderedIds: ["s1", "s0"] }),
    );
    expect(res.status).toBe(200);
    expect(slides.reorder).toHaveBeenCalledWith("org_test_1", "pres_1", [
      "s1",
      "s0",
    ]);
  });

  it("POST /reorder returns 400 on an empty id list", async () => {
    const { app, slides } = makeApp();
    const res = await app.request(
      `${BASE}/reorder`,
      json("POST", { orderedIds: [] }),
    );
    expect(res.status).toBe(400);
    expect(slides.reorder).not.toHaveBeenCalled();
  });

  it("PATCH /:slideId updates the scene", async () => {
    const { app, slides } = makeApp();
    slides.updateScene.mockResolvedValue(fakeSlide());

    const res = await app.request(
      `${BASE}/slide_1`,
      json("PATCH", { scene: { className: "Stage" } }),
    );
    expect(res.status).toBe(200);
    expect(slides.updateScene).toHaveBeenCalledWith("org_test_1", "slide_1", {
      className: "Stage",
    });
  });

  it("PATCH /:slideId returns 400 without a scene", async () => {
    const { app, slides } = makeApp();
    const res = await app.request(`${BASE}/slide_1`, json("PATCH", {}));
    expect(res.status).toBe(400);
    expect(slides.updateScene).not.toHaveBeenCalled();
  });

  it("GET /:slideId maps NotFoundError to 404", async () => {
    const { app, slides } = makeApp();
    slides.get.mockRejectedValue(new NotFoundError("nope"));

    const res = await app.request(`${BASE}/missing`);
    expect(res.status).toBe(404);
  });

  it("DELETE /:slideId deletes", async () => {
    const { app, slides } = makeApp();
    slides.delete.mockResolvedValue(undefined);

    const res = await app.request(`${BASE}/slide_1`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(slides.delete).toHaveBeenCalledWith("org_test_1", "slide_1");
  });
});
