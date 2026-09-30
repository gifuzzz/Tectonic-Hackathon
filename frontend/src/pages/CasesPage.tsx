import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react'
import { cases } from '../data/mock'

function statusStyles(status: string) {
  if (status === 'Open') return 'bg-accent-soft text-accent'
  if (status === 'In review') return 'bg-amber-soft text-amber'
  return 'bg-green-soft text-green'
}

export function CasesPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-text">Cases</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Open a customer case to review trusted Google Drive knowledge, conflicts, and experts.
        </p>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-canvas text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 font-semibold">Country</th>
                <th className="px-3 py-2.5 font-semibold">Topic</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Conflicts</th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => {
                const isPrimary = item.id === 'northstar-overtime'
                return (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    <td className="p-0" colSpan={6}>
                      <Link
                        to={`/cases/${item.id}`}
                        className={[
                          'grid grid-cols-[minmax(220px,1.6fr)_120px_minmax(140px,1fr)_110px_140px_32px] items-center gap-2 px-4 py-3.5 transition-colors',
                          isPrimary ? 'bg-accent-soft/40 hover:bg-accent-soft/70' : 'hover:bg-canvas',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-text">{item.customer}</span>
                            {isPrimary && (
                              <span className="rounded-[6px] bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                Demo
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[12px] text-text-muted">{item.topic}</div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                          <MapPin size={13} className="shrink-0 text-text-muted" />
                          {item.country}
                        </div>

                        <div className="text-[13px] text-text-secondary">{item.topic}</div>

                        <div>
                          <span
                            className={`inline-flex rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${statusStyles(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[13px]">
                          {item.unresolvedConflicts > 0 ? (
                            <>
                              <AlertTriangle size={14} className="shrink-0 text-amber" />
                              <span className="font-medium text-amber">
                                {item.unresolvedConflicts} unresolved
                              </span>
                            </>
                          ) : (
                            <span className="text-text-muted">None</span>
                          )}
                        </div>

                        <ChevronRight size={16} className="justify-self-end text-text-muted" />
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
