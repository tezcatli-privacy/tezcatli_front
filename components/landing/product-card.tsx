import { SpotlightCard } from "./spotlight-card";
import { PrimaryCTA } from "./primary-cta";

export type ProductCardProps = {
  icon: string;
  eyebrow: string;
  title: string;
  copy: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function ProductCard({
  icon,
  eyebrow,
  title,
  copy,
  ctaHref = "#early-access",
  ctaLabel = "Book a 15 min demo",
}: ProductCardProps) {
  return (
    <SpotlightCard className="pds-product-card">
      <span className="pds-icon-chip pds-icon-chip--lg">{icon}</span>
      <p className="pds-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p className="pds-product-card__copy">{copy}</p>
      <PrimaryCTA href={ctaHref} className="pds-product-card__cta">
        {ctaLabel}
      </PrimaryCTA>
    </SpotlightCard>
  );
}
