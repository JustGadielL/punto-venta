import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ChefHat, 
  CreditCard, 
  FileText, 
  ShoppingBag, 
  Flame, 
  Edit3, 
  Sparkles,
  AlertCircle,
  X,
  Check,
  ArrowLeft,
  Store,
  Save
} from 'lucide-react';
import { Category, Product, Table, OrderItem, Order, CashShift } from '../types';
import { api } from '../services/api';
import { IconRenderer } from '../components/IconRenderer';
import { ProductModifiersModal } from '../components/ProductModifiersModal';
import { SwipeToDeleteItem } from '../components/SwipeToDeleteItem';

import { customAlert, customConfirm } from '../utils/alert';

interface PosViewProps {
  categories: Category[];
  products: Product[];
  modifierGroups: any[];
  tables: Table[];
  activeShift: CashShift | null;
  selectedTableId: number | null;
  selectedOrderId?: number | null;
  onSelectTable: (id: number | null) => void;
  onOpenCheckout: (order: Order) => void;
  onShowTicket: (ticket: any) => void;
}

export const PosView: React.FC<PosViewProps> = ({
  categories,
  products,
  modifierGroups,
  tables,
  activeShift,
  selectedTableId,
  selectedOrderId,
  onSelectTable,
  onOpenCheckout,
  onShowTicket
}) => {
  const [selectedCategory, setSelectedCategory] = useState<number | 'all' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orderType, setOrderType] = useState<'dine_in' | 'take_out' | 'delivery' | 'pickup'>(selectedTableId ? 'dine_in' : 'dine_in');
  const [customerName, setCustomerName] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  
  // Cart state
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [isSendingKitchen, setIsSendingKitchen] = useState<boolean>(false);
  const [isSavingOnly, setIsSavingOnly] = useState<boolean>(false);
  const [itemNoteModal, setItemNoteModal] = useState<{ index: number; note: string } | null>(null);
  
  // Modifiers Modal State
  const [modifierModalProduct, setModifierModalProduct] = useState<Product | null>(null);
  const [productModifierMappings, setProductModifierMappings] = useState<any[]>([]);

  useEffect(() => {
    // Fetch product modifier mappings on mount
    api.getProductModifiers().then(mappings => setProductModifierMappings(mappings)).catch(() => {});
  }, []);

  const lastLoadedOrderIdRef = useRef<number | null>(null);

  // Sync with selected table if passed from Tables View
  useEffect(() => {
    if (selectedOrderId) {
      if (lastLoadedOrderIdRef.current !== selectedOrderId) {
        lastLoadedOrderIdRef.current = selectedOrderId;
        loadTableOrder(selectedOrderId);
      }
    } else if (selectedTableId) {
      lastLoadedOrderIdRef.current = null;
      setOrderType('dine_in');
      const table = tables.find(t => t.id === selectedTableId);
      if (table && table.active_order_id) {
        if (currentOrderId !== table.active_order_id) {
          loadTableOrder(table.active_order_id);
        }
      } else {
        // New order for empty table
        if (currentOrderId !== null) {
          setCurrentOrderId(null);
          setCartItems([]);
          setCustomerName('');
          setOrderNotes('');
        }
      }
    } else {
      lastLoadedOrderIdRef.current = null;
      if (currentOrderId !== null) {
        setOrderType('dine_in');
        setCurrentOrderId(null);
        setCartItems([]);
        setCustomerName('');
        setOrderNotes('');
      }
    }
  }, [selectedTableId, selectedOrderId, tables]);

  const loadTableOrder = async (orderId: number) => {
    try {
      const order = await api.getOrder(orderId);
      setCurrentOrderId(order.id);
      setOrderType(order.type as any);
      setCustomerName(order.customer_name || '');
      setOrderNotes(order.notes || '');
      setCartItems(order.items || []);
      if (order.table_id && order.table_id !== selectedTableId) {
        onSelectTable(order.table_id);
      }
    } catch (err) {
      console.error('Error loading order:', err);
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter(p => {
    if (!p.is_active) return false;
    if (selectedCategory === null) return false;
    return selectedCategory === 'all' || p.category_id === selectedCategory;
  });

  const searchResultProducts = products.filter(p => {
    if (!p.is_active) return false;
    if (!searchQuery) return false;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handleAddToCartClick = (product: Product) => {
    // Check if product has modifiers
    const hasModifiers = productModifierMappings.some(m => m.product_id === product.id);
    if (hasModifiers) {
      setModifierModalProduct(product);
    } else {
      handleAddProductToCart(product, [], '', 1);
    }
  };

  const handleAddProductToCart = (product: Product, modifiers: any[], note: string, qty: number, keepModalOpen = false) => {
    setCartItems(prev => {
      // For items with modifiers or notes, we just add them as separate line items unless everything exactly matches
      const existingIdx = prev.findIndex(it => 
        it.product_id === product.id && 
        it.notes === note && 
        JSON.stringify(it.modifiers) === JSON.stringify(modifiers)
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + qty
        };
        return updated;
      } else {
        const modPrice = modifiers.reduce((s, m) => s + m.price_adjustment, 0);
        return [...prev, {
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price + modPrice,
          quantity: qty,
          notes: note,
          is_printed_kitchen: 0,
          status: 'pending',
          modifiers: modifiers
        }];
      }
    });
    if (!keepModalOpen) {
      setModifierModalProduct(null);
    }
  };

  const handleUpdateQuantity = (idx: number, delta: number) => {
    setCartItems(prev => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) {
        return updated; // don't allow 0 here, use swipe to delete
      }
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleParaLlevar = (index: number) => {
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      const currentNotes = item.notes || '';
      let newNotes = '';
      if (currentNotes.includes('[PARA LLEVAR]')) {
        newNotes = currentNotes.replace(/\[PARA LLEVAR\]/g, '').trim();
      } else {
        newNotes = currentNotes ? `${currentNotes} [PARA LLEVAR]` : '[PARA LLEVAR]';
      }
      updated[index] = { ...item, notes: newNotes };
      return updated;
    });
  };

  const handleSaveItemNote = () => {
    if (itemNoteModal !== null) {
      setCartItems(prev => {
        const updated = [...prev];
        if (updated[itemNoteModal.index]) {
          updated[itemNoteModal.index] = {
            ...updated[itemNoteModal.index],
            notes: itemNoteModal.note
          };
        }
        return updated;
      });
      setItemNoteModal(null);
    }
  };

  const handleClearCart = async () => {
    if (cartItems.length > 0 && await customConfirm('¿Deseas vaciar el carrito actual?')) {
      setCartItems([]);
      setCurrentOrderId(null);
      onSelectTable(null);
    }
  };

  // Cart totals
  const subtotal = cartItems.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
  const total = subtotal;

  // Save Order Only (No Comanda Print)
  const handleSaveOnly = async () => {
    if (cartItems.length === 0) return;
    if (orderType === 'dine_in' && !selectedTableId) {
      customAlert('Por favor selecciona una mesa para la orden en comedor.');
      return;
    }

    setIsSavingOnly(true);
    try {
      let orderId = currentOrderId;
      const finalCustomerName = orderType === 'delivery' ? (customerName || 'Didi') : customerName;

      if (!orderId) {
        // Create new order
        const newOrder = await api.createOrder({
          table_id: orderType === 'dine_in' ? selectedTableId : null,
          type: orderType,
          customer_name: finalCustomerName,
          notes: orderNotes,
          items: cartItems
        });
        orderId = newOrder.id;
        setCurrentOrderId(orderId);
        if (newOrder.items) setCartItems(newOrder.items);
      } else {
        // Update existing order items
        const updated = await api.updateOrderItems(orderId, {
          items: cartItems,
          customer_name: finalCustomerName,
          notes: orderNotes,
          type: orderType,
          table_id: orderType === 'dine_in' ? selectedTableId : null
        });
        if (updated.items) setCartItems(updated.items);
      }

      customAlert('Pedido guardado correctamente.');
    } catch (err: any) {
      customAlert(err.message || 'Error al guardar el pedido');
    } finally {
      setIsSavingOnly(false);
    }
  };

  // Send Comanda to Kitchen / Save Order
  const handleSendToKitchen = async () => {
    if (cartItems.length === 0) return;
    if (orderType === 'dine_in' && !selectedTableId) {
      customAlert('Por favor selecciona una mesa para la orden en comedor.');
      return;
    }

    setIsSendingKitchen(true);
    try {
      let orderId = currentOrderId;
      const finalCustomerName = orderType === 'delivery' ? (customerName || 'Didi') : customerName;

      if (!orderId) {
        // Create new order
        const newOrder = await api.createOrder({
          table_id: orderType === 'dine_in' ? selectedTableId : null,
          type: orderType,
          customer_name: finalCustomerName,
          notes: orderNotes,
          items: cartItems
        });
        orderId = newOrder.id;
        setCurrentOrderId(orderId);
      } else {
        // Update existing order items
        await api.updateOrderItems(orderId, {
          items: cartItems,
          customer_name: finalCustomerName,
          notes: orderNotes,
          type: orderType,
          table_id: orderType === 'dine_in' ? selectedTableId : null
        });
      }

      // Fire kitchen print and socket event
      const res = await api.sendKitchenComanda(orderId);
      if (res.printResult) {
        onShowTicket(res.printResult);
      }
    } catch (err: any) {
      customAlert(err.message || 'Error al enviar comanda a cocina');
    } finally {
      setIsSendingKitchen(false);
    }
  };

  // Direct Checkout button
  const handleProceedCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!activeShift) {
      customAlert('Debes abrir el turno de caja antes de poder cobrar.');
      return;
    }

    try {
      let orderId = currentOrderId;
      const finalCustomerName = orderType === 'delivery' ? (customerName || 'Didi') : customerName;
      if (!orderId) {
        const newOrder = await api.createOrder({
          table_id: orderType === 'dine_in' ? selectedTableId : null,
          type: orderType,
          customer_name: finalCustomerName,
          notes: orderNotes,
          items: cartItems
        });
        orderId = newOrder.id;
        setCurrentOrderId(orderId);
      } else {
        await api.updateOrderItems(orderId, {
          items: cartItems,
          customer_name: finalCustomerName,
          notes: orderNotes,
          type: orderType,
          table_id: orderType === 'dine_in' ? selectedTableId : null
        });
      }

      const fullOrder = await api.getOrder(orderId);
      onOpenCheckout(fullOrder);
    } catch (err: any) {
      customAlert(err.message || 'Error al preparar la orden para cobro');
    }
  };

  const handleRequestBill = async () => {
    if (!currentOrderId) return;
    try {
      const res = await api.printOrderReceipt(currentOrderId);
      onShowTicket(res);
    } catch (err: any) {
      customAlert(err.message || 'Error al generar la pre-cuenta');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-2 md:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 h-full min-h-0">
      {/* LEFT COLUMN: Categories & Product Grid (7 cols on md/lg, 8 on xl) */}
      <div className="md:col-span-7 lg:col-span-7 xl:col-span-8 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
        {/* Search Bar */}
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-lg relative z-20">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar platillo o bebida..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar z-50">
              {searchResultProducts.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <p className="font-semibold">No se encontraron productos</p>
                </div>
              ) : (
                <div className="p-2 flex flex-col gap-1">
                  {searchResultProducts.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => {
                        handleAddToCartClick(prod);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors group"
                    >
                      <div>
                        <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors">{prod.name}</h4>
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 inline-block"
                          style={{ backgroundColor: `${prod.category_color || '#3b82f6'}25`, color: prod.category_color || '#60a5fa' }}
                        >
                          {prod.category_name}
                        </span>
                      </div>
                      <span className="font-black text-emerald-400">${prod.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto mt-4 pr-2">
          {selectedCategory === null ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-20">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-orange-500 hover:bg-slate-800 transition-all active:scale-95 shadow-md aspect-square"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat.color || '#f97316'}20`, color: cat.color || '#f97316' }}>
                    <IconRenderer name={cat.icon} className="w-6 h-6" />
                  </div>
                  <span className="font-black text-center text-sm">{cat.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a Categorías
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-20">
                {filteredProducts.map(prod => {
                const inCartItem = cartItems.find(it => it.product_id === prod.id);
                const countInCart = cartItems
                  .filter(it => it.product_id === prod.id)
                  .reduce((acc, it) => acc + it.quantity, 0);

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleAddToCartClick(prod)}
                    className={`group relative bg-slate-900 border rounded-2xl p-3 flex flex-col justify-between cursor-pointer select-none transition-all duration-150 active:scale-[0.97] hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-950/20 ${
                      countInCart > 0 ? 'border-orange-500/80 bg-orange-950/10' : 'border-slate-800'
                    }`}
                  >
                  {/* Category Pill Tag & Quantity Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[120px]"
                      style={{ backgroundColor: `${prod.category_color || '#3b82f6'}25`, color: prod.category_color || '#60a5fa' }}
                    >
                      {prod.category_name}
                    </span>

                    {countInCart > 0 && (
                      <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                        {countInCart}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div>
                    <h3 className="font-bold text-slate-100 text-xs md:text-sm group-hover:text-orange-400 transition-colors line-clamp-2 leading-tight">
                      {prod.name}
                    </h3>
                    {prod.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-normal">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Add Indicator */}
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-sm md:text-base font-black text-emerald-400">
                      ${prod.price.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCartClick(prod);
                      }}
                      className="w-7 h-7 rounded-xl bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          )}

          {selectedCategory !== null && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <ShoppingBag className="w-12 h-12 mb-2 stroke-1" />
              <p className="text-sm font-semibold">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Cart & Checkout Panel */}
      <div className="md:col-span-5 lg:col-span-5 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col h-full min-h-0 shadow-2xl overflow-hidden">
        {/* Order Header / Destination */}
        <div className="border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] md:text-xs font-bold w-full">
              <button
                type="button"
                onClick={() => {
                  setOrderType('dine_in');
                  if (['Didi', 'Rappi', 'Uber'].includes(customerName)) {
                    setCustomerName('');
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${orderType === 'dine_in' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Comedor
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('take_out');
                  onSelectTable(null);
                  if (['Didi', 'Rappi', 'Uber'].includes(customerName)) {
                    setCustomerName('');
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${orderType === 'take_out' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Llevar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('pickup');
                  onSelectTable(null);
                  if (['Didi', 'Rappi', 'Uber'].includes(customerName)) {
                    setCustomerName('');
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${orderType === 'pickup' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Recoger
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('delivery');
                  onSelectTable(null);
                  if (!customerName || !['Didi', 'Rappi', 'Uber'].includes(customerName)) {
                    setCustomerName('Didi');
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${orderType === 'delivery' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                App
              </button>
            </div>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                title="Vaciar Carrito"
                className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Table / Customer Selector */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {orderType === 'dine_in' ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mesa</label>
                  <select
                    value={selectedTableId || ''}
                    onChange={e => onSelectTable(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Elegir Mesa --</option>
                    {tables
                      .filter(t => t.status === 'available' || t.id === selectedTableId)
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : orderType === 'delivery' ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Plataforma / App</label>
                  <select
                    value={customerName || 'Didi'}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Didi">Didi</option>
                    <option value="Rappi">Rappi</option>
                    <option value="Uber">Uber</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {orderType === 'pickup' ? 'Cliente / WhatsApp' : 'Cliente'}
                  </label>
                  <input
                    type="text"
                    placeholder={orderType === 'pickup' ? 'Nombre o WhatsApp...' : 'Nombre del cliente...'}
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nota Orden</label>
                <input
                  type="text"
                  placeholder="Ej. Sin prisa..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {orderType === 'dine_in' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente (Opcional)</label>
                <input
                  type="text"
                  placeholder="Nombre de cliente o comensal..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1.5 flex flex-col gap-2 custom-scrollbar overscroll-contain touch-pan-y">
          {cartItems.map((item, idx) => {
            const isTakeoutItem = item.notes?.includes('[PARA LLEVAR]');
            const displayNotes = item.notes?.replace(/\[PARA LLEVAR\]/g, '').trim();

            return (
              <SwipeToDeleteItem key={idx} onDelete={() => handleRemoveItem(idx)}>
                <div className="bg-slate-950/80 p-2.5 flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{item.product_name}</h4>
                        {isTakeoutItem && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded text-[9px] font-black uppercase tracking-wider">
                            Llevar
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ${item.unit_price.toFixed(2)} c/u
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-slate-500 mt-0.5 leading-tight">
                            {(() => {
                              const countMap: Record<string, number> = {};
                              item.modifiers.forEach((m: any) => {
                                countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1;
                              });
                              return Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black text-white w-4 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="w-16 text-right font-black text-xs text-emerald-400 pl-1">
                    ${(item.unit_price * item.quantity).toFixed(2)}
                  </div>
                </div>

                {/* Note / Specification Pill */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItemNoteModal({ index: idx, note: displayNotes || '' })}
                      className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                        displayNotes
                          ? 'bg-amber-950/60 border border-amber-800/60 text-amber-300'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{displayNotes ? 'Nota agregada' : '+ Agregar nota'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleParaLlevar(idx)}
                      className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                        isTakeoutItem
                          ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/50'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800'
                      }`}
                    >
                      <Store className="w-3 h-3" />
                      <span>{isTakeoutItem ? '✓ Para llevar' : 'Para llevar'}</span>
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-600 uppercase">Desliza para borrar</span>
                </div>
              </div>
            </SwipeToDeleteItem>
          );
        })}

          {cartItems.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-xs font-semibold">El carrito está vacío</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Toca los productos para agregarlos a la comanda</p>
            </div>
          )}
        </div>

        {/* Totals & Action Buttons */}
        <div className="border-t border-slate-800 pt-2.5 mt-2 flex flex-col gap-2 shrink-0">
          {/* Subtotal & Total display */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total a Pagar:</span>
            <span className="text-2xl font-black text-emerald-400">
              ${total.toFixed(2)}
            </span>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Guardar (Sin Imprimir) */}
            <button
              type="button"
              disabled={cartItems.length === 0 || isSavingOnly || isSendingKitchen}
              onClick={handleSaveOnly}
              className={`py-3 px-1 rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                cartItems.length === 0 || isSavingOnly || isSendingKitchen
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 active:scale-95'
              }`}
              title="Guardar comanda sin imprimir ticket"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingOnly ? 'Guardando...' : 'Guardar'}</span>
            </button>

            {/* Imprimir Cuenta Button */}
            <button
              type="button"
              disabled={!currentOrderId}
              onClick={handleRequestBill}
              className={`py-3 px-1 rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                !currentOrderId
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-white shadow-slate-900/20 active:scale-95'
              }`}
              title="Imprimir ticket de cuenta para el cliente"
            >
              <FileText className="w-4 h-4" />
              <span>Cuenta</span>
            </button>

            {/* Kitchen Comanda Button */}
            <button
              type="button"
              disabled={cartItems.length === 0 || isSendingKitchen || isSavingOnly}
              onClick={handleSendToKitchen}
              className={`py-3 px-1 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                cartItems.length === 0 || isSendingKitchen || isSavingOnly
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-95'
              }`}
              title="Guardar e imprimir comanda en cocina/barra"
            >
              <ChefHat className="w-4 h-4" />
              <span>{isSendingKitchen ? 'Enviando...' : 'Comanda'}</span>
            </button>

            {/* Direct Pay / Checkout Button */}
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={handleProceedCheckout}
              className={`py-3 px-1 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                cartItems.length === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.02] active:scale-95'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Item Note Modal */}
      {itemNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-orange-400" />
              Nota para Cocina / Preparación
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {cartItems[itemNoteModal.index]?.product_name}
            </p>

            <textarea
              rows={3}
              placeholder="Ej: Sin cebolla, término medio, salsa aparte..."
              value={itemNoteModal.note}
              onChange={e => setItemNoteModal({ ...itemNoteModal, note: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500 mb-4"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemNoteModal(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItemNote}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Product Modifiers Modal */}
      {modifierModalProduct && (
        <ProductModifiersModal
          product={modifierModalProduct}
          modifierGroups={modifierGroups}
          productModifierGroupIds={productModifierMappings.filter(m => m.product_id === modifierModalProduct.id).map(m => m.group_id)}
          onClose={() => setModifierModalProduct(null)}
          onAddToCart={handleAddProductToCart}
        />
      )}
    </div>
  );
};
