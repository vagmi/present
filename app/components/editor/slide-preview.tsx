import type { CSSProperties } from "react";
import { quoteFontFamily } from "~/lib/font-loader";
import { SLIDE_WIDTH, type SlideScene } from "~/lib/scene";
import { normalizeDoc, resolveTextEffect } from "~/lib/slide-doc";
import { cn } from "~/lib/utils";
import { useGoogleFonts } from "./use-google-fonts";

/** Append an alpha byte to a #rrggbb color; falls back to the color as-is. */
function withAlpha(hex: string, opacity: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

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

  // Load any Google Fonts the slide references so the preview renders in-font.
  useGoogleFonts(
    doc.elements.flatMap((el) => (el.type === "text" ? [el.fontFamily] : [])),
  );

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
        const fx = resolveTextEffect(el.effect);
        let textShadow: string | undefined;
        let filter: string | undefined;
        if (fx?.type === "shadow") {
          const c = withAlpha(fx.color, fx.opacity);
          textShadow = `${cqw(fx.offset)} ${cqw(fx.offset)} ${cqw(fx.blur)} ${c}`;
        } else if (fx?.type === "glow") {
          const c = withAlpha(fx.color, fx.opacity);
          textShadow = `0 0 ${cqw(fx.blur)} ${c}, 0 0 ${cqw(fx.blur * 1.7)} ${c}`;
        } else if (fx?.type === "blur") {
          filter = `blur(${cqw(fx.amount)})`;
        }
        return (
          <div
            key={el.id}
            style={{
              ...base,
              color: el.fill,
              fontSize: cqw(el.fontSize),
              fontFamily: quoteFontFamily(el.fontFamily),
              textAlign: el.align,
              fontWeight: el.fontStyle.includes("bold") ? 700 : 400,
              fontStyle: el.fontStyle.includes("italic") ? "italic" : "normal",
              lineHeight: 1.2,
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              textShadow,
              filter,
            }}
          >
            {el.text}
          </div>
        );
      })}
    </div>
  );
}
