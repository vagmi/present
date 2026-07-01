import { OrganizationSwitcher, UserButton } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/server";
import { Link, NavLink, Outlet, redirect } from "react-router";
import { Toaster } from "~/components/ui/sonner";
import type { Route } from "./+types/layout";

export async function loader(args: Route.LoaderArgs) {
  const auth = await getAuth(args);
  if (!auth.userId) {
    throw redirect("/sign-in");
  }
  // Child loaders 403 without an active org — bounce before they run.
  if (!auth.orgId) {
    throw redirect("/app/select-org");
  }
  return null;
}

function Wordmark() {
  return (
    <Link
      to="/app"
      className="font-heading text-lg font-semibold tracking-tight"
    >
      Present<span className="text-stamp">*</span>
    </Link>
  );
}

const NAV = [
  { to: "/app", label: "Presentations", end: true },
  { to: "/app/members", label: "Members", end: false },
] as const;

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <div className="bg-brand-gradient h-1" />
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
          <Wordmark />
          <nav className="flex items-center gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? "text-primary bg-accent rounded-full px-3 py-1.5"
                    : "text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 transition-colors"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/app"
              afterSelectOrganizationUrl="/app"
            />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
