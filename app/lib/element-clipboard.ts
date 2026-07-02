import type { SlideElement } from "./slide-doc";

const KEY = "present:element-clipboard";

/** Serialized element stored in localStorage — the id is stripped on write and
 * regenerated on read so every paste is a fresh element. */
interface StoredElement {
  v: 1; // version for forward-compat
  e: Omit<SlideElement, "id">;
}

/** Copy an element to the clipboard (localStorage). The element id is stripped
 * so pastes always get fresh UUIDs. */
export function writeElement(el: SlideElement): void {
  const { id: _, ...rest } = el;
  const stored: StoredElement = { v: 1, e: rest as Omit<SlideElement, "id"> };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // localStorage full or unavailable — silently no-op
  }
}

/** Read an element from the clipboard, assigning a fresh id and offsetting
 * position by 16px so the pasted element is visibly distinct from the source.
 * Returns null when the clipboard is empty or the data is invalid. */
export function readElement(): SlideElement | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredElement;
    if (!stored || stored.v !== 1 || !stored.e) return null;
    return {
      ...stored.e,
      id: crypto.randomUUID(),
      x: stored.e.x + 16,
      y: stored.e.y + 16,
    } as SlideElement;
  } catch {
    return null;
  }
}

/** Clear the element clipboard. */
export function clearElement(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}

/** True when the clipboard holds a readable element. */
export function hasElement(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
