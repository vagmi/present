import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SlideScene } from "~/lib/scene";
import { organizations } from "./organizations";
import { presentations } from "./presentations";
import { now } from "./helpers";

/** A slide within a presentation. Ordered by `position` (0-based) and scoped to
 * an org via `orgId` (denormalized alongside `presentationId` so every query
 * stays org-scoped without a join). `scene` holds the Konva stage JSON the
 * editor renders (Phase 3). */
export const slides = sqliteTable(
  "slides",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    presentationId: text("presentation_id")
      .notNull()
      .references(() => presentations.id),
    position: integer("position").notNull(),
    scene: text("scene", { mode: "json" }).notNull().$type<SlideScene>(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("slides_org_presentation_idx").on(t.orgId, t.presentationId)],
);
