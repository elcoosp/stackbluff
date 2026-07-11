import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { requireAuth } from '@/lib/authGuard';

export const Route = createFileRoute('/settings/telegram')({
  component: TelegramSettingsPage,
});

function TelegramSettingsPage() {
  const {user} = useAuthStore();
  const isTelegramUser = user?.platform === 'telegram';

  const handleLinkTelegram = () => {
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'StackBluffBot';
    const userId = user?.id;
    const link = `https://t.me/${botUsername}?start=link_${userId}`;
    window.open(link, '_blank');
    toast.info('Opening Telegram... Please follow the instructions in the bot.');
  };


  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface">Telegram Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Send className="w-4 h-4 text-tertiary" />
            Telegram Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTelegramUser ? (
            <div className="flex items-center gap-3 p-3 bg-tertiary/10 border border-tertiary/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-tertiary" />
              <div>
                <p className="text-sm text-on-surface font-medium">Signed in with Telegram</p>
                <p className="text-xs text-on-surface-variant">Your account is linked to Telegram.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">
                Link your Telegram account to receive notifications, tournament reminders, and more.
              </p>
              <Button
                onClick={handleLinkTelegram}
                className="bg-[#0088cc] hover:bg-[#0077b3] text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Link Telegram Account
              </Button>
              <p className="text-xs text-on-surface-variant/50">
                You will be redirected to Telegram. Follow the instructions in the bot to complete linking.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
