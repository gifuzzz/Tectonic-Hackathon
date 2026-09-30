import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, HardDrive, MessageSquare, RefreshCw } from 'lucide-react'
import { api, type DriveNode } from '../api'
import { useApi } from '../lib/useApi'
import { useUser } from '../lib/UserContext'
import { useDrawer } from '../lib/useDrawer'
import { formatDate, humanize, initials, verdictLabel, verdictStyle } from '../lib/format'
import { Avatar, Badge, Empty, ErrorBox, FileIcon, Loading, Panel, ValidityBadge } from '../components/ui'
import { FileDetailDrawer } from '../components/FileDetailDrawer'

// Drive browser (?path=) and knowledge search (?q=): Drive data + our data + detected knowledge together.
export function KnowledgePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const path = params.get('path') ?? ''
  const drawer = useDrawer()

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Knowledge</h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Browse Google Drive with your team's notes, tags and validity — or search it with trust signals.
          </p>
        </div>
        <SyncButton />
      </div>

      {query ? (
        <SearchResults query={query} onOpen={drawer.open} onClear={() => setParams({})} />
      ) : (
        <Browser path={path} onNavigate={(p) => setParams(p ? { path: p } : {})} onOpen={drawer.open} />
      )}

      <FileDetailDrawer driveId={drawer.driveId} notice={drawer.notice} onClose={drawer.close} onOpenFile={drawer.open} />
    </div>
  )
}

function Browser({ path, onNavigate, onOpen }: { path: string; onNavigate: (path: string) => void; onOpen: (id: string) => void }) {
  const { version } = useUser()
  const { data, error, loading, reload } = useApi(() => api.browse(path), [path, version])

  const openNode = (node: DriveNode) => {
    if (node.type === 'folder') onNavigate(node.fullPath)
    else if (node.id) onOpen(node.id)
  }

  return (
    <section className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]" aria-label="Breadcrumb">
          <button type="button" onClick={() => onNavigate('')} className="flex cursor-pointer items-center gap-1.5 font-medium text-text-secondary hover:text-accent">
            <HardDrive size={14} /> Drive
          </button>
          {data?.breadcrumbs.map((b) => (
            <span key={b.path} className="flex items-center gap-1">
              <ChevronRight size={13} className="text-text-muted" />
              <button type="button" onClick={() => onNavigate(b.path)} className="cursor-pointer font-medium text-text-secondary hover:text-accent">
                {b.name}
              </button>
            </span>
          ))}
        </nav>
        {data && !data.folder.virtual && data.folder.id && (
          <button type="button" onClick={() => onOpen(data.folder.id!)}
            className="flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:bg-canvas">
            <MessageSquare size={13} /> Folder notes & tags
            {data.folder.notesCount > 0 && <span className="rounded-full bg-accent-soft px-1.5 text-[10px] text-accent">{data.folder.notesCount}</span>}
          </button>
        )}
      </div>

      {data?.folder.meta && (data.folder.meta.tags.length > 0 || data.folder.meta.category || data.folder.meta.validity) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-canvas px-4 py-2">
          <ValidityBadge validity={data.folder.meta.validity} />
          {data.folder.meta.category && <Badge className="bg-surface text-text-secondary">{data.folder.meta.category}</Badge>}
          {data.folder.meta.tags.map((t) => <Badge key={t} className="bg-surface text-text-muted">#{t}</Badge>)}
        </div>
      )}

      {loading && !data && <Loading />}
      {error && <div className="p-3"><ErrorBox message={error} onRetry={reload} /></div>}
      {data && data.children.length === 0 && (
        <Empty>{path ? 'This folder is empty (or you have no access to its files).' : 'No files yet. Sync Google Drive or load the demo data.'}</Empty>
      )}
      {data && data.children.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-canvas text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">Owner</th>
                <th className="px-3 py-2.5 font-semibold">Modified</th>
                <th className="px-3 py-2.5 font-semibold">Knowledge</th>
                <th className="px-3 py-2.5 font-semibold">Tags</th>
                <th className="px-4 py-2.5 font-semibold">Validity</th>
              </tr>
            </thead>
            <tbody>
              {data.children.map((node) => {
                const owner = node.drive?.owners[0]
                return (
                  <tr
                    key={node.id ?? node.fullPath}
                    tabIndex={0}
                    role="button"
                    onClick={() => openNode(node)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openNode(node))}
                    className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-canvas"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FileIcon mimeType={node.type === 'folder' ? 'application/vnd.google-apps.folder' : node.mimeType} />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-text">{node.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted">
                            {node.type === 'folder' ? `${node.childCount ?? 0} items` : node.version > 0 ? `v${node.version}` : ''}
                            {node.notesCount > 0 && <span className="flex items-center gap-0.5"><MessageSquare size={10} />{node.notesCount}</span>}
                            {node.meta?.companies.map((c) => <span key={c} className="text-accent">{c}</span>)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {owner ? (
                        <div className="flex items-center gap-2">
                          <Avatar label={initials(owner.name || owner.email)} />
                          <span className="truncate text-[12px] text-text-secondary">{owner.name || owner.email}</span>
                        </div>
                      ) : <span className="text-[12px] text-text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-text-secondary">{formatDate(node.drive?.modifiedAt)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-text-secondary">
                      {node.knowledge ? (
                        <div className="flex flex-wrap gap-1">
                          {node.knowledge.country && <Badge className="bg-canvas text-text-secondary">{node.knowledge.country}</Badge>}
                          {node.knowledge.topic && <Badge className="bg-canvas text-text-secondary">{humanize(node.knowledge.topic)}</Badge>}
                          {node.knowledge.status !== 'unknown' && <Badge className="bg-canvas text-text-muted">{humanize(node.knowledge.status)}</Badge>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {node.meta?.tags.map((t) => <span key={t} className="text-[11px] text-text-muted">#{t}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><ValidityBadge validity={node.meta?.validity} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function SearchResults({ query, onOpen, onClear }: { query: string; onOpen: (id: string) => void; onClear: () => void }) {
  const { version } = useUser()
  const { data, error, loading, reload } = useApi(() => api.search(query, {}), [query, version])

  return (
    <Panel
      title={`Results for “${query}”`}
      subtitle={data && (
        <>
          Understood as: {[data.context.country, data.context.customer?.name, humanize(data.context.topic)].filter((x) => x && x !== '—').join(' · ') || 'no specific context'}
        </>
      )}
      action={<button type="button" onClick={onClear} className="cursor-pointer text-[12px] font-semibold text-accent">Back to browsing</button>}
    >
      {loading && !data && <Loading label="Searching…" />}
      {error && <div className="p-3"><ErrorBox message={error} onRetry={reload} /></div>}
      {data && data.results.length === 0 && <Empty>No matching documents.</Empty>}
      {data && data.conflicts.length > 0 && (
        <div className="border-b border-border bg-amber-soft px-4 py-2 text-[12px] text-amber">
          {data.conflicts.length} conflict(s) between these results — check the trust signals before answering.
        </div>
      )}
      <ul className="divide-y divide-border">
        {data?.results.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.driveId)} className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-canvas">
              <FileIcon mimeType={r.mimeType} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-text">{r.name}</span>
                  <Badge className={verdictStyle(r.trust.verdict)}>{r.trust.superseded ? 'Superseded' : verdictLabel(r.trust.verdict)}</Badge>
                  {r.trust.conflicts > 0 && <Badge className="bg-amber-soft text-amber">{r.trust.conflicts} conflict</Badge>}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-text-muted">{r.path}</div>
                <p className="mt-1 line-clamp-2 text-[12px] text-text-secondary">{r.snippet}</p>
              </div>
              <span className="shrink-0 text-[11px] text-text-muted">{Math.round(r.rank * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function SyncButton() {
  const [state, setState] = useState<{ busy: boolean; message: string | null; error: boolean }>({ busy: false, message: null, error: false })
  const sync = async () => {
    setState({ busy: true, message: null, error: false })
    try {
      const r = await api.sync()
      setState({ busy: false, message: `Synced ${r.files} items (${r.changed} updated).`, error: false })
    } catch (e) {
      setState({ busy: false, message: e instanceof Error ? e.message : String(e), error: true })
    }
  }
  return (
    <div className="flex max-w-[520px] flex-col items-end gap-1">
      <button type="button" onClick={() => void sync()} disabled={state.busy}
        className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-text hover:bg-canvas disabled:opacity-50">
        <RefreshCw size={14} className={state.busy ? 'animate-spin' : ''} /> {state.busy ? 'Syncing…' : 'Sync from Drive'}
      </button>
      {state.message && <p className={`text-right text-[11px] ${state.error ? 'text-red' : 'text-text-muted'}`}>{state.message}</p>}
    </div>
  )
}

