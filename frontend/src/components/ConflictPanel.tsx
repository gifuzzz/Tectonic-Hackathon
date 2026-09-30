import { AlertTriangle } from 'lucide-react'
import { conflict } from '../data/mock'

interface Props {
  onCompare: () => void
  onAskSophie: () => void
}

export function ConflictPanel({ onCompare, onAskSophie }: Props) {
  return (
    <section className="rounded-[12px] border border-amber/30 bg-amber-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber" />
        <h2 className="text-[14px] font-bold text-amber">{conflict.title}</h2>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-text-secondary">{conflict.summary}</p>
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
          onClick={onAskSophie}
          className="cursor-pointer rounded-[10px] bg-amber px-3 py-2 text-[12px] font-semibold text-white hover:brightness-95"
        >
          Ask Sophie
        </button>
      </div>
    </section>
  )
}
