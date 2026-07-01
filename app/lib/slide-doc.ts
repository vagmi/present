// The rich, typed slide-document model the editor works with. It serializes to
// the opaque `SlideScene` JSON stored on the slide (see `scene.ts`). Framework-
// free (no React/Konva) so it can be unit-tested and shared.

import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideScene } from "./scene";

export type ElementType = "text" | "rect" | "image";

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: "left" | "center" | "right";
  fontStyle: string; // "normal" | "bold" | "italic" | "italic bold"
}

export interface RectElement extends BaseElement {
  type: "rect";
  fill: string;
  cornerRadius: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
}

export type SlideElement = TextElement | RectElement | ImageElement;

export interface SlideDoc {
  version: 1;
  background: string;
  elements: SlideElement[];
}

function id(): string {
  // Client/worker both expose crypto.randomUUID; elements only get ids in the
  // browser, so this is always available at call time.
  return crypto.randomUUID();
}

/** Coerce whatever is stored (possibly empty/old/malformed) into a valid doc. */
export function normalizeDoc(scene: SlideScene | null | undefined): SlideDoc {
  const s = (scene ?? {}) as Partial<SlideDoc>;
  return {
    version: 1,
    background: typeof s.background === "string" ? s.background : "#ffffff",
    elements: Array.isArray(s.elements) ? (s.elements as SlideElement[]) : [],
  };
}

const centered = (w: number, h: number) => ({
  x: Math.round((SLIDE_WIDTH - w) / 2),
  y: Math.round((SLIDE_HEIGHT - h) / 2),
});

export function newText(): TextElement {
  const width = 440;
  const height = 80;
  return {
    id: id(),
    type: "text",
    ...centered(width, height),
    width,
    height,
    rotation: 0,
    text: "Double-click to edit",
    fontSize: 44,
    fontFamily: "Plus Jakarta Sans Variable, sans-serif",
    fill: "#0e1116",
    align: "left",
    fontStyle: "normal",
  };
}

export function newRect(): RectElement {
  const width = 280;
  const height = 180;
  return {
    id: id(),
    type: "rect",
    ...centered(width, height),
    width,
    height,
    rotation: 0,
    fill: "#8b3dff",
    cornerRadius: 12,
  };
}

export function newImage(src: string): ImageElement {
  const width = 360;
  const height = 240;
  return {
    id: id(),
    type: "image",
    ...centered(width, height),
    width,
    height,
    rotation: 0,
    src,
  };
}

export function updateElement(
  doc: SlideDoc,
  elementId: string,
  patch: Partial<SlideElement>,
): SlideDoc {
  return {
    ...doc,
    elements: doc.elements.map((el) =>
      el.id === elementId ? ({ ...el, ...patch } as SlideElement) : el,
    ),
  };
}

export function addElement(doc: SlideDoc, element: SlideElement): SlideDoc {
  return { ...doc, elements: [...doc.elements, element] };
}

export function removeElement(doc: SlideDoc, elementId: string): SlideDoc {
  return { ...doc, elements: doc.elements.filter((el) => el.id !== elementId) };
}

/** Move an element one step forward/back in the z-order (paint order). */
export function reorderElement(
  doc: SlideDoc,
  elementId: string,
  direction: "forward" | "back",
): SlideDoc {
  const els = [...doc.elements];
  const i = els.findIndex((el) => el.id === elementId);
  if (i === -1) return doc;
  const j = direction === "forward" ? i + 1 : i - 1;
  if (j < 0 || j >= els.length) return doc;
  [els[i], els[j]] = [els[j], els[i]];
  return { ...doc, elements: els };
}
