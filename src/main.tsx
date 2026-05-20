import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Apple-inspired adapter tokens — namespaced under --apple-*, no UNO collision.
// Not official Apple DS. See design-systems/apple/apple-tokens.css for source.
import '../design-systems/apple/apple-tokens.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
