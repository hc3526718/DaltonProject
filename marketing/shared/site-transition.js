/* global window, document, caches, fetch */
(function () {
  var VIDEO_SRC = "/VideoP.mp4";
  var CACHE_NAME = "ga-transition-video-v1";
  var SESSION_READY_KEY = "ga-transition-video-ready";

  var WIPE_MS = 400;
  var VIDEO_DISPLAY_MS = 2000;
  var MIN_PLAY_MS = 1600;

  var cachedObjectUrl = null;
  var preloadPromise = null;
  var warmVideoEl = null;
  var transitionActive = false;
  var pendingReveal = false;

  function markSessionReady() {
    try {
      sessionStorage.setItem(SESSION_READY_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function blobToObjectUrl(blob) {
    cachedObjectUrl = URL.createObjectURL(blob);
    markSessionReady();
    return cachedObjectUrl;
  }

  function preloadTransitionVideo() {
    if (cachedObjectUrl) return Promise.resolve(cachedObjectUrl);
    if (preloadPromise) return preloadPromise;

    preloadPromise = (function () {
      if (typeof caches !== "undefined") {
        return caches
          .open(CACHE_NAME)
          .then(function (cache) {
            return cache.match(VIDEO_SRC).then(function (hit) {
              if (hit) return hit.blob();
              return fetch(VIDEO_SRC).then(function (res) {
                if (!res.ok) throw new Error("video fetch failed");
                var clone = res.clone();
                return cache.put(VIDEO_SRC, clone).then(function () {
                  return res.blob();
                });
              });
            });
          })
          .then(blobToObjectUrl)
          .catch(function () {
            return VIDEO_SRC;
          });
      }

      return fetch(VIDEO_SRC)
        .then(function (res) {
          if (!res.ok) throw new Error("video fetch failed");
          return res.blob();
        })
        .then(blobToObjectUrl)
        .catch(function () {
          return VIDEO_SRC;
        });
    })();

    return preloadPromise;
  }

  function warmHiddenVideo() {
    if (warmVideoEl) return;
    warmVideoEl = document.createElement("video");
    warmVideoEl.muted = true;
    warmVideoEl.playsInline = true;
    warmVideoEl.preload = "auto";
    warmVideoEl.setAttribute("playsinline", "");
    warmVideoEl.style.cssText =
      "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
    document.documentElement.appendChild(warmVideoEl);

    preloadTransitionVideo().then(function (url) {
      warmVideoEl.src = url;
      warmVideoEl.load();
    });
  }

  function ensureOverlay() {
    if (document.getElementById("ga-transition")) return;

    var root = document.createElement("div");
    root.id = "ga-transition";
    root.setAttribute("aria-hidden", "true");

    var stage = document.createElement("div");
    stage.className = "ga-stage";

    var slot = document.createElement("div");
    slot.className = "ga-video-slot";

    var video = document.createElement("video");
    video.className = "ga-video";
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "auto");

    var curtain = document.createElement("div");
    curtain.className = "ga-wipe-curtain";

    slot.appendChild(video);
    stage.appendChild(slot);
    stage.appendChild(curtain);
    root.appendChild(stage);
    document.body.appendChild(root);
  }

  function getParts() {
    var root = document.getElementById("ga-transition");
    if (!root) return {};
    return {
      root: root,
      curtain: root.querySelector(".ga-wipe-curtain"),
      video: root.querySelector("video"),
    };
  }

  function lockScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function setCurtainY(curtain, y, noTransition) {
    if (!curtain) return;
    if (noTransition) curtain.classList.add("ga-no-transition");
    else curtain.classList.remove("ga-no-transition");
    curtain.style.transform = "translateY(" + y + ")";
    if (noTransition) {
      void curtain.offsetWidth;
      curtain.classList.remove("ga-no-transition");
    }
  }

  function startVideo(video) {
    if (!video) return Promise.resolve();
    return preloadTransitionVideo().then(function (url) {
      video.src = url;
      video.currentTime = 0;
      var play = video.play();
      if (play && play.then) {
        return play.catch(function () {});
      }
    });
  }

  function teardownOverlay() {
    var parts = getParts();
    transitionActive = false;
    pendingReveal = false;
    if (parts.root) parts.root.classList.remove("ga-on");
    if (parts.video) parts.video.pause();
    if (parts.curtain) setCurtainY(parts.curtain, "0%", true);
    unlockScroll();
  }

  /** Wipe up: black curtain exits upward, revealing content below. */
  function wipeReveal(curtain) {
    setCurtainY(curtain, "-100%", false);
  }

  /** Wipe up from bottom: black covers the screen. */
  function wipeCover(curtain) {
    setCurtainY(curtain, "100%", true);
    void curtain.offsetWidth;
    setCurtainY(curtain, "0%", false);
  }

  function navWithTransition(url) {
    if (transitionActive) return;
    transitionActive = true;
    pendingReveal = false;

    ensureOverlay();
    var parts = getParts();
    if (!parts.root || !parts.curtain || !parts.video) {
      transitionActive = false;
      window.location.href = url;
      return;
    }

    parts.root.classList.add("ga-on");
    lockScroll();

    setCurtainY(parts.curtain, "0%", true);
    void startVideo(parts.video);

    var videoVisibleAt = 0;

    window.setTimeout(function () {
      wipeReveal(parts.curtain);
      videoVisibleAt = Date.now();
    }, 16);

    window.setTimeout(function () {
      var sinceVisible = videoVisibleAt ? Date.now() - videoVisibleAt : 0;
      var playWait = Math.max(0, MIN_PLAY_MS - sinceVisible);
      window.setTimeout(function () {
        pendingReveal = true;
        wipeCover(parts.curtain);
        window.location.href = url;
      }, playWait);
    }, WIPE_MS + VIDEO_DISPLAY_MS);
  }

  function finishArrival() {
    var parts = getParts();
    if (!parts.root || !parts.curtain) {
      teardownOverlay();
      return;
    }
    parts.root.classList.add("ga-on");
    lockScroll();
    setCurtainY(parts.curtain, "0%", true);
    window.setTimeout(function () {
      wipeReveal(parts.curtain);
      window.setTimeout(teardownOverlay, WIPE_MS + 40);
    }, 16);
  }

  window.addEventListener("pageshow", function () {
    if (pendingReveal || transitionActive) {
      pendingReveal = false;
      finishArrival();
      return;
    }
    teardownOverlay();
  });

  function isSameOriginLink(a) {
    try {
      var url = new URL(a.href, window.location.href);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function isAppLink(a) {
    var href = (a.getAttribute("href") || "").trim();
    if (!href) return false;
    if (href.startsWith("#")) return false;
    if (/^mailto:/i.test(href) || /^tel:/i.test(href)) return false;
    if (href.includes("/app/")) return false;
    return isSameOriginLink(a);
  }

  function injectPreloadLink() {
    if (document.querySelector('link[data-ga-video-preload="1"]')) return;
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.type = "video/mp4";
    link.href = VIDEO_SRC;
    link.setAttribute("data-ga-video-preload", "1");
    document.head.appendChild(link);
  }

  document.addEventListener("click", function (e) {
    var target = e.target;
    if (!target) return;
    var a = target.closest ? target.closest("a") : null;
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isAppLink(a)) return;

    var href = a.href;
    try {
      var u = new URL(href, window.location.href);
      var cur = new URL(window.location.href);
      var samePath = u.pathname === cur.pathname && u.search === cur.search;
      if (samePath && u.hash) return;
    } catch {
      /* ignore */
    }

    e.preventDefault();
    navWithTransition(href);
  });

  injectPreloadLink();
  warmHiddenVideo();
  preloadTransitionVideo();
})();
