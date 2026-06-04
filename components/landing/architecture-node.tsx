import { SpotlightCard } from "./spotlight-card";

export type ArchitectureNodeProps = {
  icon: string;
  title: string;
  copy: string;
  showConnector?: boolean;
};

export function ArchitectureNode({
  icon,
  title,
  copy,
  showConnector = false,
}: ArchitectureNodeProps) {
  return (
    <SpotlightCard className="pds-arch-node">
      <span className="pds-icon-chip">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {showConnector ? <span className="pds-arch-node__connector" aria-hidden="true" /> : null}
    </SpotlightCard>
  );
}
