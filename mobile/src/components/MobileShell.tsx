import React, { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useNetworkState } from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { bridgeScript } from '../bridge';
import { canDownload, downloadName, externalKind, isInternal, siteOrigin, tabForUrl, tabUrl, type AccountRole, type Tab } from '../navigation';

const ORIGIN = siteOrigin(process.env.EXPO_PUBLIC_SITE_URL);
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' }, { id: 'services', label: 'Services', icon: '⚙' },
  { id: 'projects', label: 'Projects', icon: '▦' }, { id: 'contact', label: 'Contact', icon: '✉' },
  { id: 'workspace', label: 'Workspace', icon: '◉' },
];

function CompanyApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const web = useRef<WebView<object>>(null);
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const role = useRef<AccountRole>(null);
  const sourceRef = useRef(ORIGIN + '/');
  const [tab, setTab] = useState<Tab>('home');
  const [source, setSource] = useState(ORIGIN + '/');
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const retry = useCallback(() => { setFailure(false); web.current?.reload(); }, []);
  const navigate = useCallback((next: Tab) => {
    setTab(next); setFailure(false);
    const url = tabUrl(next, ORIGIN, role.current);
    // A single WebView keeps the secure login cookie across all tabs.
    if (url === sourceRef.current) web.current?.injectJavaScript('window.location.assign(' + JSON.stringify(url) + ');true;');
    else { sourceRef.current = url; setSource(url); }
  }, []);
  useEffect(() => {
    const section = pathname.slice(1) as Tab;
    // Dispatch after the native layout commits, when the shared WebView ref is ready.
    const frame = requestAnimationFrame(() => { if (tabs.some(item => item.id === section)) navigate(section); });
    return () => cancelAnimationFrame(frame);
  }, [pathname, navigate]);
  function openExternal(url: string) {
    const kind = externalKind(url);
    if (!kind) return;
    const open = () => Linking.openURL(url).catch(() => Alert.alert('Cannot open link', 'No app is available to open this link.'));
    if (kind === 'contact') { void open(); return; }
    Alert.alert('Open in your browser?', new URL(url).hostname, [{ text: 'Cancel', style: 'cancel' }, { text: 'Open', onPress: () => { void open(); } }]);
  }
  async function onMessage(event: WebViewMessageEvent) {
    if (!isInternal(event.nativeEvent.url, ORIGIN) || event.nativeEvent.data.length > 7_000_000) return;
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'session') { role.current = data.role === 'Admin' || data.role === 'Staff' ? data.role : null; return; }
    if (data.type === 'error') { Alert.alert('Download unavailable', String(data.message || 'Please try again.').slice(0, 250)); return; }
    if (!['download', 'print'].includes(data.type) || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    let temporaryFile: string | undefined;
    try {
      if (data.type === 'print') {
        if (typeof data.html !== 'string' || data.html.length > 2_000_000) throw Error('This document is too large to print.');
        await Print.printAsync({ html: data.html });
      } else {
        if (!canDownload(data.url, ORIGIN) || !['text/csv', 'text/html'].includes(data.mime) || typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64) || !data.base64.length || data.base64.length > 6_700_000) throw Error('Unsupported download.');
        if (!await Sharing.isAvailableAsync() || !FileSystem.cacheDirectory) throw Error('File sharing is unavailable on this device.');
        temporaryFile = FileSystem.cacheDirectory + Date.now() + '-' + downloadName(data.name, data.mime);
        await FileSystem.writeAsStringAsync(temporaryFile, data.base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(temporaryFile, { mimeType: data.mime, dialogTitle: 'Save or share Smart Power document', UTI: data.mime === 'text/csv' ? 'public.comma-separated-values-text' : 'public.html' });
      }
    } catch (error) {
      Alert.alert('Document action', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (temporaryFile) await FileSystem.deleteAsync(temporaryFile, { idempotent: true }).catch(() => {});
      busyRef.current = false; setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityLabel="Smart Power logo" />
      <View style={styles.brand}><Text style={styles.title}>SMART POWER</Text><Text style={styles.subtitle}>ENGINEERING WORKS</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={!canGoBack} onPress={() => web.current?.goBack()} style={[styles.headerButton, !canGoBack && styles.disabled]}><Text style={styles.headerIcon}>‹</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh page" onPress={retry} style={styles.headerButton}><Text style={styles.headerIcon}>↻</Text></Pressable>
    </View>
    <View style={styles.content}>
      <WebView<object> ref={web} source={{ uri: source }} style={styles.web}
        originWhitelist={['https://*', 'tel:*', 'mailto:*']} javaScriptEnabled domStorageEnabled
        sharedCookiesEnabled thirdPartyCookiesEnabled={false} cacheEnabled={false} cacheMode="LOAD_NO_CACHE"
        mixedContentMode="never" allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows javaScriptCanOpenWindowsAutomatically={false}
        allowsBackForwardNavigationGestures allowsInlineMediaPlayback mediaPlaybackRequiresUserAction
        injectedJavaScript={bridgeScript} onMessage={event => { void onMessage(event); }}
        onLoadStart={() => { setLoading(true); setFailure(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailure(true); setLoading(false); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 500) setFailure(true); }}
        onContentProcessDidTerminate={retry}
        onRenderProcessGone={retry}
        onShouldStartLoadWithRequest={request => {
          if (isInternal(request.url, ORIGIN)) return true;
          openExternal(request.url); return false;
        }}
        onOpenWindow={event => {
          const url = event.nativeEvent.targetUrl;
          if (isInternal(url, ORIGIN)) web.current?.injectJavaScript('window.location.assign(' + JSON.stringify(url) + ');true;');
          else openExternal(url);
        }}
        onNavigationStateChange={state => { setCanGoBack(state.canGoBack); if (isInternal(state.url, ORIGIN)) setTab(tabForUrl(state.url)); }}
      />
      {(offline || failure) && <View style={styles.errorScreen} accessibilityLiveRegion="polite">
        <Image source={require('../../assets/logo.png')} style={styles.errorLogo} />
        <Text style={styles.errorTitle}>{offline ? 'You’re offline' : 'Unable to load this page'}</Text>
        <Text style={styles.errorText}>{offline ? 'Connect to the internet to view services and access your company workspace.' : 'Check your connection, then try again. Your saved company records stay on the server.'}</Text>
        <Pressable style={styles.retry} accessibilityRole="button" onPress={retry}><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>}
      {(loading || busy) && !offline && !failure && <View style={styles.progress} accessibilityLiveRegion="polite"><ActivityIndicator color="#0a8fe8" /><Text style={styles.progressText}>{busy ? 'Preparing document…' : 'Loading…'}</Text></View>}
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">{tabs.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} accessibilityLabel={item.label} onPress={() => { if (pathname === '/' + item.id) navigate(item.id); else router.replace('/' + item.id); }} style={[styles.tab, tab === item.id && styles.activeTab]}>
      <Text style={[styles.tabIcon, tab === item.id && styles.activeText]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.id && styles.activeText]}>{item.label}</Text>
    </Pressable>)}</View>
    {children}
  </SafeAreaView>;
}
export default function MobileShell({ children }: { children: ReactNode }) { return <SafeAreaProvider><CompanyApp>{children}</CompanyApp></SafeAreaProvider>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#061d35' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  logo: { width: 42, height: 42, borderRadius: 11 }, brand: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 }, subtitle: { color: '#91c6e9', fontSize: 9, letterSpacing: 1.5, marginTop: 4 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#14334f' }, headerIcon: { fontSize: 28, color: '#fff' }, disabled: { opacity: 0.3 },
  content: { flex: 1, backgroundColor: '#f4f8fc' }, web: { flex: 1, backgroundColor: '#f4f8fc' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dce7f0', paddingVertical: 5, paddingHorizontal: 4 },
  tab: { flex: 1, minHeight: 57, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 6 }, activeTab: { backgroundColor: '#eaf6ff' },
  tabIcon: { color: '#60778d', fontSize: 23, marginBottom: 2 }, tabLabel: { color: '#60778d', fontSize: 10, fontWeight: '700' }, activeText: { color: '#0078c5' },
  progress: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', gap: 9, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, elevation: 3 }, progressText: { color: '#28435e', fontSize: 12 },
  errorScreen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#f4f8fc', padding: 28, alignItems: 'center', justifyContent: 'center' }, errorLogo: { width: 100, height: 140, resizeMode: 'contain', marginBottom: 18 },
  errorTitle: { fontSize: 24, fontWeight: '800', color: '#061d35', textAlign: 'center' }, errorText: { color: '#60778d', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 380 }, retry: { backgroundColor: '#078ee8', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 24 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
