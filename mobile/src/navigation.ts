export type AccountRole = 'Admin' | 'Staff' | null;
export type Tab = 'home' | 'services' | 'projects' | 'contact' | 'workspace';
export const DEFAULT_SITE = 'https://smpowenginnworks.netlify.app';

export function siteOrigin(value = DEFAULT_SITE): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The app website must be an HTTPS origin, without a path or credentials.');
  }
  return url.origin;
}
export function isInternal(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === origin && !parsed.username && !parsed.password;
  } catch { return false; }
}
export function externalKind(value: string): 'web' | 'contact' | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return 'web';
    if (['tel:', 'mailto:'].includes(url.protocol)) return 'contact';
  } catch { /* Reject malformed URLs. */ }
  return null;
}
export function tabUrl(tab: Tab, origin: string, role: AccountRole): string {
  const paths = { home: '/', services: '/services.html', projects: '/our-projects.html', contact: '/contact.html', workspace: role === 'Admin' ? '/admin.html' : role === 'Staff' ? '/staff-dashboard.html' : '/auth/login' };
  return origin + paths[tab];
}
export function tabForUrl(url: string): Tab {
  const path = new URL(url).pathname;
  if (path.startsWith('/api/staff/') || path.startsWith('/api/admin/') || path.startsWith('/auth/') || /^\/(admin|profile|staff-|team|materials|finance|clients|reports|settings|projects\.html)/.test(path)) return 'workspace';
  if (path.startsWith('/service')) return 'services';
  if (path.startsWith('/our-projects')) return 'projects';
  if (path.startsWith('/contact')) return 'contact';
  return 'home';
}
export function canDownload(url: string, origin: string): boolean {
  if (!isInternal(url, origin)) return false;
  return ['/api/admin/reports', '/api/staff/payslip'].includes(new URL(url).pathname);
}
export function downloadName(value: unknown, mime: string): string {
  const name = String(value || 'smart-power').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 90) || 'smart-power';
  const ext = mime === 'text/csv' ? '.csv' : '.html';
  return name.toLowerCase().endsWith(ext) ? name : name + ext;
}
