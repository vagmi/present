// Canva-style typography presets: click one to drop a pre-styled text element.
// Framework-free; the editor renders in-font previews and calls textFromPreset.

import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./scene";
import type { TextElement } from "./slide-doc";

export interface TextPreset {
  id: string;
  role: string;
  sample: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: string; // "normal" | "bold" | "italic" | "italic bold"
  fill: string;
  align: "left" | "center" | "right";
  width: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "heading",
    role: "Heading",
    sample: "Add a heading",
    fontFamily: "Poppins",
    fontSize: 72,
    fontStyle: "bold",
    fill: "#0e1116",
    align: "left",
    width: 660,
  },
  {
    id: "subheading",
    role: "Subheading",
    sample: "Add a subheading",
    fontFamily: "Poppins",
    fontSize: 40,
    fontStyle: "normal",
    fill: "#0e1116",
    align: "left",
    width: 560,
  },
  {
    id: "body",
    role: "Body",
    sample: "Add a little bit of body text",
    fontFamily: "Inter",
    fontSize: 24,
    fontStyle: "normal",
    fill: "#343a40",
    align: "left",
    width: 520,
  },
  {
    id: "display",
    role: "Display",
    sample: "DISPLAY",
    fontFamily: "Anton",
    fontSize: 96,
    fontStyle: "normal",
    fill: "#0e1116",
    align: "center",
    width: 620,
  },
  {
    id: "serif",
    role: "Elegant serif",
    sample: "Elegant",
    fontFamily: "Playfair Display",
    fontSize: 80,
    fontStyle: "bold",
    fill: "#0e1116",
    align: "center",
    width: 560,
  },
  {
    id: "script",
    role: "Script",
    sample: "Hello there",
    fontFamily: "Dancing Script",
    fontSize: 88,
    fontStyle: "normal",
    fill: "#8b3dff",
    align: "center",
    width: 560,
  },
  {
    id: "mono",
    role: "Label",
    sample: "LABEL",
    fontFamily: "IBM Plex Mono",
    fontSize: 30,
    fontStyle: "normal",
    fill: "#495057",
    align: "left",
    width: 360,
  },
];

export function textFromPreset(preset: TextPreset): TextElement {
  const height = Math.round(preset.fontSize * 1.4);
  return {
    id: crypto.randomUUID(),
    type: "text",
    x: Math.round((SLIDE_WIDTH - preset.width) / 2),
    y: Math.round((SLIDE_HEIGHT - height) / 2),
    width: preset.width,
    height,
    rotation: 0,
    text: preset.sample,
    fontSize: preset.fontSize,
    fontFamily: preset.fontFamily,
    fill: preset.fill,
    align: preset.align,
    fontStyle: preset.fontStyle,
  };
}
