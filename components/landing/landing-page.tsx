import "@/app/landing.css";
import Link from "next/link";
import { EarlyAccessForm } from "@/components/early-access-form";
import { ArchitectureNode } from "./architecture-node";
import { BracketLink } from "./bracket-link";
import { DotField } from "./dot-field";
import { MetricBadge } from "./metric-badge";
import { PrimaryCTA } from "./primary-cta";
import { ProductCard } from "./product-card";
import { SectionHeader } from "./section-header";
import { SpotlightCard } from "./spotlight-card";
import { UsageSwitcher } from "./usage-switcher";
import { WalletMockup } from "./wallet-mockup";

const painPoints = [
  { icon: "⚡", label: "Gas complexity", detail: "Gas fees" },
  { icon: "◉", label: "Public exposure", detail: "Public balances" },
  { icon: "!", label: "Wallet mistakes", detail: "Wrong networks" },
];

const benefitCards = [
  {
    icon: "◈",
    eyebrow: "Protected by design",
    title: "Your balance is not publicly exposed by default.",
    copy: "Balance and activity stay private by default, so stablecoins do not expose your full financial life.",
  },
  {
    icon: "↯",
    eyebrow: "No gas. No friction.",
    title: "Send and receive stablecoins without worrying about fees.",
    copy: "z0tz handles execution behind the scenes — send and receive supported stablecoins without thinking about gas.",
  },
  {
    icon: "◎",
    eyebrow: "Full control, without the risk",
    title: "No seed phrases. No confusing wallet setup.",
    copy: "Sign in with passkeys instead of seed phrases or private keys.",
  },
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
    title: "Move your stablecoins",
    copy: "Transfer from your existing wallet or exchange.",
    label: "Deposit screen",
    preview: "20 USD received",
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
  { icon: "◎", title: "Passkey Wallet", copy: "Simple access for the user." },
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
  "I don't want to deal with gas anymore.",
  "I don't want everything to be public.",
  "I just want something that works.",
];

const b2bCapabilities = [
  {
    title: "Passkey wallet UX",
    copy: "Give users a familiar account experience without seed phrase onboarding.",
  },
  {
    title: "Relayed stablecoin execution",
    copy: "Sponsor or abstract gas so stablecoin actions feel like product flows, not crypto ops.",
  },
  {
    title: "Reduced public exposure",
    copy: "Design payment and balance flows that avoid unnecessary public wallet leakage.",
  },
  {
    title: "Compliance-aware controls",
    copy: "Add policy checks at integration boundaries without taking custody of user funds.",
  },
];

const trustBuildItems = [
  "Passkey wallet access",
  "Sponsored execution",
  "Reduced public exposure",
  "Compliance-aware checks",
];

const trustLimits = [
  "Zero on-chain footprint",
  "Full metadata anonymity",
  "Privacy magic",
  "Custody of user funds",
];

export function LandingPage() {
  return (
    <div className="pds-landing">
      <main className="pds-stack">
        <nav className="pds-nav" aria-label="Primary">
          <div className="pds-nav__brand">
            <strong>Private Dollar OS</strong>
            <span>z0tz · stablecoin account</span>
          </div>
          <div className="pds-nav__links">
            <BracketLink href="#products">Products</BracketLink>
            <BracketLink href="#how-it-works">How it works</BracketLink>
            <BracketLink href="#early-access">Guided demo</BracketLink>
            <BracketLink href="mailto:team@z0tz.com">Contact</BracketLink>
          </div>
        </nav>

        <DotField className="pds-hero-wrap">
          <section className="pds-hero">
            <div className="pds-hero__copy">
              <p className="pds-eyebrow pds-eyebrow--light">z0tz</p>
              <h1>Your private stablecoin account.</h1>
              <p className="pds-hero-lede">
                Hold and move digital dollars with less wallet friction: passkey
                access, sponsored execution, and reduced public exposure. z0tz starts
                with USDC and is designed to support more stablecoins over time.
              </p>
              <div className="pds-hero__cta-block">
                <div className="pds-hero__actions">
                  <PrimaryCTA href="#early-access">Book a 15 min demo</PrimaryCTA>
                  <Link className="pds-ghost-cta" href="#how-it-works">
                    See how it works
                  </Link>
                </div>
                <p className="pds-hero__note">
                  15 minute guided desktop demo · testnet only. No install required
                  before the call.
                </p>
              </div>
            </div>
            <div className="pds-hero__stage">
              <WalletMockup variant="hero" />
            </div>
          </section>
        </DotField>

        <section className="pds-section--light pds-problem-layout">
          <div>
            <SectionHeader
              tone="light"
              eyebrow="Problem"
              title="Stablecoins work. Wallet UX still gets in the way."
              lede="Stablecoins are powerful, but today they still feel like crypto infrastructure."
            />
            <div className="pds-chip-row" style={{ marginTop: 18 }}>
              <span>gas fees</span>
              <span>public balances</span>
              <span>seed phrases</span>
              <span>wrong networks</span>
            </div>
            <p className="pds-meta" style={{ marginTop: 16, color: "rgba(7,17,13,0.62)" }}>
              You should not need gas, networks, seed phrases, and public wallet graphs
              just to use digital dollars. z0tz turns that into a private stablecoin
              account experience.
            </p>
          </div>
          <div>
            <div className="pds-pain-grid">
              {painPoints.map(point => (
                <SpotlightCard key={point.label} className="pds-compare-card">
                  <span className="pds-icon-chip">{point.icon}</span>
                  <h3>{point.label}</h3>
                  <p>{point.detail}</p>
                </SpotlightCard>
              ))}
            </div>
            <div className="pds-compare-stack">
              <div className="pds-compare-card">
                <p className="pds-eyebrow">Traditional wallet</p>
                <div className="pds-signal-row">
                  <span>Gas required</span>
                  <span>Seed phrase</span>
                  <span>Public address</span>
                  <span>Wrong network</span>
                </div>
              </div>
              <div className="pds-compare-card pds-compare-card--z0tz">
                <p className="pds-eyebrow">z0tz</p>
                <div className="pds-signal-row">
                  <span>Sponsored gas</span>
                  <span>Passkey</span>
                  <span>Less exposure</span>
                  <span>Stablecoin account</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pds-section--light" id="products">
          <div className="pds-products-header">
            <SectionHeader
              tone="light"
              eyebrow="Product benefits"
              title="A better way to hold and move your money"
              lede="Three capabilities that turn stablecoins into everyday digital dollars."
            />
            <PrimaryCTA href="#early-access">Book a 15 min demo</PrimaryCTA>
          </div>
          <div className="pds-product-grid">
            {benefitCards.map(card => (
              <ProductCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <div className="pds-dark-band">
          <section className="pds-dark-band__part">
            <SectionHeader
              eyebrow="Why people switch"
              title="Reasons that sound human, not technical."
            />
            <div className="pds-quote-grid" style={{ marginTop: 22 }}>
              {switchReasons.map(reason => (
                <SpotlightCard key={reason} className="pds-quote-card">
                  <p>{reason}</p>
                </SpotlightCard>
              ))}
            </div>
          </section>

          <section className="pds-dark-band__part">
            <SectionHeader
              eyebrow="Built for real usage"
              title="Designed for people who already use stablecoins in daily life."
              lede="Get paid, send money, and store value in digital dollars — without wallet friction."
            />
            <UsageSwitcher />
          </section>
        </div>

        <section className="pds-section--light" id="how-it-works">
          <SectionHeader
            tone="light"
            eyebrow="How it works"
            title="Three steps. Less anxiety."
          />
          <div className="pds-steps-grid" style={{ marginTop: 24 }}>
            {steps.map(step => (
              <article key={step.number} className="pds-step-card">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="pds-step-index">{step.number}</span>
                  <p className="pds-eyebrow">{step.label}</p>
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                <div className="pds-mini-ui">
                  <span>{step.preview}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <DotField className="pds-trial-wrap" defaultX={40} defaultY={50}>
          <section className="pds-section--dark pds-trial-layout">
            <div>
              <SectionHeader
                eyebrow="Validation cohort"
                title="Join the first B2C validation cohort."
                lede="We are running 15 minute guided desktop demos with early users before mainnet. The goal is to validate onboarding, stablecoin usage, privacy needs, and deposit intent before asking anyone to install."
              />
              <div style={{ marginTop: 20 }}>
                <PrimaryCTA href="#early-access">Request guided demo</PrimaryCTA>
              </div>
              <p className="pds-helper" style={{ marginTop: 14 }}>
                Limited early access cohort
              </p>
              <p className="pds-meta" style={{ marginTop: 8 }}>
                Guided demo first. Desktop install only for high-intent testers after
                the call.
              </p>
            </div>
            <div className="pds-trial-metrics">
              <MetricBadge label="Demo length" value="15 min" />
              <MetricBadge label="Stage" value="Testnet only" tone="gold" />
            </div>
          </section>
        </DotField>

        <section className="pds-section--dark">
          <SectionHeader
            eyebrow="Architecture / Control layer"
            title="Simple on the outside. Controlled underneath."
            lede="z0tz hides wallet complexity while coordinating infrastructure for safer stablecoin flows."
          />
          <div className="pds-arch-grid" style={{ marginTop: 24 }}>
            {architectureNodes.map((node, index) => (
              <ArchitectureNode
                key={node.title}
                {...node}
                showConnector={index < architectureNodes.length - 1}
              />
            ))}
          </div>
        </section>

        <section className="pds-section--light pds-trust-section">
          <SectionHeader
            tone="light"
            eyebrow="Trust & transparency"
            title="What z0tz protects, and what it does not claim"
            lede="Financial privacy should be clear, not magical. z0tz is designed to reduce unnecessary public exposure while being honest about what remains visible onchain."
          />
          <div className="pds-trust-grid">
            <div className="pds-trust-card pds-trust-card--positive">
              <h3>What we are building</h3>
              <div className="pds-trust-list">
                {trustBuildItems.map(item => (
                  <div key={item} className="pds-trust-row">
                    <span>✓</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pds-trust-card">
              <h3>What we do not claim</h3>
              <div className="pds-trust-list">
                {trustLimits.map(item => (
                  <div key={item} className="pds-trust-row pds-trust-row--limit">
                    <span>×</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="pds-trust-note">
            Being clear about what is public and private is what makes the rest
            trustworthy.
          </p>
        </section>

        <section className="pds-section--light">
          <SectionHeader
            tone="light"
            eyebrow="Designed for safer usage"
            title="Safer stablecoin usage starts with fewer mistakes."
            lede="Less wallet complexity, less public exposure, and less transaction friction."
          />
          <div className="pds-checklist" style={{ marginTop: 22 }}>
            {safetyChecks.map(item => (
              <div key={item} className="pds-check-row">
                <span>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pds-section--light pds-early-access" id="early-access">
          <div>
            <SectionHeader
              tone="light"
              eyebrow="Request a guided demo"
              title="Tell us how you use stablecoins today."
              lede="So we can prioritize users with real stablecoin usage and mainnet intent."
            />
            <div className="pds-lead-tags" style={{ marginTop: 16 }}>
              <span>Current stablecoin usage</span>
              <span>Exchange or wallet used today</span>
              <span>Initial mainnet amount</span>
              <span>Guided demo intent</span>
            </div>
          </div>
          <EarlyAccessForm />
        </section>

        <DotField className="pds-final-wrap" defaultX={35} defaultY={40}>
          <section className="pds-final">
            <div className="pds-final__copy">
              <SectionHeader
                eyebrow="This is where your stablecoins live"
                title="Not just a wallet. A better way to hold and use digital dollars."
                lede="Join the first B2C validation cohort and help us validate the desktop flow before mainnet."
              />
              <PrimaryCTA href="#early-access">Book a 15 min demo</PrimaryCTA>
            </div>
            <WalletMockup variant="final" showFlowline={false} />
          </section>
        </DotField>

        <section className="pds-section--light pds-b2b-section">
          <div className="pds-b2b-section__copy">
            <SectionHeader
              tone="light"
              eyebrow="For apps and fintech teams"
              title="Offer private, gas-sponsored stablecoin flows without building wallet infrastructure from scratch."
              lede="z0tz is also being designed as infrastructure for products that want better stablecoin UX: passkey onboarding, relayed execution, reduced public exposure, and compliance-aware controls."
            />
            <div className="pds-b2b-actions">
              <PrimaryCTA href="mailto:team@z0tz.com?subject=z0tz%20B2B%20integration">
                Talk to us
              </PrimaryCTA>
              <p className="pds-meta">
                B2B conversations are separate from the B2C validation cohort.
              </p>
            </div>
          </div>
          <div className="pds-b2b-grid">
            {b2bCapabilities.map(item => (
              <div key={item.title} className="pds-b2b-card">
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="pds-footer">
          <div>
            <strong>z0tz</strong>
            <p>Private Dollar OS — digital dollars with less friction and less exposure.</p>
            <p className="pds-footer__disclaimer">
              Testnet proof of concept. Not yet deployed to mainnet. Do not use with
              real funds.
            </p>
          </div>
          <div className="pds-footer__links">
            <BracketLink href="https://x.com/0xz0tz" external>
              Twitter
            </BracketLink>
            <BracketLink href="#early-access">Guided demo</BracketLink>
            <BracketLink href="mailto:team@z0tz.com">Contact</BracketLink>
          </div>
        </footer>
      </main>
    </div>
  );
}
