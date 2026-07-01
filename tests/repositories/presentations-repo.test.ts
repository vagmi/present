import { describe, expect, it } from "vitest";
import { createPresentationsRepo } from "../../workers/api/repositories/presentations-repo";
import { makeOrg, makePresentation, testDb } from "../helpers/fixtures";

describe("presentations repo", () => {
  it("creates with a generated id", async () => {
    const db = testDb();
    await makeOrg(db);
    const presentation = await makePresentation(db, "org_test_1");

    expect(presentation.id).toBeTruthy();
    expect(presentation.title).toBe("First Deck");
    expect(presentation.createdBy).toBe("user_test_1");
  });

  it("scopes getById by org", async () => {
    const db = testDb();
    const repo = createPresentationsRepo(db);
    await makeOrg(db, "org_a");
    await makeOrg(db, "org_b");
    const presentation = await makePresentation(db, "org_a");

    expect(await repo.getById("org_a", presentation.id)).not.toBeNull();
    expect(await repo.getById("org_b", presentation.id)).toBeNull();
  });

  it("lists and counts per org", async () => {
    const db = testDb();
    const repo = createPresentationsRepo(db);
    await makeOrg(db, "org_list_a");
    await makeOrg(db, "org_list_b");
    await makePresentation(db, "org_list_a", { title: "One" });
    await makePresentation(db, "org_list_a", { title: "Two" });
    await makePresentation(db, "org_list_b", { title: "Other" });

    const list = await repo.listByOrg("org_list_a");
    expect(list).toHaveLength(2);
    expect(await repo.countByOrg("org_list_a")).toBe(2);
    expect(await repo.countByOrg("org_list_b")).toBe(1);
  });

  it("applies partial updates and leaves other fields intact", async () => {
    const db = testDb();
    const repo = createPresentationsRepo(db);
    await makeOrg(db);
    const presentation = await makePresentation(db, "org_test_1");

    const updated = await repo.update("org_test_1", presentation.id, {
      title: "Renamed",
    });
    expect(updated?.title).toBe("Renamed");
    expect(updated?.createdBy).toBe("user_test_1");
  });

  it("deletes scoped by org", async () => {
    const db = testDb();
    const repo = createPresentationsRepo(db);
    await makeOrg(db, "org_a");
    await makeOrg(db, "org_b");
    const presentation = await makePresentation(db, "org_a");

    expect(await repo.delete("org_b", presentation.id)).toBe(false);
    expect(await repo.delete("org_a", presentation.id)).toBe(true);
    expect(await repo.getById("org_a", presentation.id)).toBeNull();
  });
});
