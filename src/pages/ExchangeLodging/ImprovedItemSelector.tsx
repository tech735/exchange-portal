import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Trash2, Plus, ChevronDown } from 'lucide-react';
import { type TicketItem, type ProductCatalog } from '@/types/database';
import { useProducts } from '@/hooks/useProducts';

interface ImprovedItemSelectorProps {
  title: string;
  items: TicketItem[];
  onRemove: (index: number) => void;
  onAdd: (product: ProductCatalog, size: string, qty: number) => void;
  filterOutOfStock?: boolean;
}

export function ImprovedItemSelector({
  title,
  items,
  onRemove,
  onAdd,
  filterOutOfStock = false,
}: ImprovedItemSelectorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductSku, setSelectedProductSku] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: products } = useProducts();
  const validProducts = Array.isArray(products) ? products : [];
  
  const selectedProduct = selectedProductSku 
    ? validProducts.find(p => p.sku === selectedProductSku) || null 
    : null;

  const filteredProducts = validProducts.filter(product => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      product.sku.toLowerCase().includes(searchLower) ||
      product.product_name.toLowerCase().includes(searchLower) ||
      (product.school_tags && product.school_tags.some(tag => 
        tag.toLowerCase().includes(searchLower)
      ))
    );
  });

  // Calculate available sizes for a product
  const getAvailableSizes = (product: ProductCatalog | null) => {
    if (!product) return [];
    
    const variants = product.variants || [];
    
    if (!filterOutOfStock) {
      return variants;
    }

    // Filter based on inventory mapping
    return variants.filter((_, index) => {
      const variantSkus = product.variant_skus || [];
      const inventoryMap = product.variant_inventory || {};
      
      const vSku = variantSkus[index];
      
      // If we don't have an SKU for this variant, we can't reliably check stock.
      // In strict filtering mode, we hide it.
      if (!vSku) {
        return false; 
      }
      
      const stock = inventoryMap[vSku] ?? 0;
      return stock > 0;
    });
  };

  const availableSizes = getAvailableSizes(selectedProduct);

  const handleAddItem = () => {
    if (selectedProduct && selectedSize && quantity) {
      const qty = parseInt(quantity) || 1;
      onAdd(selectedProduct, selectedSize, qty);
      // Reset form
      setSelectedProductSku(null);
      setSelectedSize('');
      setQuantity('1');
      setSearchTerm('');
      setShowAddForm(false);
    }
  };

  const handleProductSelect = (sku: string) => {
    const product = validProducts.find(p => p.sku === sku);
    if (product) {
      setSelectedProductSku(sku);
      
      // Calculate available sizes for the NEWLY selected product
      const sizes = getAvailableSizes(product);
      
      // Auto-select size if there's only one variant available
      if (sizes.length === 1) {
        setSelectedSize(sizes[0]);
      } else {
        setSelectedSize('');
      }
      
      setQuantity('1');
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setSelectedProductSku(null);
    setSelectedSize('');
    setQuantity('1');
    setSearchTerm('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{title}</Label>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Items List */}
      <div className="border rounded-lg overflow-hidden">
        {items.length > 0 ? (
          <div className="divide-y">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Size: {item.size} | Quantity: {item.qty}
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onRemove(i)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No items listed or selected</p>
          </div>
        )}
      </div>

      {/* Add Row Button */}
      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed border-2 hover:border-solid hover:border-blue-500 hover:bg-blue-50 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          ADD ROW
        </Button>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Add New Item</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Button>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Product</Label>
            {/* Rendered in flow rather than in a Popover/DropdownMenu. Both of
                those portal their content to <body>, which the enclosing dialog
                has set to `pointer-events: none` — the panel shows but nothing
                inside it can be clicked or typed into. Staying in the dialog's
                own DOM avoids that entirely. */}
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((o) => !o)}
              className="h-10 w-full justify-between font-normal"
            >
              <span className="truncate">{selectedProduct ? selectedProduct.product_name : 'Select a product'}</span>
              <ChevronDown className={`h-4 w-4 opacity-50 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
              <div
                className="rounded-md border bg-popover text-popover-foreground shadow-md"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsOpen(false);
                  }
                }}
              >
                {/* shouldFilter={false}: filteredProducts already matches on SKU,
                    name and school tags, which cmdk's own scorer can't see. */}
                <Command shouldFilter={false}>
                  <CommandInput
                    autoFocus
                    placeholder="Search by SKU, product name, or tags..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchTerm ? 'No products found' : 'No products available'}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.sku}
                          value={product.sku}
                          onSelect={() => handleProductSelect(product.sku)}
                          className="cursor-pointer"
                        >
                          <span className="text-sm truncate w-full">{product.product_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            )}
          </div>

          {/* Size Selection */}
          {selectedProduct && (
            <div className="space-y-2">
              <Label className="text-sm">Size</Label>
              {availableSizes.length === 0 ? (
                <div className="text-sm text-red-500 p-2 border border-red-200 bg-red-50 rounded">
                  No sizes available in stock.
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 w-full justify-between font-normal">
                      <span>{selectedSize || 'Select size'}</span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                    {availableSizes.map((size) => (
                      <DropdownMenuItem
                        key={size}
                        onSelect={() => setSelectedSize(size)}
                        className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      >
                        {size}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Quantity and Actions */}
          {selectedProduct && selectedSize && (
            <div className="flex gap-2">
              <div className="space-y-2 flex-1">
                <Label className="text-sm">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Item
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
