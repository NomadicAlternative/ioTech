import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/i18n'
import './index.css'
import App from './App.tsx'

/**
 * Guard against browser extensions (Grammarly, adblockers, etc.) that inject
 * DOM nodes into React-managed trees. When React's reconciliation encounters
 * external nodes during removeChild, it throws a NotFoundError that crashes the
 * entire page. This monkey-patch silently ignores extension-injected nodes.
 */
const _origRemoveChild = Node.prototype.removeChild
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  try {
    return _origRemoveChild.call(this, child) as T
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      // Extension-injected node — silently return the element, don't crash
      return child
    }
    throw e
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
