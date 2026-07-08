import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { History, Coins, Calendar, FileText, Download, ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/settings/payments')({
  component: PurchaseHistoryPage,
});

interface PurchaseRecord {
  id: string;
  product_name: string;
  product_type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  created_at: string;
  completed_at?: string;
  payment_id: string;
  invoice_url?: string;
}

function PurchaseHistoryPage() {
  const { isAuthenticated } = useAuthStore();

  // Fetch purchase history
  const { data: purchases, isLoading, error, refetch } = useQuery<PurchaseRecord[]>({
    queryKey: ['purchase-history'],
    queryFn: () => apiClient<PurchaseRecord[]>('/payments/history'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your purchase history.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <PurchaseSkeleton />;
  }

  if (error || !purchases) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
          <p className="text-on-surface-variant text-sm">Failed to load purchase history.</p>
          <Button onClick={() => refetch()} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </Link>
          <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
            <History className="w-6 h-6 text-tertiary" />
            Purchase History
          </h1>
        </div>
        <Card className="p-12 text-center">
          <Coins className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-on-surface-variant">No purchases yet.</p>
          <p className="text-on-surface-variant/60 text-sm mt-2">Visit the shop to buy chips or subscriptions.</p>
          <Link to="/shop" className="mt-4 inline-block">
            <Button className="bg-tertiary text-on-tertiary hover:bg-tertiary/80">Go to Shop</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
          <History className="w-6 h-6 text-tertiary" />
          Purchase History
        </h1>
        <span className="text-sm text-on-surface-variant ml-auto">{purchases.length} purchases</span>
      </div>

      <div className="space-y-4">
        {purchases.map((purchase) => {
          const statusColors = {
            succeeded: 'bg-green-500/20 text-green-400 border-green-500/30',
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            failed: 'bg-red-500/20 text-red-400 border-red-500/30',
            expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          };

          const statusLabel = purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1);

          return (
            <Card key={purchase.id} className="p-4 bg-white/5 border-white/10 hover:border-tertiary/30 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-on-surface">{purchase.product_name}</h3>
                    <Badge variant="outline" className="text-[10px] border-white/20 text-on-surface-variant">
                      {purchase.product_type.replace(/_/g, ' ')}
                    </Badge>
                    <Badge className={cn('text-[10px]', statusColors[purchase.status])}>
                      {statusLabel}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-1 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(purchase.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {purchase.amount} {purchase.currency}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/50">
                      ID: {purchase.payment_id.slice(0, 8)}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex gap-2">
                  {purchase.invoice_url && (
                    <a
                      href={purchase.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tertiary hover:text-tertiary/80 text-sm flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      Invoice
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PurchaseSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 bg-white/5 rounded-lg" />
        <Skeleton className="h-8 w-48 bg-white/5" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
