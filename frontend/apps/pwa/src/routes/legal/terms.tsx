import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Scale } from 'lucide-react';

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
          Terms of Service
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">1. Acceptance of Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            By using StackBluff ("the Service"), you agree to be bound by these Terms of Service ("Terms").
            If you do not agree to these Terms, please do not use the Service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">2. Eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you are at least 18 years old.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">3. Account Responsibility</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            You are responsible for maintaining the security of your account and for all activities that occur under your account.
            You agree to notify us immediately of any unauthorized use of your account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">4. Prohibited Conduct</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
            <li>Cheating, collusion, or use of automated tools (bots)</li>
            <li>Harassment, abusive language, or inappropriate behavior</li>
            <li>Fraudulent activities or impersonation</li>
            <li>Violation of any applicable laws or regulations</li>
            <li>Attempting to bypass security measures</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">5. Intellectual Property</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            All content on the Service, including logos, trademarks, and software, is the property of StackBluff or its licensors.
            You may not reproduce, distribute, or create derivative works without explicit permission.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">6. Limitation of Liability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            The Service is provided "as is" without warranties of any kind. StackBluff is not liable for any damages arising from the use of the Service,
            including loss of chips, data, or profits.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">7. Changes to Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-on-surface">8. Governing Law</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            These Terms are governed by the laws of [Your Jurisdiction]. Any disputes shall be resolved in the courts of [Your Jurisdiction].
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
