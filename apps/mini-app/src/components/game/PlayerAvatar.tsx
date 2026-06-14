import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
export const PlayerAvatar = ({ name, avatarUrl, isActive }: { name: string; avatarUrl?: string; isActive?: boolean }) => (
  <motion.div animate={{ scale: isActive ? 1.05 : 1 }} transition={{ duration: 0.2 }}>
    <Avatar className="border-2 border-accent/50 ring-2 ring-accent/20">
      <AvatarImage src={avatarUrl} /> <AvatarFallback>{name.slice(0,2).toUpperCase()}</AvatarFallback>
    </Avatar>
  </motion.div>
);
