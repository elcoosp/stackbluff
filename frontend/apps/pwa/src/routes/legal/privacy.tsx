import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/legal/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
          <Shield className="w-8 h-8 text-tertiary" />
          <Trans>Privacy Policy</Trans>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>1. Information We Collect</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We collect information you provide directly, such as your name, email address, and payment information. We also collect usage data, device information, and cookies for analytics and security.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>2. How We Use Your Information</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li><Trans>To provide, maintain, and improve the Service</Trans></li>
            <li><Trans>To process transactions and send related information</Trans></li>
            <li><Trans>To communicate with you about updates, promotions, and support</Trans></li>
            <li><Trans>To prevent fraud and ensure security</Trans></li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>3. Data Retention</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We retain your data for as long as your account is active, or as needed to provide the Service. You may request deletion of your data at any time via the Privacy settings.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>4. Cookies and Tracking</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We use cookies and similar technologies to enhance your experience, analyze usage, and for fraud prevention. You can manage your cookie preferences in your browser settings.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>5. Data Sharing</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We do not sell or share your personal information with third parties except as necessary to provide the Service (e.g., payment processors, hosting providers) or as required by law.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>6. Your Rights</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li><Trans>Access, correct, or delete your data</Trans></li>
            <li><Trans>Withdraw consent for data processing</Trans></li>
            <li><Trans>Data portability</Trans></li>
            <li><Trans>Opt out of marketing communications</Trans></li>
          </ul>
          <p className="text-sm text-on-surface-variant mt-2">
            <Trans>To exercise these rights, visit your account Privacy settings or contact us.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>7. Security</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We implement industry-standard security measures to protect your data, including encryption and regular security audits.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>8. Changes to This Policy</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>We may update this policy from time to time. Continued use of the Service constitutes acceptance of the updated policy.</Trans>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface"><Trans>9. Contact Us</Trans></CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            <Trans>If you have questions about this Privacy Policy, please contact us at privacy@stackbluff.com.</Trans>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
