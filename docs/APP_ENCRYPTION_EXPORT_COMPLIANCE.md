# App Encryption Documentation & App Store compliance (The Dalton Grant Academy)

Copy the sections below into **App Store Connect** when submitting **The Dalton Grant Academy** (bundle `com.hc111.daltondemo` until production ID is finalized).

Related: [APP_STORE_METADATA.md](./APP_STORE_METADATA.md), [SUBMISSION_READINESS.md](./SUBMISSION_READINESS.md).

---

## 1 of 3 — App description (required before uploading encryption docs)

Paste into **App Encryption Documentation →** the field that asks for a short description of your app’s functionality and purpose:

```text
The Dalton Grant Academy: community platform for athletes and coaches — feed, DMs, training media, sponsors, events & booking with check-in. Premium unlocks creator tools after verification. HTTPS; sign-in via email, Apple & Google. Not medical/regulated finance. See Terms & Privacy.
```

*(284 characters — under Apple’s 300-character limit for step 1 of 3.)*

---

## Encryption questionnaire — how to answer

Apple asks whether the app uses encryption. The Dalton Grant Academy **does** use encryption, but only in forms that typically qualify for **exemption** (no annual BIS self-classification filing for proprietary crypto).

### Does your app use encryption?

**Yes.**

### Does your app qualify for any exemptions?

**Yes** — the app uses encryption limited to:

- **HTTPS (TLS 1.2+)** for API calls (Supabase, Stripe, RevenueCat, OAuth, analytics if enabled).
- **Apple / Google OS-provided** storage and transport (Keychain, platform TLS stacks).
- **No proprietary** or non-standard encryption algorithms implemented by the app.
- **No end-to-end encrypted messaging** beyond transport TLS (messages are stored on your server; not Signal-style E2EE).

### Standard encryption vs Apple OS encryption

You are **not** replacing Apple’s OS encryption with custom algorithms. You are **also** using standard TLS when communicating with servers—which is normal and exempt when you do not ship custom crypto.

### When you would answer “No” to exemption / need upload documentation

Only if you add:

- Proprietary or non-IEEE/IETF/ITU encryption,
- Custom E2E messaging crypto you control,
- Embedded cryptography beyond authentication (e.g. encrypted local databases with your own cipher).

**Today:** none of the above apply.

### Info.plist / Expo

`app.config.js` sets `ITSAppUsesNonExemptEncryption: false` (meaning: **no non-exempt encryption**). Still confirm the export compliance dialog on each upload in App Store Connect.

### Internal one-line record (keep with release notes)

> The Dalton Grant Academy vX.Y — encryption limited to Apple/Google OS facilities and HTTPS (TLS); no proprietary cryptography.

---

## App Store Regulations & Permits

| Topic | The Dalton Grant Academy — typical answer |
|--------|-------------------------------|
| **Export compliance** | Exempt HTTPS-only (see above) |
| **Content rights** | You license UI; users post UGC under Terms |
| **Age rating** | Complete questionnaire honestly (UGC + messaging → often 12+ / 13+) |
| **UGC** | Reporting + moderation; master tools |
| **Account deletion** | In-app delete account + privacy policy |
| **Privacy Nutrition Labels** | Map auth, purchases (RevenueCat), optional Sentry, push tokens |
| **Digital purchases** | IAP (RevenueCat) on mobile; Stripe on web per your setup |
| **Business permits** | No special permit for a standard fitness/community app unless you sell regulated services |
| **Event ticketing** | Consumer terms/refunds in Terms; Stripe for paid events |

There is **no separate permit file** to upload for a standard community/events app unless Apple requests proof for a specific category.

---

## Digital Services Act (DSA) — trader status

If App Store Connect shows **“This developer has identified itself as a trader for this app”**:

- That means you declared the app is offered by a **trader** (business) under EU/UK consumer rules—not a private individual hobbyist.
- **Edit** in App Store Connect → app → **General** / **App Information** (wording varies by year) → trader / business information.
- Ensure **legal name, address, email, and support contact** match your Privacy Policy and website footer.
- **Add Labels and Markings?** — Usually **No** unless you sell physical goods requiring CE/UKCA labels, age markings on packaging, etc. A digital-only community app typically has **nothing to add** here.

**You must still provide:** working **Privacy Policy** and **Terms** URLs (see Help centre + Settings → Legal).

---

## Help centre — legal pages searchable in-app

Settings → **Help centre** includes dedicated articles for **Terms of service**, **Privacy policy**, **Cookie policy**, and **Athlete agreement**. Search examples: `terms`, `privacy`, `terms and conditions`, `privacy policy`.

Full legal HTML lives on the marketing site (`EXPO_PUBLIC_DALTON_WEB_URL`); in-app opens the same URLs as Settings → Legal.

---

## Quick Connect checklist (encryption + compliance)

1. Paste **§1 App description** into Encryption Documentation step 1.
2. Answer encryption: **Yes** → qualifies for **exemption** (HTTPS / standard only).
3. Confirm `ITSAppUsesNonExemptEncryption` = **false** in production build.
4. Privacy Policy URL + Support URL live on production web.
5. Trader / DSA info accurate if you sell in EU/UK as a business.
6. Skip **Labels and Markings** unless you have physical-product obligations.
