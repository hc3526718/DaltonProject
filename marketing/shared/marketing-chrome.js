/** Loads StaggeredMenu + screenshot carousel (pages with #dalton-staggered-menu / #dalton-card-swap). */
(function loadMarketingUi() {
  if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
    window.process = { env: { NODE_ENV: 'production' } };
  }
  if (window.__daltonMarketingUiLoading) return;
  window.__daltonMarketingUiLoading = true;

  const CSS_HREF = '/shared/marketing-ui/marketing-ui.css';
  const OVERRIDES_HREF = '/shared/marketing-overrides.css';
  const JS_SRC = '/shared/marketing-ui/marketing-ui.js';
  const FOOTER_SRC = '/shared/site-footer.js';

  function appendFooterScript() {
    if (document.querySelector('script[data-dga-site-footer]')) return;
    const footerJs = document.createElement('script');
    footerJs.src = FOOTER_SRC;
    footerJs.defer = true;
    footerJs.setAttribute('data-dga-site-footer', '1');
    document.body.appendChild(footerJs);
  }

  function appendBundleScript() {
    if (document.querySelector('script[data-dalton-marketing-ui]')) {
      appendFooterScript();
      return;
    }
    const js = document.createElement('script');
    js.src = JS_SRC;
    js.async = false;
    js.defer = true;
    js.setAttribute('data-dalton-marketing-ui', '1');
    js.onerror = function onMarketingUiError() {
      console.error('[dalton-marketing] Failed to load', JS_SRC);
    };
    js.onload = appendFooterScript;
    document.body.appendChild(js);
  }

  function appendOverridesCss() {
    if (document.querySelector('link[data-dalton-marketing-overrides]')) {
      appendBundleScript();
      return;
    }
    const overrides = document.createElement('link');
    overrides.rel = 'stylesheet';
    overrides.href = OVERRIDES_HREF;
    overrides.setAttribute('data-dalton-marketing-overrides', '1');
    overrides.onload = appendBundleScript;
    overrides.onerror = appendBundleScript;
    document.head.appendChild(overrides);
  }

  if (document.querySelector('link[data-dalton-marketing-ui]')) {
    appendOverridesCss();
    return;
  }

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = CSS_HREF;
  css.setAttribute('data-dalton-marketing-ui', '1');
  css.onload = appendOverridesCss;
  css.onerror = function onMarketingCssError() {
    console.error('[dalton-marketing] Failed to load', CSS_HREF);
    appendOverridesCss();
  };
  document.head.appendChild(css);
})();
