/**
 * Copy + imagery from `13-Upcoming Events.html` (UPCOMING grid).
 */
export type HtmlEventCard = {
  uri: string;
  date: string;
  title: string;
  sub: string;
};

export const UPCOMING_EVENTS_FROM_HTML: HtmlEventCard[] = [
  {
    uri: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 15 • 10:00 AM',
    title: 'STRENGTH CAMP',
    sub: 'Elite performance tra...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1526506114642-94fb211c471c?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 18 • 08:00 AM',
    title: 'MOBILITY MASTERCLASS',
    sub: 'Unlock your full rang...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 22 • 06:00 PM',
    title: 'ENDURANCE RUN',
    sub: 'Push your limits with...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 25 • 09:00 AM',
    title: 'HIIT SESSION',
    sub: 'High intensity interv...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 28 • 07:00 AM',
    title: 'TRACK & FIELD',
    sub: 'Sprint training and t...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop',
    date: 'Oct 30 • 05:00 PM',
    title: 'CYCLING CHALLENGE',
    sub: 'Road cycling endurance...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=600&auto=format&fit=crop',
    date: 'Nov 02 • 06:30 AM',
    title: 'BOXING FUNDAMENTALS',
    sub: 'Learn striking techni...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1519505907962-0a6cb0167c73?q=80&w=600&auto=format&fit=crop',
    date: 'Nov 05 • 08:30 AM',
    title: 'SWIMMING CLINIC',
    sub: 'Technique refinement ...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?q=80&w=600&auto=format&fit=crop',
    date: 'Nov 08 • 04:00 PM',
    title: 'MARATHON PREP',
    sub: 'Long distance running...',
  },
  {
    uri: 'https://images.unsplash.com/photo-1577221084712-45b0445d2b00?q=80&w=600&auto=format&fit=crop',
    date: 'Nov 12 • 10:30 AM',
    title: 'CROSSFIT WOD',
    sub: 'Workout of the day ch...',
  },
];
