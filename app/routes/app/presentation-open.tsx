import { redirect } from "react-router";
import { apiFetch } from "~/lib/api-client.server";
import type { Slide } from "../../../workers/api/repositories/slides-repo";
import type { Route } from "./+types/presentation-open";

/** Resolver: opening a presentation jumps straight into the editor on its first
 * slide. If the deck has no slides yet, create one (get-or-create) so there's
 * always something to edit. Always redirects — this route renders nothing. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const pid = params.presentationId;
  const { slides } = await apiFetch<{ slides: Slide[] }>(
    request,
    `/api/presentations/${pid}/slides`,
  );
  let first = slides[0];
  if (!first) {
    const created = await apiFetch<{ slide: Slide }>(
      request,
      `/api/presentations/${pid}/slides`,
      { method: "POST" },
    );
    first = created.slide;
  }
  throw redirect(`/editor/${pid}/${first.id}`);
}

export default function PresentationOpen() {
  return null;
}
