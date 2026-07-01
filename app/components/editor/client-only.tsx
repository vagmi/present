import { type ReactNode, useEffect, useState } from "react";

/** Render `children()` only after hydration. Konva touches the DOM/canvas and
 * must never run during SSR, so anything that mounts a react-konva Stage goes
 * inside a ClientOnly. `children` is a function so its (lazy) imports are not
 * evaluated on the server. */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children() : fallback}</>;
}
