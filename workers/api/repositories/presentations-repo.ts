import { and, desc, eq } from "drizzle-orm";
import { newId } from "~/lib/id";
import type { Db } from "../db/client";
import { presentations } from "../db/schema";
import { now } from "../db/schema/helpers";

// The repository is the ONLY layer that touches Drizzle/D1. Every query is
// scoped by `orgId` so one org can never read another's rows. Copy this file
// when you add your own resource.

export type Presentation = typeof presentations.$inferSelect;

export interface PresentationCreate {
  orgId: string;
  title: string;
  createdBy: string;
}

export interface PresentationUpdate {
  title?: string;
}

export function createPresentationsRepo(db: Db) {
  return {
    async create(input: PresentationCreate): Promise<Presentation> {
      const [row] = await db
        .insert(presentations)
        .values({
          id: newId(),
          orgId: input.orgId,
          title: input.title,
          createdBy: input.createdBy,
        })
        .returning();
      return row;
    },

    async getById(orgId: string, id: string): Promise<Presentation | null> {
      const [row] = await db
        .select()
        .from(presentations)
        .where(and(eq(presentations.orgId, orgId), eq(presentations.id, id)))
        .limit(1);
      return row ?? null;
    },

    async listByOrg(orgId: string): Promise<Presentation[]> {
      return db
        .select()
        .from(presentations)
        .where(eq(presentations.orgId, orgId))
        .orderBy(desc(presentations.createdAt));
    },

    async countByOrg(orgId: string): Promise<number> {
      const rows = await db
        .select({ id: presentations.id })
        .from(presentations)
        .where(eq(presentations.orgId, orgId));
      return rows.length;
    },

    async update(
      orgId: string,
      id: string,
      patch: PresentationUpdate,
    ): Promise<Presentation | null> {
      const set: Partial<typeof presentations.$inferInsert> = {
        updatedAt: now(),
      };
      if (patch.title !== undefined) set.title = patch.title;

      const [row] = await db
        .update(presentations)
        .set(set)
        .where(and(eq(presentations.orgId, orgId), eq(presentations.id, id)))
        .returning();
      return row ?? null;
    },

    async delete(orgId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(presentations)
        .where(and(eq(presentations.orgId, orgId), eq(presentations.id, id)))
        .returning({ id: presentations.id });
      return rows.length > 0;
    },
  };
}

export type PresentationsRepo = ReturnType<typeof createPresentationsRepo>;
