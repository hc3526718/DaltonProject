import type { ComponentType } from 'react';

type SentryModule = typeof import('@sentry/react-native');

function loadSentry(): SentryModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@sentry/react-native') as SentryModule;
  } catch {
    return null;
  }
}

const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();

let inited = false;
let consoleErrorPatched = false;

function shouldForwardConsoleErrorsToSentry(): boolean {
  const flag = (process.env.EXPO_PUBLIC_SENTRY_FORWARD_CONSOLE_ERRORS ?? '').trim();
  if (flag === '0' || flag === 'false') return false;
  if (flag === '1' || flag === 'true') return true;
  return !__DEV__;
}

function patchConsoleErrorForSentry(): void {
  if (consoleErrorPatched || !shouldForwardConsoleErrorsToSentry()) return;
  const Sentry = loadSentry();
  if (!Sentry) return;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const errArg = args.find((a) => a instanceof Error) as Error | undefined;
      if (errArg) {
        Sentry.captureException(errArg);
        return;
      }
      const text = args
        .map((a) => {
          if (a instanceof Error) return a.message;
          if (typeof a === 'string') return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ')
        .trim();
      if (text.length > 0 && text.length < 8000) {
        Sentry.captureMessage(text, 'error');
      }
    } catch {
      /* never break logging */
    }
  };
  consoleErrorPatched = true;
}

/** Call once at startup (from `index.ts`). No-op when DSN unset or SDK missing. */
export function initSentryFromEnv(): void {
  if (inited || !dsn) return;
  const Sentry = loadSentry();
  if (!Sentry) {
    if (__DEV__) {
      console.warn('[Sentry] @sentry/react-native not installed — run npm install in expo-app');
    }
    return;
  }
  try {
    Sentry.init({
      dsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: __DEV__ ? 1 : 0.12,
      debug: __DEV__,
    });
    inited = true;
    patchConsoleErrorForSentry();
  } catch (e) {
    if (__DEV__) console.warn('[Sentry] init failed', e);
  }
}

function sentryEnabled(): boolean {
  return Boolean(dsn && inited && loadSentry());
}

export function wrapWithSentry<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  const Sentry = loadSentry();
  if (Sentry?.wrap) return Sentry.wrap(Component) as ComponentType<P>;
  return Component;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled()) return;
  const Sentry = loadSentry();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('extra', context);
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), 'error');
    }
  });
}

export function captureBootRiveIssue(
  message: string,
  context?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!sentryEnabled()) return;
  const Sentry = loadSentry();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTag('area', 'boot_rive');
    if (context) scope.setContext('rive', context as Record<string, unknown>);
    Sentry.captureMessage(message, 'warning');
  });
}

export function captureAuthSessionTimeout(): void {
  if (!sentryEnabled()) return;
  const Sentry = loadSentry();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTag('area', 'auth');
    Sentry.captureMessage('supabase_get_session_timeout', 'warning');
  });
}
