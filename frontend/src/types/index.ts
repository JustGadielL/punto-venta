export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_color?: string;
  name: string;
  description: string;
  price: number;
  cost?: number;
  image_url: string | null;
  is_active: number;
  is_kitchen: number;
  sort_order: number;
}

export interface Table {
  id: number;
  number: number;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'billing';
  active_order_id: number | null;
  order_number?: number;
  order_total?: number;
  customer_name?: string;
  order_status?: string;
  order_created_at?: string;
  item_count?: number;
}

export interface ModifierOption {
  id: number;
  group_id: number;
  name: string;
  price_adjustment: number;
  is_active?: number;
}

export interface ModifierGroup {
  id: number;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: number;
  options: ModifierOption[];
}

export interface OrderItemModifier {
  id?: number;
  modifier_option_id: number;
  modifier_name: string;
  price_adjustment: number;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes?: string;
  is_printed_kitchen?: number;
  status?: 'pending' | 'cooking' | 'served' | 'cancelled';
  image_url?: string | null;
  modifiers?: OrderItemModifier[];
}

export interface Order {
  id: number;
  order_number: number;
  table_id: number | null;
  table_name?: string;
  table_number?: number;
  type: 'dine_in' | 'take_out' | 'delivery' | 'pickup';
  customer_name: string;
  status: 'pending' | 'in_preparation' | 'ready' | 'paid' | 'cancelled' | 'refunded';
  shift_id: number | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  tip_amount: number;
  total: number;
  payment_method?: 'cash' | 'card' | 'transfer' | 'mixed';
  notes?: string;
  created_at: string;
  closed_at?: string;
  items?: OrderItem[];
  payments?: Payment[];
  item_count?: number;
}

export interface Payment {
  id?: number;
  order_id: number;
  shift_id: number;
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  amount_tendered?: number;
  change_amount?: number;
  created_at?: string;
}

export interface CashMovement {
  id: number;
  shift_id: number;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  created_at: string;
}

export interface CashShift {
  id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  initial_amount: number;
  final_amount: number | null;
  expected_cash: number;
  actual_cash: number | null;
  difference: number | null;
  total_sales: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  total_delivery_sales?: number;
  total_in_movements: number;
  total_out_movements: number;
  notes: string | null;
  status: 'open' | 'closed';
  paid_orders_count?: number;
  total_tips?: number;
  movements?: CashMovement[];
}

export interface PrintedTicket {
  id: number;
  type: 'order_receipt' | 'kitchen_comanda' | 'bar_comanda' | 'cash_shift' | 'test';
  reference_id: number;
  title: string;
  content_plain: string;
  content_html: string;
  created_at: string;
}

export interface NetworkInfo {
  localIp: string;
  allIps: string[];
  tabletUrl: string;
  apiUrl: string;
  qrCodeDataUrl: string;
}

export interface SystemSettings {
  restaurant_name?: string;
  address?: string;
  phone?: string;
  tax_id?: string;
  currency?: string;
  tax_rate?: string;
  ticket_footer?: string;
  paper_width?: string;
  printer_type?: string;
  printer_ip?: string;
  auto_print_on_checkout?: string;
  auto_print_kitchen_comanda?: string;
  [key: string]: string | undefined;
}
