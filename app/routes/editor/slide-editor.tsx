import { getAuth } from "@clerk/react-router/server";
import { ArrowLeft, Copy, Play, Plus, Square, Trash2 } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, redirect, useNavigate } from "react-router";
import { toast } from "sonner";
import { ClientOnly } from "~/components/editor/client-only";
import { ColorPicker } from "~/components/editor/color-picker";
import { FontPicker } from "~/components/editor/font-picker";
import { ImageUploadMenu } from "~/components/editor/image-upload-menu";
import { SlidePreview } from "~/components/editor/slide-preview";
import { TextPresetMenu } from "~/components/editor/text-preset-menu";
import { Toaster } from "~/components/ui/sonner";
import { Button } from "~/components/ui/button";
import { apiFetch } from "~/lib/api-client.server";
import { hasElement, readElement, writeElement } from "~/lib/element-clipboard";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "~/lib/scene";
import {
  addElement,
  type ImageElement,
  newImage,
  newRect,
  normalizeDoc,
  removeElement,
  reorderElement,
  type SlideDoc,
  type SlideElement,
  type TextEffect,
  type TextEffectType,
  type TextElement,
  updateElement,
} from "~/lib/slide-doc";
import { cn } from "~/lib/utils";
import type { Presentation } from "../../../workers/api/repositories/presentations-repo";
import type { Slide } from "../../../workers/api/repositories/slides-repo";
import type { Route } from "./+types/slide-editor";

const SlideStage = lazy(() => import("~/components/editor/slide-stage"));

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.presentation.title ?? "Editor"} — Present` }];
}

export async function loader(args: Route.LoaderArgs) {
  const auth = await getAuth(args);
  if (!auth.userId) throw redirect("/sign-in");
  if (!auth.orgId) throw redirect("/app/select-org");

  const { request, params } = args;
  const { presentationId: pid, slideId: sid } = params;
  const [presRes, slidesRes, slideRes] = await Promise.all([
    apiFetch<{ presentation: Presentation }>(
      request,
      `/api/presentations/${pid}`,
    ),
    apiFetch<{ slides: Slide[] }>(request, `/api/presentations/${pid}/slides`),
    apiFetch<{ slide: Slide }>(
      request,
      `/api/presentations/${pid}/slides/${sid}`,
    ),
  ]);
  return {
    presentation: presRes.presentation,
    slides: slidesRes.slides,
    slide: slideRes.slide,
  };
}

export default function SlideEditorRoute({ loaderData }: Route.ComponentProps) {
  // Remount per slide so all editor state re-initializes from the loaded scene.
  return <Editor key={loaderData.slide.id} {...loaderData} />;
}

// ---- autosave -------------------------------------------------------------

function saveScene(pid: string, sid: string, scene: SlideDoc, keepalive = false) {
  return fetch(`/api/presentations/${pid}/slides/${sid}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    keepalive,
    body: JSON.stringify({ scene }),
  });
}

type SaveState = "idle" | "saving" | "saved";

function useAutosave(pid: string, sid: string, doc: SlideDoc): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const first = useRef(true);
  const dirty = useRef(false);
  const latest = useRef(doc);
  latest.current = doc;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    setState("saving");
    const t = setTimeout(async () => {
      try {
        await saveScene(pid, sid, latest.current);
        dirty.current = false;
        setState("saved");
      } catch {
        setState("idle");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [doc, pid, sid]);

  // Flush any pending change when the editor unmounts (e.g. switching slides).
  useEffect(() => {
    return () => {
      if (dirty.current) saveScene(pid, sid, latest.current, true);
    };
  }, [pid, sid]);

  return state;
}

// ---- image upload ---------------------------------------------------------

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/** Build an image element sized to the file's aspect ratio, fit within the
 * slide and centered. */
function fittedImage(
  src: string,
  dims: { w: number; h: number } | null,
): ImageElement {
  const el = newImage(src);
  if (dims && dims.w > 0 && dims.h > 0) {
    const ratio = Math.min(640 / dims.w, 420 / dims.h, 1);
    const w = Math.max(24, Math.round(dims.w * ratio));
    const h = Math.max(24, Math.round(dims.h * ratio));
    el.width = w;
    el.height = h;
    el.x = Math.round((SLIDE_WIDTH - w) / 2);
    el.y = Math.round((SLIDE_HEIGHT - h) / 2);
  }
  return el;
}

// ---- fit-to-container -----------------------------------------------------

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ---- editor ---------------------------------------------------------------

function Editor({
  presentation,
  slides,
  slide,
}: {
  presentation: Presentation;
  slides: Slide[];
  slide: Slide;
}) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SlideDoc>(() => normalizeDoc(slide.scene));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveState = useAutosave(presentation.id, slide.id, doc);

  const [centerRef, centerSize] = useElementSize<HTMLDivElement>();
  const scale = useMemo(() => {
    if (!centerSize.width || !centerSize.height) return 0;
    return Math.max(
      0.05,
      Math.min(
        (centerSize.width - 64) / SLIDE_WIDTH,
        (centerSize.height - 64) / SLIDE_HEIGHT,
      ),
    );
  }, [centerSize]);

  const selected = doc.elements.find((el) => el.id === selectedId) ?? null;

  function mutate(next: SlideDoc) {
    setDoc(next);
  }
  function addAndSelect(element: SlideElement) {
    mutate(addElement(doc, element));
    setSelectedId(element.id);
  }
  function patchElement(id: string, patch: Partial<SlideElement>) {
    mutate(updateElement(doc, id, patch));
  }

  async function addSlide() {
    const res = await fetch(
      `/api/presentations/${presentation.id}/slides`,
      { method: "POST", credentials: "same-origin" },
    );
    const { slide: created } = (await res.json()) as { slide: Slide };
    navigate(`/editor/${presentation.id}/${created.id}`);
  }

  async function duplicateSlide(slideId = slide.id) {
    const res = await fetch(
      `/api/presentations/${presentation.id}/slides/${slideId}/duplicate`,
      { method: "POST", credentials: "same-origin" },
    );
    if (!res.ok) return;
    const { slide: created } = (await res.json()) as { slide: Slide };
    navigate(`/editor/${presentation.id}/${created.id}`);
  }

  async function addImageFromSrc(src: string) {
    const dims = await imageSize(src).catch(() => null);
    addAndSelect(fittedImage(src, dims));
  }

  const [uploadsVersion, setUploadsVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const id = toast.loading("Uploading image…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/presentations/${presentation.id}/uploads`,
        { method: "POST", body: fd, credentials: "same-origin" },
      );
      if (!res.ok) {
        toast.error("Upload failed", { id });
        return;
      }
      const { key } = (await res.json()) as { key: string };
      await addImageFromSrc(`/api/uploads/${key}`);
      setUploadsVersion((v) => v + 1); // refresh the Uploads panel
      toast.success("Image added", { id });
    } catch {
      toast.error("Upload failed", { id });
    }
  }

  // Keyboard shortcuts for element copy/paste/cut. Only intercept when the
  // focus is not inside a text input, textarea, or contentEditable element so
  // normal typing shortcuts aren't broken.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "c" || e.key === "C") {
        if (isInput) return;
        if (selected) {
          e.preventDefault();
          writeElement(selected);
        }
      } else if (e.key === "x" || e.key === "X") {
        if (isInput) return;
        if (selectedId && selected) {
          e.preventDefault();
          writeElement(selected);
          mutate(removeElement(doc, selectedId));
          setSelectedId(null);
        }
      } else if (e.key === "v" || e.key === "V") {
        if (isInput) return;
        if (hasElement()) {
          e.preventDefault();
          const el = readElement();
          if (el) addAndSelect(el);
        }
      } else if (e.key === "d" || e.key === "D") {
        if (isInput) return;
        e.preventDefault();
        duplicateSlide();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectedId, doc]);

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleImageFile}
      />
      <Toolbar
        presentation={presentation}
        saveState={saveState}
        hasSelection={!!selected}
        uploadsVersion={uploadsVersion}
        onAddText={addAndSelect}
        onAddRect={() => addAndSelect(newRect())}
        onUploadImage={() => fileInputRef.current?.click()}
        onPickImage={addImageFromSrc}
        onDelete={() => {
          if (selectedId) {
            mutate(removeElement(doc, selectedId));
            setSelectedId(null);
          }
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <Filmstrip
          slides={slides}
          currentId={slide.id}
          presentationId={presentation.id}
          onAdd={addSlide}
          onDuplicate={duplicateSlide}
        />

        <main
          ref={centerRef}
          className="bg-muted relative flex flex-1 items-center justify-center overflow-hidden"
        >
          <div
            className="bg-white shadow-[0_8px_40px_-12px_rgb(0_0_0/0.35)]"
            style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}
          >
            {scale > 0 && (
              <ClientOnly>
                {() => (
                  <Suspense fallback={null}>
                    <SlideStage
                      doc={doc}
                      selectedId={selectedId}
                      scale={scale}
                      onSelect={setSelectedId}
                      onChange={patchElement}
                    />
                  </Suspense>
                )}
              </ClientOnly>
            )}
          </div>
        </main>

        <Inspector
          doc={doc}
          selected={selected}
          onPatch={patchElement}
          onBackground={(color) => mutate({ ...doc, background: color })}
          onReorder={(dir) =>
            selectedId && mutate(reorderElement(doc, selectedId, dir))
          }
          onDelete={() => {
            if (selectedId) {
              mutate(removeElement(doc, selectedId));
              setSelectedId(null);
            }
          }}
        />
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}

// ---- toolbar --------------------------------------------------------------

function Toolbar({
  presentation,
  saveState,
  hasSelection,
  uploadsVersion,
  onAddText,
  onAddRect,
  onUploadImage,
  onPickImage,
  onDelete,
}: {
  presentation: Presentation;
  saveState: SaveState;
  hasSelection: boolean;
  uploadsVersion: number;
  onAddText: (el: TextElement) => void;
  onAddRect: () => void;
  onUploadImage: () => void;
  onPickImage: (src: string) => void;
  onDelete: () => void;
}) {
  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "";
  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-3 border-b px-3">
      <Link
        to="/app"
        aria-label="Back to presentations"
        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-full"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <span className="max-w-48 truncate text-sm font-medium">
        {presentation.title}
      </span>

      <div className="bg-border h-6 w-px" />

      <div className="flex items-center gap-1">
        <TextPresetMenu onAdd={onAddText} />
        <ToolButton label="Shape" onClick={onAddRect}>
          <Square />
        </ToolButton>
        <ImageUploadMenu
          presentationId={presentation.id}
          reloadKey={uploadsVersion}
          onUpload={onUploadImage}
          onPick={onPickImage}
        />
      </div>

      {hasSelection && (
        <>
          <div className="bg-border h-6 w-px" />
          <ToolButton label="Delete" onClick={onDelete}>
            <Trash2 />
          </ToolButton>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-muted-foreground w-16 text-right text-xs">
          {saveLabel}
        </span>
        <Button asChild size="sm">
          <Link to={`/present/${presentation.id}`}>
            <Play /> Present
          </Link>
        </Button>
      </div>
    </header>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors [&_svg]:size-4"
    >
      {children}
      {label}
    </button>
  );
}

// ---- filmstrip ------------------------------------------------------------

function Filmstrip({
  slides,
  currentId,
  presentationId,
  onAdd,
  onDuplicate,
}: {
  slides: Slide[];
  currentId: string;
  presentationId: string;
  onAdd: () => void;
  onDuplicate: (slideId: string) => void;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; slideId: string } | null>(null);

  // Dismiss the context menu on any click outside.
  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    window.addEventListener("click", dismiss);
    return () => window.removeEventListener("click", dismiss);
  }, [ctxMenu]);

  return (
    <aside className="bg-card w-44 shrink-0 space-y-2 overflow-y-auto border-r p-2">
      {slides.map((s, i) => (
        <div
          key={s.id}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, slideId: s.id });
          }}
        >
          <Link
            to={`/editor/${presentationId}/${s.id}`}
            className="flex items-start gap-2"
          >
            <span className="text-muted-foreground w-4 pt-1 text-center text-xs font-semibold">
              {i + 1}
            </span>
            <SlidePreview
              scene={s.scene}
              className={cn(
                "flex-1 rounded-md border-2 bg-white transition-colors",
                s.id === currentId
                  ? "border-primary"
                  : "border-transparent hover:border-border",
              )}
            />
          </Link>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-muted-foreground hover:border-primary hover:text-primary ml-6 flex aspect-video w-[calc(100%-1.5rem)] items-center justify-center rounded-md border-2 border-dashed transition-colors"
      >
        <Plus className="size-5" />
      </button>

      {ctxMenu && (
        <div
          className="bg-popover text-popover-foreground fixed z-50 min-w-[140px] rounded-lg border p-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              onDuplicate(ctxMenu.slideId);
              setCtxMenu(null);
            }}
            className="hover:bg-accent flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
          >
            <Copy className="mr-2 size-4" />
            Duplicate Slide
          </button>
        </div>
      )}
    </aside>
  );
}

// ---- inspector ------------------------------------------------------------

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary mt-1 w-full"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border-input bg-background focus-visible:ring-ring mt-0.5 w-full rounded-md border px-2 py-1 text-sm outline-none focus-visible:ring-2"
      />
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="form-label-mono text-muted-foreground mb-2">{children}</p>;
}

function Inspector({
  doc,
  selected,
  onPatch,
  onBackground,
  onReorder,
  onDelete,
}: {
  doc: SlideDoc;
  selected: SlideElement | null;
  onPatch: (id: string, patch: Partial<SlideElement>) => void;
  onBackground: (color: string) => void;
  onReorder: (dir: "forward" | "back") => void;
  onDelete: () => void;
}) {
  return (
    <aside className="bg-card w-72 shrink-0 space-y-6 overflow-y-auto border-l p-4">
      {!selected ? (
        <div>
          <SectionLabel>Slide</SectionLabel>
          <ColorPicker
            label="Background"
            value={doc.background}
            onChange={onBackground}
          />
          <p className="text-muted-foreground mt-4 text-xs">
            Select an element to edit it, or add one from the toolbar.
          </p>
        </div>
      ) : (
        <>
          <div>
            <SectionLabel>{typeLabel(selected)}</SectionLabel>
            {selected.type === "text" && (
              <TextControls el={selected} onPatch={onPatch} />
            )}
            {selected.type === "rect" && (
              <RectControls el={selected} onPatch={onPatch} />
            )}
            {selected.type === "image" && (
              <ImageControls el={selected} onPatch={onPatch} />
            )}
          </div>

          <div>
            <SectionLabel>Position &amp; size</SectionLabel>
            <div className="space-y-2">
              <Row>
                <NumberField
                  label="X"
                  value={selected.x}
                  onChange={(v) => onPatch(selected.id, { x: v })}
                />
                <NumberField
                  label="Y"
                  value={selected.y}
                  onChange={(v) => onPatch(selected.id, { y: v })}
                />
              </Row>
              <Row>
                <NumberField
                  label="W"
                  value={selected.width}
                  onChange={(v) => onPatch(selected.id, { width: v })}
                />
                <NumberField
                  label="H"
                  value={selected.height}
                  onChange={(v) => onPatch(selected.id, { height: v })}
                />
              </Row>
              <NumberField
                label="Rotation"
                value={selected.rotation}
                onChange={(v) => onPatch(selected.id, { rotation: v })}
              />
            </div>
          </div>

          <div>
            <SectionLabel>Arrange</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReorder("forward")}
              >
                Forward
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReorder("back")}
              >
                Back
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function typeLabel(el: SlideElement): string {
  return el.type === "text" ? "Text" : el.type === "rect" ? "Shape" : "Image";
}

function TextControls({
  el,
  onPatch,
}: {
  el: Extract<SlideElement, { type: "text" }>;
  onPatch: (id: string, patch: Partial<SlideElement>) => void;
}) {
  const bold = el.fontStyle.includes("bold");
  const italic = el.fontStyle.includes("italic");
  const setStyle = (b: boolean, i: boolean) => {
    const parts = [i ? "italic" : "", b ? "bold" : ""].filter(Boolean);
    onPatch(el.id, { fontStyle: parts.join(" ") || "normal" });
  };

  const fx: TextEffect = el.effect ?? {
    type: "none",
    color: "#000000",
    intensity: 50,
  };
  const selectEffect = (type: TextEffectType) => {
    const color = el.effect?.color ?? (type === "glow" ? "#8b3dff" : "#000000");
    onPatch(el.id, {
      effect: { type, color, intensity: el.effect?.intensity ?? 50 },
    });
  };
  const setEffect = (patch: Partial<TextEffect>) =>
    onPatch(el.id, { effect: { ...fx, ...patch } });

  return (
    <div className="space-y-2">
      <textarea
        value={el.text}
        onChange={(e) => onPatch(el.id, { text: e.target.value })}
        rows={3}
        className="border-input bg-background focus-visible:ring-ring w-full resize-none rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-2"
      />
      <div>
        <span className="text-muted-foreground text-[11px]">Font</span>
        <div className="mt-0.5">
          <FontPicker
            value={el.fontFamily}
            onChange={(fontFamily) => onPatch(el.id, { fontFamily })}
          />
        </div>
      </div>
      <NumberField
        label="Size"
        value={el.fontSize}
        onChange={(v) => onPatch(el.id, { fontSize: v })}
      />
      <ColorPicker
        label="Color"
        value={el.fill}
        onChange={(v) => onPatch(el.id, { fill: v })}
      />
      <div className="flex gap-1">
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onPatch(el.id, { align: a })}
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-xs capitalize",
              el.align === a
                ? "border-primary text-primary bg-accent"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setStyle(!bold, italic)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs font-bold",
            bold
              ? "border-primary text-primary bg-accent"
              : "border-input text-muted-foreground",
          )}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => setStyle(bold, !italic)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs italic",
            italic
              ? "border-primary text-primary bg-accent"
              : "border-input text-muted-foreground",
          )}
        >
          Italic
        </button>
      </div>

      <div className="pt-1">
        <span className="text-muted-foreground text-[11px]">Effects</span>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {(
            [
              { type: "none", label: "None" },
              { type: "shadow", label: "Shadow" },
              { type: "glow", label: "Glow" },
              { type: "blur", label: "Blur" },
            ] as const
          ).map((e) => (
            <button
              key={e.type}
              type="button"
              onClick={() => selectEffect(e.type)}
              className={cn(
                "rounded-md border px-1 py-1 text-xs",
                fx.type === e.type
                  ? "border-primary text-primary bg-accent"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
        {(fx.type === "shadow" || fx.type === "glow") && (
          <div className="mt-2">
            <ColorPicker
              label="Effect color"
              value={fx.color}
              onChange={(color) => setEffect({ color })}
            />
          </div>
        )}
        {fx.type !== "none" && (
          <RangeField
            label="Intensity"
            value={fx.intensity}
            onChange={(intensity) => setEffect({ intensity })}
          />
        )}
      </div>
    </div>
  );
}

function RectControls({
  el,
  onPatch,
}: {
  el: Extract<SlideElement, { type: "rect" }>;
  onPatch: (id: string, patch: Partial<SlideElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <ColorPicker
        label="Fill"
        value={el.fill}
        onChange={(v) => onPatch(el.id, { fill: v })}
      />
      <NumberField
        label="Corner radius"
        value={el.cornerRadius}
        onChange={(v) => onPatch(el.id, { cornerRadius: v })}
      />
    </div>
  );
}

function ImageControls({
  el,
  onPatch,
}: {
  el: Extract<SlideElement, { type: "image" }>;
  onPatch: (id: string, patch: Partial<SlideElement>) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-[11px]">Image URL</span>
      <input
        type="text"
        value={el.src}
        onChange={(e) => onPatch(el.id, { src: e.target.value })}
        className="border-input bg-background focus-visible:ring-ring mt-0.5 w-full rounded-md border px-2 py-1 text-sm outline-none focus-visible:ring-2"
      />
    </label>
  );
}
