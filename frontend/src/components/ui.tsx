import type { ReactNode } from 'react'
import { AlertCircle, FileSpreadsheet, FileText, FileType2, Folder, Loader2, Presentation, File } from 'lucide-react'
import type { Validity } from '../api'
import { VALIDITY_OPTIONS, fileKind, validityLabel, validityStyle } from '../lib/format'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-text-muted">
      <Loader2 size={15} className="animate-spin" />
      {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[12px] border border-red/30 bg-red-soft px-4 py-3 text-[13px] text-red">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="cursor-pointer font-semibold underline">
          Retry
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-[13px] text-text-muted">{children}</div>
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-[8px] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

export function ValidityBadge({ validity }: { validity: Validity | undefined }) {
  if (!validity) return null
  return <Badge className={`border ${validityStyle(validity)}`}>{validityLabel(validity)}</Badge>
}

export function ValiditySelect({
  value,
  onChange,
  disabled,
  size = 'md',
}: {
  value: Validity
  onChange: (v: Validity) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Validity)}
      aria-label="Validity"
      className={[
        'cursor-pointer rounded-[8px] border font-semibold disabled:cursor-wait disabled:opacity-60',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1.5 text-[12px]',
        validityStyle(value),
      ].join(' ')}
    >
      {VALIDITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function FileIcon({ mimeType, size = 'md' }: { mimeType: string | null | undefined; size?: 'sm' | 'md' }) {
  const kind = fileKind(mimeType)
  const box = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'
  const styles: Record<string, [string, typeof File]> = {
    folder: ['bg-[#fef0c7] text-[#b54708]', Folder],
    sheet: ['bg-[#e6f4ea] text-[#137333]', FileSpreadsheet],
    pdf: ['bg-[#fce8e6] text-[#c5221f]', FileType2],
    slides: ['bg-[#fef7e0] text-[#b06000]', Presentation],
    doc: ['bg-[#e8f0fe] text-[#1a73e8]', FileText],
    other: ['bg-canvas text-text-muted', File],
  }
  const [color, Icon] = styles[kind]
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-[6px] ${color}`}>
      <Icon size={size === 'sm' ? 13 : 15} />
    </span>
  )
}

export function Avatar({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-border text-[10px] font-semibold text-text-secondary ${className}`}>
      {label}
    </span>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-[12px] border border-border bg-surface ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-text">{title}</h2>
          {subtitle && <div className="mt-0.5 text-[12px] text-text-muted">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
