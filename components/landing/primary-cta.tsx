import Link from "next/link";

type PrimaryCTAProps = {
  href: string;
  children: string;
  variant?: "mint" | "gold";
  className?: string;
};

export function PrimaryCTA({
  href,
  children,
  variant = "mint",
  className = "",
}: PrimaryCTAProps) {
  return (
    <Link
      className={`pds-primary-cta pds-primary-cta--${variant}${className ? ` ${className}` : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
