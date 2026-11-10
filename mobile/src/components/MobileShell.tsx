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
import { canDownload, downloadName, externalKind, isInternal, siteOrigin, tabForUrl, tabUrl, mobileAuthUrl, type AccountRole, type Tab } from '../navigation';

import Dashboard, { GuestHome } from './Dashboard';
import { dashboardPage, type DashboardData } from '../dashboard';
import Welcome, { type PublicAccount } from './Welcome';

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
  const sourceRef = useRef(ORIGIN + '/api/mobile/entry');
  const guest = useRef(false);
  const [guestMode, setGuestMode] = useState(false);
  const [gate, setGate] = useState(true);
  const [accountRole, setAccountRole] = useState<AccountRole>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [source, setSource] = useState(ORIGIN + '/api/mobile/entry');
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const principal = useRef('');
  const [webUrl, setWebUrl] = useState(ORIGIN + '/api/mobile/entry');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gate) return false;
      if (!role.current && !guest.current) { setGate(true); return true; }
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack, gate]);

  const retry = useCallback(() => { setFailure(false); web.current?.reload(); }, []);
  const navigate = useCallback((next: Tab) => {
    if (!role.current && (!guest.current || next === 'workspace')) { setGate(true); return; }
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
  function load(url: string) {
    setGate(false); setFailure(false);
    if (url === sourceRef.current) web.current?.injectJavaScript('window.location.assign(' + JSON.stringify(url) + ');true;');
    else { sourceRef.current = url; setSource(url); }
  }
  function openAuth(kind: 'login' | 'register', account: Exclude<AccountRole, null>) {
    guest.current = false; setGuestMode(false); load(mobileAuthUrl(kind, account, ORIGIN));
  }
  function browseGuest() { role.current = null; principal.current = ''; setDashboard(null); setAccountRole(null); guest.current = true; setGuestMode(true); load(ORIGIN + '/'); }
  function goBack() { if (!role.current && !guest.current) setGate(true); else web.current?.goBack(); }
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
    if (data.type === 'session') {
      if (guest.current) { role.current = null; principal.current = ''; setAccountRole(null); return; }
      const previous = role.current;
      role.current = ['Admin','Staff','Client'].includes(data.role) ? data.role : null;
      const nextPrincipal = role.current ? role.current + ':' + data.id : '';
      if (principal.current !== nextPrincipal) setDashboard(null);
      principal.current = nextPrincipal;
      setAccountRole(role.current);
      if (role.current) { guest.current = false; setGuestMode(false); } // Opening the app keeps account options visible until the user chooses.
      else if (previous) { guest.current = false; setGuestMode(false); setDashboard(null); setGate(true); }
      return;
    }
    if (data.type === 'dashboard') {
      const value = data.dashboard;
      if (!guest.current && value && value.role + ':' + value.userId === principal.current) setDashboard(value);
      return;
    }
    if (data.type === 'error') { Alert.alert('Action unavailable', String(data.message || 'Please try again.').slice(0, 250)); return; }
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
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={gate || (!canGoBack && !!accountRole)} onPress={goBack} style={[styles.headerButton, !canGoBack && styles.disabled]}><Text style={styles.headerIcon}>‹</Text></Pressable>
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
        onLoadStart={() => { setLoading(true); setFailure(false); setDashboard(null); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailure(true); setLoading(false); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 500) setFailure(true); }}
        onContentProcessDidTerminate={retry}
        onRenderProcessGone={retry}
        onShouldStartLoadWithRequest={request => {
          if (isInternal(request.url, ORIGIN)) {
            const path = new URL(request.url).pathname;
            if (path === '/auth/login') { openAuth('login', role.current || 'Staff'); return false; }
            if (path === '/auth/register') { openAuth('register', 'Staff'); return false; }
            return true;
          }
          openExternal(request.url); return false;
        }}
        onOpenWindow={event => {
          const url = event.nativeEvent.targetUrl;
          if (isInternal(url, ORIGIN)) web.current?.injectJavaScript('window.location.assign(' + JSON.stringify(url) + ');true;');
          else openExternal(url);
        }}
        onNavigationStateChange={state => { setWebUrl(state.url); setCanGoBack(state.canGoBack); if (isInternal(state.url, ORIGIN)) setTab(tabForUrl(state.url)); }}
      />
      {!gate && dashboardPage(webUrl, ORIGIN) && <View style={styles.welcomeOverlay}><Dashboard data={dashboard} onPage={path => load(ORIGIN + path)} onRetry={retry} onSignOut={() => web.current?.injectJavaScript('window.spMobileLogout && window.spMobileLogout();true;')} /></View>}
      {!gate && guestMode && isInternal(webUrl, ORIGIN) && ['/', '/index.html'].includes(new URL(webUrl).pathname) && <View style={styles.welcomeOverlay}><GuestHome onPage={path => load(ORIGIN + path)} onJoin={() => setGate(true)} /></View>}
      {!gate && (offline || failure) && <View style={styles.errorScreen} accessibilityLiveRegion="polite">
        <Image source={require('../../assets/logo.png')} style={styles.errorLogo} />
        <Text style={styles.errorTitle}>{offline ? 'You’re offline' : 'Unable to load this page'}</Text>
        <Text style={styles.errorText}>{offline ? 'Connect to the internet to view services and access your company workspace.' : 'Check your connection, then try again. Your saved company records stay on the server.'}</Text>
        <Pressable style={styles.retry} accessibilityRole="button" onPress={retry}><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>}
      {(loading || busy) && !gate && !offline && !failure && <View style={styles.progress} accessibilityLiveRegion="polite"><ActivityIndicator color="#0a8fe8" /><Text style={styles.progressText}>{busy ? 'Preparing document…' : 'Loading…'}</Text></View>}
      {gate && <View style={styles.welcomeOverlay}><Welcome onSignIn={(selected: PublicAccount) => openAuth('login', selected)} onCreate={(selected: PublicAccount) => openAuth('register', selected)} onGuest={browseGuest} /></View>}
    </View>
    {!gate && <View style={styles.tabs} accessibilityRole="tablist">{tabs.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} accessibilityLabel={item.id === 'home' && accountRole ? 'Dashboard' : item.label} onPress={() => { if (pathname === '/' + item.id) navigate(item.id); else router.replace('/' + item.id); }} style={[styles.tab, tab === item.id && styles.activeTab]}>
      <Text style={[styles.tabIcon, tab === item.id && styles.activeText]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.id && styles.activeText]}>{item.id === 'home' && accountRole ? 'Dashboard' : item.label}</Text>
    </Pressable>)}</View>}
    <View style={styles.powered}><Text style={styles.poweredText}>Powered by Smart </Text><Pressable accessibilityRole="button" accessibilityLabel="Admin sign in" hitSlop={10} onPress={() => openAuth('login', 'Admin')}><Text style={styles.powerLink}>Power</Text></Pressable></View>
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
  welcomeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  powered: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f7fc', padding: 13 }, poweredText: { color: '#6b859a', fontSize: 11 }, powerLink: { color: '#0079bc', fontSize: 11, fontWeight: '800' },
  content: { flex: 1, backgroundColor: '#f4f8fc' }, web: { flex: 1, backgroundColor: '#f4f8fc' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dce7f0', paddingVertical: 5, paddingHorizontal: 4 },
  tab: { flex: 1, minHeight: 57, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 6 }, activeTab: { backgroundColor: '#eaf6ff' },
  tabIcon: { color: '#60778d', fontSize: 23, marginBottom: 2 }, tabLabel: { color: '#60778d', fontSize: 10, fontWeight: '700' }, activeText: { color: '#0078c5' },
  progress: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', gap: 9, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, elevation: 3 }, progressText: { color: '#28435e', fontSize: 12 },
  errorScreen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#f4f8fc', padding: 28, alignItems: 'center', justifyContent: 'center' }, errorLogo: { width: 100, height: 140, resizeMode: 'contain', marginBottom: 18 },
  errorTitle: { fontSize: 24, fontWeight: '800', color: '#061d35', textAlign: 'center' }, errorText: { color: '#60778d', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 380 }, retry: { backgroundColor: '#078ee8', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 24 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
