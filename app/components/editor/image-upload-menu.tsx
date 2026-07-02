import { Image as ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

/** Toolbar "Image" control: upload a new image or re-pick one already uploaded
 * within THIS presentation (the list is prefix-scoped to org + presentation). */
export function ImageUploadMenu({
  presentationId,
  reloadKey,
  onUpload,
  onPick,
}: {
  presentationId: string;
  reloadKey: number;
  onUpload: () => void;
  onPick: (src: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<{ key: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUploads(null);
    fetch(`/api/presentations/${presentationId}/uploads`, {
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : { uploads: [] }))
      .then((d) => {
        const list = (d as { uploads?: { key: string }[] }).uploads ?? [];
        if (!cancelled) setUploads(list);
      })
      .catch(() => {
        if (!cancelled) setUploads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, presentationId, reloadKey]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Image"
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors [&_svg]:size-4",
          open
            ? "bg-accent text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ImageIcon />
        Image
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover absolute left-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border shadow-lg">
            <button
              type="button"
              onClick={onUpload}
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium"
            >
              <Upload className="size-4" />
              Upload an image
            </button>
            <div className="bg-border h-px" />
            <div className="max-h-72 overflow-y-auto p-2">
              {uploads === null ? (
                <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                  Loading…
                </p>
              ) : uploads.length === 0 ? (
                <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                  No uploads yet in this presentation.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {uploads.map((u) => (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => {
                        onPick(`/api/uploads/${u.key}`);
                        setOpen(false);
                      }}
                      className="hover:ring-primary bg-muted aspect-square overflow-hidden rounded-md border hover:ring-2"
                    >
                      <img
                        src={`/api/uploads/${u.key}`}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
