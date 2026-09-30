import { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import type { TrustSignal } from '../data/mock'

function levelDot(level: TrustSignal['level']) {
  if (level === 'warning') return 'bg-amber'
  if (level === 'strong' || level === 'current' || level === 'verified' || level === 'approved')
    return 'bg-green'
  return 'bg-text-muted'
}

function levelChip(level: TrustSignal['level']) {
  if (level === 'warning') return 'text-amber bg-amber-soft font-semibold'
  if (level === 'strong' || level === 'current' || level === 'verified' || level === 'approved')
    return 'text-green bg-green-soft font-semibold'
  return 'text-text-secondary bg-canvas'
}

interface Props {
  signals: TrustSignal[]
}

export function TrustPanel({ signals }: Props) {
  const [openId, setOpenId] = useState<string | null>('context')

  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-xs">
      <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-accent" />
          <h2 className="text-[13px] font-bold text-text">Trust Signals</h2>
        </div>
        <span className="text-[11px] text-text-muted">Multi-factor validation</span>
      </div>

      <ul className="divide-y divide-border/60">
        {signals.map((signal) => {
          const open = openId === signal.id
          return (
            <li key={signal.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left hover:bg-canvas/60 transition-colors"
                onClick={() => setOpenId(open ? null : signal.id)}
                aria-expanded={open}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${levelDot(signal.level)}`} />
                <span className="min-w-0 flex-1 text-[12px] font-medium text-text">{signal.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${levelChip(signal.level)}`}
                >
                  {signal.value}
                </span>
                {open ? (
                  <ChevronDown size={13} className="text-text-muted shrink-0" />
                ) : (
                  <ChevronRight size={13} className="text-text-muted shrink-0" />
                )}
              </button>
              {open && (
                <div className="px-3.5 pb-2.5 pl-6 text-[11px] leading-relaxed text-text-secondary">
                  {signal.explanation}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
