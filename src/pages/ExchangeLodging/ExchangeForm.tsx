import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown } from 'lucide-react';
import { REASON_LABELS, type ReasonCode, type TicketItem, type ProductCatalog } from '@/types/database';
import { useCreateTicket } from '@/hooks/useTickets';
import { ImprovedItemSelector } from './ImprovedItemSelector';
import { useProductPrices } from '@/hooks/useProductPrices';

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
    customer_email: '',
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
  const { data: productPrices } = useProductPrices();
  const { toast } = useToast();

  const addItem = (list: 'return' | 'exchange', product: ProductCatalog, size: string, qty: number) => {
    // Determine the actual SKU to save (variant SKU if available, otherwise base SKU)
    let itemSku = product.sku;
    
    if (product.variants && product.variant_skus) {
      const sizeIndex = product.variants.indexOf(size);
      if (sizeIndex !== -1 && product.variant_skus[sizeIndex]) {
        itemSku = product.variant_skus[sizeIndex];
      }
    }

    const price = productPrices?.[itemSku];
    const item: TicketItem = { 
      sku: itemSku, 
      product_name: product.product_name, 
      size, 
      qty,
      price 
    };
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Customer Name *</Label>
          <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Customer Email</Label>
          <Input type="email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Student Name</Label><Input value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Grade</Label><Input value={formData.student_grade} onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })} /></div>
        <div className="space-y-2"><Label>Section</Label><Input value={formData.student_section} onChange={(e) => setFormData({ ...formData, student_section: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <Label>School *</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              <span>{formData.school_name || 'Select school'}</span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
            {MOCK_SCHOOLS.map((school) => (
              <DropdownMenuItem
                key={school.id}
                onSelect={() => setFormData({ ...formData, school_name: school.name })}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                {school.name}
                {school.type === 'knowledge' && (
                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Knowledge</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-2">
        <Label>Reason for Exchange *</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              <span>{formData.reason_code ? REASON_LABELS[formData.reason_code] : 'Select reason'}</span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <DropdownMenuItem
                key={k}
                onSelect={() => setFormData({ ...formData, reason_code: k as ReasonCode })}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                {v}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-2"><Label>Reason Notes</Label><Textarea value={formData.reason_notes} onChange={(e) => setFormData({ ...formData, reason_notes: e.target.value })} /></div>

      <ImprovedItemSelector title="Return Line Items" items={returnItems} onRemove={(i) => removeItem('return', i)} onAdd={(p, s, q) => addItem('return', p, s, q)} />
      <ImprovedItemSelector title="Exchange Deliverables" items={exchangeItems} filterOutOfStock={true} onRemove={(i) => removeItem('exchange', i)} onAdd={(p, s, q) => addItem('exchange', p, s, q)} />

      <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
      <Button type="submit" className="w-full" disabled={createTicket.isPending}>{createTicket.isPending ? 'Creating...' : 'Create Exchange Ticket'}</Button>
    </form>
  );
}
