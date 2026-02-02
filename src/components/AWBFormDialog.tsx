import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type AWBType = 'return' | 'exchange';

interface AWBFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (awb: string) => Promise<void>;
  orderId: string;
  awbType: AWBType;
  isLoading?: boolean;
}

export function AWBFormDialog({
  open,
  onOpenChange,
  onSubmit,
  orderId,
  awbType,
  isLoading = false,
}: AWBFormDialogProps) {
  const [awb, setAwb] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awb.trim()) return;
    
    await onSubmit(awb.trim());
    setAwb("");
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      setAwb("");
      onOpenChange(false);
    }
  };

  const getTitle = () => {
    return awbType === 'return' ? 'Add Return AWB' : 'Add Exchange AWB';
  };

  const getDescription = () => {
    const action = awbType === 'return' ? 'return' : 'exchange';
    return `Enter the Air Waybill number for the ${action} shipment of Order ${orderId}.`;
  };

  const getButtonText = () => {
    return awbType === 'return' ? 'Approve & Add AWB' : 'Complete Exchange & Add AWB';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="awb" className="text-right">
                AWB Number
              </Label>
              <Input
                id="awb"
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                className="col-span-3"
                placeholder="Enter AWB number"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!awb.trim() || isLoading}>
              {isLoading ? "Processing..." : getButtonText()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
