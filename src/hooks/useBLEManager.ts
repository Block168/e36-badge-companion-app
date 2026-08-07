import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CHAR_BOOT_ANIM_FLAG,
  CHAR_BRIGHTNESS,
  CHAR_FACE_SELECT,
  CHAR_IMAGE_DATA,
  CHAR_STATUS,
  IMAGE_HEADER_BYTES,
  MTU_PAYLOAD_BYTES,
  RGB565_IMAGE_BYTES,
  type BootFrame,
  type ConnectionState,
  type DiscoveredBadge,
  type TransferProgress,
} from '../types'
import { useTransferHistory } from './useTransferHistory'
import { useFaceStorage } from './useFaceStorage'

const LAST_DEVICE_KEY = 'e36-badge.lastDeviceId'

function logLine(kind: string, msg: string) {
  const time = new Date().toLocaleTimeString([], { hour12: false })
  return `[${time}] ${kind}: ${msg}`
}

/**
 * Web simulator standing in for the native `BadgeBLEManager` (CoreBluetooth).
 * The state machine, GATT writes, chunking math and debounce behavior all
 * mirror the real Swift implementation shipped in /ios-app so this is an
 * honest development harness, not just a UI mockup.
 */
export function useBLEManager() {
  const { addLog } = useTransferHistory()
  const { saveFace } = useFaceStorage()
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [bluetoothPowered, setBluetoothPowered] = useState(true)
  const [discovered, setDiscovered] = useState<DiscoveredBadge[]>([])
  const [device, setDevice] = useState<DiscoveredBadge | null>(null)
  const [rssi, setRssi] = useState<number>(-60)
  const [brightness, setBrightnessState] = useState(70)
  const [pendingByteWrite, setPendingByteWrite] = useState<number | null>(null)
  const [selectedFace, setSelectedFace] = useState<number>(0)
  const [bootFrames, setBootFrames] = useState<BootFrame[]>([])
  const [bootAnimEnabled, setBootAnimEnabled] = useState(false)
  const [transfer, setTransfer] = useState<TransferProgress>({
    phase: 'idle',
    chunkIndex: 0,
    totalChunks: 0,
    bytesSent: 0,
    totalBytes: 0,
  })
  const transferStartTime = useRef<number | null>(null)
  const [log, setLog] = useState<string[]>([logLine('system', 'BLE manager initialized')])

  const transferTimer = useRef<number | null>(null)
  const debounceTimer = useRef<number | null>(null)
  const autoReconnectTried = useRef(false)

  const pushLog = useCallback((kind: string, msg: string) => {
    setLog(prev => [...prev.slice(-49), logLine(kind, msg)])
  }, [])

  // Auto-reconnect: try last known device id before falling back to fresh scan.
  useEffect(() => {
    if (autoReconnectTried.current) return
    autoReconnectTried.current = true
    const lastId = localStorage.getItem(LAST_DEVICE_KEY)
    if (lastId) {
      pushLog('system', `Found cached peripheral UUID ${lastId.slice(0, 8)}… retrieving`)
      setConnectionState('connecting')
      window.setTimeout(() => {
        const badge: DiscoveredBadge = { id: lastId, name: 'E36-Badge-A1B2', rssi: -52 }
        setDevice(badge)
        setRssi(badge.rssi)
        finishConnect()
      }, 1100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishConnect = useCallback(() => {
    setConnectionState('discoveringServices')
    window.setTimeout(() => {
      setConnectionState('ready')
      pushLog('gatt', 'Discovered service 6E400001…, subscribed to status notify')
      pushLog('read', `brightness characteristic read -> ${Math.round((brightness / 100) * 255)}`)
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startScan = useCallback(() => {
    if (!bluetoothPowered) return
    setConnectionState('scanning')
    setDiscovered([])
    pushLog('scan', 'centralManager.scanForPeripherals(withServices: [SERVICE_UUID])')
    const found: DiscoveredBadge = {
      id: crypto.randomUUID(),
      name: 'E36-Badge-A1B2',
      rssi: -58,
    }
    window.setTimeout(() => {
      setDiscovered([found])
      pushLog('scan', `didDiscover ${found.name} rssi=${found.rssi}`)
    }, 1400)
  }, [bluetoothPowered, pushLog])

  const connect = useCallback(
    (badge: DiscoveredBadge) => {
      setConnectionState('connecting')
      setDevice(badge)
      setRssi(badge.rssi)
      pushLog('connect', `centralManager.connect(${badge.name})`)
      localStorage.setItem(LAST_DEVICE_KEY, badge.id)
      window.setTimeout(finishConnect, 900)
    },
    [finishConnect, pushLog]
  )

  const disconnect = useCallback(() => {
    pushLog('system', 'User requested disconnect')
    setConnectionState('disconnected')
    setDevice(null)
    if (transferTimer.current) {
      window.clearInterval(transferTimer.current)
      transferTimer.current = null
      setTransfer(t =>
        t.phase === 'uploading' || t.phase === 'ack-wait' ? { ...t, phase: 'cancelled' } : t
      )
    }
  }, [pushLog])

  const toggleBluetoothPower = useCallback(() => {
    setBluetoothPowered(p => {
      const next = !p
      if (!next) {
        setConnectionState('poweredOff')
        setDevice(null)
      } else {
        setConnectionState('idle')
      }
      return next
    })
  }, [])

  // --- face_select write ---
  const selectFace = useCallback(
    (index: number) => {
      setSelectedFace(index)
      if (connectionState === 'ready') {
        pushLog('write', `face_select <- 0x${index.toString(16).padStart(2, '0')}`)
      }
    },
    [connectionState, pushLog]
  )

  // --- brightness write, debounced ~10 writes/sec max ---
  const setBrightness = useCallback(
    (pct: number) => {
      setBrightnessState(pct)
      const byte = Math.round((pct / 100) * 255)
      setPendingByteWrite(byte)
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
      debounceTimer.current = window.setTimeout(() => {
        if (connectionState === 'ready') {
          pushLog('write', `brightness <- ${byte} (${pct}%)`)
        }
      }, 100) // matches Combine .debounce(for: .milliseconds(100))
    },
    [connectionState, pushLog]
  )

  // --- boot_anim_flag write ---
  const setBootAnim = useCallback(
    (enabled: boolean) => {
      setBootAnimEnabled(enabled)
      if (connectionState === 'ready') {
        pushLog('write', `boot_anim_flag <- ${enabled ? '0x01' : '0x00'}`)
      }
    },
    [connectionState, pushLog]
  )

  // --- Chunked image_data transfer simulation (mirrors ACK-based protocol) ---
  const runTransfer = useCallback(
    (opts: {
      totalBytes: number
      frameIndex: number
      totalFrames: number
      onDone: () => void
      onFail?: () => void
      faceName?: string
    }) => {
      transferStartTime.current = Date.now()
      const chunkPayload = MTU_PAYLOAD_BYTES - IMAGE_HEADER_BYTES
      const totalChunks = Math.ceil(opts.totalBytes / chunkPayload)
      pushLog(
        'xfer',
        `queryMaximumWriteValueLength -> ${MTU_PAYLOAD_BYTES}B, frame ${opts.frameIndex + 1}/${opts.totalFrames}, ${totalChunks} chunks`
      )

      setTransfer({
        phase: 'preparing',
        chunkIndex: 0,
        totalChunks,
        bytesSent: 0,
        totalBytes: opts.totalBytes,
        frameIndex: opts.frameIndex,
        totalFrames: opts.totalFrames,
      })

      window.setTimeout(() => {
        setTransfer(t => ({ ...t, phase: 'converting' }))
        window.setTimeout(() => {
          setTransfer(t => ({ ...t, phase: 'uploading' }))

          const stepsToFinish = 26
          const chunksPerTick = Math.max(1, Math.ceil(totalChunks / stepsToFinish))
          let cursor = 0

          if (transferTimer.current) window.clearInterval(transferTimer.current)
          transferTimer.current = window.setInterval(() => {
            if (connectionState !== 'ready') {
              window.clearInterval(transferTimer.current!)
              transferTimer.current = null
              setTransfer(t => ({
                ...t,
                phase: 'error',
                error: 'Peripheral disconnected mid-transfer',
              }))
              pushLog(
                'xfer',
                'ERROR: disconnected mid-transfer, will resume from last acked chunk on reconnect'
              )
              opts.onFail?.()
              return
            }
            cursor = Math.min(totalChunks, cursor + chunksPerTick)
            const bytesSent = Math.min(opts.totalBytes, cursor * chunkPayload)
            setTransfer(t => ({ ...t, phase: 'ack-wait', chunkIndex: cursor, bytesSent }))

            window.setTimeout(() => {
              setTransfer(t => (t.phase === 'ack-wait' ? { ...t, phase: 'uploading' } : t))
            }, 30)

            if (cursor >= totalChunks) {
              window.clearInterval(transferTimer.current!)
              transferTimer.current = null
              const duration = transferStartTime.current
                ? Date.now() - transferStartTime.current
                : 0
              setTransfer(t => ({ ...t, phase: 'complete' }))
              pushLog(
                'xfer',
                `status notify: OK, frame ${opts.frameIndex + 1}/${opts.totalFrames} complete`
              )

              // Log to transfer history
              addLog({
                faceName: opts.faceName || `Frame ${opts.frameIndex + 1}`,
                status: 'success',
                duration,
                size: opts.totalBytes,
              })

              opts.onDone()
            }
          }, 140)
        }, 500)
      }, 250)
    },
    [connectionState, pushLog, addLog]
  )

  const uploadCustomFace = useCallback(
    (name: string, dataUrl: string) => {
      if (connectionState !== 'ready') {
        pushLog('xfer', 'ERROR: not connected, aborting upload')
        return
      }
      runTransfer({
        totalBytes: RGB565_IMAGE_BYTES,
        frameIndex: 0,
        totalFrames: 1,
        faceName: name,
        onDone: () => {
          saveFace(name, dataUrl, 'Uploaded')
        },
      })
    },
    [connectionState, pushLog, runTransfer, saveFace]
  )

  const uploadBootAnimation = useCallback(
    (frames: BootFrame[]) => {
      if (connectionState !== 'ready') {
        pushLog('xfer', 'ERROR: not connected, aborting upload')
        return
      }
      let i = 0
      const next = () => {
        if (i >= frames.length) {
          setBootAnim(true)
          pushLog('xfer', `All ${frames.length} boot frames uploaded, boot_anim_flag enabled`)
          return
        }
        const frameIdx = i
        i += 1
        runTransfer({
          totalBytes: RGB565_IMAGE_BYTES,
          frameIndex: frameIdx,
          totalFrames: frames.length,
          onDone: next,
        })
      }
      next()
    },
    [connectionState, pushLog, runTransfer, setBootAnim]
  )

  const cancelTransfer = useCallback(() => {
    if (transferTimer.current) {
      window.clearInterval(transferTimer.current)
      transferTimer.current = null
    }
    setTransfer(t => ({ ...t, phase: 'cancelled' }))
    pushLog('xfer', 'Transfer cancelled by user')
  }, [pushLog])

  const addBootFrames = useCallback((frames: BootFrame[]) => {
    setBootFrames(prev => [...prev, ...frames])
  }, [])

  const clearBootFrames = useCallback(() => setBootFrames([]), [])

  useEffect(() => {
    return () => {
      if (transferTimer.current) window.clearInterval(transferTimer.current)
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    }
  }, [])

  return {
    connectionState,
    bluetoothPowered,
    toggleBluetoothPower,
    discovered,
    device,
    rssi,
    startScan,
    connect,
    disconnect,
    brightness,
    pendingByteWrite,
    setBrightness,
    selectedFace,
    selectFace,
    uploadCustomFace,
    bootFrames,
    addBootFrames,
    clearBootFrames,
    bootAnimEnabled,
    setBootAnim,
    uploadBootAnimation,
    transfer,
    cancelTransfer,
    log,
    charUUIDs: {
      faceSelect: CHAR_FACE_SELECT,
      imageData: CHAR_IMAGE_DATA,
      brightness: CHAR_BRIGHTNESS,
      bootAnimFlag: CHAR_BOOT_ANIM_FLAG,
      status: CHAR_STATUS,
    },
  }
}

export type BLEManagerApi = ReturnType<typeof useBLEManager>
