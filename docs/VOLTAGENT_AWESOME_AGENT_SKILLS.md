# VoltAgent / “awesome-agent-skills” and this repo

The GitHub repo **[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)** (often misspelled “Voltagent”) is a **curated index of links** to Agent Skills that live in **other repositories**. It does **not** ship a single installable bundle you can drop into an Expo app.

## What we did instead (mobile-relevant)

Aligned this project with common themes from that ecosystem **without** vendoring every linked skill:

| Theme | Change in `expo-app` |
|--------|----------------------|
| **Transport / Rive** | `NSAppTransportSecurity` for `rive.app` when using **boot embed** WebView; dev/EAS default is **bundled** `dalton_animated_logo.riv`; optional `EXPO_PUBLIC_RIVE_URL` / `EXPO_PUBLIC_RIVE_USE_EMBED=1`. |
| **WebView boot** | `onShouldStartLoadWithRequest` allows `https:`, `blob:`, `data:`, `wss:`; blocks `javascript:` / `file:`. |
| **OAuth** | `isOAuthReturnUrlTrusted()` checks return URL **scheme** matches expected redirect before `exchangeCodeForSession`. |
| **Icons** | `ios.icon` uses **Icon-76@2x** (152px); root `icon` stays **Icon-1024** for store / tooling. **#0A0A0A** is already Android adaptive background; iOS icon “fill” is still the **PNG pixels** (bake background in design if needed). |

## How to use the curated list for real

1. Open the [README](https://github.com/VoltAgent/awesome-agent-skills/blob/main/README.md) and pick skills by category (security, Expo, React Native, etc.).  
2. Install only skills you need via **Cursor’s skill installer** or by copying each skill’s `SKILL.md` from its **own** repo.  
3. Re-run **Expo Doctor** / **EAS** after native config changes (`prebuild` / new build).

## Rive “ready right after splash”

Boot Rive in `src/constants/riveBoot.ts`: **Expo Go** defaults to Rive Cloud **embed** (WebView); **dev client / EAS** defaults to **native bundled** `assets/dalton_animated_logo.riv`. Set `EXPO_PUBLIC_RIVE_USE_EMBED=1` to use embed on native builds, or `EXPO_PUBLIC_RIVE_URL` for a hosted `.riv`. Native splash is dismissed in a **layout** effect so the dark shell appears immediately.
