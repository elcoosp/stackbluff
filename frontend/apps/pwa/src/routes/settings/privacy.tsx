import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Download, Trash2, Shield, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { requireAuth } from '@/lib/authGuard';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/settings/privacy')({
  component: PrivacySettingsPage,
});

interface DeletionStatus {
  status: 'none' | 'pending' | 'completed';
  requested_at?: string;
  processed_at?: string;
}

function PrivacySettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {} = useAuthStore();
  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch current deletion status
  const { data: deletionStatus, isLoading: statusLoading } = useQuery<DeletionStatus>({
    queryKey: ['gdpr', 'status'],
    queryFn: () => apiClient<DeletionStatus>('/gdpr/status'),
    enabled: true,
    staleTime: 60_000,
  });

  // Request deletion mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>('/gdpr/request-deletion', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.success(t`Deletion request submitted. Your account will be deleted in 30 days.`);
      queryClient.invalidateQueries({ queryKey: ['gdpr'] });
      setIsDeletionDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Failed to request deletion`);
    },
  });

  // Cancel deletion mutation
  const cancelMutation = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>('/gdpr/cancel-deletion', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast.success(t`Deletion request cancelled.`);
      queryClient.invalidateQueries({ queryKey: ['gdpr'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Failed to cancel deletion`);
    },
  });

  // Export data mutation
  const exportMutation = useMutation({
    mutationFn: () => apiClient<{ download_url: string }>('/gdpr/export', {
      method: 'POST',
    }),
    onSuccess: (data) => {
      toast.success(t`Data export request submitted. You will receive a download link by email within 72 hours.`);
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Failed to request data export`);
      setIsExporting(false);
    },
  });

  if (statusLoading) {
    return <PrivacySkeleton />;
  }

  const isPending = deletionStatus?.status === 'pending';
  const isCompleted = deletionStatus?.status === 'completed';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface">
          <Trans>Privacy & Data</Trans>
        </h1>
      </div>
      <p className="text-on-surface-variant text-sm -mt-4 mb-6"><Trans>Manage your account data and privacy settings.</Trans></p>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Download className="w-4 h-4 text-tertiary" />
            <Trans>Export Your Data</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant mb-4">
            <Trans>Request a copy of all your personal data. You'll receive a download link by email within 72 hours.</Trans>
          </p>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || isPending}
            variant="outline"
            className="border-white/10 text-on-surface-variant hover:text-on-surface"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <Trans>Requesting...</Trans>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                <Trans>Request Data Export</Trans>
              </>
            )}
          </Button>
          {isPending && (
            <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <Trans>Deletion pending – export may be limited.</Trans>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <Trans>Delete Account</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCompleted ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-on-surface"><Trans>Your account has been deleted.</Trans></p>
            </div>
          ) : isPending ? (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">
                <Trans>Your account deletion is pending. It will be permanently deleted in 30 days.</Trans>
                <br />
                <span className="text-xs text-on-surface-variant/50">
                  <Trans>Requested on: {new Date(deletionStatus.requested_at!).toLocaleDateString()}</Trans>
                </span>
              </p>
              <Button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                variant="outline"
                className="border-white/10 text-on-surface-variant hover:text-on-surface"
              >
                {cancelMutation.isPending ? t`Cancelling...` : t`Cancel Deletion`}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">
                <Trans>Permanently delete your account and all associated data. This action is irreversible and cannot be undone.</Trans>
                <br />
                <span className="text-xs text-red-400/70"><Trans>You will have 30 days to cancel this request.</Trans></span>
              </p>
              <Button
                onClick={() => setIsDeletionDialogOpen(true)}
                variant="destructive"
                className="bg-red-500 hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                <Trans>Request Account Deletion</Trans>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {isDeletionDialogOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-surface-container border border-white/10">
            <h3 className="text-lg font-semibold text-on-surface mb-2"><Trans>Confirm Account Deletion</Trans></h3>
            <p className="text-sm text-on-surface-variant mb-4">
              <Trans>Are you sure you want to delete your account? This will permanently remove all your data, including chips, statistics, and tournament history.</Trans>
              <br />
              <span className="text-red-400"><Trans>This action cannot be undone.</Trans></span>
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsDeletionDialogOpen(false)}
                className="border-white/10 text-on-surface-variant"
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                variant="destructive"
                className="bg-red-500 hover:bg-red-600"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <Trans>Submitting...</Trans>
                  </>
                ) : (
                  <Trans>Yes, Delete My Account</Trans>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Legal Links */}
      <div className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant border-t border-white/10 pt-6">
        <Link to="/legal/terms" className="hover:text-tertiary transition-colors"><Trans>Terms of Service</Trans></Link>
        <span className="text-white/20">|</span>
        <Link to="/legal/privacy" className="hover:text-tertiary transition-colors"><Trans>Privacy Policy</Trans></Link>
        <span className="text-white/20">|</span>
        <Link to="/responsible-gaming" className="hover:text-tertiary transition-colors"><Trans>Responsible Gaming</Trans></Link>
      </div>
    </div>
  );
}

function PrivacySkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div>
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5 mt-1" />
      </div>
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-32 bg-white/5 rounded-xl" />
      ))}
    </div>
  );
}
