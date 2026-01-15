import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, ChevronDown, Search, Tag } from 'lucide-react';
import { type TicketItem } from '@/types/database';

interface ItemSelectorProps {
  title: string;
  items: TicketItem[];
  onRemove: (index: number) => void;
  onAdd: (product: { sku: string; product_name: string; variants: string[]; school_tags?: string[] }, size: string, qty: number) => void;
  products: { sku: string; product_name: string; variants: string[]; school_tags?: string[] }[];
  search: string;
  onSearch: (search: string) => void;
}

export function ItemSelector({
  title,
  items,
  onRemove,
  onAdd,
  products,
  search,
  onSearch,
}: ItemSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ sku: string; product_name: string; variants: string[] } | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');

  // Validate products array
  const validProducts = Array.isArray(products) ? products : [];

  const handleSelectProduct = (product: { sku: string; product_name: string; variants: string[] }) => {
    setSelectedProduct(product);
    setSelectedSize(null);
    setQuantity('1');
    setIsOpen(false);
    onSearch('');
  };

  const handleAddItem = () => {
    if (selectedProduct && selectedSize && quantity) {
      const qty = parseInt(quantity) || 1;
      onAdd(selectedProduct, selectedSize, qty);
      setSelectedProduct(null);
      setSelectedSize(null);
      setQuantity('1');
    }
  };

  const displayText = selectedProduct 
    ? `${selectedProduct.product_name}`
    : 'Select an item...';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{title}</Label>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''} added
          </span>
        )}
      </div>

      {/* Items List */}
      <div className="border rounded-lg overflow-hidden">
        {items.length > 0 ? (
          <div className="divide-y">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Size: {item.size} | Qty: {item.qty}
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onRemove(i)}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No items added yet
          </div>
        )}
      </div>

      {/* Add Item Section */}
      <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
        <Label className="text-sm font-semibold text-blue-900">Add New Item</Label>

        {/* Search Input */}
        <div className="space-y-2">
          <Label className="text-xs">Search Products (SKU, Name, or Tags)</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU, product name, or tags..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
        </div>

        {/* Product Dropdown */}
        <div className="space-y-2">
          <Label className="text-xs">Select Product</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full px-3 py-2 border rounded-md bg-white text-left text-sm flex items-center justify-between hover:bg-gray-50"
            >
              <span className={selectedProduct ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {selectedProduct ? selectedProduct.product_name : 'Select a product...'}
              </span>
              <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-white shadow-lg z-50">
                <div className="max-h-64 overflow-y-auto">
                  {validProducts.length > 0 ? (
                    validProducts.map((p) => (
                      <button
                        key={p.sku}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-blue-100 text-sm border-b last:border-b-0 transition"
                        onClick={() => handleSelectProduct(p)}
                      >
                        <div className="font-medium">{p.product_name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
                        {p.school_tags && p.school_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.school_tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </span>
                            ))}
                            {p.school_tags.length > 3 && (
                              <span className="text-xs text-gray-500">+{p.school_tags.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                      {search ? 'No products found matching your search' : 'Loading products...'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Size and Quantity Selection */}
        {selectedProduct && (
          <div className="space-y-3 pt-2 border-t border-blue-200">
            {/* Size Selection */}
            <div className="space-y-2">
              <Label className="text-xs">Size</Label>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.variants.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1 rounded text-sm border transition ${
                      selectedSize === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 hover:border-blue-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity and Action */}
            {selectedSize && (
              <div className="space-y-2 pt-2 border-t border-blue-200">
                <Label className="text-xs">Quantity</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProduct(null);
                setSelectedSize(null);
                setQuantity('1');
                setIsOpen(false);
              }}
              className="w-full text-xs"
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
