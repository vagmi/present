import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { organizations } from "./organizations";
import { now } from "./helpers";

/** A presentation (deck). The first real resource, grown from the `items`
 * example. Every row is scoped to an org via `orgId`; `createdBy` records the
 * Clerk user id for attribution. Slides live in their own table (Phase 2) and
 * reference a presentation. Copy this slice's shape when you add a resource. */
export const presentations = sqliteTable(
  "presentations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    title: text("title").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("presentations_org_id_idx").on(t.orgId)],
);
