import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Conflict } from '../api'
import { humanize } from '../lib/format'

interface Props {
  conflicts: Conflict[]
  expertName?: string
  onCompare: () => void
  onAskExpert: () => void
}

export function ConflictPanel({ conflicts, expertName, onCompare, onAskExpert }: Props) {
  if (conflicts.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-[12px] border border-green/30 bg-green-soft p-4">
        <CheckCircle2 size={16} className="text-green" />
        <h2 className="text-[13px] font-semibold text-green">No unresolved conflicts between the evidence files.</h2>
      </section>
    )
  }

  return (
    <section className="rounded-[12px] border border-amber/30 bg-amber-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber" />
        <h2 className="text-[14px] font-bold text-amber">
          {conflicts.length} unresolved {conflicts.length === 1 ? 'conflict' : 'conflicts'}
        </h2>
      </div>
      <ul className="mb-3 space-y-1.5">
        {conflicts.map((c) => (
          <li key={c.id} className="text-[13px] leading-relaxed text-text-secondary">
            <b className="text-text">{humanize(c.subject)}</b>: “{c.claimA}” in {c.fileA.name} vs “{c.claimB}” in {c.fileB.name}
            <span className="ml-1 text-[11px] font-semibold text-amber uppercase">{c.severity}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCompare}
          className="cursor-pointer rounded-[10px] border border-amber/40 bg-surface px-3 py-2 text-[12px] font-semibold text-text hover:bg-white"
        >
          Compare evidence
        </button>
        <button
          type="button"
          onClick={onAskExpert}
          className="cursor-pointer rounded-[10px] bg-amber px-3 py-2 text-[12px] font-semibold text-white hover:brightness-95"
        >
          {expertName ? `Ask ${expertName.split(' ')[0]}` : 'Ask an expert'}
        </button>
      </div>
    </section>
  )
}
