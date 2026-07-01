import { describe, expect, it } from "vitest";
import { createSlidesRepo } from "../../workers/api/repositories/slides-repo";
import {
  makeOrg,
  makePresentation,
  makeSlide,
  testDb,
} from "../helpers/fixtures";

async function seedDeck(db = testDb(), orgId = "org_test_1") {
  await makeOrg(db, orgId);
  const pres = await makePresentation(db, orgId);
  return { db, orgId, presentationId: pres.id };
}

describe("slides repo", () => {
  it("creates a slide with a generated id and stored scene", async () => {
    const { db, orgId, presentationId } = await seedDeck();
    const slide = await makeSlide(db, orgId, presentationId);

    expect(slide.id).toBeTruthy();
    expect(slide.position).toBe(0);
    expect(slide.presentationId).toBe(presentationId);
    // JSON column round-trips
    expect(slide.scene.elements).toEqual([]);
    expect(slide.scene.background).toBe("#ffffff");
  });

  it("lists by presentation ordered by position, scoped by org", async () => {
    const db = testDb();
    const a = await seedDeck(db, "org_a");
    const b = await seedDeck(db, "org_b");
    await makeSlide(db, "org_a", a.presentationId, 1);
    await makeSlide(db, "org_a", a.presentationId, 0);
    await makeSlide(db, "org_b", b.presentationId, 0);

    const repo = createSlidesRepo(db);
    const list = await repo.listByPresentation("org_a", a.presentationId);
    expect(list.map((s) => s.position)).toEqual([0, 1]);
    expect(await repo.countByPresentation("org_a", a.presentationId)).toBe(2);
    expect(await repo.countByPresentation("org_b", b.presentationId)).toBe(1);
  });

  it("scopes getById by org", async () => {
    const db = testDb();
    const a = await seedDeck(db, "org_a");
    await makeOrg(db, "org_b");
    const slide = await makeSlide(db, "org_a", a.presentationId);

    const repo = createSlidesRepo(db);
    expect(await repo.getById("org_a", slide.id)).not.toBeNull();
    expect(await repo.getById("org_b", slide.id)).toBeNull();
  });

  it("updates the scene", async () => {
    const { db, orgId, presentationId } = await seedDeck();
    const slide = await makeSlide(db, orgId, presentationId);
    const repo = createSlidesRepo(db);

    const updated = await repo.updateScene(orgId, slide.id, {
      version: 1,
      background: "#101010",
      elements: [{ id: "e1", type: "rect" }],
    });
    expect((updated?.scene.elements as unknown[]).length).toBe(1);
    expect(updated?.scene.background).toBe("#101010");
  });

  it("updates position to reorder", async () => {
    const { db, orgId, presentationId } = await seedDeck();
    const first = await makeSlide(db, orgId, presentationId, 0);
    const second = await makeSlide(db, orgId, presentationId, 1);
    const repo = createSlidesRepo(db);

    await repo.updatePosition(orgId, first.id, 1);
    await repo.updatePosition(orgId, second.id, 0);

    const list = await repo.listByPresentation(orgId, presentationId);
    expect(list.map((s) => s.id)).toEqual([second.id, first.id]);
  });

  it("deletes scoped by org", async () => {
    const db = testDb();
    const a = await seedDeck(db, "org_a");
    await makeOrg(db, "org_b");
    const slide = await makeSlide(db, "org_a", a.presentationId);
    const repo = createSlidesRepo(db);

    expect(await repo.delete("org_b", slide.id)).toBe(false);
    expect(await repo.delete("org_a", slide.id)).toBe(true);
    expect(await repo.getById("org_a", slide.id)).toBeNull();
  });
});
