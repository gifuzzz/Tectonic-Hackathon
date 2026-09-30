import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { api, type CaseDetail, type RankedExpert } from '../api'
import { initials } from '../lib/format'

interface Props {
  caseItem: CaseDetail
  suggested: RankedExpert | null
  highlight?: boolean
  onCaseChanged: (c: CaseDetail) => void
}

export function ExpertCard({ caseItem, suggested, highlight = false, onCaseChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')
  const expert = caseItem.assignedExpert ?? suggested

  const run = async (action: () => Promise<CaseDetail>) => {
    setBusy(true)
    setError(null)
    try {
      onCaseChanged(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="expert-card"
      className={['rounded-[12px] border bg-surface p-4 transition-colors', highlight ? 'border-accent ring-2 ring-accent/20' : 'border-border'].join(' ')}
    >
      {expert ? (
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
            {initials(expert.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[13px] font-bold text-text">{expert.name}</h3>
              <UserRoundCheck size={14} className="text-green" />
            </div>
            <p className="truncate text-[12px] text-text-secondary">{expert.email}</p>
            <p className="text-[12px] text-text-muted">
              {caseItem.assignedExpert ? 'Assigned expert' : 'Suggested expert'}
              {expert.expertiseTags.length > 0 && ` · ${expert.expertiseTags.join(', ')}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[12px] text-text-muted">No matching expert found.</p>
      )}

      {!caseItem.assignedExpert && suggested && suggested.reasons.length > 0 && (
        <ul className="mb-3 list-disc space-y-0.5 pl-4 text-[12px] text-text-secondary">
          {suggested.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      {error && <p className="mb-2 text-[12px] text-red">{error}</p>}

      {caseItem.status === 'resolved' ? (
        <div className="rounded-[10px] border border-green/30 bg-green-soft px-3 py-2 text-[12px] text-green">
          <div className="font-semibold">Resolved</div>
          <div className="mt-0.5 text-text-secondary">{caseItem.resolution}</div>
        </div>
      ) : caseItem.reviewStatus === 'requested' ? (
        <div className="space-y-2">
          <div className="rounded-[10px] border border-green/30 bg-green-soft px-3 py-2 text-center text-[12px] font-semibold text-green">
            Review requested
          </div>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            placeholder="Expert's final resolution…"
            className="w-full resize-y rounded-[10px] border border-border px-3 py-2 text-[12px] focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || !resolution.trim()}
            onClick={() => void run(() => api.resolve(caseItem.id, resolution))}
            className="w-full cursor-pointer rounded-[10px] bg-green px-3 py-2 text-[12px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Resolve case
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.requestReview({ caseId: caseItem.id, expertId: suggested?.id }))}
          className="w-full cursor-pointer rounded-[10px] bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Requesting…' : 'Request review'}
        </button>
      )}
    </section>
  )
}
