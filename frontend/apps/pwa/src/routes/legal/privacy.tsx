import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';

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
          Privacy Policy
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">1. Information We Collect</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We collect information you provide directly, such as your name, email address, and payment information.
            We also collect usage data, device information, and cookies for analytics and security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">2. How We Use Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li>To provide, maintain, and improve the Service</li>
            <li>To process transactions and send related information</li>
            <li>To communicate with you about updates, promotions, and support</li>
            <li>To prevent fraud and ensure security</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">3. Data Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We retain your data for as long as your account is active, or as needed to provide the Service.
            You may request deletion of your data at any time via the Privacy settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">4. Cookies and Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We use cookies and similar technologies to enhance your experience, analyze usage, and for fraud prevention.
            You can manage your cookie preferences in your browser settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">5. Data Sharing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We do not sell or share your personal information with third parties except as necessary to provide the Service
            (e.g., payment processors, hosting providers) or as required by law.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">6. Your Rights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li>Access, correct, or delete your data</li>
            <li>Withdraw consent for data processing</li>
            <li>Data portability</li>
            <li>Opt out of marketing communications</li>
          </ul>
          <p className="text-sm text-on-surface-variant mt-2">
            To exercise these rights, visit your account Privacy settings or contact us.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">7. Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We implement industry-standard security measures to protect your data, including encryption and regular security audits.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">8. Changes to This Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We may update this policy from time to time. Continued use of the Service constitutes acceptance of the updated policy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">9. Contact Us</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            If you have questions about this Privacy Policy, please contact us at privacy@stackbluff.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
