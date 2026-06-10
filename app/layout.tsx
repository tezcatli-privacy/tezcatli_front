import "./globals.css";
import type { Metadata } from "next";
import { PostHogProvider } from "@/components/posthog-provider";
import { securityAuditMetadata } from "@/lib/security-audit-meta";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://tezcatli.vercel.app"),
  title: "z0tz Early Access",
  description:
    "A private stablecoin account for people who already use digital dollars and want less wallet friction, sponsored execution, and reduced public exposure.",
  keywords: [
    "z0tz",
    "stablecoin account",
    "stablecoin wallet",
    "LATAM stablecoins",
    "gasless wallet",
    "passkey wallet",
    "private stablecoins",
  ],
  openGraph: {
    title: "z0tz Early Access",
    description:
      "A private stablecoin account for people who already use digital dollars. Guided testnet demos now open.",
    url: "https://tezcatli.vercel.app",
    siteName: "z0tz",
    type: "website",
  },
  alternates: {
    canonical: "/",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const auditMeta = securityAuditMetadata();
  return auditMeta ? { ...baseMetadata, ...auditMeta } : baseMetadata;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
