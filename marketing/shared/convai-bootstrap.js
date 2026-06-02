/**
 * ElevenLabs Convai anchored widget — loaded by marketing pages only (`marketing-chrome.js`).
 * Keeps `/app/` web bundle untouched when users open Expo web on marketing origin.
 */
(function loadElevenLabsConvaiWidget() {
  try {
    if (typeof document === 'undefined') return;
    var p = '';
    try {
      p =
        typeof location !== 'undefined' && location.pathname
          ? String(location.pathname)
          : '';
    } catch (e) {}
    if (p.includes('/app/')) return;

    var doc = document;
    if (doc.querySelector('script[data-dga-convai-widget]')) return;

    var host = doc.createElement('elevenlabs-convai');
    host.setAttribute('agent-id', 'agent_5601kgdedfr4e7zv0knb2cn568ym');
    doc.body.appendChild(host);

    var s = doc.createElement('script');
    s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    s.async = true;
    s.type = 'text/javascript';
    s.setAttribute('data-dga-convai-widget', '1');
    doc.body.appendChild(s);
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[convai] widget bootstrap failed', err);
    }
  }
})();
