import { useState } from 'react'
import {
  ExternalLink,
  X,
  Share2,
  AlertCircle,
  FileSpreadsheet,
  FileType2,
  FileText,
  Folder,
  Tag,
  Building2,
  Building,
  Plus,
  ArrowRight,
} from 'lucide-react'
import type { DriveNode, HistoryEntry, NoteItem, Validity } from '../../data/knowledge'
import { formatBytes, formatDate } from '../../lib/knowledgeUtils'
import { ValiditySelect } from './ValiditySelect'
import { NotesThread } from './NotesThread'
import { NodeHistory } from './NodeHistory'

interface Props {
  node: DriveNode | null
  nodes: DriveNode[]
  open: boolean
  history?: HistoryEntry[]
  onClose: () => void
  onUpdateValidity: (nodeId: string, validity: Validity) => void
  onUpdateNotes: (nodeId: string, notes: NoteItem[]) => void
  onAddTag: (nodeId: string, tag: string) => void
  onAddCompany: (nodeId: string, company: string) => void
  onSelectNode: (nodeId: string) => void
}

function getNodeIcon(node: DriveNode) {
  if (node.type === 'folder') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-accent-soft text-accent">
        <Folder size={15} />
      </span>
    )
  }
  if (node.mime_type?.includes('spreadsheet') || node.name.endsWith('.xlsx') || node.name.endsWith('.csv')) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e6f4ea] text-[#137333]">
        <FileSpreadsheet size={15} />
      </span>
    )
  }
  if (node.mime_type?.includes('pdf') || node.name.endsWith('.pdf')) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#fce8e6] text-[#c5221f]">
        <FileType2 size={15} />
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e8f0fe] text-[#1a73e8]">
      <FileText size={15} />
    </span>
  )
}

export function NodeDetailDrawer({
  node,
  nodes,
  open,
  history = [],
  onClose,
  onUpdateValidity,
  onUpdateNotes,
  onAddTag,
  onAddCompany,
  onSelectNode,
}: Props) {
  const [newTagInput, setNewTagInput] = useState('')
  const [newCompanyInput, setNewCompanyInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [showCompanyInput, setShowCompanyInput] = useState(false)
  const [activeTab, setActiveTab] = useState<'metadata' | 'notes' | 'history'>('metadata')

  if (!open || !node) return null

  const marks = node.meta.marks || {}
  const validity = marks.validity as Validity | undefined
  const companies = (marks.companies as string[] | undefined) ?? []
  const countries = (marks.countries as string[] | undefined) ?? []
  const source = (marks.source as string | undefined) ?? 'Payroll Legal Belgium'
  const versions = (marks.versions as Array<{ id: string; name: string; at: string; current: boolean }> | undefined) ?? []
  const currentVersion = versions.find((v) => v.current)
  const isOutdated = currentVersion && currentVersion.id !== node.id
  const notesThread = (marks.notes_thread as NoteItem[] | undefined) ?? []
  const tags = node.meta.tags ?? []

  const handleAddTagSubmit = () => {
    if (newTagInput.trim()) {
      onAddTag(node.id, newTagInput.trim())
      setNewTagInput('')
      setShowTagInput(false)
    }
  }

  const handleAddCompanySubmit = () => {
    if (newCompanyInput.trim()) {
      onAddCompany(node.id, newCompanyInput.trim())
      setNewCompanyInput('')
      setShowCompanyInput(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close file detail"
        className="fixed inset-0 z-30 cursor-default bg-black/25 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 z-40 flex h-full w-[440px] max-w-full flex-col border-l border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="border-b border-border px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5 pr-2">
              <div className="mt-0.5">{getNodeIcon(node)}</div>
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                  <Share2 size={11} />
                  <span>Google Drive {node.type === 'folder' ? 'Folder' : 'Document'}</span>
                </div>
                <h2 className="text-[14px] leading-snug font-bold text-text break-words">{node.name}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[8px] p-1.5 text-text-muted hover:bg-canvas hover:text-text"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Validity Header Control */}
          <div className="mt-3 flex items-center justify-between rounded-[8px] border border-border bg-canvas/60 px-2.5 py-1.5">
            <span className="text-[11px] font-semibold text-text-secondary">Validity status:</span>
            <ValiditySelect
              value={validity ?? 'useful'}
              onChange={(v) => onUpdateValidity(node.id, v)}
              size="sm"
            />
          </div>

          {/* Tab navigation */}
          <div className="mt-3 flex gap-1 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('metadata')}
              className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                activeTab === 'metadata' ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              Metadata & Attributes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                activeTab === 'notes' ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              Notes ({notesThread.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                activeTab === 'history' ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              Audit Log ({history.length})
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Newer version warning banner */}
          {isOutdated && currentVersion && (
            <div className="rounded-[10px] border border-amber/40 bg-amber-soft p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-amber">This file has a newer version</div>
                  <div className="mt-0.5 text-[11px] text-text-secondary">
                    Active replacement: <span className="font-semibold text-text">{currentVersion.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNode(currentVersion.id)}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-[6px] bg-amber px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-95"
                  >
                    Open latest version
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4">
              {/* Core Drive Attributes */}
              <div className="rounded-[10px] border border-border bg-surface p-3 space-y-2.5">
                <div className="text-[11px] font-bold tracking-wide text-text-muted uppercase">
                  Drive Properties
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2 text-[12px]">
                  <span className="text-text-muted">Type:</span>
                  <span className="font-medium text-text capitalize">{node.type}</span>

                  <span className="text-text-muted">Modified:</span>
                  <span className="font-medium text-text">{formatDate(node.modified_time)}</span>

                  <span className="text-text-muted">Size:</span>
                  <span className="font-medium text-text">{formatBytes(node.size)}</span>

                  <span className="text-text-muted">#source:</span>
                  <span className="font-medium text-accent">{source}</span>

                  {countries.length > 0 && (
                    <>
                      <span className="text-text-muted">Country:</span>
                      <span className="font-medium text-text">{countries.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>

              {/* #companies tags */}
              <div className="rounded-[10px] border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-text-muted uppercase">
                    <Building2 size={12} />
                    <span>#companies ({companies.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCompanyInput(!showCompanyInput)}
                    className="cursor-pointer text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={12} /> Add company
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {companies.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-[6px] border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
                    >
                      <Building size={10} />
                      {c}
                    </span>
                  ))}
                  {companies.length === 0 && !showCompanyInput && (
                    <span className="text-[11px] text-text-muted italic">Global / all companies</span>
                  )}
                </div>

                {showCompanyInput && (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Northstar Logistics"
                      value={newCompanyInput}
                      onChange={(e) => setNewCompanyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCompanySubmit()}
                      className="h-7 flex-1 rounded-[6px] border border-border bg-canvas px-2 text-[11px] text-text"
                    />
                    <button
                      type="button"
                      onClick={handleAddCompanySubmit}
                      className="cursor-pointer rounded-[6px] bg-accent px-2.5 text-[11px] font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* #file_tags */}
              <div className="rounded-[10px] border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-text-muted uppercase">
                    <Tag size={12} />
                    <span>#file_tags ({tags.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTagInput(!showTagInput)}
                    className="cursor-pointer text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={12} /> Add tag
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-[6px] border border-border bg-canvas px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                    >
                      #{t}
                    </span>
                  ))}
                  {tags.length === 0 && !showTagInput && (
                    <span className="text-[11px] text-text-muted italic">No tags assigned</span>
                  )}
                </div>

                {showTagInput && (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      placeholder='e.g. law, summary of policy'
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTagSubmit()}
                      className="h-7 flex-1 rounded-[6px] border border-border bg-canvas px-2 text-[11px] text-text"
                    />
                    <button
                      type="button"
                      onClick={handleAddTagSubmit}
                      className="cursor-pointer rounded-[6px] bg-accent px-2.5 text-[11px] font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Version History */}
              {versions.length > 0 && (
                <div className="rounded-[10px] border border-border bg-surface p-3">
                  <div className="mb-2 text-[11px] font-bold tracking-wide text-text-muted uppercase">
                    Version History ({versions.length})
                  </div>
                  <div className="space-y-1.5">
                    {versions.map((ver) => {
                      const isSelected = ver.id === node.id
                      return (
                        <div
                          key={ver.id}
                          onClick={() => onSelectNode(ver.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-[6px] border p-2 text-[11px] transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent-soft/50 font-semibold text-text'
                              : 'border-border bg-canvas hover:bg-surface'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="truncate text-[12px]">{ver.name}</div>
                            <div className="text-[10px] text-text-muted">{formatDate(ver.at)}</div>
                          </div>
                          <div>
                            {ver.current ? (
                              <span className="rounded-[4px] bg-green-soft px-1.5 py-0.5 text-[10px] font-bold text-green">
                                Current
                              </span>
                            ) : (
                              <span className="rounded-[4px] bg-amber-soft px-1.5 py-0.5 text-[10px] font-medium text-amber">
                                Superseded
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Why Relevant / Description */}
              {node.meta.notes && (
                <div className="rounded-[10px] border border-border bg-canvas/60 p-3">
                  <div className="mb-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                    Summary / Note
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">{node.meta.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <NotesThread
              notes={notesThread}
              nodes={nodes}
              onChange={(next) => onUpdateNotes(node.id, next)}
              onOpenRef={(refId) => onSelectNode(refId)}
            />
          )}

          {activeTab === 'history' && <NodeHistory history={history} />}
        </div>

        {/* Footer actions */}
        <div className="border-t border-border p-3.5 bg-surface">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-2 text-[12px] font-semibold text-text hover:bg-canvas transition-colors"
          >
            <ExternalLink size={14} className="text-[#1a73e8]" />
            Open in Google Drive
          </button>
        </div>
      </aside>
    </>
  )
}
