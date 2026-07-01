import type { CSSProperties } from "react";
import { SLIDE_WIDTH, type SlideScene } from "~/lib/scene";
import { normalizeDoc } from "~/lib/slide-doc";
import { cn } from "~/lib/utils";

/** A lightweight, SSR-safe DOM rendering of a slide document — used for
 * filmstrip thumbnails and deck previews. It mirrors the Konva canvas closely
 * enough to read at a glance, using container-query units (`cqw`) so it scales
 * fluidly to whatever box it's dropped into. */
export function SlidePreview({
  scene,
  className,
}: {
  scene: SlideScene | null | undefined;
  className?: string;
}) {
  const doc = normalizeDoc(scene);
  const cqw = (px: number) => `${(px / SLIDE_WIDTH) * 100}cqw`;

  return (
    <div
      className={cn("relative aspect-video overflow-hidden", className)}
      style={{ containerType: "inline-size", background: doc.background }}
    >
      {doc.elements.map((el) => {
        const base: CSSProperties = {
          position: "absolute",
          left: cqw(el.x),
          top: cqw(el.y),
          width: cqw(el.width),
          height: cqw(el.height),
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          transformOrigin: "top left",
        };
        if (el.type === "rect") {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                background: el.fill,
                borderRadius: cqw(el.cornerRadius),
              }}
            />
          );
        }
        if (el.type === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={el.id}
              src={el.src}
              alt=""
              style={{ ...base, objectFit: "cover" }}
            />
          );
        }
        return (
          <div
            key={el.id}
            style={{
              ...base,
              color: el.fill,
              fontSize: cqw(el.fontSize),
              fontFamily: el.fontFamily,
              textAlign: el.align,
              fontWeight: el.fontStyle.includes("bold") ? 700 : 400,
              fontStyle: el.fontStyle.includes("italic") ? "italic" : "normal",
              lineHeight: 1.2,
              overflow: "hidden",
              whiteSpace: "pre-wrap",
            }}
          >
            {el.text}
          </div>
        );
      })}
    </div>
  );
}
