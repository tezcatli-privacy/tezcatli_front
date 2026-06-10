import posthog from "posthog-js";

const posthogKey =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const configuredPosthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogApiHost = configuredPosthogHost?.startsWith("/")
  ? configuredPosthogHost
  : "/pds-route";
const posthogUiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com";

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogApiHost,
    ui_host: posthogUiHost,
    capture_pageview: false,
    capture_pageleave: true,
    defaults: "2026-01-30",
  });

  if (process.env.NODE_ENV !== "production") {
    posthog.debug();
  }
}
