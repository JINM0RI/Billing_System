import { NavLink } from 'react-router-dom';
import { ActivitySquare, Boxes, Building2, LogOut, ReceiptText, ShieldCheck, ShoppingBag, Tag, Users2 } from 'lucide-react';
import type { RoleName } from '../../types';

const navItems = [
  { to: '/', label: 'Overview', icon: ActivitySquare, roles: ['Admin', 'Manager', 'Employee'] as RoleName[] },
  { to: '/employees', label: 'Employees', icon: Users2, roles: ['Admin', 'Manager'] as RoleName[] },
  { to: '/purchase', label: 'Purchase', icon: Building2, roles: ['Admin', 'Manager', 'Employee'] as RoleName[] },
  { to: '/stock', label: 'Stock', icon: Boxes, roles: ['Admin', 'Manager', 'Employee'] as RoleName[] },
  { to: '/product', label: 'Product', icon: Tag, roles: ['Admin', 'Manager', 'Employee'] as RoleName[] },
  { to: '/billing', label: 'Billing', icon: ReceiptText, roles: ['Admin', 'Manager', 'Employee'] as RoleName[] },
  { to: '/sales', label: 'Sales', icon: ShoppingBag, roles: ['Admin', 'Manager'] as RoleName[] },
];

export default function AppShell({ role, onLogout, children }: { role: RoleName; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-6 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="panel-soft flex flex-col gap-6 p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-glow">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Billing System</p>
                <h1 className="text-xl font-semibold">Local Desktop POS</h1>
              </div>
            </div>
            <div className="chip">Role: {role}</div>
          </div>

          <nav className="flex flex-1 flex-col gap-2">
            {navItems.filter((item) => item.roles.includes(role)).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${isActive ? 'bg-amber-400 text-slate-950 shadow-glow' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`
                  }
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <button className="btn-secondary justify-start gap-3" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </aside>

        <main className="flex min-h-screen flex-col gap-6">
          <section className="flex-1 pb-4">{children}</section>
        </main>
      </div>
    </div>
  );
}
