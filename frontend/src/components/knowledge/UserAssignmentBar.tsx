import { UserCheck } from 'lucide-react'
import { companyAssignments } from '../../data/knowledge'

interface Props {
  currentUser: string
  onUserChange: (user: string) => void
  filterByAssignment: boolean
  onToggleFilter: (val: boolean) => void
}

export function UserAssignmentBar({
  currentUser,
  onUserChange,
  filterByAssignment,
  onToggleFilter,
}: Props) {
  const assigned = companyAssignments[currentUser] ?? []

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px]">
      <div className="flex items-center gap-2">
        <UserCheck size={14} className="text-accent shrink-0" />
        <span className="text-text-muted text-[11px] font-medium">Role:</span>
        <select
          value={currentUser}
          onChange={(e) => onUserChange(e.target.value)}
          className="rounded-[6px] border border-border bg-canvas px-2 py-0.5 text-[11px] font-semibold text-text outline-none cursor-pointer"
        >
          <option value="L. Martin">L. Martin (Belgium Lead)</option>
          <option value="Sophie Vermeulen">Sophie Vermeulen (Northstar)</option>
          <option value="Payroll Ops">Payroll Operations</option>
          <option value="Admin">All Access</option>
        </select>

        {assigned.length > 0 && (
          <span className="hidden sm:inline text-[11px] text-text-muted">
            Scope: <span className="font-semibold text-text">{assigned.join(', ')}</span>
          </span>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary select-none">
        <input
          type="checkbox"
          checked={filterByAssignment}
          onChange={(e) => onToggleFilter(e.target.checked)}
          className="rounded text-accent focus:ring-accent h-3.5 w-3.5"
        />
        <span>Filter by role permissions</span>
      </label>
    </div>
  )
}
