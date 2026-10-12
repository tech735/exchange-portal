import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useDeleteSpecialCase, useSaveSpecialCase } from '@/hooks/useShipments';
import { toDateInput } from '@/lib/shipmentTracking';
import { SPECIAL_CASE_TYPE_LABELS, type SpecialCase, type SpecialCaseStatus, type SpecialCaseType } from '@/types/database';

interface FormValues {
  order_name: string;
  case_type: SpecialCaseType;
  issue: string;
  action_taken: string;
  awb_number: string;
  latest_update: string;
  status: SpecialCaseStatus;
  resolved_on: string;
}

const initialValues = (c?: SpecialCase | null): FormValues => ({
  order_name: c?.order_name ?? '',
  case_type: c?.case_type ?? 'OTHER',
  issue: c?.issue ?? '',
  action_taken: c?.action_taken ?? '',
  awb_number: c?.awb_number ?? '',
  latest_update: c?.latest_update ?? '',
  status: c?.status ?? 'OPEN',
  resolved_on: c?.resolved_on ?? '',
});

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SpecialCaseForm({ specialCase, onDone }: { specialCase: SpecialCase | null; onDone: () => void }) {
  const { toast } = useToast();
  const { user } = useUser();
  const saveCase = useSaveSpecialCase();
  const deleteCase = useDeleteSpecialCase();
  const [values, setValues] = useState(() => initialValues(specialCase));

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Resolving a case dates it today; editable afterwards.
  const setStatus = (status: SpecialCaseStatus) =>
    setValues((prev) => ({
      ...prev,
      status,
      resolved_on: status === 'RESOLVED' ? prev.resolved_on || toDateInput(new Date()) : '',
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCase.mutate(
      {
        id: specialCase?.id,
        values: {
          order_name: values.order_name.trim(),
          case_type: values.case_type,
          issue: values.issue.trim(),
          action_taken: orNull(values.action_taken),
          awb_number: orNull(values.awb_number),
          latest_update: orNull(values.latest_update),
          status: values.status,
          resolved_on: values.status === 'RESOLVED' ? orNull(values.resolved_on) : null,
          updated_by: user?.name ?? null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: specialCase ? 'Case updated' : 'Case logged', description: values.order_name.trim() });
          onDone();
        },
        onError: (error: Error) => toast({ title: 'Could not save the case', description: error.message, variant: 'destructive' }),
      }
    );
  };

  const handleDelete = () => {
    if (!specialCase || !window.confirm(`Delete the case for ${specialCase.order_name}? This cannot be undone.`)) return;
    deleteCase.mutate(specialCase.id, {
      onSuccess: () => {
        toast({ title: 'Case deleted', description: specialCase.order_name });
        onDone();
      },
      onError: (error: Error) => toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }),
    });
  };

  const busy = saveCase.isPending || deleteCase.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Order no." htmlFor="case-order">
          <Input id="case-order" required value={values.order_name} onChange={(e) => set('order_name', e.target.value)} placeholder="K-2627-3232-R1" />
        </Field>
        <Field label="Type" htmlFor="case-type">
          <Select value={values.case_type} onValueChange={(v) => set('case_type', v as SpecialCaseType)}>
            <SelectTrigger id="case-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SPECIAL_CASE_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Issue / current status" htmlFor="case-issue">
        <Textarea id="case-issue" required rows={3} value={values.issue} onChange={(e) => set('issue', e.target.value)} placeholder="e.g. Waiting for RTO from Shiprocket – pincode not deliverable" />
      </Field>
      <Field label="Action taken / exchange details" htmlFor="case-action">
        <Textarea id="case-action" rows={3} value={values.action_taken} onChange={(e) => set('action_taken', e.target.value)} placeholder="e.g. Exchange sent by Porter" />
      </Field>
      <Field label="AWB no." htmlFor="case-awb">
        <Input id="case-awb" value={values.awb_number} onChange={(e) => set('awb_number', e.target.value)} />
      </Field>
      <Field label="Latest update" htmlFor="case-update">
        <Textarea id="case-update" rows={2} value={values.latest_update} onChange={(e) => set('latest_update', e.target.value)} placeholder="e.g. Pickup done on 08/10/2026" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Case status" htmlFor="case-status">
          <Select value={values.status} onValueChange={(v) => setStatus(v as SpecialCaseStatus)}>
            <SelectTrigger id="case-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {values.status === 'RESOLVED' && (
          <Field label="Resolved on" htmlFor="case-resolved">
            <Input id="case-resolved" type="date" value={values.resolved_on} onChange={(e) => set('resolved_on', e.target.value)} />
          </Field>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          {specialCase &&
            `Updated ${format(parseISO(specialCase.updated_at), 'd MMM, h:mm a')}${specialCase.updated_by ? ` by ${specialCase.updated_by}` : ''}`}
        </div>
        <div className="flex gap-2">
          {specialCase && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {saveCase.isPending ? 'Saving…' : specialCase ? 'Save changes' : 'Log case'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Side panel to log a new special case (`specialCase` null) or edit one. */
export function SpecialCaseSheet({
  open,
  specialCase,
  onOpenChange,
}: {
  open: boolean;
  specialCase: SpecialCase | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{specialCase ? specialCase.order_name : 'Log a case'}</SheetTitle>
          <SheetDescription>Exchanges, returns, RTOs or anything else that needs special handling.</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {open && <SpecialCaseForm key={specialCase?.id ?? 'new'} specialCase={specialCase} onDone={() => onOpenChange(false)} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
