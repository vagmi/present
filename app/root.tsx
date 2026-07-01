import { ClerkProvider } from "@clerk/react-router";
import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const middleware = [clerkMiddleware()];

export const loader = (args: Parameters<typeof rootAuthLoader>[0]) =>
  rootAuthLoader(args);

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Clerk components themed to the "Studio" design language.
 * Restyle (or remove) freely — see app/app.css for the design tokens. */
const clerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.5555 0.2472 299)",
    colorBackground: "oklch(1 0 0)",
    colorText: "oklch(0.2178 0.0166 264)",
    colorTextSecondary: "oklch(0.5486 0.0214 264)",
    colorInputBackground: "oklch(1 0 0)",
    colorInputText: "oklch(0.2178 0.0166 264)",
    colorDanger: "oklch(0.6221 0.2115 22)",
    fontFamily: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "0.75rem",
  },
};

export default function App() {
  const loaderData = useLoaderData<typeof loader>();
  return (
    <ClerkProvider loaderData={loaderData} appearance={clerkAppearance}>
      <Outlet />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let stamp = "Error";
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    const isNotFound = error.status === 404;
    stamp = isNotFound ? "Not found" : `Error ${error.status}`;
    message = isNotFound ? "404" : "Error";
    details = isNotFound
      ? "The requested page could not be found."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-4 text-center">
      <span className="stamp">{stamp}</span>
      <h1 className="text-6xl">{message}</h1>
      <p className="text-muted-foreground">{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto rounded-md border bg-card p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
