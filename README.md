# TraceDesk

**Agent-native incident response for humans and AI agents.**

TraceDesk is a WebMCP-powered incident response workspace built for the OpenAI WebMCP Challenge. Humans investigate through a polished operations dashboard while browser agents use structured tools against the same incident state.

TraceDesk can also run one bounded OpenAI API analysis over incident evidence, cache the result locally, propose a remediation plan, and place consequential actions behind an explicit human approval gate.

> Research/demo software. TraceDesk does not connect to production infrastructure and does not execute deployments, rollbacks, configuration changes, restarts, credential changes, or traffic shifts.

## Why WebMCP

A normal browser agent may need to visually interpret buttons, tables, tabs, and forms.

TraceDesk instead exposes incident-response capabilities directly through WebMCP:

- `list_incidents`
- `select_incident`
- `get_active_incident`
- `get_service_health`
- `search_logs`
- `get_recent_changes`
- `get_runbook`
- `analyze_incident`
- `add_hypothesis`
- `add_timeline_event`
- `get_customer_update`
- `request_remediation_approval`

The agent can gather evidence, reason, and update the workspace without guessing how to click through the UI.

High-risk remediation remains human-gated and no production action is implemented.

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

## Repository structure

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

## Local setup

Requirements:

- Node.js 20.9+
- npm

Install:

```bash
npm install
```

Create your private environment file:

```bash
cp .env.example .env.local
```

Set your real OpenAI key inside `.env.local`:

```bash
OPENAI_API_KEY=sk-proj-your-real-tracedesk-key
OPENAI_MODEL=gpt-5.6-luna

TRACEDESK_RATE_WINDOW_MINUTES=15
TRACEDESK_RATE_MAX_REQUESTS=6
TRACEDESK_DAILY_MAX_REQUESTS=20
TRACEDESK_COOLDOWN_SECONDS=12
```

Never use:

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

## Favicon

`npm install` automatically executes:

```bash
node scripts/generate-favicon.mjs
```

That produces:

```text
app/favicon.ico
```

The ICO contains both 16x16 and 32x32 favicon images.

The generated binary is intentionally ignored by Git because Vercel regenerates it during dependency installation.

The source logo remains public at:

```text
public/tracedesk-mark.svg
```

## Validate before deployment

Run:

```bash
npm run typecheck
npm run build
```

Do not deploy until both commands complete successfully.

## GitHub

Create a public repository named:

```text
tracedesk
```

The repository must include:

```text
README.md
LICENSE
all source files
all required assets
setup instructions
```

The MIT license in this repository contains:

```text
Copyright (c) 2026 Niko DiCarlo
```

The product footer also contains:

```text
© 2026 Niko DiCarlo
```

## Vercel deployment

1. Push the repository to GitHub.
2. Open Vercel.
3. Choose **Add New → Project**.
4. Import the `tracedesk` GitHub repository.
5. Vercel should detect Next.js automatically.
6. Open the project's Environment Variables.
7. Add the variables below.
8. Deploy.

### Required Vercel environment variables

```text
OPENAI_API_KEY=sk-proj-your-tracedesk-project-key
OPENAI_MODEL=gpt-5.6-luna
```

### Recommended abuse-control environment variables

```text
TRACEDESK_RATE_WINDOW_MINUTES=15
TRACEDESK_RATE_MAX_REQUESTS=6
TRACEDESK_DAILY_MAX_REQUESTS=20
TRACEDESK_COOLDOWN_SECONDS=12
```

Use the variables for:

```text
Production
Preview
Development
```

as appropriate.

## OpenAI billing protection

Use a dedicated OpenAI API project/key for TraceDesk if possible.

Keep your organization hard spend limit enabled.

Recommended architecture:

```text
Browser
   ↓
POST /api/analyze
   ↓
Vercel server
   ↓
OPENAI_API_KEY environment variable
   ↓
OpenAI Responses API
```

Never:

```text
Browser
   ↓
OpenAI directly with exposed API key
```

## API-cost and abuse controls

TraceDesk deliberately avoids autonomous model loops.

A successful fresh AI investigation performs exactly:

```text
1 OpenAI Responses API request
```

The application includes:

- `gpt-5.6-luna` by default
- server-side secret only
- no browser-visible OpenAI key
- one model call per fresh analysis
- browser `localStorage` cache after success
- same-incident in-flight request deduplication
- server cooldown
- rolling-window request cap
- daily per-client request cap
- per-instance global circuit breaker
- input clipping
- payload-size limits
- structured output schema
- 1,100 max output tokens
- low reasoning effort
- 15-second SDK timeout
- only one SDK retry
- cross-site browser request rejection
- no model tool-call loop
- no infrastructure execution capability

The serverless in-memory limiter is defense-in-depth and can reset when serverless instances change.

Therefore your enforced OpenAI organization/project spend limit is the final billing backstop.

## WebMCP

TraceDesk registers structured tools through:

```typescript
document.modelContext.registerTool(...)
```

The application also contains a compatibility fallback for older preview environments that expose:

```typescript
navigator.modelContext
```

The top-right status badge changes to:

```text
WebMCP ready
```

when TraceDesk detects the API and successfully registers the tools.

## WebMCP tool design

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

### AI-analysis tool

```text
analyze_incident
```

### Shared-workspace mutation tools

```text
select_incident
add_hypothesis
add_timeline_event
request_remediation_approval
```

### Deliberately absent production tools

TraceDesk does NOT implement:

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

## Testing WebMCP

Deploy over HTTPS before final judging tests.

Open the Vercel deployment in the WebMCP-capable browser used by the challenge.

Confirm the top-right badge reads:

```text
WebMCP ready
```

If it says:

```text
WebMCP not enabled
```

use the challenge-supported ChatGPT in-app browser or the required WebMCP-enabled Chrome environment.

## Built-in incidents

TraceDesk includes three deterministic investigation environments:

```text
INC-2041
Checkout failures after payment deploy
```

```text
INC-2098
Authentication latency spike
```

```text
INC-2130
API 500s on document export
```

These provide reliable demo evidence while allowing the AI and external agent to perform actual investigation.

## Import arbitrary evidence

Click:

```text
Import evidence
```

Paste previously unseen incident evidence.

Example:

```text
12:02 INFO api-service deploy v3.4.1 complete
12:04 ERROR api-service DB_HOST could not resolve: db-prod-internal
12:04 WARN api-service connection retries exhausted attempts=5
12:05 INFO postgres-primary health probe OK latency=18ms
12:06 ERROR api-service startup failed stage=database_init
```

Create the incident.

TraceDesk gives imported evidence a deterministic local incident ID based on the supplied content.

There is no built-in root cause for imported evidence.

Then click:

```text
AI investigate
```

That makes one bounded Responses API request and returns:

- summary
- root cause
- confidence
- confidence band
- evidence
- remediation steps
- human-approval requirements
- customer-facing update
- caveats

## Important cache behavior

After a successful analysis, TraceDesk caches the result in:

```text
localStorage
```

The cache key is based on the incident ID.

Therefore:

```text
Reset workspace
```

clears the visible workspace but intentionally does NOT delete the AI cache.

This means rehearsing or rerecording a built-in incident does not automatically spend more API tokens.

To force a genuinely fresh model call:

```text
Import different evidence
```

or manually clear the site's local storage.

## Killer demo prompt

Click:

```text
Copy agent prompt
```

TraceDesk copies:

```text
Investigate the active incident using TraceDesk's WebMCP tools. Inspect service health, search the most relevant logs, review recent deployments and configuration changes, and read the runbook. Determine the most likely root cause, add a hypothesis and timeline event to the shared workspace, then request human approval for the safest remediation. Do not claim to execute production changes.
```

Paste that into the WebMCP-capable agent.

## Ideal external-agent tool sequence

The agent may choose its own exact sequence, but the strongest demo resembles:

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

## Killer demo guide — target 2:20

### 0:00–0:18

Start on:

```text
INC-2041
```

Say:

```text
TraceDesk is an agent-native incident response workspace. Humans investigate through this operations dashboard, while AI agents get structured WebMCP tools against the exact same incident state.
```

Show:

- failing checkout service
- red error logs
- recent deployment
- config change
- empty hypothesis panel
- empty human approval state

### 0:18–0:30

Say:

```text
Instead of forcing the agent to visually figure out which buttons to click, TraceDesk exposes the actual incident-response capabilities directly through WebMCP.
```

Click:

```text
Copy agent prompt
```

Paste it into the WebMCP-capable agent.

### 0:30–1:15

Let the browser agent investigate.

The visual story you want:

```text
agent reads incident
↓
agent checks service health
↓
agent searches logs
↓
agent reviews deployment/config changes
↓
agent reads runbook
↓
agent runs one bounded TraceDesk AI analysis
↓
agent writes a hypothesis into the shared UI
↓
agent adds a timeline event
↓
agent creates human approval request
```

Do not talk over every tool call.

Let the state-changing moments breathe.

### 1:15–1:35

When the human approval card appears, say:

```text
The agent has autonomy to investigate, not autonomy to break production. Any consequential remediation is converted into explicit human approval.
```

Click:

```text
Approve plan
```

Then point out:

```text
Approved by human. This demo still executes no external infrastructure action.
```

### 1:35–2:10

Now prove the AI isn't hardcoded.

Click:

```text
Import evidence
```

Paste:

```text
12:02 INFO api-service deploy v3.4.1 complete
12:04 ERROR api-service DB_HOST could not resolve: db-prod-internal
12:04 WARN api-service connection retries exhausted attempts=5
12:05 INFO postgres-primary health probe OK latency=18ms
12:06 ERROR api-service startup failed stage=database_init
```

Click:

```text
Create incident
```

Then:

```text
AI investigate
```

Say:

```text
This incident did not exist in TraceDesk's source dataset. TraceDesk sends one bounded evidence snapshot to the OpenAI Responses API, receives structured incident analysis, and caches the successful result locally so replaying the demo does not keep spending tokens.
```

### 2:10–2:25

Close with:

```text
WebMCP isn't a chatbot bolted onto TraceDesk. It's the interface that lets agents reliably collaborate inside the same application state as the human.
```

Stop.

Do not pad the video to three minutes.

## Demo recording rules for yourself

Before recording:

```text
1. Verify Vercel production deployment.
2. Verify WebMCP badge says ready.
3. Open INC-2041.
4. Reset workspace.
5. Keep OpenAI billing hard limit enabled.
6. Close unrelated tabs.
7. Set browser zoom so the dashboard fits cleanly.
8. Prepare the agent prompt.
9. Prepare the custom evidence in your clipboard.
10. Do one rehearsal.
11. Record the clean take.
```

## Devpost "Built with"

For this exact codebase use:

```text
TypeScript
Next.js
React
WebMCP
OpenAI API
Vercel
GitHub
JavaScript
```

Do NOT tag Tailwind unless you later add Tailwind.

This implementation uses plain CSS.

## Suggested Devpost elevator pitch

```text
AI incident response where humans and agents investigate outages together through WebMCP, turning logs, deployments and config changes into evidence, root causes and safe remediation plans.
```

## Pre-submission checklist

```text
[ ] Public GitHub repository
[ ] MIT LICENSE detected by GitHub
[ ] README visible
[ ] © 2026 Niko DiCarlo visible in footer
[ ] TraceDesk™ visible discreetly
[ ] favicon renders
[ ] Vercel production URL works without login
[ ] OPENAI_API_KEY exists only in Vercel / .env.local
[ ] Real API key is NOT in GitHub
[ ] OpenAI hard spend limit remains enabled
[ ] npm run typecheck succeeds
[ ] npm run build succeeds
[ ] WebMCP badge says ready in judging browser
[ ] list_incidents works
[ ] get_active_incident works
[ ] get_service_health works
[ ] search_logs works
[ ] get_recent_changes works
[ ] get_runbook works
[ ] analyze_incident works
[ ] add_hypothesis changes UI
[ ] add_timeline_event changes UI
[ ] request_remediation_approval changes UI
[ ] approval buttons work
[ ] no production action executes
[ ] Import evidence works
[ ] fresh imported incident receives real AI analysis
[ ] Reset workspace works
[ ] YouTube demo is public
[ ] YouTube demo is under 3 minutes
[ ] YouTube demo has audio
[ ] Devpost live URL added
[ ] Devpost GitHub URL added
[ ] Devpost story completed
[ ] Devpost YouTube URL added
[ ] Final submission completed before deadline
```

## Final architecture

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
                   ┌───────────────┴─────────────────┐
                   │                                 │
                   ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │ Browser / React UI  │          │ /api/analyze        │
        │                     │          │ server route        │
        │ Incident state      │          │                     │
        │ Logs                │          │ private env key     │
        │ Hypotheses          │          └──────────┬──────────┘
        │ Timeline            │                     │
        │ Approval gate       │                     ▼
        └──────────┬──────────┘          ┌─────────────────────┐
                   │                     │ OpenAI Responses API│
                   │                     │ gpt-5.6-luna        │
                   │                     │ 1 bounded response  │
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

## Safety model

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

## License

MIT.

© 2026 Niko DiCarlo.

TraceDesk™.
