import { motion } from 'framer-motion';
export const Badge = ({ children, variant }: { children: React.ReactNode; variant?: 'dealer' | 'co' }) => (
  <motion.div className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold ${variant === 'dealer' ? 'bg-gradient-to-r from-yellow-400 to-amber-600 text-black' : variant === 'co' ? 'bg-gradient-to-r from-gray-500 to-gray-700 text-white' : 'bg-primary/20 text-primary'}`} animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
    {children}
  </motion.div>
);
