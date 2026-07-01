import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { domainErrorHandler } from "../../workers/api/controllers/error-handler";
import { createPresentationsController } from "../../workers/api/controllers/presentations-controller";
import {
  NotFoundError,
  PlanLimitError,
} from "../../workers/api/services/errors";
import type { ApiEnv } from "../../workers/api/types";
import {
  fakeOrg,
  fakePresentation,
  mockPresentationsService,
} from "../helpers/mocks";

/** Mount the controller the way createApi does, with stubbed auth/services. */
function makeApp(presentations = mockPresentationsService()) {
  const app = new Hono<ApiEnv>();
  app.onError(domainErrorHandler);
  app.use(async (c, next) => {
    c.set("orgId", "org_test_1");
    c.set("userId", "user_test_1");
    c.set("org", fakeOrg());
    c.set("services", { presentations } as never);
    await next();
  });
  app.route("/presentations", createPresentationsController());
  return { app, presentations };
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("presentations controller", () => {
  it("GET /presentations lists org presentations", async () => {
    const { app, presentations } = makeApp();
    presentations.list.mockResolvedValue([fakePresentation()]);

    const res = await app.request("/presentations");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { presentations: unknown[] };
    expect(body.presentations).toHaveLength(1);
    expect(presentations.list).toHaveBeenCalledWith("org_test_1");
  });

  it("POST /presentations creates and returns 201", async () => {
    const { app, presentations } = makeApp();
    presentations.create.mockResolvedValue(fakePresentation({ title: "New" }));

    const res = await app.request("/presentations", json({ title: "New" }));
    expect(res.status).toBe(201);
    expect(presentations.create).toHaveBeenCalledWith(
      "org_test_1",
      "free",
      "user_test_1",
      { title: "New" },
    );
  });

  it("POST /presentations returns 400 on invalid body", async () => {
    const { app, presentations } = makeApp();
    const res = await app.request("/presentations", json({ title: "" }));
    expect(res.status).toBe(400);
    expect(presentations.create).not.toHaveBeenCalled();
  });

  it("POST /presentations maps PlanLimitError to 402", async () => {
    const { app, presentations } = makeApp();
    presentations.create.mockRejectedValue(new PlanLimitError("cap reached"));

    const res = await app.request("/presentations", json({ title: "Over" }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("plan_limit");
  });

  it("GET /presentations/:id maps NotFoundError to 404", async () => {
    const { app, presentations } = makeApp();
    presentations.get.mockRejectedValue(new NotFoundError("nope"));

    const res = await app.request("/presentations/missing");
    expect(res.status).toBe(404);
  });

  it("PATCH /presentations/:id passes valid updates through", async () => {
    const { app, presentations } = makeApp();
    presentations.update.mockResolvedValue(
      fakePresentation({ title: "Renamed" }),
    );

    const res = await app.request("/presentations/pres_1", {
      ...json({ title: "Renamed" }),
      method: "PATCH",
    });
    expect(res.status).toBe(200);
    expect(presentations.update).toHaveBeenCalledWith(
      "org_test_1",
      "pres_1",
      { title: "Renamed" },
    );
  });

  it("DELETE /presentations/:id deletes", async () => {
    const { app, presentations } = makeApp();
    presentations.delete.mockResolvedValue(undefined);

    const res = await app.request("/presentations/pres_1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(presentations.delete).toHaveBeenCalledWith("org_test_1", "pres_1");
  });
});
