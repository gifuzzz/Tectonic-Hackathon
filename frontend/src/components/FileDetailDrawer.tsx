import { ExternalLink, X, Share2 } from 'lucide-react'
import type { DriveFile } from '../data/mock'

interface Props {
  file: DriveFile | null
  open: boolean
  onClose: () => void
}

export function FileDetailDrawer({ file, open, onClose }: Props) {
  if (!open || !file) return null

  const rows = [
    { label: 'Drive location', value: file.location },
    { label: 'Owner', value: file.owner },
    { label: 'Modified', value: file.modified },
    { label: 'Effective date', value: file.effectiveDate },
    { label: 'Country', value: file.country },
    { label: 'Customer', value: file.customer ?? '—' },
    { label: 'Approval status', value: file.approvalStatus },
  ]

  return (
    <>
      <button
        type="button"
        aria-label="Close file detail"
        className="fixed inset-0 z-30 cursor-default bg-black/20"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 z-40 flex h-full w-[380px] flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-4">
          <div className="pr-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <Share2 size={12} />
              Shared in Google Drive
            </div>
            <h2 className="text-[15px] leading-snug font-bold text-text">{file.name}</h2>
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[120px_1fr] gap-2">
                <dt className="text-[12px] text-text-muted">{row.label}</dt>
                <dd className="text-[12px] font-medium text-text">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-[10px] border border-border bg-canvas p-3">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
              Why relevant
            </div>
            <p className="text-[12px] leading-relaxed text-text-secondary">{file.relevance}</p>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[13px] font-semibold text-text hover:bg-canvas"
          >
            <ExternalLink size={15} className="text-[#1a73e8]" />
            Open in Google Drive
          </button>
        </div>
      </aside>
    </>
  )
}
