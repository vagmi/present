import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearElement,
  hasElement,
  readElement,
  writeElement,
} from "~/lib/element-clipboard";
import type { RectElement, SlideElement, TextElement } from "~/lib/slide-doc";

function fakeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: "el_1",
    type: "text",
    x: 100,
    y: 200,
    width: 300,
    height: 60,
    rotation: 0,
    text: "Hello",
    fontSize: 24,
    fontFamily: "Inter",
    fill: "#000",
    align: "left",
    fontStyle: "normal",
    ...overrides,
  };
}

function fakeRect(overrides: Partial<RectElement> = {}): RectElement {
  return {
    id: "el_2",
    type: "rect",
    x: 50,
    y: 80,
    width: 200,
    height: 100,
    rotation: 15,
    fill: "#ff0000",
    cornerRadius: 8,
    ...overrides,
  };
}

// localStorage isn't available in the Workers test environment; provide a mock.
function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
  vi.stubGlobal("localStorage", ls);
  return ls;
}

let ls: ReturnType<typeof mockLocalStorage>;

beforeEach(() => {
  ls = mockLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("element-clipboard", () => {
  it("is empty by default", () => {
    expect(hasElement()).toBe(false);
    expect(readElement()).toBeNull();
  });

  it("writes and reads a text element", () => {
    const el = fakeText();
    writeElement(el);

    expect(hasElement()).toBe(true);

    const pasted = readElement() as TextElement;
    expect(pasted.id).not.toBe(el.id);
    expect(pasted.type).toBe("text");
    expect(pasted.x).toBe(el.x + 16);
    expect(pasted.y).toBe(el.y + 16);
    expect(pasted.text).toBe("Hello");
    expect(pasted.fontSize).toBe(24);
    expect(pasted.fontFamily).toBe("Inter");
    expect(pasted.fill).toBe("#000");
    expect(pasted.align).toBe("left");
    expect(pasted.fontStyle).toBe("normal");
  });

  it("writes and reads a rect element", () => {
    const el = fakeRect();
    writeElement(el);

    const pasted = readElement() as RectElement;
    expect(pasted.id).not.toBe(el.id);
    expect(pasted.type).toBe("rect");
    expect(pasted.x).toBe(el.x + 16);
    expect(pasted.y).toBe(el.y + 16);
    expect(pasted.width).toBe(200);
    expect(pasted.height).toBe(100);
    expect(pasted.rotation).toBe(15);
    expect(pasted.fill).toBe("#ff0000");
    expect(pasted.cornerRadius).toBe(8);
  });

  it("readElement returns null when clipboard is empty", () => {
    expect(readElement()).toBeNull();
  });

  it("readElement returns null for malformed data", () => {
    ls.setItem("present:element-clipboard", "{bad json");
    expect(readElement()).toBeNull();
  });

  it("readElement returns null for wrong version", () => {
    ls.setItem(
      "present:element-clipboard",
      JSON.stringify({ v: 2, e: {} }),
    );
    expect(readElement()).toBeNull();
  });

  it("readElement returns null for missing element data", () => {
    ls.setItem("present:element-clipboard", JSON.stringify({ v: 1 }));
    expect(readElement()).toBeNull();
  });

  it("clearElement removes the clipboard entry", () => {
    writeElement(fakeText());
    expect(hasElement()).toBe(true);

    clearElement();
    expect(hasElement()).toBe(false);
    expect(readElement()).toBeNull();
  });

  it("writeElement strips the original id from storage", () => {
    const el = fakeText({ id: "original_id" });
    writeElement(el);

    const raw = ls.getItem("present:element-clipboard");
    const stored = JSON.parse(raw!);
    expect(stored.e.id).toBeUndefined();
  });

  it("writeElement preserves all element-type-specific fields", () => {
    const el: SlideElement = {
      id: "img_1",
      type: "image",
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      rotation: 0,
      src: "https://example.com/img.png",
    };
    writeElement(el);

    const pasted = readElement();
    expect(pasted).not.toBeNull();
    expect(pasted!.type).toBe("image");
    expect((pasted as { src: string }).src).toBe("https://example.com/img.png");
    expect(pasted!.x).toBe(26);
    expect(pasted!.y).toBe(36);
  });
});
