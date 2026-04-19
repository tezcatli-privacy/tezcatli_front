import { appConfig } from "@/lib/config";
import { loadAlphaManifest } from "@/lib/alpha-manifest";
import type { AuditSummary } from "@/lib/types";

async function fetchAuditData() {
  const [summaryRes, eventsRes, casesRes] = await Promise.all([
    fetch(`${appConfig.complianceUrl}/v1/compliance/audit/summary`, { cache: "no-store" }),
    fetch(`${appConfig.complianceUrl}/v1/compliance/audit/events?limit=12`, { cache: "no-store" }),
    fetch(`${appConfig.complianceUrl}/v1/compliance/audit/cases`, { cache: "no-store" }),
  ]);

  const summary = (summaryRes.ok ? await summaryRes.json() : null) as AuditSummary | null;
  const events = (eventsRes.ok ? await eventsRes.json() : { events: [] }) as {
    events: Array<{
      id: string;
      type: string;
      wallet?: string;
      severity: string;
      createdAt: number;
      payload: Record<string, unknown>;
    }>;
  };
  const cases = (casesRes.ok ? await casesRes.json() : { cases: [] }) as {
    cases: Array<{
      id: string;
      wallet: string;
      reasonCode: number;
      note: string;
      status: string;
      openedAt: number;
    }>;
  };

  return { summary, events: events.events, cases: cases.cases };
}

export default async function AuditPage() {
  const manifest = loadAlphaManifest();
  const { summary, events, cases } = await fetchAuditData();

  return (
    <main className="audit-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Auditor Surface</p>
            <h1>Operational compliance visibility</h1>
          </div>
          <span className="metric-chip">{manifest?.network ?? "manifest missing"}</span>
        </div>
        <div className="metrics-grid">
          <article className="metric-card panel">
            <p className="eyebrow">Linked Wallets</p>
            <div className="score-value">{summary?.linkedWallets ?? 0}</div>
          </article>
          <article className="metric-card panel">
            <p className="eyebrow">Open Cases</p>
            <div className="score-value">{summary?.openCases ?? 0}</div>
          </article>
          <article className="metric-card panel">
            <p className="eyebrow">High-Risk Wallets</p>
            <div className="score-value">{summary?.highRiskWallets ?? 0}</div>
          </article>
          <article className="metric-card panel">
            <p className="eyebrow">Threshold Breaches</p>
            <div className="score-value">{summary?.thresholdBreaches ?? 0}</div>
          </article>
        </div>
      </section>

      <section className="audit-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent Events</p>
              <h2>Operational feed</h2>
            </div>
          </div>
          <div className="list-grid">
            {events.map(event => (
              <article key={event.id} className="list-card">
                <div className="list-card-header">
                  <strong>{event.type}</strong>
                  <span>{event.severity}</span>
                </div>
                <p className="muted">{event.wallet ?? "global event"}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Manual Reviews</p>
              <h2>Open compliance cases</h2>
            </div>
          </div>
          <div className="list-grid">
            {cases.map(item => (
              <article key={item.id} className="list-card">
                <div className="list-card-header">
                  <strong>{item.wallet}</strong>
                  <span>{item.status}</span>
                </div>
                <p className="muted">{item.note}</p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
