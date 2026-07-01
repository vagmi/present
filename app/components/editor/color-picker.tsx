import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

// A curated solid-color palette (Open-Color inspired): a neutral ramp followed
// by eight hues across five shades, laid out as an 8-column grid.
const SWATCHES: string[] = [
  // neutrals
  "#ffffff", "#f1f3f5", "#dee2e6", "#adb5bd", "#868e96", "#495057", "#212529", "#000000",
  // light → dark, hues: red orange yellow green teal blue violet pink
  "#ffc9c9", "#ffd8a8", "#ffec99", "#b2f2bb", "#96f2d7", "#a5d8ff", "#d0bfff", "#fcc2d7",
  "#ff8787", "#ffa94d", "#ffe066", "#69db7c", "#38d9a9", "#4dabf7", "#9775fa", "#f783ac",
  "#fa5252", "#ff922b", "#ffd43b", "#40c057", "#12b886", "#228be6", "#7950f2", "#e64980",
  "#f03e3e", "#fd7e14", "#fcc419", "#2f9e44", "#0ca678", "#1971c2", "#7048e8", "#d6336c",
  "#c92a2a", "#d9480f", "#f08c00", "#2b8a3e", "#087f5b", "#1864ab", "#5f3dc4", "#a61e4d",
];

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

function expand(hex: string): string | null {
  if (HEX6.test(hex)) return hex.toLowerCase();
  if (HEX3.test(hex)) {
    const [r, g, b] = hex.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const current = value.toLowerCase();
  const nativeValue = HEX6.test(value) ? value : "#000000";

  function onHexInput(v: string) {
    setDraft(v);
    const normalized = expand(v);
    if (normalized) onChange(normalized);
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="border-input hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1"
        >
          <span
            className="size-4 rounded-sm border"
            style={{ background: value }}
          />
          <span className="font-mono text-xs uppercase">{value}</span>
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover absolute right-0 z-50 mt-1 w-56 rounded-lg border p-3 shadow-lg">
            <div className="grid grid-cols-8 gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  aria-label={c}
                  title={c}
                  style={{ background: c }}
                  className={cn(
                    "size-5 rounded-md border",
                    current === c &&
                      "ring-primary ring-offset-background ring-2 ring-offset-1",
                  )}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={nativeValue}
                onChange={(e) => onChange(e.target.value.toLowerCase())}
                aria-label="Custom color"
                className="border-input h-8 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent"
              />
              <input
                type="text"
                value={draft}
                onChange={(e) => onHexInput(e.target.value)}
                spellCheck={false}
                className="border-input focus-visible:ring-ring w-full rounded-md border px-2 py-1 font-mono text-sm uppercase outline-none focus-visible:ring-2"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
