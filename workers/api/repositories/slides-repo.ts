import { and, asc, eq, gt, sql } from "drizzle-orm";
import { newId } from "~/lib/id";
import type { SlideScene } from "~/lib/scene";
import type { Db } from "../db/client";
import { slides } from "../db/schema";
import { now } from "../db/schema/helpers";

// The repository is the ONLY layer that touches Drizzle/D1. Every query is
// scoped by `orgId` (and usually `presentationId`) so one org can never read
// another's rows.

export type Slide = typeof slides.$inferSelect;

export interface SlideCreate {
  orgId: string;
  presentationId: string;
  position: number;
  scene: SlideScene;
}

export function createSlidesRepo(db: Db) {
  return {
    async create(input: SlideCreate): Promise<Slide> {
      const [row] = await db
        .insert(slides)
        .values({
          id: newId(),
          orgId: input.orgId,
          presentationId: input.presentationId,
          position: input.position,
          scene: input.scene,
        })
        .returning();
      return row;
    },

    async getById(orgId: string, id: string): Promise<Slide | null> {
      const [row] = await db
        .select()
        .from(slides)
        .where(and(eq(slides.orgId, orgId), eq(slides.id, id)))
        .limit(1);
      return row ?? null;
    },

    async listByPresentation(
      orgId: string,
      presentationId: string,
    ): Promise<Slide[]> {
      return db
        .select()
        .from(slides)
        .where(
          and(
            eq(slides.orgId, orgId),
            eq(slides.presentationId, presentationId),
          ),
        )
        .orderBy(asc(slides.position));
    },

    async countByPresentation(
      orgId: string,
      presentationId: string,
    ): Promise<number> {
      const rows = await db
        .select({ id: slides.id })
        .from(slides)
        .where(
          and(
            eq(slides.orgId, orgId),
            eq(slides.presentationId, presentationId),
          ),
        );
      return rows.length;
    },

    async updateScene(
      orgId: string,
      id: string,
      scene: SlideScene,
    ): Promise<Slide | null> {
      const [row] = await db
        .update(slides)
        .set({ scene, updatedAt: now() })
        .where(and(eq(slides.orgId, orgId), eq(slides.id, id)))
        .returning();
      return row ?? null;
    },

    async updatePosition(
      orgId: string,
      id: string,
      position: number,
    ): Promise<void> {
      await db
        .update(slides)
        .set({ position, updatedAt: now() })
        .where(and(eq(slides.orgId, orgId), eq(slides.id, id)));
    },

    /** Increment position by 1 for every slide after `afterPosition` (exclusive),
     * scoped to a single presentation. Used to make room when inserting a
     * duplicated slide after the source. */
    async shiftPositionsAfter(
      orgId: string,
      presentationId: string,
      afterPosition: number,
    ): Promise<void> {
      await db
        .update(slides)
        .set({
          position: sql`${slides.position} + 1`,
          updatedAt: now(),
        })
        .where(
          and(
            eq(slides.orgId, orgId),
            eq(slides.presentationId, presentationId),
            gt(slides.position, afterPosition),
          ),
        );
    },

    async delete(orgId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(slides)
        .where(and(eq(slides.orgId, orgId), eq(slides.id, id)))
        .returning({ id: slides.id });
      return rows.length > 0;
    },
  };
}

export type SlidesRepo = ReturnType<typeof createSlidesRepo>;
