import type {
  AnalysisResult,
  Hypothesis,
  Incident,
  RiskLevel,
  TimelineEvent
} from "./types";

export interface WebMCPBridgeContext {
  listIncidents: () => Incident[];
  getActiveIncident: () => Incident;
  selectIncident: (incidentId: string) => boolean;
  getLatestAnalysis: () => AnalysisResult | null;

  searchLogs: (
    query: string,
    service?: string
  ) => Incident["logs"];

  runAIAnalysis: () => Promise<AnalysisResult>;

  addHypothesis: (
    input: Omit<
      Hypothesis,
      "id" | "createdAt" | "source"
    >
  ) => Hypothesis;

  addTimelineEvent: (
    label: string,
    detail: string
  ) => TimelineEvent;

  requestApproval: (
    title: string,
    summary: string,
    risk: RiskLevel
  ) => void;
}

export type WebMCPStatus =
  | "checking"
  | "ready"
  | "unavailable"
  | "error";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function textArg(
  input: unknown,
  key: string,
  max = 500
): string {
  if (!input || typeof input !== "object") {
    return "";
  }

  const value = (
    input as Record<string, unknown>
  )[key];

  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function numberArg(
  input: unknown,
  key: string,
  fallback = 0.5
): number {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const value = (
    input as Record<string, unknown>
  )[key];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(1, value)
  );
}

function riskArg(input: unknown): RiskLevel {
  const value = textArg(
    input,
    "risk",
    20
  );

  return value === "high" ||
    value === "medium"
    ? value
    : "low";
}

export async function registerTraceDeskWebMCP(
  getContext: () => WebMCPBridgeContext,
  onStatus: (
    status: WebMCPStatus
  ) => void
): Promise<() => void> {
  if (
    typeof document === "undefined" ||
    typeof navigator === "undefined"
  ) {
    onStatus("unavailable");

    return () => undefined;
  }

  // Canonical WebMCP path:
  // document.modelContext.registerTool(...)
  //
  // navigator.modelContext is retained only as a compatibility
  // fallback for older preview builds.

  const legacyModelContext = (
    navigator as Navigator & {
      modelContext?: Document["modelContext"];
    }
  ).modelContext;

  const modelContext =
    document.modelContext ??
    legacyModelContext;

  if (!modelContext) {
    onStatus("unavailable");
    return () => undefined;
  }

  const controller =
    new AbortController();

  type RegisterableTool =
    Parameters<
      typeof modelContext.registerTool
    >[0];

  const tools = [
    {
      name: "list_incidents",
      title: "List TraceDesk incidents",

      description:
        "List the incidents available in TraceDesk with their IDs, severity, status, and affected service. Use this before switching incidents.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false
      },

      execute: async () =>
        json(
          getContext()
            .listIncidents()
            .map(
              ({
                id,
                title,
                severity,
                status,
                affectedService,
                isImported
              }) => ({
                id,
                title,
                severity,
                status,
                affectedService,
                imported:
                  Boolean(isImported)
              })
            )
        )
    },

    {
      name: "select_incident",
      title: "Select an incident",

      description:
        "Switch the TraceDesk workspace to a specific incident ID. This changes only the local workspace view and does not modify production systems.",

      inputSchema: {
        type: "object",

        properties: {
          incidentId: {
            type: "string",
            description:
              "Exact TraceDesk incident ID, for example INC-2041."
          }
        },

        required: [
          "incidentId"
        ],

        additionalProperties: false
      },

      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false
      },

      execute: async (
        input: unknown
      ) => {
        const incidentId =
          textArg(
            input,
            "incidentId",
            100
          );

        const selected =
          getContext()
            .selectIncident(
              incidentId
            );

        return json({
          selected,
          incidentId
        });
      }
    },

    {
      name: "get_active_incident",
      title: "Get active incident",

      description:
        "Return the active TraceDesk incident summary, status, severity, affected service, and current incident metadata.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },

      execute: async () => {
        const incident =
          getContext()
            .getActiveIncident();

        return json({
          id: incident.id,
          title: incident.title,
          subtitle: incident.subtitle,
          severity: incident.severity,
          status: incident.status,
          startedAt:
            incident.startedAt,
          owner: incident.owner,
          affectedService:
            incident.affectedService,
          summary: incident.summary
        });
      }
    },

    {
      name: "get_service_health",
      title: "Inspect service health",

      description:
        "Return current service health for the active incident, including status, latency, and error-rate measurements.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },

      execute: async () =>
        json(
          getContext()
            .getActiveIncident()
            .services
        )
    },

    {
      name: "search_logs",
      title: "Search incident logs",

      description:
        "Search the active incident logs by text and optionally by service. Use this to gather concrete evidence before forming a root-cause hypothesis.",

      inputSchema: {
        type: "object",

        properties: {
          query: {
            type: "string",
            description:
              "Case-insensitive log search text, such as signature, redis, timeout, or invalid_url."
          },

          service: {
            type: "string",
            description:
              "Optional exact or partial service name."
          }
        },

        required: [
          "query"
        ],

        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },

      execute: async (
        input: unknown
      ) => {
        const query = textArg(
          input,
          "query",
          160
        );

        const service =
          textArg(
            input,
            "service",
            100
          ) || undefined;

        if (!query) {
          return json({
            error:
              "query is required"
          });
        }

        return json(
          getContext()
            .searchLogs(
              query,
              service
            )
        );
      }
    },

    {
      name: "get_recent_changes",

      title:
        "Inspect deployments and configuration changes",

      description:
        "Return recent deployments and configuration changes for the active incident. Use this to correlate failures with recent changes.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },

      execute: async () => {
        const incident =
          getContext()
            .getActiveIncident();

        return json({
          deployments:
            incident.deployments,

          configChanges:
            incident.configChanges
        });
      }
    },

    {
      name: "get_runbook",
      title: "Read incident runbook",

      description:
        "Return the active incident's safe response runbook. Runbook steps are guidance only and do not execute infrastructure actions.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false
      },

      execute: async () =>
        json(
          getContext()
            .getActiveIncident()
            .runbook
        )
    },

    {
      name: "analyze_incident",

      title:
        "Run bounded AI incident analysis",

      description:
        "Run one bounded TraceDesk AI analysis over the active incident evidence. Results are cached locally after the first successful analysis, and this tool never performs remediation or loops autonomously.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },

      execute: async () =>
        json(
          await getContext()
            .runAIAnalysis()
        )
    },

    {
      name: "add_hypothesis",
      title: "Add root-cause hypothesis",

      description:
        "Add a root-cause hypothesis to the shared TraceDesk workspace so the human can review it. This changes only local incident workspace state.",

      inputSchema: {
        type: "object",

        properties: {
          title: {
            type: "string",
            description:
              "Concise hypothesis."
          },

          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1
          },

          rationale: {
            type: "string",
            description:
              "Why the evidence supports this hypothesis."
          },

          evidence: {
            type: "array",

            items: {
              type: "string"
            },

            maxItems: 6,

            description:
              "Short evidence statements supporting the hypothesis."
          }
        },

        required: [
          "title",
          "confidence",
          "rationale"
        ],

        additionalProperties: false
      },

      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true
      },

      execute: async (
        input: unknown
      ) => {
        const evidenceRaw =
          input &&
          typeof input === "object" &&
          Array.isArray(
            (
              input as Record<
                string,
                unknown
              >
            ).evidence
          )
            ? (
                (
                  input as Record<
                    string,
                    unknown
                  >
                ).evidence as unknown[]
              )
            : [];

        const evidence =
          evidenceRaw
            .filter(
              (
                item
              ): item is string =>
                typeof item ===
                "string"
            )
            .map(
              (item) =>
                item
                  .trim()
                  .slice(0, 260)
            )
            .filter(Boolean)
            .slice(0, 6);

        const hypothesis =
          getContext()
            .addHypothesis({
              title:
                textArg(
                  input,
                  "title",
                  240
                ) ||
                "Agent hypothesis",

              confidence:
                numberArg(
                  input,
                  "confidence",
                  0.5
                ),

              rationale:
                textArg(
                  input,
                  "rationale",
                  700
                ) ||
                "No rationale supplied.",

              evidence
            });

        return json(hypothesis);
      }
    },

    {
      name: "add_timeline_event",

      title:
        "Add investigation timeline event",

      description:
        "Add a concise agent-authored investigation event to the active incident timeline. This changes only TraceDesk workspace state.",

      inputSchema: {
        type: "object",

        properties: {
          label: {
            type: "string",
            description:
              "Short event label."
          },

          detail: {
            type: "string",
            description:
              "What was discovered or decided."
          }
        },

        required: [
          "label",
          "detail"
        ],

        additionalProperties: false
      },

      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false
      },

      execute: async (
        input: unknown
      ) =>
        json(
          getContext()
            .addTimelineEvent(
              textArg(
                input,
                "label",
                140
              ) ||
                "Agent update",

              textArg(
                input,
                "detail",
                500
              ) ||
                "Investigation workspace updated."
            )
        )
    },

    {
      name:
        "get_customer_update",

      title:
        "Get drafted customer update",

      description:
        "Return the customer-facing status update from the latest AI analysis. Call analyze_incident first if no analysis exists.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },

      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false
      },

      execute: async () => {
        const analysis =
          getContext()
            .getLatestAnalysis();

        return analysis
          ? json({
              customerUpdate:
                analysis.customerUpdate
            })
          : json({
              error:
                "No analysis exists yet. Call analyze_incident first."
            });
      }
    },

    {
      name:
        "request_remediation_approval",

      title:
        "Request human remediation approval",

      description:
        "Create a visible human-approval request for a proposed remediation. This never executes production changes; it only asks the human to approve or reject the proposed action in TraceDesk.",

      inputSchema: {
        type: "object",

        properties: {
          title: {
            type: "string",
            description:
              "Short proposed action."
          },

          summary: {
            type: "string",
            description:
              "Why this remediation should be considered."
          },

          risk: {
            type: "string",
            enum: [
              "low",
              "medium",
              "high"
            ]
          }
        },

        required: [
          "title",
          "summary",
          "risk"
        ],

        additionalProperties: false
      },

      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false
      },

      execute: async (
        input: unknown
      ) => {
        const title =
          textArg(
            input,
            "title",
            180
          ) ||
          "Proposed remediation";

        const summary =
          textArg(
            input,
            "summary",
            600
          ) ||
          "Agent requested human review.";

        const risk =
          riskArg(input);

        getContext()
          .requestApproval(
            title,
            summary,
            risk
          );

        return json({
          status:
            "pending_human_approval",

          title,
          risk,

          executed: false
        });
      }
    }
  ];

  try {
    await Promise.all(
      tools.map(
        (tool) =>
          modelContext.registerTool(
            tool as RegisterableTool,
            {
              signal:
                controller.signal
            }
          )
      )
    );

    onStatus("ready");
  } catch (error) {
    if (
      !controller.signal.aborted
    ) {
      console.error(
        "TraceDesk WebMCP registration failed",
        error
      );

      onStatus("error");
    }
  }

  return () =>
    controller.abort();
}
