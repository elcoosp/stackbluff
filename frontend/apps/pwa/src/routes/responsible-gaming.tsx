import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, AlertTriangle, Shield, Clock, Coins, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/responsible-gaming')({
  component: ResponsibleGamingPage,
});

function ResponsibleGamingPage() {
  const handleSelfExclusion = () => {
    toast.info(t`Self-exclusion request submitted. We will contact you shortly.`);
  };

  const handleDepositLimit = () => {
    toast.info(t`Deposit limit request submitted. We will review and update your account.`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <Heart className="w-8 h-8 text-tertiary" />
          <Trans>Responsible Gaming</Trans>
        </h1>
      </div>

      <Card className="border-tertiary/20 bg-tertiary/5">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-on-surface"><Trans>Play Responsibly</Trans></h2>
          <p className="text-sm text-on-surface-variant mt-2 max-w-lg mx-auto">
            <Trans>StackBluff is committed to providing a safe and enjoyable gaming environment. We encourage all players to maintain control and play responsibly.</Trans>
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-tertiary" />
              <Trans>Reality Check</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-on-surface-variant">
              <Trans>Set a timer to receive periodic reminders of your play session duration. Take breaks regularly to maintain perspective.</Trans>
            </p>
            <Button variant="outline" size="sm" className="mt-3 border-white/10 text-on-surface-variant">
              <Trans>Set Reminder</Trans>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Coins className="w-4 h-4 text-tertiary" />
              <Trans>Deposit Limits</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-on-surface-variant">
              <Trans>Set daily, weekly, or monthly deposit limits to control your spending. Limits can be adjusted in your account settings.</Trans>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/10 text-on-surface-variant"
              onClick={handleDepositLimit}
            >
              <Trans>Set Limit</Trans>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <UserX className="w-4 h-4 text-tertiary" />
              <Trans>Self-Exclusion</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-on-surface-variant">
              <Trans>Take a break from gaming by excluding yourself for a chosen period. During this time, you will not be able to play or deposit.</Trans>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/10 text-on-surface-variant hover:border-red-500 hover:text-red-400"
              onClick={handleSelfExclusion}
            >
              <Trans>Request Exclusion</Trans>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Shield className="w-4 h-4 text-tertiary" />
              <Trans>Age Verification</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-on-surface-variant">
              <Trans>You must be 18+ to use StackBluff. We verify age to protect minors. If you believe a minor is using the service, please report it.</Trans>
            </p>
            <Button variant="outline" size="sm" className="mt-3 border-white/10 text-on-surface-variant">
              <Trans>Report Concern</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>Resources</Trans></CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-on-surface-variant">
            <Trans>If you or someone you know needs help with gambling-related issues, these organizations provide support:</Trans>
          </p>
          <ul className="list-disc pl-5 text-on-surface-variant space-y-1">
            <li>
              <a href="#" className="text-tertiary hover:underline"><Trans>National Council on Problem Gambling</Trans></a>
              {' '}- 1-800-522-4700
            </li>
            <li>
              <a href="#" className="text-tertiary hover:underline"><Trans>GamCare (UK)</Trans></a>
              {' '}- 0808 8020 133
            </li>
            <li>
              <a href="#" className="text-tertiary hover:underline"><Trans>Gambling Help Online (AU)</Trans></a>
              {' '}- 1800 858 858
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
