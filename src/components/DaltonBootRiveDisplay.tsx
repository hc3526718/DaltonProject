import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { DaltonBootRiveError } from './DaltonBootRivePlayer';
import { RIVE_EMBED_LOAD_TIMEOUT_MS } from '../constants/bootTiming';
import {
  BOOT_PAGE_BACKGROUND,
  BOOT_RIVE_EMBED_LOGO_SCALE,
  BOOT_USE_RIVE,
  getDaltonBootRiveDisplayMode,
  getDaltonBootRiveEmbedUri,
} from '../constants/riveBoot';
import { captureBootRiveIssue } from '../monitoring/sentryBoot';
import { isAllowedRiveBootEmbedNavigation } from '../security/riveEmbedNavigationPolicy';
import { DaltonBootRivePlayer } from './DaltonBootRivePlayer';

function buildInjectPageChrome(bg: string): string {
  return `(function(){
  var h='${bg}';
  try{
    var s=document.createElement('style');
    s.id='dalton-embed-chrome';
    s.textContent=
      'html,body,#root,main,rive-player,rive-embed,rive-canvas,[class*="rive"],[class*="embed"],div#root>div{'+
      'background-color:'+h+'!important;background:'+h+'!important;margin:0!important;}'+
      'html,body{min-height:100%!important;}'+
      'iframe,canvas,canvas.rive-canvas{border:0!important;background:transparent!important;}'+
      '*{scrollbar-color:transparent transparent;}';
    (document.head||document.documentElement).appendChild(s);
  }catch(e){}
  true;
})();`;
}

function injectCanvasScale(scale: number): string {
  return `(function(){
    var k=${scale};
    function z(){
      document.querySelectorAll('canvas').forEach(function(c){
        c.style.transform='scale('+k+')';
        c.style.transformOrigin='center center';
        c.style.backgroundColor='transparent';
      });
    }
    z();
    requestAnimationFrame(z);
    setTimeout(z,80);
    setTimeout(z,400);
    true;
  })();`;
}

type Props = {
  style: StyleProp<ViewStyle>;
  onNativeError: (e: DaltonBootRiveError) => void;
  onEmbedError?: () => void;
  onBootVisualReady?: () => void;
};

export function DaltonBootRiveDisplay({
  style,
  onNativeError,
  onEmbedError,
  onBootVisualReady,
}: Props) {
  const webRef = useRef<WebView>(null);
  const embedReady = useRef(false);
  const markEmbedReady = useCallback(() => {
    if (embedReady.current) return;
    embedReady.current = true;
    onBootVisualReady?.();
  }, [onBootVisualReady]);

  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const mode = getDaltonBootRiveDisplayMode();
  const embedUri = getDaltonBootRiveEmbedUri();

  useEffect(() => {
    if (!BOOT_USE_RIVE || mode !== 'embed') return;
    embedReady.current = false;
    const timer = setTimeout(() => {
      if (embedReady.current) return;
      captureBootRiveIssue('rive_embed_load_timeout', { uri: embedUri });
      onEmbedError?.();
    }, RIVE_EMBED_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mode, embedUri, onEmbedError]);

  if (!BOOT_USE_RIVE) return null;
  if (expoGo && mode === 'bundled') {
    return (
      <DaltonBootRivePlayer
        style={style}
        onError={onNativeError}
        onVisualReady={onBootVisualReady}
      />
    );
  }

  const bg = BOOT_PAGE_BACKGROUND;
  const injectChrome = buildInjectPageChrome(bg);

  if (mode === 'embed') {
    const flat = StyleSheet.flatten(style) as ViewStyle;
    const outerW = typeof flat.width === 'number' ? flat.width : 280;
    const outerH = typeof flat.height === 'number' ? flat.height : outerW;
    const scale = BOOT_RIVE_EMBED_LOGO_SCALE;
    const inner = Math.max(72, Math.round(Math.min(outerW, outerH) / scale));
    const uri = embedUri;

    const applyScale = () => {
      webRef.current?.injectJavaScript(injectCanvasScale(scale));
    };

    const onLoadEnd = () => {
      applyScale();
      markEmbedReady();
    };

    const common = {
      source: { uri },
      scrollEnabled: false,
      bounces: false,
      allowsInlineMediaPlayback: true,
      mediaPlaybackRequiresUserAction: false,
      javaScriptEnabled: true,
      domStorageEnabled: true,
      cacheEnabled: false,
      injectedJavaScriptBeforeContentLoaded: injectChrome,
      onError: (e: { nativeEvent: { description?: string } }) => {
        captureBootRiveIssue('rive_embed_webview_error', {
          uri,
          description: e.nativeEvent.description ?? '',
        });
        onEmbedError?.();
      },
      onHttpError: (e: WebViewHttpErrorEvent) => {
        if (__DEV__) {
          console.warn('[DaltonBootRive] HTTP error', e.nativeEvent.statusCode, e.nativeEvent.description);
        }
        captureBootRiveIssue('rive_embed_http_error', {
          uri,
          statusCode: e.nativeEvent.statusCode,
          description: e.nativeEvent.description ?? '',
        });
        onEmbedError?.();
      },
      onShouldStartLoadWithRequest: (req: { url: string }) => isAllowedRiveBootEmbedNavigation(req.url),
      onLoadProgress: ({ nativeEvent }: { nativeEvent: { progress: number } }) => {
        if (nativeEvent.progress >= 0.08) applyScale();
      },
      onLoadEnd,
      thirdPartyCookiesEnabled: true,
      sharedCookiesEnabled: true,
      setSupportMultipleWindows: false,
      javaScriptCanOpenWindowsAutomatically: false,
      allowsBackForwardNavigationGestures: false,
      containerStyle: [styles.webContainer, { width: outerW, height: outerH, backgroundColor: bg }],
    };

    return (
      <View
        style={[styles.outer, { width: outerW, height: outerH, backgroundColor: bg }, style]}
      >
        <View
          style={[
            styles.scaleWrap,
            {
              width: inner,
              height: inner,
              transform: [{ scale }],
              backgroundColor: bg,
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <WebView
              key={uri}
              ref={webRef}
              {...common}
              style={[styles.web, { width: inner, height: inner, backgroundColor: bg }]}
              allowsAirPlayForMediaPlayback={false}
            />
          ) : (
            <WebView
              key={uri}
              ref={webRef}
              {...common}
              style={[styles.web, { width: inner, height: inner, backgroundColor: bg }]}
              androidLayerType="hardware"
              mixedContentMode="compatibility"
              setBuiltInZoomControls={false}
              setDisplayZoomControls={false}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <DaltonBootRivePlayer
      style={style}
      onError={onNativeError}
      onVisualReady={onBootVisualReady}
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  webContainer: {
    backgroundColor: BOOT_PAGE_BACKGROUND,
  },
  web: {
    backgroundColor: BOOT_PAGE_BACKGROUND,
    opacity: 1,
  },
});
