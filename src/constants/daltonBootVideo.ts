import { Platform } from 'react-native';

/** Match the video letterbox background. */
export const DALTON_BOOT_VIDEO_BG = '#000000';

/** Candidate URLs for the boot loop (app shell + marketing root). */
export function getDaltonBootVideoWebCandidates(): string[] {
  const env = process.env.EXPO_PUBLIC_BOOT_VIDEO_URL?.trim();
  if (env) return [env];

  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const base = (process.env.EXPO_PUBLIC_WEB_BASE_PATH ?? '/app').replace(/\/$/, '');
  const appPath = `${base}/VideoP.mp4`;
  const rootPath = '/VideoP.mp4';

  const abs = (p: string) => {
    if (/^https?:\/\//i.test(p)) return p;
    if (!origin) return p.startsWith('/') ? p : `/${p}`;
    return `${origin}${p.startsWith('/') ? p : `/${p}`}`;
  };

  return [abs(appPath), abs(rootPath)];
}

export function getDaltonBootVideoWebPath(): string {
  return getDaltonBootVideoWebCandidates()[0] ?? '/app/VideoP.mp4';
}

let webWarmupStarted = false;

/**
 * Start loading VideoP early (auth stack / logged-out shell).
 * Web: `<link rel="preload">` + hidden `<video preload="auto">`. Native: `BootVideoWarmup` + expo-asset in `DaltonVideoLoop`.
 */
export function warmDaltonBootVideoCache(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (webWarmupStarted) return;
  webWarmupStarted = true;

  const uris = getDaltonBootVideoWebCandidates();

  if (!document.querySelector('link[data-dga-boot-video-preload]')) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = uris[0] ?? getDaltonBootVideoWebPath();
    link.type = 'video/mp4';
    link.setAttribute('data-dga-boot-video-preload', '1');
    document.head.appendChild(link);
  }

  if (!document.querySelector('video[data-dga-boot-video-warmup]')) {
    const video = document.createElement('video');
    video.setAttribute('data-dga-boot-video-warmup', '1');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.src = uris[0] ?? getDaltonBootVideoWebPath();
    video.style.cssText =
      'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
    document.body.appendChild(video);
    const play = () => {
      void video.play().catch(() => {});
    };
    video.addEventListener('canplay', play, { once: true });
    video.load();
  }
}
