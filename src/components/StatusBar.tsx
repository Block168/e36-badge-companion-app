import { Bluetooth, BluetoothConnected, BluetoothOff, Loader2 } from 'lucide-react'
import type { ConnectionState } from '../types'
import { cn } from '../utils/cn'
import { memo } from 'react'

const STATE_META: Record<ConnectionState, { label: string; tone: string }> = {
  poweredOff: { label: 'Bluetooth Off', tone: 'text-zinc-400 bg-zinc-800' },
  unauthorized: { label: 'Not Authorized', tone: 'text-red-300 bg-red-950' },
  idle: { label: 'Not Connected', tone: 'text-zinc-300 bg-zinc-800' },
  scanning: { label: 'Scanning…', tone: 'text-amber-300 bg-amber-950' },
  connecting: { label: 'Connecting…', tone: 'text-amber-300 bg-amber-950' },
  discoveringServices: { label: 'Discovering…', tone: 'text-amber-300 bg-amber-950' },
  ready: { label: 'Connected', tone: 'text-emerald-300 bg-emerald-950' },
  disconnected: { label: 'Disconnected', tone: 'text-red-300 bg-red-950' },
  error: { label: 'Error', tone: 'text-red-300 bg-red-950' },
}

interface StatusPillProps {
  state: ConnectionState
  rssi?: number
  name?: string
}

export function StatusPill({ state, name }: StatusPillProps) {
  const meta = STATE_META[state]
  const isBusy = state === 'scanning' || state === 'connecting' || state === 'discoveringServices'
  const Icon =
    state === 'poweredOff' ? BluetoothOff : state === 'ready' ? BluetoothConnected : Bluetooth

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/5',
        meta.tone
      )}
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      <span>{meta.label}</span>
      {state === 'ready' && name && (
        <span className="hidden text-zinc-400 sm:inline">· {name}</span>
      )}
    </div>
  )
}

// Memoize the component since it only re-renders when props change
export const StatusPillMemo = memo(StatusPill, (prevProps, nextProps) => {
  return prevProps.state === nextProps.state && prevProps.name === nextProps.name
})
