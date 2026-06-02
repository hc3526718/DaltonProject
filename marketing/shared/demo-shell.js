window.DEMO_ROUTES = window.DEMO_ROUTES || {
  index: 'demo.html',
  login: '1-Onboarding Flow - Log In.html',
  verifyReset: '2-Onboarding Flow - Verify Reset.html',
  forgotPassword: '3-Onboarding Flow - Forgot Passw.html',
  welcome: '4-Onboarding Flow - Welcome & Ac.html',
  createPassword: '5-Onboarding Flow - Create New P.html',
  brandPartner: '6-Brand Partner Detail.html',
  communityFeed: '7-Community Feed.html',
  eventDetails: '8-Event Booking - Event Details.html',
  confirmAttend: '9-Event Booking - Confirm Attend.html',
  bookingConfirm: '10-Event Booking - Booking Confir.html',
  savedEvents: '11-Event Booking - Saved Events.html',
  myBookings: '12-Event Booking - My Bookings.html',
  upcomingEvents: '13-Upcoming Events.html',
  settings: '14-Profile Settings - Settings.html',
  editBasic: '15-Profile Settings - Edit Basic.html',
  editPhoto: '16-Profile Settings - Edit Profil.html',
  editAthlete: '17-Profile Settings - Edit Athlet.html',
  mediaLibrary: '18-Media Library.html',
  mediaSearchResults: '19-Media Player - Media Search Re.html',
  mediaPlayer: '20-Media Player - Media Player.html',
  savedMedia: '21-Media Player - Saved Media.html',
  athleteProfile: '22-Athlete Profile.html',
  mediaSearch: '23-Media Player - Media Search.html',
  communityFeedMedia: '24-Media Player - Community Feed.html',
  communitySearchResults: '25-Community Flow - Community Sea.html',
  notifications: '26-Community Flow - Notifications.html',
  messagesInbox: '27-Community Flow - Messages Inbo.html',
  messageThread: '28-Community Flow - Message Threa.html',
  communitySearch: '29-Community Flow - Community Sea.html',
  editProfileSections: '30-Profile Settings - Edit Profil.html',
  sponsorListings: '31-Sponsor Listings.html',
  grantAccess: '32-The Dalton Grant Academy.html',
};

(function () {
  var R = window.DEMO_ROUTES || {};
  function href(key, fallback) {
    return R[key] || fallback;
  }

  var pathFile = (window.location.pathname.split('/').pop() || '').toLowerCase();
  var isHub = pathFile === '' || pathFile === 'demo.html';

  if (!isHub && !document.getElementById('demo-home-chip')) {
    var chip = document.createElement('a');
    chip.id = 'demo-home-chip';
    chip.href = href('index', 'demo.html');
    chip.setAttribute('aria-label', 'Demo flows home');
    chip.textContent = 'Flows';
    document.body.appendChild(chip);
  }

  if (document.getElementById('bottom-nav')) return;
  if (isHub) return;

  if (document.getElementById('demo-global-dock')) return;

  var dock = document.createElement('nav');
  dock.id = 'demo-global-dock';
  dock.setAttribute('aria-label', 'Demo primary navigation');
  var inner = document.createElement('div');
  inner.className = 'demo-dock-inner';

  var items = [
    { key: 'communityFeed', fallback: '7-Community Feed.html', icon: 'fa-user-group', label: 'Community' },
    { key: 'mediaLibrary', fallback: '18-Media Library.html', icon: 'fa-play', label: 'Media' },
    { key: 'sponsorListings', fallback: '31-Sponsor Listings.html', icon: 'fa-handshake', label: 'Sponsors' },
    { key: 'upcomingEvents', fallback: '13-Upcoming Events.html', icon: 'fa-calendar-days', label: 'Events' },
    { key: 'athleteProfile', fallback: '22-Athlete Profile.html', icon: 'fa-user', label: 'Profile', regular: true },
  ];

  var path = window.location.pathname.split('/').pop() || '';
  items.forEach(function (item) {
    var url = href(item.key, item.fallback);
    var a = document.createElement('a');
    a.href = url;
    var iconClass = item.regular ? 'fa-regular ' + item.icon : 'fa-solid ' + item.icon;
    a.innerHTML = '<i class="' + iconClass + '"></i><span>' + item.label + '</span>';
    if (path === url || decodeURIComponent(path) === url) {
      a.classList.add('demo-dock-active');
    }
    inner.appendChild(a);
  });

  dock.appendChild(inner);
  document.body.appendChild(dock);
  document.body.classList.add('demo-dock-padded');
})();
