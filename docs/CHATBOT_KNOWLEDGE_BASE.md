# The Dalton Grant Academy (The Dalton Grant Academy) — Chatbot knowledge base

**Purpose:** Paste or upload this document into your help bot (ElevenLabs, Intercom, custom RAG, etc.).  
**Product URL:** https://daltongrantacademy.vercel.app  
**Web app:** https://daltongrantacademy.vercel.app/app  
**Last updated:** 2026-05-22

---

## 1. Product identity

**The Dalton Grant Academy** (The Dalton Grant Academy platform) is a performance community app for athletes and creators.

| Area | What users do |
|------|----------------|
| **Community** | Feed, posts, reactions, comments, DMs |
| **Events** | Discover, book, save; hosts run sessions & QR check-in (premium + verified) |
| **Media** | Training / mindset video library; uploads for verified creators |
| **Sponsors** | Partner offers; partnership inquiries (premium) |
| **Profile** | Bio, sports, highlights, results, banner, photo |
| **Premium** | Paid tier + **Dalton verification** for publishing |

**Accounts:** Supabase Auth (email/password, Google, Apple on iOS).  
**Data:** Postgres + Storage + Realtime (community posts).  
**One account everywhere:** Same email on iOS, Android, and web.

---

## 2. Sign in & onboarding

1. Open app or **Login** on https://daltongrantacademy.vercel.app/app  
2. Sign up or log in (email, Google; Apple on iOS)  
3. Complete onboarding: role, sports, discovery source, username  
4. Explore tabs: Community, Media, Sponsors, Events, Profile  

**Forgot password:** Use reset on login screen; check spam.  
**Web OAuth:** Callback at `/app/auth/callback` — cookies/localStorage required.

**Never ask users for:** API keys, service role keys, webhook secrets, master PIN.

---

## 3. Premium & billing (critical)

### One subscription per account

Users must **not** purchase Premium separately on web and mobile for the same account.

| Platform | Purchase path | Backend |
|----------|---------------|---------|
| **Web** | Profile → Premium → Stripe Checkout | `stripe-create-checkout` Edge Function → Stripe webhook → `subscription_state` |
| **iOS / Android** | RevenueCat paywall (App Store / Play) | RevenueCat customer id = **Supabase user id** → webhook should update `subscription_state` |

After payment, premium follows the **signed-in account** (database row `subscription_state.is_pro`), not the device.

### If premium missing after payment

1. Wait 1–2 minutes (webhook delay)  
2. **Web:** Return from Stripe with `?stripe_checkout=success`; tap Refresh status  
3. **Mobile:** Profile → Premium → **Restore purchases** (same email as purchase)  
4. Still missing after 24h → escalate with **account email** + receipt  

### RevenueCat Web Billing (Stripe in RC dashboard)

If web billing is configured in RevenueCat:

- Use the **same Stripe products/prices** linked in RC and in Supabase secrets `STRIPE_PRICE_MONTHLY_ID` / `STRIPE_PRICE_ANNUAL_ID`  
- Ensure **App User ID** in RevenueCat = Supabase `user.id` (app calls `Purchases.logIn(userId)` on native)  
- Configure **RevenueCat → Webhooks** to update server entitlements OR keep **Stripe webhook** on the same Stripe account  

### Demo / test

- Expo Go cannot run real purchases — use TestFlight or production build  
- Demo premium email may exist in dev only — not for production users  

---

## 4. Dalton verification (creator gate)

**Two steps for creator features** (host events, upload media, sponsor proposals):

1. **Premium** (paid) — required first  
2. **Dalton verified** (team approval) — required to publish  

`dalton_verified` **without** premium does **not** unlock creator tools.

**User sees “Awaiting Dalton verification”:** They have premium; review in progress. Do not promise instant approval. Offer Support escalation with account email.

**+ button shows paywall:** Not premium → subscribe first.

---

## 5. Feature guides

### Community

- Pull down to refresh (gold loader)  
- Feed updates via Realtime when online; refetch when app/tab becomes active  
- Create post: + button (where enabled)  
- Report content: use in-app report; escalates to admins  

### Messages

- Inbox from Community icon or messages list  
- Unread counts on threads  
- Offline: read cached threads ~7 days; send requires network  

### Events

- Filters: All, Bookings, Saved, Past, My events  
- Book requires connection  
- Host / QR check-in: premium + verified  

### Media

- Browse categories; Continue Watching when applicable  
- Bookmark = saved library  
- Upload: premium + verification  

### Sponsors

- Browse partners; open detail for links  
- Partnership inquiry: premium; team coordinates via messaging  

### Profile & settings

- Edit profile sections from Profile  
- **Settings → Accessibility:** Larger Text, Differentiate Without Color, Sufficient Contrast; dark UI default; **syncs across devices when signed in**  
- **Settings → Legal:** Terms, Privacy, Cookie policy, Athlete agreement (website)  
- **Settings → Support / Help centre:** guides + web help  

---

## 6. Accessibility (only declare / explain these four)

1. **Larger Text** — in-app toggle, scales text  
2. **Dark Interface** — default experience (always on)  
3. **Differentiate Without Color Alone** — icons/labels/borders, not color-only cues  
4. **Sufficient Contrast** — higher-contrast palette when enabled  

Do **not** claim VoiceOver, captions, reduced motion, or light theme as in-app product features unless shipped.

---

## 7. Legal & customer documents

| Document | URL |
|----------|-----|
| Terms | `/terms` |
| Privacy | `/privacy` |
| Cookies | `/cookie-policy` |
| Athlete agreement | `/athlete-agreement` |
| Help | `/help-center` |
| Contact | `/contact-us` |
| Live assistant | ElevenLabs widget (corner) on marketing pages; `/live-chat` redirects to Help |

In-app: Profile → Settings → Legal / Support.

---

## 8. Troubleshooting playbook

| Symptom | Steps |
|---------|--------|
| Can’t log in | Verify email; network; web cookies; Google redirect URLs in Supabase |
| Paid but not premium | Wait webhook; restore/refresh; same email on all devices |
| Paywall won’t open (mobile) | Not Expo Go — need dev/production build |
| Paywall won’t open (web) | Must be signed in; Stripe Edge Functions deployed |
| Feed stale | Pull refresh; reopen app; check connection |
| Can’t upload photo | Photo permission; network; Storage policy — escalate |
| Duplicate subscription | Explain one account; refund via Apple/Stripe support — escalate |

---

## 9. Escalate to human support

Escalate when:

- Charged twice or wrong plan  
- Premium missing > 24h  
- Account deletion / GDPR  
- Harassment, impersonation, safety  
- Verification dispute  
- Data breach suspicion  

Collect: **account email**, **platform** (web/iOS — Android app not shipped yet), **time**, **screenshot**, **steps**.

**Contact:** Profile → Settings → Support, or the **Contact** form at `/contact-us` on the website. Do **not** quote a public inbox in chat — advise that replies usually arrive within **24–48 hours**.

---

## 10. Security & privacy (assistant boundaries)

- Never reveal internal admin tools, master delete PIN, or service role  
- Never instruct users to disable RLS or share passwords  
- Account deletion: in-app under Profile → Settings (user must cancel Apple/Stripe billing first).

---

## 11. Tone & style

- Clear, calm, athlete-friendly  
- Step-by-step before escalation  
- No legal guarantees; no verification timelines unless ops provides them  
- British/US English neutral  

---

## 12. Quick FAQ

**Q: Is Dalton verified the same as Premium?**  
A: No. Premium is paid. Verification is approval to publish.

**Q: Can I use Premium on web and phone?**  
A: Yes — one subscription per account when webhooks and RevenueCat user id are configured.

**Q: Where are saved events?**  
A: Events → Saved filter.

**Q: How do I delete my account?**  
A: Profile → Settings → Delete account permanently (confirm with DELETE where prompted). Cancel Apple subscriptions or the Stripe billing portal **before** deleting; charges are handled by Apple/Stripe — DGA cannot stop them afterward.

**Q: Where is accessibility?**  
A: Profile → Settings → Accessibility.

---

*Regenerate this file when shipping major releases (billing, deletion, MFA, offline).*
