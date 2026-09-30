// Typed client for the Django backend (archit/backend). All calls go through /api (proxied by Vite).

export type Validity = '' | 'useful' | 'old' | 'invalid' | 'awaiting_replacement'

export interface Ref {
  id: number
  name: string
}

export interface Owner {
  name: string
  email: string
  role?: string
}

export interface TrustCheck {
  rule: string
  passed: boolean | null
  detail: string
}

export interface Trust {
  contextMatch: 'strong' | 'partial' | 'weak' | 'mismatch' | 'unknown'
  authority: 'official' | 'in_review' | 'unverified' | 'draft' | 'archived'
  recency: 'current' | 'upcoming' | 'stale' | 'expired' | 'unknown'
  ownerVerified: boolean
  superseded: boolean
  supersededBy: number | null
  conflicts: number
  customerSpecific: boolean
  score: number
  verdict: 'trusted' | 'use_with_caution' | 'do_not_use'
  checks: TrustCheck[]
}

export interface FileSummary {
  id: number
  driveId: string
  name: string
  mimeType: string
  path: string
  sharedDrive: { id: string; name: string } | null
  webViewLink: string
  owners: Owner[]
  ownerEmail: string
  owner: { id: number; name: string; email: string } | null
  modifiedAt: string | null
  size: number | null
  country: string
  countryName: string
  customer: Ref | null
  topic: string
  documentType: string
  status: string
  effectiveDate: string | null
  expiryDate: string | null
  summary: string
}

export interface Conflict {
  id: number
  fileA: Ref
  fileB: Ref
  subject: string
  claimA: string
  claimB: string
  severity: 'high' | 'medium' | 'low'
  reasons: string[]
  resolved: boolean
  resolutionNote: string
  detectedAt: string
}

export interface Expert {
  id: number
  name: string
  email: string
  expertiseTags: string[]
  customers: string[]
  active: boolean
}

export interface RankedExpert extends Expert {
  score: number
  reasons: string[]
}

export interface CaseSummary {
  id: number
  title: string
  customer: Ref | null
  country: string
  topic: string
  status: 'open' | 'in_review' | 'resolved'
  reviewStatus: 'not_requested' | 'requested' | 'completed'
  assignedExpert: Expert | null
  evidenceCount: number
  createdAt: string
  updatedAt: string
}

export interface CaseDetail extends CaseSummary {
  question: string
  evidenceFileIds: number[]
  unresolvedConflicts: Conflict[]
  resolution: string
  resolvedAt: string | null
}

export interface Context {
  country: string
  customer: Ref | null
  topic: string
}

export type EvidenceFile = FileSummary & { selected: boolean; note: string; trust: Trust }

export interface CaseEvidence {
  caseId: number
  context: Context
  evidence: EvidenceFile[]
  conflicts: Conflict[]
}

export interface OpposingClaim {
  subject: string
  valueA: string
  valueB: string
  textA: string
  textB: string
}

export interface Comparison {
  fileA: number
  fileB: number
  checks: Record<string, boolean>
  opposingClaims: OpposingClaim[]
  isConflict: boolean
  severity: string | null
  reasons: string[]
}

export type SearchResult = FileSummary & { relevance: number; rank: number; snippet: string; trust: Trust }

export interface SearchResponse {
  query: string
  context: Context
  results: SearchResult[]
  conflicts: Conflict[]
}

// ---- storage (Drive tree + our data) ----

export interface NodeMeta {
  companies: string[]
  source: string
  tags: string[]
  category: string
  marks: Record<string, unknown>
  validity: Validity
  updatedAt: string | null
  updatedBy: string
}

export interface NodeKnowledge {
  country: string
  countryName: string
  customer: Ref | null
  topic: string
  documentType: string
  status: string
  effectiveDate: string | null
  expiryDate: string | null
  owner: { id: number; name: string; email: string } | null
  ownerEmail: string
  summary: string
}

export interface Permission {
  type: string
  role: string
  email: string
  domain: string
  name: string
}

export interface DriveNode {
  id: string | null
  pk: number | null
  name: string
  type: 'file' | 'folder'
  virtual: boolean
  mimeType: string | null
  parentId: string | null
  path: string
  fullPath: string
  trashed: boolean
  drive: {
    owners: Owner[]
    modifiedAt: string | null
    size: number | null
    webViewLink: string
    sharedDrive: string | null
    permissions?: Permission[]
  } | null
  knowledge: NodeKnowledge | null
  meta: NodeMeta | null
  notesCount: number
  version: number
  childCount: number | null
}

export interface BrowseResponse {
  path: string
  segments: string[]
  breadcrumbs: { name: string; path: string }[]
  folder: DriveNode
  children: DriveNode[]
}

export interface Mention {
  id: string
  pk: number
  name: string
  fullPath: string
  mentionedVersion: number
  currentVersion: number
  outdated: boolean
}

export interface NoteItem {
  id: number
  parentId: number | null
  author: string
  text: string
  validity: Validity
  createdAt: string
  mentions: Mention[]
  replies: NoteItem[]
}

export interface Change {
  id: number
  action: 'meta' | 'note_added' | 'note_reply' | 'note_validity' | 'version'
  field: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt: string
  noteId: number | null
}

export interface Version {
  number: number
  name: string
  modifiedAt: string | null
  size: number | null
  recordedAt: string
}

export interface NodeDetail {
  node: DriveNode
  children: DriveNode[]
  parents: DriveNode[]
  trust: Trust | null
  claims: { subject: string; value: string; text?: string }[]
  supersedes: { id: string; name: string } | null
  supersededBy: { id: string; name: string }[]
  conflicts: Conflict[]
  notes: NoteItem[]
  history: Change[]
  versions: Version[]
  mentionedIn: { noteId: number; fileId: string; fileName: string; version: number }[]
  content: string
}

export interface User {
  email: string
  name: string
  companies: string[]
  countries: string[]
  seeAll: boolean
}

export interface Suggestion {
  id: number
  file: { id: string; pk: number; name: string; fullPath: string }
  source: 'email' | 'message' | 'call'
  sender: string
  excerpt: string
  kind: 'note' | 'validity'
  suggestedNote: string
  suggestedValidity: Validity
  reason: string
  status: 'pending' | 'accepted' | 'dismissed'
  createdAt: string
}

export type Activity = Change & { file: { id: string; name: string } }

export interface MetaPatch {
  companies?: string[]
  source?: string
  tags?: string[]
  category?: string
  validity?: Validity
}

// ---- transport ----

const USER_KEY = 'kt.userEmail'

export function getUserEmail(): string {
  try {
    return localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setUserEmail(email: string) {
  try {
    localStorage.setItem(USER_KEY, email)
  } catch {
    // storage blocked: the choice just won't persist
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const email = getUserEmail()
  if (email) headers['X-User-Email'] = email
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let resp: Response
  try {
    resp = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Cannot reach the backend. Is it running? (cd archit/backend && uv run python manage.py runserver)')
  }
  const text = await resp.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new ApiError(resp.status, `Backend returned non-JSON (${resp.status}). Is the Django server running on :8000?`)
  }
  if (!resp.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${resp.status})`
    throw new ApiError(resp.status, message)
  }
  return data as T
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : ''
}

export const api = {
  cases: () => request<CaseSummary[]>('GET', '/cases'),
  case: (id: number | string) => request<CaseDetail>('GET', `/cases/${id}`),
  caseEvidence: (id: number | string) => request<CaseEvidence>('GET', `/cases/${id}/evidence`),
  search: (query: string, filters: { country?: string; customer?: string; topic?: string } = {}) =>
    request<SearchResponse>('POST', '/search', { query, ...filters }),
  compare: (fileIds: number[]) =>
    request<{ comparisons: Comparison[]; conflictCount: number }>('POST', '/compare', { fileIds }),
  requestReview: (body: { caseId?: number; title?: string; question?: string; customer?: string; country?: string;
    topic?: string; evidenceFileIds?: number[]; expertId?: number }) =>
    request<CaseDetail>('POST', '/request-review', body),
  resolve: (caseId: number, resolution: string) => request<CaseDetail>('POST', '/resolve', { caseId, resolution }),
  experts: (filters: { customer?: string; country?: string; topic?: string; fileId?: number } = {}) =>
    request<RankedExpert[]>('GET', `/experts${qs(filters)}`),
  customers: () => request<Ref[]>('GET', '/customers'),
  conflicts: (resolved?: boolean) =>
    request<Conflict[]>('GET', `/conflicts${qs({ resolved: resolved === undefined ? undefined : String(resolved) })}`),

  browse: (path: string) => request<BrowseResponse>('GET', `/browse${qs({ path })}`),
  node: (driveId: string, context: { country?: string; customer?: string } = {}) =>
    request<NodeDetail>('GET', `/nodes/${encodeURIComponent(driveId)}${qs(context)}`),
  patchMeta: (driveId: string, patch: MetaPatch) =>
    request<DriveNode>('PATCH', `/nodes/${encodeURIComponent(driveId)}/meta`, patch),
  addNote: (driveId: string, text: string, parentId?: number, validity: Validity = '') =>
    request<{ notes: NoteItem[] }>('POST', `/nodes/${encodeURIComponent(driveId)}/notes`, { text, parentId, validity }),
  setNoteValidity: (noteId: number, validity: Validity) =>
    request<{ notes: NoteItem[] }>('PATCH', `/notes/${noteId}`, { validity }),
  metaSearch: (params: { q?: string; tag?: string; validity?: string; company?: string; type?: string }) =>
    request<{ count: number; nodes: DriveNode[] }>('GET', `/search${qs(params)}`),
  sync: () => request<{ files: number; changed: number; removed: number; unresolvedConflicts: number }>('POST', '/sync'),
  users: () => request<User[]>('GET', '/users'),
  activity: (limit = 15) => request<Activity[]>('GET', `/activity${qs({ limit })}`),
  suggestions: () => request<Suggestion[]>('GET', '/suggestions'),
  analyze: (source: string, sender: string, text: string) =>
    request<{ created: Suggestion[] }>('POST', '/suggestions/analyze', { source, sender, text }),
  acceptSuggestion: (id: number) => request<Suggestion>('POST', `/suggestions/${id}/accept`, {}),
  dismissSuggestion: (id: number) => request<Suggestion>('POST', `/suggestions/${id}/dismiss`, {}),
}
