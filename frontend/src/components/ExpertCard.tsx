import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
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
        'rounded-[12px] border bg-surface p-4 transition-colors',
        highlight ? 'border-accent ring-2 ring-accent/20' : 'border-border',
      ].join(' ')}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
          SV
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-bold text-text">{expert.name}</h3>
            <UserRoundCheck size={14} className="text-green" />
          </div>
          <p className="text-[12px] text-text-secondary">{expert.title}</p>
          <p className="text-[12px] text-text-muted">{expert.team}</p>
        </div>
      </div>

      <div className="mb-3 space-y-1 text-[12px] text-text-secondary">
        <p>{expert.note}</p>
        <p className="font-medium text-text">{expert.relatedCases} related cases</p>
      </div>

      {requested ? (
        <div className="rounded-[10px] border border-green/30 bg-green-soft px-3 py-2 text-center text-[12px] font-semibold text-green">
          Review requested
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRequested(true)}
          className="w-full cursor-pointer rounded-[10px] bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover"
        >
          Request review
        </button>
      )}
    </section>
  )
}
