import { useState } from 'react'
import { Users, UserRoundCheck, Building2, Check } from 'lucide-react'

interface ExpertProfile {
  id: string
  name: string
  initials: string
  title: string
  team: string
  companies: string[]
  casesCount: number
  note: string
  status: 'idle' | 'requested'
}

export function ExpertsPage() {
  const [experts, setExperts] = useState<ExpertProfile[]>([
    {
      id: 'e1',
      name: 'Sophie Vermeulen',
      initials: 'SV',
      title: 'Senior Payroll Consultant',
      team: 'Belgium Payroll Operations',
      companies: ['Northstar Logistics', 'Acme Belgium'],
      casesCount: 14,
      note: 'Primary author of Northstar exception workflows. Specializes in Belgian overtime regulation.',
      status: 'idle',
    },
    {
      id: 'e2',
      name: 'Jan De Smet',
      initials: 'JD',
      title: 'Legal Counsel & Policy Lead',
      team: 'Payroll Legal Belgium',
      companies: ['Statutory Belgium', 'General Policy'],
      casesCount: 28,
      note: 'Certified Belgian labor law specialist. Author of Belgium Overtime Policy 2026.',
      status: 'idle',
    },
    {
      id: 'e3',
      name: 'Anke Van Damme',
      initials: 'AV',
      title: 'Enterprise Account Specialist',
      team: 'Netherlands & BeNeLux Accounts',
      companies: ['Contoso'],
      casesCount: 9,
      note: 'Handles complex dual-approval payroll adjustments and cross-border calculations.',
      status: 'idle',
    },
  ])

  const requestReview = (id: string) => {
    setExperts((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'requested' } : e)),
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-accent" />
          <h1 className="text-[22px] font-bold tracking-tight text-text">Domain Experts & Policy Owners</h1>
        </div>
        <p className="mt-1 text-[13px] text-text-secondary">
          Verified SD Worx consultants, policy owners, and customer account leads ready to assist with case escalations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((exp) => (
          <div
            key={exp.id}
            className="flex flex-col justify-between rounded-[12px] border border-border bg-surface p-4 shadow-xs"
          >
            <div>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
                  {exp.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[14px] font-bold text-text truncate">{exp.name}</h3>
                    <UserRoundCheck size={14} className="text-green shrink-0" />
                  </div>
                  <div className="text-[12px] text-text-secondary">{exp.title}</div>
                  <div className="text-[11px] text-text-muted">{exp.team}</div>
                </div>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">{exp.note}</p>

              <div className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Building2 size={12} />
                  <span>Assigned:</span>
                  <div className="flex flex-wrap gap-1">
                    {exp.companies.map((c) => (
                      <span
                        key={c}
                        className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 font-semibold text-accent"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-text-muted">
                  Handled <span className="font-semibold text-text">{exp.casesCount}</span> related enterprise cases
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              {exp.status === 'requested' ? (
                <div className="flex items-center justify-center gap-1 rounded-[8px] border border-green/30 bg-green-soft py-2 text-[12px] font-semibold text-green">
                  <Check size={14} />
                  Review Requested
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => requestReview(exp.id)}
                  className="w-full cursor-pointer rounded-[8px] bg-accent py-2 text-[12px] font-semibold text-white hover:bg-accent-hover transition-colors"
                >
                  Request Case Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
