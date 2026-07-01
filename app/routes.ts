import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in/*", "routes/sign-in.tsx"),
  route("sign-up/*", "routes/sign-up.tsx"),

  // No-org state lives OUTSIDE the dashboard layout so dashboard child
  // loaders (which 403 without an active org) never run.
  route("app/select-org", "routes/app/select-org.tsx"),

  // Org-scoped dashboard. Add your own resource routes alongside `presentations`.
  route("app", "routes/app/layout.tsx", [
    index("routes/app/presentations-list.tsx"),
    // Opening a presentation redirects straight into the editor (first slide).
    route(
      "presentations/:presentationId/edit",
      "routes/app/presentation-open.tsx",
    ),
    route("members", "routes/app/members.tsx"),
  ]),

  // Full-screen editor — lives OUTSIDE the dashboard layout so it can own the
  // whole viewport (Google-Slides-style panels).
  route(
    "editor/:presentationId/:slideId",
    "routes/editor/slide-editor.tsx",
  ),
] satisfies RouteConfig;
