# TraceDesk

**Agent-native incident response for humans and AI agents.**

TraceDesk is a WebMCP-powered incident response workspace built for the OpenAI WebMCP Challenge.

Humans investigate incidents through an operations dashboard while AI agents use structured WebMCP tools against the same incident state. Agents can inspect evidence, form hypotheses, update the shared workspace, and propose remediation while consequential actions remain under human control.

## Live App

**https://tracedesk.vercel.app**

## Demo

▶️ **[Watch the 2-minute TraceDesk demo on YouTube](https://www.youtube.com/watch?v=00k_DR66Ymc)**

> **Research/demo software.** TraceDesk does not connect to production infrastructure and does not execute deployments, rollbacks, restarts, credential changes, configuration changes, or traffic shifts.

---

## Why WebMCP

Traditional browser agents may need to visually interpret buttons, tables, tabs, and page structure before they can interact with an application.

TraceDesk exposes incident-response capabilities directly through WebMCP.

Instead of guessing how to navigate the interface, an agent can use structured tools to:

- discover incidents
- inspect the active incident
- check service health
- search logs
- review deployments and configuration changes
- read runbooks
- analyze incident evidence
- add hypotheses
- add timeline events
- generate customer-facing updates
- request human approval for remediation

The agent and the human work against the same incident state.

---

## Human + Agent Collaboration

TraceDesk is designed around a clear boundary:

```text
INCIDENT
   ↓
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
   ↓
NO PRODUCTION EXECUTION
```

Agents have autonomy to investigate.

They do not have autonomy to make production changes.

This allows AI agents to participate meaningfully in incident response without removing the human from consequential decisions.

---

## WebMCP Tools

TraceDesk exposes the following tools:

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

### Investigation tools

```text
list_incidents
get_active_incident
get_service_health
search_logs
get_recent_changes
get_runbook
get_customer_update
```

### Analysis

```text
analyze_incident
```

### Shared-workspace actions

```text
select_incident
add_hypothesis
add_timeline_event
request_remediation_approval
```

---

## WebMCP Implementation

TraceDesk registers its tools using the WebMCP imperative API:

```typescript
document.modelContext.registerTool(...)
```

A compatibility fallback is also included for preview environments exposing:

```typescript
navigator.modelContext
```

When WebMCP is available and the tools are registered successfully, TraceDesk displays:

```text
WebMCP ready
```

---

## What an Agent Can Do

A WebMCP-capable agent can investigate an incident through a sequence such as:

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

The exact sequence is chosen by the agent.

TraceDesk does not require the agent to infer its capabilities from visual page elements.

---

## Human Approval Gate

TraceDesk deliberately separates investigation from execution.

An agent can identify a likely root cause and propose a remediation plan through:

```text
request_remediation_approval
```

The proposal becomes visible in the shared workspace.

A human can then:

```text
Approve
```

or:

```text
Reject
```

Approval records the human decision inside TraceDesk.

It does **not** execute an infrastructure action.

---

## Deliberately Absent Production Tools

TraceDesk does not expose tools such as:

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

The agent can investigate and propose.

The human remains responsible for consequential production actions.

---

## Built-In Incidents

TraceDesk includes three deterministic incident environments.

### INC-2041

**Checkout failures after payment deploy**

### INC-2098

**Authentication latency spike**

### INC-2130

**API 500s on document export**

Each incident contains operational evidence that can be investigated through the dashboard and WebMCP tools.

---

## Import Previously Unseen Evidence

TraceDesk is not limited to its built-in incidents.

Users can select:

```text
Import evidence
```

and provide evidence from a different incident.

For example:

```text
12:02 INFO api-service deploy v3.4.1 complete
12:04 ERROR api-service DB_HOST could not resolve: db-prod-internal
12:04 WARN api-service connection retries exhausted attempts=5
12:05 INFO postgres-primary health probe OK latency=18ms
12:06 ERROR api-service startup failed stage=database_init
```

TraceDesk creates a local incident from the supplied evidence.

Imported incidents do not contain a predetermined root cause.

The evidence can then be investigated by a WebMCP-capable browser agent or by TraceDesk's bounded built-in AI analysis.

---

## Example Agent Prompt

A WebMCP-capable agent can be asked:

```text
Investigate the active incident using TraceDesk's WebMCP tools. Inspect service health, search the most relevant logs, review recent deployments and configuration changes, and read the runbook. Determine the most likely root cause, add a hypothesis and timeline event to the shared workspace, then request human approval for the safest remediation. Do not claim to execute production changes.
```

This demonstrates the full collaboration loop:

```text
Read evidence
     ↓
Reason
     ↓
Update workspace
     ↓
Propose remediation
     ↓
Human approval
```

---

## Built-In AI Analysis

TraceDesk also includes an optional server-side incident analysis capability using the OpenAI Responses API.

A fresh built-in analysis performs one bounded model request over the supplied incident evidence and returns structured data including:

- incident summary
- likely root cause
- confidence
- supporting evidence
- remediation steps
- human-approval requirements
- customer-facing update
- caveats

This built-in analysis is separate from the external WebMCP browser agent.

The external agent can investigate through WebMCP directly, while the built-in analysis provides an additional evidence-analysis path inside TraceDesk.

---

## AI Safety and Cost Controls

TraceDesk deliberately avoids autonomous model loops.

The built-in analysis path includes:

- server-side OpenAI credentials
- no browser-visible API key
- one model request per fresh analysis
- structured JSON output
- bounded output size
- request cooldowns
- rolling request limits
- daily per-client limits
- payload-size limits
- input clipping
- request deduplication
- local caching after successful analysis
- SDK timeout and limited retry behavior
- no infrastructure execution capability

Successful analysis results are cached locally so revisiting the same incident does not automatically trigger another model request.

---

## Architecture

```text
                          ┌────────────────────┐
                          │       GitHub       │
                          │    Public source   │
                          └─────────┬──────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │       Vercel       │
                          │     Next.js app    │
                          └─────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
         ┌─────────────────────┐        ┌─────────────────────┐
         │ Browser / React UI  │        │    /api/analyze     │
         │                     │        │    server route     │
         │ Incident state      │        │                     │
         │ Logs                │        │ Private API key     │
         │ Hypotheses          │        └──────────┬──────────┘
         │ Timeline            │                   │
         │ Approval gate       │                   ▼
         └──────────┬──────────┘        ┌─────────────────────┐
                    │                   │ OpenAI Responses API│
                    │                   │  bounded analysis   │
                    │                   └─────────────────────┘
                    │
                    │ WebMCP
                    ▼
         ┌─────────────────────┐
         │ Browser AI Agent    │
         │                     │
         │ Structured tools    │
         │ Shared app state    │
         └─────────────────────┘
```

---

## Stack

- TypeScript
- Next.js 16
- React 19
- WebMCP Imperative API
- OpenAI Responses API
- JSON Schema structured outputs
- Plain CSS
- Vercel
- GitHub

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

- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure the server-side OpenAI API:

```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=your-openai-model

TRACEDESK_RATE_WINDOW_MINUTES=15
TRACEDESK_RATE_MAX_REQUESTS=6
TRACEDESK_DAILY_MAX_REQUESTS=20
TRACEDESK_COOLDOWN_SECONDS=12
```

Do not expose the OpenAI key using:

```text
NEXT_PUBLIC_OPENAI_API_KEY
```

Do not commit:

```text
.env.local
```

Start the application:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## Validate

Run:

```bash
npm run typecheck
npm run build
```

Both commands should complete successfully before deployment.

---

## Deployment

TraceDesk is deployed as a Next.js application on Vercel.

The built-in AI endpoint uses server-side environment variables:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

Optional rate-control configuration:

```text
TRACEDESK_RATE_WINDOW_MINUTES
TRACEDESK_RATE_MAX_REQUESTS
TRACEDESK_DAILY_MAX_REQUESTS
TRACEDESK_COOLDOWN_SECONDS
```

The OpenAI API key remains server-side.

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

---

## Testing WebMCP

Open the deployed application using ChatGPT's in-app browser or another compatible WebMCP-enabled browser environment.

The production URL is:

**https://tracedesk.vercel.app**

Confirm the TraceDesk status indicator displays:

```text
WebMCP ready
```

A compatible browser agent can then discover and use TraceDesk's registered WebMCP tools.

---

## License

MIT License.

© 2026 Niko DiCarlo.

TraceDesk™.
