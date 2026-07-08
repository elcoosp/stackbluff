import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/settings/account')({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { display_name?: string; password?: string }) => {
      return apiClient('/user/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      setIsUpdating(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
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
        toast.error('Password must be at least 8 characters');
        setIsUpdating(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        setIsUpdating(false);
        return;
      }
      data.password = password;
    }
    if (Object.keys(data).length === 0) {
      toast.info('No changes to save');
      setIsUpdating(false);
      return;
    }
    updateProfileMutation.mutate(data);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to manage your account.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface">Account Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">Display Name</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-on-surface-variant text-xs">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-on-surface-variant text-xs">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              />
            </div>
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
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </form>
    </div>
  );
}
