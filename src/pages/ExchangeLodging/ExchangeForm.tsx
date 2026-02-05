import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { REASON_LABELS, type ReasonCode, type TicketItem } from '@/types/database';
import { useCreateTicket } from '@/hooks/useTickets';
import { ImprovedItemSelector } from './ImprovedItemSelector';

// Mock schools for dropdown
const MOCK_SCHOOLS = [
  { id: '1', name: 'Shiv Nadar School', type: 'regular' },
  { id: '2', name: 'The Knowledge Habitat School', type: 'regular' },
];

interface ExchangeFormProps {
  onSuccess: () => void;
}

export function ExchangeForm({ onSuccess }: ExchangeFormProps) {
  const [formData, setFormData] = useState({
    order_id: '',
    customer_name: '',
    customer_phone: '',
    student_name: '',
    student_grade: '',
    student_section: '',
    school_name: '',
    reason_code: '' as ReasonCode,
    reason_notes: '',
    notes: '',
  });
  const [returnItems, setReturnItems] = useState<TicketItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<TicketItem[]>([]);
  const createTicket = useCreateTicket();
  const { toast } = useToast();

  const addItem = (list: 'return' | 'exchange', product: { sku: string; product_name: string }, size: string, qty: number) => {
    const item: TicketItem = { sku: product.sku, product_name: product.product_name, size, qty };
    if (list === 'return') {
      setReturnItems([...returnItems, item]);
    } else {
      setExchangeItems([...exchangeItems, item]);
    }
  };

  const removeItem = (list: 'return' | 'exchange', index: number) => {
    if (list === 'return') setReturnItems(returnItems.filter((_, i) => i !== index));
    else setExchangeItems(exchangeItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.order_id || !formData.customer_name || !formData.customer_phone || !formData.reason_code) {
      toast({ title: 'Error', description: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    if (returnItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one return item', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...formData, return_items: returnItems, exchange_items: exchangeItems };
      console.log('Creating ticket with payload:', payload);
      await createTicket.mutateAsync(payload);
      toast({ title: 'Success', description: 'Exchange ticket created' });
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating ticket:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to create ticket', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Order ID *</Label>
          <Input value={formData.order_id} onChange={(e) => setFormData({ ...formData, order_id: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Customer Phone *</Label>
          <Input value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Customer Name *</Label>
        <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Student Name</Label><Input value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Grade</Label><Input value={formData.student_grade} onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })} /></div>
        <div className="space-y-2"><Label>Section</Label><Input value={formData.student_section} onChange={(e) => setFormData({ ...formData, student_section: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <Label>School *</Label>
        <Select value={formData.school_name} onValueChange={(v) => setFormData({ ...formData, school_name: v })}>
          <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
          <SelectContent>
            {MOCK_SCHOOLS.map((school) => (
              <SelectItem key={school.id} value={school.name}>
                {school.name}
                {school.type === 'knowledge' && (
                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Knowledge</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Reason for Exchange *</Label>
        <Select value={formData.reason_code} onValueChange={(v) => setFormData({ ...formData, reason_code: v as ReasonCode })}>
          <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
          <SelectContent>{Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Reason Notes</Label><Textarea value={formData.reason_notes} onChange={(e) => setFormData({ ...formData, reason_notes: e.target.value })} /></div>

      <ImprovedItemSelector title="Return Line Items" items={returnItems} onRemove={(i) => removeItem('return', i)} onAdd={(p, s, q) => addItem('return', p, s, q)} />
      <ImprovedItemSelector title="Exchange Deliverables" items={exchangeItems} onRemove={(i) => removeItem('exchange', i)} onAdd={(p, s, q) => addItem('exchange', p, s, q)} />

      <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
      <Button type="submit" className="w-full" disabled={createTicket.isPending}>{createTicket.isPending ? 'Creating...' : 'Create Exchange Ticket'}</Button>
    </form>
  );
}
