"use client";

import { useState } from "react";
import posthog from "posthog-js";

const usageScenarios = [
  {
    title: "Get paid",
    meta: "Receive stablecoins as usable income.",
    balance: "1,320.00 USD",
    badges: ["Gas sponsored", "Private activity", "Passkey secured"],
    activity: [
      { type: "Received", amount: "+250 USD", meta: "Salary payout" },
      { type: "Saved", amount: "+180 USD", meta: "Moved to balance" },
      { type: "Status", amount: "Balance protected", meta: "Reduced public exposure" },
    ],
  },
  {
    title: "Send money",
    meta: "Move value without gas or wallet friction.",
    balance: "870.00 USD",
    badges: ["Gas sponsored", "Passkey approved", "Less exposure"],
    activity: [
      { type: "Sent", amount: "-50 USD", meta: "Family transfer" },
      { type: "Fee", amount: "Sponsored", meta: "No native gas needed" },
      { type: "Status", amount: "Private transfer", meta: "Relayed execution" },
    ],
  },
  {
    title: "Store USD",
    meta: "Keep digital dollars with less public exposure.",
    balance: "2,450.00 USD",
    badges: ["Protected balance", "Stablecoin account", "Passkey secured"],
    activity: [
      { type: "Received", amount: "+500 USD", meta: "Exchange transfer" },
      { type: "Held", amount: "2,450 USD", meta: "Digital dollar balance" },
      {
        type: "Status",
        amount: "Less exposed",
        meta: "Activity separated from public wallet graph",
      },
    ],
  },
];

export function UsageSwitcher() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScenario = usageScenarios[activeIndex];

  return (
    <div className="pds-usage-layout" style={{ marginTop: 24 }}>
      <div className="pds-usage-list" role="list" aria-label="Stablecoin use cases">
        {usageScenarios.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`pds-usage-item${index === activeIndex ? " pds-usage-item--active" : ""}`}
            aria-pressed={index === activeIndex}
            onClick={() => {
              setActiveIndex(index);
              posthog.capture("usage_switcher_click", {
                scenario: item.title,
              });
            }}
          >
            <h3>{item.title}</h3>
            <p>{item.meta}</p>
          </button>
        ))}
      </div>
      <div className="pds-activity-panel">
        <div className="pds-wallet-mockup__top">
          <p className="pds-eyebrow pds-eyebrow--light">Digital dollar balance</p>
          <span className="pds-status-pill">Protected</span>
        </div>
        <strong className="pds-activity-balance">{activeScenario.balance}</strong>
        <div className="pds-badge-row">
          {activeScenario.badges.map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
        {activeScenario.activity.map(item => (
          <div key={`${item.type}-${item.amount}`} className="pds-activity-row">
            <div>
              <span>{item.type}</span>
              <p>{item.meta}</p>
            </div>
            <strong>{item.amount}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
