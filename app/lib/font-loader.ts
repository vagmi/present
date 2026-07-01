// Loads Google Fonts on demand in the browser. We request families without
// axes (`?family=Name&display=swap`) so any valid family loads without css2
// axis-mismatch errors; bold/italic are synthesized when a face is absent.
// Framework-free and SSR-guarded (no React imports).

const cache = new Map<string, Promise<void>>();

function encodeFamily(family: string): string {
  return family.trim().replace(/\s+/g, "+");
}

export function googleFontHref(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeFamily(family)}&display=swap`;
}

function linkId(family: string): string {
  return `gf-${family.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** Inject the stylesheet for a family (once) and resolve when the face is
 * actually available, so canvases can be redrawn with the real glyphs. */
export function loadGoogleFont(family: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const key = family.trim();
  if (!key) return Promise.resolve();
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const id = linkId(key);
    const settle = () => {
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fonts?.load) {
        fonts
          .load(`16px "${key}"`)
          .then(() => resolve())
          .catch(() => resolve());
      } else {
        resolve();
      }
    };

    if (document.getElementById(id)) {
      settle();
      return;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontHref(key);
    link.addEventListener("load", settle);
    link.addEventListener("error", () => resolve());
    document.head.appendChild(link);
  });

  cache.set(key, promise);
  return promise;
}

/** A CSS font-family value safe to drop into inline styles (quotes multi-word
 * families, keeps existing comma lists as-is, always has a fallback). */
export function quoteFontFamily(family: string): string {
  const f = (family || "").trim();
  if (!f) return "sans-serif";
  if (f.includes(",") || f.includes('"') || f.includes("'")) return f;
  return `"${f}", sans-serif`;
}
