import { BRAND_CONTACT_RESPONSE_WINDOW, BRAND_NAME, BRAND_WEB_ORIGIN } from '../constants/brand';
import type { LegalPagePath } from '../lib/legalUrls';

export type HelpArticle = {
  id: string;
  title: string;
  body: string;
  /** Lowercase tokens for in-app search (title + keywords). */
  keywords: string[];
  /** Opens the academy website legal page when the article is tapped. */
  legalPath?: LegalPagePath;
};

export const HELP_SUGGESTED_SEARCHES = [
  'Premium subscription',
  'Dalton verification',
  'Book an event',
  'Restore purchases',
  'Delete account',
  'Privacy policy',
  'Terms of service',
  'Accessibility',
  'Offline mode',
  'Report a post',
] as const;

function matchesQuery(article: HelpArticle, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${article.title} ${article.body} ${article.keywords.join(' ')}`.toLowerCase();
  return hay.includes(needle);
}

export function filterHelpArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  return articles.filter((a) => matchesQuery(a, query));
}

/** Bundled help — available offline in Settings → Help centre. */
export const HELP_CENTRE_ARTICLES: HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    keywords: ['sign up', 'login', 'onboarding', 'google', 'apple', 'account'],
    body:
      `Sign in with email, Google, or Apple (iOS). Complete onboarding (role, sports, username), then explore Community, Events, Media, Sponsors, and Profile. Use the same email on web at ${BRAND_WEB_ORIGIN.replace(/^https:\/\//, '')}/app.`,
  },
  {
    id: 'premium',
    title: 'Premium & one subscription',
    keywords: ['subscribe', 'paywall', 'stripe', 'revenuecat', 'billing', 'restore', 'web', 'ios', 'app store'],
    body:
      'Grant Access Pro unlocks creator tools after Dalton verification. Pay on web (Stripe Checkout) or on iPhone (App Store / RevenueCat)—one subscription per account, not per device. Android is not available yet. Sign in with the same email everywhere; status syncs via your account. Web: Profile → Premium. iOS: Restore purchases after signing in.',
  },
  {
    id: 'verification',
    title: 'Dalton verification',
    keywords: ['verified', 'creator', 'awaiting', 'publish', 'host', 'upload'],
    body:
      'Premium is required first. Dalton verification is usually sent automatically within about 24–48 hours of subscribing—there is nothing separate to submit. Creator tools stay locked until verification lands. If you still see “Awaiting Dalton verification” after that window, contact us via Support.',
  },
  {
    id: 'community',
    title: 'Community feed & posts',
    keywords: ['feed', 'post', 'comment', 'like', 'refresh', 'realtime'],
    body:
      'Pull down to refresh the feed. New posts from others appear when you are online (realtime). Switching back to the app also refreshes the feed. Create posts from the + button where enabled.',
  },
  {
    id: 'events',
    title: 'Events & bookings',
    keywords: ['book', 'ticket', 'qr', 'check-in', 'saved', 'host'],
    body:
      'Discover events under Events → filters (All, Booked, Saved, Past, My events). Booking requires an internet connection. Host tools and QR check-in need Grant Access Pro and Dalton verification.',
  },
  {
    id: 'messages',
    title: 'Messages',
    keywords: ['dm', 'inbox', 'chat', 'thread', 'offline'],
    body:
      'Open messages from Community (paper plane) or your inbox. Recent threads may be readable offline for a limited time; sending messages requires a connection.',
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    keywords: ['larger text', 'contrast', 'dark', 'color', 'settings'],
    body:
      `Profile → Settings → Accessibility: Larger Text (1x–3x), Differentiate Without Color Alone, and Sufficient Contrast. ${BRAND_NAME} uses a dark interface by default (no light theme). Preferences sync across devices when signed in.`,
  },
  {
    id: 'legal-overview',
    title: 'Legal & privacy (overview)',
    keywords: [
      'legal',
      'law',
      'policies',
      'terms',
      'privacy',
      'cookies',
      'athlete agreement',
      'terms and conditions',
      'terms of service',
      'privacy policy',
      'cookie policy',
      'gdpr',
      'data protection',
    ],
    body:
      `${BRAND_NAME} legal documents are on our website and in Profile → Settings → Legal. Search “terms” or “privacy” in this help centre for direct links. You can also open each policy from the articles below.`,
  },
  {
    id: 'terms-of-service',
    title: 'Terms of service',
    keywords: [
      'terms',
      'terms of service',
      'terms and conditions',
      'conditions',
      'user agreement',
      'platform rules',
      'eligibility',
      'legal',
    ],
    body:
      'Platform rules, eligibility, subscriptions, user-generated content, and event booking terms. Tap this article to open the full Terms of service in your browser, or go to Profile → Settings → Legal.',
    legalPath: '/terms',
  },
  {
    id: 'privacy-policy',
    title: 'Privacy policy',
    keywords: [
      'privacy',
      'privacy policy',
      'personal data',
      'data protection',
      'gdpr',
      'cookies',
      'tracking',
      'delete account',
      'legal',
    ],
    body:
      'How we collect, use, store, and delete personal data (account, profile, messages, bookings, and analytics). Tap to open the Privacy policy, or Profile → Settings → Legal.',
    legalPath: '/privacy',
  },
  {
    id: 'cookie-policy',
    title: 'Cookie policy',
    keywords: ['cookie', 'cookies', 'cookie policy', 'tracking', 'legal', 'privacy'],
    body:
      `How cookies and similar technologies are used on the ${BRAND_NAME} website. Tap to open the Cookie policy.`,
    legalPath: '/cookie-policy',
  },
  {
    id: 'athlete-agreement',
    title: 'Athlete agreement',
    keywords: ['athlete', 'agreement', 'dalton grant academy', 'program', 'terms', 'legal'],
    body:
      `${BRAND_NAME} program terms for athletes and creators. Tap to open the Athlete agreement.`,
    legalPath: '/athlete-agreement',
  },
  {
    id: 'account-delete',
    title: 'Delete my account',
    keywords: ['gdpr', 'remove', 'deletion', 'support'],
    body:
      'Settings → Delete account permanently removes your profile, messages, bookings, uploads, and other data we hold for your account—you will be asked to type DELETE on iPhone to confirm. Cancel Apple subscriptions in iOS Subscription settings first; cancel web billing through the Stripe customer portal before deleting. This cannot be undone.',
  },
  {
    id: 'troubleshoot',
    title: 'Something not working?',
    keywords: ['bug', 'crash', 'error', 'connection', 'update'],
    body:
      `Force-close and reopen the app, check your connection, and install the latest build. For billing, use Restore purchases (iOS) or refresh after a web Stripe payment—Settings → Stripe billing portal on web. For anything else that keeps failing, use Profile → Settings → Support or the Contact form on our website (${BRAND_CONTACT_RESPONSE_WINDOW}).`,
  },
];
