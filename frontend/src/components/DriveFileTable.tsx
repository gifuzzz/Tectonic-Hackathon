import { Folder } from 'lucide-react'
import type { EvidenceFile } from '../api'
import { formatDate, initials, verdictLabel, verdictStyle } from '../lib/format'
import { Avatar, Badge, FileIcon } from './ui'

interface Props {
  files: EvidenceFile[]
  selectedId: number | null
  onSelect: (file: EvidenceFile) => void
}

function ownerName(file: EvidenceFile): string {
  return file.owner?.name ?? file.owners[0]?.name ?? file.ownerEmail ?? '—'
}

export function DriveFileTable({ files, selectedId, onSelect }: Props) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[14px] font-bold text-text">Relevant files</h2>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Folder size={12} />
            <span className="font-medium text-text-secondary">Evidence attached to this case</span>
          </div>
        </div>
        <span className="text-[12px] text-text-muted">{files.length} files</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] font-semibold tracking-wide text-text-muted uppercase">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold">Last modified</th>
              <th className="px-3 py-2.5 font-semibold">Location</th>
              <th className="px-4 py-2.5 font-semibold">Trust</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const selected = selectedId === file.id
              return (
                <tr
                  key={file.id}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(file)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(file)
                    }
                  }}
                  className={[
                    'cursor-pointer border-b border-border transition-colors last:border-b-0',
                    selected ? 'bg-accent-soft/50' : 'hover:bg-canvas',
                  ].join(' ')}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <FileIcon mimeType={file.mimeType} />
                      <span className="text-[13px] font-medium text-text">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar label={initials(ownerName(file))} />
                      <span className="text-[12px] text-text-secondary">{ownerName(file)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-text-secondary">{formatDate(file.modifiedAt)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-text-muted">{file.path}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={verdictStyle(file.trust.verdict)}>
                      {file.trust.superseded ? 'Superseded' : verdictLabel(file.trust.verdict)}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
