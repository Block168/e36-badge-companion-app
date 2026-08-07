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
  SERVICE_UUID,
  type BootFrame,
  type ConnectionState,
  type DiscoveredBadge,
  type TransferProgress,
} from '../types'
import { useTransferHistory } from './useTransferHistory'
import { useFaceStorage } from './useFaceStorage'
import { convertToRGB565, loadImage } from '../utils/cropImage'

const LAST_DEVICE_KEY = 'e36-badge.lastDeviceId'

function logLine(kind: string, msg: string) {
  const time = new Date().toLocaleTimeString([], { hour12: false })
  return `[${time}] ${kind}: ${msg}`
}

/**
 * Real Bluetooth Low Energy manager using Web Bluetooth API.
 * Connects to actual E36 badge devices via navigator.bluetooth.
 */
export function useBLEManager() {
  const { addLog } = useTransferHistory()
  const { saveFace } = useFaceStorage()

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [bluetoothPowered, setBluetoothPowered] = useState(true) // We can't actually detect this in web, assume true if API available
  const [discovered, setDiscovered] = useState<DiscoveredBadge[]>([])
  const [device, setDevice] = useState<DiscoveredBadge | null>(null)
  const [rssi, setRssi] = useState<number>(-60)
  const [brightness, setBrightnessState] = useState<number>(70)
  const [pendingByteWrite, setPendingByteWrite] = useState<number | null>(null)
  const [selectedFace, setSelectedFace] = useState<number>(0)
  const [bootFrames, setBootFrames] = useState<BootFrame[]>([])
  const [bootAnimEnabled, setBootAnimEnabled] = useState<boolean>(false)
  const [transfer, setTransfer] = useState<TransferProgress>({
    phase: 'idle',
    chunkIndex: 0,
    totalChunks: 0,
    bytesSent: 0,
    totalBytes: 0,
  })
  const transferStartTime = useRef<number | null>(null)
  const [log, setLog] = useState<string[]>([logLine('system', 'BLE manager initialized')])

  // Real Bluetooth state
  const bluetoothDeviceRef = useRef<BluetoothDevice | null>(null)
  const gattServerRef = useRef<BluetoothRemoteGATTServer | null>(null)
  const serviceRef = useRef<BluetoothRemoteGATTService | null>(null)
  const characteristicsRef = useRef<Map<string, BluetoothRemoteGATTCharacteristic>>(new Map())
  const notificationRef = useRef<() => void>(() => {})
  const isDisconnectingRef = useRef<boolean>(false)

  const pushLog = useCallback((kind: string, msg: string) => {
    setLog(prev => [...prev.slice(-49), logLine(kind, msg)])
  }, [])

  // Check if Web Bluetooth is available
  const isWebBluetoothAvailable = useCallback(() => {
    return !!navigator.bluetooth
  }, [])

  // Initialize characteristics map once we have the service
  const initializeCharacteristics = useCallback(async () => {
    if (!serviceRef.current) return false

    try {
      const characteristicUUIDs = [
        CHAR_FACE_SELECT,
        CHAR_IMAGE_DATA,
        CHAR_BRIGHTNESS,
        CHAR_BOOT_ANIM_FLAG,
        CHAR_STATUS
      ]

      for (const uuid of characteristicUUIDs) {
        const characteristic = await serviceRef.current.getCharacteristic(uuid)
        characteristicsRef.current.set(uuid, characteristic)
      }

      // Set up notifications for status characteristic if available
      const statusChar = characteristicsRef.current.get(CHAR_STATUS)
      if (statusChar) {
        await statusChar.startNotifications()
        notificationRef.current = (event: Event) => {
          const value = event.target.value
          // Parse status if needed (currently just logging)
          pushLog('status', `Status notification received: ${value.getUint8(0)}`)
        }
        statusChar.addEventListener('characteristicvaluechanged', notificationRef.current)
      }

      return true
    } catch (error) {
      pushLog('error', `Failed to initialize characteristics: ${error}`)
      return false
    }
  }, [])

  // Clean up Bluetooth resources
  const cleanupBluetooth = useCallback(async () => {
    try {
      // Remove notification listener
      if (notificationRef.current && characteristicsRef.current.has(CHAR_STATUS)) {
        const statusChar = characteristicsRef.current.get(CHAR_STATUS)
        if (statusChar) {
          statusChar.removeEventListener('characteristicvaluechanged', notificationRef.current)
        }
      }

      // Disconnect GATT server
      if (gattServerRef.current && gattServerRef.current.connected) {
        await gattServerRef.current.disconnect()
      }
    } catch (error) {
      pushLog('error', `Error during Bluetooth cleanup: ${error}`)
    } finally {
      // Clear references
      bluetoothDeviceRef.current = null
      gattServerRef.current = null
      serviceRef.current = null
      characteristicsRef.current.clear()
      notificationRef.current = () => {}
    }
  }, [])

  // Auto-reconnect: try last known device id before falling back to fresh scan.
  useEffect(() => {
    if (!isWebBluetoothAvailable()) {
      pushLog('system', 'Web Bluetooth not available in this browser')
      setConnectionState('unauthorized')
      return
    }

    const attemptAutoReconnect = useCallback(async () => {
      if (isDisconnectingRef.current) return

      isDisconnectingRef.current = true
      try {
        const lastId = localStorage.getItem(LAST_DEVICE_KEY)
        if (lastId) {
          pushLog('system', `Found cached peripheral UUID ${lastId.slice(0, 8)}… attempting to retrieve`)
          setConnectionState('connecting')

          try {
            // Try to get the device by ID
            const device = await navigator.bluetooth.getDevice({ id: lastId })
            if (device && !device.gatt.connected) {
              bluetoothDeviceRef.current = device
              await connectToDevice(device)
              return
            }
          } catch (error) {
            pushLog('system', `Could not retrieve last device: ${error}`)
          }
        }

        // If we get here, auto-reconnect failed or no last device
        setConnectionState('idle')
      } finally {
        isDisconnectingRef.current = false
      }
    }, [])

    attemptAutoReconnect()
  }, [])

  const finishConnect = useCallback(() => {
    setConnectionState('ready')
    pushLog('gatt', 'Connected to device')
  }, [])

  const startScan = useCallback(async () => {
    if (!isWebBluetoothAvailable()) {
      pushLog('error', 'Web Bluetooth not available')
      setConnectionState('unauthorized')
      return
    }

    if (connectionState === 'scanning') return

    try {
      setConnectionState('scanning')
      setDiscovered([])
      pushLog('scan', 'Requesting Bluetooth device...')

      // Request device with our service UUID
      const device = await navigator.bluetooth.requestDevice({
        // Accept any device that has our service
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      })

      bluetoothDeviceRef.current = device
      // We don't get RSSI from requestDevice, use placeholder
      setDevice({ id: device.id, name: device.name || 'Unknown Device', rssi: -50 })
      setRssi(-50) // Placeholder

      pushLog('device', `Selected device: ${device.name || 'Unknown'} (${device.id})`)

      // Try to connect
      await connectToDevice(device)
    } catch (error) {
      // Handle user cancellation or other errors
      if (error.name === 'NotFoundError' || error.name === 'NotReadableError' || error.name === 'SecurityError') {
        // User cancelled or denied permission
        pushLog('scan', 'User did not select a device or denied permission')
        setConnectionState('idle')
      } else {
        pushLog('error', `Failed to request device: ${error}`)
        setConnectionState('error')
      }
    }
  }, [connectionState, isWebBluetoothAvailable])

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    try {
      setConnectionState('connecting')
      pushLog('connect', `Connecting to GATT server...`)

      const server = await device.gatt.connect()
      gattServerRef.current = server

      pushLog('gatt', 'GATT connected, getting primary service...')

      const service = await server.getPrimaryService(SERVICE_UUID)
      serviceRef.current = service

      pushLog('service', 'Primary service found, initializing characteristics...')

      const charsInitialized = await initializeCharacteristics()
      if (!charsInitialized) {
        throw new Error('Failed to initialize characteristics')
      }

      // Try to read initial brightness
      try {
        const brightnessChar = characteristicsRef.current.get(CHAR_BRIGHTNESS)
        if (brightnessChar) {
          const value = await brightnessChar.readValue()
          const brightnessLevel = value.getUint8(0)
          setBrightnessState(Math.round((brightnessLevel / 255) * 100))
          pushLog('read', `Brightness characteristic read -> ${brightnessLevel}`)
        }
      } catch (readError) {
        pushLog('warn', `Could not read initial brightness: ${readError}`)
      }

      finishConnect()

      // Save last connected device
      localStorage.setItem(LAST_DEVICE_KEY, device.id)
    } catch (error) {
      pushLog('error', `Connection failed: ${error}`)
      setConnectionState('error')
      await cleanupBluetooth()
      throw error
    }
  }, [initializeCharacteristics, cleanupBluetooth])

  const connect = useCallback(
    async (badge: DiscoveredBadge) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      try {
        // Find the actual device object by ID
        // Since we don't keep a map of all discovered devices to their objects,
        // we need to rescan or have the caller provide the actual device
        // For simplicity, we'll initiate a scan which will allow device selection
        pushLog('system', 'To connect to a specific device, initiating scan for device selection')
        await startScan()
      } catch (error) {
        pushLog('error', `Failed to initiate connection: ${error}`)
      }
    },
    [startScan]
  )

  const disconnect = useCallback(async () => {
    if (isDisconnectingRef.current) return

    isDisconnectingRef.current = true
    try {
      pushLog('system', 'User requested disconnect')
      setConnectionState('disconnected')

      await cleanupBluetooth()

      setDevice(null)
      setRssi(-60)
    } catch (error) {
      pushLog('error', `Error during disconnect: ${error}`)
      setConnectionState('error')
    } finally {
      isDisconnectingRef.current = false
    }
  }, [cleanupBluetooth])

  const toggleBluetoothPower = useCallback(() => {
    // In web we can't actually toggle Bluetooth power, but we can simulate the UI effect
    setBluetoothPowered(!bluetoothPowered)
    if (!bluetoothPowered) {
      setConnectionState('poweredOff')
      // Disconnect if we were connected
      if (connectionState === 'ready') {
        disconnect().catch(console.error)
      }
    } else {
      setConnectionState('idle')
    }
  }, [bluetoothPowered, connectionState, disconnect])

  // --- face_select write ---
  const selectFace = useCallback(
    async (index: number) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      if (connectionState !== 'ready') {
        pushLog('write', 'ERROR: not connected')
        return
      }

      try {
        setSelectedFace(index)
        const faceChar = characteristicsRef.current.get(CHAR_FACE_SELECT)
        if (faceChar) {
          await faceChar.writeValue(new Uint8Array([index]))
          pushLog('write', `face_select <- 0x${index.toString(16).padStart(2, '0')}`)
        }
      } catch (error) {
        pushLog('error', `Failed to write face_select: ${error}`)
        // Consider reconnecting or error state
      }
    },
    [connectionState, isWebBluetoothAvailable]
  )

  // --- brightness write ---
  const setBrightness = useCallback(
    async (pct: number) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      if (connectionState !== 'ready') {
        pushLog('write', 'ERROR: not connected')
        return
      }

      try {
        setBrightnessState(pct)
        const byte = Math.round((pct / 100) * 255)
        setPendingByteWrite(byte)

        const brightnessChar = characteristicsRef.current.get(CHAR_BRIGHTNESS)
        if (brightnessChar) {
          await brightnessChar.writeValue(new Uint8Array([byte]))
          pushLog('write', `brightness <- ${byte} (${pct}%)`)
        }
      } catch (error) {
        pushLog('error', `Failed to write brightness: ${error}`)
      }
    },
    [connectionState, isWebBluetoothAvailable]
  )

  // --- boot_anim_flag write ---
  const setBootAnim = useCallback(
    async (enabled: boolean) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      if (connectionState !== 'ready') {
        pushLog('write', 'ERROR: not connected')
        return
      }

      try {
        setBootAnimEnabled(enabled)
        const bootAnimChar = characteristicsRef.current.get(CHAR_BOOT_ANIM_FLAG)
        if (bootAnimChar) {
          await bootAnimChar.writeValue(new Uint8Array([enabled ? 1 : 0]))
          pushLog('write', `boot_anim_flag <- ${enabled ? "0x01" : "0x00"}`)
        }
      } catch (error) {
        pushLog('error', `Failed to write boot_anim_flag: ${error}`)
      }
    },
    [connectionState, isWebBluetoothAvailable]
  )

  // --- Image data transfer function ---
  const transferImageData = useCallback(
    async (dataUrl: string, onProgress?: (progress: number) => void) => {
      if (!isWebBluetoothAvailable()) {
        throw new Error('Web Bluetooth not available')
      }

      if (connectionState !== 'ready') {
        throw new Error('Not connected to device')
      }

      // Convert the image to RGB565 buffer
      const rgb565Buffer = await convertToRGB565(dataUrl, 480)
      const totalBytes = rgb565Buffer.byteLength
      const chunkPayload = MTU_PAYLOAD_BYTES - IMAGE_HEADER_BYTES
      const totalChunks = Math.ceil(totalBytes / chunkPayload)

      pushLog(
        'xfer',
        `Starting image transfer: ${totalBytes} bytes, ${totalChunks} chunks`
      )

      setTransfer({
        phase: 'preparing',
        chunkIndex: 0,
        totalChunks,
        bytesSent: 0,
        totalBytes,
        frameIndex: 0, // For single image
        totalFrames: 1,
      })

      // Write in chunks
      let bytesSent = 0
      let chunkIndex = 0

      while (bytesSent < totalBytes) {
        // Check if we should abort
        if (connectionState !== 'ready') {
          throw new Error('Disconnected during transfer')
        }

        const chunkEnd = Math.min(bytesSent + chunkPayload, totalBytes)
        const chunkData = rgb565Buffer.slice(bytesSent, chunkEnd)

        // Prepare the chunk with header
        const chunkWithHeader = new Uint8Array(IMAGE_HEADER_BYTES + chunkData.byteLength)

        // Header: frame index (1B) + total chunks (2B, big endian) + chunk index (2B, big endian)
        chunkWithHeader[0] = 0 // frame index (0-based)
        chunkWithHeader[1] = (totalChunks >> 8) & 0xFF // total chunks high byte
        chunkWithHeader[2] = totalChunks & 0xFF         // total chunks low byte
        chunkWithHeader[3] = (chunkIndex >> 8) & 0xFF   // chunk index high byte
        chunkWithHeader[4] = chunkIndex & 0xFF          // chunk index low byte

        // Copy the data
        chunkWithHeader.set(new Uint8Array(chunkData), IMAGE_HEADER_BYTES)

        try {
          const imageDataChar = characteristicsRef.current.get(CHAR_IMAGE_DATA)
          if (!imageDataChar) {
            throw new Error('IMAGE_DATA characteristic not available')
          }

          await imageDataChar.writeValue(chunkWithHeader)
          bytesSent = chunkEnd
          chunkIndex++

          setTransfer(t => ({
            ...t,
            phase: 'uploading',
            chunkIndex,
            bytesSent
          }))

          // Report progress
          const progress = Math.round((bytesSent / totalBytes) * 100)
          onProgress?.(progress)

          pushLog('xfer', `Sent chunk ${chunkIndex}/${totalChunks} (${bytesSent}/${totalBytes} bytes)`)

          // Small delay to avoid overwhelming the device
          await new Promise(resolve => setTimeout(resolve, 20))
        } catch (writeError) {
          pushLog('xfer', `ERROR writing chunk ${chunkIndex}: ${writeError}`)
          throw writeError
        }
      }

      // Transfer complete
      const duration = transferStartTime.current ? Date.now() - transferStartTime.current : 0
      setTransfer(t => ({ ...t, phase: 'complete' }))

      pushLog('xfer', `Transfer complete: ${totalBytes} bytes sent in ${duration}ms`)

      return { totalBytes, duration }
    },
    [connectionState, isWebBluetoothAvailable, setTransfer, pushLog]
  )

  const uploadCustomFace = useCallback(
    async (name: string, dataUrl: string) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      if (connectionState !== 'ready') {
        pushLog('xfer', 'ERROR: not connected, aborting upload')
        return
      }

      try {
        pushLog('xfer', `Starting custom face upload: ${name}`)

        transferStartTime.current = Date.now()

        const { totalBytes, duration } = await transferImageData(
          dataUrl,
          (progress) => {
            // We could update a progress UI here if needed
          }
        )

        // Log to transfer history
        addLog({
          faceName: name,
          status: 'success',
          duration,
          size: totalBytes,
        })

        // Save the face
        saveFace(name, dataUrl, 'Uploaded')

        pushLog('xfer', `Custom face upload completed: ${name}`)
      } catch (error) {
        pushLog('xfer', `ERROR: ${error}`)
        setTransfer(t => ({ ...t, phase: 'error', error: String(error) }))
      }
    },
    [connectionState, isWebBluetoothAvailable, addLog, saveFace, transferImageData]
  )

  const uploadBootAnimation = useCallback(
    async (frames: BootFrame[]) => {
      if (!isWebBluetoothAvailable()) {
        pushLog('error', 'Web Bluetooth not available')
        return
      }

      if (connectionState !== 'ready') {
        pushLog('xfer', 'ERROR: not connected, aborting upload')
        return
      }

      try {
        pushLog('xfer', `Starting boot animation upload: ${frames.length} frames`)

        let i = 0
        const totalFrames = frames.length

        const processNextFrame = async () => {
          if (i >= totalFrames) {
            // All frames uploaded, enable boot animation
            await setBootAnim(true)
            pushLog('xfer', `All ${totalFrames} boot frames uploaded, boot_anim_flag enabled`)
            return
          }

          const frame = frames[i]
          const frameIndex = i

          try {
            pushLog('xfer', `Uploading frame ${frameIndex + 1}/${totalFrames}`)

            transferStartTime.current = Date.now()

            await transferImageData(
              frame.dataUrl,
              (progress) => {
                // Progress for individual frame
              }
            )

            // Log individual frame transfer (optional)
            // addLog({
            //   faceName: `Boot Frame ${frameIndex + 1}`,
            //   status: 'success',
            //   duration: transferStartTime.current ? Date.now() - transferStartTime.current : 0,
            //   size: RGB565_IMAGE_BYTES
            // })

            i++
            await processNextFrame()
          } catch (error) {
            pushLog('xfer', `Error uploading frame ${frameIndex + 1}: ${error}`)
            // Depending on requirements, we might want to continue or abort
            // For now, let's continue with next frame
            i++
            await processNextFrame()
          }
        }

        await processNextFrame()
      } catch (error) {
        pushLog('xfer', `ERROR in boot animation upload: ${error}`)
        setTransfer(t => ({ ...t, phase: 'error', error: String(error) }))
      }
    },
    [connectionState, isWebBluetoothAvailable, setBootAnim, transferImageData]
  )

  const cancelTransfer = useCallback(async () => {
    // In real implementation, we might need to send a cancel command
    // For now, just reset state
    try {
      if (transferStartTime.current !== null) {
        // Note: We don't have a direct way to cancel an ongoing write in Web Bluetooth
        // The best we can do is disconnect or ignore further writes
        // For simplicity, we'll just reset our state
      }
    } catch (e) {/* ignore */}

    setTransfer(t => ({ ...t, phase: 'cancelled' }))
    pushLog('xfer', 'Transfer cancelled by user')
  }, [])

  const addBootFrames = useCallback((frames: BootFrame[]) => {
    setBootFrames(prev => [...prev, ...frames])
  }, [])

  const clearBootFrames = useCallback(() => setBootFrames([]), [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDisconnectingRef.current = true
      cleanupBluetooth().catch(console.error)
    }
  }, [cleanupBluetooth])

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