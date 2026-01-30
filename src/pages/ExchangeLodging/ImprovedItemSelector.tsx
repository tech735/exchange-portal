import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Search, Tag } from 'lucide-react';
import { type TicketItem } from '@/types/database';
import { useProducts } from '@/hooks/useProducts';

interface ImprovedItemSelectorProps {
  title: string;
  items: TicketItem[];
  onRemove: (index: number) => void;
  onAdd: (product: { sku: string; product_name: string; variants: string[]; school_tags?: string[] }, size: string, qty: number) => void;
}

export function ImprovedItemSelector({
  title,
  items,
  onRemove,
  onAdd,
}: ImprovedItemSelectorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ sku: string; product_name: string; variants: string[]; school_tags?: string[] } | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: products } = useProducts();
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
      // Reset form
      setSelectedProduct(null);
      setSelectedSize('');
      setQuantity('1');
      setSearchTerm('');
      setShowAddForm(false);
    }
  };

  const handleProductSelect = (sku: string) => {
    const product = validProducts.find(p => p.sku === sku);
    if (product) {
      setSelectedProduct(product);
      setSelectedSize('');
      setQuantity('1');
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setSelectedProduct(null);
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
            <Select 
              value={selectedProduct?.sku || ''} 
              onValueChange={handleProductSelect}
              open={isOpen}
              onOpenChange={setIsOpen}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
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

                <div className="max-h-60 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {searchTerm ? 'No products found' : 'No products available'}
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        <div className="flex flex-col items-start space-y-1 py-1">
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

          {/* Size Selection */}
          {selectedProduct && (
            <div className="space-y-2">
              <Label className="text-sm">Size</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct.variants.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
