import type { Validity } from '../../data/knowledge'

export const VALIDITY_OPTIONS: { value: Validity; label: string }[] = [
  { value: 'useful', label: 'useful' },
  { value: 'old', label: 'old' },
  { value: 'invalid', label: 'invalid' },
  { value: 'awaiting_replacement', label: 'awaiting replacement' },
]
