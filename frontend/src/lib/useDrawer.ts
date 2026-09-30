import { useCallback, useState } from 'react'

// Which file the detail drawer shows, plus an optional warning (e.g. "this link points to an older version").
export function useDrawer() {
  const [state, setState] = useState<{ driveId: string | null; notice?: string }>({ driveId: null })
  const open = useCallback((driveId: string, notice?: string) => setState({ driveId, notice }), [])
  const close = useCallback(() => setState({ driveId: null }), [])
  return { driveId: state.driveId, notice: state.notice, open, close }
}
