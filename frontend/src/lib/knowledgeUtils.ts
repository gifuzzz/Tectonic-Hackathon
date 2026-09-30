import type { DriveEdge, DriveNode, Validity } from '../data/knowledge'

export function childrenOf(
  nodeId: string,
  nodes: DriveNode[],
  edges: DriveEdge[],
): DriveNode[] {
  const childIds = new Set(
    edges.filter((e) => e.parent_id === nodeId).map((e) => e.child_id),
  )
  return nodes
    .filter((n) => childIds.has(n.id) && !n.trashed)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function breadcrumbPath(
  nodeId: string | null,
  nodes: DriveNode[],
): DriveNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: DriveNode[] = []
  let cur = nodeId ? byId.get(nodeId) : undefined
  while (cur) {
    path.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return path
}

export function folderTree(
  nodes: DriveNode[],
  edges: DriveEdge[],
  rootIds: string[],
): { node: DriveNode; depth: number }[] {
  const result: { node: DriveNode; depth: number }[] = []
  const walk = (id: string, depth: number) => {
    const node = nodes.find((n) => n.id === id)
    if (!node || node.type !== 'folder' || node.trashed) return
    result.push({ node, depth })
    childrenOf(id, nodes, edges)
      .filter((c) => c.type === 'folder')
      .forEach((c) => walk(c.id, depth + 1))
  }
  rootIds.forEach((id) => walk(id, 0))
  return result
}

export function validityStyles(v?: Validity): { chip: string; dot: string; label: string } {
  switch (v) {
    case 'useful':
      return { chip: 'bg-green-soft text-green', dot: 'bg-green', label: 'useful' }
    case 'old':
      return { chip: 'bg-amber-soft text-amber', dot: 'bg-amber', label: 'old' }
    case 'invalid':
      return { chip: 'bg-red-soft text-red', dot: 'bg-red', label: 'invalid' }
    case 'awaiting_replacement':
      return { chip: 'bg-accent-soft text-accent', dot: 'bg-accent', label: 'awaiting replacement' }
    default:
      return { chip: 'bg-canvas text-text-muted border border-border', dot: 'bg-text-muted', label: 'unset' }
  }
}

export function formatBytes(size: number | null): string {
  if (size == null) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function parseNoteRefs(text: string): string[] {
  const matches = text.match(/@([^\s]+\.\w+)/g) ?? []
  return matches.map((m) => m.slice(1))
}

export function findNodeByName(nodes: DriveNode[], name: string): DriveNode | undefined {
  return nodes.find((n) => n.name === name || n.name.toLowerCase() === name.toLowerCase())
}
