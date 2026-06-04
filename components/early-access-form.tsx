"use client";

import { FormEvent, useState } from "react";

const stablecoinUses = [
  "Saving in digital dollars",
  "Getting paid as a freelancer",
  "Sending or receiving payments",
  "Founder / business treasury",
  "Crypto-native daily usage",
];

const tools = ["Bitso", "Binance", "OKX", "TruBit", "Wallet", "Other"];
const initialAmounts = ["Less than 20 USDC", "20-100 USDC", "100-500 USDC", "1K+ USDC"];

type FormFields = {
  name: string;
  contact: string;
  country: string;
  stablecoinUse: string;
  currentTool: string;
  initialAmount: string;
  wantsGuidedDemo: string;
};

const initialFields: FormFields = {
  name: "",
  contact: "",
  country: "",
  stablecoinUse: stablecoinUses[0],
  currentTool: tools[0],
  initialAmount: initialAmounts[1],
  wantsGuidedDemo: "Yes",
};

function trackConversion(eventName: string, payload: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));

  const dataLayer = (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: eventName, ...payload });
  }
}

export function EarlyAccessForm() {
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saved" | "fallback" | "error">("idle");

  const updateField = (field: keyof FormFields, value: string) => {
    setFields(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    trackConversion("early_access_submit", fields);

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (response.ok) {
        setSubmitted(true);
        setSubmitStatus("saved");
        setFields(initialFields);
        trackConversion("early_access_saved", fields);
        return;
      }

      if (response.status === 503) {
        setSubmitStatus("fallback");
        openEmailFallback(fields);
        return;
      }

      setSubmitStatus("error");
    } catch {
      setSubmitStatus("fallback");
      openEmailFallback(fields);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="early-access-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Name
          <input
            name="name"
            autoComplete="name"
            required
            value={fields.name}
            onChange={event => updateField("name", event.target.value)}
            onFocus={() => trackConversion("early_access_field_focus", { field: "name" })}
          />
        </label>
        <label>
          WhatsApp, Telegram, or email
          <input
            name="contact"
            autoComplete="email"
            required
            value={fields.contact}
            onChange={event => updateField("contact", event.target.value)}
            onFocus={() => trackConversion("early_access_field_focus", { field: "contact" })}
          />
        </label>
        <label>
          Country
          <input
            name="country"
            autoComplete="country-name"
            required
            value={fields.country}
            onChange={event => updateField("country", event.target.value)}
            onFocus={() => trackConversion("early_access_field_focus", { field: "country" })}
          />
        </label>
        <label>
          How do you use stablecoins?
          <select
            name="stablecoinUse"
            value={fields.stablecoinUse}
            onChange={event => updateField("stablecoinUse", event.target.value)}
          >
            {stablecoinUses.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          What do you use today?
          <select
            name="currentTool"
            value={fields.currentTool}
            onChange={event => updateField("currentTool", event.target.value)}
          >
            {tools.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Initial mainnet amount
          <select
            name="initialAmount"
            value={fields.initialAmount}
            onChange={event => updateField("initialAmount", event.target.value)}
          >
            {initialAmounts.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Do you want a 15 minute guided desktop demo?</legend>
        <div className="radio-row">
          <label>
            <input
              type="radio"
              name="wantsGuidedDemo"
              value="Yes"
              checked={fields.wantsGuidedDemo === "Yes"}
              onChange={event => updateField("wantsGuidedDemo", event.target.value)}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              name="wantsGuidedDemo"
              value="Not yet"
              checked={fields.wantsGuidedDemo === "Not yet"}
              onChange={event => updateField("wantsGuidedDemo", event.target.value)}
            />
            Not yet
          </label>
        </div>
      </fieldset>
      <button className="primary-button prominent-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Request demo"}
      </button>
      <p className="compact-meta">
        Testnet only for now. You do not need to install anything before the demo.
        Desktop install is only for high-intent testers after the call.
      </p>
      {submitted && submitStatus === "saved" ? (
        <p className="form-status">Saved. We will follow up to schedule the guided demo.</p>
      ) : null}
      {submitStatus === "fallback" ? (
        <p className="form-status">Your email app should open with the lead details ready to send.</p>
      ) : null}
      {submitStatus === "error" ? (
        <p className="error-text">Unable to save the request. Please try again or contact team@z0tz.com.</p>
      ) : null}
    </form>
  );
}

function openEmailFallback(fields: FormFields) {
  const subject = encodeURIComponent(`z0tz early access - ${fields.name || "new lead"}`);
  const body = encodeURIComponent(
    [
      "New z0tz early access lead",
      "",
      `Name: ${fields.name}`,
      `Contact: ${fields.contact}`,
      `Country: ${fields.country}`,
      `Stablecoin use: ${fields.stablecoinUse}`,
      `Current tool: ${fields.currentTool}`,
      `Initial amount: ${fields.initialAmount}`,
      `Wants guided desktop demo: ${fields.wantsGuidedDemo}`,
    ].join("\n"),
  );

  window.location.href = `mailto:team@z0tz.com?subject=${subject}&body=${body}`;
}
