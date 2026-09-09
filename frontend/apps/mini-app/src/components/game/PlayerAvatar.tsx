import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export const PlayerAvatar = ({
  name,
  avatarUrl,
  isActive,
}: {
  name: string;
  avatarUrl?: string;
  isActive?: boolean;
}) => (
  <motion.div animate={{ scale: isActive ? 1.05 : 1 }} transition={{ duration: 0.2 }}>
    <Avatar className="w-10 h-10 border border-tertiary/50 ring-2 ring-tertiary/20">
      <AvatarImage src={avatarUrl} className="grayscale" />{' '}
      <AvatarFallback className="bg-surface-container text-on-surface">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  </motion.div>
);
