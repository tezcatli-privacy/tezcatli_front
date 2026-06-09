import "./globals.css";
import type { Metadata } from "next";
import { securityAuditMetadata } from "@/lib/security-audit-meta";

const baseMetadata: Metadata = {
  title: "z0tz Early Access",
  description:
    "A private stablecoin account for users in LATAM who want less wallet friction, sponsored execution, and reduced public exposure.",
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
    type: "website",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const auditMeta = securityAuditMetadata();
  return auditMeta ? { ...baseMetadata, ...auditMeta } : baseMetadata;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
