import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { quoteFontFamily } from "~/lib/font-loader";
import { GOOGLE_FONTS } from "~/lib/google-fonts";
import { cn } from "~/lib/utils";
import { useGoogleFonts } from "./use-google-fonts";

/** Searchable Google Fonts combobox. Each result renders in its own typeface
 * (loaded on demand), so users can preview before choosing. */
export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q))
      : GOOGLE_FONTS;
    return list.slice(0, 40);
  }, [query]);

  // Load the current value + every visible result so previews render in-font.
  useGoogleFonts([value, ...results]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input bg-background hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
      >
        <span className="truncate" style={{ fontFamily: quoteFontFamily(value) }}>
          {value}
        </span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-lg">
            <div className="flex items-center gap-2 border-b px-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fonts"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {results.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    onChange(f);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={{ fontFamily: quoteFontFamily(f) }}
                  className={cn(
                    "hover:bg-muted flex w-full items-center px-3 py-1.5 text-left text-sm",
                    f === value && "bg-accent text-primary",
                  )}
                >
                  {f}
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-xs">
                  No fonts match “{query}”.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
