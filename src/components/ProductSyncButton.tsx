import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shopifyService } from '@/services/shopify';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';

export function ProductSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    synced: number;
    deactivated: number;
    errors: number;
  } | null>(null);
  const { toast } = useToast();
  const { user, hasFullAccess } = useUser();
  const queryClient = useQueryClient();

  // Only show for ADMIN users
  if (user?.role !== 'ADMIN' && !hasFullAccess()) {
    return null;
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setLastResult(null);

    try {
      const result = await shopifyService.syncProducts();
      setLastResult({
        synced: result.synced,
        deactivated: result.deactivated,
        errors: result.errors,
      });

      // Invalidate product-related queries so the UI refreshes
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-prices'] });

      toast({
        title: 'Product Sync Complete',
        description: `Synced ${result.synced} products from ${result.totalShopifyProducts} Shopify products.${
          result.deactivated > 0 ? ` ${result.deactivated} stale products deactivated.` : ''
        }${result.errors > 0 ? ` ${result.errors} errors occurred.` : ''}`,
        variant: result.errors > 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Sync Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
      <Button id="sync-products-button" variant="secondary" onClick={handleSync} disabled={isSyncing}>
        <RefreshCw className={isSyncing ? 'animate-spin' : undefined} />
        {isSyncing ? 'Syncing products…' : 'Sync from Shopify'}
      </Button>
      {lastResult && (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" />{lastResult.synced} synced</span>
          {lastResult.deactivated > 0 && (
            <span className="inline-flex items-center gap-1 text-warning"><AlertCircle className="size-3.5" />{lastResult.deactivated} deactivated</span>
          )}
          {lastResult.errors > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="size-3.5" />{lastResult.errors} errors</span>
          )}
        </p>
      )}
    </div>
  );
}
