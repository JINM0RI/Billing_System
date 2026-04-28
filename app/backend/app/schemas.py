from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class BootstrapRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    full_name: str | None = None
    password: str = Field(min_length=8)


class AuthStatus(BaseModel):
    has_users: bool
    has_admin: bool


class RoleRead(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRead(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    role: RoleRead
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    full_name: str | None = None
    password: str = Field(min_length=8)
    role_id: int
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=8)
    role_id: int | None = None
    is_active: bool | None = None


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=80)
    unit_price: float = Field(ge=0)
    tax_rate: float = Field(ge=0, le=1)
    low_stock_threshold: int = Field(ge=0)
    is_active: bool = True


class ProductCreate(ProductBase):
    initial_stock: int = Field(default=0, ge=0)
    storage_location_id: int | None = None


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=80)
    unit_price: float | None = Field(default=None, ge=0)
    tax_rate: float | None = Field(default=None, ge=0, le=1)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductRead(ProductBase):
    id: int
    created_at: datetime
    current_stock: int = 0
    storage_location: str | None = None

    model_config = ConfigDict(from_attributes=True)


class StorageLocationBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    location_type: str = Field(min_length=1, max_length=50)
    capacity: int = Field(ge=0)
    utilization: int = Field(ge=0)
    is_active: bool = True


class StorageLocationCreate(StorageLocationBase):
    pass


class StorageLocationRead(StorageLocationBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)


class InvoiceCreate(BaseModel):
    customer_name: str | None = None
    employee_id: int
    items: list[InvoiceItemCreate]
    discount_amount: float = Field(default=0, ge=0)
    payment_method: str = Field(default="cash", min_length=1)
    payment_reference: str | None = None
    tax_rate_override: float | None = Field(default=None, ge=0, le=1)


class InvoiceItemRead(BaseModel):
    id: int
    product_id: int
    description: str | None = None
    quantity: int
    unit_price: float
    tax_rate: float
    line_total: float

    model_config = ConfigDict(from_attributes=True)


class PaymentRead(BaseModel):
    id: int
    method: str
    amount: float
    reference: str | None = None
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceRead(BaseModel):
    id: int
    invoice_number: str
    customer_name: str | None = None
    employee_id: int
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    payment_status: str
    created_at: datetime
    items: list[InvoiceItemRead] = Field(default_factory=list)
    payments: list[PaymentRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    total_revenue: float
    invoice_count: int
    low_stock_count: int
    active_products: int
    total_employees: int
