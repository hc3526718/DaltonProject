import type { NavigatorScreenParams } from '@react-navigation/native';

export type CommunityStackParamList = {
  CommunityFeed: undefined;
  /** Composer: caption, optional linked event, media preview — single screen. */
  CreateCommunityPost: undefined;
  CommunitySearch: undefined;
  CommunitySearchResults: { query?: string };
  /** Read-only profile for another member (from feed tap). */
  PublicProfile: { userId: string };
  FollowUserList: { userId: string; mode: 'followers' | 'following' };
  /** Local share log (gold icons) for posts shared from the community tab. */
  ShareActivity: undefined;
  Notifications: undefined;
  MessagesInbox: undefined;
  MessageThread: {
    name?: string;
    conversationId?: string;
    peerUserId?: string;
    avatarUrl?: string;
    /** When set, sending a message marks the linked proposal as discussed (master review). */
    markDiscussedProposalId?: string;
    /** Pre-filled composer text (e.g. master outreach to applicant). */
    initialDraft?: string;
  };
  BrandPartner: { pageId?: string } | undefined;
  EditSponsor: { pageId: string };
  DemoHub: undefined;
};

export type MediaStackParamList = {
  MediaLibrary: { createdMediaTitle?: string } | undefined;
  MediaSearch: undefined;
  MediaSearchResults: { query?: string } | undefined;
  MediaPlayer: { title?: string; mediaId?: string; playbackUrl?: string };
  SavedMedia: undefined;
  MediaCommunityFeed: undefined;
  CreateMediaContent: undefined;
  MediaProposalWizard: undefined;
  EditMedia: { mediaId: string };
};

export type BookingConfirmParams = {
  reference?: string;
  bookingId?: string;
  eventId?: string;
  title?: string;
  imageUri?: string;
  recapDate?: string;
  recapTime?: string;
  venue?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  fitnessLevel?: string;
};

export type EventsBrowseFilterChip = 'all' | 'booked' | 'saved' | 'past' | 'my_events';

export type EventsStackParamList = {
  UpcomingEvents: { initialFilter?: EventsBrowseFilterChip; createdEventTitle?: string } | undefined;
  EventsSearch: undefined;
  EventDetails: {
    title?: string;
    imageUri?: string;
    dateShort?: string;
    sub?: string;
    /** `db:{uuid}` or `html:title:dateHint` — used for Saved filter + bookmark persistence */
    eventStorageKey?: string;
    /** Real Supabase `events.id` when applicable */
    supabaseEventId?: string;
  };
  ConfirmAttend: {
    title?: string;
    imageUri?: string;
    scheduleLine?: string;
    supabaseEventId?: string;
    requiresPayment?: boolean;
    stripePriceId?: string | null;
  };
  BookingConfirm: BookingConfirmParams | undefined;
  StaffCheckIn: undefined;
  HostEventDashboard: undefined;
  CreateEvent: undefined;
  EditEvent: { eventId: string };
  EventProposalWizard: undefined;
  /** Lists events created by current user → opens scan with mandatory selection. */
  HostScanPickEvent: undefined;
  HostAttendeeScan: { selectedEventId: string };
};

export type SponsorsStackParamList = {
  SponsorListings: { createdSponsorName?: string } | undefined;
  BrandPartner: { pageId?: string } | undefined;
  SponsorProposalWizard: undefined;
  MySponsorProposals: undefined;
  EditSponsor: { pageId: string };
};

export type ProfileStackParamList = {
  AthleteProfile: undefined;
  Paywall: undefined;
  AdminTools: undefined;
  AdminMediaUpload: undefined;
  QrTestLab: undefined;
  Settings: undefined;
  Accessibility: undefined;
  AccountSecurity: undefined;
  ChangePassword: undefined;
  PrivacyVisibility: undefined;
  NotificationPrefs: undefined;
  FollowRequests: undefined;
  /** Same stack as profile so follower/following lists can open member profiles. */
  PublicProfile: { userId: string };
  FollowUserList: { userId: string; mode: 'followers' | 'following' };
  Support: undefined;
  HelpCentre: undefined;
  Legal: undefined;
  EditBasic: undefined;
  EditProfilePhoto: undefined;
  EditAthlete: undefined;
  EditProfileSections: undefined;
  EditProfileSectionDetail: {
    slug: 'banner' | 'bio' | 'interests' | 'highlights' | 'recentResults';
  };
  MasterControlHub: undefined;
  MasterGate: { returnTo?: 'MasterControlHub' | 'MasterProposalQueue' } | undefined;
  MasterPartnerOffers: undefined;
  CreatePartnerOffer: undefined;
  MasterUserAccounts: undefined;
  MasterVerificationQueue: undefined;
  MasterProposalQueue: undefined;
  MasterProposalDetail: { proposalId: string };
  MyProposals: undefined;
};

/** Shown before sign-in — no tab bar. */
export type AuthStackParamList = {
  GrantAccess: { startAt?: 'signup' } | undefined;
  WelcomeHub: undefined;
  LogIn: undefined;
  ForgotPassword: undefined;
  VerifyReset: undefined;
  CreatePassword: undefined;
};

/** Post–sign-in profile questions (first session). */
export type OnboardingStackParamList = {
  OnboardingName: undefined;
  OnboardingUsername: undefined;
  OnboardingRole: undefined;
  OnboardingSports: undefined;
  OnboardingInterests: undefined;
  OnboardingDiscovery: undefined;
  OnboardingMembership: undefined;
  OnboardingComplete: undefined;
};

export type MainTabParamList = {
  Community: NavigatorScreenParams<CommunityStackParamList>;
  Media: NavigatorScreenParams<MediaStackParamList>;
  Events: NavigatorScreenParams<EventsStackParamList>;
  Sponsors: NavigatorScreenParams<SponsorsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: undefined;
  /** Tabs or first-run onboarding — see `AuthenticatedShell` in `AppNavigator`. */
  Main: undefined;
  /** Forced after email password-recovery deep link (temporary session). */
  PasswordRecovery: undefined;
};
