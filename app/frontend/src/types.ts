export type RoleName = 'Admin' | 'Manager' | 'Employee';

export type Summary = {
  total_revenue: number;
  invoice_count: number;
  low_stock_count: number;
  active_products: number;
  total_employees: number;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  category: string;
  measuring_type: string;
  price_unit_count: number;
  unit_price: number;
  tax_rate: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  current_stock: number;
  fifo_min_cost: number;
  fifo_max_cost: number;
  fifo_avg_cost: number;
  storage_location?: string | null;
};

export type Employee = {
  id: number;
  username: string;
  full_name?: string | null;
  role: { id: number; name: RoleName; description?: string | null };
  is_active: boolean;
  created_at: string;
};

export type PurchaseRecord = {
  id: number;
  code: string;
  product_name: string;
  category: string;
  measuring_type: string;
  purchased_from: string;
  purchase_price: number;
  count: number;
  created_at: string;
};

export type PurchaseBatch = {
  batch_id: number;
  product_id: number;
  original_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  created_at: string;
};

export type InvoiceItemDraft = {
  product_id: number;
  quantity: number;
  product?: Product;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  customer_name?: string | null;
  employee_id: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  cost_price?: number | null;
  profit?: number | null;
  payment_status: string;
  created_at: string;
  items: Array<{
    id: number;
    product_id: number;
    product_code?: string | null;
    description?: string | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
    cost_price?: number | null;
    profit?: number | null;
  }>;
  payments: Array<{
    id: number;
    method: string;
    amount: number;
    reference?: string | null;
    paid_at: string;
  }>;
};
