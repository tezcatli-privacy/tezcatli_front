import { SpotlightCard } from "./spotlight-card";

export type ProductCardProps = {
  icon: string;
  eyebrow: string;
  title: string;
  copy: string;
};

export function ProductCard({
  icon,
  eyebrow,
  title,
  copy,
}: ProductCardProps) {
  return (
    <SpotlightCard className="pds-product-card">
      <span className="pds-icon-chip pds-icon-chip--lg">{icon}</span>
      <p className="pds-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p className="pds-product-card__copy">{copy}</p>
    </SpotlightCard>
  );
}
