import { useMemo, useState } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Package, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';
import type { ProductCatalog, TicketItem } from '@/types/database';
import { cn } from '@/lib/utils';

export interface SizeOption { size: string; sku: string; stock: number | null; price: number | null }

/** Sizes for a catalogue product, with stock and price per variant SKU. */
export function sizesFor(p: ProductCatalog | undefined | null): SizeOption[] {
  if (!p) return [];
  return (p.variants || []).map((size, i) => {
    const sku = p.variant_skus?.[i] || '';
    const stock = sku && p.variant_inventory && sku in p.variant_inventory ? Number(p.variant_inventory[sku]) : null;
    const price = sku && p.variant_prices && sku in p.variant_prices ? Number(p.variant_prices[sku]) : (p.price ?? null);
    return { size, sku, stock, price };
  });
}

/** Find the catalogue product that a Shopify line item (variant SKU) belongs to. */
export function productForSku(products: ProductCatalog[], sku: string | undefined | null) {
  if (!sku) return undefined;
  return products.find((p) => p.sku === sku || p.variant_skus?.includes(sku));
}

/** Size chips with stock. Out-of-stock sizes are disabled; `current` marks the size being returned. */
export function SizeChips({ product, value, current, onChange }: { product: ProductCatalog | undefined; value?: string; current?: string; onChange: (o: SizeOption) => void }) {
  const sizes = sizesFor(product);
  if (!product) return <p className="text-sm text-muted-foreground">Product not found in the catalogue. Pick one below.</p>;
  if (sizes.length === 0) return <p className="text-sm text-muted-foreground">This product has no sizes in the catalogue.</p>;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
      {sizes.map((o) => {
        const out = o.stock !== null && o.stock <= 0;
        const on = value === o.size;
        const isCurrent = current === o.size;
        return (
          <button
            key={o.size}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={out}
            onClick={() => onChange(o)}
            className={cn(
              'min-w-[64px] rounded-lg border px-3 py-1.5 text-center transition-all duration-150 active:scale-[0.97]',
              on && 'border-primary bg-accent text-accent-foreground ring-[3px] ring-primary/10',
              !on && !out && 'border-input bg-card hover:border-primary/50',
              out && 'cursor-not-allowed border-transparent bg-muted text-faint line-through decoration-faint/60',
            )}
          >
            <span className="block text-sm font-semibold">{o.size}</span>
            <span className={cn('block text-[11px]', on ? 'text-primary' : 'text-muted-foreground', out && 'no-underline')}>
              {out ? 'Sold out' : isCurrent ? 'Current' : o.stock === null ? 'Stock ?' : `${o.stock} left`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Searchable product combobox → returns a catalogue product. */
export function ProductCombobox({ value, onChange, placeholder = 'Search product or SKU…' }: { value?: ProductCatalog; onChange: (p: ProductCatalog) => void; placeholder?: string }) {
  const { data: products = [], isLoading } = useProducts();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? products.filter((p) => [p.product_name, p.sku, ...(p.school_tags || [])].some((v) => v && v.toLowerCase().includes(s))) : products;
    return base.slice(0, 50);
  }, [products, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('flex min-w-0 items-center gap-2', !value && 'text-faint')}>
            <Package className="size-4 shrink-0 text-faint" />
            <span className="truncate">{value ? value.product_name : placeholder}</span>
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-overlay" align="start">
        <CommandPrimitive shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-faint" />
            <CommandPrimitive.Input value={q} onValueChange={setQ} placeholder={placeholder} className="h-10 w-full bg-transparent text-base md:text-sm outline-none placeholder:text-faint" />
          </div>
          <CommandPrimitive.List className="max-h-72 overflow-y-auto p-1">
            {isLoading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading catalogue…</p>}
            <CommandPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No products found.</CommandPrimitive.Empty>
            {list.map((p) => (
              <CommandPrimitive.Item key={p.id} value={p.id} onSelect={() => { onChange(p); setOpen(false); setQ(''); }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.sku} · {(p.variants || []).length} sizes</p>
                </div>
                {value?.id === p.id && <Check className="size-4 text-primary" />}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}

export function toTicketItem(p: ProductCatalog, o: SizeOption, qty: number): TicketItem {
  return { sku: o.sku || p.sku, product_name: p.product_name, size: o.size, qty, ...(o.price !== null ? { price: o.price } : {}) };
}
