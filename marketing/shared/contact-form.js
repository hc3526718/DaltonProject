/** Contact page: posts to Supabase Edge `send-contact-email`. Requires `/shared/dalton-contact-config.js` from build. */
(function initDaltonContactForm() {
  const form = document.getElementById('dga-contact-form');
  const status = document.getElementById('dga-contact-status');
  const submitBtn = document.getElementById('dga-contact-submit');
  const subjectSelect = document.getElementById('dga-contact-subject');
  const customWrap = document.getElementById('dga-contact-subject-custom-wrap');
  const customInput = document.getElementById('dga-contact-subject-custom');

  if (!form || !status || !submitBtn || !subjectSelect || !customWrap || !customInput) return;

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send message';
  }

  function showCustom() {
    const v = subjectSelect.value;
    customWrap.hidden = v !== 'other';
  }

  subjectSelect.addEventListener('change', showCustom);
  showCustom();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    status.textContent = '';
    status.className = 'rounded-xl border px-4 py-3 text-sm mt-4 hidden';

    const cfg = window.__DALTON_CONTACT_CONFIG__ || {};
    const url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    const anon = cfg.anonKey || '';
    if (!url || !anon) {
      status.className =
        'rounded-xl border border-red-500/35 bg-red-500/10 text-mist px-4 py-3 text-sm mt-4';
      status.hidden = false;
      status.textContent =
        'The contact form is not configured on this preview. Deploy with Supabase URL and anon key, or email us via Profile → Support in the app.';
      return;
    }

    const key = subjectSelect.value;
    const custom = (customInput.value || '').trim();
    const message = (document.getElementById('dga-contact-message')?.value || '').trim();

    if (key === 'other' && custom.length < 2) {
      status.className =
        'rounded-xl border border-gold/40 bg-panel text-mist px-4 py-3 text-sm mt-4';
      status.hidden = false;
      status.textContent = 'Please enter a short custom subject.';
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${url}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anon}`,
          apikey: anon,
        },
        body: JSON.stringify({
          subject_key: key,
          subject_custom: key === 'other' ? custom : undefined,
          message,
          page_url: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(data.error || 'send_failed');
      }
      status.className =
        'rounded-xl border border-gold/35 bg-panel text-mist px-4 py-3 text-sm mt-4';
      status.hidden = false;
      status.textContent = 'Thank you — your message was sent.';
      form.reset();
      showCustom();
    } catch (err) {
      status.className =
        'rounded-xl border border-red-500/35 bg-red-500/10 text-mist px-4 py-3 text-sm mt-4';
      status.hidden = false;
      status.textContent =
        'We could not send your message right now. Check your connection and try again, or reach us via Support in the app.';
    } finally {
      setBusy(false);
    }
  });
})();
