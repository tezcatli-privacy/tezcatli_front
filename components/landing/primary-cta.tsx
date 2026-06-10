"use client";

import Link from "next/link";
import posthog from "posthog-js";

type PrimaryCTAProps = {
  href: string;
  children: string;
  variant?: "mint" | "gold";
  className?: string;
  eventSection?: string;
};

export function PrimaryCTA({
  href,
  children,
  variant = "mint",
  className = "",
  eventSection = "unknown",
}: PrimaryCTAProps) {
  return (
    <Link
      className={`pds-primary-cta pds-primary-cta--${variant}${className ? ` ${className}` : ""}`}
      href={href}
      onClick={() => {
        posthog.capture("landing_cta_click", {
          cta_text: children,
          destination: href,
          section: eventSection,
        });
      }}
    >
      {children}
    </Link>
  );
}
