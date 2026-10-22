import type { ProductCatalog, Ticket, TicketItem } from '@/types/database';

export interface DescribedItem {
  /** Product name without the variant suffix, e.g. "SNS Track Pant". */
  name: string;
  /** Variant / size, e.g. "Unisex / 24×33"; '' when unknown. */
  variant: string;
  sku: string;
  qty: number;
  image: string | null;
}

const EMPTY_VARIANTS = new Set(['', 'standard', 'default title', 'n/a', 'na', '-', '—', 'none']);
const norm = (s: string) => s.toLowerCase().replace(/[\s×x*]+/g, '');

function findProduct(products: ProductCatalog[] | undefined, sku: string, name: string) {
  if (!products?.length) return undefined;
  if (sku) {
    const bySku = products.find((p) => p.variant_skus?.includes(sku)) ?? products.find((p) => p.sku === sku);
    if (bySku) return bySku;
  }
  const n = norm(name);
  return n ? products.find((p) => norm(p.product_name) === n) : undefined;
}

/**
 * Clean, consistent label for a ticket item. Shopify-created items store the
 * variant inside the name ("SNS Track Pant - Unisex / 24×33") and some older
 * items have no size at all; the catalogue (by SKU) fills the gaps.
 */
export function describeItem(item: TicketItem, products?: ProductCatalog[]): DescribedItem {
  let name = (item.product_name || '').trim();
  let variant = (item.size || '').trim();
  if (EMPTY_VARIANTS.has(variant.toLowerCase())) variant = '';

  const m = name.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (m && (!variant || norm(m[2]) === norm(variant) || m[2].includes('/'))) {
    name = m[1].trim();
    if (!variant) variant = m[2].trim();
  }

  const p = findProduct(products, item.sku, name);
  let image: string | null = null;
  if (p) {
    const idx = item.sku ? (p.variant_skus ?? []).indexOf(item.sku) : -1;
    if (!variant && idx >= 0) variant = p.variants?.[idx] ?? '';
    if (!name) name = p.product_name;
    image = (item.sku && p.variant_images?.[item.sku]) || p.image_url || null;
  }
  if (EMPTY_VARIANTS.has(variant.toLowerCase())) variant = '';

  return { name: name || item.sku || 'Item', variant, sku: item.sku, qty: item.qty || 1, image };
}

/** Drop leading variant segments both sides share: "Unisex / 24×33" vs "Unisex / 26×35" → "24×33" / "26×35". */
function trimShared(a: string, b: string): [string, string] {
  const pa = a.split(' / '), pb = b.split(' / ');
  let i = 0;
  while (i < pa.length - 1 && i < pb.length - 1 && pa[i] === pb[i]) i++;
  return [pa.slice(i).join(' / '), pb.slice(i).join(' / ')];
}

export interface ItemSwap {
  /** Main line, e.g. "SNS Track Pant" or "Track Pant → House T-shirt". */
  title: string;
  /** Second line, e.g. "24×33 → 26×35". */
  detail: string;
  /** Extra items beyond the first pair. */
  more: number;
  returnItem?: DescribedItem;
  exchangeItem?: DescribedItem;
}

export function describeSwap(t: Pick<Ticket, 'return_items' | 'exchange_items'>, products?: ProductCatalog[]): ItemSwap {
  const r = t.return_items?.[0] ? describeItem(t.return_items[0], products) : undefined;
  const e = t.exchange_items?.[0] ? describeItem(t.exchange_items[0], products) : undefined;
  const more = Math.max(t.return_items?.length || 0, t.exchange_items?.length || 0) - 1;
  const sizeOf = (v: string) => v || 'size not recorded';

  if (r && e) {
    const same = norm(r.name) === norm(e.name);
    const [rv, ev] = trimShared(r.variant, e.variant);
    if (same) {
      const detail = r.variant && e.variant && r.variant === e.variant ? `Same size · ${r.variant}` : `${sizeOf(rv)} → ${sizeOf(ev)}`;
      return { title: r.name, detail, more, returnItem: r, exchangeItem: e };
    }
    return { title: `${r.name} → ${e.name}`, detail: [r.variant, e.variant].every(Boolean) ? `${rv} → ${ev}` : [r.variant, e.variant].filter(Boolean).join(' → ') || 'sizes not recorded', more, returnItem: r, exchangeItem: e };
  }
  if (r) return { title: r.name, detail: `${r.variant ? `${r.variant} · ` : ''}no replacement chosen`, more, returnItem: r };
  if (e) return { title: e.name, detail: `Send ${e.variant || 'item'} · nothing coming back`, more, exchangeItem: e };
  return { title: 'No items listed', detail: '', more: 0 };
}

/** One-line version for compact places (cards, queues, search results). */
export function swapText(t: Pick<Ticket, 'return_items' | 'exchange_items'>, products?: ProductCatalog[]) {
  const s = describeSwap(t, products);
  return [s.title, s.detail].filter(Boolean).join(' · ') + (s.more > 0 ? ` · +${s.more} more` : '');
}

/** Phone numbers stored as "N/A" or blank show as nothing. */
export function displayPhone(p?: string | null) {
  const v = (p || '').trim();
  return EMPTY_VARIANTS.has(v.toLowerCase()) ? '' : v;
}
