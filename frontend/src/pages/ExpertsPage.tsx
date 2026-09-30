import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { api } from '../api'
import { useApi } from '../lib/useApi'
import { initials } from '../lib/format'
import { Badge, Empty, ErrorBox, Loading, Panel } from '../components/ui'

const TOPICS = ['', 'payroll', 'social_security', 'tax', 'leave', 'benefits', 'termination', 'onboarding', 'time_registration', 'expenses', 'compliance']

export function ExpertsPage() {
  const [filters, setFilters] = useState({ topic: '', country: '', customer: '' })
  // Only send complete ISO codes; a half-typed "B" would be rejected by the backend.
  const country = filters.country.length === 2 ? filters.country : ''
  const { data, error, loading, reload } = useApi(
    () => api.experts({ ...filters, country }),
    [filters.topic, country, filters.customer],
  )
  const customers = useApi(() => api.customers(), [])
  const filtered = Boolean(filters.topic || country || filters.customer)

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-text">Experts</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Ranked by the documents they own, past cases, customer history and expertise tags.
        </p>
      </div>
      <Panel
        title="Find an expert"
        action={
          <div className="flex flex-wrap gap-2">
            <select value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
              className="rounded-[8px] border border-border px-2 py-1 text-[12px]" aria-label="Topic">
              {TOPICS.map((t) => <option key={t} value={t}>{t ? t.replace(/_/g, ' ') : 'Any topic'}</option>)}
            </select>
            <input value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="Country (BE)" className="w-[110px] rounded-[8px] border border-border px-2 py-1 text-[12px]" />
            <select value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
              className="rounded-[8px] border border-border px-2 py-1 text-[12px]" aria-label="Customer">
              <option value="">Any customer</option>
              {customers.data?.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        }
      >
        {loading && !data && <Loading />}
        {error && <div className="p-3"><ErrorBox message={error} onRetry={reload} /></div>}
        {data && data.length === 0 && <Empty>No experts yet. Add them in the Django admin (/admin/).</Empty>}
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {data?.map((e) => (
            <li key={e.id} className="rounded-[12px] border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
                  {initials(e.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[13px] font-bold text-text">{e.name}</h3>
                    <UserRoundCheck size={14} className="text-green" />
                    {filtered && <span className="ml-auto text-[11px] font-semibold text-accent">score {e.score}</span>}
                  </div>
                  <p className="truncate text-[12px] text-text-secondary">{e.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.expertiseTags.map((t) => <Badge key={t} className="bg-canvas text-text-secondary">{t}</Badge>)}
                    {e.customers.map((c) => <Badge key={c} className="bg-accent-soft text-accent">{c}</Badge>)}
                  </div>
                  {filtered && e.reasons.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-text-secondary">
                      {e.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
