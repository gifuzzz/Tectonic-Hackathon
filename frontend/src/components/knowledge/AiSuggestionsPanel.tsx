import { useState } from 'react'
import { Sparkles, MessageSquare, Mail, Phone, Check, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import type { AiSuggestion } from '../../data/knowledge'

interface Props {
  suggestions: AiSuggestion[]
  onApply: (suggestion: AiSuggestion) => void
  onDismiss: (suggestionId: string) => void
  onSelectNode: (nodeId: string) => void
}

function channelBadge(channel: AiSuggestion['channel']) {
  if (channel === 'Teams') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#5059C9]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#5059C9]">
        <MessageSquare size={10} /> Teams
      </span>
    )
  }
  if (channel === 'email') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#EA4335]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#EA4335]">
        <Mail size={10} /> Email
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#34A853]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#34A853]">
      <Phone size={10} /> Call
    </span>
  )
}

export function AiSuggestionsPanel({ suggestions, onApply, onDismiss, onSelectNode }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (suggestions.length === 0) return null

  const primary = suggestions[0]

  return (
    <div className="rounded-[10px] border border-accent/20 bg-accent-soft/40 px-3.5 py-2.5 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Sparkles size={11} />
          </div>
          <span className="text-[12px] font-bold text-accent shrink-0">AI Copilot</span>
          <span className="text-[12px] text-text-muted truncate">
            {primary.title} · <span className="text-text font-medium">{primary.targetName}</span>
          </span>
          {channelBadge(primary.channel)}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onApply(primary)}
            className="flex items-center gap-1 rounded-[6px] bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Check size={11} />
            Apply
          </button>
          <button
            type="button"
            onClick={() => onDismiss(primary.id)}
            className="rounded-[6px] border border-border bg-surface px-2 py-1 text-[11px] text-text-muted hover:text-text transition-colors"
          >
            Dismiss
          </button>
          {suggestions.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline ml-1"
            >
              <span>{suggestions.length} total</span>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {expanded && suggestions.length > 1 && (
        <div className="mt-2.5 space-y-1.5 border-t border-accent/15 pt-2">
          {suggestions.slice(1).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-[8px] bg-surface/80 px-2.5 py-1.5 text-[11px]"
            >
              <div className="flex min-w-0 items-center gap-2">
                {channelBadge(item.channel)}
                <span className="font-medium text-text truncate">{item.title}</span>
                <button
                  type="button"
                  onClick={() => onSelectNode(item.targetNodeId)}
                  className="text-text-muted hover:text-accent inline-flex items-center gap-0.5 truncate"
                >
                  ({item.targetName}) <ArrowRight size={9} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onApply(item)}
                  className="rounded-[5px] bg-accent px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-accent-hover"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  className="rounded-[5px] border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
