/** Syncs fallback header auth slot with Supabase session (same key as Expo web app). */
(function syncLandingAuthFallback() {
  const STORAGE_KEY = 'sb-txehbzyntvqpkkegjrwp-auth-token';

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession ?? parsed?.session ?? parsed;
      const user = session?.user;
      if (!user?.id) return null;
      const meta = user.user_metadata || {};
      return {
        avatarUrl: meta.avatar_url || meta.picture || meta.avatar || null,
        label: meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Profile'),
      };
    } catch {
      return null;
    }
  }

  function render() {
    const slot = document.getElementById('dalton-auth-fallback');
    if (!slot) return;
    const session = readSession();
    if (session?.avatarUrl) {
      slot.innerHTML =
        '<a href="/app" class="landing-auth-fallback landing-auth-fallback--profile" aria-label="Open your profile">' +
        '<img src="' +
        session.avatarUrl.replace(/"/g, '&quot;') +
        '" alt="" class="landing-auth-fallback__avatar" referrerpolicy="no-referrer" />' +
        '<span class="landing-auth-fallback__label">' +
        String(session.label).replace(/</g, '&lt;') +
        '</span></a>';
      return;
    }
    slot.innerHTML =
      '<a href="/app" class="landing-auth-fallback landing-auth-fallback--cta">Log in / Sign up</a>';
  }

  render();
  window.addEventListener('storage', render);
})();
