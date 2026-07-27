import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface SavedFace {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
  category?: string;
}

interface FaceStorageApi {
  savedFaces: SavedFace[];
  loaded: boolean;
  saveFace: (name: string, dataUrl: string, category?: string) => SavedFace;
  deleteFace: (id: string) => void;
  updateFace: (id: string, updates: Partial<SavedFace>) => void;
  clearAllFaces: () => void;
}

const STORAGE_KEY = "faces_saved_faces";

const FaceStorageContext = createContext<FaceStorageApi | null>(null);

export function FaceStorageProvider({ children }: { children: ReactNode }) {
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedFaces(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load saved faces:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = (faces: SavedFace[]) => {
    setSavedFaces(faces);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
    } catch (error) {
      console.error("Failed to persist faces:", error);
    }
  };

  const saveFace = (name: string, dataUrl: string, category?: string): SavedFace => {
    const newFace: SavedFace = {
      id: crypto.randomUUID(),
      name,
      dataUrl,
      createdAt: Date.now(),
      category,
    };
    persist([...savedFaces, newFace]);
    return newFace;
  };

  const deleteFace = (id: string) => {
    persist(savedFaces.filter((f) => f.id !== id));
  };

  const updateFace = (id: string, updates: Partial<SavedFace>) => {
    persist(savedFaces.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const clearAllFaces = () => {
    setSavedFaces([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear faces:", error);
    }
  };

  return (
    <FaceStorageContext.Provider value={{ savedFaces, loaded, saveFace, deleteFace, updateFace, clearAllFaces }}>
      {children}
    </FaceStorageContext.Provider>
  );
}

export function useFaceStorage(): FaceStorageApi {
  const ctx = useContext(FaceStorageContext);
  if (!ctx) throw new Error("useFaceStorage must be used within FaceStorageProvider");
  return ctx;
}
