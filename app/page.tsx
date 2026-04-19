import Link from "next/link";

const landingPoints = [
  "Identity linkage",
  "Visible assets and flows",
  "Behavioral patterns",
  "What an attacker or analyst can infer",
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="hero-frame">
        <div className="hero-copy">
          <p className="eyebrow">Tezcatli</p>
          <h1>Reduce Your Onchain Signal</h1>
          <p className="lede">
            Your wallet is not private. It is a public profile. Tezcatli shows what
            others can already infer, then gives you a path to reduce visibility over
            time.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/scan">
              Scan Wallet
            </Link>
            <Link className="ghost-button" href="/audit">
              Auditor Dashboard
            </Link>
          </div>
        </div>
        <aside className="hero-aside">
          <p className="eyebrow">Understand Your Exposure</p>
          <ul>
            {landingPoints.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="story-grid">
        <article className="story-card">
          <p className="eyebrow">1. Scan Your Wallet</p>
          <h2>Measure how exposed the current profile really is.</h2>
          <p>
            Combine wallet intelligence, visible assets, social linkage and risk
            screening into one actionable view.
          </p>
        </article>
        <article className="story-card">
          <p className="eyebrow">2. Migrate Safely</p>
          <h2>Move into a fresh confidential posture without a naive public link.</h2>
          <p>
            Alpha supports stealth-style migration, smart account setup and sponsored
            execution flows.
          </p>
        </article>
        <article className="story-card">
          <p className="eyebrow">3. Operate Confidentially</p>
          <h2>Use vault strategies while keeping strategy leakage contained.</h2>
          <p>
            Your capital keeps working while exposure is intentionally reduced instead
            of continuously broadcast.
          </p>
        </article>
      </section>
    </main>
  );
}
