# MCP servers for Dalton / The Dalton Grant Academy (Cursor)

Recommended integrations for this repo. Pin versions in `.cursor/mcp.json`; review any config change (MCPoison / CurXecute mitigations require Cursor ≥ 1.3.9).

## Already connected (use these)

| MCP | Use in this project |
|-----|---------------------|
| **Supabase** | Security advisors, SQL, migrations, Edge Function deploy/list, logs |
| **RevenueCat** | Entitlements, offerings, webhooks, App Store / Web Billing apps |
| **Sentry** (plugin) | Production errors, release health |
| **Vercel** (plugin) | Deployments, env vars |
| **cursor-ide-browser** | QA marketing site + `/app` OAuth flows |

## High value to add

| MCP | Why | Category |
|-----|-----|----------|
| **GitHub** | PRs, issues, CI status, release tags | Delivery |
| **Stripe** (official or community) | Verify products/prices/webhooks match `stripe-*` Edge Functions | Billing |
| **Figma** | Align app UI with marketing / brand | Visual |
| **Playwright MCP** | Automated E2E on web export (`/app`, checkout return URLs) | QA |
| **Linear** (optional) | Task ↔ PR linkage if you use Linear | Process |

Browse installs: [cursor.directory/mcp](https://cursor.directory/mcp)

## Security & analysis

| MCP / tool | Why |
|------------|-----|
| **Supabase `get_advisors` (security)** | RLS, definer RPCs, leaked-password protection — run after every migration |
| **Sentry workflow skill** | Triage prod crashes with stack traces |
| **Semgrep / CodeQL** (CI, not always MCP) | Static analysis on PRs |
| **gstack `/cso` or `/review`** | Repo security pass; complements Supabase advisors |

Do **not** put service role keys, Stripe secret keys, or RC secret API keys into MCP env blocks committed to git.

## MCP hygiene

1. **Least privilege** — read-only DB role for schema exploration; write only when needed.
2. **Pin packages** — `npx -y @scope/pkg@1.2.3`, not `@latest`.
3. **Separate configs** — project `.cursor/mcp.json` vs global `~/.cursor/mcp.json`.
4. **Re-approve** — Cursor re-prompts when MCP commands change; do not skip review on shared repos.

## Billing verification checklist (RevenueCat + Supabase MCP)

1. `list-webhook-integrations` → URL must be `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`
2. `list-entitlements` → App Store products attached to `premium` and/or `Grant Access Pro`
3. `list_edge_functions` → `revenuecat-webhook`, `stripe-webhook`, `stripe-create-checkout` ACTIVE
4. `get_advisors` security → fix new lints after DDL
5. Supabase secret `REVENUECAT_WEBHOOK_AUTHORIZATION` matches RC webhook Authorization header

See `REVENUECAT_BILLING_SETUP.md`.
