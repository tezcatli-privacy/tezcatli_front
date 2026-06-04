type WalletActivity = { label: string; value: string };

type WalletMockupProps = {
  variant?: "hero" | "compact" | "final";
  balance?: string;
  activities?: WalletActivity[];
  showFlowline?: boolean;
};

const defaultActivities: WalletActivity[] = [
  { label: "Received", value: "+50 USDC" },
  { label: "Sent", value: "Private transfer" },
  { label: "Fees", value: "Gas sponsored" },
];

export function WalletMockup({
  variant = "hero",
  balance = "125.00 USDC",
  activities = defaultActivities,
  showFlowline = true,
}: WalletMockupProps) {
  return (
    <article className={`pds-wallet-mockup pds-wallet-mockup--${variant}`}>
      <div className="pds-wallet-mockup__glow" aria-hidden="true" />
      <div className="pds-wallet-mockup__top">
        <p className="pds-eyebrow pds-eyebrow--light">z0tz wallet</p>
        <span className="pds-status-pill">Protected</span>
      </div>
      <div className="pds-wallet-mockup__balance">
        <span>Balance</span>
        <strong>{balance}</strong>
      </div>
      {variant !== "compact" ? (
        <div className="pds-wallet-mockup__actions">
          <span>Send</span>
          <span>Receive</span>
          <span>Add funds</span>
        </div>
      ) : null}
      {variant === "hero" && activities.length > 0 ? (
        <div className="pds-wallet-mockup__feed">
          {activities.map(item => (
            <div key={item.label} className="pds-wallet-mockup__row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {showFlowline && variant === "hero" ? (
        <div className="pds-wallet-mockup__flow">
          <span>Passkey</span>
          <span aria-hidden="true">→</span>
          <span>Relayer</span>
          <span aria-hidden="true">→</span>
          <span>Private flow</span>
        </div>
      ) : null}
    </article>
  );
}
