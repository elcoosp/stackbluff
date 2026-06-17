import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Swords, Trophy, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

function IndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="font-display-lg text-5xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
        <p className="font-data-mono text-sm text-on-surface-variant mt-3 tracking-widest">HIGH STAKES POKER</p>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardVariants}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Play Now
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-on-surface-variant text-sm mb-4">Join a table and test your skills against other players.</p>
              <Link to="/lobby" className="mt-auto">
                <Button variant="default" className="w-full">JOIN TABLE</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-on-surface-variant text-sm mb-4">See who's on top. Rankings update in real-time.</p>
              <Link to="/leaderboard" className="mt-auto">
                <Button variant="outline" className="w-full">VIEW RANKS</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Learn
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-on-surface-variant text-sm mb-4">New to poker? Start with the basics.</p>
              <Link to="/guide" className="mt-auto">
                <Button variant="outline" className="w-full">GUIDE</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
