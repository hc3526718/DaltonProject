# Apple Push Notification SSL certificates (Development + Production)

Use this when you see **Development SSL Certificate** and **Production SSL Certificate** under your App ID in [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers** → your app → **Push Notifications**.

Bundle ID for Dalton: **`com.hc111.daltondemo`** (must match `expo-app` / App Store Connect).

You need **both** certificates if you send pushes to sandbox (TestFlight/dev) and production (App Store).

---

## Before you start (one-time on your Mac)

1. Open **Keychain Access** (Spotlight → type `Keychain Access`).
2. Menu bar: **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority…**
3. In the dialog:
   - **User Email Address:** type your Apple ID email (e.g. `haydncampbell22@gmail.com`)
   - **Common Name:** type `Dalton Push CSR` (any label is fine)
   - **CA Email Address:** leave **empty**
   - Select **Saved to disk**
   - Click **Continue**
4. Save the file as **`DaltonPush.certSigningRequest`** (remember the folder, e.g. Desktop).

You will upload this **same `.certSigningRequest` file** for both Development and Production push certificates.

---

## Create Development SSL Certificate

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click your App ID **`com.hc111.daltondemo`** (or create it if missing).
3. Scroll to **Push Notifications** → click **Configure**.
4. Under **Development SSL Certificate**, click **Create Certificate**.
5. On “Create a new push certificate”:
   - Click **Choose File**
   - Select **`DaltonPush.certSigningRequest`**
   - Click **Continue**
6. Click **Download** — saves something like **`aps_development.cer`**.
7. Double-click **`aps_development.cer`** — it installs into Keychain Access.

---

## Create Production SSL Certificate

1. Same App ID → **Push Notifications** → **Configure**.
2. Under **Production SSL Certificate**, click **Create Certificate**.
3. Upload the **same** **`DaltonPush.certSigningRequest`** file again.
4. Click **Continue** → **Download** — saves **`aps_production.cer`**.
5. Double-click **`aps_production.cer`** to install in Keychain.

---

## Export for Expo / EAS (`.p12`)

Expo EAS often uses a **push key** (`.p8` from App Store Connect → Keys) instead of `.p12`. Prefer the **APNs Auth Key** path for new projects (see below). If you use classic push certificates:

1. Keychain Access → category **My Certificates**.
2. Find **Apple Development IOS Push Services: com.hc111.daltondemo** (and later Production).
3. Expand the arrow ▶ — select **both** the certificate and the **private key**.
4. Right-click → **Export 2 items…**
5. File format: **Personal Information Exchange (.p12)**
6. Name e.g. **`DaltonPush-Development.p12`**
7. Set an **export password** (write it down — EAS will ask for it).

Repeat for the **Production** push certificate → **`DaltonPush-Production.p12`**.

---

## Recommended: APNs Auth Key (`.p8`) instead of two SSL certs

Easier for Expo:

1. https://developer.apple.com/account/resources/authkeys/list
2. Click **+** (Create a key).
3. **Key Name:** type `Dalton APNs Key`
4. Enable **Apple Push Notifications service (APNs)**
5. **Continue** → **Register** → **Download** → file **`AuthKey_XXXXXXXXXX.p8`** (download **once**; Apple does not let you download again).
6. Note the **Key ID** shown on the page.

Then in terminal (project folder):

```powershell
cd C:\Users\haydn\Downloads\DaltonProject\expo-app
eas credentials
```

Choose **iOS** → **Push Notifications** → upload **`.p8`** + enter **Key ID** + your **Team ID** (Apple Developer → Membership details).

---

## Enable push in the app (after credentials exist)

1. Install: `npx expo install expo-notifications` (if not already).
2. Configure `app.config.js` / `app.json` with your bundle ID and `expo-notifications` plugin.
3. EAS build with push capability (not Expo Go).
4. Store device tokens in Supabase `device_push_tokens` (migration already in project).

See [Expo push overview](https://docs.expo.dev/push-notifications/overview/) and `docs/REMAINING_TASKS_PLAYBOOK.md` §12.

---

## Quick checklist

| Step | Done? |
|------|-------|
| CSR file created (`DaltonPush.certSigningRequest`) | ☐ |
| Development push `.cer` downloaded + installed | ☐ |
| Production push `.cer` downloaded + installed | ☐ |
| **Or** APNs `.p8` key downloaded + Key ID saved | ☐ |
| `eas credentials` updated for iOS push | ☐ |
| New **development** or **preview** build (not Expo Go) | ☐ |
