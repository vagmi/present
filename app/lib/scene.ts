// Shared, framework-free description of a slide's stored scene. At the
// persistence boundary (D1 column, repo, service) we treat it as an opaque JSON
// object — the rich, typed editor model lives in `slide-doc.ts` and is a
// concern of the editor UI only. Keeping this permissive means controllers and
// services never need to understand the document shape to store it. Stays free
// of React/Konva imports.

export interface SlideScene {
  [key: string]: unknown;
}

/** Design surface for a slide — 16:9. */
export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;

/** A fresh, empty slide document (see `slide-doc.ts` for the shape). */
export function emptyScene(): SlideScene {
  return { version: 1, background: "#ffffff", elements: [] };
}
