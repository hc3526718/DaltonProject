/**
 * Saved events list from `11-Event Booking - Saved Events.html` (upcoming tab).
 */
export type SavedEventRow = {
  id: string;
  uri: string;
  dateLine: string;
  title: string;
  time: string;
  place: string;
  scheduleLine: string;
};

export const SAVED_EVENTS_FROM_HTML: SavedEventRow[] = [
  {
    id: 'strength',
    uri: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop',
    dateLine: 'OCT 15, 2024',
    title: 'STRENGTH CAMP',
    time: '10:00 AM',
    place: 'Elite Fitness',
    scheduleLine: 'October 15, 2024 • 10:00 AM - 12:00 PM',
  },
  {
    id: 'yoga',
    uri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=600&auto=format&fit=crop',
    dateLine: 'OCT 22, 2024',
    title: 'YOGA FLOW',
    time: '7:00 AM',
    place: 'Zen Studio',
    scheduleLine: 'October 22, 2024 • 7:00 AM - 8:30 AM',
  },
  {
    id: 'hiit',
    uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=600&auto=format&fit=crop',
    dateLine: 'NOV 05, 2024',
    title: 'HIIT BOOTCAMP',
    time: '6:00 PM',
    place: 'Power Gym',
    scheduleLine: 'November 5, 2024 • 6:00 PM - 7:00 PM',
  },
];
