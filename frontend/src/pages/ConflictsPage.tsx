import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { CompareEvidenceModal } from '../components/CompareEvidenceModal'

interface ConflictItem {
  id: string
  caseId: string
  caseTitle: string
  customer: string
  title: string
  description: string
  sourceA: string
  quoteA: string
  sourceB: string
  quoteB: string
  resolution: string
  status: 'unresolved' | 'resolved'
}

export function ConflictsPage() {
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([
    {
      id: 'c1',
      caseId: 'northstar-overtime',
      caseTitle: 'Overtime approval — Northstar Logistics',
      customer: 'Northstar Logistics',
      title: 'Teams chat exception vs. Google Drive Policy',
      description:
        'A recent Teams chat mentions an oral exception to overtime approvals, but official Drive Policy 2026 mandates manager sign-off.',
      sourceA: 'Belgium Overtime Policy 2026',
      quoteA: 'Manager approval is mandatory under section 4 for white-collar monthly payroll.',
      sourceB: 'Teams Chat (Sep 26)',
      quoteB: 'Prior manager sign-off not needed for routine weekend batches.',
      resolution: 'Drive policy supersedes oral chat. Manager approval is strictly required.',
      status: 'unresolved',
    },
    {
      id: 'c2',
      caseId: 'contoso-payroll',
      caseTitle: 'Payroll correction — Contoso',
      customer: 'Contoso',
      title: 'Retroactive correction cutoff discrepancy',
      description:
        'Old Contoso playbook listed 30-day retroactive correction limit; updated statutory standard is 90 days.',
      sourceA: 'Contoso Payroll Correction Template.xlsx',
      quoteA: 'Corrections allowed up to 90 days with dual partner review.',
      sourceB: 'Historical Playbook (2022)',
      quoteB: 'Strict 30-day window for payroll adjustment runs.',
      resolution: 'Updated 2026 correction template confirmed as authoritative.',
      status: 'resolved',
    },
  ])

  const resolveConflict = (id: string) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'resolved' } : c)),
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber" />
          <h1 className="text-[22px] font-bold tracking-tight text-text">Conflict & Uncertainty Center</h1>
        </div>
        <p className="mt-1 text-[13px] text-text-secondary">
          Track cross-document discrepancies, conflicting oral communication (Teams/email), and verify official policy resolutions.
        </p>
      </div>

      <div className="grid gap-4">
        {conflicts.map((item) => (
          <div
            key={item.id}
            className={`rounded-[12px] border p-5 transition-all ${
              item.status === 'unresolved'
                ? 'border-amber/40 bg-surface shadow-xs'
                : 'border-border bg-canvas/60 opacity-90'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    item.status === 'unresolved'
                      ? 'bg-amber-soft text-amber'
                      : 'bg-green-soft text-green'
                  }`}
                >
                  {item.status === 'unresolved' ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-text">{item.title}</h3>
                  <div className="text-[12px] text-text-muted">
                    Customer:{' '}
                    <span className="font-semibold text-text">{item.customer}</span> · Linked Case:{' '}
                    <Link
                      to={`/cases/${item.caseId}`}
                      className="text-accent hover:underline font-medium"
                    >
                      {item.caseTitle}
                    </Link>
                  </div>
                </div>
              </div>

              <span
                className={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold ${
                  item.status === 'unresolved'
                    ? 'bg-amber-soft text-amber border border-amber/30'
                    : 'bg-green-soft text-green border border-green/30'
                }`}
              >
                {item.status === 'unresolved' ? '1 Unresolved Uncertainty' : 'Resolved'}
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{item.description}</p>

            {/* Side by side comparison snippet */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[8px] border border-green/30 bg-green-soft p-3">
                <div className="text-[11px] font-bold text-green uppercase">Authoritative Policy</div>
                <div className="mt-1 text-[12px] font-semibold text-text">“{item.quoteA}”</div>
                <div className="mt-1 text-[11px] text-text-muted">{item.sourceA}</div>
              </div>

              <div className="rounded-[8px] border border-border bg-canvas p-3">
                <div className="text-[11px] font-bold text-text-muted uppercase">Unverified Claim / Old Source</div>
                <div className="mt-1 text-[12px] text-text-secondary line-through">“{item.quoteB}”</div>
                <div className="mt-1 text-[11px] text-text-muted">{item.sourceB}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="text-[12px] font-medium text-text-secondary">
                <span className="font-bold text-text">System Resolution:</span> {item.resolution}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCompareModalOpen(true)}
                  className="cursor-pointer rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text hover:bg-canvas"
                >
                  Compare full evidence
                </button>
                {item.status === 'unresolved' && (
                  <button
                    type="button"
                    onClick={() => resolveConflict(item.id)}
                    className="cursor-pointer rounded-[8px] bg-green px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-95"
                  >
                    Mark as Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <CompareEvidenceModal open={compareModalOpen} onClose={() => setCompareModalOpen(false)} />
    </div>
  )
}
