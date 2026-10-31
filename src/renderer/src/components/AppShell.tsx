import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Flag,
  LayoutDashboard,
  LogOut,
  Power,
  Settings,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { USER_ROLE_LABELS } from '@shared/labels';
import { useAuth, useIsAdmin } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { call } from '@/lib/ipc';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Nadzorna plošča', icon: LayoutDashboard },
  { to: '/officials', label: 'Sodniki', icon: Users },
  { to: '/competitions', label: 'Tekmovanja', icon: Flag },
  { to: '/payments', label: 'Izplačila', icon: Wallet },
  { to: '/exports', label: 'Izpisi', icon: FileSpreadsheet },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/settings', label: 'Nastavitve', icon: Settings },
  { to: '/users', label: 'Uporabniki', icon: UserCog },
];

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white',
          isActive && 'bg-white/15 font-medium text-white',
        )
      }
    >
      <item.icon className="size-4" />
      {item.label}
    </NavLink>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const version = useQuery({ queryKey: ['app', 'version'], queryFn: () => call('app:getVersion'), staleTime: Infinity });

  return (
    <div className="flex h-full">
      <aside className="sidebar-gradient flex w-60 shrink-0 flex-col text-white">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="brand-gradient flex size-9 items-center justify-center rounded-lg text-sm font-bold shadow">ZAS</div>
          <div>
            <div className="text-base leading-tight font-semibold">ZAS Novo mesto</div>
            <div className="text-xs text-white/60">Sledenje izplačilom</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-white/10" />
              {ADMIN_NAV.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {(user?.name ?? '?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-white/60">{user?.role === 'admin' ? USER_ROLE_LABELS.admin : USER_ROLE_LABELS.user}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => void signOut()}>
              <LogOut /> Odjava
            </Button>
            <Button variant="outline" size="icon" className="size-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" title="Zapri aplikacijo" onClick={() => setConfirmQuit(true)}>
              <Power />
            </Button>
          </div>
          <div className="text-xs text-white/40">Verzija {version.data ?? ''}</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-[1500px]">
          <Outlet />
        </div>
      </main>
      <ConfirmDialog
        open={confirmQuit}
        onOpenChange={setConfirmQuit}
        title="Zapri aplikacijo"
        description="Ali ste prepričani, da želite zapreti aplikacijo?"
        confirmLabel="Zapri"
        destructive
        onConfirm={() => void call('app:quit')}
      />
    </div>
  );
}
