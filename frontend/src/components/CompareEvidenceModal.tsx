import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { api, type EvidenceFile } from '../api'
import { useApi } from '../lib/useApi'
import { humanize } from '../lib/format'
import { ErrorBox, Loading } from './ui'

interface Props {
  open: boolean
  files: EvidenceFile[]
  onClose: () => void
}

const CHECK_LABELS: Record<string, string> = {
  sameTopic: 'Same topic',
  sameCustomer: 'Same customer scope',
  sameCountry: 'Same country',
  overlappingValidity: 'Validity overlaps',
  supersession: 'One supersedes the other',
  eitherSuperseded: 'A superseded file is involved',
}

export function CompareEvidenceModal({ open, files, onClose }: Props) {
  const ids = files.map((f) => f.id)
  const { data, error, loading } = useApi(
    () => (open && ids.length >= 2 ? api.compare(ids.slice(0, 10)) : Promise.resolve(null)),
    [open, ids.join(',')],
  )
  const name = (id: number) => files.find((f) => f.id === id)?.name ?? `File ${id}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null

  return (
    <>
      <button type="button" aria-label="Close compare modal" className="fixed inset-0 z-40 cursor-default bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[12px] border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="compare-title" className="text-[15px] font-bold text-text">Compare evidence</h2>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-[8px] p-1.5 text-text-muted hover:bg-canvas" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {ids.length < 2 && <p className="text-[13px] text-text-muted">Attach at least two files to compare them.</p>}
          {loading && ids.length >= 2 && <Loading label="Comparing…" />}
          {error && <ErrorBox message={error} />}
          {data?.comparisons.map((c) => (
            <div key={`${c.fileA}-${c.fileB}`} className="rounded-[10px] border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
                <div className="min-w-0 text-[13px] font-semibold text-text">
                  {name(c.fileA)} <span className="text-text-muted">vs</span> {name(c.fileB)}
                </div>
                {c.isConflict ? (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-amber">
                    <AlertTriangle size={14} /> Conflict ({c.severity})
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-green">
                    <CheckCircle2 size={14} /> No conflict that matters
                  </span>
                )}
              </div>
              {c.opposingClaims.length > 0 && (
                <div className="grid gap-2 p-3.5 sm:grid-cols-2">
                  {c.opposingClaims.map((claim) => (
                    <div key={claim.subject} className="contents">
                      <div className="rounded-[10px] border border-border bg-canvas p-3">
                        <div className="mb-1 text-[11px] font-bold tracking-wide text-text-muted uppercase">{humanize(claim.subject)}</div>
                        <p className="text-[14px] font-semibold text-text">“{claim.valueA}”</p>
                        <p className="mt-1 text-[11px] text-text-muted">{name(c.fileA)}</p>
                      </div>
                      <div className="rounded-[10px] border border-border bg-canvas p-3">
                        <div className="mb-1 text-[11px] font-bold tracking-wide text-text-muted uppercase">{humanize(claim.subject)}</div>
                        <p className="text-[14px] font-semibold text-text">“{claim.valueB}”</p>
                        <p className="mt-1 text-[11px] text-text-muted">{name(c.fileB)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                {Object.entries(c.checks).map(([key, value]) => (
                  <span key={key} className={`rounded-[6px] px-1.5 py-0.5 text-[11px] ${value ? 'bg-accent-soft text-accent' : 'bg-canvas text-text-muted'}`}>
                    {value ? '✓' : '✗'} {CHECK_LABELS[key] ?? key}
                  </span>
                ))}
              </div>
              <p className="px-3.5 pb-3 text-[12px] text-text-secondary">{c.reasons.join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
