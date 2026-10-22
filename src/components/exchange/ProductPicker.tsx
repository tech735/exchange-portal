import { useEffect, useMemo, useState } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Package, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';
import type { ProductCatalog, TicketItem } from '@/types/database';
import { cn } from '@/lib/utils';
import { ProductThumb } from '@/components/app';

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

const COLOURS = /^(red|blue|green|yellow|white|black|grey|gray|navy|maroon|orange|pink|purple|brown|beige|cream|sky|olive)\b/i;
const FITS = /^(male|female|unisex|boys?|girls?|men|women|kids?)$/i;
const LOW_STOCK = 3;

function groupLabel(groups: string[]) {
  if (groups.some((g) => COLOURS.test(g))) return 'Colour';
  if (groups.some((g) => FITS.test(g))) return 'Fit';
  return 'Style';
}

/**
 * Size picker. Single-part variants ("28×40") show one row of chips.
 * Two-part variants ("Red / 10-12Y", "Female / M") split into two short steps:
 * pick the colour / fit first (pre-selected to match the returned item), then
 * only that group's sizes, so staff never scan 40+ chips.
 */
export function SizeChips({ product, value, current, onChange }: { product: ProductCatalog | undefined; value?: string; current?: string; onChange: (o: SizeOption) => void }) {
  const sizes = sizesFor(product);
  const parts = sizes.map((o) => o.size.split(' / '));
  const grouped = sizes.length > 0 && parts.every((p) => p.length >= 2);
  const groups = grouped ? [...new Set(parts.map((p) => p[0]))] : [];
  const inStock = (o: SizeOption) => o.stock === null || o.stock > 0;
  const initialGroup = () => {
    const from = (value || current || '').split(' / ')[0];
    if (groups.includes(from)) return from;
    return groups.find((g) => sizes.some((o, i) => parts[i][0] === g && inStock(o))) ?? groups[0];
  };
  const [group, setGroup] = useState<string | undefined>(initialGroup);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setGroup(initialGroup()); }, [product?.id]);

  if (!product) return <p className="text-sm text-muted-foreground">Product not found in the catalogue. Use “Change product” to pick one.</p>;
  if (sizes.length === 0) return <p className="text-sm text-muted-foreground">This product has no sizes in the catalogue.</p>;

  const visible = sizes.map((o, i) => ({ o, label: grouped ? parts[i].slice(1).join(' / ') : o.size, g: grouped ? parts[i][0] : '' }))
    .filter((x) => !grouped || x.g === group);
  const selected = sizes.find((o) => o.size === value);

  return (
    <div className="space-y-3">
      {grouped && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{groupLabel(groups)}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={groupLabel(groups)}>
            {groups.map((g) => {
              const available = sizes.filter((o, i) => parts[i][0] === g && inStock(o)).length;
              const on = g === group;
              return (
                <button key={g} type="button" role="radio" aria-checked={on} onClick={() => setGroup(g)}
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]',
                    on ? 'border-primary bg-primary text-primary-foreground' : available ? 'border-input bg-card hover:border-primary/50' : 'border-transparent bg-muted text-faint')}>
                  {g}
                  {!available && <span className="text-[11px] font-normal">· sold out</span>}
                  {current?.split(' / ')[0] === g && <span className={cn('text-[11px] font-normal', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>· current</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {grouped && <p className="text-xs font-medium text-muted-foreground">Size</p>}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
          {visible.map(({ o, label }) => {
            const out = !inStock(o);
            const on = value === o.size;
            const isCurrent = current === o.size;
            const low = !out && o.stock !== null && o.stock <= LOW_STOCK;
            return (
              <button key={o.size} type="button" role="radio" aria-checked={on} disabled={out} onClick={() => onChange(o)}
                title={out ? 'Sold out' : o.stock === null ? 'Stock unknown' : `${o.stock} in stock`}
                className={cn('relative inline-flex h-9 min-w-[52px] items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]',
                  on && 'border-primary bg-accent text-accent-foreground ring-[3px] ring-primary/10',
                  !on && !out && 'border-input bg-card hover:border-primary/50',
                  isCurrent && !on && 'border-dashed',
                  out && 'cursor-not-allowed border-transparent bg-muted text-faint line-through decoration-faint/60')}>
                {label}
                {low && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {selected
          ? <>Selected <span className="font-medium text-foreground">{selected.size}</span> · {selected.stock === null ? 'stock unknown' : `${selected.stock} in stock`}</>
          : <>Pick a size. <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-warning" /> {LOW_STOCK} or fewer left</span>{current ? ' · dashed = current size' : ''}</>}
      </p>
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
                <ProductThumb src={p.image_url} alt={p.product_name} size={32} />
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
