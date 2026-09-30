import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  BookOpen,
  AlertTriangle,
  Users,
  Search,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Cases', icon: Briefcase },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
  { to: '/experts', label: 'Experts', icon: Users },
]

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const casesActive = location.pathname === '/' || location.pathname.startsWith('/cases/')

  return (
    <div className="flex min-h-screen bg-canvas text-text">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-white">
            <ShieldCheck size={16} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold leading-tight tracking-tight">
              Knowledge Trust
            </div>
            <div className="text-[11px] text-text-muted">SD Worx Workspace</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2.5">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/' ? casesActive : false
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={[
                  'flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-secondary hover:bg-canvas hover:text-text',
                ].join(' ')}
                onClick={(e) => {
                  if (to !== '/') {
                    e.preventDefault()
                  }
                }}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-border px-4 py-3 text-[11px] text-text-muted">
          Demo · local mock data
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <div className="relative w-full max-w-md">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
            />
            <input
              type="search"
              placeholder="Search cases, files, customers…"
              className="h-9 w-full rounded-[10px] border border-border bg-canvas pr-3 pl-9 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:bg-surface"
            />
          </div>

          <button
            type="button"
            className="ml-4 flex cursor-pointer items-center gap-2 rounded-[10px] border border-border px-2 py-1.5 hover:bg-canvas"
            onClick={() => navigate('/')}
            aria-label="User menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
              LM
            </div>
            <span className="pr-1 text-[12px] font-medium text-text-secondary">L. Martin</span>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
