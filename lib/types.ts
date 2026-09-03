export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3";
export type IncidentStatus = "Investigating" | "Monitoring" | "Resolved";
export type ServiceStatus = "healthy" | "degraded" | "down";
export type LogLevel = "INFO" | "WARN" | "ERROR";
export type ConfidenceBand = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  errorRatePct: number;
}

export interface LogEntry {
  id: string;
  time: string;
  service: string;
  level: LogLevel;
  message: string;
}

export interface Deployment {
  id: string;
  time: string;
  service: string;
  version: string;
  actor: string;
  summary: string;
}

export interface ConfigChange {
  id: string;
  time: string;
  service: string;
  key: string;
  actor: string;
  summary: string;
}

export interface TimelineEvent {
  id: string;
  time: string;
  label: string;
  detail: string;
  source: "system" | "human" | "agent";
}

export interface RunbookStep {
  id: string;
  title: string;
  detail: string;
  risk: RiskLevel;
}

export interface Incident {
  id: string;
  title: string;
  subtitle: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  owner: string;
  affectedService: string;
  summary: string;
  services: ServiceHealth[];
  logs: LogEntry[];
  deployments: Deployment[];
  configChanges: ConfigChange[];
  timeline: TimelineEvent[];
  runbook: RunbookStep[];
  isImported?: boolean;
}

export interface EvidenceFinding {
  finding: string;
  source: string;
}

export interface RemediationStep {
  step: string;
  risk: RiskLevel;
  requiresHumanApproval: boolean;
}

export interface AnalysisResult {
  summary: string;
  rootCause: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  evidence: EvidenceFinding[];
  remediation: RemediationStep[];
  customerUpdate: string;
  caveats: string[];
}

export interface Hypothesis {
  id: string;
  title: string;
  confidence: number;
  rationale: string;
  evidence: string[];
  source: "human" | "agent";
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  summary: string;
  risk: RiskLevel;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
}

export interface WorkspaceState {
  hypotheses: Hypothesis[];
  timelineAdditions: TimelineEvent[];
  analysis: AnalysisResult | null;
  approval: ApprovalRequest | null;
  activity: string[];
}

export interface AnalysisApiRequest {
  incident: Incident;
}

export interface AnalysisApiResponse {
  analysis: AnalysisResult;
  model: string;
  cached?: boolean;
}
