import { newId } from "~/lib/id";
import { emptyScene, type SlideScene } from "~/lib/scene";
import type { SlideDoc } from "~/lib/slide-doc";
import type { PresentationsRepo } from "../repositories/presentations-repo";
import type { Slide, SlidesRepo } from "../repositories/slides-repo";
import { NotFoundError, ValidationError } from "./errors";

// Slides always belong to a presentation. The service verifies the parent
// presentation belongs to the org before any slide op, so a client can never
// reach another org's slides by guessing ids.

export interface SlidesServiceDeps {
  slidesRepo: SlidesRepo;
  presentationsRepo: PresentationsRepo;
}

export function createSlidesService({
  slidesRepo,
  presentationsRepo,
}: SlidesServiceDeps) {
  async function assertPresentation(
    orgId: string,
    presentationId: string,
  ): Promise<void> {
    const parent = await presentationsRepo.getById(orgId, presentationId);
    if (!parent)
      throw new NotFoundError(`presentation ${presentationId} not found`);
  }

  async function get(orgId: string, id: string): Promise<Slide> {
    const slide = await slidesRepo.getById(orgId, id);
    if (!slide) throw new NotFoundError(`slide ${id} not found`);
    return slide;
  }

  return {
    async list(orgId: string, presentationId: string): Promise<Slide[]> {
      await assertPresentation(orgId, presentationId);
      return slidesRepo.listByPresentation(orgId, presentationId);
    },

    get,

    /** Append a blank slide at the end of the deck. */
    async add(orgId: string, presentationId: string): Promise<Slide> {
      await assertPresentation(orgId, presentationId);
      const position = await slidesRepo.countByPresentation(
        orgId,
        presentationId,
      );
      return slidesRepo.create({
        orgId,
        presentationId,
        position,
        scene: emptyScene(),
      });
    },

    /** Persist a slide's canvas scene (used by the editor, Phase 3). */
    async updateScene(
      orgId: string,
      id: string,
      scene: SlideScene,
    ): Promise<Slide> {
      const updated = await slidesRepo.updateScene(orgId, id, scene);
      if (!updated) throw new NotFoundError(`slide ${id} not found`);
      return updated;
    },

    /** Reorder a deck: `orderedIds` must be exactly the presentation's slide
     * ids, in the new order. Positions are rewritten to the new indices. */
    async reorder(
      orgId: string,
      presentationId: string,
      orderedIds: string[],
    ): Promise<Slide[]> {
      await assertPresentation(orgId, presentationId);
      const current = await slidesRepo.listByPresentation(
        orgId,
        presentationId,
      );
      const currentIds = new Set(current.map((s) => s.id));
      const uniqueIds = new Set(orderedIds);
      if (
        orderedIds.length !== current.length ||
        uniqueIds.size !== orderedIds.length ||
        orderedIds.some((id) => !currentIds.has(id))
      ) {
        throw new ValidationError(
          "orderedIds must contain exactly this presentation's slide ids",
        );
      }
      await Promise.all(
        orderedIds.map((id, i) => slidesRepo.updatePosition(orgId, id, i)),
      );
      return slidesRepo.listByPresentation(orgId, presentationId);
    },

    /** Duplicate a slide, inserting it after the source and shifting
     * subsequent slides down one position. The cloned scene gets fresh element
     * ids so there are no collisions across slides. */
    async duplicate(orgId: string, id: string): Promise<Slide> {
      const source = await slidesRepo.getById(orgId, id);
      if (!source) throw new NotFoundError(`slide ${id} not found`);
      await assertPresentation(orgId, source.presentationId);

      // Clone the scene with fresh element ULIDs.
      const doc = source.scene as unknown as SlideDoc;
      const clonedScene: SlideScene = {
        ...doc,
        elements: (doc.elements ?? []).map((el) => ({
          ...el,
          id: newId(),
        })),
      };

      const created = await slidesRepo.create({
        orgId,
        presentationId: source.presentationId,
        position: source.position + 1,
        scene: clonedScene,
      });
      await slidesRepo.shiftPositionsAfter(
        orgId,
        source.presentationId,
        source.position,
      );
      return created;
    },

    async delete(orgId: string, id: string): Promise<void> {
      const deleted = await slidesRepo.delete(orgId, id);
      if (!deleted) throw new NotFoundError(`slide ${id} not found`);
    },
  };
}

export type SlidesService = ReturnType<typeof createSlidesService>;
