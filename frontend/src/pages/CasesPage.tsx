import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react'
import { cases } from '../data/mock'

function statusStyles(status: string) {
  if (status === 'Open') return 'bg-accent/10 text-accent font-semibold'
  if (status === 'In review') return 'bg-amber-soft text-amber font-semibold'
  return 'bg-green-soft text-green font-semibold'
}

export function CasesPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-text">Customer Cases</h1>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Select a case to inspect trusted Google Drive policies, resolve uncertainties, and verify workflows.
          </p>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
          {cases.length} active cases
        </span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-text-muted">
                <th className="px-4 py-2.5 font-medium">Customer & Case</th>
                <th className="px-3 py-2.5 font-medium">Country</th>
                <th className="px-3 py-2.5 font-medium">Topic</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Conflicts</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {cases.map((item) => {
                const isPrimary = item.id === 'northstar-overtime'
                return (
                  <tr key={item.id} className="transition-colors hover:bg-canvas/50">
                    <td className="p-0" colSpan={6}>
                      <Link
                        to={`/cases/${item.id}`}
                        className={[
                          'grid grid-cols-[minmax(240px,1.6fr)_110px_minmax(140px,1fr)_100px_130px_32px] items-center gap-2 px-4 py-3 transition-colors',
                          isPrimary ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-canvas',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-accent/10 text-accent font-bold text-[11px]">
                            {item.customer.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-text truncate">
                                {item.customer}
                              </span>
                              {isPrimary && (
                                <span className="rounded bg-accent px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                                  Primary Demo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted truncate">{item.topic}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[12px] text-text-secondary">
                          <MapPin size={12} className="shrink-0 text-text-muted" />
                          <span>{item.country}</span>
                        </div>

                        <div className="text-[12px] text-text-secondary truncate">{item.topic}</div>

                        <div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${statusStyles(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[12px]">
                          {item.unresolvedConflicts > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber font-medium">
                              <AlertTriangle size={13} className="shrink-0 text-amber" />
                              {item.unresolvedConflicts} conflict
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">Verified</span>
                          )}
                        </div>

                        <ChevronRight size={15} className="justify-self-end text-text-muted" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
