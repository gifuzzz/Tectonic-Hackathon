import { useState } from 'react'
import { UserRoundCheck, Check } from 'lucide-react'
import { expert } from '../data/mock'

interface Props {
  highlight?: boolean
}

export function ExpertCard({ highlight = false }: Props) {
  const [requested, setRequested] = useState(false)

  return (
    <section
      id="expert-card"
      className={[
        'rounded-[10px] border bg-surface p-3.5 shadow-xs transition-all',
        highlight ? 'border-accent ring-2 ring-accent/20' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
          SV
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-bold text-text truncate">{expert.name}</h3>
            <UserRoundCheck size={13} className="text-green shrink-0" />
          </div>
          <p className="text-[11px] text-text-secondary truncate">{expert.title}</p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1 text-[11px] text-text-muted border-t border-border/70 pt-2">
        <p className="text-text-secondary">{expert.note}</p>
        <p className="font-medium text-text">{expert.relatedCases} related enterprise cases</p>
      </div>

      <div className="mt-3">
        {requested ? (
          <div className="flex items-center justify-center gap-1 rounded-[6px] border border-green/30 bg-green-soft py-1.5 text-[11px] font-semibold text-green">
            <Check size={13} />
            Review Requested
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRequested(true)}
            className="w-full cursor-pointer rounded-[6px] bg-accent py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Request Expert Review
          </button>
        )}
      </div>
    </section>
  )
}
