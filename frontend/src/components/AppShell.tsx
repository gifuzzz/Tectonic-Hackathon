import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, BookOpen, AlertTriangle, Users, Search, ShieldCheck } from 'lucide-react'
import { useUser } from '../lib/UserContext'
import { initials } from '../lib/format'

const navItems = [
  { to: '/', label: 'Cases', icon: Briefcase },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
  { to: '/experts', label: 'Experts', icon: Users },
]

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { users, user, switchUser } = useUser()
  const [query, setQuery] = useState('')

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' || location.pathname.startsWith('/cases/') : location.pathname.startsWith(to)

  return (
    <div className="flex min-h-screen bg-canvas text-text">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-white">
            <ShieldCheck size={16} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] leading-tight font-bold tracking-tight">Knowledge Trust</div>
            <div className="text-[11px] text-text-muted">SD Worx Workspace</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={[
                'flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors',
                isActive(to) ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-canvas hover:text-text',
              ].join(' ')}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3 text-[11px] text-text-muted">
          {user ? (
            <>
              Viewing as <b className="text-text-secondary">{user.name}</b>
              <br />
              {user.seeAll ? 'Sees all files' : `Access: ${[...user.companies, ...user.countries].join(', ') || 'untagged files only'}`}
            </>
          ) : 'Connected to the Django backend'}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-5">
          <form
            className="relative w-full max-w-md"
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim()) navigate(`/knowledge?q=${encodeURIComponent(query.trim())}`)
            }}
          >
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask or search: meal voucher Acme Belgium…"
              className="h-9 w-full rounded-[10px] border border-border bg-canvas pr-3 pl-9 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:bg-surface"
            />
          </form>

          <label className="flex shrink-0 items-center gap-2 rounded-[10px] border border-border px-2 py-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
              {initials(user?.name ?? '?')}
            </span>
            <select
              value={user?.email ?? ''}
              onChange={(e) => switchUser(e.target.value)}
              aria-label="Switch user"
              className="cursor-pointer bg-transparent pr-1 text-[12px] font-medium text-text-secondary"
            >
              {users.length === 0 && <option value="">No users</option>}
              {users.map((u) => (
                <option key={u.email} value={u.email}>{u.name}</option>
              ))}
            </select>
          </label>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-1.5 md:hidden">
          {navItems.map(({ to, label }) => (
            <NavLink key={to} to={to} className={`rounded-[8px] px-2.5 py-1 text-[12px] font-medium ${isActive(to) ? 'bg-accent-soft text-accent' : 'text-text-secondary'}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
