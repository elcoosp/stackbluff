import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useShopStore } from '../../stores/shopStore';

export function PurchaseToast() {
  const toast = useShopStore((s) => s.toast);
  const setToast = useShopStore((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    if (toast.type === 'error') return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-6 right-6 z-50 rounded-lg px-6 py-3 text-sm font-medium text-white shadow-lg ${
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {toast.message}
      {toast.type === 'error' && (
        <button
          onClick={() => setToast(null)}
          className="ml-3 text-xs underline opacity-75 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </motion.div>
  );
}
