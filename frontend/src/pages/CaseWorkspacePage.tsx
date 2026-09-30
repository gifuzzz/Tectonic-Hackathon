import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  cases,
  driveFiles,
  trustSignals,
} from '../data/mock'
import { DriveFileTable } from '../components/DriveFileTable'
import { FileDetailDrawer } from '../components/FileDetailDrawer'
import { TrustPanel } from '../components/TrustPanel'
import { ConflictPanel } from '../components/ConflictPanel'
import { CompareEvidenceModal } from '../components/CompareEvidenceModal'
import { ExpertCard } from '../components/ExpertCard'

export function CaseWorkspacePage() {
  const { caseId } = useParams()
  const caseItem = cases.find((c) => c.id === caseId)

  const [selectedFileId, setSelectedFileId] = useState<string | null>('be-overtime-2026')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [expertHighlight, setExpertHighlight] = useState(false)

  const selectedFile = useMemo(
    () => driveFiles.find((f) => f.id === selectedFileId) ?? null,
    [selectedFileId],
  )

  if (!caseItem) {
    return <Navigate to="/" replace />
  }

  const handleSelectFile = (id: string) => {
    setSelectedFileId(id)
    setDrawerOpen(true)
  }

  const handleAskSophie = () => {
    setExpertHighlight(true)
    document.getElementById('expert-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    window.setTimeout(() => setExpertHighlight(false), 1800)
  }

  return (
    <div className="mx-auto max-w-[1360px] px-5 py-5">
      <div className="mb-4">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-accent"
        >
          <ArrowLeft size={13} />
          Back to cases
        </Link>
        <h1 className="text-[20px] font-bold tracking-tight text-text">
          {caseItem.topic} — {caseItem.customer}
        </h1>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {caseItem.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-[8px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-[12px] border border-border bg-surface p-4">
        <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          Clear answer
        </div>
        <p className="text-[14px] leading-relaxed font-medium text-text">{caseItem.answer}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <DriveFileTable
            files={driveFiles}
            selectedId={selectedFileId}
            onSelect={handleSelectFile}
          />
          <ConflictPanel onCompare={() => setCompareOpen(true)} onAskSophie={handleAskSophie} />
        </div>

        <div className="space-y-4">
          <TrustPanel signals={trustSignals} />
          <ExpertCard highlight={expertHighlight} />
        </div>
      </div>

      <FileDetailDrawer
        file={selectedFile}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <CompareEvidenceModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  )
}
