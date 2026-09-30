import { useState } from 'react'
import { Mail, MessageCircle, Phone, Sparkles } from 'lucide-react'
import { api, type Suggestion } from '../api'
import { useApi } from '../lib/useApi'
import { useUser } from '../lib/UserContext'
import { formatDateTime } from '../lib/format'
import { ErrorBox, Loading, Panel, ValidityBadge } from './ui'

const SOURCE_ICON = { email: Mail, message: MessageCircle, call: Phone }

// "Notification from an AI that reads emails, messages and phone calls" (ivan/features.md).
export function SuggestionsPanel({ onOpenFile, onChanged }: { onOpenFile: (driveId: string) => void; onChanged?: () => void }) {
  const { version } = useUser()
  const { data, error, loading, reload } = useApi(() => api.suggestions(), [version])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [draft, setDraft] = useState({ source: 'email', sender: '', text: '' })
  const [analyzing, setAnalyzing] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const decide = async (s: Suggestion, accept: boolean) => {
    setBusyId(s.id)
    setActionError(null)
    try {
      await (accept ? api.acceptSuggestion(s.id) : api.dismissSuggestion(s.id))
      reload()
      onChanged?.()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const analyze = async () => {
    setAnalyzing(true)
    setActionError(null)
    setInfo(null)
    try {
      const { created } = await api.analyze(draft.source, draft.sender, draft.text)
      setInfo(created.length ? `${created.length} suggestion(s) created.` : 'No known file is mentioned in that text.')
      setDraft({ ...draft, text: '' })
      reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <Panel
      title="AI suggestions"
      subtitle="From emails, messages and calls: notes to add and validity changes to make."
      action={<Sparkles size={16} className="text-accent" />}
    >
      {loading && !data && <Loading />}
      {error && <div className="p-3"><ErrorBox message={error} onRetry={reload} /></div>}
      {actionError && <div className="p-3"><ErrorBox message={actionError} /></div>}
      {data && data.length === 0 && <p className="px-4 py-4 text-[12px] text-text-muted">Nothing pending. You're up to date.</p>}
      <ul className="divide-y divide-border">
        {data?.map((s) => {
          const Icon = SOURCE_ICON[s.source]
          return (
            <li key={s.id} className="px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-text-muted">
                <Icon size={13} />
                <span className="font-semibold text-text-secondary capitalize">{s.source}</span>
                {s.sender && <span className="truncate">· {s.sender}</span>}
                <span className="ml-auto shrink-0">{formatDateTime(s.createdAt)}</span>
              </div>
              <p className="text-[13px] text-text">
                {s.kind === 'validity' ? (
                  <>Mark <FileLink s={s} onOpenFile={onOpenFile} /> as <ValidityBadge validity={s.suggestedValidity} /></>
                ) : (
                  <>Add a note to <FileLink s={s} onOpenFile={onOpenFile} /></>
                )}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] text-text-secondary italic">“{s.excerpt}”</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busyId === s.id} onClick={() => void decide(s, true)}
                  className="cursor-pointer rounded-[8px] bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                  Accept
                </button>
                <button type="button" disabled={busyId === s.id} onClick={() => void decide(s, false)}
                  className="cursor-pointer rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-canvas disabled:opacity-50">
                  Dismiss
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <details className="border-t border-border px-4 py-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-text-secondary">Feed a message to the assistant</summary>
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              className="rounded-[8px] border border-border px-2 py-1 text-[12px]">
              <option value="email">Email</option>
              <option value="message">Message</option>
              <option value="call">Call</option>
            </select>
            <input value={draft.sender} onChange={(e) => setDraft({ ...draft, sender: e.target.value })} placeholder="From"
              className="min-w-0 flex-1 rounded-[8px] border border-border px-2 py-1 text-[12px]" />
          </div>
          <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={3}
            placeholder='e.g. "The NL Leave Policy 2025 is obsolete."'
            className="w-full rounded-[8px] border border-border px-2 py-1.5 text-[12px]" />
          {info && <p className="text-[12px] text-text-muted">{info}</p>}
          <button type="button" disabled={analyzing || !draft.text.trim()} onClick={() => void analyze()}
            className="cursor-pointer rounded-[8px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </details>
    </Panel>
  )
}

function FileLink({ s, onOpenFile }: { s: Suggestion; onOpenFile: (driveId: string) => void }) {
  return (
    <button type="button" onClick={() => onOpenFile(s.file.id)} className="cursor-pointer font-semibold text-accent hover:underline">
      {s.file.name}
    </button>
  )
}
