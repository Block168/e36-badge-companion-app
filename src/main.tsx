import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { FaceStorageProvider } from './hooks/useFaceStorage'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FaceStorageProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </FaceStorageProvider>
  </StrictMode>
)
