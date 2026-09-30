import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TrustSignal } from '../data/mock'

function levelDot(level: TrustSignal['level']) {
  if (level === 'warning') return 'bg-amber'
  if (level === 'strong' || level === 'current' || level === 'verified' || level === 'approved')
    return 'bg-green'
  return 'bg-text-muted'
}

function levelChip(level: TrustSignal['level']) {
  if (level === 'warning') return 'text-amber bg-amber-soft'
  if (level === 'strong' || level === 'current' || level === 'verified' || level === 'approved')
    return 'text-green bg-green-soft'
  return 'text-text-secondary bg-canvas'
}

interface Props {
  signals: TrustSignal[]
}

export function TrustPanel({ signals }: Props) {
  const [openId, setOpenId] = useState<string | null>('context')

  return (
    <section className="rounded-[12px] border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-bold text-text">Why can I trust this?</h2>
        <p className="mt-0.5 text-[12px] text-text-muted">Signals for the selected evidence — not a single score.</p>
      </div>

      <ul className="divide-y divide-border">
        {signals.map((signal) => {
          const open = openId === signal.id
          return (
            <li key={signal.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left hover:bg-canvas"
                onClick={() => setOpenId(open ? null : signal.id)}
                aria-expanded={open}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${levelDot(signal.level)}`} />
                <span className="min-w-0 flex-1 text-[13px] font-medium text-text">{signal.label}</span>
                <span
                  className={`rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${levelChip(signal.level)}`}
                >
                  {signal.value}
                </span>
                {open ? (
                  <ChevronDown size={14} className="text-text-muted" />
                ) : (
                  <ChevronRight size={14} className="text-text-muted" />
                )}
              </button>
              {open && (
                <p className="px-4 pb-3 pl-[30px] text-[12px] leading-relaxed text-text-secondary">
                  {signal.explanation}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
