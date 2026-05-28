# Next steps — implementation roadmap

Consolidated plan for moving from demo shell to production-style flows. Edit checkboxes as you complete work.

---

## How this file connects to the rest of `docs/`

### By roadmap section → primary references

| § | Topic | Main docs (read in this order) | Code / data |
|---|--------|---------------------------------|-------------|
| **0** | Backend gate | [BACKEND_AUTH.md](BACKEND_AUTH.md) (stack), [STORAGE.md](STORAGE.md) | `backend/schema.sql` |
| **1** | Live data & storage | [STORAGE.md](STORAGE.md), [BACKEND_AUTH.md](BACKEND_AUTH.md), [ACCESS_MODEL.md](ACCESS_MODEL.md) §3–6 (RLS + capabilities), [QR_CHECKIN.md](QR_CHECKIN.md) (check-in API) | `src/lib/supabase.ts`, `src/api/client.ts`, screens under `src/screens/` |
| **2** | Boot / splash / The Dalton Grant Academy | [UI_INVENTORY.md](UI_INVENTORY.md) (wiring status) | `App.tsx`, `BrandedBootScreen.tsx`, `GrantAccessScreen.tsx` |
| **3** | Auth & onboarding | [BACKEND_AUTH.md](BACKEND_AUTH.md), [ACCESS_MODEL.md](ACCESS_MODEL.md) §1–3, [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md) | `src/auth/AuthContext.tsx`, `src/lib/supabase.ts` |
| **4** | Paywall | [MONETIZATION.md](MONETIZATION.md), [REVENUECAT.md](REVENUECAT.md), [ACCESS_MODEL.md](ACCESS_MODEL.md) §7 (monetization alignment) | `src/subscriptions/`, `subscription_state` in `schema.sql` |
| **5** | Demo → real content | [UI_INVENTORY.md](UI_INVENTORY.md), [ACCESS_MODEL.md](ACCESS_MODEL.md) (who can post / sponsor), [MONETIZATION.md](MONETIZATION.md) (free baseline) | `src/data/*`, mock blocks in screens |
| **6** | Store / devices | [STORE_RELEASE.md](STORE_RELEASE.md), [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md) (EAS, store keys) | `eas.json`, `app.json` |
| **7** | Testing & safety | [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md), Shannon (below), [INTEGRATIONS.md](INTEGRATIONS.md) (Stripe/webhooks surface) | CI, staging URLs |

### By doc → where it shows up in this roadmap

| Doc | Role |
|-----|------|
| [ACCESS_MODEL.md](ACCESS_MODEL.md) | **§1, §3, §4, §5** — RLS, roles, stacked grants, `getEffectiveAccess`, sponsor rules vs paywall. |
| [MONETIZATION.md](MONETIZATION.md) | **§4, §5** — entitlements, free baseline, B2B sponsor revenue; informs ACCESS_MODEL matrix. |
| [BACKEND_AUTH.md](BACKEND_AUTH.md) | **§0–§1, §3** — Supabase auth, env, API layer vs demo mode. |
| [STORAGE.md](STORAGE.md) | **§1** — buckets, `media_assets`, upload pattern. |
| [REVENUECAT.md](REVENUECAT.md) | **§4** — app keys, entitlement id, Expo Go vs dev build. |
| [INTEGRATIONS.md](INTEGRATIONS.md) | **§1** (Stripe/events), calendar phases; webhook secrets in [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md). |
| [QR_CHECKIN.md](QR_CHECKIN.md) | **§1** — server verify + staff UI; ticket secret handling. |
| [STORE_RELEASE.md](STORE_RELEASE.md) | **§6** — EAS profiles, TestFlight / Play internal. |
| [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md) | **§3–§7** — every external key; never commit. |
| [UI_INVENTORY.md](UI_INVENTORY.md) | **§2, §5** — what is wired vs `comingSoon` as backend lands. |

### Suggested reading order (new contributor)

1. [BACKEND_AUTH.md](BACKEND_AUTH.md) → [ACCESS_MODEL.md](ACCESS_MODEL.md) → [MONETIZATION.md](MONETIZATION.md)  
2. This file (**NEXT_STEPS.md**) for ordered execution  
3. [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md) before touching production projects  

---

## 0. Backend choice (gate before heavy build)

The repo is **Supabase-first** — see [BACKEND_AUTH.md](BACKEND_AUTH.md) and `backend/schema.sql`. “Live” events/media/sync can be delivered as:

- **Recommended:** Supabase **Postgres + Realtime subscriptions** + **Storage** + RLS (ties directly to [ACCESS_MODEL.md](ACCESS_MODEL.md) §6 checklist and [STORAGE.md](STORAGE.md)).
- **Alternative:** Migrate to **Firebase** — contradicts current `schema.sql` / `supabase.ts`; treat as greenfield data migration.

**Decision:** ☐ Extend Supabase ☐ Migrate to Firebase — record date / owner: _______________

---

## 1. Live data & storage

- [ ] Finish **RLS policies** for `profiles`, `posts`, `media_assets`, `events`, `bookings`, etc. (stubs in `schema.sql`; rules must match [ACCESS_MODEL.md](ACCESS_MODEL.md) capability matrix once §8 decisions are filled).
- [ ] Configure **Storage** buckets + policies — [STORAGE.md](STORAGE.md); align paths with [ACCESS_MODEL.md](ACCESS_MODEL.md) (visibility, sponsor assets).
- [ ] Replace in-screen **mock arrays** with Supabase queries (Community, Media, Events, Sponsors) + optional **realtime** channels.
- [ ] Add **seed** SQL or scripts for first sponsors, events, posts, media metadata (sponsor rules: [ACCESS_MODEL.md](ACCESS_MODEL.md) §5–6).
- [ ] Point `apiFetch` / Edge Functions at staging for secrets-heavy ops: [QR_CHECKIN.md](QR_CHECKIN.md) verify, Stripe/RevenueCat webhooks ([INTEGRATIONS.md](INTEGRATIONS.md), [REVENUECAT.md](REVENUECAT.md)).

---

## 2. Boot / splash / The Dalton Grant Academy

- [ ] Add **animated logo** (Rive in **development/EAS build** — [STORE_RELEASE.md](STORE_RELEASE.md); or Lottie/video if Expo Go-only) on `BrandedBootScreen`.
- [ ] Replace fixed `MIN_BOOT_MS`-only logic with an **orchestrator**: `max(minAnimationMs, fontsReady, authReady, optionalPrefetchReady)`; then **fade spinner**; then show **Continue** (`GrantAccessScreen` — “Tap anywhere to continue” today). Track UX in [UI_INVENTORY.md](UI_INVENTORY.md) when done.
- [ ] Optional: remote min splash duration (Supabase row / Edge Function) — same staging project as [BACKEND_AUTH.md](BACKEND_AUTH.md).

**Code touchpoints:** `App.tsx`, `src/components/BrandedBootScreen.tsx`, `src/screens/GrantAccessScreen.tsx`.

---

## 3. Auth & onboarding

- [ ] Wire **Apple / Google** via Supabase Auth — [BACKEND_AUTH.md](BACKEND_AUTH.md), secrets in [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md).
- [ ] Trim **demo** copy and `DEMO_EMAIL` path when staging is default.
- [ ] Align session + **access profile** with [ACCESS_MODEL.md](ACCESS_MODEL.md) §6 (`getEffectiveAccess`) and [MONETIZATION.md](MONETIZATION.md) §5 (technical mapping).

---

## 4. Paywall (RevenueCat)

- [ ] Map store products to entitlements — [MONETIZATION.md](MONETIZATION.md) §3–4; keep staff vs paid separate per [ACCESS_MODEL.md](ACCESS_MODEL.md) §1 principle 5.
- [ ] **Webhook** → `subscription_state` (server truth) — [REVENUECAT.md](REVENUECAT.md), [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md).
- [ ] Gate **actions** (not whole tabs) in UI — [MONETIZATION.md](MONETIZATION.md) §2; test on dev build / TestFlight ([REVENUECAT.md](REVENUECAT.md), [STORE_RELEASE.md](STORE_RELEASE.md)).

---

## 5. Demo removal & real content

- [ ] Remove or flag `src/data/*` and large mock blocks (optional `EXPO_PUBLIC_*` for design QA only).
- [ ] Ship **first real** sponsors, events, media, posts — respect [ACCESS_MODEL.md](ACCESS_MODEL.md) (who can post / appear on sponsor surfaces) and [MONETIZATION.md](MONETIZATION.md) (free baseline).
- [ ] Update [UI_INVENTORY.md](UI_INVENTORY.md) as flows go live.

---

## 6. iOS / Android release hygiene

Expo-focused release path: **EAS Build**, TestFlight / Play internal — [STORE_RELEASE.md](STORE_RELEASE.md). Align credentials with [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md). Native Xcode-only workflows apply only if you eject or add custom native modules.

- [ ] EAS project + development builds for Rive / Purchases as needed ([REVENUECAT.md](REVENUECAT.md)).
- [ ] TestFlight / internal testing checklist complete.

---

## 7. Testing & safety

### 7.1 App-level (always)

- [ ] **Unit:** helpers (`ticketToken`, env) — see [QR_CHECKIN.md](QR_CHECKIN.md) for token contract.
- [ ] **Integration:** Supabase **staging** with RLS on ([ACCESS_MODEL.md](ACCESS_MODEL.md) §6).
- [ ] **E2E:** Maestro or Detox on **EAS-built** binaries ([STORE_RELEASE.md](STORE_RELEASE.md)); not only Expo Go.
- [ ] **Dependency / secret hygiene:** `npm audit`, no keys in repo — [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md).

### 7.2 Shannon — autonomous pentest (staging / owned targets only)

The **[unicodeveloper/shannon](https://github.com/unicodeveloper/shannon)** skill wraps **[Keygraph Shannon](https://github.com/keygraphhq/shannon)** (AGPL-3.0): white-box security testing with **real exploits** and PoCs — **only against systems you own or have written authorization to test. Never production without explicit approval.**

Use against **staging** APIs/web that implement rules from [ACCESS_MODEL.md](ACCESS_MODEL.md) and [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md) (no live keys in client).

**Install (from Shannon README):**

```bash
npx skills add unicodeveloper/shannon
```

**Claude Code usage (examples):**

```text
/shannon http://localhost:3000 myapp
/shannon --scope=xss,injection http://localhost:8080 frontend
/shannon status
/shannon results
```

**Prerequisites:** Docker (or Podman), Git, AI provider credentials (e.g. `ANTHROPIC_API_KEY`). Local targets from containers often use `http://host.docker.internal:PORT` (see [Shannon README](https://github.com/unicodeveloper/shannon)).

**How to use for Dalton:**

1. Deploy **staging** API + web (if any) reachable from the pentest runtime.
2. Configure **authenticated** flows via Shannon’s YAML target config (login URL, test user, success conditions, `avoid` / `focus` paths) per [Shannon README](https://github.com/unicodeveloper/shannon).
3. Run scoped passes first (`--scope=...`), then broader runs as confidence grows.
4. Track findings in your issue tracker; retest after fixes.

**License note:** Shannon engine is **AGPL-3.0** — ensure compliance if you fork or redistribute tooling.

### 7.3 Supplementary community practice

For **skill/plugin supply chain** when using third-party Claude plugins, follow safe-install guidance in marketplaces such as [jeremylongshore/claude-code-plugins-plus-skills](https://github.com/jeremylongshore/claude-code-plugins-plus-skills). For **structured QA test plans**, adapt patterns from [daymade/claude-code-skills](https://github.com/daymade/claude-code-skills) to RN/Expo checklists that cover [UI_INVENTORY.md](UI_INVENTORY.md) flows.

---

## 8. Changelog

| Date | Note |
|------|------|
| | Initial roadmap + Shannon (unicodeveloper/shannon) |
| | Document map + cross-links to all major `docs/` files |
