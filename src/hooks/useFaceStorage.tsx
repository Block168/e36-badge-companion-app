import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface SavedFace {
  id: string
  name: string
  dataUrl: string
  createdAt: number
  category?: string
}

interface FaceStorageApi {
  savedFaces: SavedFace[]
  loaded: boolean
  storageError: string | null
  saveFace: (name: string, dataUrl: string, category?: string) => SavedFace
  deleteFace: (id: string) => void
  updateFace: (id: string, updates: Partial<SavedFace>) => void
  clearAllFaces: () => void
  clearStorageError: () => void
}

const STORAGE_KEY = 'faces_saved_faces'

const FaceStorageContext = createContext<FaceStorageApi | null>(null)

export function FaceStorageProvider({ children }: { children: ReactNode }) {
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([])
  const [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSavedFaces(JSON.parse(stored))
      }
    } catch (error) {
      setStorageError('Failed to load saved faces from local storage.')
      console.error('Failed to load saved faces:', error)
    } finally {
      setLoaded(true)
    }
  }, [])

  const persist = (faces: SavedFace[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(faces))
      setStorageError(null)
    } catch (error) {
      setStorageError('Failed to save faces to local storage.')
      console.error('Failed to persist faces:', error)
    }
  }

  const saveFace = (name: string, dataUrl: string, category?: string): SavedFace => {
    const newFace: SavedFace = {
      id: crypto.randomUUID(),
      name,
      dataUrl,
      createdAt: Date.now(),
      category,
    }
    const next = [...savedFaces, newFace]
    setSavedFaces(next)
    persist(next)
    return newFace
  }

  const deleteFace = (id: string) => {
    const next = savedFaces.filter(f => f.id !== id)
    setSavedFaces(next)
    persist(next)
  }

  const updateFace = (id: string, updates: Partial<SavedFace>) => {
    const next = savedFaces.map(f => (f.id === id ? { ...f, ...updates } : f))
    setSavedFaces(next)
    persist(next)
  }

  const clearAllFaces = () => {
    setSavedFaces([])
    try {
      localStorage.removeItem(STORAGE_KEY)
      setStorageError(null)
    } catch (error) {
      setStorageError('Failed to clear saved faces from local storage.')
      console.error('Failed to clear faces:', error)
    }
  }

  return (
    <FaceStorageContext.Provider
      value={{
        savedFaces,
        loaded,
        storageError,
        saveFace,
        deleteFace,
        updateFace,
        clearAllFaces,
        clearStorageError: () => setStorageError(null),
      }}
    >
      {children}
    </FaceStorageContext.Provider>
  )
}

export function useFaceStorage(): FaceStorageApi {
  const ctx = useContext(FaceStorageContext)
  if (!ctx) throw new Error('useFaceStorage must be used within FaceStorageProvider')
  return ctx
}
