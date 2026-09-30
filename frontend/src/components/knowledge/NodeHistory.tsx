import { Clock, User } from 'lucide-react'
import type { HistoryEntry } from '../../data/knowledge'
import { formatDate } from '../../lib/knowledgeUtils'

interface Props {
  history: HistoryEntry[]
}

function formatValue(val: unknown): string {
  if (val == null) return '—'
  if (Array.isArray(val)) return val.join(', ') || 'none'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function NodeHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-canvas/60 p-3 text-center text-[12px] text-text-muted">
        No modifications recorded yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-text-muted uppercase">
        <Clock size={12} />
        <span>Change history ({history.length})</span>
      </div>
      <div className="space-y-1.5">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="rounded-[8px] border border-border bg-canvas/40 px-3 py-2 text-[11px]"
          >
            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1 font-semibold text-text">
                <User size={11} className="text-text-muted" />
                {entry.changed_by ?? 'System'}
              </span>
              <span>{formatDate(entry.changed_at)}</span>
            </div>
            <div className="mt-1 text-text-secondary">
              <span className="font-semibold text-text">{entry.field}</span>: {' '}
              <span className="text-text-muted line-through">{formatValue(entry.old_value)}</span>
              {' → '}
              <span className="font-medium text-accent">{formatValue(entry.new_value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
