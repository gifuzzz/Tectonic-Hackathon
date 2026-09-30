export type NodeType = 'file' | 'folder'
export type Validity = 'useful' | 'old' | 'invalid' | 'awaiting_replacement'

export interface NoteItem {
  id: string
  text: string
  author: string
  at: string
  validity: Validity
  parent_id: string | null
  refs: string[]
}

export interface FileVersion {
  id: string
  name: string
  at: string
  current: boolean
}

export interface NodeMeta {
  notes: string
  tags: string[]
  category: string | null
  marks: {
    validity?: Validity
    companies?: string[]
    countries?: string[]
    source?: string
    notes_thread?: NoteItem[]
    versions?: FileVersion[]
    stable_id?: string
    [key: string]: unknown
  }
  updated_at: string | null
  updated_by: string | null
}

export interface DriveNode {
  id: string
  name: string
  type: NodeType
  mime_type: string | null
  parent_id: string | null
  size: number | null
  modified_time: string | null
  trashed: boolean
  meta: NodeMeta
}

export interface DriveEdge {
  parent_id: string
  child_id: string
}

export interface GraphPayload {
  nodes: DriveNode[]
  edges: DriveEdge[]
  root_ids: string[]
}

export interface HistoryEntry {
  id: number
  node_id: string
  field: string
  old_value: unknown
  new_value: unknown
  changed_at: string
  changed_by: string | null
}

export interface AiSuggestion {
  id: string
  channel: 'email' | 'Teams' | 'phone'
  at: string
  title: string
  body: string
  targetNodeId: string
  targetName: string
  suggestionType: 'note' | 'validity'
  proposedValidity?: Validity
  proposedNote?: string
}

function emptyMeta(partial?: Partial<NodeMeta>): NodeMeta {
  return {
    notes: '',
    tags: [],
    category: null,
    marks: {},
    updated_at: null,
    updated_by: null,
    ...partial,
    marks: { ...(partial?.marks ?? {}) },
  }
}

function folder(
  id: string,
  name: string,
  parent_id: string | null,
  meta?: Partial<NodeMeta>,
): DriveNode {
  return {
    id,
    name,
    type: 'folder',
    mime_type: 'application/vnd.google-apps.folder',
    parent_id,
    size: null,
    modified_time: null,
    trashed: false,
    meta: emptyMeta(meta),
  }
}

function file(
  id: string,
  name: string,
  parent_id: string,
  mime: string,
  size: number,
  modified: string,
  meta?: Partial<NodeMeta>,
): DriveNode {
  return {
    id,
    name,
    type: 'file',
    mime_type: mime,
    parent_id,
    size,
    modified_time: modified,
    trashed: false,
    meta: emptyMeta(meta),
  }
}

/** SD Worx-shaped Drive tree with Ivan metadata fields in marks/tags. */
export function buildKnowledgeGraph(): GraphPayload {
  const nodes: DriveNode[] = [
    folder('root', 'My Drive', null, {
      category: 'Root',
      marks: { source: 'Google Drive', validity: 'useful' },
    }),
    folder('f-payroll', 'Payroll', 'root', {
      tags: ['payroll'],
      category: 'Payroll',
      marks: { countries: ['Belgium'], source: 'HR', validity: 'useful' },
    }),
    folder('f-be', 'Belgium', 'f-payroll', {
      tags: ['country'],
      category: 'Country',
      marks: { countries: ['Belgium'], source: 'Payroll Legal Belgium', validity: 'useful' },
    }),
    folder('f-policies', 'Policies', 'f-be', {
      tags: ['law', 'policy'],
      category: 'Policy',
      marks: { countries: ['Belgium'], source: 'Payroll Legal Belgium', validity: 'useful' },
    }),
    folder('f-manuals', 'Manuals', 'f-payroll', {
      tags: ['manual'],
      category: 'Operations',
      marks: { source: 'Payroll Operations', validity: 'old' },
    }),
    folder('f-customers', 'Customers', 'root', {
      tags: ['customer'],
      category: 'Customers',
      marks: { source: 'Account Management', validity: 'useful' },
    }),
    folder('f-northstar', 'Northstar', 'f-customers', {
      tags: ['customer'],
      category: 'Customer',
      marks: {
        companies: ['Northstar Logistics'],
        countries: ['Belgium'],
        source: 'Sophie Vermeulen',
        validity: 'useful',
      },
    }),
    folder('f-northstar-payroll', 'Payroll', 'f-northstar', {
      tags: ['payroll', 'customer'],
      marks: {
        companies: ['Northstar Logistics'],
        countries: ['Belgium'],
        source: 'Sophie Vermeulen',
        validity: 'useful',
      },
    }),
    folder('f-shared', 'Shared Team', 'root', {
      tags: ['shared'],
      marks: { source: 'HR', validity: 'useful' },
    }),

    file(
      'file-be-overtime-2026',
      'Belgium Overtime Policy 2026.pdf',
      'f-policies',
      'application/pdf',
      184320,
      '2026-09-12T10:00:00Z',
      {
        notes: 'Current Belgian overtime policy for white-collar monthly payroll.',
        tags: ['law', 'overtime', 'policy'],
        category: 'Policy',
        marks: {
          validity: 'useful',
          companies: [],
          countries: ['Belgium'],
          source: 'Payroll Legal Belgium',
          stable_id: 'be-overtime-policy',
          versions: [
            {
              id: 'file-be-overtime-2025',
              name: 'Belgium Overtime Policy 2025.pdf',
              at: '2025-01-10T09:00:00Z',
              current: false,
            },
            {
              id: 'file-be-overtime-2026',
              name: 'Belgium Overtime Policy 2026.pdf',
              at: '2026-09-12T10:00:00Z',
              current: true,
            },
          ],
          notes_thread: [
            {
              id: 'n1',
              text: 'Manager approval is mandatory under section 4.',
              author: 'Payroll Legal Belgium',
              at: '2026-09-12T11:00:00Z',
              validity: 'useful',
              parent_id: null,
              refs: [],
            },
            {
              id: 'n2',
              text: 'If you are reading this file you will also need to read @Overtime Processing Manual.pdf',
              author: 'Sophie Vermeulen',
              at: '2026-09-15T14:20:00Z',
              validity: 'useful',
              parent_id: null,
              refs: ['file-overtime-manual'],
            },
            {
              id: 'n3',
              text: 'Confirmed for Northstar white-collar payroll.',
              author: 'L. Martin',
              at: '2026-09-16T09:05:00Z',
              validity: 'useful',
              parent_id: 'n2',
              refs: [],
            },
          ],
        },
        updated_at: '2026-09-16T09:05:00Z',
        updated_by: 'L. Martin',
      },
    ),
    file(
      'file-be-overtime-2025',
      'Belgium Overtime Policy 2025.pdf',
      'f-policies',
      'application/pdf',
      160000,
      '2025-01-10T09:00:00Z',
      {
        notes: 'Superseded by 2026 policy.',
        tags: ['law', 'overtime', 'policy'],
        category: 'Policy',
        marks: {
          validity: 'awaiting_replacement',
          countries: ['Belgium'],
          source: 'Payroll Legal Belgium',
          stable_id: 'be-overtime-policy',
          versions: [
            {
              id: 'file-be-overtime-2025',
              name: 'Belgium Overtime Policy 2025.pdf',
              at: '2025-01-10T09:00:00Z',
              current: false,
            },
            {
              id: 'file-be-overtime-2026',
              name: 'Belgium Overtime Policy 2026.pdf',
              at: '2026-09-12T10:00:00Z',
              current: true,
            },
          ],
          notes_thread: [
            {
              id: 'n4',
              text: 'Replaced by Belgium Overtime Policy 2026.',
              author: 'Payroll Legal Belgium',
              at: '2026-01-05T08:00:00Z',
              validity: 'old',
              parent_id: null,
              refs: ['file-be-overtime-2026'],
            },
          ],
        },
        updated_at: '2026-01-05T08:00:00Z',
        updated_by: 'Payroll Legal Belgium',
      },
    ),
    file(
      'file-northstar-exceptions',
      'Northstar Payroll Exceptions.xlsx',
      'f-northstar-payroll',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      92160,
      '2026-06-18T16:45:00Z',
      {
        notes: 'Customer-specific overtime approval workflow.',
        tags: ['contract', 'customer-specific', 'overtime'],
        category: 'Customer exception',
        marks: {
          validity: 'useful',
          companies: ['Northstar Logistics'],
          countries: ['Belgium'],
          source: 'Sophie Vermeulen',
          stable_id: 'northstar-exceptions',
          versions: [
            {
              id: 'file-northstar-exceptions',
              name: 'Northstar Payroll Exceptions.xlsx',
              at: '2026-06-18T16:45:00Z',
              current: true,
            },
          ],
          notes_thread: [
            {
              id: 'n5',
              text: 'Northstar requires manager approval plus local HR sign-off.',
              author: 'Sophie Vermeulen',
              at: '2026-06-18T17:00:00Z',
              validity: 'useful',
              parent_id: null,
              refs: ['file-be-overtime-2026'],
            },
          ],
        },
        updated_at: '2026-06-18T17:00:00Z',
        updated_by: 'Sophie Vermeulen',
      },
    ),
    file(
      'file-overtime-manual',
      'Overtime Processing Manual.pdf',
      'f-manuals',
      'application/pdf',
      220000,
      '2023-11-03T12:00:00Z',
      {
        notes: 'Historical processing manual. Superseded for Belgium in 2026.',
        tags: ['manual', 'overtime', 'summary of policy'],
        category: 'Manual',
        marks: {
          validity: 'old',
          countries: ['Belgium'],
          source: 'Payroll Operations',
          stable_id: 'overtime-manual',
          versions: [
            {
              id: 'file-overtime-manual',
              name: 'Overtime Processing Manual.pdf',
              at: '2023-11-03T12:00:00Z',
              current: true,
            },
          ],
          notes_thread: [
            {
              id: 'n6',
              text: 'Section 8 is no longer in action for Belgium white-collar payroll.',
              author: 'Payroll Operations',
              at: '2026-02-01T10:00:00Z',
              validity: 'old',
              parent_id: null,
              refs: ['file-be-overtime-2026'],
            },
          ],
        },
        updated_at: '2026-02-01T10:00:00Z',
        updated_by: 'Payroll Operations',
      },
    ),
    file(
      'file-holiday-pay',
      'Belgium Holiday Pay Guide.docx',
      'f-policies',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      64000,
      '2026-03-02T09:30:00Z',
      {
        notes: 'Holiday pay rules for Belgian statutory calculations.',
        tags: ['law', 'holiday-pay'],
        category: 'Policy',
        marks: {
          validity: 'useful',
          countries: ['Belgium'],
          companies: ['Acme Belgium'],
          source: 'Italian Gvt.'.replace('Italian Gvt.', 'Belgian Statutory'),
          notes_thread: [],
          versions: [
            {
              id: 'file-holiday-pay',
              name: 'Belgium Holiday Pay Guide.docx',
              at: '2026-03-02T09:30:00Z',
              current: true,
            },
          ],
        },
      },
    ),
    file(
      'file-appendix7',
      'appendix7.pdf',
      'f-manuals',
      'application/pdf',
      28000,
      '2024-05-12T08:00:00Z',
      {
        notes: 'Appendix referenced by overtime notes.',
        tags: ['appendix', 'template for overtime'],
        category: 'Appendix',
        marks: {
          validity: 'useful',
          source: 'Payroll Operations',
          notes_thread: [],
          versions: [
            {
              id: 'file-appendix7',
              name: 'appendix7.pdf',
              at: '2024-05-12T08:00:00Z',
              current: true,
            },
          ],
        },
      },
    ),
    file(
      'file-contoso-correction',
      'Contoso Payroll Correction Template.xlsx',
      'f-shared',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      30720,
      '2026-09-15T08:15:00Z',
      {
        tags: ['template for payroll correction', 'data'],
        category: 'Template',
        marks: {
          validity: 'useful',
          companies: ['Contoso'],
          countries: ['Netherlands'],
          source: 'HR',
          notes_thread: [],
          versions: [
            {
              id: 'file-contoso-correction',
              name: 'Contoso Payroll Correction Template.xlsx',
              at: '2026-09-15T08:15:00Z',
              current: true,
            },
          ],
        },
      },
    ),
  ]

  // Fix holiday source string properly
  const holiday = nodes.find((n) => n.id === 'file-holiday-pay')
  if (holiday) {
    holiday.meta.marks.source = 'Belgian Statutory'
  }

  const edges: DriveEdge[] = nodes
    .filter((n) => n.parent_id)
    .map((n) => ({ parent_id: n.parent_id!, child_id: n.id }))

  // Shared into Shared Team as well (graph, not only tree)
  edges.push({ parent_id: 'f-shared', child_id: 'file-be-overtime-2026' })

  return {
    nodes,
    edges,
    root_ids: nodes.filter((n) => !n.parent_id).map((n) => n.id),
  }
}

export const aiSuggestions: AiSuggestion[] = [
  {
    id: 'ai-1',
    channel: 'Teams',
    at: '2026-09-26T15:40:00Z',
    title: 'Unverified exception mentioned',
    body: 'Teams discussion suggests a Northstar overtime exception. AI proposes a note on Northstar Payroll Exceptions and validity review.',
    targetNodeId: 'file-northstar-exceptions',
    targetName: 'Northstar Payroll Exceptions.xlsx',
    suggestionType: 'note',
    proposedNote:
      'Teams (Sep 26): possible exception claimed — no approved Drive confirmation yet.',
  },
  {
    id: 'ai-2',
    channel: 'email',
    at: '2026-09-28T09:10:00Z',
    title: 'Mark old manual as awaiting replacement',
    body: 'Email from Payroll Ops confirms Belgium overtime manual should move to awaiting replacement.',
    targetNodeId: 'file-overtime-manual',
    targetName: 'Overtime Processing Manual.pdf',
    suggestionType: 'validity',
    proposedValidity: 'awaiting_replacement',
  },
  {
    id: 'ai-3',
    channel: 'phone',
    at: '2026-09-29T11:05:00Z',
    title: 'Add company tag for Contoso',
    body: 'Call log: Contoso correction template should stay company-scoped to Contoso.',
    targetNodeId: 'file-contoso-correction',
    targetName: 'Contoso Payroll Correction Template.xlsx',
    suggestionType: 'note',
    proposedNote: 'Confirmed company visibility: Contoso only (phone call Sep 29).',
  },
]

export const companyAssignments: Record<string, string[]> = {
  'L. Martin': ['Northstar Logistics', 'Acme Belgium'],
  'Sophie Vermeulen': ['Northstar Logistics'],
  'Payroll Ops': ['Contoso'],
}

export const CURRENT_USER = 'L. Martin'
