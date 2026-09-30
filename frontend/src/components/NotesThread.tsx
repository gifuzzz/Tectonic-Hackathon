import { useState, type ReactNode } from 'react'
import { AlertTriangle, CornerDownRight, Link2 } from 'lucide-react'
import { api, type Mention, type NoteItem, type Validity } from '../api'
import { formatDateTime, initials } from '../lib/format'
import { Avatar, ValiditySelect } from './ui'

const MENTION_RX = /@\[([^\]]+)\]|@([\w][\w.-]*[\w])/g

// Render note text with @mentions as links. A link to a file that changed since the note warns about it.
function NoteText({ note, onOpenFile }: { note: NoteItem; onOpenFile: (id: string, notice?: string) => void }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of note.text.matchAll(MENTION_RX)) {
    const name = (m[1] ?? m[2]).trim()
    const mention: Mention | undefined = note.mentions.find((x) => x.name.toLowerCase() === name.toLowerCase())
      ?? note.mentions.find((x) => x.name.toLowerCase().startsWith(name.toLowerCase().slice(0, 3)))
    parts.push(note.text.slice(last, m.index))
    if (mention) {
      const notice = mention.outdated
        ? `You followed a link written when this file was at version ${mention.mentionedVersion}. It now has a newer version (v${mention.currentVersion}).`
        : undefined
      parts.push(
        <button
          key={m.index}
          type="button"
          onClick={() => onOpenFile(mention.id, notice)}
          title={mention.fullPath}
          className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] bg-accent-soft px-1.5 py-px font-medium text-accent hover:underline"
        >
          <Link2 size={11} />
          {mention.name}
          {mention.outdated && (
            <span className="inline-flex items-center gap-0.5 text-amber" title="This file has a newer version">
              <AlertTriangle size={11} /> newer version
            </span>
          )}
        </button>,
      )
    } else {
      parts.push(m[0])
    }
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(note.text.slice(last))
  return <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-text">{parts}</p>
}

function Composer({ placeholder, onSubmit, autoFocus, withValidity = false }: {
  placeholder: string
  onSubmit: (text: string, validity: Validity) => Promise<void>
  autoFocus?: boolean
  withValidity?: boolean
}) {
  const [text, setText] = useState('')
  const [validity, setValidity] = useState<Validity>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(text, validity)
      setText('')
      setValidity('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] focus:border-accent"
      />
      {error && <p className="text-[12px] text-red">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {withValidity ? (
          <label className="flex items-center gap-2 text-[12px] text-text-muted">
            Validity
            <ValiditySelect value={validity} onChange={setValidity} size="sm" />
          </label>
        ) : <span />}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !text.trim()}
          className="cursor-pointer rounded-[10px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

function NoteCard({ note, driveId, depth, onNotes, onOpenFile }: {
  note: NoteItem
  driveId: string
  depth: number
  onNotes: (notes: NoteItem[]) => void
  onOpenFile: (id: string, notice?: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const [busy, setBusy] = useState(false)

  const changeValidity = async (validity: Validity) => {
    setBusy(true)
    try {
      onNotes((await api.setNoteValidity(note.id, validity)).notes)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={depth ? 'mt-2 border-l-2 border-border pl-3' : ''}>
      <div className="rounded-[10px] border border-border bg-surface p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Avatar label={initials(note.author)} />
          <span className="text-[12px] font-semibold text-text">{note.author}</span>
          <span className="text-[11px] text-text-muted">{formatDateTime(note.createdAt)}</span>
          <span className="ml-auto">
            <ValiditySelect value={note.validity} onChange={(v) => void changeValidity(v)} disabled={busy} size="sm" />
          </span>
        </div>
        <NoteText note={note} onOpenFile={onOpenFile} />
        <button
          type="button"
          onClick={() => setReplying((r) => !r)}
          className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-accent"
        >
          <CornerDownRight size={12} /> Reply
        </button>
        {replying && (
          <div className="mt-2">
            <Composer
              placeholder="Write a reply…"
              autoFocus
              onSubmit={async (text, validity) => {
                onNotes((await api.addNote(driveId, text, note.id, validity)).notes)
                setReplying(false)
              }}
            />
          </div>
        )}
      </div>
      {note.replies.map((reply) => (
        <NoteCard key={reply.id} note={reply} driveId={driveId} depth={depth + 1} onNotes={onNotes} onOpenFile={onOpenFile} />
      ))}
    </div>
  )
}

export function NotesThread({ driveId, notes, onNotes, onOpenFile }: {
  driveId: string
  notes: NoteItem[]
  onNotes: (notes: NoteItem[]) => void
  onOpenFile: (id: string, notice?: string) => void
}) {
  return (
    <div className="space-y-3">
      <Composer
        withValidity
        placeholder='Add a note. Link files with @file.pdf or @[File name with spaces]. Ctrl+Enter to post.'
        onSubmit={async (text, validity) => onNotes((await api.addNote(driveId, text, undefined, validity)).notes)}
      />
      {notes.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-text-muted">No notes yet.</p>
      ) : (
        notes.map((n) => <NoteCard key={n.id} note={n} driveId={driveId} depth={0} onNotes={onNotes} onOpenFile={onOpenFile} />)
      )}
    </div>
  )
}
