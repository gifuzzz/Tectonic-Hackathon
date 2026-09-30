import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, ExternalLink, History, Info, MessageSquare, Layers, X } from 'lucide-react'
import { api, type Change, type NodeDetail, type NoteItem, type Validity } from '../api'
import { useApi } from '../lib/useApi'
import { useUser } from '../lib/UserContext'
import { formatDate, formatDateTime, formatSize, humanize, validityLabel, verdictLabel, verdictStyle } from '../lib/format'
import { Badge, ErrorBox, FileIcon, Loading, ValidityBadge, ValiditySelect } from './ui'
import { TrustPanel } from './TrustPanel'
import { NotesThread } from './NotesThread'

type Tab = 'overview' | 'notes' | 'history' | 'versions'

interface Props {
  driveId: string | null
  context?: { country?: string; customer?: string }
  notice?: string
  onClose: () => void
  onOpenFile: (driveId: string, notice?: string) => void
  onChanged?: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-[12px] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-[12px] font-medium break-words text-text">{children || '—'}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-text-muted uppercase">{title}</div>
      {children}
    </div>
  )
}

const listToText = (list: string[]) => list.join(', ')
const textToList = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean)

function MetaEditor({ detail, onSaved }: { detail: NodeDetail; onSaved: () => void }) {
  const meta = detail.node.meta
  const initial = {
    companies: listToText(meta?.companies ?? []),
    source: meta?.source ?? '',
    tags: listToText(meta?.tags ?? []),
    category: meta?.category ?? '',
  }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const save = async () => {
    if (!detail.node.id) return
    setBusy(true)
    setError(null)
    try {
      await api.patchMeta(detail.node.id, {
        companies: textToList(form.companies),
        source: form.source,
        tags: textToList(form.tags),
        category: form.category,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <label className="block">
      <span className="mb-1 block text-[12px] text-text-muted">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="h-8 w-full rounded-[8px] border border-border bg-surface px-2.5 text-[12px] focus:border-accent"
      />
    </label>
  )

  return (
    <div className="space-y-2.5 rounded-[10px] border border-border bg-canvas p-3">
      {field('companies', 'Companies', 'Acme Retail, Brightwave Logistics')}
      {field('source', 'Source', 'e.g. HR, Italian Gvt., Company A')}
      {field('tags', 'Tags', 'law, contract, summary of …')}
      {field('category', 'Category', 'e.g. Payroll')}
      {error && <p className="text-[12px] text-red">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {meta?.updatedBy ? `Last edited by ${meta.updatedBy}, ${formatDateTime(meta.updatedAt)}` : 'Comma-separated lists'}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || busy}
          className="cursor-pointer rounded-[8px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function describeChange(c: Change): string {
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '(empty)'
    if (Array.isArray(v)) return v.length ? v.join(', ') : '(none)'
    if (typeof v === 'object') return JSON.stringify(v)
    return c.field === 'validity' ? validityLabel(v as Validity) : String(v)
  }
  if (c.action === 'note_added') return `added a note: “${(c.newValue as { text?: string })?.text ?? ''}”`
  if (c.action === 'note_reply') return `replied: “${(c.newValue as { text?: string })?.text ?? ''}”`
  if (c.action === 'note_validity') return `set a note's validity: ${show(c.oldValue)} → ${show(c.newValue)}`
  if (c.action === 'version') return `new version v${String(c.newValue)} synced from Drive`
  return `changed ${c.field}: ${show(c.oldValue)} → ${show(c.newValue)}`
}

export function FileDetailDrawer({ driveId, context, notice, onClose, onOpenFile, onChanged }: Props) {
  const { version } = useUser()
  const [tab, setTab] = useState<Tab>('overview')
  const { data, error, loading, reload, setData } = useApi<NodeDetail | null>(
    () => (driveId ? api.node(driveId, context) : Promise.resolve(null)),
    [driveId, context?.country, context?.customer, version],
  )
  const [savingValidity, setSavingValidity] = useState(false)

  useEffect(() => setTab('overview'), [driveId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!driveId) return null

  const changed = () => {
    reload()
    onChanged?.()
  }
  const setNotes = (notes: NoteItem[]) => {
    if (data) setData({ ...data, notes })
    onChanged?.()
  }
  const setValidity = async (validity: Validity) => {
    if (!data?.node.id) return
    setSavingValidity(true)
    try {
      await api.patchMeta(data.node.id, { validity })
      changed()
    } finally {
      setSavingValidity(false)
    }
  }

  const node = data?.node
  const k = node?.knowledge
  const countNotes = (list: NoteItem[]): number => list.reduce((n, x) => n + 1 + countNotes(x.replies), 0)
  const tabs: { id: Tab; label: string; icon: typeof Info; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'notes', label: 'Notes', icon: MessageSquare, count: data ? countNotes(data.notes) : undefined },
    { id: 'history', label: 'History', icon: History, count: data?.history.length },
    { id: 'versions', label: 'Versions', icon: Layers, count: data?.versions.length },
  ]

  return (
    <>
      <button type="button" aria-label="Close file detail" className="fixed inset-0 z-30 cursor-default bg-black/20" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-40 flex h-full w-[min(480px,100vw)] flex-col border-l border-border bg-surface shadow-xl">
        <div className="border-b border-border px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <FileIcon mimeType={node?.mimeType} />
              <div className="min-w-0">
                <h2 className="text-[15px] leading-snug font-bold break-words text-text">{node?.name ?? 'Loading…'}</h2>
                <p className="mt-0.5 truncate text-[11px] text-text-muted" title={node?.path}>{node?.path}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="cursor-pointer rounded-[8px] p-1.5 text-text-muted hover:bg-canvas hover:text-text" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          {node && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ValiditySelect value={node.meta?.validity ?? ''} onChange={(v) => void setValidity(v)} disabled={savingValidity} />
              {data?.trust && <Badge className={verdictStyle(data.trust.verdict)}>{verdictLabel(data.trust.verdict)}</Badge>}
              {node.version > 0 && <Badge className="bg-canvas text-text-secondary">v{node.version}</Badge>}
              {node.meta?.companies.map((c) => <Badge key={c} className="bg-accent-soft text-accent">{c}</Badge>)}
            </div>
          )}
          <div className="mt-3 flex gap-1" role="tablist">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={[
                  '-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12px] font-semibold',
                  tab === id ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text',
                ].join(' ')}
              >
                <Icon size={13} />
                {label}
                {count !== undefined && count > 0 && <span className="rounded-full bg-canvas px-1.5 text-[10px]">{count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {notice && (
            <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-amber/30 bg-amber-soft px-3 py-2 text-[12px] text-amber">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {notice}
            </div>
          )}
          {loading && !data && <Loading />}
          {error && <ErrorBox message={error} onRetry={reload} />}
          {data && node && tab === 'overview' && (
            <>
              {data.supersededBy.length > 0 && (
                <div className="mb-3 rounded-[10px] border border-red/30 bg-red-soft px-3 py-2 text-[12px] text-red">
                  Superseded by{' '}
                  {data.supersededBy.map((s) => (
                    <button key={s.id} type="button" onClick={() => onOpenFile(s.id)} className="cursor-pointer font-semibold underline">
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              <Section title="Our data">
                <MetaEditor key={`${node.id}-${node.meta?.updatedAt}`} detail={data} onSaved={changed} />
              </Section>

              {data.trust && (
                <Section title="Why can I trust this?">
                  <div className="overflow-hidden rounded-[10px] border border-border">
                    <TrustPanel trust={data.trust} bare />
                  </div>
                </Section>
              )}

              {k && (
                <Section title="Detected by the knowledge engine">
                  <dl className="space-y-2">
                    <Row label="Country">{k.countryName || k.country}</Row>
                    <Row label="Customer">{k.customer?.name}</Row>
                    <Row label="Topic">{humanize(k.topic)}</Row>
                    <Row label="Document type">{humanize(k.documentType)}</Row>
                    <Row label="Approval status">{humanize(k.status)}</Row>
                    <Row label="Effective date">{formatDate(k.effectiveDate)}</Row>
                    <Row label="Expiry date">{formatDate(k.expiryDate)}</Row>
                    <Row label="Owner">{k.owner ? `${k.owner.name} (verified expert)` : k.ownerEmail}</Row>
                    {data.supersedes && (
                      <Row label="Supersedes">
                        <button type="button" onClick={() => onOpenFile(data.supersedes!.id)} className="cursor-pointer text-accent hover:underline">
                          {data.supersedes.name}
                        </button>
                      </Row>
                    )}
                  </dl>
                  {k.summary && <p className="mt-3 rounded-[10px] bg-canvas p-3 text-[12px] leading-relaxed text-text-secondary">{k.summary}</p>}
                </Section>
              )}

              {data.claims.length > 0 && (
                <Section title="Claims in this document">
                  <ul className="space-y-1">
                    {data.claims.map((c) => (
                      <li key={c.subject} className="text-[12px]">
                        <span className="text-text-muted">{humanize(c.subject)}:</span> <span className="font-medium text-text">{c.value}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {data.conflicts.length > 0 && (
                <Section title="Conflicts">
                  <ul className="space-y-2">
                    {data.conflicts.map((c) => (
                      <li key={c.id} className={`rounded-[10px] border p-2.5 text-[12px] ${c.resolved ? 'border-border bg-canvas' : 'border-amber/30 bg-amber-soft'}`}>
                        <div className="font-semibold text-text">{humanize(c.subject)} {c.resolved && <span className="text-green">· resolved</span>}</div>
                        <div className="text-text-secondary">{c.fileA.name}: <b>{c.claimA}</b></div>
                        <div className="text-text-secondary">{c.fileB.name}: <b>{c.claimB}</b></div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {node.type === 'folder' && (
                <Section title={`Contents (${data.children.length})`}>
                  <ul className="divide-y divide-border rounded-[10px] border border-border">
                    {data.children.map((c) => (
                      <li key={c.id ?? c.name}>
                        <button type="button" onClick={() => c.id && onOpenFile(c.id)} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-canvas">
                          <FileIcon mimeType={c.mimeType} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          <ValidityBadge validity={c.meta?.validity} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {node.drive && (
                <Section title="Google Drive">
                  <dl className="space-y-2">
                    <Row label="Location">{node.path}</Row>
                    <Row label="Owners">{node.drive.owners.map((o) => o.name || o.email).join(', ')}</Row>
                    <Row label="Modified">{formatDateTime(node.drive.modifiedAt)}</Row>
                    <Row label="Size">{formatSize(node.drive.size)}</Row>
                    <Row label="Shared drive">{node.drive.sharedDrive}</Row>
                    <Row label="Shared with">
                      {(node.drive.permissions ?? []).map((p) => p.email || p.domain || p.type).join(', ')}
                    </Row>
                  </dl>
                </Section>
              )}
            </>
          )}

          {data && node?.id && tab === 'notes' && (
            <NotesThread driveId={node.id} notes={data.notes} onNotes={setNotes} onOpenFile={onOpenFile} />
          )}

          {data && tab === 'history' && (
            data.history.length === 0 ? <p className="py-4 text-center text-[12px] text-text-muted">No changes recorded yet.</p> : (
              <ol className="space-y-3">
                {data.history.map((c) => (
                  <li key={c.id} className="border-l-2 border-border pl-3">
                    <div className="text-[12px] text-text"><b>{c.changedBy || 'someone'}</b> {describeChange(c)}</div>
                    <div className="text-[11px] text-text-muted">{formatDateTime(c.changedAt)}</div>
                  </li>
                ))}
              </ol>
            )
          )}

          {data && tab === 'versions' && (
            <>
              {data.versions.length === 0 ? <p className="py-4 text-center text-[12px] text-text-muted">No versions recorded.</p> : (
                <ul className="divide-y divide-border rounded-[10px] border border-border">
                  {data.versions.map((v, i) => (
                    <li key={v.number} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                      <Badge className={i === 0 ? 'bg-green-soft text-green' : 'bg-canvas text-text-muted'}>v{v.number}</Badge>
                      <span className="min-w-0 flex-1 truncate font-medium">{v.name}</span>
                      <span className="text-text-muted">{formatDate(v.modifiedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.mentionedIn.length > 0 && (
                <Section title="Linked from notes">
                  <ul className="space-y-1">
                    {data.mentionedIn.map((m) => (
                      <li key={m.noteId} className="text-[12px]">
                        <button type="button" onClick={() => onOpenFile(m.fileId)} className="cursor-pointer text-accent hover:underline">{m.fileName}</button>
                        <span className="text-text-muted"> (linked at v{m.version})</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border p-4">
          <a
            href={node?.drive?.webViewLink || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!node?.drive?.webViewLink}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[13px] font-semibold text-text',
              node?.drive?.webViewLink ? 'hover:bg-canvas' : 'pointer-events-none opacity-50',
            ].join(' ')}
            title={node?.drive?.webViewLink ? undefined : 'Demo files have no Google Drive link'}
          >
            <ExternalLink size={15} className="text-[#1a73e8]" />
            Open in Google Drive
          </a>
        </div>
      </aside>
    </>
  )
}
