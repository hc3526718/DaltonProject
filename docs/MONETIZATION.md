# Monetization — planning doc

Aligns with `**ACCESS_MODEL.md**` (trust, staff roles, stacked grants) and `**backend/schema.sql**` (`subscription_state`, `entitlement_ids`). Implementation notes: `**docs/REVENUECAT.md**`, app wiring in `src/subscriptions/`. **Roadmap:** `**docs/NEXT_STEPS.md`** §4–§5.

---

## 1. Product goal

- **Minimum:** **Free users can use every main section** (Community, Media, Events, Sponsors, Profile) at a **meaningful baseline** — navigation and core value are not paywalled away.
- **Paid:** **Extra access** per section (limits, creator tools, placement, quality-of-life) — paywall the **verb** (create, upload, boost, host) more than the **noun** (the tab itself).

---

## 2. Principles

1. **Server truth** — `subscription_state` (and webhooks) drive entitlements; RLS / APIs enforce; client only guides UX.
2. **Separate from staff** — `admin` / `super_admin` bypass or operate on different rules; don’t double-charge staff for moderation tools.
3. **Compose with verification** — e.g. “post media” might require **(entitlement OR verified coach OR admin)**; document each rule in `ACCESS_MODEL.md` matrix once decided.
4. **Avoid hollow free tier** — if baseline is too weak, acquisition suffers; if too strong, conversion suffers. Tune **limits** (counts, duration, resolution) rather than hiding whole pillars.

---

## 3. Models (pick or blend)

### A. Single “Pro” bundle

- One subscription unlocks a **package** of upgrades across sections.
- Simplest ops and messaging; use `is_pro` + optional `entitlement_ids` still listing `premium` only.

### B. Pro + section entitlements (recommended for “monetise each area”)

- RevenueCat (or store) **multiple entitlements**, mirrored in `subscription_state.entitlement_ids`.
- Examples (names are placeholders — rename in product):


| Entitlement (example id) | Rough purpose                                              |
| ------------------------ | ---------------------------------------------------------- |
| `premium`                | Cross-cutting perks (badge, reduced ads, priority support) |
| `creator_media`          | Post/upload media to feed beyond free quota                |
| `events_host`            | Create / manage bookable events or meetings                |
| `sponsor_featured`       | Featured placement or analytics on sponsor surfaces        |
| `coach_tools`            | Scheduling, extended profile, host dashboards              |


Free users still **open** each area; specific actions check `**entitlement_ids` ∪ `is_pro`** (if you fold some into Pro-only).

### C. B2B / sponsor revenue (orthogonal)

- **Sponsor directory** may charge **listing fees**, **featured slots**, or **rev-share**, with Dalton approval (`sponsor_endorsements`) as the **trust** gate and money as the **commercial** gate — can be Stripe Checkout outside RevenueCat.

---

## 4. Section brainstorm (edit to fit Dalton)


| Section       | Free (baseline)                   | Paid / upsell (examples)                                    |
| ------------- | --------------------------------- | ----------------------------------------------------------- |
| **Community** | Read feed, basic interaction      | Creator posting, media uploads, longer video, pinned posts  |
| **Media**     | Browse catalog, standard playback | Full library tier, offline/background, HD                   |
| **Events**    | Discover, book public/free events | Paid classes, **host/create** events, waitlist priority     |
| **Sponsors**  | Browse directory                  | **Featured** listing, analytics, verified partner placement |
| **Profile**   | Basic profile                     | Pro badge, extended links, coach-specific layouts           |


---

## 5. Technical mapping

- **Table:** `public.subscription_state` — `is_pro`, `entitlement_ids text[]`, `updated_at`, webhook `raw` jsonb.
- **Client:** `SubscriptionContext` / paywall screen — extend to read **specific entitlements** when you add products in RevenueCat.
- **Access resolver:** `getEffectiveAccess(user_id)` should merge **entitlements** with staff role and profile flags (see `ACCESS_MODEL.md` §6).

---

## 6. Open decisions (fill in together)

1. **Bundle vs à la carte:** ☐ One Pro only ☐ Pro + add-ons ☐ Add-ons only after Pro
2. **Free posting:** ☐ None ☐ Limited (N posts/mo) ☐ Requires verification only, no pay
3. **Sponsor money:** ☐ Subscription only ☐ Listing fee ☐ Hybrid **Your notes:**
4. **Trials / intro offers:** _______________

---

## 7. Changelog


| Date                | Change |
| ------------------- | ------ |
| *(add as you edit)* |        |


