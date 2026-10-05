import { Category, Product, Table, Order, CashShift, CashMovement, PrintedTicket, NetworkInfo, SystemSettings } from '../types';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const API_BASE = `${BACKEND_URL}/api`;

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error en la petición');
  }
  return data;
}

export const api = {
  // Categories & Products
  getCategories: () => fetchJSON<Category[]>('/categories'),
  createCategory: (cat: Partial<Category>) => fetchJSON<Category>('/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id: number, cat: Partial<Category>) => fetchJSON<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(cat) }),
  deleteCategory: (id: number) => fetchJSON<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),

  getProducts: (categoryId?: number, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', String(categoryId));
    if (activeOnly) params.append('active_only', 'true');
    return fetchJSON<Product[]>(`/products?${params.toString()}`);
  },
  createProduct: (prod: Partial<Product>) => fetchJSON<Product>('/products', { method: 'POST', body: JSON.stringify(prod) }),
  updateProduct: (id: number, prod: Partial<Product>) => fetchJSON<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(prod) }),
  deleteProduct: (id: number) => fetchJSON<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),


  // Tables
  getTables: () => fetchJSON<Table[]>('/tables'),
  createTable: (table: Partial<Table>) => fetchJSON<Table>('/tables', { method: 'POST', body: JSON.stringify(table) }),
  updateTable: (id: number, table: Partial<Table>) => fetchJSON<Table>(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(table) }),
  deleteTable: (id: number) => fetchJSON<{ message: string }>(`/tables/${id}`, { method: 'DELETE' }),

  // Orders
  getActiveOrders: () => fetchJSON<Order[]>('/orders/active'),
  getOrders: (status?: string, shiftId?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (shiftId) params.append('shift_id', String(shiftId));
    return fetchJSON<Order[]>(`/orders?${params.toString()}`);
  },
  getOrder: (id: number) => fetchJSON<Order>(`/orders/${id}`),
  createOrder: (orderData: any) => fetchJSON<Order>('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
  updateOrderItems: (id: number, data: any) => fetchJSON<Order>(`/orders/${id}/items`, { method: 'PUT', body: JSON.stringify(data) }),
  sendKitchenComanda: (id: number) => fetchJSON<{ success: boolean; printResult: any; order: Order }>(`/orders/${id}/send-kitchen`, { method: 'POST' }),
  requestBill: (id: number) => fetchJSON<{ success: boolean; message: string; ticket?: any }>(`/orders/${id}/request-bill`, { method: 'POST' }),
  checkoutOrder: (id: number, paymentData: any) => fetchJSON<{ success: boolean; message: string; order: Order; ticket: any }>(`/orders/${id}/checkout`, { method: 'POST', body: JSON.stringify(paymentData) }),
  refundOrder: (orderId: number) => fetchJSON<{ success: boolean }>(`/orders/${orderId}/refund`, { method: 'POST' }),
  cancelOrder: (id: number, reason: string) => fetchJSON<{ success: boolean; message: string }>(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteOrder: (id: number) => fetchJSON<{ success: boolean; message: string }>(`/orders/${id}`, { method: 'DELETE' }),

  // Cash Register
  getCurrentShift: () => fetchJSON<{ active: boolean; shift: CashShift | null }>('/cash/current-shift'),
  openShift: (data: { cashier_name: string; initial_amount: number; notes?: string }) => fetchJSON<{ success: boolean; shift: CashShift }>('/cash/open', { method: 'POST', body: JSON.stringify(data) }),
  createCashMovement: (data: { type: 'in' | 'out'; amount: number; reason: string }) => fetchJSON<{ success: boolean; shift: CashShift }>('/cash/movement', { method: 'POST', body: JSON.stringify(data) }),
  closeShift: (data: { actual_cash: number; notes?: string }) => fetchJSON<{ success: boolean; shift: CashShift; ticket: any }>('/cash/close', { method: 'POST', body: JSON.stringify(data) }),
  getShiftHistory: (limit?: number) => fetchJSON<CashShift[]>(`/cash/shifts?limit=${limit || 20}`),
  getShiftDetail: (id: number) => fetchJSON<{ shift: CashShift; movements: CashMovement[]; orders: Order[] }>(`/cash/shifts/${id}`),

  // Reports
  getSalesReport: (period: string = 'day') => fetchJSON<any[]>(`/reports/sales?period=${period}`),

  // Printer & Tickets
  getPrintedTickets: (limit?: number) => fetchJSON<PrintedTicket[]>(`/printer/history?limit=${limit || 30}`),
  printOrderReceipt: (id: number) => fetchJSON<any>(`/printer/print-order/${id}`, { method: 'POST' }),
  printKitchenComanda: (id: number) => fetchJSON<any>(`/printer/print-kitchen/${id}`, { method: 'POST' }),
  printShiftReport: (id: number) => fetchJSON<any>(`/printer/print-shift/${id}`, { method: 'POST' }),
  testPrint: () => fetchJSON<any>('/printer/test', { method: 'POST' }),
  getPrinterStatus: () => fetchJSON<any>('/printer/status'),

  // Discounts
  getDiscounts: () => fetchJSON<any[]>('/discounts'),
  createDiscount: (data: any) => fetchJSON<any>('/discounts', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscount: (id: number, data: any) => fetchJSON<any>(`/discounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiscount: (id: number) => fetchJSON<{ message: string }>(`/discounts/${id}`, { method: 'DELETE' }),

  // Modifiers
  getModifiers: () => fetchJSON<any[]>('/modifiers'),
  createModifierGroup: (data: any) => fetchJSON<any>('/modifiers', { method: 'POST', body: JSON.stringify(data) }),
  updateModifierGroup: (id: number, data: any) => fetchJSON<any>(`/modifiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModifierGroup: (id: number) => fetchJSON<{ message: string }>(`/modifiers/${id}`, { method: 'DELETE' }),
  createModifierOption: (groupId: number, data: any) => fetchJSON<any>(`/modifiers/${groupId}/options`, { method: 'POST', body: JSON.stringify(data) }),
  updateModifierOption: (id: number, data: any) => fetchJSON<any>(`/modifiers/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModifierOption: (id: number) => fetchJSON<{ message: string }>(`/modifiers/options/${id}`, { method: 'DELETE' }),
  getProductModifiers: () => fetchJSON<any[]>('/products/modifiers/mappings'),
  updateProductModifiers: (productId: number, groupIds: number[]) => fetchJSON<{ success: boolean }>(`/products/${productId}/modifiers`, { method: 'PUT', body: JSON.stringify({ group_ids: groupIds }) }),

  // System & Network
  getNetworkInfo: () => fetchJSON<NetworkInfo>('/system/network-info'),
  getSettings: () => fetchJSON<SystemSettings>('/system/settings'),
  updateSettings: (settings: SystemSettings) => fetchJSON<{ success: boolean; settings: SystemSettings }>('/system/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getBackup: () => fetchJSON<any>('/system/backup'),
  restoreBackup: (data: any) => fetchJSON<{ success: boolean; message: string }>('/system/restore', { method: 'POST', body: JSON.stringify(data) }),
};
