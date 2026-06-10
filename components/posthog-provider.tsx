"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!posthogKey || posthog.__loaded) {
      return;
    }

    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
  }, []);

  useEffect(() => {
    if (!posthogKey || !posthog.__loaded) {
      return;
    }

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: pathname,
    });
  }, [pathname]);

  useEffect(() => {
    if (!posthogKey || !posthog.__loaded) {
      return;
    }

    const capturedDepths = new Set<number>();
    const thresholds = [25, 50, 75, 100];

    const captureScrollDepth = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent =
        scrollableHeight <= 0 ? 100 : Math.round((window.scrollY / scrollableHeight) * 100);

      thresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !capturedDepths.has(threshold)) {
          capturedDepths.add(threshold);
          posthog.capture("scroll_depth", {
            depth: threshold,
            path: pathname,
          });
        }
      });
    };

    captureScrollDepth();
    window.addEventListener("scroll", captureScrollDepth, { passive: true });

    return () => {
      window.removeEventListener("scroll", captureScrollDepth);
    };
  }, [pathname]);

  useEffect(() => {
    if (!posthogKey || !posthog.__loaded) {
      return;
    }

    const captureOutboundClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a");

      if (!link) {
        return;
      }

      const href = link.getAttribute("href") || "";
      const isOutbound = href.startsWith("http") || href.startsWith("mailto:");

      if (!isOutbound) {
        return;
      }

      posthog.capture("outbound_link_click", {
        href,
        text: link.textContent?.trim() || "",
        path: pathname,
      });
    };

    document.addEventListener("click", captureOutboundClick);

    return () => {
      document.removeEventListener("click", captureOutboundClick);
    };
  }, [pathname]);

  if (!posthogKey) {
    return <>{children}</>;
  }

  return <Provider client={posthog}>{children}</Provider>;
}
