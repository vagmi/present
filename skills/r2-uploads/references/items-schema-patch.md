# Storing an upload reference on a resource (optional)

To attach an uploaded file to an item, add a column to
`workers/api/db/schema/items.ts`:

```ts
export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    imageKey: text("image_key"), // R2 object key, e.g. "org_x/01h...png"
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("items_org_id_idx").on(t.orgId)],
);
```

Then generate + apply a migration:

```
pnpm db:generate
pnpm db:migrate:local
```

Store the **key** (not a URL) in the DB. The bucket is private, so render it
through the authed endpoint — `<img src={`/api/uploads/${item.imageKey}`} />` —
rather than building a public r2.dev URL. Keeping only the key means moving
buckets later doesn't require a data migration.
