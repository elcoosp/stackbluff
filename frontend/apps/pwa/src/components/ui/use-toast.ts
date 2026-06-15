import { useState } from "react"
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'error' | 'success' | 'info' }>>([])
  const show = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id), 5000)
  }
  return { show, toasts }
}
