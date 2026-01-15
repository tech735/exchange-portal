import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Search, Tag } from 'lucide-react';
import { type TicketItem } from '@/types/database';
import { useProducts } from '@/hooks/useProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ItemSelectorProps {
  title: string;
  items: TicketItem[];
  onRemove: (index: number) => void;
  onAdd: (product: { sku: string; product_name: string; variants: string[]; school_tags?: string[] }, size: string, qty: number) => void;
}

export function ItemSelector({
  title,
  items,
  onRemove,
  onAdd,
}: ItemSelectorProps) {
  const [selectedProduct, setSelectedProduct] = useState<{ sku: string; product_name: string; variants: string[]; school_tags?: string[] } | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Use products hook to get all products
  const { data: products } = useProducts();

  // Validate products array and filter by search term
  const validProducts = Array.isArray(products) ? products : [];
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

  const handleAddItem = () => {
    if (selectedProduct && selectedSize && quantity) {
      const qty = parseInt(quantity) || 1;
      onAdd(selectedProduct, selectedSize, qty);
      setSelectedProduct(null);
      setSelectedSize(null);
      setQuantity('1');
      setSearchTerm('');
    }
  };

  const handleProductSelect = (sku: string) => {
    const product = validProducts.find(p => p.sku === sku);
    if (product) {
      setSelectedProduct(product);
      setSelectedSize(null);
      setQuantity('1');
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const getDisplayText = () => {
    if (selectedProduct) {
      return selectedProduct.product_name;
    }
    return searchTerm ? 'Search results...' : 'Select a product';
  };

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

        {/* Enhanced Product Dropdown with Integrated Search */}
        <div className="space-y-2">
          <Label>Select Product</Label>
          <Select 
            value={selectedProduct?.sku || ''} 
            onValueChange={handleProductSelect}
            open={isOpen}
            onOpenChange={setIsOpen}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder={getDisplayText()} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {/* Integrated Search Input */}
              <div className="sticky top-0 z-10 p-3 border-b bg-background">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by SKU, product name, or tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Product List with Enhanced Display */}
              <div className="max-h-60 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {searchTerm ? 'No products found matching your search' : 'No products available'}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <SelectItem 
                      key={product.sku} 
                      value={product.sku}
                      className="p-3 cursor-pointer hover:bg-accent"
                    >
                      <div className="flex flex-col items-start space-y-1">
                        <div className="w-full">
                          <span className="font-medium text-sm truncate">{product.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                            {product.sku}
                          </span>
                          {product.school_tags && product.school_tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {product.school_tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  <Tag className="h-2.5 w-2.5" />
                                  {tag}
                                </span>
                              ))}
                              {product.school_tags.length > 2 && (
                                <span className="text-xs text-gray-500">+{product.school_tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </div>
            </SelectContent>
          </Select>
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

            {/* Clear Selection Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProduct(null);
                setSelectedSize(null);
                setQuantity('1');
                setSearchTerm('');
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
