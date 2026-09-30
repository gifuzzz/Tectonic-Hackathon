import { useMemo, useState } from 'react'
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileType2,
  ChevronRight,
  ChevronDown,
  LayoutList,
  ListTree,
  Network,
  Search,
  RefreshCw,
} from 'lucide-react'
import type { DriveEdge, DriveNode, Validity } from '../../data/knowledge'
import { breadcrumbPath, childrenOf, formatBytes, formatDate, validityStyles } from '../../lib/knowledgeUtils'
import { ValiditySelect } from './ValiditySelect'

interface Props {
  nodes: DriveNode[]
  edges: DriveEdge[]
  rootIds: string[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onUpdateValidity: (nodeId: string, validity: Validity) => void
  onSync?: () => void
  isSyncing?: boolean
  selectedCompany?: string
  onCompanyChange?: (company: string) => void
}

function getNodeIcon(node: DriveNode, isOpen = false) {
  if (node.type === 'folder') {
    return isOpen ? (
      <FolderOpen size={17} className="shrink-0 text-amber-500 fill-amber-100" />
    ) : (
      <Folder size={17} className="shrink-0 text-amber-500 fill-amber-100" />
    )
  }
  if (node.mime_type?.includes('spreadsheet') || node.name.endsWith('.xlsx') || node.name.endsWith('.csv')) {
    return <FileSpreadsheet size={16} className="shrink-0 text-[#0f9d58]" />
  }
  if (node.mime_type?.includes('pdf') || node.name.endsWith('.pdf')) {
    return <FileType2 size={16} className="shrink-0 text-[#ea4335]" />
  }
  return <FileText size={16} className="shrink-0 text-[#4285f4]" />
}

export function FileSystemVisualizer({
  nodes,
  edges,
  rootIds,
  selectedNodeId,
  onSelectNode,
  onUpdateValidity,
  onSync,
  isSyncing = false,
  selectedCompany = 'all',
  onCompanyChange,
}: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'tree' | 'graph'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedValidity, setSelectedValidity] = useState<string>('all')
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(['root', 'f-payroll', 'f-be', 'f-policies', 'f-customers', 'f-northstar']),
  )
  const [currentFolderId, setCurrentFolderId] = useState<string>('root')

  const allCompanies = useMemo(() => {
    const companies = new Set<string>()
    nodes.forEach((n) => {
      const nodeCompanies = (n.meta.marks.companies as string[] | undefined) ?? []
      nodeCompanies.forEach((c) => companies.add(c))
    })
    return Array.from(companies).sort()
  }, [nodes])

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.trashed) return false
      if (selectedCompany !== 'all') {
        const cList = (n.meta.marks.companies as string[] | undefined) ?? []
        if (n.type === 'file' && !cList.includes(selectedCompany)) return false
      }
      if (selectedValidity !== 'all') {
        const v = (n.meta.marks.validity as string | undefined) ?? 'useful'
        if (v !== selectedValidity) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = n.name.toLowerCase().includes(q)
        const matchNotes = n.meta.notes?.toLowerCase().includes(q)
        const matchTags = n.meta.tags.some((t) => t.toLowerCase().includes(q))
        if (!matchName && !matchNotes && !matchTags) return false
      }
      return true
    })
  }, [nodes, selectedCompany, selectedValidity, searchQuery])

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const breadcrumbs = useMemo(() => {
    return breadcrumbPath(currentFolderId, nodes)
  }, [currentFolderId, nodes])

  const currentFolderChildren = useMemo(() => {
    const directChildren = childrenOf(currentFolderId, nodes, edges)
    if (searchQuery.trim() || selectedValidity !== 'all' || selectedCompany !== 'all') {
      const filteredIds = new Set(filteredNodes.map((n) => n.id))
      return directChildren.filter((n) => filteredIds.has(n.id))
    }
    return directChildren
  }, [currentFolderId, nodes, edges, searchQuery, selectedValidity, selectedCompany, filteredNodes])

  const renderTreeNode = (nodeId: string, depth = 0) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.trashed) return null

    const isFolder = node.type === 'folder'
    const isExpanded = expandedFolderIds.has(node.id)
    const isSelected = selectedNodeId === node.id
    const children = isFolder ? childrenOf(node.id, nodes, edges) : []
    const val = node.meta.marks.validity as Validity | undefined
    const valStyle = validityStyles(val)

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.id)
              setCurrentFolderId(node.id)
            }
            onSelectNode(node.id)
          }}
          className={`flex cursor-pointer items-center justify-between rounded-[6px] px-2 py-1.5 text-[12px] transition-colors ${
            isSelected
              ? 'bg-accent/10 text-accent font-semibold'
              : 'text-text hover:bg-canvas'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {isFolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(node.id)
                }}
                className="p-0.5 text-text-muted hover:text-text"
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {getNodeIcon(node, isExpanded)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-2 pr-1 shrink-0">
            {node.type === 'file' && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${valStyle.chip}`}>
                {valStyle.label}
              </span>
            )}
          </div>
        </div>

        {isFolder && isExpanded && children.length > 0 && (
          <div>{children.map((c) => renderTreeNode(c.id, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <section className="rounded-[12px] border border-border bg-surface overflow-hidden shadow-xs">
      {/* Clean Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative w-full max-w-xs">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-[6px] border border-border bg-canvas pr-2.5 pl-8 text-[12px] text-text placeholder:text-text-muted focus:border-accent"
            />
          </div>

          {onCompanyChange && (
            <select
              value={selectedCompany}
              onChange={(e) => onCompanyChange(e.target.value)}
              className="h-8 rounded-[6px] border border-border bg-canvas px-2 text-[11px] font-medium text-text outline-none cursor-pointer"
            >
              <option value="all">All Companies</option>
              {allCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedValidity}
            onChange={(e) => setSelectedValidity(e.target.value)}
            className="h-8 rounded-[6px] border border-border bg-canvas px-2 text-[11px] font-medium text-text outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="useful">Useful</option>
            <option value="old">Old</option>
            <option value="invalid">Invalid</option>
            <option value="awaiting_replacement">Awaiting Replacement</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex rounded-[6px] border border-border bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-surface text-accent shadow-xs font-semibold' : 'text-text-muted hover:text-text'
              }`}
            >
              <LayoutList size={13} />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'tree' ? 'bg-surface text-accent shadow-xs font-semibold' : 'text-text-muted hover:text-text'
              }`}
            >
              <ListTree size={13} />
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'graph' ? 'bg-surface text-accent shadow-xs font-semibold' : 'text-text-muted hover:text-text'
              }`}
            >
              <Network size={13} />
              Graph
            </button>
          </div>

          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1 rounded-[6px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text hover:bg-canvas cursor-pointer"
            >
              <RefreshCw size={11} className={isSyncing ? 'animate-spin text-accent' : 'text-text-muted'} />
              Sync
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Path */}
      <div className="flex items-center gap-1 border-b border-border bg-canvas/40 px-4 py-1.5 text-[11px] text-text-muted">
        <span className="font-medium text-text-muted">Location:</span>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1
          return (
            <div key={crumb.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`cursor-pointer hover:underline ${
                  isLast ? 'font-bold text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                {crumb.name}
              </button>
              {!isLast && <span className="text-border-strong">/</span>}
            </div>
          )
        })}
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Modified</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentFolderChildren.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[12px] text-text-muted">
                    No items in this folder.
                  </td>
                </tr>
              ) : (
                currentFolderChildren.map((item) => {
                  const isFolder = item.type === 'folder'
                  const isSelected = selectedNodeId === item.id
                  const val = item.meta.marks.validity as Validity | undefined
                  const source = (item.meta.marks.source as string | undefined) ?? 'Payroll Legal Belgium'

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (isFolder) setCurrentFolderId(item.id)
                        onSelectNode(item.id)
                      }}
                      className={`cursor-pointer border-b border-border/70 last:border-b-0 transition-colors ${
                        isSelected ? 'bg-accent/8' : 'hover:bg-canvas/70'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {getNodeIcon(item)}
                          <span className="text-[13px] font-medium text-text">{item.name}</span>
                          {item.size != null && (
                            <span className="text-[11px] text-text-muted font-normal">
                              ({formatBytes(item.size)})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-[12px] text-text-secondary truncate max-w-[160px]">
                        {source}
                      </td>

                      <td className="px-3 py-2.5 text-[12px] text-text-muted whitespace-nowrap">
                        {formatDate(item.modified_time)}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {item.meta.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                          {item.meta.tags.length > 2 && (
                            <span className="text-[10px] text-text-muted">+{item.meta.tags.length - 2}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <ValiditySelect
                          value={val ?? 'useful'}
                          onChange={(nextV) => onUpdateValidity(item.id, nextV)}
                          size="sm"
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tree View */}
      {viewMode === 'tree' && (
        <div className="p-3">
          <div className="space-y-0.5">{rootIds.map((rid) => renderTreeNode(rid, 0))}</div>
        </div>
      )}

      {/* Graph View */}
      {viewMode === 'graph' && (
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
            <span>Knowledge Graph · Click a node to view metadata</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green" /> Useful</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber" /> Old</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red" /> Invalid</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> Awaiting</span>
            </div>
          </div>

          <div className="relative h-[320px] w-full rounded-[8px] border border-border bg-canvas/30 overflow-hidden">
            <svg className="h-full w-full">
              {edges.map((edge) => {
                const parent = nodes.find((n) => n.id === edge.parent_id)
                const child = nodes.find((n) => n.id === edge.child_id)
                if (!parent || !child) return null
                const pIndex = nodes.indexOf(parent)
                const cIndex = nodes.indexOf(child)
                const px = 40 + (pIndex % 4) * 200
                const py = 30 + Math.floor(pIndex / 4) * 90
                const cx = 40 + (cIndex % 4) * 200
                const cy = 30 + Math.floor(cIndex / 4) * 90

                return (
                  <path
                    key={`${edge.parent_id}-${edge.child_id}`}
                    d={`M ${px + 70} ${py + 16} C ${px + 100} ${py + 50}, ${cx + 40} ${cy - 20}, ${cx + 70} ${cy + 16}`}
                    fill="none"
                    stroke="#d0d5dd"
                    strokeWidth="1.2"
                    strokeDasharray={edge.parent_id === 'f-shared' ? '3 3' : undefined}
                  />
                )
              })}

              {nodes.map((node, index) => {
                const isSelected = selectedNodeId === node.id
                const x = 40 + (index % 4) * 200
                const y = 30 + Math.floor(index / 4) * 90
                const val = node.meta.marks.validity as Validity | undefined
                const valColor =
                  val === 'old'
                    ? '#dc6803'
                    : val === 'invalid'
                    ? '#d92d20'
                    : val === 'awaiting_replacement'
                    ? '#5b4cdb'
                    : '#039855'

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={() => onSelectNode(node.id)}
                  >
                    <rect
                      width="160"
                      height="32"
                      rx="6"
                      fill={isSelected ? '#eef0fb' : '#ffffff'}
                      stroke={isSelected ? '#5b4cdb' : '#e4e7ec'}
                      strokeWidth={isSelected ? '1.5' : '1'}
                      className="transition-all hover:stroke-accent"
                    />
                    <circle cx="10" cy="16" r="3.5" fill={valColor} />
                    <text
                      x="19"
                      y="20"
                      fontSize="11"
                      fontWeight="500"
                      fill="#101828"
                      className="select-none"
                    >
                      {node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      )}
    </section>
  )
}
