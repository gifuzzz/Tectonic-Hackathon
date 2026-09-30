import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { useApi } from '../lib/useApi'
import { formatDate, humanize } from '../lib/format'
import { Badge, Empty, ErrorBox, Loading, Panel } from '../components/ui'

export function ConflictsPage() {
  const [showResolved, setShowResolved] = useState(false)
  const { data, error, loading, reload } = useApi(() => api.conflicts(showResolved ? undefined : false), [showResolved])

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-text">Conflicts</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Related documents (same topic, customer, country and overlapping validity) that make opposing claims.
        </p>
      </div>
      <Panel
        title={showResolved ? 'All conflicts' : 'Unresolved conflicts'}
        action={
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
          </label>
        }
      >
        {loading && !data && <Loading />}
        {error && <div className="p-3"><ErrorBox message={error} onRetry={reload} /></div>}
        {data && data.length === 0 && <Empty>No conflicts. 🎉</Empty>}
        <ul className="divide-y divide-border">
          {data?.map((c) => (
            <li key={c.id} className="px-4 py-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {c.resolved ? <CheckCircle2 size={15} className="text-green" /> : <AlertTriangle size={15} className="text-amber" />}
                <span className="text-[14px] font-semibold text-text">{humanize(c.subject)}</span>
                <Badge className={c.severity === 'high' ? 'bg-red-soft text-red' : c.severity === 'medium' ? 'bg-amber-soft text-amber' : 'bg-canvas text-text-muted'}>
                  {c.severity}
                </Badge>
                <span className="ml-auto text-[11px] text-text-muted">Detected {formatDate(c.detectedAt)}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-border bg-canvas p-3">
                  <p className="text-[14px] font-semibold text-text">“{c.claimA}”</p>
                  <p className="mt-1 text-[12px] text-text-muted">{c.fileA.name}</p>
                </div>
                <div className="rounded-[10px] border border-border bg-canvas p-3">
                  <p className="text-[14px] font-semibold text-text">“{c.claimB}”</p>
                  <p className="mt-1 text-[12px] text-text-muted">{c.fileB.name}</p>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-text-secondary">{c.resolved ? `Resolved: ${c.resolutionNote}` : c.reasons.join(' · ')}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
