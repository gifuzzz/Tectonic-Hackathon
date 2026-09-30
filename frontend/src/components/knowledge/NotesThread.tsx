import { useMemo, useState } from 'react'
import { MessageSquarePlus, CornerDownRight } from 'lucide-react'
import type { DriveNode, NoteItem, Validity } from '../../data/knowledge'
import { findNodeByName, formatDate, parseNoteRefs, validityStyles } from '../../lib/knowledgeUtils'
import { ValiditySelect } from './ValiditySelect'
import { CURRENT_USER } from '../../data/knowledge'

interface Props {
  notes: NoteItem[]
  nodes: DriveNode[]
  onChange: (notes: NoteItem[]) => void
  onOpenRef: (nodeId: string) => void
}

function renderTextWithRefs(
  text: string,
  nodes: DriveNode[],
  onOpenRef: (nodeId: string) => void,
) {
  const parts = text.split(/(@[^\s]+\.\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1)
      const node = findNodeByName(nodes, name)
      if (node) {
        return (
          <button
            key={i}
            type="button"
            className="cursor-pointer font-semibold text-accent hover:underline"
            onClick={() => onOpenRef(node.id)}
          >
            @{name}
          </button>
        )
      }
      return (
        <span key={i} className="font-semibold text-accent">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function NotesThread({ notes, nodes, onChange, onOpenRef }: Props) {
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [draftValidity, setDraftValidity] = useState<Validity>('useful')

  const roots = useMemo(() => notes.filter((n) => !n.parent_id), [notes])
  const byParent = useMemo(() => {
    const map = new Map<string, NoteItem[]>()
    notes.forEach((n) => {
      if (!n.parent_id) return
      const list = map.get(n.parent_id) ?? []
      list.push(n)
      map.set(n.parent_id, list)
    })
    return map
  }, [notes])

  const addNote = () => {
    const text = draft.trim()
    if (!text) return
    const refs = parseNoteRefs(text)
      .map((name) => findNodeByName(nodes, name)?.id)
      .filter((id): id is string => Boolean(id))

    const next: NoteItem = {
      id: `n-${Date.now()}`,
      text,
      author: CURRENT_USER,
      at: new Date().toISOString(),
      validity: draftValidity,
      parent_id: replyTo,
      refs,
    }
    onChange([...notes, next])
    setDraft('')
    setReplyTo(null)
    setDraftValidity('useful')
  }

  const updateNoteValidity = (id: string, validity: Validity) => {
    onChange(notes.map((n) => (n.id === id ? { ...n, validity } : n)))
  }

  const renderNote = (note: NoteItem, depth: number) => {
    const style = validityStyles(note.validity)
    const children = byParent.get(note.id) ?? []
    return (
      <div key={note.id} className={depth ? 'ml-5 border-l border-border pl-3' : ''}>
        <div className="rounded-[10px] border border-border bg-canvas/60 px-3 py-2.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-text">{note.author}</span>
            <span className="text-[11px] text-text-muted">{formatDate(note.at)}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            <ValiditySelect
              value={note.validity}
              onChange={(v) => updateNoteValidity(note.id, v)}
              size="sm"
            />
          </div>
          <p className="text-[12px] leading-relaxed text-text-secondary">
            {renderTextWithRefs(note.text, nodes, onOpenRef)}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-text-muted hover:text-accent"
            onClick={() => setReplyTo(note.id)}
          >
            <CornerDownRight size={12} />
            Reply
          </button>
        </div>
        <div className="mt-2 space-y-2">{children.map((c) => renderNote(c, depth + 1))}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <MessageSquarePlus size={14} className="text-text-muted" />
        <h3 className="text-[12px] font-bold tracking-wide text-text-muted uppercase">Notes</h3>
      </div>

      <div className="mb-3 space-y-2">{roots.map((n) => renderNote(n, 0))}</div>

      <div className="rounded-[10px] border border-border bg-surface p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
            <span>Replying to note</span>
            <button type="button" className="cursor-pointer text-accent" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Add a note… Use @appendix7.pdf to link files'
          className="min-h-[72px] w-full resize-y rounded-[8px] border border-border bg-canvas px-2.5 py-2 text-[12px] text-text placeholder:text-text-muted"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <ValiditySelect value={draftValidity} onChange={setDraftValidity} size="sm" />
          <button
            type="button"
            onClick={addNote}
            className="cursor-pointer rounded-[8px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover"
          >
            Add note
          </button>
        </div>
      </div>
    </div>
  )
}
