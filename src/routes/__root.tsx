import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/lib/app-store";
import { TopNav } from "@/components/TopNav";
import { BottomDock } from "@/components/BottomDock";
import { PWAInstall } from "@/components/PWAInstall";
import { registerPWA } from "@/lib/pwa-register";
import { hydrateSiteConfigFromServer } from "@/lib/site-config";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Signal lost</h2>
        <p className="mt-2 text-sm text-neutral-400">
          The page you're looking for drifted out of orbit.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-black"
            style={{ background: "var(--accent)" }}
          >
            Back to Discover
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Something went wrong. Try again or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-black"
            style={{ background: "var(--accent)" }}
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "WuHubHD — Premium OLED Streaming for Movies & TV" },
      {
        name: "description",
        content:
          "WuHubHD is a minimalist OLED-black streaming experience with instant playback for Movies, TV Shows, Animes, and Live Discovery.",
      },
      { name: "theme-color", content: "#000000" },
      { property: "og:title", content: "WuHubHD — Premium OLED Streaming for Movies & TV" },
      {
        property: "og:description",
        content: "WuHubHD is a minimalist OLED-black streaming experience with instant playback for Movies, TV Shows, Animes, and Live Discovery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WuHubHD — Premium OLED Streaming for Movies & TV" },
      { name: "twitter:description", content: "WuHubHD is a minimalist OLED-black streaming experience with instant playback for Movies, TV Shows, Animes, and Live Discovery." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b99555af-9638-48ce-b51d-ba0f2a4fb568" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b99555af-9638-48ce-b51d-ba0f2a4fb568" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://image.tmdb.org" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-black text-neutral-100 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerPWA();
    void hydrateSiteConfigFromServer();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <div className="flex min-h-screen flex-col bg-black pb-28">
          <TopNav />
          <PWAInstall />
          <main className="flex-1">
            <Outlet />
          </main>
          <BottomDock />
        </div>
      </AppProvider>
    </QueryClientProvider>
  );
}
