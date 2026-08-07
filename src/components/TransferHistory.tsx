import { Clock, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useTransferHistory } from '../hooks/useTransferHistory'
import { cn } from '../utils/cn'

interface TransferHistoryProps {
  theme: 'dark' | 'light'
}

export function TransferHistory({ theme }: TransferHistoryProps) {
  const { history, loaded, clearHistory, deleteLog } = useTransferHistory()

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className={cn('text-sm', theme === 'dark' ? 'text-zinc-500' : 'text-slate-500')}>
          Loading...
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Clock
          className={cn('h-12 w-12 mb-3', theme === 'dark' ? 'text-zinc-700' : 'text-slate-300')}
        />
        <p
          className={cn(
            'text-sm font-medium',
            theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'
          )}
        >
          No activity yet
        </p>
        <p className={cn('mt-1 text-xs', theme === 'dark' ? 'text-zinc-600' : 'text-slate-400')}>
          Your uploads will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Clock className={cn('h-4 w-4', theme === 'dark' ? 'text-zinc-400' : 'text-slate-600')} />
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'
            )}
          >
            Activity
          </span>
        </div>
        <button
          onClick={clearHistory}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors',
            theme === 'dark'
              ? 'text-zinc-500 hover:bg-zinc-800'
              : 'text-slate-500 hover:bg-slate-200'
          )}
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto rounded-xl border p-2',
          theme === 'dark' ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50/60'
        )}
      >
        {history.map(log => (
          <div
            key={log.id}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2.5 mb-2 last:mb-0',
              theme === 'dark' ? 'bg-zinc-800/50' : 'bg-white/50'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs font-medium truncate',
                    theme === 'dark' ? 'text-zinc-200' : 'text-slate-700'
                  )}
                >
                  {log.faceName}
                </span>
                <StatusBadge status={log.status} />
              </div>
              <div
                className={cn('text-[10px]', theme === 'dark' ? 'text-zinc-500' : 'text-slate-500')}
              >
                {new Date(log.timestamp).toLocaleString()} · {(log.size / 1024).toFixed(1)}KB ·{' '}
                {(log.duration / 1000).toFixed(2)}s
              </div>
            </div>
            <button
              onClick={() => deleteLog(log.id)}
              className={cn(
                'ml-2 rounded p-1 transition-colors',
                theme === 'dark'
                  ? 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'success' | 'failed' | 'cancelled' }) {
  const styles = {
    success: {
      bg: 'bg-emerald-950/60 dark:bg-emerald-950/60',
      text: 'text-emerald-400',
      icon: CheckCircle,
    },
    failed: {
      bg: 'bg-red-950/60 dark:bg-red-950/60',
      text: 'text-red-400',
      icon: XCircle,
    },
    cancelled: {
      bg: 'bg-amber-950/60 dark:bg-amber-950/60',
      text: 'text-amber-400',
      icon: AlertCircle,
    },
  }

  const { bg, text, icon: Icon } = styles[status]

  return (
    <span className={cn('flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded', bg, text)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}
