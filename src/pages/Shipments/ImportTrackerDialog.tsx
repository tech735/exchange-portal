import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useImportTracker } from '@/hooks/useShipments';

// Moves the old Google Sheet (File → Download → CSV of the "Order Tracker"
// tab) and past Shopify orders into the tracker.
export function ImportTrackerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const importTracker = useImportTracker();
  const [file, setFile] = useState<File | null>(null);
  const [backfill, setBackfill] = useState(true);
  const [backfillDays, setBackfillDays] = useState('90');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    importTracker.mutate(
      { csv: await file.text(), backfillDays: backfill ? Number(backfillDays) : null },
      {
        onSuccess: (result) => {
          toast({
            title: 'Tracker imported',
            description: `${result.rows} sheet rows · ${result.matched} matched to Shopify orders · ${result.created} added`,
          });
          setFile(null);
          onOpenChange(false);
        },
        onError: (error: Error) => toast({ title: 'Import failed', description: error.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import past orders</DialogTitle>
          <DialogDescription>
            Brings in the old Order Tracker sheet: pickup and delivered dates, who was notified, and notes.
            Safe to run more than once — nothing is duplicated and no status moves backwards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="tracker-csv" className="text-[13px] font-medium text-foreground">
              Order Tracker sheet (in Google Sheets: File → Download → .csv)
            </Label>
            <Input id="tracker-csv" type="file" accept=".csv,text/csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-2">
            <label htmlFor="tracker-backfill" className="flex items-center gap-2 text-sm">
              <Checkbox id="tracker-backfill" checked={backfill} onCheckedChange={(c) => setBackfill(c === true)} />
              First pull Shopify orders from the last
            </label>
            {backfill && (
              <Select value={backfillDays} onValueChange={setBackfillDays}>
                <SelectTrigger className="w-40 ml-6"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!file || importTracker.isPending}>
              {importTracker.isPending ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
