import { useState, useMemo } from 'react'
import {
  buildKnowledgeGraph,
  aiSuggestions as initialAiSuggestions,
  companyAssignments,
  type DriveNode,
  type HistoryEntry,
  type NoteItem,
  type Validity,
  type AiSuggestion,
} from '../data/knowledge'
import { FileSystemVisualizer } from '../components/knowledge/FileSystemVisualizer'
import { NodeDetailDrawer } from '../components/knowledge/NodeDetailDrawer'
import { AiSuggestionsPanel } from '../components/knowledge/AiSuggestionsPanel'
import { UserAssignmentBar } from '../components/knowledge/UserAssignmentBar'

export function KnowledgePage() {
  const initialGraph = useMemo(() => buildKnowledgeGraph(), [])
  const [nodes, setNodes] = useState<DriveNode[]>(initialGraph.nodes)
  const [edges] = useState(initialGraph.edges)
  const [rootIds] = useState(initialGraph.root_ids)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('file-be-overtime-2026')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [historyMap, setHistoryMap] = useState<Record<string, HistoryEntry[]>>({
    'file-be-overtime-2026': [
      {
        id: 1,
        node_id: 'file-be-overtime-2026',
        field: 'validity',
        old_value: 'awaiting_replacement',
        new_value: 'useful',
        changed_at: '2026-09-12T10:00:00Z',
        changed_by: 'Payroll Legal Belgium',
      },
    ],
  })

  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>(initialAiSuggestions)
  const [currentUser, setCurrentUser] = useState('L. Martin')
  const [filterByAssignment, setFilterByAssignment] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState('all')

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const visibleNodes = useMemo(() => {
    if (!filterByAssignment || currentUser === 'Admin') return nodes
    const assigned = companyAssignments[currentUser] ?? []
    if (assigned.length === 0) return nodes

    return nodes.filter((n) => {
      if (n.type === 'folder') return true
      const cList = (n.meta.marks.companies as string[] | undefined) ?? []
      if (cList.length === 0) return true
      return cList.some((c) => assigned.includes(c))
    })
  }, [nodes, filterByAssignment, currentUser])

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setDrawerOpen(true)
  }

  const handleUpdateValidity = (nodeId: string, validity: Validity) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const oldVal = n.meta.marks.validity
        const updatedNode: DriveNode = {
          ...n,
          meta: {
            ...n.meta,
            marks: {
              ...n.meta.marks,
              validity,
            },
            updated_at: new Date().toISOString(),
            updated_by: currentUser,
          },
        }

        const entry: HistoryEntry = {
          id: Date.now(),
          node_id: nodeId,
          field: 'validity',
          old_value: oldVal ?? 'useful',
          new_value: validity,
          changed_at: new Date().toISOString(),
          changed_by: currentUser,
        }
        setHistoryMap((hm) => ({
          ...hm,
          [nodeId]: [entry, ...(hm[nodeId] ?? [])],
        }))

        return updatedNode
      }),
    )
  }

  const handleUpdateNotes = (nodeId: string, notesThread: NoteItem[]) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const updatedNode: DriveNode = {
          ...n,
          meta: {
            ...n.meta,
            marks: {
              ...n.meta.marks,
              notes_thread: notesThread,
            },
            updated_at: new Date().toISOString(),
            updated_by: currentUser,
          },
        }

        const entry: HistoryEntry = {
          id: Date.now(),
          node_id: nodeId,
          field: 'notes',
          old_value: `${(n.meta.marks.notes_thread as NoteItem[] | undefined)?.length ?? 0} notes`,
          new_value: `${notesThread.length} notes`,
          changed_at: new Date().toISOString(),
          changed_by: currentUser,
        }
        setHistoryMap((hm) => ({
          ...hm,
          [nodeId]: [entry, ...(hm[nodeId] ?? [])],
        }))

        return updatedNode
      }),
    )
  }

  const handleAddTag = (nodeId: string, tag: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        if (n.meta.tags.includes(tag)) return n
        const nextTags = [...n.meta.tags, tag]
        const updatedNode: DriveNode = {
          ...n,
          meta: {
            ...n.meta,
            tags: nextTags,
            updated_at: new Date().toISOString(),
            updated_by: currentUser,
          },
        }

        const entry: HistoryEntry = {
          id: Date.now(),
          node_id: nodeId,
          field: 'tags',
          old_value: n.meta.tags,
          new_value: nextTags,
          changed_at: new Date().toISOString(),
          changed_by: currentUser,
        }
        setHistoryMap((hm) => ({
          ...hm,
          [nodeId]: [entry, ...(hm[nodeId] ?? [])],
        }))

        return updatedNode
      }),
    )
  }

  const handleAddCompany = (nodeId: string, company: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const currentCompanies = (n.meta.marks.companies as string[] | undefined) ?? []
        if (currentCompanies.includes(company)) return n
        const nextCompanies = [...currentCompanies, company]
        const updatedNode: DriveNode = {
          ...n,
          meta: {
            ...n.meta,
            marks: {
              ...n.meta.marks,
              companies: nextCompanies,
            },
            updated_at: new Date().toISOString(),
            updated_by: currentUser,
          },
        }

        const entry: HistoryEntry = {
          id: Date.now(),
          node_id: nodeId,
          field: 'companies',
          old_value: currentCompanies,
          new_value: nextCompanies,
          changed_at: new Date().toISOString(),
          changed_by: currentUser,
        }
        setHistoryMap((hm) => ({
          ...hm,
          [nodeId]: [entry, ...(hm[nodeId] ?? [])],
        }))

        return updatedNode
      }),
    )
  }

  const handleApplyAiSuggestion = (suggestion: AiSuggestion) => {
    if (suggestion.proposedValidity) {
      handleUpdateValidity(suggestion.targetNodeId, suggestion.proposedValidity)
    }
    if (suggestion.proposedNote) {
      const target = nodes.find((n) => n.id === suggestion.targetNodeId)
      if (target) {
        const existingNotes = (target.meta.marks.notes_thread as NoteItem[] | undefined) ?? []
        const newNote: NoteItem = {
          id: `n-${Date.now()}`,
          text: `[AI via ${suggestion.channel}] ${suggestion.proposedNote}`,
          author: `AI Copilot (${suggestion.channel})`,
          at: new Date().toISOString(),
          validity: suggestion.proposedValidity ?? 'useful',
          parent_id: null,
          refs: [],
        }
        handleUpdateNotes(suggestion.targetNodeId, [...existingNotes, newNote])
      }
    }
    setAiSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
  }

  const handleDismissAiSuggestion = (suggestionId: string) => {
    setAiSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-5 space-y-3.5">
      {/* Header and User Role Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight text-text">Knowledge Workspace</h1>
          <p className="text-[12px] text-text-secondary">
            Inspect organizational Drive documents, verify policy validity, and resolve uncertainties.
          </p>
        </div>

        <UserAssignmentBar
          currentUser={currentUser}
          onUserChange={setCurrentUser}
          filterByAssignment={filterByAssignment}
          onToggleFilter={setFilterByAssignment}
        />
      </div>

      {/* AI Suggestion Bar */}
      <AiSuggestionsPanel
        suggestions={aiSuggestions}
        onApply={handleApplyAiSuggestion}
        onDismiss={handleDismissAiSuggestion}
        onSelectNode={handleSelectNode}
      />

      {/* Visualizer */}
      <FileSystemVisualizer
        nodes={visibleNodes}
        edges={edges}
        rootIds={rootIds}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        onUpdateValidity={handleUpdateValidity}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
      />

      {/* Detail Drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        nodes={nodes}
        open={drawerOpen}
        history={selectedNodeId ? historyMap[selectedNodeId] ?? [] : []}
        onClose={() => setDrawerOpen(false)}
        onUpdateValidity={handleUpdateValidity}
        onUpdateNotes={handleUpdateNotes}
        onAddTag={handleAddTag}
        onAddCompany={handleAddCompany}
        onSelectNode={handleSelectNode}
      />
    </div>
  )
}
