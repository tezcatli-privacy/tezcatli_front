import { NextRequest, NextResponse } from "next/server";

type EarlyAccessLead = {
  name?: string;
  contact?: string;
  country?: string;
  stablecoinUse?: string;
  currentTool?: string;
  initialAmount?: string;
  wantsGuidedDemo?: string;
};

const requiredFields: Array<keyof EarlyAccessLead> = ["name", "contact", "country"];

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return NextResponse.json({ error: "Google Sheets webhook is not configured." }, { status: 503 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: "Google Sheets webhook secret is not configured." }, { status: 503 });
  }

  let lead: EarlyAccessLead;

  try {
    lead = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const missingField = requiredFields.find(field => !lead[field]?.trim());
  if (missingField) {
    return NextResponse.json({ error: `Missing required field: ${missingField}` }, { status: 400 });
  }

  const payload = {
    submittedAt: new Date().toISOString(),
    source: "z0tz_b2c_landing",
    secret: webhookSecret,
    ...lead,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Google Sheets webhook rejected the request." }, { status: 502 });
    }

    const result = await response.json().catch(() => null);
    if (!result?.ok) {
      return NextResponse.json(
        { error: result?.error || "Google Sheets webhook did not confirm the write." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to reach Google Sheets webhook." }, { status: 502 });
  }
}
