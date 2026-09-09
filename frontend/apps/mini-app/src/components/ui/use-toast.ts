import { useState } from 'react';

interface Toast {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (t: Toast) => {
    console.log('Toast:', t);
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.slice(1)), 3000);
  };
  return { toast, toasts };
}
