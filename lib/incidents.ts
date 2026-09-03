import type { Incident, WorkspaceState } from "./types";

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: "INC-2041",
    title: "Checkout failures after payment deploy",
    subtitle: "Customers cannot complete card payments",
    severity: "SEV-1",
    status: "Investigating",
    startedAt: "18:04 UTC",
    owner: "Payments On-Call",
    affectedService: "checkout-api",
    summary:
      "Checkout requests began returning HTTP 500s minutes after a payment-service deployment. Auth and database remain healthy.",
    services: [
      { name: "checkout-api", status: "down", latencyMs: 1480, errorRatePct: 38.4 },
      { name: "payments-webhook", status: "degraded", latencyMs: 823, errorRatePct: 24.1 },
      { name: "auth-service", status: "healthy", latencyMs: 86, errorRatePct: 0.2 },
      { name: "postgres-primary", status: "healthy", latencyMs: 21, errorRatePct: 0.0 }
    ],
    logs: [
      { id: "log-2041-1", time: "18:03:51", service: "checkout-api", level: "INFO", message: "POST /checkout 200 order=ord_83b9 latency=182ms" },
      { id: "log-2041-2", time: "18:04:02", service: "payments-webhook", level: "ERROR", message: "webhook signature verification failed provider=stripe reason=signature_mismatch" },
      { id: "log-2041-3", time: "18:04:03", service: "checkout-api", level: "ERROR", message: "payment confirmation rejected code=STRIPE_SIGNATURE_INVALID" },
      { id: "log-2041-4", time: "18:04:05", service: "checkout-api", level: "ERROR", message: "POST /checkout 500 order=ord_83c1 stage=payment_confirmation" },
      { id: "log-2041-5", time: "18:04:14", service: "auth-service", level: "INFO", message: "token verification healthy p95=84ms" },
      { id: "log-2041-6", time: "18:05:11", service: "payments-webhook", level: "ERROR", message: "webhook signature verification failed provider=stripe reason=signature_mismatch" },
      { id: "log-2041-7", time: "18:05:36", service: "checkout-api", level: "WARN", message: "checkout retries exhausted provider=stripe attempts=3" },
      { id: "log-2041-8", time: "18:06:02", service: "postgres-primary", level: "INFO", message: "connection pool healthy active=27 idle=41 max=100" }
    ],
    deployments: [
      { id: "dep-2041-1", time: "17:58", service: "checkout-api", version: "v4.8.1", actor: "deploy-bot", summary: "Payment callback hardening and environment refresh" },
      { id: "dep-2041-2", time: "14:22", service: "auth-service", version: "v2.19.4", actor: "deploy-bot", summary: "Routine dependency patch" }
    ],
    configChanges: [
      { id: "cfg-2041-1", time: "17:57", service: "checkout-api", key: "STRIPE_WEBHOOK_SECRET", actor: "deploy-bot", summary: "Secret reference changed from payments/prod/webhook-v3 to payments/prod/webhook-v4" },
      { id: "cfg-2041-2", time: "17:57", service: "checkout-api", key: "PAYMENT_RETRY_LIMIT", actor: "deploy-bot", summary: "3 → 3 (re-applied during deployment)" }
    ],
    timeline: [
      { id: "tl-2041-1", time: "17:58", label: "Deployment completed", detail: "checkout-api v4.8.1 reached 100%", source: "system" },
      { id: "tl-2041-2", time: "18:04", label: "Error budget alert", detail: "checkout-api 5xx rate exceeded 20%", source: "system" },
      { id: "tl-2041-3", time: "18:05", label: "Incident declared", detail: "SEV-1 checkout incident opened", source: "human" }
    ],
    runbook: [
      { id: "rb-2041-1", title: "Verify provider status", detail: "Confirm payment provider and auth dependencies are healthy before rollback.", risk: "low" },
      { id: "rb-2041-2", title: "Compare configuration", detail: "Diff payment-related environment and secret references against the last known-good release.", risk: "low" },
      { id: "rb-2041-3", title: "Restore last known-good secret reference", detail: "Requires human approval because it changes production payment configuration.", risk: "medium" }
    ]
  },
  {
    id: "INC-2098",
    title: "Authentication latency spike",
    subtitle: "Login requests timing out intermittently",
    severity: "SEV-2",
    status: "Investigating",
    startedAt: "09:17 UTC",
    owner: "Identity On-Call",
    affectedService: "auth-service",
    summary:
      "Authentication p95 latency increased from ~90ms to >2s. Database is healthy, but cache waits are rising under normal request volume.",
    services: [
      { name: "auth-service", status: "degraded", latencyMs: 2184, errorRatePct: 8.7 },
      { name: "redis-session", status: "degraded", latencyMs: 914, errorRatePct: 4.1 },
      { name: "postgres-primary", status: "healthy", latencyMs: 24, errorRatePct: 0.1 },
      { name: "api-gateway", status: "healthy", latencyMs: 51, errorRatePct: 0.2 }
    ],
    logs: [
      { id: "log-2098-1", time: "09:16:40", service: "auth-service", level: "INFO", message: "login completed user=anon latency=94ms" },
      { id: "log-2098-2", time: "09:17:03", service: "auth-service", level: "WARN", message: "redis acquire wait exceeded threshold wait=812ms pool_active=50 pool_max=50" },
      { id: "log-2098-3", time: "09:17:05", service: "redis-session", level: "WARN", message: "client connections saturated connected=50 configured_max=50" },
      { id: "log-2098-4", time: "09:17:08", service: "auth-service", level: "ERROR", message: "session lookup timeout elapsed=2000ms" },
      { id: "log-2098-5", time: "09:18:11", service: "postgres-primary", level: "INFO", message: "query p95 healthy duration=22ms" },
      { id: "log-2098-6", time: "09:18:39", service: "auth-service", level: "WARN", message: "redis acquire wait exceeded threshold wait=1042ms pool_active=50 pool_max=50" }
    ],
    deployments: [
      { id: "dep-2098-1", time: "08:55", service: "auth-service", version: "v2.20.0", actor: "deploy-bot", summary: "Session-cache client upgrade" }
    ],
    configChanges: [
      { id: "cfg-2098-1", time: "08:54", service: "auth-service", key: "REDIS_POOL_MAX", actor: "deploy-bot", summary: "120 → 50 as part of cache client migration defaults" }
    ],
    timeline: [
      { id: "tl-2098-1", time: "08:55", label: "Deployment completed", detail: "auth-service v2.20.0 released", source: "system" },
      { id: "tl-2098-2", time: "09:17", label: "Latency alert", detail: "auth p95 > 2 seconds", source: "system" },
      { id: "tl-2098-3", time: "09:19", label: "Incident opened", detail: "Identity team acknowledged degradation", source: "human" }
    ],
    runbook: [
      { id: "rb-2098-1", title: "Check downstream latency", detail: "Rule out primary database and gateway latency.", risk: "low" },
      { id: "rb-2098-2", title: "Inspect cache pool saturation", detail: "Compare active and max Redis client connections.", risk: "low" },
      { id: "rb-2098-3", title: "Restore previous pool maximum", detail: "Requires human approval because it changes production runtime configuration.", risk: "medium" }
    ]
  },
  {
    id: "INC-2130",
    title: "API 500s on document export",
    subtitle: "Export workers fail immediately after startup",
    severity: "SEV-2",
    status: "Investigating",
    startedAt: "22:41 UTC",
    owner: "Platform On-Call",
    affectedService: "export-worker",
    summary:
      "Document export jobs began failing after a worker deployment. CPU, memory, and queue depth are normal; failures occur during object-storage initialization.",
    services: [
      { name: "export-worker", status: "down", latencyMs: 0, errorRatePct: 61.3 },
      { name: "object-storage", status: "healthy", latencyMs: 42, errorRatePct: 0.0 },
      { name: "job-queue", status: "healthy", latencyMs: 18, errorRatePct: 0.1 },
      { name: "api-gateway", status: "healthy", latencyMs: 55, errorRatePct: 0.2 }
    ],
    logs: [
      { id: "log-2130-1", time: "22:40:52", service: "export-worker", level: "INFO", message: "worker boot version=v7.3.2 region=us-east-1" },
      { id: "log-2130-2", time: "22:41:01", service: "export-worker", level: "ERROR", message: "storage client init failed endpoint=https://https://objects.internal error=invalid_url" },
      { id: "log-2130-3", time: "22:41:02", service: "export-worker", level: "ERROR", message: "job failed stage=storage_init job=exp_9182" },
      { id: "log-2130-4", time: "22:41:11", service: "object-storage", level: "INFO", message: "health probe ok latency=39ms" },
      { id: "log-2130-5", time: "22:42:07", service: "export-worker", level: "ERROR", message: "storage client init failed endpoint=https://https://objects.internal error=invalid_url" }
    ],
    deployments: [
      { id: "dep-2130-1", time: "22:37", service: "export-worker", version: "v7.3.2", actor: "deploy-bot", summary: "Storage SDK migration and env normalization" }
    ],
    configChanges: [
      { id: "cfg-2130-1", time: "22:36", service: "export-worker", key: "OBJECT_STORAGE_ENDPOINT", actor: "deploy-bot", summary: "objects.internal → https://objects.internal" },
      { id: "cfg-2130-2", time: "22:36", service: "export-worker", key: "STORAGE_FORCE_HTTPS", actor: "deploy-bot", summary: "false → true" }
    ],
    timeline: [
      { id: "tl-2130-1", time: "22:37", label: "Deployment completed", detail: "export-worker v7.3.2 released", source: "system" },
      { id: "tl-2130-2", time: "22:41", label: "Job failure alert", detail: "Export failure rate exceeded 50%", source: "system" },
      { id: "tl-2130-3", time: "22:43", label: "Incident opened", detail: "Platform team started investigation", source: "human" }
    ],
    runbook: [
      { id: "rb-2130-1", title: "Verify object-storage health", detail: "Confirm the downstream service is reachable before changing workers.", risk: "low" },
      { id: "rb-2130-2", title: "Inspect endpoint construction", detail: "Compare endpoint config with SDK HTTPS behavior.", risk: "low" },
      { id: "rb-2130-3", title: "Normalize endpoint configuration", detail: "Requires human approval because it changes a production environment variable.", risk: "medium" }
    ]
  }
];

export function createEmptyWorkspace(): WorkspaceState {
  return {
    hypotheses: [],
    timelineAdditions: [],
    analysis: null,
    approval: null,
    activity: []
  };
}

export function createInitialWorkspaceMap(incidents: Incident[]): Record<string, WorkspaceState> {
  return Object.fromEntries(incidents.map((incident) => [incident.id, createEmptyWorkspace()]));
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export function createImportedIncident(args: {
  title: string;
  service: string;
  evidence: string;
}): Incident {
  const cleanTitle = args.title.trim() || "Imported incident";
  const cleanService = args.service.trim() || "unknown-service";
  const cleanEvidence = args.evidence.trim();
  const lines = cleanEvidence
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);

  const id = `CUSTOM-${hashText(`${cleanTitle}|${cleanService}|${cleanEvidence}`)}`;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return {
    id,
    title: cleanTitle.slice(0, 90),
    subtitle: "Imported evidence — no predetermined answer",
    severity: "SEV-2",
    status: "Investigating",
    startedAt: `${hh}:${mm} local`,
    owner: "Demo Operator",
    affectedService: cleanService.slice(0, 50),
    summary: "A custom incident created from user-provided evidence. TraceDesk has no built-in root cause for this incident.",
    services: [
      { name: cleanService.slice(0, 50), status: "degraded", latencyMs: 0, errorRatePct: 0 }
    ],
    logs: lines.map((line, index) => {
      const upper = line.toUpperCase();
      const level = upper.includes("ERROR") || upper.includes("FAIL")
        ? "ERROR"
        : upper.includes("WARN") || upper.includes("SLOW")
          ? "WARN"
          : "INFO";
      return {
        id: `${id}-log-${index + 1}`,
        time: `raw-${String(index + 1).padStart(2, "0")}`,
        service: cleanService.slice(0, 50),
        level,
        message: line.slice(0, 500)
      };
    }),
    deployments: [],
    configChanges: [],
    timeline: [
      {
        id: `${id}-timeline-1`,
        time: `${hh}:${mm}`,
        label: "Evidence imported",
        detail: `${lines.length} evidence lines added to TraceDesk`,
        source: "human"
      }
    ],
    runbook: [
      {
        id: `${id}-runbook-1`,
        title: "Correlate the evidence",
        detail: "Identify the first failing component and separate symptoms from likely causes.",
        risk: "low"
      },
      {
        id: `${id}-runbook-2`,
        title: "Propose a reversible next step",
        detail: "Prefer verification or rollback-style actions before irreversible changes.",
        risk: "medium"
      }
    ],
    isImported: true
  };
}
