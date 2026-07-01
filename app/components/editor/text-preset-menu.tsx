import { Plus, Type } from "lucide-react";
import { useState } from "react";
import { quoteFontFamily } from "~/lib/font-loader";
import { newText, type TextElement } from "~/lib/slide-doc";
import { TEXT_PRESETS, textFromPreset } from "~/lib/text-presets";
import { cn } from "~/lib/utils";
import { useGoogleFonts } from "./use-google-fonts";

/** Toolbar "Text" control: a plain text box plus Canva-style typography presets,
 * each previewed in its own typeface. */
export function TextPresetMenu({ onAdd }: { onAdd: (el: TextElement) => void }) {
  const [open, setOpen] = useState(false);
  useGoogleFonts(TEXT_PRESETS.map((p) => p.fontFamily));

  function pick(el: TextElement) {
    onAdd(el);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Text"
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors [&_svg]:size-4",
          open
            ? "bg-accent text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Type />
        Text
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover absolute left-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border shadow-lg">
            <button
              type="button"
              onClick={() => pick(newText())}
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium"
            >
              <Plus className="size-4" />
              Add a text box
            </button>
            <div className="bg-border h-px" />
            <div className="max-h-80 overflow-y-auto py-1">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => pick(textFromPreset(preset))}
                  className="hover:bg-muted group flex w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{
                      fontFamily: quoteFontFamily(preset.fontFamily),
                      fontWeight: preset.fontStyle.includes("bold") ? 700 : 400,
                      fontStyle: preset.fontStyle.includes("italic")
                        ? "italic"
                        : "normal",
                      color: preset.fill,
                      fontSize: Math.min(preset.fontSize, 26),
                      lineHeight: 1.2,
                    }}
                  >
                    {preset.sample}
                  </span>
                  <span className="text-muted-foreground/70 shrink-0 text-[10px] uppercase">
                    {preset.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
