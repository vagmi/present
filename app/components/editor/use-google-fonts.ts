import { useEffect, useState } from "react";
import { loadGoogleFont } from "~/lib/font-loader";

/** Load every family in `families` (deduped, cached) and return a counter that
 * bumps each time one finishes — consumers depend on it to redraw a canvas or
 * re-render once the real glyphs are available. SSR-safe (effect only). */
export function useGoogleFonts(families: string[]): number {
  const [tick, setTick] = useState(0);
  const key = Array.from(new Set(families.filter(Boolean))).sort().join("|");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    for (const family of key.split("|")) {
      loadGoogleFont(family).then(() => {
        if (!cancelled) setTick((t) => t + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return tick;
}
