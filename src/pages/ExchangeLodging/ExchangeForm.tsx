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
import { useProducts } from '@/hooks/useProducts';
import { ItemSelector } from './ItemSelector';

// Mock products for testing
const MOCK_PRODUCTS = [
  { id: '1', sku: 'SHIRT-WHT-001', product_name: 'White School Shirt', variants: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '2', sku: 'PANT-NVY-001', product_name: 'Navy Blue Trousers', variants: ['24', '26', '28', '30', '32', '34', '36'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '3', sku: 'SKIRT-NVY-001', product_name: 'Navy Blue Skirt', variants: ['XS', 'S', 'M', 'L', 'XL'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '4', sku: 'BLZR-NVY-001', product_name: 'Navy Blue Blazer', variants: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '5', sku: 'SHOE-BLK-001', product_name: 'Black School Shoes', variants: ['3', '4', '5', '6', '7', '8', '9', '10'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '6', sku: 'SOCK-WHT-001', product_name: 'White School Socks (Pack of 3)', variants: ['S', 'M', 'L'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '7', sku: 'TIE-STR-001', product_name: 'Striped School Tie', variants: ['Standard'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '8', sku: 'BELT-BLK-001', product_name: 'Black Leather Belt', variants: ['S', 'M', 'L', 'XL'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '9', sku: 'BAG-NVY-001', product_name: 'Navy School Backpack', variants: ['Standard'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
  { id: '10', sku: 'SPORT-WHT-001', product_name: 'White Sports T-Shirt', variants: ['XS', 'S', 'M', 'L', 'XL'], school_tags: ['All Schools'], active: true, created_at: new Date().toISOString() },
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
    reason_code: '' as ReasonCode,
    reason_notes: '',
    notes: '',
  });
  const [returnItems, setReturnItems] = useState<TicketItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<TicketItem[]>([]);
  const [returnSearch, setReturnSearch] = useState('');
  const [exchangeSearch, setExchangeSearch] = useState('');
  // Fetch all products by not providing search parameter
  const { data: allProducts, isLoading: productsLoading } = useProducts();
  const createTicket = useCreateTicket();
  const { toast } = useToast();

  // Use fetched products or fallback to mock products for testing
  const products = Array.isArray(allProducts) && allProducts.length > 0 
    ? allProducts 
    : MOCK_PRODUCTS;

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
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast({ 
        title: 'Error', 
        description: error?.message || 'Failed to create ticket', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Student Name</Label><Input value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Grade</Label><Input value={formData.student_grade} onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })} /></div>
        <div className="space-y-2"><Label>Section</Label><Input value={formData.student_section} onChange={(e) => setFormData({ ...formData, student_section: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <Label>Reason for Exchange *</Label>
        <Select value={formData.reason_code} onValueChange={(v) => setFormData({ ...formData, reason_code: v as ReasonCode })}>
          <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
          <SelectContent>{Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Reason Notes</Label><Textarea value={formData.reason_notes} onChange={(e) => setFormData({ ...formData, reason_notes: e.target.value })} /></div>

      <ItemSelector title="Return Items" items={returnItems} onRemove={(i) => removeItem('return', i)} onAdd={(p, s, q) => addItem('return', p, s, q)} products={products} search={returnSearch} onSearch={setReturnSearch} />
      <ItemSelector title="Exchange Items" items={exchangeItems} onRemove={(i) => removeItem('exchange', i)} onAdd={(p, s, q) => addItem('exchange', p, s, q)} products={products} search={exchangeSearch} onSearch={setExchangeSearch} />

      <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
      <Button type="submit" className="w-full" disabled={createTicket.isPending}>{createTicket.isPending ? 'Creating...' : 'Create Exchange Ticket'}</Button>
    </form>
  );
}
