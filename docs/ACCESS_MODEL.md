# Access model — planning doc

Use this file to align on **who can do what** before we implement RLS, APIs, and UI gates. Edit sections inline; tick checkboxes when product decisions are final.

**Related:** `docs/NEXT_STEPS.md` (execution order), `backend/schema.sql`, `src/admin/capabilities.ts`, `src/auth/AuthContext.tsx`, `docs/MONETIZATION.md`, `docs/SECRETS_CHECKLIST.md`, `docs/QR_CHECKIN.md`, `docs/REVENUECAT.md`.

---

## 1. Principles

1. **Server is source of truth** — Postgres RLS, Storage policies, and Edge Functions enforce rules. The app only hides or disables UI; it must not be the only guard.
2. **Separate dimensions** — Staff role, paid entitlement, verification, coach license, and sponsor endorsement are **different axes**. Avoid one mega-`role` string for everything.
3. **Mirror capabilities** — Named capabilities in `src/admin/capabilities.ts` should stay aligned with what RLS / Edge Functions actually allow.
4. **Grants stack** — A user’s **effective access** is the **combination** of everything they’ve earned or been given, not a single label. New approvals **add** rights; they don’t replace prior ones unless you explicitly revoke.
5. **Money vs trust** — Subscriptions / entitlements (**see `MONETIZATION.md`**) are separate from Dalton verification and staff roles. Combine them only inside **`getEffectiveAccess`**-style logic, not duplicate paywalls for staff-only actions.

---

## 2. Stacking grants & “overall functions”

Users are not limited to one bucket. Think of **functions** as a **union** of signals:

**Effective access ≈ staff role capabilities ∪ subscription entitlements ∪ verification / coach flags ∪ approved sponsor (and other) endorsements**

### Example lifecycle (coach → business → sponsor page)

| Stage | What happens | What gets added (conceptually) |
|--------|----------------|--------------------------------|
| 1 | Dalton verifies them as a trusted coach | e.g. `profiles.verified_at` / `is_licensed_coach` → allows **post own media** (per your media rule in §8) |
| 2 | They stay a normal `member` in `organization_memberships` | They do **not** need `admin` for coach-only product rules if RLS keys off profile + caps |
| 3 | They start a business and request **sponsor** placement | New row: `sponsor_endorsements` `pending` — **no** sponsor-page visibility yet |
| 4 | Dalton approves sponsor listing | Same user now also has **`sponsor_endorsement_approved`** (capability or queryable state) → **sponsors tab / page** can show them |

So: **posting** and **sponsor display** are **different grants**. Having one does not imply the other; having both means both features light up.

### How this connects to capabilities

- **Staff** (`admin` / `super_admin`): keep using **`capabilities` jsonb** on `organization_memberships` (and/or role → default set in `capabilities.ts`) for moderation, check-in, etc.
- **Non-staff “product” powers** (verified coach, pro, sponsor-approved): implement as either:
  - **Named capabilities** merged at read time (e.g. `post_creator_media`, `listed_as_sponsor_partner`), **or**
  - **Explicit columns / tables** that RLS checks (`verified_at`, `is_licensed_coach`, `sponsor_endorsements.status = approved`), with the app calling one **`getEffectiveAccess(user_id)`** (view/RPC) that returns a single list for UI.

Both approaches work; the important part is **one mental model**: *multiple independent grants, evaluated together*.

### Revocation & expiry

- Document whether sponsor or coach status can **lapse** (expiry date, contract end) and whether that **removes** only sponsor visibility while keeping posting (typical).

---

## 3. Dimensions (identity signals)

| Dimension | Meaning (draft) | Today in repo | To add / decide |
|-----------|-----------------|---------------|-----------------|
| **Org staff role** | Dalton / org operators | `app_role`: `member` \| `admin` \| `super_admin` on `organization_memberships`; metadata `role` on user for demo | Single org vs multi-org default? |
| **Pro (paid)** | Subscription tier | `subscription_state.is_pro` (+ RevenueCat webhook doc) | Which features are **pro-only** vs coach-only vs confirmed-only? → align with **`MONETIZATION.md`** |
| **Confirmed** | Trusted account | Supabase email/phone confirm; optional **Dalton verification** | Define: email only vs `profiles.verified_at` (manual Dalton confirm)? |
| **Licensed coach** | Allowed to act as coach in product | *Not in schema yet* | `profiles.is_licensed_coach` and/or `coach_licenses` table (issuer, expiry, evidence)? |
| **Sponsor attachment** | User linked to a sponsor, Dalton-approved | *Not in schema yet* | `sponsor_endorsements` or similar (`pending` → `approved` by staff)? |

---

## 4. Capability matrix (draft — edit cells)

Legend: ✅ allowed · ❌ denied · 🔶 conditional (note in §8)

| Capability | `super_admin` | `admin` | `member` + **pro** | **Confirmed** (define) | **Licensed coach** | Notes |
|------------|:-------------:|:-------:|:-------------------:|:----------------------:|:------------------:|-------|
| Create / edit / cancel **events** | ✅ | ✅ | ? | ? | ? | Scope by `organization_id`? |
| **Event management** (rosters, comms, cancel slots) | ✅ | ✅ | ? | ? | ? | Creator + admins only? |
| **QR check-in** (scan / accept attendee) | ✅ | ✅ | ? | ? | ? | Usually staff; see `check_in_attendees` |
| **Authoritative QR verify** (API) | ✅ (via secret) | — | — | — | — | Server-only; see `docs/QR_CHECKIN.md` |
| Create **meetings** / bookable offerings | ? | ? | ? | ? | ? | Same as events or separate entity? |
| **Publish** event/meeting so others can book | ? | ? | ? | ? | ? | |
| **Post media** to feed (create post + upload) | ✅ | ✅ | ? | ? | ? | Restrict per product + **`MONETIZATION.md`** |
| **Moderate** posts / users | ✅ | ✅ | ❌ | ❌ | ❌ | `moderate_posts` |
| **Assign roles** / capabilities | ✅ | 🔶 | ❌ | ❌ | ❌ | `assign_roles` |
| **View analytics** | ✅ | ✅ | ❌ | ❌ | ❌ | `view_analytics` |
| **Issue refunds** / **manage billing** | ✅ | 🔶 | ❌ | ❌ | ❌ | `issue_refunds`, `manage_billing` |
| **Request** sponsor link | ? | ? | ? | ? | ? | |
| **Approve** sponsor link (Dalton) | ✅ | 🔶 | ❌ | ❌ | ❌ | Who besides `super_admin`? |
| **Appear on sponsorship page** (approved business) | — | — | 🔶 | 🔶 | 🔶 | Usually **not** role-only: requires **`sponsor_endorsements.approved`** (see §2); may pair with **paid placement** (see `MONETIZATION.md`) |

---

## 5. Sponsor endorsement (planned flow)

1. User submits **request** to associate account with sponsor X → row `status = pending`.
2. Dalton staff reviews in admin tool → `status = approved`, set `approved_at`, `approved_by`.
3. Until approved, UI must not show “official” sponsor endorsement; optional: show “pending”.
4. **RLS:** users read own endorsement rows; public read only `approved` where product allows.

**Tables to design:** `sponsors`, `sponsor_endorsements` (names flexible).

---

## 6. Implementation checklist (engineering, after §8 is decided)

- [ ] Implement **`getEffectiveAccess(user_id)`** (or equivalent view/RPC) that merges: org role defaults, `memberships.capabilities` overrides, `subscription_state` / **entitlements** (see `MONETIZATION.md`), profile flags (`verified_at`, coach), and approved sponsor rows — one object for “overall functions.”
- [ ] Extend `CAPABILITY_KEYS` / `BY_ROLE` in `src/admin/capabilities.ts` **or** introduce server-side “effective capabilities” RPC/view that merges role + `subscription_state` + profile flags.
- [ ] Extend `profiles` (and new tables) in `backend/schema.sql`; migrate Supabase.
- [ ] Write RLS for `posts`, `media_assets`, `events`, `bookings`, endorsements, Storage paths.
- [ ] Edge Functions: QR verify, Stripe/RevenueCat webhooks, sponsor approval if not done in-dashboard only.
- [ ] `AuthContext` (or sibling hook): load **access profile** after session (`profiles`, `subscription_state`, coach + sponsor flags) for UI.

---

## 7. Monetization alignment

Free users should reach **every main section** at a **baseline** level; paid tiers unlock **extra** depth or actions per area — not blank tabs. See **`docs/MONETIZATION.md`** for entitlements, paywall placement, and how that maps to `subscription_state` / RevenueCat.

---

## 8. Open decisions (fill in together)

1. **Coaches without `admin`:** Can licensed coaches create/manage events under Dalton org? ☐ Yes ☐ No ☐ Only their own sub-scope
2. **Media posting rule:** Is it `(pro OR coach OR confirmed OR admin)` or stricter (e.g. pro **and** one of coach/confirmed)? **Your answer:**
3. **QR scanning:** Only staff with `check_in_attendees`, or also **event creator / host coach**? **Your answer:**
4. **Meetings vs events:** Same table (`events` + `type`) or separate `meetings` table? **Your answer:**
5. **“Confirmed” definition:** ☐ Email verified only ☐ Plus Dalton `verified_at` ☐ Other: _______________
6. **Who can approve sponsor links:** ☐ `super_admin` only ☐ `admin` too ☐ Other: _______________
7. **Revocation:** If sponsor approval ends, does coach posting stay unless separately revoked? **Your answer:**

---

## 9. Changelog

| Date | Change |
|------|--------|
| *(add as you edit)* | |
| | §2 stacking grants, coach → sponsor lifecycle, `getEffectiveAccess`, sponsor matrix row, monetization cross-links |
