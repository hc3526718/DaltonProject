# The Dalton Grant Academy — ElevenLabs agent knowledge base

**Scope:** App product information only. Do not discuss topics outside this product (no general chat, politics, unrelated services, or internal admin secrets).

**Web app:** [https://daltongrantacademy.vercel.app/app](https://daltongrantacademy.vercel.app/app)  
**Marketing site:** [https://daltongrantacademy.vercel.app](https://daltongrantacademy.vercel.app)  
**Last updated:** 2026-05-27

---

## Product identity

**The Dalton Grant Academy** is a performance community platform for athletes and creators.


| Area          | What users do                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| **Community** | Feed, posts, reactions, comments, direct messages                                                    |
| **Events**    | Discover, book, save; hosts create sessions and use QR check-in (premium + Dalton verified)          |
| **Media**     | Training and mindset video library; uploads for verified creators                                    |
| **Sponsors**  | Partner listings and partnership inquiries (premium)                                                 |
| **Profile**   | Bio, sports, highlights, results, banner, profile photo                                              |
| **Premium**   | Paid subscription (**Grant Access Pro** entitlement) for creator tools after **Dalton verification** |


**Accounts:** Supabase Auth — email/password, Google on web; email/password, Google, and Apple on iOS.  
**One account on all devices:** Same email on web and iOS carries your profile and subscription in `subscription_state`. **Android is not released yet.**

---

## Sign in and onboarding

1. Open the app or web **Login** at `/app`.
2. **Welcome:** Sign up, log in, Continue with Google, Continue with Apple (iOS).
3. After email sign-up, confirm email if prompted, then log in.
4. Complete **onboarding:** role, sports, discovery source, username.

**Forgot password:** Use **Log In → Forgot password**; check spam if the reset email does not arrive.

**Web OAuth callback:** `/app/auth/callback` — cookies and localStorage must be allowed.

---

## Premium and Dalton verification

### Two steps for creator features

1. **Premium subscription** (paid) — required first.
2. **Dalton verification** — automatic approval (usually ~24–48 hours after subscribing) required before creator tools activate. Nothing separate to submit.

`dalton_verified` **without** premium does **not** unlock creator tools.

### Purchasing premium


| Platform | Path                                                         |
| -------- | ------------------------------------------------------------ |
| **Web**  | Profile → Premium → Stripe Checkout                          |
| **iOS**  | RevenueCat paywall (App Store)                               |

**Android:** not shipped yet.


**One subscription per account** — do not buy separately on web and mobile for the same email. After payment, wait 1–2 minutes, then refresh or use **Restore purchases** on iOS.

### If the + button shows a paywall

The user is not premium. Subscribe on web (Stripe Checkout) or on iPhone (App Store).

### If the user sees “Awaiting Dalton verification”

The user has Grant Access Pro but verification has not landed yet. Creator tools stay locked until automatic verification completes (~24–48 hours after purchase).

### Restore purchases (iOS)

Profile → Premium → **Restore purchases**. Use the same email as the original purchase.

## Main tabs

### Community

- Scroll the feed; pull down to refresh (gold circular loader).
- Create posts where enabled (text and images).
- Messages and notifications from the Community area.
- Report content via in-app report.

### Events

- Filters: All, Booked, Saved, Past, **My events** (premium).
- **+** create event: premium + Dalton verification required.
- Book events; hosts use QR check-in when verified.

### Media

- Browse category chips.
- **Continue Watching** when the user started a video and did not finish.
- **Bookmark** opens the saved library.
- **+** upload: premium + Dalton verification.

### Sponsors

- Browse partner listings.
- **+** partnership inquiry: premium required; coordination with the Dalton team.

### Profile and settings

- Edit profile sections: basic info, photo, banner, bio, interests, highlights, recent results.
- **Settings → Accessibility:** Larger Text (1×–3×), Differentiate Without Color Alone, Sufficient Contrast; dark interface is default; prefs sync when signed in.
- **Settings → Legal:** Terms, Privacy, Cookie policy, Athlete agreement (website links).
- **Settings → Support / Help centre:** in-app and web guides.

---

## Web vs mobile


| Feature             | Web                | iOS                |
| ------------------- | ------------------ | ------------------ |
| Sign in             | Email, Google      | Email, Google, Apple |
| Premium             | Stripe Checkout    | RevenueCat / App Store |
| Video upload        | More limited       | Full library picker |

---

## Accessibility (in-app — four features only)

1. **Larger Text**
2. **Dark Interface** (default)
3. **Differentiate Without Color Alone**
4. **Sufficient Contrast**

Do not describe VoiceOver, captions, reduced motion, or light theme as shipped product features.

---

## Legal pages (website)


| Document          | Path                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terms             | `/terms`                                                                                                                                           |
| Privacy           | `/privacy`                                                                                                                                         |
| Cookies           | `/cookie-policy`                                                                                                                                   |
| Athlete agreement | `/athlete-agreement`                                                                                                                               |
| Help centre       | `/help-center`                                                                                                                                     |
| Contact           | `/contact-us`                                                                                                                                      |
| Live chat         | Anchored assistant on every marketing page (`/help-center`, `/contact-us`, etc.) — no separate chat URL required (`/live-chat` redirects to Help). |


In-app: Profile → Settings → Legal.

---

## Common app issues (in-product answers only)


| Symptom                        | What to tell the user                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Cannot log in                  | Confirm email verified; check network; on web allow cookies; retry Google sign-in                                    |
| Premium missing after payment  | Wait 1–2 minutes; web: return from Stripe success URL; mobile: Restore purchases; same email everywhere              |
| Paywall will not open (mobile) | Real build required (not Expo Go)                                                                                    |
| Paywall will not open (web)    | Must be signed in; Stripe functions must be deployed                                                                 |
| Feed not updating              | Pull to refresh; reopen app; check connection                                                                        |
| Cannot upload photo            | Grant photo library permission; check connection                                                                     |
| Animation shows a box on web   | Page/canvas background should be dark `#0A0A0A`; animation uses a transparent canvas — no extra panel behind the art |


---

## Quick FAQ

**Q: Is Dalton verified the same as Premium?**  
A: No. Premium is paid. Verification is master-team approval to publish as a creator.

**Q: Can I use Premium on web and phone?**  
A: Yes — one subscription per account when webhooks and store purchases use the same account email.

**Q: Where are saved events?**  
A: Events tab → Saved filter.

**Q: Where is saved media?**  
A: Media tab → bookmark icon → Saved library.

**Q: How do I edit my bio?**  
A: Profile → Edit Profile Sections → Bio.

**Q: Who can verify my account?**  
A: Dalton verification is handled automatically after you subscribe — the team queues it behind the scenes; it is **not** a self-serve button in the app.

**Q: How do I reach a human?**  
A: Use Profile → Settings → Support, or `/contact-us` on the website. Replies typically come within **24–48 hours** — do **not** read raw mailbox addresses aloud in voice/chat.
*Regenerate when major app releases change tabs, billing, or verification flow.*