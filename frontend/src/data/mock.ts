export type CaseStatus = 'Open' | 'In review' | 'Resolved'

export type FileStatus = 'Current' | 'Customer-specific' | 'Superseded'

export type TrustLevel = 'strong' | 'official' | 'current' | 'verified' | 'approved' | 'specific' | 'warning'

export interface CaseItem {
  id: string
  customer: string
  topic: string
  country: string
  status: CaseStatus
  unresolvedConflicts: number
  chips: string[]
  answer: string
}

export interface DriveFile {
  id: string
  name: string
  owner: string
  ownerInitials: string
  modified: string
  location: string
  status: FileStatus
  effectiveDate: string
  country: string
  customer: string | null
  approvalStatus: string
  relevance: string
  type: 'doc' | 'sheet' | 'pdf'
}

export interface TrustSignal {
  id: string
  label: string
  value: string
  level: TrustLevel
  explanation: string
}

export interface Expert {
  name: string
  title: string
  team: string
  note: string
  relatedCases: number
}

export const cases: CaseItem[] = [
  {
    id: 'northstar-overtime',
    customer: 'Northstar Logistics',
    topic: 'Overtime approval',
    country: 'Belgium',
    status: 'Open',
    unresolvedConflicts: 1,
    chips: ['Belgium', 'Northstar Logistics', 'White-collar', 'Monthly Payroll', 'Overtime'],
    answer:
      'Manager approval is required under the current Belgian overtime policy. Northstar also has a customer-specific approval workflow. One recent Teams discussion suggests an unverified exception.',
  },
  {
    id: 'acme-holiday',
    customer: 'Acme Belgium',
    topic: 'Holiday pay',
    country: 'Belgium',
    status: 'In review',
    unresolvedConflicts: 0,
    chips: ['Belgium', 'Acme Belgium', 'Holiday pay'],
    answer: 'Holiday pay calculation follows the Belgian statutory rules for this customer segment.',
  },
  {
    id: 'contoso-payroll',
    customer: 'Contoso',
    topic: 'Payroll correction',
    country: 'Netherlands',
    status: 'Open',
    unresolvedConflicts: 2,
    chips: ['Netherlands', 'Contoso', 'Payroll correction'],
    answer: 'Payroll correction requires dual approval and a corrected payslip run.',
  },
]

export const driveFiles: DriveFile[] = [
  {
    id: 'be-overtime-2026',
    name: 'Belgium Overtime Policy 2026',
    owner: 'Payroll Legal Belgium',
    ownerInitials: 'PL',
    modified: 'Sep 12, 2026',
    location: 'Payroll / Belgium / Policies',
    status: 'Current',
    effectiveDate: 'Jan 1, 2026',
    country: 'Belgium',
    customer: null,
    approvalStatus: 'Approved',
    relevance:
      'Matches country (Belgium), topic (overtime), and is the current approved policy for white-collar monthly payroll.',
    type: 'doc',
  },
  {
    id: 'northstar-exceptions',
    name: 'Northstar Payroll Exceptions',
    owner: 'Sophie Vermeulen',
    ownerInitials: 'SV',
    modified: 'Jun 18, 2026',
    location: 'Customers / Northstar / Payroll',
    status: 'Customer-specific',
    effectiveDate: 'Jun 18, 2026',
    country: 'Belgium',
    customer: 'Northstar Logistics',
    approvalStatus: 'Approved',
    relevance:
      'Customer-specific approval workflow for Northstar Logistics overtime and payroll exceptions.',
    type: 'sheet',
  },
  {
    id: 'overtime-manual',
    name: 'Overtime Processing Manual',
    owner: 'Payroll Operations',
    ownerInitials: 'PO',
    modified: 'Nov 3, 2023',
    location: 'Payroll / Manuals',
    status: 'Superseded',
    effectiveDate: 'Nov 3, 2023',
    country: 'Belgium',
    customer: null,
    approvalStatus: 'Superseded',
    relevance:
      'Historically relevant to overtime processing, but superseded by the 2026 Belgian overtime policy.',
    type: 'pdf',
  },
]

export const trustSignals: TrustSignal[] = [
  {
    id: 'context',
    label: 'Context match',
    value: 'Strong',
    level: 'strong',
    explanation:
      'Context match is strong because this file matches Belgium, Northstar Logistics, overtime, and current payroll process.',
  },
  {
    id: 'authority',
    label: 'Authority',
    value: 'Official',
    level: 'official',
    explanation: 'Owned by Payroll Legal Belgium and published as the official country policy.',
  },
  {
    id: 'recency',
    label: 'Recency',
    value: 'Current',
    level: 'current',
    explanation: 'Last updated Sep 12, 2026 and marked as the current effective policy.',
  },
  {
    id: 'owner',
    label: 'Owner',
    value: 'Verified',
    level: 'verified',
    explanation: 'Owner is a verified SD Worx legal/payroll authority for Belgium.',
  },
  {
    id: 'validation',
    label: 'Validation',
    value: 'Approved',
    level: 'approved',
    explanation: 'Document passed formal approval workflow before publication in Drive.',
  },
  {
    id: 'customer',
    label: 'Customer match',
    value: 'Specific evidence found',
    level: 'specific',
    explanation: 'Northstar Payroll Exceptions confirms a customer-specific approval workflow.',
  },
  {
    id: 'conflicts',
    label: 'Conflicts',
    value: '1 unresolved',
    level: 'warning',
    explanation:
      'A Teams discussion suggests an exception that is not confirmed by any approved Google Drive document.',
  },
]

export const expert: Expert = {
  name: 'Sophie Vermeulen',
  title: 'Senior Payroll Consultant',
  team: 'Belgium Payroll',
  note: 'Worked with Northstar',
  relatedCases: 14,
}

export const conflict = {
  title: '1 unresolved uncertainty',
  summary:
    'A Teams discussion from Sep 26 suggests an exception, but no approved Google Drive document confirms it.',
  currentPolicy: 'Manager approval required.',
  oldManual: 'Prior approval not required.',
  resolution: 'Old manual was superseded in 2026.',
}
