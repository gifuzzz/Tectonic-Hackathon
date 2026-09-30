import { FileText, FileSpreadsheet, FileType2, Folder } from 'lucide-react'
import type { DriveFile, FileStatus } from '../data/mock'

function FileIcon({ type }: { type: DriveFile['type'] }) {
  if (type === 'sheet') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e6f4ea] text-[#137333]">
        <FileSpreadsheet size={15} />
      </span>
    )
  }
  if (type === 'pdf') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#fce8e6] text-[#c5221f]">
        <FileType2 size={15} />
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e8f0fe] text-[#1a73e8]">
      <FileText size={15} />
    </span>
  )
}

function statusBadge(status: FileStatus) {
  if (status === 'Current') return 'bg-green-soft text-green'
  if (status === 'Customer-specific') return 'bg-accent-soft text-accent'
  return 'bg-canvas text-text-muted border border-border'
}

interface Props {
  files: DriveFile[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function DriveFileTable({ files, selectedId, onSelect }: Props) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[14px] font-bold text-text">Relevant files</h2>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Folder size={12} />
            <span>My Drive</span>
            <span className="text-border-strong">/</span>
            <span>Payroll</span>
            <span className="text-border-strong">/</span>
            <span className="font-medium text-text-secondary">Matched to case</span>
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
              <th className="px-4 py-2.5 font-semibold">Status</th>
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
                  onClick={() => onSelect(file.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(file.id)
                    }
                  }}
                  className={[
                    'cursor-pointer border-b border-border last:border-b-0 transition-colors',
                    selected ? 'bg-accent-soft/50' : 'hover:bg-canvas',
                  ].join(' ')}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <FileIcon type={file.type} />
                      <span className="text-[13px] font-medium text-text">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-[10px] font-semibold text-text-secondary">
                        {file.ownerInitials}
                      </span>
                      <span className="text-[12px] text-text-secondary">{file.owner}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-text-secondary">{file.modified}</td>
                  <td className="px-3 py-2.5 text-[12px] text-text-muted">{file.location}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${statusBadge(file.status)}`}
                    >
                      {file.status}
                    </span>
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
