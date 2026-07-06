export type CategoryId =
  | "pizza"
  | "burgers"
  | "pasta"
  | "salads"
  | "desserts"
  | "drinks"
  | "sides";

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
}

export interface Allergen {
  code: string;
  name: string;
}

export interface ProductSize {
  id: string;
  label: string; // e.g. "32 cm"
  priceDelta: number; // added to base price
}

export type Badge =
  | "recommended"
  | "spicy"
  | "vegetarian"
  | "new"
  | "bestseller";

export interface Product {
  id: string;
  restaurantId: string;
  category: CategoryId;
  name: string;
  description: string;
  image: string;
  basePrice: number; // price for default/first size
  sizes: ProductSize[];
  ingredients: string[];
  allergens: string[];
  badges: Badge[];
  available: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  minimumOrder: number; // €
  deliveryFee: number; // €
  estimatedMinutes: number;
  // list of "street" or "village" names that belong to this zone
  areas: string[];
}

export interface OpeningHours {
  // 0 = Monday ... 6 = Sunday
  day: number;
  open: string; // "10:30"
  close: string; // "22:00"
  closed?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  image: string;
  gallery: string[];
  lat: number;
  lng: number;
  prepTimeMinutes: number;
  openingHours: OpeningHours[];
  deliveryZones: DeliveryZone[];
  accent: string; // hex accent unique to restaurant
}

export interface Coupon {
  code: string;
  restaurantId: string | "all";
  type: "percentage" | "fixed" | "free_delivery";
  value: number; // percent or euros
  minSubtotal: number;
  label: string;
}

// ---- Cart & order ----

export interface CartLine {
  lineId: string;
  productId: string;
  restaurantId: string;
  name: string;
  image: string;
  sizeId: string;
  sizeLabel: string;
  unitPrice: number; // includes size + extras, per single item
  quantity: number;
  extraCheese: boolean;
  stuffedCrust: boolean;
  addedIngredients: string[];
  removedIngredients: string[];
  note?: string;
}

export type OrderStatus =
  | "received"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivering"
  | "delivered"
  | "cancelled";

export type FulfillmentType = "delivery" | "pickup";

export interface CustomerAddress {
  street: string;
  houseNumber: string;
  city: string;
  zip: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  createdAt: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  customerName: string;
  phone: string;
  email: string;
  address?: CustomerAddress;
  zoneName?: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: string;
  note?: string;
  eta: number; // minutes
}
