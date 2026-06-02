# Apple Wallet pass setup & test

**Related:** [QR_CHECKIN.md](./QR_CHECKIN.md), [REMAINING_TASKS_PLAYBOOK.md](./REMAINING_TASKS_PLAYBOOK.md) §9, `supabase/functions/wallet-generate-pass`, `supabase/functions/wallet-passes`.

The app already has **Add to Apple Wallet** on the booking confirmation screen (iOS). This doc covers Apple Developer + Supabase secrets, deploy, and device testing.

---

## Architecture

| Piece | Role |
|-------|------|
| **`wallet-generate-pass`** (Edge Function) | Authenticated user requests a pass for their booking → signed `.pkpass` |
| **`wallet-passes`** (Edge Function) | PassKit web service (register device, fetch updated pass after check-in void) |
| **`wallet_passes` table** | Device registration + push tokens for pass updates |
| **`src/lib/walletPass.ts`** | Downloads pass, opens iOS share sheet (`com.apple.pkpass`) |
| **QR on pass** | Same HMAC token as in-app ticket (`TicketPayloadV1`, 30-day expiry) |

---

## 1. Apple Developer

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **+** → **Pass Type IDs**  
   - Example: `pass.com.grantaccess.event` (must match `APPLE_PASS_TYPE_ID`).
3. **Certificates** → **+** → **Pass Type ID Certificate** for that identifier.  
   - Download `.cer`, convert to PEM (see below).
4. Note your **Team ID** (Membership details).

### Convert certificate + key to PEM

On macOS (after exporting Pass Type ID cert + private key from Keychain as `.p12`):

```bash
# WWDR (download Apple WWDR G4 from Apple PKI page if needed)
# Signer cert from .p12
openssl pkcs12 -in pass_cert.p12 -clcerts -nokeys -out signer-cert.pem
openssl pkcs12 -in pass_cert.p12 -nocerts -nodes -out signer-key.pem
```

---

## 2. Supabase secrets

**Dashboard** → Project → **Edge Functions** → **Secrets** (or `supabase secrets set`).

| Secret | Description |
|--------|-------------|
| `APPLE_PASS_TYPE_ID` | e.g. `pass.com.grantaccess.event` |
| `APPLE_TEAM_ID` | 10-character Team ID |
| `APPLE_WWDR_CERT_PEM` | Apple WWDR intermediate (PEM text) |
| `APPLE_SIGNER_CERT_PEM` | Pass Type ID certificate (PEM) |
| `APPLE_SIGNER_KEY_PEM` | Private key (PEM) |
| `APPLE_SIGNER_KEY_PASSPHRASE` | Only if key is encrypted |
| `TICKET_HMAC_SECRET` | **Same value** as `EXPO_PUBLIC_TICKET_SIGNING_SECRET` in EAS / `.env` |

Without the Apple cert secrets, `wallet-generate-pass` returns **503** with `not_configured` (the app shows a clear message).

---

## 3. Deploy Edge Functions

From repo root (install [Supabase CLI](https://supabase.com/docs/guides/cli) if needed):

```bash
cd c:\Users\haydn\Downloads\DaltonProject
npx supabase link   # once, if not linked
npx supabase functions deploy wallet-generate-pass --no-verify-jwt
npx supabase functions deploy wallet-passes --no-verify-jwt
```

Migration `028_wallet_passes.sql` must be applied (columns `pass_voided`, `wallet_auth_token`, table `wallet_passes`).

---

## 4. App / EAS env

Ensure production builds have:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
EXPO_PUBLIC_TICKET_SIGNING_SECRET=<same as TICKET_HMAC_SECRET>
```

Wallet passes only appear on **iOS** (`Platform.OS === 'ios'`). Use a **dev client or TestFlight** build (not Expo Go for full native share sheet behaviour).

---

## 5. Test checklist

### A. Server smoke test (no booking)

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://<project>.supabase.co/functions/v1/wallet-generate-pass" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"reference":"DG-TEST"}'
```

- **503** → Apple certs not set (expected until step 2).
- **401** → bad/missing JWT.
- **404** → booking not found.
- **200** + binary body → signing works.

### B. End-to-end on iPhone

1. Sign in, book or use an existing **confirmed booking**.
2. Open **Booking confirmed** → **Add to Apple Wallet**.
3. Share sheet should offer **Add to Wallet**; pass shows event title, date, member name.
4. **Host scan:** Scan pass QR with `HostAttendeeScanScreen` — should verify like in-app ticket.
5. After check-in, pass should show **ATTENDED** on next Wallet refresh (PassKit polls `wallet-passes`).

### C. QR alignment

Pass barcode uses the **signed ticket token**, not plain `DG-XXXX`. Staff scanners must use the same `TICKET_HMAC_SECRET` / `EXPO_PUBLIC_TICKET_SIGNING_SECRET` as the app.

---

## 6. App Store review notes

- Wallet is **optional**; PNG/PDF ticket export remains available.
- You need a valid **Pass Type ID** and signing cert in production before marketing “Add to Wallet”.
- Do not commit `.p12`, `.pem`, or secrets to git.
- Pass updates use your Supabase HTTPS URL (`webServiceURL`); Supabase provides valid TLS.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Signing not configured” (503) | Set all `APPLE_*` secrets; redeploy function |
| Share sheet opens but no Wallet option | Confirm file is `.pkpass`, UTI `com.apple.pkpass`, real device (not simulator-only in some cases) |
| QR scan fails at door | Align `TICKET_HMAC_SECRET` with app; check token not expired |
| Pass never updates after check-in | PassKit may delay; ensure `wallet-passes` deployed and `pass_voided` trigger ran |
