import { CheckCircle2, X } from 'lucide-react'
import { conflict } from '../data/mock'

interface Props {
  open: boolean
  onClose: () => void
}

export function CompareEvidenceModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close compare modal"
        className="fixed inset-0 z-40 cursor-default bg-black/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        className="fixed top-1/2 left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="compare-title" className="text-[15px] font-bold text-text">
            Compare evidence
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[8px] p-1.5 text-text-muted hover:bg-canvas"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <div className="rounded-[10px] border border-green/25 bg-green-soft p-3.5">
            <div className="mb-2 text-[11px] font-bold tracking-wide text-green uppercase">
              Current policy
            </div>
            <p className="text-[14px] font-semibold text-text">“{conflict.currentPolicy}”</p>
            <p className="mt-2 text-[12px] text-text-secondary">Belgium Overtime Policy 2026</p>
          </div>

          <div className="rounded-[10px] border border-border bg-canvas p-3.5">
            <div className="mb-2 text-[11px] font-bold tracking-wide text-text-muted uppercase">
              Old manual
            </div>
            <p className="text-[14px] font-semibold text-text-secondary line-through decoration-text-muted/50">
              “{conflict.oldManual}”
            </p>
            <p className="mt-2 text-[12px] text-text-muted">Overtime Processing Manual · 2023</p>
          </div>
        </div>

        <div className="mx-5 mb-5 flex items-start gap-2.5 rounded-[10px] border border-green/30 bg-green-soft px-3.5 py-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />
          <p className="text-[13px] font-semibold text-green">{conflict.resolution}</p>
        </div>
      </div>
    </>
  )
}
