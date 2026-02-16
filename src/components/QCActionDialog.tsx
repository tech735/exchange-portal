import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface QCActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (decision: 'APPROVED' | 'DENIED', notes: string) => Promise<void>;
    title: string;
    actionType: 'APPROVE' | 'DENY';
    isLoading?: boolean;
}

export function QCActionDialog({
    open,
    onOpenChange,
    onSubmit,
    title,
    actionType,
    isLoading
}: QCActionDialogProps) {
    const [notes, setNotes] = useState('');

    const handleSubmit = async () => {
        if (actionType === 'DENY' && !notes.trim()) {
            return; // Notes mandatory for denial
        }

        try {
            await onSubmit(actionType === 'APPROVE' ? 'APPROVED' : 'DENIED', notes);
            setNotes('');
            onOpenChange(false);
        } catch (error) {
            // Error handled by parent
            console.error('QC Action failed', error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {actionType === 'APPROVE'
                            ? 'Are you sure you want to approve the return quality?'
                            : 'Please provide a reason for denying the return.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="notes">
                            {actionType === 'APPROVE' ? 'QC Notes (Optional)' : 'Reason for Denial (Required)'}
                        </Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={actionType === 'APPROVE' ? 'e.g., Condition is good...' : 'e.g., Item used, tags missing...'}
                        // Notes required for denial, optional for approval
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant={actionType === 'DENY' ? 'destructive' : 'default'}
                        disabled={(actionType === 'DENY' && !notes.trim()) || isLoading}
                    >
                        {isLoading ? 'Processing...' : (actionType === 'APPROVE' ? 'Approve Return' : 'Deny Return')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
