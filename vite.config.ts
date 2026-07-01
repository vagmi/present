import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// GitHub Codespaces forwards the dev server through an HTTPS proxy host like
// `<codespace>-5173.app.github.dev`. Detect that environment so we only apply
// the proxy-specific tweaks there and leave plain local `dev` untouched.
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const isCodespaces = !!process.env.CODESPACES && !!forwardingDomain;

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // Bind on all interfaces so devcontainer/Codespaces port-forwarding works.
    host: true,
    // Vite blocks unknown hosts by default ("Blocked request. This host is not
    // allowed."). Allow the Codespaces forwarding domain when present.
    allowedHosts: isCodespaces ? [`.${forwardingDomain}`] : undefined,
    // HMR is served back through the same HTTPS (443) proxy, not localhost.
    ...(isCodespaces
      ? {
          hmr: {
            host: `${process.env.CODESPACE_NAME}-5173.${forwardingDomain}`,
            protocol: "wss",
            clientPort: 443,
          },
        }
      : {}),
  },
});
