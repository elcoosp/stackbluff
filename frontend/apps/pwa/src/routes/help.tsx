import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  MessageCircle,
  Send,
  ChevronDown,
  Bug,
  BookOpen,
  Users,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/help')({
  component: HelpPage,
});

const FAQ_ITEMS = [
  {
    question: t`How do I create a table?`,
    answer: t`Go to the Lobby, click "Create Table", choose the stake level and number of players, then click "Create". Your table will appear in the lobby list.`,
  },
  {
    question: t`How do I join a tournament?`,
    answer: t`Navigate to the Tournaments page, find a tournament that is in the "Registering" state, and click "Register". You will need to have enough chips for the buy-in.`,
  },
  {
    question: t`What are the different stake levels?`,
    answer: t`Micro ($0.02/$0.05), Low ($0.10/$0.25), Medium ($0.50/$1.00), High ($2/$4), Very High ($5/$10). The stakes determine the minimum and maximum buy-in amounts.`,
  },
  {
    question: t`How do I sit out?`,
    answer: t`At the table, click the "Sit Out" button (moon icon) to be dealt out of hands. You will remain at the table but will not be dealt cards until you click "Sit In" (sun icon).`,
  },
  {
    question: t`What is the Oracle?`,
    answer: t`The Oracle is our hand analysis tool. It provides real-time advice on your actions using Monte Carlo simulations. Free users get 3 analyses per session; Season Pass holders get unlimited access.`,
  },
  {
    question: t`How do I invite friends?`,
    answer: t`Go to the Referrals page to get your unique referral link. Share it with friends, and you'll earn bonuses when they play 5+ hands.`,
  },
  {
    question: t`What are the founding member badges?`,
    answer: t`The Founding Member badge is awarded to players who refer 10 friends who each play at least 5 hands. It is a one-time exclusive badge.`,
  },
  {
    question: t`How do I contact support?`,
    answer: t`Use the contact form below, or join our Telegram support group: https://t.me/StackBluffSupport`,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function HelpPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t`Please fill in all fields`);
      return;
    }
    if (!email.includes('@')) {
      toast.error(t`Please enter a valid email address`);
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch('/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      toast.success(t`Message sent! We'll get back to you within 24 hours.`);
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      toast.error(t`Failed to send message. Please try again later.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-cyan-400">
            <Trans>Assistance</Trans>
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface">
          <Trans>Help & Support</Trans>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          <Trans>Find answers to common questions or reach out to our support team.</Trans>
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div variants={itemVariants}>
            <Link to="/guide" className="block h-full">
              <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 group h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 transition-transform duration-300 group-hover:scale-110">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-headline-md text-base text-on-surface"><Trans>Guide</Trans></p>
                    <p className="text-xs text-on-surface-variant"><Trans>Learn the rules</Trans></p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-on-surface-variant -rotate-90 group-hover:text-on-surface transition-colors" />
                </div>
              </Card>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <a href="#" className="block h-full">
              <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 group h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 transition-transform duration-300 group-hover:scale-110">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-headline-md text-base text-on-surface"><Trans>Community</Trans></p>
                    <p className="text-xs text-on-surface-variant"><Trans>Join our Discord</Trans></p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-on-surface-variant -rotate-90 group-hover:text-on-surface transition-colors" />
                </div>
              </Card>
            </a>
          </motion.div>

          <motion.div variants={itemVariants}>
            <button
              onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full h-full text-left"
            >
              <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 group h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 transition-transform duration-300 group-hover:scale-110">
                    <Bug className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-headline-md text-base text-on-surface"><Trans>Report Bug</Trans></p>
                    <p className="text-xs text-on-surface-variant"><Trans>Help us improve</Trans></p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-on-surface-variant -rotate-90 group-hover:text-on-surface transition-colors" />
                </div>
              </Card>
            </button>
          </motion.div>
        </div>

        {/* FAQ Section */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                  <HelpCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-headline-md text-base text-on-surface"><Trans>Frequently Asked Questions</Trans></h3>
              </div>
            </div>
            <div className="p-6 pt-4 space-y-3">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={index} className={cn(
                    "border rounded-xl overflow-hidden transition-colors duration-300",
                    isOpen ? "bg-white/[0.04] border-white/15" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                  )}>
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full px-4 py-4 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-medium text-on-surface pr-4">{item.question}</span>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0"
                      >
                        <ChevronDown className={cn("w-4 h-4", isOpen ? "text-tertiary" : "text-on-surface-variant")} />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 text-sm text-on-surface-variant">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Contact Form */}
        <motion.div variants={itemVariants} id="contact-form">
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
                  <MessageCircle className="w-5 h-5 text-tertiary" />
                </div>
                <h3 className="font-headline-md text-base text-on-surface"><Trans>Contact Support</Trans></h3>
              </div>
            </div>
            <div className="p-6 pt-4">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name" className="text-on-surface-variant text-xs uppercase tracking-wider">
                      <Trans>Your Name</Trans>
                    </Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t`John Doe`}
                      className="bg-black/20 border-white/10 rounded-xl text-on-surface focus-visible:ring-tertiary/50 focus-visible:border-tertiary/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-on-surface-variant text-xs uppercase tracking-wider">
                      <Trans>Email Address</Trans>
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t`john@example.com`}
                      className="bg-black/20 border-white/10 rounded-xl text-on-surface focus-visible:ring-tertiary/50 focus-visible:border-tertiary/50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message" className="text-on-surface-variant text-xs uppercase tracking-wider">
                    <Trans>Message</Trans>
                  </Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t`Describe your issue or question...`}
                    className="bg-black/20 border-white/10 rounded-xl text-on-surface min-h-[140px] focus-visible:ring-tertiary/50 focus-visible:border-tertiary/50 resize-none"
                    required
                  />
                </div>
                <div className="flex flex-col items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg w-full md:w-auto justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2">◌</span>
                        <Trans>Sending...</Trans>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        <Trans>Send Message</Trans>
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-on-surface-variant/60 font-mono">
                    <Trans>We typically respond within 24 hours.</Trans>
                  </p>
                </div>
              </form>
            </div>
          </Card>
        </motion.div>

        {/* Legal Links */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant border-t border-white/10 pt-6"
        >
          <Link to="/legal/terms" className="hover:text-tertiary transition-colors">
            <Trans>Terms of Service</Trans>
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/legal/privacy" className="hover:text-tertiary transition-colors">
            <Trans>Privacy Policy</Trans>
          </Link>
          <span className="text-white/20">|</span>
          <Link to="/responsible-gaming" className="hover:text-tertiary transition-colors">
            <Trans>Responsible Gaming</Trans>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
