/* global window, document */
(function injectSiteFooter() {
  function hasFooter() {
    return Boolean(document.querySelector('footer[data-dga-footer]'));
  }

  function year() {
    return String(new Date().getFullYear());
  }

  function footerHtml() {
    return (
      '<footer class="mx-auto max-w-6xl px-5 pb-12 pt-8 text-xs text-dim" data-dga-footer="1">' +
      '  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-line pt-6">' +
      '    <p>© ' +
      year() +
      ' The Dalton Grant Academy. All rights reserved.</p>' +
      '    <div class="flex flex-wrap items-center gap-4">' +
      '      <a class="hover:text-mist transition-colors" href="/help-center">Help</a>' +
      '      <a class="hover:text-mist transition-colors" href="/privacy">Privacy</a>' +
      '      <a class="hover:text-mist transition-colors" href="/terms">Terms</a>' +
      '      <a class="hover:text-mist transition-colors" href="/cookie-policy">Cookies</a>' +
      '      <a class="hover:text-mist transition-colors" href="/athlete-agreement">Athlete agreement</a>' +
      '      <a class="hover:text-mist transition-colors" href="/contact-us">Contact</a>' +
      '    </div>' +
      '  </div>' +
      '</footer>'
    );
  }

  function ensure() {
    var existing = document.querySelector('footer');
    if (existing && existing.getAttribute('data-dga-footer') === '1') return;
    if (existing) {
      existing.outerHTML = footerHtml();
      return;
    }
    var main = document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML('afterend', footerHtml());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure);
  } else {
    ensure();
  }
})();

