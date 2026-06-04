type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  lede?: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
};

export function SectionHeader({
  eyebrow,
  title,
  lede,
  tone = "dark",
  align = "left",
}: SectionHeaderProps) {
  return (
    <header
      className={`pds-section-header pds-section-header--${tone} pds-section-header--${align}`}
    >
      <p className={`pds-eyebrow${tone === "dark" ? " pds-eyebrow--light" : ""}`}>{eyebrow}</p>
      <h2>{title}</h2>
      {lede ? <p className="pds-section-header__lede">{lede}</p> : null}
    </header>
  );
}
