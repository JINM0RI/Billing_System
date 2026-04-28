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
  unit_price: number;
  tax_rate: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  current_stock: number;
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

export type StorageLocation = {
  id: number;
  name: string;
  location_type: string;
  capacity: number;
  utilization: number;
  is_active: boolean;
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
  payment_status: string;
  created_at: string;
  items: Array<{
    id: number;
    product_id: number;
    description?: string | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
  }>;
  payments: Array<{
    id: number;
    method: string;
    amount: number;
    reference?: string | null;
    paid_at: string;
  }>;
};
