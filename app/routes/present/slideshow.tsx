import { getAuth } from "@clerk/react-router/server";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { SlidePreview } from "~/components/editor/slide-preview";
import { apiFetch } from "~/lib/api-client.server";
import { cn } from "~/lib/utils";
import type { Presentation } from "../../../workers/api/repositories/presentations-repo";
import type { Slide } from "../../../workers/api/repositories/slides-repo";
import type { Route } from "./+types/slideshow";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.presentation.title ?? "Present"} — Present` }];
}

export async function loader(args: Route.LoaderArgs) {
  const auth = await getAuth(args);
  if (!auth.userId) throw redirect("/sign-in");
  if (!auth.orgId) throw redirect("/app/select-org");

  const { request, params } = args;
  const pid = params.presentationId;
  const [presRes, slidesRes] = await Promise.all([
    apiFetch<{ presentation: Presentation }>(
      request,
      `/api/presentations/${pid}`,
    ),
    apiFetch<{ slides: Slide[] }>(request, `/api/presentations/${pid}/slides`),
  ]);
  return { presentation: presRes.presentation, slides: slidesRes.slides };
}

export default function Slideshow({ loaderData }: Route.ComponentProps) {
  const { presentation, slides } = loaderData;
  const navigate = useNavigate();
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const next = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const exit = useCallback(() => {
    const sid = slides[index]?.id;
    navigate(sid ? `/editor/${presentation.id}/${sid}` : "/app");
  }, [slides, index, presentation.id, navigate]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        if (!document.fullscreenElement) exit();
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(total - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, exit, total]);

  // Auto-hide the controls after inactivity.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    function onMove() {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
    window.addEventListener("mousemove", onMove);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Track fullscreen state.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const current = slides[index];

  return (
    <div
      className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black"
      onClick={next}
    >
      {total === 0 || !current ? (
        <p className="text-white/70">This presentation has no slides.</p>
      ) : (
        <div className="aspect-video w-[min(100vw,177.78vh)] bg-white">
          <SlidePreview scene={current.scene} />
        </div>
      )}

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 flex items-center justify-center gap-1 p-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1.5 text-white backdrop-blur">
          <CtrlButton onClick={prev} disabled={index === 0} label="Previous">
            <ChevronLeft />
          </CtrlButton>
          <span className="min-w-16 text-center text-sm tabular-nums">
            {total === 0 ? 0 : index + 1} / {total}
          </span>
          <CtrlButton
            onClick={next}
            disabled={index >= total - 1}
            label="Next"
          >
            <ChevronRight />
          </CtrlButton>
          <div className="mx-1 h-5 w-px bg-white/20" />
          <CtrlButton onClick={toggleFullscreen} label="Fullscreen">
            {isFullscreen ? <Minimize /> : <Maximize />}
          </CtrlButton>
          <CtrlButton onClick={exit} label="Exit">
            <X />
          </CtrlButton>
        </div>
      </div>
    </div>
  );
}

function CtrlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
