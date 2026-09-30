import {
  buildKnowledgeGraph,
  type DriveNode,
  type GraphPayload,
  type HistoryEntry,
  type NodeMeta,
} from '../data/knowledge'

const API_BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function checkHealth(): Promise<boolean> {
  try {
    await request<{ status: string }>('/health')
    return true
  } catch {
    return false
  }
}

function normalizeNode(raw: Record<string, unknown>): DriveNode {
  const meta = (raw.meta as Partial<NodeMeta> | undefined) ?? {}
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    type: raw.type === 'folder' ? 'folder' : 'file',
    mime_type: (raw.mime_type as string | null) ?? null,
    parent_id: (raw.parent_id as string | null) ?? null,
    size: (raw.size as number | null) ?? null,
    modified_time: (raw.modified_time as string | null) ?? null,
    trashed: Boolean(raw.trashed),
    meta: {
      notes: meta.notes ?? '',
      tags: meta.tags ?? [],
      category: meta.category ?? null,
      marks: meta.marks ?? {},
      updated_at: meta.updated_at ?? null,
      updated_by: meta.updated_by ?? null,
    },
  }
}

export async function loadGraph(): Promise<{ graph: GraphPayload; online: boolean }> {
  const local = buildKnowledgeGraph()
  const online = await checkHealth()
  if (!online) {
    return { graph: local, online: false }
  }

  try {
    // Seed enriched graph; backend preserves existing meta on re-ingest for Drive fields.
    await request('/ingest', {
      method: 'POST',
      body: JSON.stringify({
        nodes: local.nodes.map(({ meta: _m, ...drive }) => drive),
        edges: local.edges,
        source: 'frontend-seed',
      }),
    })

    // Push Ivan metadata for nodes that still have empty marks
    for (const node of local.nodes) {
      const marks = node.meta.marks ?? {}
      if (Object.keys(marks).length === 0 && !node.meta.tags.length && !node.meta.notes) continue
      try {
        await request(`/nodes/${node.id}/meta`, {
          method: 'PATCH',
          body: JSON.stringify({
            notes: node.meta.notes,
            tags: node.meta.tags,
            category: node.meta.category,
            marks: node.meta.marks,
            changed_by: 'seed',
          }),
        })
      } catch {
        // ignore per-node seed failures
      }
    }

    const data = await request<{
      nodes: Record<string, unknown>[]
      edges: { parent_id: string; child_id: string }[]
      root_ids: string[]
    }>('/graph')

    const byLocal = new Map(local.nodes.map((n) => [n.id, n]))
    const nodes = data.nodes.map((raw) => {
      const normalized = normalizeNode(raw)
      const seed = byLocal.get(normalized.id)
      // Prefer richer seed marks if API marks are empty
      if (seed && Object.keys(normalized.meta.marks).length === 0) {
        normalized.meta = { ...seed.meta }
      } else if (seed) {
        // Merge seed Ivan fields under API marks when missing keys
        normalized.meta.marks = { ...seed.meta.marks, ...normalized.meta.marks }
        if (!normalized.meta.tags.length) normalized.meta.tags = seed.meta.tags
        if (!normalized.meta.notes) normalized.meta.notes = seed.meta.notes
        if (!normalized.meta.category) normalized.meta.category = seed.meta.category
      }
      return normalized
    })

    return {
      graph: {
        nodes,
        edges: data.edges,
        root_ids: data.root_ids?.length ? data.root_ids : nodes.filter((n) => !n.parent_id).map((n) => n.id),
      },
      online: true,
    }
  } catch {
    return { graph: local, online: false }
  }
}

export async function patchNodeMeta(
  id: string,
  body: {
    notes?: string
    tags?: string[]
    category?: string | null
    marks?: NodeMeta['marks']
    changed_by?: string
  },
): Promise<DriveNode | null> {
  try {
    const raw = await request<Record<string, unknown>>(`/nodes/${id}/meta`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return normalizeNode(raw)
  } catch {
    return null
  }
}

export async function fetchHistory(id: string): Promise<HistoryEntry[]> {
  try {
    const data = await request<{ history: HistoryEntry[] }>(`/nodes/${id}/history`)
    return data.history ?? []
  } catch {
    return []
  }
}

export async function searchNodes(params: {
  q?: string
  tag?: string
  category?: string
  type?: string
}): Promise<DriveNode[]> {
  try {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
    const data = await request<{ nodes: Record<string, unknown>[] }>(`/search?${qs}`)
    return (data.nodes ?? []).map(normalizeNode)
  } catch {
    return []
  }
}

export async function syncDrive(): Promise<boolean> {
  try {
    await request('/sync', { method: 'POST' })
    return true
  } catch {
    return false
  }
}
