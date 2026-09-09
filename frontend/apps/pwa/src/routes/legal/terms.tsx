import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/legal/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <Scale className="w-8 h-8 text-tertiary" />
          <Trans>Terms of Service</Trans>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>1. Acceptance of Terms</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              By using StackBluff ("the Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>2. Eligibility</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              You must be at least 18 years old to use the Service. By using the Service, you
              represent and warrant that you are at least 18 years old.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>3. Account Responsibility</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              You are responsible for maintaining the security of your account and for all
              activities that occur under your account. You agree to notify us immediately of any
              unauthorized use of your account.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>4. Prohibited Conduct</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li>
              <Trans>Cheating, collusion, or use of automated tools (bots)</Trans>
            </li>
            <li>
              <Trans>Harassment, abusive language, or inappropriate behavior</Trans>
            </li>
            <li>
              <Trans>Fraudulent activities or impersonation</Trans>
            </li>
            <li>
              <Trans>Violation of any applicable laws or regulations</Trans>
            </li>
            <li>
              <Trans>Attempting to bypass security measures</Trans>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>5. Intellectual Property</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              All content on the Service, including logos, trademarks, and software, is the property
              of StackBluff or its licensors. You may not reproduce, distribute, or create
              derivative works without explicit permission.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>6. Limitation of Liability</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              The Service is provided "as is" without warranties of any kind. StackBluff is not
              liable for any damages arising from the use of the Service, including loss of chips,
              data, or profits.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>7. Changes to Terms</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              We may update these Terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the new Terms.
            </Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">
            <Trans>8. Governing Law</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>
              These Terms are governed by the laws of [Your Jurisdiction]. Any disputes shall be
              resolved in the courts of [Your Jurisdiction].
            </Trans>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
