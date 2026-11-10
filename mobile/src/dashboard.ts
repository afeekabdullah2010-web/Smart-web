import { isInternal } from './navigation.ts';
export interface Person { key: string; name: string; email: string; role: 'Admin' | 'Staff' | 'Client'; active: boolean }
export interface DashboardData {
 userId: number; role: 'Admin' | 'Staff' | 'Client'; name: string;
 summary: { staff?: number; clients?: number; projects?: number; requests?: number; open?: number; pending?: number; netSalary?: number | null };
 people?: Person[];
 requests?: { id: number; type: string; message: string; status: string }[];
 updates?: { name: string; details: string }[];
 tasks?: { id: number; name: string; site: string; status: string }[];
 attendance?: { site: string; check_out: number | null };
}
export function dashboardPage(url: string, origin: string): boolean {
 if (!isInternal(url, origin)) return false;
 const parsed = new URL(url);
 return ['/admin.html','/staff-dashboard.html','/api/mobile/client/dashboard'].includes(parsed.pathname) && !parsed.searchParams.has('appWorkspace');
}
