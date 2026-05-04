import Link from "next/link";

const painPoints = [
  { icon: "⚡", label: "Gas complexity", detail: "Gas fees" },
  { icon: "◉", label: "Public exposure", detail: "Public balances" },
  { icon: "!" , label: "Wallet mistakes", detail: "Wrong networks" },
];

const benefitCards = [
  {
    icon: "◈",
    eyebrow: "Protected by design",
    title: "Your balance is not publicly exposed by default.",
    copy: "Your balance and activity are designed to stay private by default, so using USDC does not expose your full financial life.",
  },
  {
    icon: "↯",
    eyebrow: "No gas. No friction.",
    title: "Send and receive stablecoins without worrying about fees.",
    copy: "z0tz handles transaction execution behind the scenes, so you can send and receive USDC without thinking about gas.",
  },
  {
    icon: "◎",
    eyebrow: "Full control, without the risk",
    title: "No seed phrases. No confusing wallet setup.",
    copy: "Sign in securely with passkeys instead of managing seed phrases or private keys.",
  },
];

const useCases = [
  { title: "Get paid", meta: "Receive stablecoins as usable income." },
  { title: "Send money", meta: "Move value without gas or wallet friction." },
  { title: "Store USD", meta: "Keep digital dollars with less public exposure." },
];

const steps = [
  {
    number: "1",
    title: "Create your wallet in seconds",
    copy: "No seed phrases. Just secure access.",
    label: "Passkey setup",
    preview: "✓ Passkey secured",
  },
  {
    number: "2",
    title: "Move your USDC",
    copy: "Transfer from your existing wallet or exchange.",
    label: "Deposit screen",
    preview: "20 USDC received",
  },
  {
    number: "3",
    title: "Use it freely",
    copy: "Send, receive, and manage your money without friction.",
    label: "Send confirmation",
    preview: "Gas sponsored",
  },
];

const architectureNodes = [
  {
    icon: "◎",
    title: "Passkey Wallet",
    copy: "Simple access for the user.",
  },
  {
    icon: "⇄",
    title: "Relayer",
    copy: "Coordinates execution without exposing wallet complexity.",
  },
  {
    icon: "◈",
    title: "Private Flow",
    copy: "Keeps transaction handling controlled and less exposed.",
  },
  {
    icon: "☰",
    title: "Safety Controls",
    copy: "Operational controls for safer real-world flows.",
  },
];

const safetyChecks = [
  "Passkey-based access",
  "Gasless execution",
  "Reduced public exposure",
  "Compliance-aware controls",
  "Treasury-ready infrastructure",
];

const switchReasons = [
  "I don’t want to deal with gas anymore.",
  "I don’t want everything to be public.",
  "I just want something that works.",
];

const recentActivity = [
  { type: "Received", amount: "+250 USDC", meta: "Salary payout" },
  { type: "Sent", amount: "-50 USDC", meta: "Family transfer" },
  { type: "Status", amount: "Balance protected", meta: "Privacy layer active" },
];

const activityBadges = ["Gas sponsored", "Private activity", "Passkey secured"];

const heroActivity = [
  { label: "Received", value: "+50 USDC" },
  { label: "Sent", value: "Private transfer" },
  { label: "Fees", value: "Gas sponsored" },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow eyebrow-light landing-wordmark">z0tz</p>
          <h1>The simpler and safer way to use digital dollars in LatAm</h1>
          <p className="landing-hero-lede">
            Use USDC without dealing with gas, seed phrases, or public exposure.
          </p>
          <div className="hero-actions hero-actions-left">
            <Link className="primary-button prominent-button landing-hero-cta" href="/scan">
              Get early access
            </Link>
            <a className="ghost-button landing-hero-secondary" href="#how-it-works">
              See how it works
            </a>
          </div>
        </div>

        <div className="wallet-stage">
          <div className="wallet-rails" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <article className="wallet-mockup">
            <div className="wallet-topline">
              <p className="eyebrow">z0tz wallet</p>
              <span className="wallet-status">Protected</span>
            </div>
            <div className="wallet-balance">
              <span>Balance</span>
              <strong>125.00 USDC</strong>
            </div>
            <div className="wallet-actions">
              <span>Send</span>
              <span>Receive</span>
              <span>Add funds</span>
            </div>
            <div className="wallet-mini-feed">
              {heroActivity.map(item => (
                <div key={item.label} className="wallet-mini-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="wallet-flowline">
              <span>Passkey</span>
              <span>→</span>
              <span>Relayer</span>
              <span>→</span>
              <span>Private flow</span>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section problem-section">
        <div className="section-copy">
          <p className="eyebrow">Problem</p>
          <h2>Finally, a way to use USDC without stress</h2>
          <p className="lede">
            Stablecoins are powerful, but today they still feel like crypto
            infrastructure.
          </p>
          <div className="problem-chip-row">
            <span>gas fees</span>
            <span>public balances</span>
            <span>seed phrases</span>
            <span>wrong networks</span>
          </div>
          <p className="problem-bridge">
            You should not need to understand crypto infrastructure to use
            digital dollars.
          </p>
          <p className="compact-meta">
            z0tz turns that into a simple wallet experience.
          </p>
        </div>

        <div className="problem-visual">
          <div className="pain-grid">
            {painPoints.map(point => (
              <article key={point.label} className="pain-card">
                <span className="icon-chip">{point.icon}</span>
                <h3>{point.label}</h3>
                <p>{point.detail}</p>
              </article>
            ))}
          </div>

          <div className="comparison-stack">
            <article className="legacy-wallet">
              <div className="legacy-wallet-header">
                <p className="eyebrow">Traditional wallet</p>
                <span className="wallet-status wallet-status-muted">Friction</span>
              </div>
              <div className="legacy-signals">
                <span>Gas required</span>
                <span>Seed phrase</span>
                <span>Public address</span>
                <span>Wrong network</span>
              </div>
            </article>

            <article className="legacy-wallet z0tz-compare">
              <div className="legacy-wallet-header">
                <p className="eyebrow">z0tz</p>
                <span className="wallet-status">Simplified</span>
              </div>
              <div className="legacy-signals">
                <span>No gas</span>
                <span>Passkey</span>
                <span>Protected balance</span>
                <span>Simple USDC</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="section-copy">
          <p className="eyebrow">Product benefits</p>
          <h2>A better way to hold and move your money</h2>
        </div>
        <div className="landing-benefits">
          {benefitCards.map(card => (
            <article key={card.title} className="benefit-card">
              <span className="icon-chip icon-chip-large">{card.icon}</span>
              <p className="eyebrow">{card.eyebrow}</p>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-dark">
        <div className="section-copy section-copy-dark">
          <p className="eyebrow eyebrow-light">Built for real usage</p>
          <h2>Designed for people who already use stablecoins in daily life.</h2>
          <p className="lede lede-light">
            z0tz is built for people who use USDC to get paid, send money, and
            store value in digital dollars.
          </p>
        </div>

        <div className="usage-layout">
          <div className="usage-cards">
            {useCases.map((item, index) => (
              <article
                key={item.title}
                className={`usage-card${index === 0 ? " usage-card-active" : ""}`}
              >
                <h3>{item.title}</h3>
                <p>{item.meta}</p>
              </article>
            ))}
          </div>

          <article className="activity-mockup">
            <div className="wallet-topline">
              <p className="eyebrow eyebrow-light">Digital dollar balance</p>
              <span className="wallet-status">Protected</span>
            </div>
            <strong className="activity-balance">1,320.00 USDC</strong>
            <div className="activity-badges">
              {activityBadges.map(item => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="activity-feed">
              {recentActivity.map(item => (
                <div key={`${item.type}-${item.amount}`} className="activity-row">
                  <div>
                    <span>{item.type}</span>
                    <p>{item.meta}</p>
                  </div>
                  <strong>{item.amount}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-copy">
          <p className="eyebrow">How it works</p>
          <h2>Three steps. Less anxiety.</h2>
        </div>
        <div className="how-grid">
          {steps.map(step => (
            <article key={step.number} className="how-card">
              <div className="how-step-header">
                <span className="step-index">{step.number}</span>
                <p className="eyebrow">{step.label}</p>
              </div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <div className="mini-ui">
                    <span>{step.preview}</span>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <section className="landing-section trial-section">
        <div className="trial-copy">
          <p className="eyebrow">Trial offer</p>
          <h2>Try your first private, gasless transaction — on us</h2>
          <p className="lede">
            Deposit 20 USDC and get a 5 USDC trial balance. Available for the
            first 300 users.
          </p>
          <div className="hero-actions hero-actions-left">
            <Link className="primary-button prominent-button" href="/scan">
              Start now
            </Link>
          </div>
          <p className="trial-helper">Limited early access</p>
          <p className="compact-meta">
            First 300 eligible users only. Minimum initial deposit: 20 USDC.
            Anti-abuse checks apply.
          </p>
        </div>

        <div className="trial-metrics">
          <div className="trial-value">
            <span className="eyebrow">Trial balance</span>
            <strong>$5 USDC</strong>
          </div>
          <span className="wallet-status trial-badge">First 300 users</span>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-copy">
          <p className="eyebrow">Architecture / Control layer</p>
          <h2>Simple on the outside. Controlled underneath.</h2>
          <p className="lede">
            z0tz hides wallet complexity from users while coordinating the
            infrastructure needed for safer stablecoin flows.
          </p>
        </div>
        <div className="architecture-rail">
          {architectureNodes.map((node, index) => (
            <div key={node.title} className="architecture-node">
              <span className="icon-chip icon-chip-large">{node.icon}</span>
              <h3>{node.title}</h3>
              <p>{node.copy}</p>
              {index < architectureNodes.length - 1 ? (
                <span className="architecture-link" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-copy">
          <p className="eyebrow">Designed for safer usage</p>
          <h2>Safer stablecoin usage starts with fewer mistakes.</h2>
          <p className="lede">
            z0tz reduces wallet complexity, public exposure, and transaction
            friction while building toward real-world stablecoin usage.
          </p>
        </div>
        <div className="safety-checklist">
          {safetyChecks.map(item => (
            <div key={item} className="check-row">
              <span className="check-mark">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-dark">
        <div className="section-copy section-copy-dark">
          <p className="eyebrow eyebrow-light">Why people switch</p>
          <h2>Reasons that sound human, not technical.</h2>
        </div>
        <div className="quote-grid">
          {switchReasons.map(reason => (
            <article key={reason} className="quote-card">
              <p>{reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-final">
        <div className="landing-final-copy">
          <p className="eyebrow eyebrow-light">This is where your stablecoins live</p>
          <h2>Not just a wallet. A better way to hold and use digital dollars.</h2>
          <p className="lede lede-light">
            Get early access and qualify for the $5 USDC trial balance.
          </p>
          <div className="hero-actions hero-actions-left">
            <Link className="primary-button prominent-button landing-hero-cta" href="/scan">
              Get early access
            </Link>
          </div>
        </div>

        <article className="wallet-mockup wallet-mockup-final">
          <div className="wallet-topline">
            <p className="eyebrow eyebrow-light">z0tz wallet</p>
            <span className="wallet-status">Protected</span>
          </div>
          <div className="wallet-balance">
            <span>Balance</span>
            <strong>125.00 USDC</strong>
          </div>
          <div className="wallet-actions">
            <span>Send</span>
            <span>Receive</span>
            <span>Add funds</span>
          </div>
        </article>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>z0tz</strong>
          <p>Digital dollars with less friction and less exposure.</p>
        </div>
        <div className="landing-footer-links">
          <a href="#">Twitter</a>
          <a href="#">Docs</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
        </div>
      </footer>
    </main>
  );
}
