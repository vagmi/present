import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ApiError, apiFetch } from "~/lib/api-client.server";
import { cn } from "~/lib/utils";
import type { Organization } from "../../../workers/api/repositories/organizations-repo";
import type { Presentation } from "../../../workers/api/repositories/presentations-repo";
import type { User } from "../../../workers/api/repositories/users-repo";
import type { Route } from "./+types/presentations-list";

export function meta() {
  return [{ title: "Presentations — Present" }];
}

// The dashboard talks to the Hono API in-process (apiFetch) — same code path
// as a real network client, so loaders/actions stay thin. This whole file is
// the copy-me example for a CRUD resource: list (loader) + create/delete
// (action), rendered with a dialog and per-row forms.
export async function loader({ request }: Route.LoaderArgs) {
  const [me, presentationsRes] = await Promise.all([
    apiFetch<{ org: Organization; user: User; orgRole: string | null }>(
      request,
      "/api/me",
    ),
    apiFetch<{ presentations: Presentation[] }>(request, "/api/presentations"),
  ]);
  return {
    org: me.org,
    user: me.user,
    orgRole: me.orgRole,
    presentations: presentationsRes.presentations,
  };
}

function displayName(user: User): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email
  );
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "delete") {
    await apiFetch(request, `/api/presentations/${form.get("id")}`, {
      method: "DELETE",
    });
    return { ok: true };
  }

  // create
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Give your presentation a title." };

  try {
    await apiFetch(request, "/api/presentations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return { ok: true, created: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 402) {
      return {
        ok: false,
        error:
          "You've hit your plan's presentation limit — upgrade to add more.",
      };
    }
    throw e;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function PresentationCard({
  presentation,
  index,
}: {
  presentation: Presentation;
  index: number;
}) {
  const fetcher = useFetcher();
  const deleting = fetcher.state !== "idle";
  return (
    <div
      className={cn(
        "bg-card rounded-lg border p-5 transition-opacity",
        deleting && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="form-label-mono text-muted-foreground">
          Deck № {String(index + 1).padStart(3, "0")}
        </p>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={presentation.id} />
          <button
            type="submit"
            disabled={deleting}
            className="form-label-mono text-muted-foreground/60 hover:text-destructive text-[10px] transition-colors"
          >
            Delete
          </button>
        </fetcher.Form>
      </div>
      <h2 className="mt-2 truncate text-xl">{presentation.title}</h2>
      <div className="rule-perforated mt-4" />
      <p className="form-label-mono text-muted-foreground/70 mt-3 text-[10px]">
        {dateFormat.format(new Date(presentation.updatedAt * 1000))}
      </p>
    </div>
  );
}

function NewPresentationDialog() {
  const fetcher = useFetcher<typeof action>();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = fetcher.state !== "idle";

  // Close + reset on a successful create; surface a toast.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.created) {
      setOpen(false);
      formRef.current?.reset();
      toast.success("Presentation created");
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New presentation</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New presentation</DialogTitle>
          <DialogDescription>
            Presentations are scoped to your active organization.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" ref={formRef} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Q3 Kickoff"
              autoFocus
              required
              className="mt-1.5"
            />
          </div>
          {fetcher.data?.error && (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create presentation"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PresentationsList({
  loaderData,
}: Route.ComponentProps) {
  const { org, user, orgRole, presentations } = loaderData;
  const role = (orgRole ?? "org:member").replace(/^org:/, "");
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="form-label-mono text-muted-foreground">
            {org.name} · {org.plan} plan
          </p>
          <h1 className="mt-2 text-3xl">Presentations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Signed in as{" "}
            <span className="text-foreground">{displayName(user)}</span> ·{" "}
            <span className="font-mono text-xs">{role}</span> of {org.name}
          </p>
        </div>
        <NewPresentationDialog />
      </div>

      <div className="rule-perforated mt-6" />

      {presentations.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <span className="stamp">Nothing here yet</span>
          <h2 className="text-2xl">Your first deck is one click away.</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create a presentation, then add slides and design them on the
            canvas.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presentations.map((presentation, i) => (
            <PresentationCard
              key={presentation.id}
              presentation={presentation}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
