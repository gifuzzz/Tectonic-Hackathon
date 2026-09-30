import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, type CaseDetail, type EvidenceFile } from '../api'
import { useApi } from '../lib/useApi'
import { useUser } from '../lib/UserContext'
import { useDrawer } from '../lib/useDrawer'
import { humanize } from '../lib/format'
import { DriveFileTable } from '../components/DriveFileTable'
import { FileDetailDrawer } from '../components/FileDetailDrawer'
import { TrustPanel } from '../components/TrustPanel'
import { ConflictPanel } from '../components/ConflictPanel'
import { CompareEvidenceModal } from '../components/CompareEvidenceModal'
import { ExpertCard } from '../components/ExpertCard'
import { ErrorBox, Loading } from '../components/ui'

export function CaseWorkspacePage() {
  const { caseId = '' } = useParams()
  const { version } = useUser()
  const caseQuery = useApi(() => api.case(caseId), [caseId, version])
  const evidence = useApi(() => api.caseEvidence(caseId), [caseId, version])
  const c = caseQuery.data
  const experts = useApi(
    () => (c ? api.experts({ customer: c.customer?.name, country: c.country, topic: c.topic }) : Promise.resolve([])),
    [c?.id, version],
  )

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [expertHighlight, setExpertHighlight] = useState(false)
  const drawer = useDrawer()

  if (caseQuery.loading && !c) return <Loading />
  if (caseQuery.error) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-6">
        <ErrorBox message={caseQuery.error} onRetry={caseQuery.reload} />
        <Link to="/" className="mt-3 inline-block text-[13px] text-accent">Back to cases</Link>
      </div>
    )
  }
  if (!c) return null

  const files = evidence.data?.evidence ?? []
  const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null
  const suggested = experts.data?.[0] && experts.data[0].score > 0 ? experts.data[0] : null
  const expertName = c.assignedExpert?.name ?? suggested?.name
  const chips = [c.country, c.customer?.name, humanize(c.topic), humanize(c.status)].filter(Boolean) as string[]

  const selectFile = (file: EvidenceFile) => {
    setSelectedId(file.id)
    drawer.open(file.driveId)
  }
  const askExpert = () => {
    setExpertHighlight(true)
    document.getElementById('expert-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    window.setTimeout(() => setExpertHighlight(false), 1800)
  }
  const caseChanged = (updated: CaseDetail) => {
    caseQuery.setData(updated)
    evidence.reload()
  }

  return (
    <div className="mx-auto max-w-[1360px] px-5 py-5">
      <div className="mb-4">
        <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-accent">
          <ArrowLeft size={13} />
          Back to cases
        </Link>
        <h1 className="text-[20px] font-bold tracking-tight text-text">{c.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip} className="rounded-[8px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-[12px] border border-border bg-surface p-4">
        <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          {c.resolution ? 'Clear answer' : 'Question'}
        </div>
        <p className="text-[14px] leading-relaxed font-medium text-text">{c.resolution || c.question || c.title}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {evidence.error && <ErrorBox message={evidence.error} onRetry={evidence.reload} />}
          {evidence.loading && !evidence.data ? <Loading /> : (
            <DriveFileTable files={files} selectedId={selected?.id ?? null} onSelect={selectFile} />
          )}
          <ConflictPanel
            conflicts={evidence.data?.conflicts ?? []}
            expertName={expertName}
            onCompare={() => setCompareOpen(true)}
            onAskExpert={askExpert}
          />
        </div>

        <div className="space-y-4">
          <TrustPanel trust={selected?.trust ?? null} fileName={selected?.name} />
          <ExpertCard caseItem={c} suggested={suggested} highlight={expertHighlight} onCaseChanged={caseChanged} />
        </div>
      </div>

      <FileDetailDrawer
        driveId={drawer.driveId}
        notice={drawer.notice}
        context={{ country: c.country, customer: c.customer?.name }}
        onClose={drawer.close}
        onOpenFile={drawer.open}
        onChanged={evidence.reload}
      />
      <CompareEvidenceModal open={compareOpen} files={files} onClose={() => setCompareOpen(false)} />
    </div>
  )
}
