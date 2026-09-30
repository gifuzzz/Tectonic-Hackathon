import { FileText, FileSpreadsheet, FileType2, Folder } from 'lucide-react'
import type { DriveFile, FileStatus } from '../data/mock'

function FileIcon({ type }: { type: DriveFile['type'] }) {
  if (type === 'sheet') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e6f4ea] text-[#0f9d58]">
        <FileSpreadsheet size={16} />
      </span>
    )
  }
  if (type === 'pdf') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#fce8e6] text-[#ea4335]">
        <FileType2 size={16} />
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#e8f0fe] text-[#4285f4]">
      <FileText size={16} />
    </span>
  )
}

function statusBadge(status: FileStatus) {
  if (status === 'Current') return 'bg-green-soft text-green font-semibold'
  if (status === 'Customer-specific') return 'bg-accent-soft text-accent font-semibold'
  return 'bg-canvas text-text-muted border border-border'
}

interface Props {
  files: DriveFile[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function DriveFileTable({ files, selectedId, onSelect }: Props) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-text">Relevant Drive Evidence</h2>
          <div className="flex items-center gap-1 text-[11px] text-text-muted">
            <Folder size={12} className="text-amber-500 fill-amber-100" />
            <span>My Drive / Payroll / Case Evidence</span>
          </div>
        </div>
        <span className="text-[11px] text-text-muted">{files.length} matched files</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-medium text-text-muted">
              <th className="px-4 py-2">Name</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Modified</th>
              <th className="px-3 py-2">Drive Path</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const selected = selectedId === file.id || selectedId === `file-${file.id}`
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
                  className={`cursor-pointer border-b border-border/60 last:border-b-0 transition-colors ${
                    selected ? 'bg-accent/8' : 'hover:bg-canvas/60'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <FileIcon type={file.type} />
                      <span className="text-[13px] font-medium text-text">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border text-[9px] font-bold text-text-secondary">
                        {file.ownerInitials}
                      </span>
                      <span className="text-[12px] text-text-secondary">{file.owner}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-text-muted whitespace-nowrap">{file.modified}</td>
                  <td className="px-3 py-2.5 text-[11px] text-text-muted font-mono">{file.location}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${statusBadge(file.status)}`}
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
