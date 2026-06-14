import * as React from "react";
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, type = 'error', duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor =
    type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 ${bgColor} text-white px-4 py-2 rounded shadow-lg`}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<
    Array<{ id: number; message: string; type: 'error' | 'success' | 'info' }>
  >([]);

  const show = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
        />
      ))}
    </>
  );

  return { show, ToastContainer };
}
