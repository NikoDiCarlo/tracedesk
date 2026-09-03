"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clipboard,
  Clock3,
  FileSearch,
  Gauge,
  Import,
  LockKeyhole,
  Network,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  X,
  XCircle
} from "lucide-react";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createEmptyWorkspace,
  createImportedIncident,
  createInitialWorkspaceMap,
  DEMO_INCIDENTS
} from "@/lib/incidents";

import {
  registerTraceDeskWebMCP,
  type WebMCPBridgeContext,
  type WebMCPStatus
} from "@/lib/webmcp";

import type {
  AnalysisApiResponse,
  AnalysisResult,
  ApprovalRequest,
  Hypothesis,
  Incident,
  RiskLevel,
  TimelineEvent,
  WorkspaceState
} from "@/lib/types";

const DEMO_PROMPT =
  `Investigate the active incident using TraceDesk's WebMCP tools. Inspect service health, search the most relevant logs, review recent deployments and configuration changes, and read the runbook. Determine the most likely root cause, add a hypothesis and timeline event to the shared workspace, then request human approval for the safest remediation. Do not claim to execute production changes.`;

function nowTime(): string {
  return new Date().toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}

function makeId(
  prefix: string
): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function clampConfidence(
  value: number
): number {
  return Math.max(
    0,
    Math.min(1, value)
  );
}

function isAnalysisResult(
  value: unknown
): value is AnalysisResult {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const item =
    value as Partial<AnalysisResult>;

  return (
    typeof item.summary === "string" &&
    typeof item.rootCause === "string" &&
    typeof item.confidence === "number" &&
    Array.isArray(item.evidence) &&
    Array.isArray(item.remediation) &&
    typeof item.customerUpdate === "string" &&
    Array.isArray(item.caveats)
  );
}

function cacheKey(
  incidentId: string
): string {
  return `tracedesk:analysis:v1:${incidentId}`;
}

function formatErrorRate(
  value: number
): string {
  if (value === 0) {
    return "0%";
  }

  return `${value.toFixed(1)}%`;
}

function Mark() {
  return (
    <div
      className="brand-mark"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
      >
        <path
          d="M7 7.5C7 6.67 7.67 6 8.5 6H23.5C24.33 6 25 6.67 25 7.5V10C25 10.83 24.33 11.5 23.5 11.5H18.5V26C18.5 26.83 17.83 27.5 17 27.5H15C14.17 27.5 13.5 26.83 13.5 26V11.5H8.5C7.67 11.5 7 10.83 7 10V7.5Z"
          fill="#F8FAFF"
        />

        <path
          d="M10 19H15L17 15L20 23L22.5 19H26"
          stroke="#3971FF"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  action
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-title-wrap">
        <h2 className="panel-title">
          {icon}
          {title}
        </h2>

        {subtitle ? (
          <div className="panel-subtitle">
            {subtitle}
          </div>
        ) : null}
      </div>

      {action}
    </div>
  );
}

function WebMCPBadge({
  status
}: {
  status: WebMCPStatus;
}) {
  const label =
    status === "ready"
      ? "WebMCP ready"
      : status === "checking"
        ? "Checking WebMCP"
        : status === "error"
          ? "WebMCP error"
          : "WebMCP not enabled";

  return (
    <div
      className={`status-pill ${status}`}
      title={
        status === "unavailable"
          ? "Use ChatGPT's in-app browser or a WebMCP-enabled Chrome build."
          : undefined
      }
    >
      <span className="status-dot" />
      {label}
    </div>
  );
}

export default function TraceDeskApp() {
  const [
    incidents,
    setIncidents
  ] = useState<Incident[]>(
    DEMO_INCIDENTS
  );

  const [
    activeIncidentId,
    setActiveIncidentId
  ] = useState(
    DEMO_INCIDENTS[0].id
  );

  const [
    workspaces,
    setWorkspaces
  ] = useState<
    Record<
      string,
      WorkspaceState
    >
  >(() =>
    createInitialWorkspaceMap(
      DEMO_INCIDENTS
    )
  );

  const [
    webmcpStatus,
    setWebmcpStatus
  ] =
    useState<WebMCPStatus>(
      "checking"
    );

  const [
    logQuery,
    setLogQuery
  ] = useState("");

  const [
    aiLoading,
    setAiLoading
  ] = useState(false);

  const [
    toast,
    setToast
  ] = useState<{
    message: string;
    type?: "error";
  } | null>(null);

  const [
    importOpen,
    setImportOpen
  ] = useState(false);

  const [
    importTitle,
    setImportTitle
  ] = useState(
    "API errors after deploy"
  );

  const [
    importService,
    setImportService
  ] = useState("api-service");

  const [
    importEvidence,
    setImportEvidence
  ] = useState("");

  const inFlightRef =
    useRef<
      Map<
        string,
        Promise<AnalysisResult>
      >
    >(new Map());

  const incidentsRef =
    useRef(incidents);

  const activeIncidentIdRef =
    useRef(activeIncidentId);

  const workspacesRef =
    useRef(workspaces);

  incidentsRef.current =
    incidents;

  activeIncidentIdRef.current =
    activeIncidentId;

  workspacesRef.current =
    workspaces;

  const activeIncident =
    incidents.find(
      (incident) =>
        incident.id ===
        activeIncidentId
    ) ?? incidents[0];

  const workspace =
    workspaces[
      activeIncident.id
    ] ??
    createEmptyWorkspace();

  const updateWorkspace =
    useCallback(
      (
        incidentId: string,
        updater: (
          current: WorkspaceState
        ) => WorkspaceState
      ) => {
        setWorkspaces(
          (current) => {
            const next = {
              ...current,

              [incidentId]:
                updater(
                  current[
                    incidentId
                  ] ??
                    createEmptyWorkspace()
                )
            };

            workspacesRef.current =
              next;

            return next;
          }
        );
      },
      []
    );

  const applyAnalysis =
    useCallback(
      (
        incidentId: string,
        analysis: AnalysisResult,
        source:
          | "api"
          | "cache"
      ) => {
        updateWorkspace(
          incidentId,
          (current) => {
            if (
              current.analysis
            ) {
              return current;
            }

            const hypothesis: Hypothesis =
              {
                id: makeId(
                  "hyp-ai"
                ),

                title:
                  analysis.rootCause,

                confidence:
                  clampConfidence(
                    analysis.confidence
                  ),

                rationale:
                  analysis.summary,

                evidence:
                  analysis.evidence
                    .map(
                      (item) =>
                        item.finding
                    )
                    .slice(0, 6),

                source:
                  "agent",

                createdAt:
                  nowTime()
              };

            const timelineEvent: TimelineEvent =
              {
                id: makeId(
                  "timeline-ai"
                ),

                time:
                  nowTime(),

                label:
                  source === "cache"
                    ? "AI analysis restored"
                    : "AI analysis completed",

                detail:
                  `${analysis.confidenceBand} confidence root-cause hypothesis added to the workspace.`,

                source:
                  "agent"
              };

            return {
              ...current,

              analysis,

              hypotheses: [
                hypothesis,
                ...current.hypotheses
              ],

              timelineAdditions: [
                ...current.timelineAdditions,
                timelineEvent
              ],

              activity: [
                `${nowTime()} · ${
                  source ===
                  "cache"
                    ? "Restored cached AI analysis"
                    : "AI analysis completed"
                }`,
                ...current.activity
              ].slice(0, 12)
            };
          }
        );
      },
      [
        updateWorkspace
      ]
    );

  const runAIAnalysis =
    useCallback(
      async (): Promise<AnalysisResult> => {
        const incidentList =
          incidentsRef.current;

        const incident =
          incidentList.find(
            (item) =>
              item.id ===
              activeIncidentIdRef.current
          ) ??
          incidentList[0];

        const currentWorkspace =
          workspacesRef.current[
            incident.id
          ] ??
          createEmptyWorkspace();

        if (
          currentWorkspace.analysis
        ) {
          return currentWorkspace.analysis;
        }

        if (
          typeof window !==
          "undefined"
        ) {
          const cached =
            window.localStorage.getItem(
              cacheKey(
                incident.id
              )
            );

          if (cached) {
            try {
              const parsed: unknown =
                JSON.parse(
                  cached
                );

              if (
                isAnalysisResult(
                  parsed
                )
              ) {
                applyAnalysis(
                  incident.id,
                  parsed,
                  "cache"
                );

                setToast({
                  message:
                    "Restored the existing analysis from this browser. No API call was made."
                });

                return parsed;
              }
            } catch {
              window.localStorage.removeItem(
                cacheKey(
                  incident.id
                )
              );
            }
          }
        }

        const existingInFlight =
          inFlightRef.current.get(
            incident.id
          );

        if (
          existingInFlight
        ) {
          return existingInFlight;
        }

        const requestPromise =
          (async () => {
            setAiLoading(true);

            try {
              const response =
                await fetch(
                  "/api/analyze",
                  {
                    method:
                      "POST",

                    headers: {
                      "Content-Type":
                        "application/json"
                    },

                    body:
                      JSON.stringify({
                        incident
                      })
                  }
                );

              const payload =
                (await response
                  .json()
                  .catch(
                    () => ({})
                  )) as Partial<AnalysisApiResponse> & {
                  error?: string;
                  retryAfterSeconds?: number;
                };

              if (
                !response.ok ||
                !payload.analysis ||
                !isAnalysisResult(
                  payload.analysis
                )
              ) {
                throw new Error(
                  payload.error ||
                    "AI analysis failed."
                );
              }

              const analysis =
                payload.analysis;

              if (
                typeof window !==
                "undefined"
              ) {
                try {
                  window.localStorage.setItem(
                    cacheKey(
                      incident.id
                    ),
                    JSON.stringify(
                      analysis
                    )
                  );
                } catch {
                  // localStorage can be unavailable
                  // in strict/private browser modes.
                  // Analysis still works.
                }
              }

              applyAnalysis(
                incident.id,
                analysis,
                "api"
              );

              setToast({
                message:
                  `Analysis complete with ${Math.round(
                    analysis.confidence *
                      100
                  )}% confidence. Result cached locally.`
              });

              return analysis;
            } catch (error) {
              const message =
                error instanceof
                Error
                  ? error.message
                  : "AI analysis failed.";

              setToast({
                message,
                type: "error"
              });

              throw error;
            } finally {
              setAiLoading(
                false
              );
            }
          })();

        inFlightRef.current.set(
          incident.id,
          requestPromise
        );

        try {
          return await requestPromise;
        } finally {
          inFlightRef.current.delete(
            incident.id
          );
        }
      },
      [
        applyAnalysis
      ]
    );

  const selectIncident =
    useCallback(
      (
        incidentId: string
      ): boolean => {
        const exists =
          incidentsRef.current.some(
            (incident) =>
              incident.id ===
              incidentId
          );

        if (exists) {
          activeIncidentIdRef.current =
            incidentId;

          setActiveIncidentId(
            incidentId
          );

          setLogQuery("");
        }

        return exists;
      },
      []
    );

  const searchLogs =
    useCallback(
      (
        query: string,
        service?: string
      ) => {
        const incidentList =
          incidentsRef.current;

        const incident =
          incidentList.find(
            (item) =>
              item.id ===
              activeIncidentIdRef.current
          ) ??
          incidentList[0];

        const q =
          query.toLowerCase();

        const s =
          service?.toLowerCase();

        return incident.logs.filter(
          (log) => {
            const matchesQuery =
              `${log.time} ${log.service} ${log.level} ${log.message}`
                .toLowerCase()
                .includes(q);

            const matchesService =
              !s ||
              log.service
                .toLowerCase()
                .includes(s);

            return (
              matchesQuery &&
              matchesService
            );
          }
        );
      },
      []
    );

  const addHypothesis =
    useCallback(
      (
        input: Omit<
          Hypothesis,
          | "id"
          | "createdAt"
          | "source"
        >
      ): Hypothesis => {
        const hypothesis: Hypothesis =
          {
            ...input,

            id: makeId(
              "hyp-agent"
            ),

            confidence:
              clampConfidence(
                input.confidence
              ),

            source:
              "agent",

            createdAt:
              nowTime()
          };

        updateWorkspace(
          activeIncidentIdRef.current,

          (current) => ({
            ...current,

            hypotheses: [
              hypothesis,
              ...current.hypotheses
            ],

            activity: [
              `${nowTime()} · Agent added a hypothesis`,
              ...current.activity
            ].slice(0, 12)
          })
        );

        setToast({
          message:
            "Agent hypothesis added to the shared workspace."
        });

        return hypothesis;
      },
      [
        updateWorkspace
      ]
    );

  const addTimelineEvent =
    useCallback(
      (
        label: string,
        detail: string
      ): TimelineEvent => {
        const event: TimelineEvent =
          {
            id: makeId(
              "timeline-agent"
            ),

            time:
              nowTime(),

            label,
            detail,

            source:
              "agent"
          };

        updateWorkspace(
          activeIncidentIdRef.current,

          (current) => ({
            ...current,

            timelineAdditions: [
              ...current.timelineAdditions,
              event
            ],

            activity: [
              `${nowTime()} · Agent updated the timeline`,
              ...current.activity
            ].slice(0, 12)
          })
        );

        setToast({
          message:
            "Agent timeline event added."
        });

        return event;
      },
      [
        updateWorkspace
      ]
    );

  const requestApproval =
    useCallback(
      (
        title: string,
        summary: string,
        risk: RiskLevel
      ) => {
        const approval: ApprovalRequest =
          {
            id: makeId(
              "approval"
            ),

            title,
            summary,
            risk,

            status:
              "pending",

            requestedAt:
              nowTime()
          };

        updateWorkspace(
          activeIncidentIdRef.current,

          (current) => ({
            ...current,

            approval,

            activity: [
              `${nowTime()} · Human approval requested`,
              ...current.activity
            ].slice(0, 12)
          })
        );

        setToast({
          message:
            "Agent requested human approval. Nothing was executed."
        });
      },
      [
        updateWorkspace
      ]
    );

  const bridgeRef =
    useRef<WebMCPBridgeContext | null>(
      null
    );

  bridgeRef.current = {
    listIncidents: () =>
      incidentsRef.current,

    getActiveIncident: () => {
      const list =
        incidentsRef.current;

      return (
        list.find(
          (item) =>
            item.id ===
            activeIncidentIdRef.current
        ) ??
        list[0]
      );
    },

    selectIncident,

    getLatestAnalysis: () =>
      workspacesRef.current[
        activeIncidentIdRef.current
      ]?.analysis ??
      null,

    searchLogs,
    runAIAnalysis,
    addHypothesis,
    addTimelineEvent,
    requestApproval
  };

  useEffect(
    () => {
      let disposed =
        false;

      let cleanup:
        | (() => void)
        | undefined;

      void registerTraceDeskWebMCP(
        () => {
          if (
            !bridgeRef.current
          ) {
            throw new Error(
              "TraceDesk bridge is not initialized."
            );
          }

          return bridgeRef.current;
        },

        setWebmcpStatus
      ).then(
        (cleanupFn) => {
          if (disposed) {
            cleanupFn();
          } else {
            cleanup =
              cleanupFn;
          }
        }
      );

      return () => {
        disposed =
          true;

        cleanup?.();
      };
    },
    []
  );

  useEffect(
    () => {
      if (!toast) {
        return;
      }

      const timer =
        window.setTimeout(
          () =>
            setToast(null),
          4600
        );

      return () =>
        window.clearTimeout(
          timer
        );
    },
    [
      toast
    ]
  );

  const visibleLogs =
    useMemo(
      () => {
        if (
          !logQuery.trim()
        ) {
          return activeIncident.logs;
        }

        const query =
          logQuery
            .trim()
            .toLowerCase();

        return activeIncident.logs.filter(
          (log) =>
            `${log.time} ${log.service} ${log.level} ${log.message}`
              .toLowerCase()
              .includes(
                query
              )
        );
      },
      [
        activeIncident.logs,
        logQuery
      ]
    );

  const mergedTimeline =
    useMemo(
      () => [
        ...activeIncident.timeline,
        ...workspace.timelineAdditions
      ],
      [
        activeIncident.timeline,
        workspace.timelineAdditions
      ]
    );

  const copyDemoPrompt =
    async () => {
      try {
        await navigator.clipboard.writeText(
          DEMO_PROMPT
        );

        setToast({
          message:
            "Killer WebMCP demo prompt copied."
        });
      } catch {
        setToast({
          message:
            DEMO_PROMPT
        });
      }
    };

  const resetWorkspace =
    () => {
      updateWorkspace(
        activeIncident.id,
        () =>
          createEmptyWorkspace()
      );

      setLogQuery("");

      setToast({
        message:
          "Workspace reset. The local AI cache remains, so repeating the demo does not automatically spend more API tokens."
      });
    };

  const handleApproval =
    (
      status:
        | "approved"
        | "rejected"
    ) => {
      updateWorkspace(
        activeIncident.id,

        (current) => {
          if (
            !current.approval
          ) {
            return current;
          }

          return {
            ...current,

            approval: {
              ...current.approval,
              status
            },

            timelineAdditions: [
              ...current.timelineAdditions,

              {
                id: makeId(
                  "timeline-human"
                ),

                time:
                  nowTime(),

                label:
                  status ===
                  "approved"
                    ? "Remediation approved"
                    : "Remediation rejected",

                detail:
                  status ===
                  "approved"
                    ? "Human approved the proposed plan in TraceDesk. No external production action was executed by this demo."
                    : "Human rejected the proposed plan. No external action was executed.",

                source:
                  "human"
              }
            ],

            activity: [
              `${nowTime()} · Human ${status} remediation`,
              ...current.activity
            ].slice(0, 12)
          };
        }
      );

      setToast({
        message:
          status ===
          "approved"
            ? "Approved in the workspace. TraceDesk intentionally performs no production change."
            : "Remediation rejected. No production change occurred."
      });
    };

  const importIncident =
    (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !importEvidence.trim()
      ) {
        setToast({
          message:
            "Paste at least one line of evidence first.",
          type: "error"
        });

        return;
      }

      const incident =
        createImportedIncident({
          title:
            importTitle,

          service:
            importService,

          evidence:
            importEvidence
        });

      setIncidents(
        (current) => {
          const exists =
            current.some(
              (item) =>
                item.id ===
                incident.id
            );

          const next =
            exists
              ? current.map(
                  (item) =>
                    item.id ===
                    incident.id
                      ? incident
                      : item
                )
              : [
                  ...current,
                  incident
                ];

          incidentsRef.current =
            next;

          return next;
        }
      );

      setWorkspaces(
        (current) => {
          const next = {
            ...current,

            [incident.id]:
              current[
                incident.id
              ] ??
              createEmptyWorkspace()
          };

          workspacesRef.current =
            next;

          return next;
        }
      );

      activeIncidentIdRef.current =
        incident.id;

      setActiveIncidentId(
        incident.id
      );

      setLogQuery("");
      setImportOpen(false);

      setToast({
        message:
          "Custom incident created. TraceDesk has no predetermined answer for imported evidence."
      });
    };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Mark />

          <div>
            <div className="brand-title">
              TraceDesk
            </div>

            <div className="brand-subtitle">
              Agent-native incident response
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <WebMCPBadge
            status={
              webmcpStatus
            }
          />

          <div
            className="status-pill ready"
            title="The AI route is bounded to one response with local caching and rate limits."
          >
            <LockKeyhole
              size={12}
            />
            Bounded AI
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="hero">
          <div>
            <div className="eyebrow">
              <Network
                size={13}
              />
              Human + agent operations workspace
            </div>

            <h1>
              Incident response, agent-native.
            </h1>

            <p className="hero-copy">
              Investigate outages from one shared workspace.
              Humans use the dashboard; agents use structured
              WebMCP tools against the same incident state.
              AI can analyze evidence and propose a plan,
              while consequential actions stay behind explicit
              human approval.
            </p>
          </div>

          <div className="hero-actions">
            <button
              className="btn"
              onClick={() =>
                setImportOpen(
                  true
                )
              }
            >
              <Import
                size={14}
              />
              Import evidence
            </button>

            <button
              className="btn"
              onClick={
                copyDemoPrompt
              }
            >
              <Clipboard
                size={14}
              />
              Copy agent prompt
            </button>

            <button
              className="btn btn-danger-soft"
              onClick={
                resetWorkspace
              }
            >
              <RefreshCcw
                size={14}
              />
              Reset workspace
            </button>
          </div>
        </section>

        <section
          className="incident-strip"
          aria-label="Incident summary"
        >
          <div>
            <div className="strip-label">
              Active incident
            </div>

            <div
              style={{
                position:
                  "relative"
              }}
            >
              <select
                className="incident-picker"
                value={
                  activeIncident.id
                }
                onChange={(
                  event
                ) =>
                  selectIncident(
                    event.target
                      .value
                  )
                }
                aria-label="Select incident"
              >
                {incidents.map(
                  (incident) => (
                    <option
                      key={
                        incident.id
                      }
                      value={
                        incident.id
                      }
                    >
                      {incident.id}
                      {" · "}
                      {incident.title}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={13}
                style={{
                  position:
                    "absolute",
                  right: 0,
                  top: 2,
                  pointerEvents:
                    "none",
                  color:
                    "#718099"
                }}
              />
            </div>
          </div>

          <div>
            <div className="strip-label">
              Severity
            </div>

            <div
              className={`strip-value sev ${
                activeIncident.severity ===
                "SEV-1"
                  ? "sev-1"
                  : activeIncident.severity ===
                      "SEV-2"
                    ? "sev-2"
                    : "sev-3"
              }`}
            >
              <span className="sev-dot" />
              {activeIncident.severity}
            </div>
          </div>

          <div>
            <div className="strip-label">
              Status
            </div>

            <div className="strip-value">
              {activeIncident.status}
            </div>
          </div>

          <div>
            <div className="strip-label">
              Started
            </div>

            <div className="strip-value">
              {activeIncident.startedAt}
            </div>
          </div>

          <div>
            <div className="strip-label">
              Owner
            </div>

            <div className="strip-value">
              {activeIncident.owner}
            </div>
          </div>
        </section>

        <section className="grid">
          <div className="left-column">
            <article className="panel">
              <PanelHeader
                icon={
                  <Gauge
                    size={14}
                    color="#6f8cff"
                  />
                }
                title="Service health"
                subtitle={
                  activeIncident.subtitle
                }
                action={
                  activeIncident.isImported
                    ? (
                        <span className="confidence-chip">
                          Imported evidence
                        </span>
                      )
                    : undefined
                }
              />

              <div className="panel-body">
                <div className="service-grid">
                  {activeIncident.services.map(
                    (service) => (
                      <div
                        className="service-card"
                        key={
                          service.name
                        }
                      >
                        <div className="service-card-top">
                          <div
                            className="service-name"
                            title={
                              service.name
                            }
                          >
                            {service.name}
                          </div>

                          <span
                            className={`health-dot ${service.status}`}
                            title={
                              service.status
                            }
                          />
                        </div>

                        <div className="service-metrics">
                          <div className="metric">
                            <strong>
                              {service.latencyMs
                                ? `${service.latencyMs}ms`
                                : "—"}
                            </strong>

                            <span>
                              latency
                            </span>
                          </div>

                          <div className="metric">
                            <strong>
                              {formatErrorRate(
                                service.errorRatePct
                              )}
                            </strong>

                            <span>
                              errors
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </article>

            <article className="panel">
              <PanelHeader
                icon={
                  <SquareTerminal
                    size={14}
                    color="#62d4ff"
                  />
                }
                title="Live evidence"
                subtitle={`${activeIncident.logs.length} log / evidence lines available to humans and agents`}
                action={
                  <div className="logs-toolbar">
                    <div className="searchbox">
                      <Search
                        size={12}
                        color="#627089"
                      />

                      <input
                        value={
                          logQuery
                        }
                        onChange={(
                          event
                        ) =>
                          setLogQuery(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="Filter evidence..."
                        aria-label="Filter logs"
                      />
                    </div>
                  </div>
                }
              />

              <div className="log-table">
                {visibleLogs.length
                  ? visibleLogs.map(
                      (log) => (
                        <div
                          className="log-row"
                          key={
                            log.id
                          }
                        >
                          <div className="log-time">
                            {log.time}
                          </div>

                          <div
                            className="log-service"
                            title={
                              log.service
                            }
                          >
                            {log.service}
                          </div>

                          <div
                            className={`log-level ${log.level}`}
                          >
                            {log.level}
                          </div>

                          <div className="log-message">
                            {log.message}
                          </div>
                        </div>
                      )
                    )
                  : (
                      <div className="panel-body empty-state">
                        No evidence matches “
                        {logQuery}
                        ”.
                      </div>
                    )}
              </div>
            </article>

            <div className="two-up">
              <article className="panel">
                <PanelHeader
                  icon={
                    <ServerCog
                      size={14}
                      color="#9a7cff"
                    />
                  }
                  title="Recent changes"
                  subtitle="Deployments + configuration context"
                />

                <div className="panel-body">
                  <div className="change-list">
                    {activeIncident.deployments.map(
                      (
                        deployment
                      ) => (
                        <div
                          className="change-item"
                          key={
                            deployment.id
                          }
                        >
                          <div className="change-meta">
                            <span>
                              {deployment.time}
                              {" · deployment"}
                            </span>

                            <span>
                              {deployment.version}
                            </span>
                          </div>

                          <div className="change-title">
                            {deployment.service}
                          </div>

                          <div className="change-detail">
                            {deployment.summary}
                          </div>
                        </div>
                      )
                    )}

                    {activeIncident.configChanges.map(
                      (change) => (
                        <div
                          className="change-item"
                          key={
                            change.id
                          }
                        >
                          <div className="change-meta">
                            <span>
                              {change.time}
                              {" · config"}
                            </span>

                            <span>
                              {change.actor}
                            </span>
                          </div>

                          <div className="change-title">
                            {change.key}
                          </div>

                          <div className="change-detail">
                            {change.summary}
                          </div>
                        </div>
                      )
                    )}

                    {!activeIncident.deployments.length &&
                    !activeIncident.configChanges.length
                      ? (
                          <div className="empty-state">
                            No deployment or configuration
                            records were supplied with this
                            imported incident.
                          </div>
                        )
                      : null}
                  </div>
                </div>
              </article>

              <article className="panel">
                <PanelHeader
                  icon={
                    <Clock3
                      size={14}
                      color="#62d4ff"
                    />
                  }
                  title="Incident timeline"
                  subtitle="Shared state changes are visible here"
                />

                <div className="panel-body">
                  <div className="timeline-list">
                    {mergedTimeline.map(
                      (event) => (
                        <div
                          className="timeline-item"
                          key={
                            event.id
                          }
                        >
                          <div className="timeline-meta">
                            <span>
                              {event.time}
                            </span>

                            <span>
                              {event.source}
                            </span>
                          </div>

                          <div className="timeline-title">
                            {event.label}
                          </div>

                          <div className="timeline-detail">
                            {event.detail}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </article>
            </div>
          </div>

          <aside className="right-column">
            <article className="panel ai-card">
              <PanelHeader
                icon={
                  <Sparkles
                    size={14}
                    color="#7f99ff"
                  />
                }
                title="TraceDesk AI"
                subtitle="Single bounded analysis · cached after success"
                action={
                  workspace.analysis
                    ? (
                        <span className="confidence-chip">
                          Analyzed
                        </span>
                      )
                    : undefined
                }
              />

              {workspace.analysis
                ? (
                    <div className="ai-result">
                      <div className="ai-root-cause">
                        <div className="ai-label">
                          Most likely root cause
                        </div>

                        <strong>
                          {workspace.analysis.rootCause}
                        </strong>

                        <div className="confidence-row">
                          <div className="confidence-track">
                            <div
                              className="confidence-bar"
                              style={{
                                width:
                                  `${Math.round(
                                    clampConfidence(
                                      workspace.analysis.confidence
                                    ) *
                                      100
                                  )}%`
                              }}
                            />
                          </div>

                          <div className="confidence-value">
                            {Math.round(
                              clampConfidence(
                                workspace.analysis.confidence
                              ) *
                                100
                            )}
                            %
                            {" · "}
                            {workspace.analysis.confidenceBand}
                          </div>
                        </div>
                      </div>

                      <div className="evidence-list">
                        {workspace.analysis.evidence.map(
                          (
                            evidence,
                            index
                          ) => (
                            <div
                              className="evidence-item"
                              key={`${evidence.source}-${index}`}
                            >
                              <span className="evidence-icon">
                                <Check
                                  size={11}
                                />
                              </span>

                              <span>
                                {evidence.finding}

                                <span className="evidence-source">
                                  {evidence.source}
                                </span>
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                : (
                    <div className="ai-empty">
                      <div className="ai-orb">
                        <Bot
                          size={20}
                        />
                      </div>

                      <h3>
                        Analyze the evidence once.
                      </h3>

                      <p>
                        TraceDesk sends a bounded evidence
                        snapshot to the server, requests one
                        structured response, then caches the
                        result in this browser. No autonomous
                        API loop is implemented.
                      </p>

                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          void runAIAnalysis()
                        }
                        disabled={
                          aiLoading
                        }
                      >
                        {aiLoading
                          ? (
                              <span className="spinner" />
                            )
                          : (
                              <FileSearch
                                size={14}
                              />
                            )}

                        {aiLoading
                          ? "Investigating…"
                          : "AI investigate"}
                      </button>
                    </div>
                  )}
            </article>

            <article className="panel">
              <PanelHeader
                icon={
                  <CircleDot
                    size={14}
                    color="#f2c15e"
                  />
                }
                title="Hypotheses"
                subtitle="Agent findings become reviewable workspace state"
              />

              <div className="panel-body">
                <div className="hypothesis-list">
                  {workspace.hypotheses.length
                    ? workspace.hypotheses.map(
                        (
                          hypothesis
                        ) => (
                          <div
                            className={`hypothesis-card ${hypothesis.source}`}
                            key={
                              hypothesis.id
                            }
                          >
                            <div className="hypothesis-meta">
                              <span>
                                {hypothesis.source}
                                {" · "}
                                {hypothesis.createdAt}
                              </span>

                              <span>
                                {hypothesis.evidence.length}
                                {" evidence items"}
                              </span>
                            </div>

                            <div className="hypothesis-title-row">
                              <div className="hypothesis-title">
                                {hypothesis.title}
                              </div>

                              <span className="confidence-chip">
                                {Math.round(
                                  hypothesis.confidence *
                                    100
                                )}
                                %
                              </span>
                            </div>

                            <div className="hypothesis-rationale">
                              {hypothesis.rationale}
                            </div>
                          </div>
                        )
                      )
                    : (
                        <div className="empty-state">
                          No hypotheses yet. An external
                          agent can call{" "}
                          <strong>
                            add_hypothesis
                          </strong>
                          , or TraceDesk AI will add one
                          after analysis.
                        </div>
                      )}
                </div>
              </div>
            </article>

            <article className="panel">
              <PanelHeader
                icon={
                  <ShieldCheck
                    size={14}
                    color="#66d7ad"
                  />
                }
                title="Response plan"
                subtitle="Recommendations only — production execution is out of scope"
              />

              <div className="panel-body">
                {workspace.analysis
                  ? (
                      <>
                        <div className="plan-list">
                          {workspace.analysis.remediation.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                className="plan-item"
                                key={`${item.step}-${index}`}
                              >
                                <div className="plan-index">
                                  {index + 1}
                                </div>

                                <div>
                                  <div className="plan-title">
                                    {item.step}
                                  </div>

                                  <div className="plan-detail">
                                    {item.requiresHumanApproval
                                      ? "Human approval required before any production action."
                                      : "Safe verification / review step."}
                                  </div>
                                </div>

                                <span
                                  className={`risk-chip ${item.risk}`}
                                >
                                  {item.risk}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div className="customer-update">
                          <div className="ai-label">
                            Draft customer update
                          </div>

                          {workspace.analysis.customerUpdate}
                        </div>
                      </>
                    )
                  : (
                      <div className="plan-list">
                        {activeIncident.runbook.map(
                          (
                            step,
                            index
                          ) => (
                            <div
                              className="plan-item"
                              key={
                                step.id
                              }
                            >
                              <div className="plan-index">
                                {index + 1}
                              </div>

                              <div>
                                <div className="plan-title">
                                  {step.title}
                                </div>

                                <div className="plan-detail">
                                  {step.detail}
                                </div>
                              </div>

                              <span
                                className={`risk-chip ${step.risk}`}
                              >
                                {step.risk}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                {workspace.approval
                  ? (
                      <div
                        className="approval-banner"
                        style={{
                          marginTop:
                            12
                        }}
                      >
                        <div className="approval-top">
                          <div>
                            <div className="ai-label">
                              Human approval gate
                            </div>

                            <div className="approval-title">
                              {workspace.approval.title}
                            </div>
                          </div>

                          <span
                            className={`risk-chip ${workspace.approval.risk}`}
                          >
                            {workspace.approval.risk}
                          </span>
                        </div>

                        <div className="approval-copy">
                          {workspace.approval.summary}
                        </div>

                        {workspace.approval.status ===
                        "pending"
                          ? (
                              <div className="approval-actions">
                                <button
                                  className="btn"
                                  onClick={() =>
                                    handleApproval(
                                      "rejected"
                                    )
                                  }
                                >
                                  <XCircle
                                    size={13}
                                  />
                                  Reject
                                </button>

                                <button
                                  className="btn btn-primary"
                                  onClick={() =>
                                    handleApproval(
                                      "approved"
                                    )
                                  }
                                >
                                  <CheckCircle2
                                    size={13}
                                  />
                                  Approve plan
                                </button>
                              </div>
                            )
                          : (
                              <div
                                className="approval-copy"
                                style={{
                                  color:
                                    workspace.approval.status ===
                                    "approved"
                                      ? "#70d9ad"
                                      : "#ff949d"
                                }}
                              >
                                {workspace.approval.status ===
                                "approved"
                                  ? "Approved by human. This demo still executes no external infrastructure action."
                                  : "Rejected by human. No external action occurred."}
                              </div>
                            )}
                      </div>
                    )
                  : (
                      <div
                        className="empty-state"
                        style={{
                          marginTop:
                            10
                        }}
                      >
                        The WebMCP tool{" "}
                        <strong>
                          request_remediation_approval
                        </strong>
                        {" "}can create a visible
                        approval gate here without
                        executing anything.
                      </div>
                    )}
              </div>
            </article>
          </aside>
        </section>
      </main>

      <footer className="footer">
        <span>
          <strong>
            TraceDesk™
          </strong>
          {" · "}
          Research/demo software for the OpenAI WebMCP Challenge.
        </span>

        <span>
          © 2026 Niko DiCarlo · No production actions are executed.
        </span>
      </footer>

      {importOpen
        ? (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(
                event
              ) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  setImportOpen(
                    false
                  );
                }
              }}
            >
              <form
                className="modal"
                onSubmit={
                  importIncident
                }
              >
                <div className="modal-header">
                  <div>
                    <h2>
                      Import arbitrary incident evidence
                    </h2>

                    <p>
                      Use this in the demo to prove the AI
                      is reasoning over evidence that was
                      not hardcoded into TraceDesk.
                    </p>
                  </div>

                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setImportOpen(
                        false
                      )
                    }
                    aria-label="Close import modal"
                  >
                    <X
                      size={14}
                    />
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="import-title">
                        Incident title
                      </label>

                      <input
                        id="import-title"
                        value={
                          importTitle
                        }
                        onChange={(
                          event
                        ) =>
                          setImportTitle(
                            event
                              .target
                              .value
                          )
                        }
                        maxLength={90}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="import-service">
                        Affected service
                      </label>

                      <input
                        id="import-service"
                        value={
                          importService
                        }
                        onChange={(
                          event
                        ) =>
                          setImportService(
                            event
                              .target
                              .value
                          )
                        }
                        maxLength={50}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="import-evidence">
                      Logs / notes / deployment evidence
                    </label>

                    <textarea
                      id="import-evidence"
                      value={
                        importEvidence
                      }
                      onChange={(
                        event
                      ) =>
                        setImportEvidence(
                          event.target.value.slice(
                            0,
                            12_000
                          )
                        )
                      }
                      placeholder={`12:02 INFO api-service deploy v3.4.1 complete\n12:04 ERROR api-service DB_HOST could not resolve\n12:04 WARN api-service connection retries exhausted\n12:05 INFO database health probe OK`}
                    />

                    <div className="field-help">
                      Maximum 12,000 characters. Imported
                      evidence is treated as untrusted data
                      by the server prompt, not as instructions.
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setImportOpen(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="btn btn-primary"
                    type="submit"
                  >
                    <ArrowRight
                      size={14}
                    />
                    Create incident
                  </button>
                </div>
              </form>
            </div>
          )
        : null}

      {toast
        ? (
            <div
              className={`toast ${
                toast.type ===
                "error"
                  ? "error"
                  : ""
              }`}
              role="status"
            >
              {toast.type ===
              "error"
                ? (
                    <AlertTriangle
                      size={15}
                      color="#ff7f89"
                    />
                  )
                : (
                    <Activity
                      size={15}
                      color="#6f8cff"
                    />
                  )}

              <span>
                {toast.message}
              </span>
            </div>
          )
        : null}
    </div>
  );
}
