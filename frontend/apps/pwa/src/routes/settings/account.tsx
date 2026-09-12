import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Helper to load locale dynamically
async function loadLocale(locale: string) {
  const { messages } = await import(`../../locales/${locale}/messages.mjs`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

// Store language preference
const LANG_STORAGE_KEY = 'stackbluff-language';

function getStoredLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
}

function setStoredLanguage(locale: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANG_STORAGE_KEY, locale);
}

export const Route = createFileRoute('/settings/account')({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    const stored = getStoredLanguage();
    // Fallback to current i18n locale or stored
    return stored || i18n.locale || 'en';
  });
  const [isLoadingLang, setIsLoadingLang] = useState(false);

  // When language changes, load and activate
  useEffect(() => {
    const current = i18n.locale || 'en';
    if (selectedLanguage !== current) {
      setIsLoadingLang(true);
      loadLocale(selectedLanguage)
        .then(() => {
          setStoredLanguage(selectedLanguage);
          toast.success(t`Language changed to ${selectedLanguage.toUpperCase()}`);
        })
        .catch((err) => {
          console.error('Failed to load locale', err);
          toast.error(t`Failed to change language`);
        })
        .finally(() => setIsLoadingLang(false));
    }
  }, [selectedLanguage]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { display_name?: string; password?: string }) => {
      return apiClient('/user/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success(t`Profile updated successfully!`);
      setIsUpdating(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Failed to update profile`);
      setIsUpdating(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    const data: { display_name?: string; password?: string } = {};
    if (displayName.trim() && displayName !== user?.username) {
      data.display_name = displayName.trim();
    }
    if (password) {
      if (password.length < 8) {
        toast.error(t`Password must be at least 8 characters`);
        setIsUpdating(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t`Passwords do not match`);
        setIsUpdating(false);
        return;
      }
      data.password = password;
    }
    if (Object.keys(data).length === 0) {
      toast.info(t`No changes to save`);
      setIsUpdating(false);
      return;
    }
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface">
          <Trans>Account Settings</Trans>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">
              <Trans>Display Name</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t`Your display name`}
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">
              <Trans>Change Password</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-on-surface-variant text-xs">
                <Trans>New Password</Trans>
              </Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t`Leave blank to keep current`}
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-on-surface-variant text-xs">
                <Trans>Confirm New Password</Trans>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t`Confirm new password`}
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              />
            </div>
          </CardContent>
        </Card>

        {/* Language Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Globe className="w-4 h-4 text-tertiary" />
              <Trans>Language</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select
                value={selectedLanguage}
                onValueChange={(value) => setSelectedLanguage(value)}
                disabled={isLoadingLang}
              >
                <SelectTrigger className="w-48 bg-surface-container-high border-outline-variant/50 text-on-surface">
                  <SelectValue placeholder={t`Select language`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
              {isLoadingLang && <Loader2 className="w-4 h-4 animate-spin text-tertiary" />}
              {!isLoadingLang && selectedLanguage && (
                <span className="text-xs text-on-surface-variant">
                  <Trans>Current: {selectedLanguage.toUpperCase()}</Trans>
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/60 mt-2">
              <Trans>Choose your preferred language for the app interface.</Trans>
            </p>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={isUpdating}
          className="bg-tertiary text-on-tertiary hover:bg-tertiary/80 w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <Trans>Saving...</Trans>
            </>
          ) : (
            <Trans>Save Changes</Trans>
          )}
        </Button>
      </form>
    </div>
  );
}
