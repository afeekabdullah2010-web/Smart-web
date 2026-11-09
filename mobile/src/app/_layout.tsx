import { Slot } from 'expo-router';
import MobileShell from '../components/MobileShell';

// Keep one cookie-persistent WebView mounted while native routes change.
export default function RootLayout() { return <MobileShell><Slot /></MobileShell>; }
