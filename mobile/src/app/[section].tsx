import { Redirect, useLocalSearchParams } from 'expo-router';
export default function Section() {
 const { section } = useLocalSearchParams<{ section: string }>();
 // The shared shell in _layout renders the active section without losing login.
 return ['home','services','projects','contact','workspace'].includes(section) ? null : <Redirect href="/home" />;
}
