import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react';
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
    <div className="card-base">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Product Catalogue</h3>
          <p className="text-xs text-muted-foreground">Sync from Shopify store</p>
        </div>
      </div>

      {lastResult && (
        <div className="mb-3 rounded-lg bg-muted/50 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{lastResult.synced} products synced</span>
          </div>
          {lastResult.deactivated > 0 && (
            <div className="flex items-center gap-1.5 text-warning">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{lastResult.deactivated} stale products deactivated</span>
            </div>
          )}
          {lastResult.errors > 0 && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{lastResult.errors} errors</span>
            </div>
          )}
        </div>
      )}

      <Button
        id="sync-products-button"
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full rounded-full"
        variant="outline"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing Products...' : 'Sync Products from Shopify'}
      </Button>
    </div>
  );
}
