import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Bug,
  BookOpen,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/help')({
  component: HelpPage,
});

const FAQ_ITEMS = [
  {
    question: 'How do I create a table?',
    answer:
      'Go to the Lobby, click "Create Table", choose the stake level and number of players, then click "Create". Your table will appear in the lobby list.',
  },
  {
    question: 'How do I join a tournament?',
    answer:
      'Navigate to the Tournaments page, find a tournament that is in the "Registering" state, and click "Register". You will need to have enough chips for the buy-in.',
  },
  {
    question: 'What are the different stake levels?',
    answer:
      'Micro ($0.02/$0.05), Low ($0.10/$0.25), Medium ($0.50/$1.00), High ($2/$4), Very High ($5/$10). The stakes determine the minimum and maximum buy-in amounts.',
  },
  {
    question: 'How do I sit out?',
    answer:
      'At the table, click the "Sit Out" button (moon icon) to be dealt out of hands. You will remain at the table but will not be dealt cards until you click "Sit In" (sun icon).',
  },
  {
    question: 'What is the Oracle?',
    answer:
      'The Oracle is our hand analysis tool. It provides real-time advice on your actions using Monte Carlo simulations. Free users get 3 analyses per session; Season Pass holders get unlimited access.',
  },
  {
    question: 'How do I invite friends?',
    answer:
      "Go to the Referrals page to get your unique referral link. Share it with friends, and you'll earn bonuses when they play 5+ hands.",
  },
  {
    question: 'What are the founding member badges?',
    answer:
      'The Founding Member badge is awarded to players who refer 10 friends who each play at least 5 hands. It is a one-time exclusive badge.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Use the contact form below, or join our Telegram support group: https://t.me/StackBluffSupport',
  },
];

function HelpPage() {
  const { isAuthenticated } = useAuthStore();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
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
      toast.error('Please fill in all fields');
      return;
    }
    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch('/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      toast.success("Message sent! We'll get back to you within 24 hours.");
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      toast.error('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <HelpCircle className="w-8 h-8 text-tertiary" />
          Help & Support
        </h1>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10 hover:border-tertiary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-tertiary" />
            <div>
              <p className="font-medium text-on-surface">Guide</p>
              <p className="text-xs text-on-surface-variant">Learn the rules</p>
            </div>
            <Link to="/guide" className="ml-auto text-tertiary text-sm">
              View →
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 hover:border-tertiary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-tertiary" />
            <div>
              <p className="font-medium text-on-surface">Community</p>
              <p className="text-xs text-on-surface-variant">Join our Discord</p>
            </div>
            <a href="#" className="ml-auto text-tertiary text-sm">
              Join →
            </a>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 hover:border-tertiary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <Bug className="w-5 h-5 text-tertiary" />
            <div>
              <p className="font-medium text-on-surface">Report Bug</p>
              <p className="text-xs text-on-surface-variant">Help us improve</p>
            </div>
            <button
              className="ml-auto text-tertiary text-sm"
              onClick={() =>
                document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Report →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-tertiary" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm font-medium text-on-surface">{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-on-surface-variant" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 text-sm text-on-surface-variant border-t border-white/5 pt-2">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contact Form */}
      <Card id="contact-form">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-tertiary" />
            Contact Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="text-on-surface-variant text-xs">
                Your Name
              </Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-on-surface-variant text-xs">
                Email Address
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message" className="text-on-surface-variant text-xs">
                Message
              </Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                className="bg-surface-container-high border-outline-variant/50 text-on-surface min-h-[120px]"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-tertiary text-on-tertiary hover:bg-tertiary/80 w-full"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">◌</span>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
            <p className="text-xs text-on-surface-variant/50 text-center">
              We typically respond within 24 hours.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Legal Links - only once at bottom */}
      <div className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant border-t border-white/10 pt-6">
        <Link to="/legal/terms" className="hover:text-tertiary transition-colors">
          Terms of Service
        </Link>
        <span className="text-white/20">|</span>
        <Link to="/legal/privacy" className="hover:text-tertiary transition-colors">
          Privacy Policy
        </Link>
        <span className="text-white/20">|</span>
        <Link to="/responsible-gaming" className="hover:text-tertiary transition-colors">
          Responsible Gaming
        </Link>
      </div>
    </div>
  );
}
