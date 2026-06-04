import "./globals.css";
import type { Metadata } from "next";
import { securityAuditMetadata } from "@/lib/security-audit-meta";

const baseMetadata: Metadata = {
  title: "z0tz Early Access",
  description:
    "A simple testnet wallet for stablecoin users in LATAM who want less gas friction, fewer seed phrase risks, and less public exposure.",
  keywords: [
    "z0tz",
    "USDC wallet",
    "stablecoin wallet",
    "LATAM stablecoins",
    "gasless wallet",
    "passkey wallet",
    "private stablecoins",
  ],
  openGraph: {
    title: "z0tz Early Access",
    description:
      "A simpler dollar wallet for people who already use stablecoins. Testnet demos now open.",
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
