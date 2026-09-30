import type { Validity } from '../api'

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatSize(size: number | null | undefined): string {
  if (size === null || size === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  for (const unit of units) {
    if (value < 1024) return `${value.toFixed(unit === 'B' ? 0 : 1)} ${unit}`
    value /= 1024
  }
  return `${value.toFixed(1)} TB`
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s.-]/gu, ' ').split(/[\s.]+/).filter(Boolean)
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase()
}

export function humanize(value: string): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export const VALIDITY_OPTIONS: { value: Validity; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'useful', label: 'Useful' },
  { value: 'old', label: 'Old' },
  { value: 'awaiting_replacement', label: 'Awaiting replacement' },
  { value: 'invalid', label: 'Invalid' },
]

// ivan/features.md: invalid, old = yellow, useful = green, awaiting replacement = blue
export function validityStyle(validity: Validity | undefined): string {
  switch (validity) {
    case 'useful':
      return 'bg-green-soft text-green border-green/30'
    case 'old':
      return 'bg-amber-soft text-amber border-amber/30'
    case 'awaiting_replacement':
      return 'bg-blue-soft text-blue border-blue/30'
    case 'invalid':
      return 'bg-red-soft text-red border-red/30'
    default:
      return 'bg-canvas text-text-muted border-border'
  }
}

export function validityLabel(validity: Validity | undefined): string {
  return VALIDITY_OPTIONS.find((o) => o.value === (validity ?? ''))?.label ?? 'Not set'
}

export function verdictStyle(verdict: string): string {
  if (verdict === 'trusted') return 'bg-green-soft text-green'
  if (verdict === 'do_not_use') return 'bg-red-soft text-red'
  return 'bg-amber-soft text-amber'
}

export function verdictLabel(verdict: string): string {
  if (verdict === 'trusted') return 'Trusted'
  if (verdict === 'do_not_use') return 'Do not use'
  return 'Use with caution'
}

export function caseStatusStyle(status: string): string {
  if (status === 'open') return 'bg-accent-soft text-accent'
  if (status === 'in_review') return 'bg-amber-soft text-amber'
  return 'bg-green-soft text-green'
}

export function fileKind(mimeType: string | null | undefined): 'folder' | 'doc' | 'sheet' | 'pdf' | 'slides' | 'other' {
  const mime = mimeType ?? ''
  if (mime === 'application/vnd.google-apps.folder') return 'folder'
  if (mime.includes('spreadsheet') || mime.includes('csv') || mime.includes('excel')) return 'sheet'
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('presentation')) return 'slides'
  if (mime.includes('document') || mime.includes('word') || mime.startsWith('text/')) return 'doc'
  return 'other'
}
