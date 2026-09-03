# TraceDesk

**Agent-native incident response for humans and AI agents.**

TraceDesk is a WebMCP-powered incident response workspace built for the OpenAI WebMCP Challenge. Humans investigate through an operations dashboard while browser agents use structured tools against the same incident state.

TraceDesk can also run one bounded OpenAI API analysis over incident evidence, cache the result locally, propose a remediation plan, and place consequential actions behind an explicit human approval gate.

## Demo

▶️ **[Watch the 2-minute TraceDesk demo on YouTube](https://www.youtube.com/watch?v=00k_DR66Ymc)**

> **Research/demo software.** TraceDesk does not connect to production infrastructure and does not execute deployments, rollbacks, configuration changes, restarts, credential changes, or traffic shifts.

---

## Why WebMCP

A traditional browser agent may need to visually interpret buttons, tables, tabs, and forms.

TraceDesk instead exposes incident-response capabilities directly through WebMCP.

The agent can:

- discover available incidents
- inspect the active incident
- check service health
- search logs
- review deployments and configuration changes
- read the relevant runbook
- analyze incident evidence
- add a root-cause hypothesis
- add an investigation event to the timeline
- generate a customer-facing update
- request human approval for remediation

The underlying WebMCP tools are:

```text
list_incidents
select_incident
get_active_incident
get_service_health
search_logs
get_recent_changes
get_runbook
analyze_incident
add_hypothesis
add_timeline_event
get_customer_update
request_remediation_approval
```

This allows an agent to gather evidence, reason about an outage, and collaborate inside the same workspace as the human without guessing how to navigate the UI.

---

## Human + Agent Collaboration

TraceDesk is designed around a simple boundary:

```text
Agent investigates
        ↓
Agent gathers evidence
        ↓
Agent forms a hypothesis
        ↓
Agent updates the shared workspace
        ↓
Agent proposes remediation
        ↓
Human approves or rejects
```

The agent has autonomy to investigate.

It does **not** have autonomy to execute production changes.

High-impact remediation remains explicitly human-gated.

---

## Stack

- TypeScript
- Next.js 16
- React 19
- WebMCP Imperative API
- OpenAI Responses API
- Structured Outputs via JSON Schema
- Plain CSS
- Vercel
- GitHub

---

## WebMCP Implementation

TraceDesk registers structured tools through:

```typescript
document.modelContext.registerTool(...)
```

The application also includes a compatibility fallback for older preview environments exposing:

```typescript
navigator.modelContext
```

When the WebMCP API is detected and TraceDesk successfully registers its tools, the application displays:

```text
WebMCP ready
```

---

## WebMCP Tool Design

### Read-only investigation tools

```text
list_incidents
get_active_incident
get_service_health
search_logs
get_recent_changes
get_runbook
get_customer_update
```

### AI analysis

```text
analyze_incident
```

### Shared-workspace mutations

```text
select_incident
add_hypothesis
add_timeline_event
request_remediation_approval
```

### Deliberately absent production tools

TraceDesk does **not** implement tools such as:

```text
rollback_deployment
restart_service
change_secret
change_environment_variable
deploy_release
shift_traffic
delete_resource
execute_shell
```

This is intentional.

The agent may investigate and propose.

The human remains responsible for consequential actions.

---

## Built-in Incidents

TraceDesk includes three deterministic investigation environments.

### INC-2041

```text
Checkout failures after payment deploy
```

### INC-2098

```text
Authentication latency spike
```

### INC-2130

```text
API 500s on document export
```

These provide reliable investigation environments while still requiring the AI or external browser agent to inspect evidence and reason about the incident.

---

## Import Previously Unseen Evidence

TraceDesk is not limited to the three built-in incidents.

Select:

```text
Import evidence
```

and paste incident evidence such as logs, deployment notes, or other operational context.

Example:

```text
12:02 INFO api-service deploy v3.4.1 complete
12:04 ERROR api-service DB_HOST could not resolve: db-prod-internal
12:04 WARN api-service connection retries exhausted attempts=5
12:05 INFO postgres-primary health probe OK latency=18ms
12:06 ERROR api-service startup failed stage=database_init
```

TraceDesk creates a deterministic local incident from the supplied evidence.

Imported incidents do not contain a predetermined root cause.

The evidence can then be investigated through the TraceDesk interface, its bounded OpenAI analysis capability, or by an external WebMCP-capable agent.

---

## Example Agent Prompt

A WebMCP-capable agent can be given:

```text
Investigate the active incident using TraceDesk's WebMCP tools. Inspect service health, search the most relevant logs, review recent deployments and configuration changes, and read the runbook. Determine the most likely root cause, add a hypothesis and timeline event to the shared workspace, then request human approval for the safest remediation. Do not claim to execute production changes.
```

The agent chooses its own exact investigation sequence, but a representative flow is:

```text
get_active_incident
        ↓
get_service_health
        ↓
search_logs
        ↓
get_recent_changes
        ↓
get_runbook
        ↓
analyze_incident
        ↓
add_hypothesis
        ↓
add_timeline_event
        ↓
request_remediation_approval
```

---

## Bounded OpenAI Analysis

TraceDesk also includes an optional server-side incident-analysis capability using the OpenAI Responses API.

A successful fresh analysis performs:

```text
1 OpenAI Responses API request
```

The response contains structured incident analysis including:

- summary
- likely root cause
- confidence
- confidence band
- supporting evidence
- remediation steps
- human-approval requirements
- customer-facing update
- caveats

The built-in AI capability is separate from the external WebMCP browser agent.

A browser agent can reason directly over TraceDesk's structured WebMCP tools, while the built-in analysis endpoint provides an additional bounded analysis path.

---

## API Safety and Cost Controls

TraceDesk deliberately avoids autonomous model loops.

The application includes:

- server-side OpenAI credentials only
- no browser-visible OpenAI API key
- one model call per fresh built-in analysis
- browser `localStorage` caching after success
- same-incident in-flight request deduplication
- server cooldown
- rolling-window request limits
- daily per-client request limits
- per-instance global circuit breaker
- input clipping
- payload-size limits
- structured output schema
- bounded output tokens
- low reasoning effort
- SDK timeout
- limited retry behavior
- cross-site browser request rejection
- no model tool-call loop
- no infrastructure execution capability

The serverless in-memory limiter is defense-in-depth and may reset when serverless instances change.

---

## Cache Behavior

After a successful built-in AI analysis, TraceDesk caches the result in:

```text
localStorage
```

The cache key is based on the incident ID.

Selecting:

```text
Reset workspace
```

clears the visible collaborative workspace but intentionally does not delete the successful AI-analysis cache.

This allows an incident to be revisited without automatically creating another API request.

---

## Architecture

```text
                         ┌────────────────────┐
                         │      GitHub        │
                         │   Public source    │
                         └─────────┬──────────┘
                                   │
                                   │ push
                                   ▼
                         ┌────────────────────┐
                         │      Vercel        │
                         │   Next.js app      │
                         └─────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │ Browser / React UI  │          │ /api/analyze        │
        │                     │          │ server route        │
        │ Incident state      │          │                     │
        │ Logs                │          │ private API key     │
        │ Hypotheses          │          └──────────┬──────────┘
        │ Timeline            │                     │
        │ Approval gate       │                     ▼
        └──────────┬──────────┘          ┌─────────────────────┐
                   │                     │ OpenAI Responses API│
                   │                     │ bounded response    │
                   │                     └─────────────────────┘
                   │
                   │ WebMCP
                   ▼
        ┌─────────────────────┐
        │ Browser AI agent    │
        │                     │
        │ Structured tools    │
        │ not DOM guessing    │
        └─────────────────────┘
```

---

## Safety Model

```text
READ
get_active_incident
search_logs
get_recent_changes
get_service_health
get_runbook

        ↓

REASON
analyze_incident

        ↓

COLLABORATE
add_hypothesis
add_timeline_event

        ↓

PROPOSE
request_remediation_approval

        ↓

HUMAN
Approve / Reject

        ↓

NO PRODUCTION EXECUTION
```

---

## Repository Structure

```text
tracedesk/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── TraceDeskApp.tsx
├── lib/
│   ├── incidents.ts
│   ├── prompt.ts
│   ├── rate-limit.ts
│   ├── types.ts
│   └── webmcp.ts
├── public/
│   └── tracedesk-mark.svg
├── scripts/
│   └── generate-favicon.mjs
├── .env.example
├── .gitignore
├── LICENSE
├── next-env.d.ts
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

---

## Local Setup

### Requirements

- Node.js 20.9+
- npm

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env.local
```

Add your server-side OpenAI configuration:

```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.6-luna

TRACEDESK_RATE_WINDOW_MINUTES=15
TRACEDESK_RATE_MAX_REQUESTS=6
TRACEDESK_DAILY_MAX_REQUESTS=20
TRACEDESK_COOLDOWN_SECONDS=12
```

Never expose the key using:

```text
NEXT_PUBLIC_OPENAI_API_KEY
```

Never commit:

```text
.env.local
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Validate

Before deployment:

```bash
npm run typecheck
npm run build
```

Both commands should complete successfully.

---

## Deployment

TraceDesk is designed for deployment on Vercel.

Required server-side environment variables:

```text
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.6-luna
```

Recommended abuse-control variables:

```text
TRACEDESK_RATE_WINDOW_MINUTES=15
TRACEDESK_RATE_MAX_REQUESTS=6
TRACEDESK_DAILY_MAX_REQUESTS=20
TRACEDESK_COOLDOWN_SECONDS=12
```

The OpenAI API key remains on the server.

Architecture:

```text
Browser
   ↓
POST /api/analyze
   ↓
Vercel server
   ↓
Private OPENAI_API_KEY
   ↓
OpenAI Responses API
```

Not:

```text
Browser
   ↓
Exposed OpenAI API key
```

---

## Testing WebMCP

Open the deployed application over HTTPS using a WebMCP-capable environment such as ChatGPT's in-app browser or a compatible WebMCP-enabled Chrome environment.

Confirm the status indicator reads:

```text
WebMCP ready
```

The registered tools can then be discovered and used by the browser agent.

---

## License

MIT License.

© 2026 Niko DiCarlo.

TraceDesk™.
