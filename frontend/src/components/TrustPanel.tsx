import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Trust } from '../api'
import { Badge } from './ui'
import { humanize, verdictLabel, verdictStyle } from '../lib/format'

type Level = 'good' | 'warn' | 'bad' | 'neutral'

interface Signal {
  id: string
  label: string
  value: string
  level: Level
  explanation: string
}

function detail(trust: Trust, rule: string): string {
  return trust.checks.find((c) => c.rule === rule)?.detail ?? ''
}

function signals(trust: Trust): Signal[] {
  const ctx = trust.contextMatch
  return [
    {
      id: 'context', label: 'Context match', value: humanize(ctx),
      level: ctx === 'strong' ? 'good' : ctx === 'mismatch' ? 'bad' : ctx === 'unknown' ? 'neutral' : 'warn',
      explanation: [detail(trust, 'correct_country'), detail(trust, 'correct_customer')].filter(Boolean).join('. '),
    },
    {
      id: 'authority', label: 'Authority', value: humanize(trust.authority),
      level: trust.authority === 'official' ? 'good' : trust.authority === 'archived' ? 'bad' : 'warn',
      explanation: detail(trust, 'approved'),
    },
    {
      id: 'recency', label: 'Recency', value: humanize(trust.recency),
      level: trust.recency === 'current' ? 'good' : trust.recency === 'expired' ? 'bad' : 'warn',
      explanation: detail(trust, 'current'),
    },
    {
      id: 'owner', label: 'Owner', value: trust.ownerVerified ? 'Verified' : 'Not verified',
      level: trust.ownerVerified ? 'good' : 'warn', explanation: detail(trust, 'owner_exists'),
    },
    {
      id: 'superseded', label: 'Superseded', value: trust.superseded ? 'Yes' : 'No',
      level: trust.superseded ? 'bad' : 'good', explanation: detail(trust, 'superseded'),
    },
    {
      id: 'customer', label: 'Customer-specific', value: trust.customerSpecific ? 'Yes' : 'Generic',
      level: 'neutral', explanation: detail(trust, 'customer_specific'),
    },
    {
      id: 'conflicts', label: 'Conflicts', value: trust.conflicts ? `${trust.conflicts} unresolved` : 'None',
      level: trust.conflicts ? 'warn' : 'good', explanation: detail(trust, 'conflicting_source'),
    },
  ]
}

const DOT: Record<Level, string> = { good: 'bg-green', warn: 'bg-amber', bad: 'bg-red', neutral: 'bg-text-muted' }
const CHIP: Record<Level, string> = {
  good: 'text-green bg-green-soft', warn: 'text-amber bg-amber-soft', bad: 'text-red bg-red-soft',
  neutral: 'text-text-secondary bg-canvas',
}

export function TrustPanel({ trust, fileName, bare = false }: { trust: Trust | null; fileName?: string; bare?: boolean }) {
  const [openId, setOpenId] = useState<string | null>('context')

  const body = trust ? (
    <ul className="divide-y divide-border">
      {signals(trust).map((signal) => {
        const open = openId === signal.id
        return (
          <li key={signal.id}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left hover:bg-canvas"
              onClick={() => setOpenId(open ? null : signal.id)}
              aria-expanded={open}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[signal.level]}`} />
              <span className="min-w-0 flex-1 text-[13px] font-medium text-text">{signal.label}</span>
              <span className={`rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${CHIP[signal.level]}`}>{signal.value}</span>
              {open ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            </button>
            {open && signal.explanation && (
              <p className="px-4 pb-3 pl-[30px] text-[12px] leading-relaxed text-text-secondary">{signal.explanation}</p>
            )}
          </li>
        )
      })}
    </ul>
  ) : (
    <p className="px-4 py-4 text-[12px] text-text-muted">Select a file to see its trust signals.</p>
  )

  if (bare) return body
  return (
    <section className="rounded-[12px] border border-border bg-surface">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-text">Why can I trust this?</h2>
          <p className="mt-0.5 truncate text-[12px] text-text-muted">
            {fileName ? fileName : 'Signals for the selected evidence — not a single score.'}
          </p>
        </div>
        {trust && <Badge className={verdictStyle(trust.verdict)}>{verdictLabel(trust.verdict)}</Badge>}
      </div>
      {body}
    </section>
  )
}
