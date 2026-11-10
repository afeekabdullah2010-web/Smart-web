import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
export type PublicAccount = 'Client' | 'Staff';
export default function Welcome({ onSignIn, onCreate, onGuest }: { onSignIn: (role: PublicAccount) => void; onCreate: (role: PublicAccount) => void; onGuest: () => void }) {
 const [role, setRole] = useState<PublicAccount>('Client');
 return <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
  <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityLabel="Smart Power logo" />
  <Text style={styles.eyebrow}>SMART POWER ENGINEERING WORKS</Text>
  <Text style={styles.title}>Welcome to{ '\n' }Smart Power.</Text>
  <Text style={styles.description}>Your projects. Your team. One place.</Text>
  <View style={styles.roles} accessibilityRole="tablist">{(['Client','Staff'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: role === item }} onPress={() => setRole(item)} style={[styles.role, role === item && styles.selected]}><Text style={[styles.roleText, role === item && styles.selectedText]}>{item}</Text></Pressable>)}</View>
  <Text style={styles.hint}>{role === 'Client' ? 'Request services and follow updates from our team.' : 'Access your attendance, tasks and payslips.'}</Text>
  <Pressable accessibilityRole="button" onPress={() => onSignIn(role)} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable>
  <Pressable accessibilityRole="button" onPress={() => onCreate(role)} style={styles.secondary}><Text style={styles.secondaryText}>Create account</Text></Pressable>
  <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
  <Pressable accessibilityRole="button" onPress={onGuest} style={styles.guest}><Text style={styles.guestText}>Continue as Guest →</Text></Pressable>
  <Text style={styles.guestHint}>Explore our company, services and projects.</Text>
 </ScrollView>;
}
const styles = StyleSheet.create({
 scroll: { backgroundColor: '#f1f7fc' }, content: { flexGrow: 1, justifyContent: 'center', padding: 26, maxWidth: 520, width: '100%', alignSelf: 'center' },
 logo: { width: 80, height: 80, borderRadius: 22, marginBottom: 22 }, eyebrow: { color: '#0079bc', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
 title: { color: '#0b2b43', fontSize: 38, fontWeight: '800', lineHeight: 43, marginTop: 10 }, description: { color: '#5d7890', fontSize: 15, marginTop: 12, marginBottom: 26 },
 roles: { flexDirection: 'row', padding: 4, backgroundColor: '#dfeef8', borderRadius: 15 }, role: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' }, selected: { backgroundColor: '#fff' }, roleText: { color: '#58768c', fontSize: 16, fontWeight: '700' }, selectedText: { color: '#0079bc' },
 hint: { color: '#58768c', fontSize: 13, marginTop: 13, marginBottom: 22, lineHeight: 20 }, primary: { backgroundColor: '#0089df', padding: 17, borderRadius: 14, alignItems: 'center' }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
 secondary: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#b7d5e9', alignItems: 'center', backgroundColor: '#fff' }, secondaryText: { color: '#0079bc', fontSize: 16, fontWeight: '800' },
 divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 25, marginBottom: 12 }, line: { flex: 1, height: 1, backgroundColor: '#cedfeb' }, or: { color: '#6b859a', fontSize: 12 }, guest: { alignItems: 'center', padding: 12 }, guestText: { color: '#173c57', fontWeight: '800', fontSize: 15 }, guestHint: { color: '#6b859a', fontSize: 12, textAlign: 'center' },
});
