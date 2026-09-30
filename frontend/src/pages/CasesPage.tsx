import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react'
import { api } from '../api'
import { useApi } from '../lib/useApi'
import { useUser } from '../lib/UserContext'
import { useDrawer } from '../lib/useDrawer'
import { caseStatusStyle, formatDateTime, humanize } from '../lib/format'
import { Empty, ErrorBox, Loading, Panel } from '../components/ui'
import { SuggestionsPanel } from '../components/SuggestionsPanel'
import { FileDetailDrawer } from '../components/FileDetailDrawer'

export function CasesPage() {
  const { version } = useUser()
  const cases = useApi(() => api.cases(), [version])
  const activity = useApi(() => api.activity(12), [version])
  const drawer = useDrawer()

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-text">Cases</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Open a customer case to review trusted Google Drive knowledge, conflicts, and experts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
            {cases.loading && !cases.data && <Loading />}
            {cases.error && <div className="p-3"><ErrorBox message={cases.error} onRetry={cases.reload} /></div>}
            {cases.data && cases.data.length === 0 && (
              <Empty>No cases yet. Load demo data with <code>uv run python manage.py seed_demo</code>.</Empty>
            )}
            {cases.data && cases.data.length > 0 && (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(240px,1.8fr)_110px_minmax(120px,1fr)_110px_130px_24px] gap-2 border-b border-border bg-canvas px-4 py-2.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                    <span>Case</span><span>Country</span><span>Topic</span><span>Status</span><span>Evidence</span><span />
                  </div>
                  {cases.data.map((item) => (
                    <Link
                      key={item.id}
                      to={`/cases/${item.id}`}
                      className="grid grid-cols-[minmax(240px,1.8fr)_110px_minmax(120px,1fr)_110px_130px_24px] items-center gap-2 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-canvas"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-text">{item.title}</div>
                        <div className="mt-0.5 text-[12px] text-text-muted">
                          {item.customer?.name ?? 'All customers'}
                          {item.assignedExpert && ` · ${item.assignedExpert.name}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                        <MapPin size={13} className="shrink-0 text-text-muted" />
                        {item.country || '—'}
                      </div>
                      <div className="text-[13px] text-text-secondary">{humanize(item.topic)}</div>
                      <div>
                        <span className={`inline-flex rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${caseStatusStyle(item.status)}`}>
                          {humanize(item.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                        {item.reviewStatus === 'requested' && <AlertTriangle size={13} className="text-amber" />}
                        {item.evidenceCount} files
                      </div>
                      <ChevronRight size={16} className="justify-self-end text-text-muted" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Panel title="Recent activity" subtitle="Every change to notes, validity, tags and versions is tracked.">
            {activity.loading && !activity.data && <Loading />}
            {activity.error && <div className="p-3"><ErrorBox message={activity.error} /></div>}
            {activity.data && activity.data.length === 0 && <Empty>No activity yet.</Empty>}
            <ul className="divide-y divide-border">
              {activity.data?.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-text-secondary">
                    <b className="text-text">{a.changedBy || 'someone'}</b>{' '}
                    {a.action === 'meta' ? `changed ${a.field} on` : a.action === 'version' ? 'synced a new version of' : 'commented on'}{' '}
                    <button type="button" onClick={() => drawer.open(a.file.id)} className="cursor-pointer font-medium text-accent hover:underline">
                      {a.file.name}
                    </button>
                  </span>
                  <span className="shrink-0 text-text-muted">{formatDateTime(a.changedAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div>
          <SuggestionsPanel onOpenFile={drawer.open} onChanged={activity.reload} />
        </div>
      </div>

      <FileDetailDrawer driveId={drawer.driveId} notice={drawer.notice} onClose={drawer.close} onOpenFile={drawer.open} onChanged={activity.reload} />
    </div>
  )
}
