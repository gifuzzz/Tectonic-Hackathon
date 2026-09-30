import { AlertTriangle, ChevronRight, MessageSquare } from 'lucide-react'
import { conflict } from '../data/mock'

interface Props {
  onCompare: () => void
  onAskSophie: () => void
}

export function ConflictPanel({ onCompare, onAskSophie }: Props) {
  return (
    <section className="rounded-[10px] border border-amber/25 bg-amber-soft/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber text-white">
            <AlertTriangle size={11} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-amber">{conflict.title}</h3>
              <span className="rounded bg-amber/15 px-1.5 py-0.2 text-[10px] font-semibold text-amber">
                Requires Review
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              {conflict.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-amber/20">
        <button
          type="button"
          onClick={onCompare}
          className="cursor-pointer inline-flex items-center gap-1 rounded-[6px] border border-amber/40 bg-surface px-2.5 py-1 text-[11px] font-semibold text-text hover:bg-white transition-colors"
        >
          Compare evidence
          <ChevronRight size={12} className="text-text-muted" />
        </button>
        <button
          type="button"
          onClick={onAskSophie}
          className="cursor-pointer inline-flex items-center gap-1 rounded-[6px] bg-amber px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-95 transition-colors"
        >
          <MessageSquare size={11} />
          Ask Sophie
        </button>
      </div>
    </section>
  )
}
