import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { PosView } from './views/PosView';
import { TablesView } from './views/TablesView';
import { TransactionsView } from './views/TransactionsView';
import { OrdersView } from './views/OrdersView';
import { MoreMenu } from './views/MoreMenu';
import { CashView } from './views/CashView';
import { CatalogView } from './views/CatalogView';
import { PrinterView } from './views/PrinterView';
import { SettingsView } from './views/SettingsView';
import { CheckoutModal } from './components/CheckoutModal';
import { TicketPreviewModal } from './components/TicketPreviewModal';
import { PinPad } from './components/PinPad';
import { Category, Product, Table, Order, CashShift, PrintedTicket, ModifierGroup } from './types';
import { api } from './services/api';
import { getSocket } from './services/socket';
import { printTicketHtml, isAutoPrintEnabled } from './utils/printHelper';

export function App() {
  const [currentView, setCurrentView] = useState<string>('tables');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Selected table when switching from Tables -> POS
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Modals state
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [ticketModal, setTicketModal] = useState<PrintedTicket | any | null>(null);

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      const [cats, prods, mods, tbls, shiftData, activeOrds] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getModifiers ? api.getModifiers() : Promise.resolve([]),
        api.getTables(),
        api.getCurrentShift(),
        api.getActiveOrders()
      ]);

      setCategories(cats);
      setProducts(prods);
      setModifierGroups(mods);
      setTables(tbls);
      setActiveShift(shiftData.active ? shiftData.shift : null);
      setActiveOrdersCount(activeOrds.length);
    } catch (err) {
      console.error('Error loading initial POS data:', err);
    }
  }, []);

  const refreshShift = async () => {
    try {
      const res = await api.getCurrentShift();
      setActiveShift(res.active ? res.shift : null);
    } catch (e) {}
  };

  const refreshCatalog = async () => {
    try {
      const [cats, prods, mods] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getModifiers ? api.getModifiers() : Promise.resolve([])
      ]);
      setCategories(cats);
      setProducts(prods);
      setModifierGroups(mods);
    } catch (e) {}
  };

  const refreshTables = async () => {
    try {
      const [tbls, activeOrds] = await Promise.all([
        api.getTables(),
        api.getActiveOrders()
      ]);
      setTables(tbls);
      setActiveOrdersCount(activeOrds.length);
    } catch (e) {}
  };

  // Setup Socket.io Listeners for Real-time Multi-device Sync
  useEffect(() => {
    loadInitialData();

    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleOrderUpdated = () => {
      refreshTables();
    };

    const handleTableUpdated = () => {
      refreshTables();
    };

    const handleShiftUpdated = () => {
      refreshShift();
    };

    const handleCatalogUpdated = () => {
      refreshCatalog();
    };

    const handleKitchenComanda = () => {
      // Audio ding alert for kitchen if audio context allowed
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } catch (e) {}
      refreshTables();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('table:updated', handleTableUpdated);
    socket.on('shift:updated', handleShiftUpdated);
    socket.on('catalog:updated', handleCatalogUpdated);
    socket.on('kitchen:new_comanda', handleKitchenComanda);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('table:updated', handleTableUpdated);
      socket.off('shift:updated', handleShiftUpdated);
      socket.off('catalog:updated', handleCatalogUpdated);
      socket.off('kitchen:new_comanda', handleKitchenComanda);
    };
  }, [loadInitialData]);

  const tablesOccupiedCount = tables.filter(t => t.status === 'occupied' || t.status === 'billing').length;

  const handleSelectTableForPos = (tableId: number) => {
    setSelectedTableId(tableId);
    setSelectedOrderId(null);
    setCurrentView('pos');
  };

  const handleSelectOrderForPos = (orderId: number) => {
    setSelectedOrderId(orderId);
    setSelectedTableId(null);
    setCurrentView('pos');
  };

  const handleShowTicket = useCallback((ticket: any) => {
    if (!ticket) return;
    if (isAutoPrintEnabled()) {
      const html = ticket.content_html || ticket.htmlContent || '';
      if (html) {
        printTicketHtml(html, ticket.title || 'Ticket');
        return;
      }
    }
    setTicketModal(ticket);
  }, []);

  const handleCheckoutSuccess = (updatedOrder: Order, ticket: any) => {
    setCheckoutOrder(null);
    setSelectedOrderId(null); // Clear selected order so POS empties
    refreshTables();
    refreshShift();
    if (ticket) {
      handleShowTicket(ticket);
    }
  };

  if (isLocked) {
    return <PinPad onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Bar */}
      <TopBar 
        isConnected={isConnected} 
        activeShift={activeShift} 
        onOpenCashModal={() => setCurrentView('more:cash')} 
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'pos' && (
          <PosView
            categories={categories}
            products={products}
            modifierGroups={modifierGroups}
            tables={tables}
            activeShift={activeShift}
            selectedTableId={selectedTableId}
            selectedOrderId={selectedOrderId}
            onSelectTable={(id) => {
              setSelectedTableId(id);
              if (id === null) setSelectedOrderId(null);
            }}
            onOpenCheckout={setCheckoutOrder}
            onShowTicket={handleShowTicket}
          />
        )}

        {currentView === 'tables' && (
          <TablesView
            tables={tables}
            onSelectTableForPos={handleSelectTableForPos}
            onSelectOrderForPos={handleSelectOrderForPos}
            onOpenCheckout={setCheckoutOrder}
            onShowTicket={handleShowTicket}
          />
        )}

        {currentView === 'transactions' && (
          <TransactionsView onShowTicket={handleShowTicket} />
        )}

        {currentView === 'orders' && (
          <OrdersView onSelectTableForPos={handleSelectTableForPos} onSelectOrderForPos={handleSelectOrderForPos} onOpenCheckout={setCheckoutOrder} onShowTicket={handleShowTicket} />
        )}

        {currentView.startsWith('more') && (
          <MoreMenu 
            currentSubView={currentView.split(':')[1]} 
            onSelectSubView={(v) => setCurrentView(`more:${v}`)}
            activeShift={activeShift}
            categories={categories}
            products={products}
            onRefreshCatalog={refreshCatalog}
            onRefreshShift={refreshShift}
            onShowTicket={handleShowTicket}
          />
        )}
      </main>

      {/* Bottom Navigation for Tablets */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        activeOrdersCount={activeOrdersCount}
      />

      {/* Global Modals */}
      {checkoutOrder && (
        <CheckoutModal
          order={checkoutOrder}
          onClose={() => setCheckoutOrder(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {ticketModal && (
        <TicketPreviewModal
          ticket={ticketModal}
          onClose={() => setTicketModal(null)}
        />
      )}
    </div>
  );
}

export default App;
