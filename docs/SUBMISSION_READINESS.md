# Submission readiness audit — The Dalton Grant Academy

Last updated from codebase review. Use as a launch checklist.

## Ready when configured

| Area | Notes |
|------|--------|
| Core app (Expo) | Tabs: community, events, media, profile, messaging — requires Supabase env |
| Auth | Email, Google, Apple (native), session on web `/app` |
| Community feed | Realtime + refresh + foreground reload (web + native) |
| Accessibility (declared subset) | Larger Text, Dark Interface (default), Differentiate Without Color, Sufficient Contrast — synced via `user_settings` |
| Legal URLs | `/terms`, `/privacy`, `/cookie-policy`, `/athlete-agreement` deployed with Vercel rewrites |
| App Store assets | See `docs/APP_STORE_METADATA.md`, `app-store/routing-app-coverage.geojson` |
| Screenshot mode | `EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1` — see `docs/APP_STORE_SCREENSHOTS.md` |

## Configure before submit

| Item | Action |
|------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Production project |
| `EXPO_PUBLIC_DALTON_WEB_URL` | Production Vercel URL (EAS + local) |
| Bundle ID / app name | Still demo-oriented in places (`com.hc111.daltondemo`) — align with **The Dalton Grant Academy** production ID |
| RevenueCat / Stripe | Production keys for subscriptions |
| Sentry | DSN for production |
| Supabase Realtime | Enable replication for `posts` (community feed) |
| Legal copy | Replace placeholders in root `*.html` |
| Help center | Flesh out `help-center.html` |

## Gaps (code or product)

| Item | Severity | Detail |
|------|----------|--------|
| In-app account deletion | **High** (Apple) | Verify `deleteOwnAccount` flow on Profile → Account security |
| Push token registration | Medium | Wired via `tryRegisterPushToken` on session; requires `expo-notifications` + device permission |
| Host event dashboard | Low | Live booking totals from Supabase (`listHostEventDashboard`) |
| Paid event checkout | Medium | Requires `events.stripe_price_id` + deploy updated `stripe-create-checkout` / `stripe-webhook` |
| Media upload (web) | Low | Web file picker enabled; native preferred for large videos |
| MFA TOTP | Low | Settings shows “coming soon” |
| Accessibility UI depth | Medium | Global text scaling + contrast tokens wired; not every screen uses `useAccessibility().colors` yet |
| Master delete | Ops | Edge function only — not end-user self-serve |

## Accessibility (App Store declaration)

Declare only what you support:

1. **Larger Text** — in-app toggle → `maxFontSizeMultiplier` + cloud sync  
2. **Dark Interface** — default dark UI (informational row in Settings)  
3. **Differentiate Without Color Alone** — toggle → stronger borders/labels (expand to more components over time)  
4. **Sufficient Contrast** — toggle → higher-contrast palette  

Do **not** declare VoiceOver, Voice Control, Reduced Motion, Captions, or Light Interface until implemented.

## Test plan (manual)

### Both platforms + web (`/app`)

- [ ] Sign up / sign in / sign out  
- [ ] Create post → appears on other device/web after refresh  
- [ ] Toggle accessibility options on device A → open device B (same account) → settings match  
- [ ] Legal links open correct pages  
- [ ] Premium purchase path (sandbox) native vs web  
- [ ] Offline / error states show clear copy  

### iOS-specific

- [ ] TestFlight build with production env  
- [ ] Sign in with Apple  
- [ ] App Store Connect metadata matches `APP_STORE_METADATA.md`  

### Web-specific

- [ ] OAuth redirect `/app/auth/callback`  
- [ ] Community feed updates after tab focus (foreground reload)  

## Environment rebuild

```powershell
cd c:\Users\haydn\Downloads\DaltonProject\expo-app
npx expo start --clear
```

Production iOS: `eas build --profile production --platform ios` then `eas submit`.
