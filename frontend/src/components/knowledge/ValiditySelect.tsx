import { VALIDITY_OPTIONS, type Validity } from './validityOptions'

interface Props {
  value?: Validity
  onChange: (v: Validity) => void
  size?: 'sm' | 'md'
}

export function ValiditySelect({ value, onChange, size = 'md' }: Props) {
  const styles: Record<Validity, string> = {
    useful: 'border-green/40 bg-green-soft text-green',
    old: 'border-amber/40 bg-amber-soft text-amber',
    invalid: 'border-red/40 bg-red-soft text-red',
    awaiting_replacement: 'border-accent/40 bg-accent-soft text-accent',
  }

  const currentValidity: Validity = value && value in styles ? value : 'useful'

  return (
    <select
      value={currentValidity}
      onChange={(e) => onChange(e.target.value as Validity)}
      className={[
        'cursor-pointer rounded-[8px] border font-semibold outline-none',
        size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]',
        styles[currentValidity],
      ].join(' ')}
      aria-label="Validity"
    >
      {VALIDITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
