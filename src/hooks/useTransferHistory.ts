import { useState, useEffect } from 'react'

export interface TransferLog {
  id: string
  faceName: string
  timestamp: number
  status: 'success' | 'failed' | 'cancelled'
  duration: number // in milliseconds
  size: number // in bytes
}

const STORAGE_KEY = 'faces_transfer_history'

export function useTransferHistory() {
  const [history, setHistory] = useState<TransferLog[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load transfer history:', error)
    } finally {
      setLoaded(true)
    }
  }, [])

  const addLog = (log: Omit<TransferLog, 'id' | 'timestamp'>) => {
    const newLog: TransferLog = {
      ...log,
      id: Date.now().toString(),
      timestamp: Date.now(),
    }

    const updated = [newLog, ...history].slice(0, 50) // Keep only last 50 transfers
    setHistory(updated)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to save transfer history:', error)
    }

    return newLog
  }

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear transfer history:', error)
    }
  }

  const deleteLog = (id: string) => {
    const updated = history.filter(log => log.id !== id)
    setHistory(updated)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to delete transfer log:', error)
    }
  }

  return {
    history,
    loaded,
    addLog,
    clearHistory,
    deleteLog,
  }
}
