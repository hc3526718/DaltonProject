# UI control inventory (wiring status)

**Related:** `docs/NEXT_STEPS.md` §2 & §5 (boot UX + demo removal).

Central helper: `showComingSoon(feature)` in `src/lib/comingSoon.ts` for stubs that await backend work.

| Area | Control | Behavior |
|------|---------|----------|
| Events — Upcoming | Bell | → Community Notifications |
| Events — Details | Share | System share sheet |
| Events — Details | Bookmark | Local toggle |
| Events — Details / Confirm / Booking | Add to Calendar | ICS file + share (`eventCalendar.ts`) |
| Events — Booking confirmed | Get Directions | Opens Google Maps query for venue |
| Events — Booking confirmed | View My Bookings | Navigates |
| Events — Booking confirmed | Invite | Share sheet |
| Events — Saved / My bookings | Search (header + field) | `showComingSoon` until search API |
| Events — Staff check-in | Validate | Local `verifyTicketToken` + alert |
| Media — Library | Search icon | Navigates to `MediaSearch` (working) |
| Community | (per screen) | Audit remaining rows in a future pass |
| Profile — Settings | Premium | → Paywall |
| Profile — Settings | Admin tools | Visible if `role !== member` → Admin hub |
| Profile — Settings | Account / Privacy / etc. | Existing demo navigations |
| Auth | Continue / Log in | Demo or Supabase when env set |

**Next pass:** Community feed rows, Media player secondary actions, Sponsor CTAs — replace no-ops with API or `showComingSoon` consistently.
