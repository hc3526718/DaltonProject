/** User-facing onboarding choices — stored in `profiles.persona_role`, `sports[]`, `discovery_source`. */

export const PERSONA_OPTIONS = [
  { id: 'coach', label: 'Coach' },
  { id: 'parent', label: 'Parent / Guardian' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'athlete', label: 'Athlete' },
  { id: 'fan', label: 'Fan / Supporter' },
  { id: 'other', label: 'Other' },
] as const;

export const SPORT_OPTIONS = [
  'Athletics',
  'Football (soccer)',
  'Rugby',
  'Basketball',
  'Tennis',
  'Combat sports',
  'Swimming',
  'Gym / fitness',
  'Multi-sport',
  'Other',
] as const;

/** Broader profile interests (onboarding + profile edit). */
export const INTEREST_OPTIONS = [
  'Strength training',
  'Nutrition',
  'Recovery',
  'Mindset',
  'Youth development',
  'Coaching',
  'Sponsorship',
  'Events & camps',
  'Media & content',
  'Community',
  'Fitness',
  'Injury prevention',
  'Performance analysis',
  'Parenting in sport',
  'Scouting',
] as const;

export const DISCOVERY_OPTIONS = [
  { id: 'social', label: 'Social media' },
  { id: 'friend', label: 'Friend or teammate' },
  { id: 'dalton', label: 'From Dalton' },
  { id: 'ai', label: 'AI assistant (e.g. ChatGPT)' },
  { id: 'search', label: 'Search engine' },
  { id: 'app_store', label: 'App Store / Play Store' },
  { id: 'other', label: 'Other' },
] as const;
