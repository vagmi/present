import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  ValidationError,
} from "../../workers/api/services/errors";
import { createSlidesService } from "../../workers/api/services/slides-service";
import {
  fakePresentation,
  fakeSlide,
  mockPresentationsRepo,
  mockSlidesRepo,
} from "../helpers/mocks";

const ORG = "org_test_1";
const PID = "pres_1";

function makeService() {
  const slidesRepo = mockSlidesRepo();
  const presentationsRepo = mockPresentationsRepo();
  presentationsRepo.getById.mockResolvedValue(fakePresentation({ id: PID }));
  const service = createSlidesService({ slidesRepo, presentationsRepo });
  return { service, slidesRepo, presentationsRepo };
}

describe("slides service", () => {
  it("list asserts the parent presentation belongs to the org", async () => {
    const { service, slidesRepo, presentationsRepo } = makeService();
    presentationsRepo.getById.mockResolvedValue(null);

    await expect(service.list(ORG, PID)).rejects.toBeInstanceOf(NotFoundError);
    expect(slidesRepo.listByPresentation).not.toHaveBeenCalled();
  });

  it("add appends at the next position with a blank scene", async () => {
    const { service, slidesRepo } = makeService();
    slidesRepo.countByPresentation.mockResolvedValue(2);
    slidesRepo.create.mockResolvedValue(fakeSlide({ position: 2 }));

    await service.add(ORG, PID);

    expect(slidesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG, presentationId: PID, position: 2 }),
    );
    const arg = slidesRepo.create.mock.calls[0][0];
    expect(arg.scene.elements).toEqual([]);
  });

  it("get throws NotFoundError for a missing slide", async () => {
    const { service, slidesRepo } = makeService();
    slidesRepo.getById.mockResolvedValue(null);
    await expect(service.get(ORG, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("updateScene throws NotFoundError when the repo misses", async () => {
    const { service, slidesRepo } = makeService();
    slidesRepo.updateScene.mockResolvedValue(null);
    await expect(
      service.updateScene(ORG, "nope", { className: "Stage" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("reorder", () => {
    it("rewrites positions to the new order", async () => {
      const { service, slidesRepo } = makeService();
      const s0 = fakeSlide({ id: "s0", position: 0 });
      const s1 = fakeSlide({ id: "s1", position: 1 });
      slidesRepo.listByPresentation.mockResolvedValue([s0, s1]);

      await service.reorder(ORG, PID, ["s1", "s0"]);

      expect(slidesRepo.updatePosition).toHaveBeenCalledWith(ORG, "s1", 0);
      expect(slidesRepo.updatePosition).toHaveBeenCalledWith(ORG, "s0", 1);
    });

    it("rejects a mismatched id set with ValidationError", async () => {
      const { service, slidesRepo } = makeService();
      slidesRepo.listByPresentation.mockResolvedValue([
        fakeSlide({ id: "s0" }),
        fakeSlide({ id: "s1" }),
      ]);

      await expect(
        service.reorder(ORG, PID, ["s0", "s0"]),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(slidesRepo.updatePosition).not.toHaveBeenCalled();
    });
  });

  it("delete throws NotFoundError when nothing was deleted", async () => {
    const { service, slidesRepo } = makeService();
    slidesRepo.delete.mockResolvedValue(false);
    await expect(service.delete(ORG, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe("duplicate", () => {
    it("throws NotFoundError when source slide is missing", async () => {
      const { service, slidesRepo } = makeService();
      slidesRepo.getById.mockResolvedValue(null);
      await expect(service.duplicate(ORG, "nope")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws NotFoundError when parent presentation does not belong to org", async () => {
      const { service, slidesRepo, presentationsRepo } = makeService();
      slidesRepo.getById.mockResolvedValue(
        fakeSlide({ presentationId: "pres_orphan" }),
      );
      presentationsRepo.getById.mockResolvedValue(null);
      await expect(service.duplicate(ORG, "slide_1")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("creates a new slide after the source with cloned scene", async () => {
      const { service, slidesRepo } = makeService();
      const source = fakeSlide({ position: 1, scene: { foo: "bar" } });
      const created = fakeSlide({ id: "slide_new", position: 2 });
      slidesRepo.getById.mockResolvedValue(source);
      slidesRepo.create.mockResolvedValue(created);

      const result = await service.duplicate(ORG, "slide_1");

      expect(result.id).toBe("slide_new");
      expect(slidesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: ORG,
          presentationId: source.presentationId,
          position: 2,
        }),
      );
      expect(slidesRepo.shiftPositionsAfter).toHaveBeenCalledWith(
        ORG,
        source.presentationId,
        1,
      );
    });

    it("clones the scene with fresh element ids", async () => {
      const { service, slidesRepo } = makeService();
      const source = fakeSlide({
        scene: {
          version: 1,
          background: "#fff",
          elements: [
            { id: "old_1", type: "text", x: 10, y: 20, text: "hello" },
            { id: "old_2", type: "rect", x: 30, y: 40, fill: "#000" },
          ],
        },
      });
      slidesRepo.getById.mockResolvedValue(source);
      const created = fakeSlide({ id: "slide_new" });
      slidesRepo.create.mockResolvedValue(created);

      await service.duplicate(ORG, "slide_1");

      const call = slidesRepo.create.mock.calls[0][0];
      const { elements } = call.scene as { elements: { id: string }[] };
      expect(elements.length).toBe(2);
      // Element ids are regenerated, not the same as the source.
      expect(elements[0].id).not.toBe("old_1");
      expect(elements[1].id).not.toBe("old_2");
      // But other properties are preserved.
      const { id: _id, ...rest } = elements[0] as { id: string };
      expect(rest).toMatchObject({ type: "text", x: 10, y: 20, text: "hello" });
    });
  });
});
