import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const PlayerAvatar = ({
  name,
  avatarUrl,
  isActive,
  size = 'w-10 h-10',
}: {
  name: string;
  avatarUrl?: string;
  isActive?: boolean;
  size?: string;
}) => (
  <motion.div
    animate={{ scale: isActive ? 1.05 : 1 }}
    transition={{ duration: 0.2 }}
  >
    <Avatar className={cn('border border-tertiary/50 ring-2 ring-tertiary/20', size)}>
      <AvatarImage src={avatarUrl} className="grayscale" />
      <AvatarFallback className="bg-surface-container text-on-surface text-xs">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  </motion.div>
);
