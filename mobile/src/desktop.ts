import type { AccountRole } from './navigation';
import type { DashboardData } from './dashboard';
export interface DesktopState {
 url: string; loading: boolean; error: string | null; canGoBack: boolean;
 role: AccountRole; id: number | null; dashboard: DashboardData | null;
}
export type DesktopCommand = { type: 'navigate'; path: string } | { type: 'auth'; action: 'login' | 'register'; role: Exclude<AccountRole,null> } | { type: 'guest' | 'back' | 'reload' | 'logout' };
export interface DesktopBridge {
 getState(): Promise<DesktopState>;
 command(command: DesktopCommand): Promise<void>;
 surface(rect: { x: number; y: number; width: number; height: number } | null): Promise<void>;
 onState(listener: (state: DesktopState) => void): () => void;
}
declare global { interface Window { smartPowerDesktop?: DesktopBridge } }
