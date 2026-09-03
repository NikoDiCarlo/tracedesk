import { createHash } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";

import {
  ANALYSIS_INSTRUCTIONS,
  ANALYSIS_JSON_SCHEMA,
  incidentForModel
} from "@/lib/prompt";

import { checkRateLimit } from "@/lib/rate-limit";
import type { AnalysisResult, Incident } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 50_000;
const MAX_SERIALIZED_EVIDENCE_CHARS = 18_000;

function clientKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const ip = forwarded || realIp || "unknown";

  return createHash("sha256")
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeIncident(value: unknown): value is Incident {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.affectedService === "string" &&
    Array.isArray(value.services) &&
    Array.isArray(value.logs) &&
    Array.isArray(value.deployments) &&
    Array.isArray(value.configChanges) &&
    Array.isArray(value.runbook)
  );
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function normalizeAnalysis(value: AnalysisResult): AnalysisResult {
  const confidence = Math.max(0, Math.min(1, value.confidence));

  const confidenceBand =
    confidence >= 0.8
      ? "high"
      : confidence >= 0.55
        ? "medium"
        : "low";

  return {
    summary: clip(value.summary.trim(), 700),
    rootCause: clip(value.rootCause.trim(), 500),
    confidence,
    confidenceBand,

    evidence: value.evidence.slice(0, 6).map((item) => ({
      finding: clip(item.finding.trim(), 300),
      source: clip(item.source.trim(), 180)
    })),

    remediation: value.remediation.slice(0, 5).map((item) => ({
      step: clip(item.step.trim(), 350),
      risk: item.risk,
      requiresHumanApproval: item.requiresHumanApproval
    })),

    customerUpdate: clip(value.customerUpdate.trim(), 500),

    caveats: value.caveats
      .slice(0, 4)
      .map((item) => clip(item.trim(), 260))
  };
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isPlainObject(value)) return false;

  const confidence = value.confidence;
  const band = value.confidenceBand;

  return (
    typeof value.summary === "string" &&
    typeof value.rootCause === "string" &&
    typeof confidence === "number" &&
    confidence >= 0 &&
    confidence <= 1 &&
    (band === "low" || band === "medium" || band === "high") &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    value.evidence.every(
      (item) =>
        isPlainObject(item) &&
        typeof item.finding === "string" &&
        typeof item.source === "string"
    ) &&
    Array.isArray(value.remediation) &&
    value.remediation.length > 0 &&
    value.remediation.every(
      (item) =>
        isPlainObject(item) &&
        typeof item.step === "string" &&
        (item.risk === "low" ||
          item.risk === "medium" ||
          item.risk === "high") &&
        typeof item.requiresHumanApproval === "boolean"
    ) &&
    typeof value.customerUpdate === "string" &&
    Array.isArray(value.caveats) &&
    value.caveats.every((item) => typeof item === "string")
  );
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    fetchSite &&
    !["same-origin", "same-site", "none"].includes(fetchSite)
  ) {
    return NextResponse.json(
      {
        error: "Cross-site requests are not allowed."
      },
      {
        status: 403
      }
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") ?? "0"
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return NextResponse.json(
      {
        error: "Incident payload is too large."
      },
      {
        status: 413
      }
    );
  }

  const decision = checkRateLimit(clientKey(request));

  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: `AI analysis is rate limited. Try again in ${decision.retryAfterSeconds}s.`,
        retryAfterSeconds: decision.retryAfterSeconds
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(decision.retryAfterSeconds)
        }
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON request."
      },
      {
        status: 400
      }
    );
  }

  if (
    !isPlainObject(body) ||
    !looksLikeIncident(body.incident)
  ) {
    return NextResponse.json(
      {
        error: "Invalid incident payload."
      },
      {
        status: 400
      }
    );
  }

  let safeIncident: ReturnType<typeof incidentForModel>;

  try {
    safeIncident = incidentForModel(body.incident);
  } catch {
    return NextResponse.json(
      {
        error: "Incident evidence contains invalid fields."
      },
      {
        status: 400
      }
    );
  }

  const evidenceJson = JSON.stringify(safeIncident);

  if (evidenceJson.length > MAX_SERIALIZED_EVIDENCE_CHARS) {
    return NextResponse.json(
      {
        error: "Incident evidence exceeds the analysis limit."
      },
      {
        status: 413
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured on the server."
      },
      {
        status: 503
      }
    );
  }

  const model =
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.6-luna";

  const openai = new OpenAI({
    apiKey,
    timeout: 15_000,
    maxRetries: 1
  });

  try {
    const response = await openai.responses.create({
      model,
      store: false,

      instructions: ANALYSIS_INSTRUCTIONS,

      input: `Analyze this incident evidence:\n${evidenceJson}`,

      reasoning: {
        effort: "low"
      },

      max_output_tokens: 1100,

      text: {
        verbosity: "low",

        format: {
          type: "json_schema",
          name: "tracedesk_incident_analysis",
          strict: true,
          schema: ANALYSIS_JSON_SCHEMA
        }
      }
    });

    const raw = response.output_text;

    if (!raw) {
      return NextResponse.json(
        {
          error: "The model returned no analysis."
        },
        {
          status: 502
        }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: "The model returned malformed structured output."
        },
        {
          status: 502
        }
      );
    }

    if (!isAnalysisResult(parsed)) {
      return NextResponse.json(
        {
          error: "The model returned an invalid analysis shape."
        },
        {
          status: 502
        }
      );
    }

    const normalized = normalizeAnalysis(parsed);

    return NextResponse.json(
      {
        analysis: normalized,
        model
      },
      {
        status: 200,

        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining-Window": String(
            decision.remainingInWindow
          ),
          "X-RateLimit-Remaining-Day": String(
            decision.remainingToday
          )
        }
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown OpenAI error";

    const safeMessage = message
      .toLowerCase()
      .includes("api key")
      ? "OpenAI authentication failed. Check the server environment variable."
      : message.includes("429")
        ? "OpenAI is currently rate limiting this project. Try again shortly."
        : "AI analysis failed. Please try again once.";

    return NextResponse.json(
      {
        error: safeMessage
      },
      {
        status: 502
      }
    );
  }
}
