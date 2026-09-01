export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  jobTitle?: string;
  phoneNumber?: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  planId: 'base' | 'intermediate' | 'pro';
  erpExpressEnabled?: boolean;
  customPermissions?: Partial<Plan['permissions']>;
  createdAt: any;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  permissions: {
    maxWorkspaces: number;
    maxMembers: number;
    competitorHistoryMonths: number;
    aiAssistantEnabled: boolean;
    whiteboardEnabled: boolean;
    googleCalendarEnabled: boolean;
    canDeleteMessages: boolean;
    chatUploadEnabled: boolean;
    chatLinksEnabled: boolean;
    canExportData: boolean;
    advancedScheduling: boolean;
    spreadsheetEnabled: boolean;
    spreadsheetMaxSheets: number;
    spreadsheetMaxRows: number;
    spreadsheetMaxColumns: number;
    spreadsheetExportEnabled: boolean;
    spreadsheetImageUploadEnabled: boolean;
    spreadsheetAdvancedStyles: boolean;
    spreadsheetRealtimeCollaboration: boolean;
    maxPostIts: number;
    externalRestockIntegration: 'none' | 'basic' | 'pro';
    erpExpressEnabled?: boolean;
  };
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  members: Record<string, { role: 'view' | 'edit' | 'admin', email: string, name: string }>;
  chatbotConfig?: {
    url?: string;
    enabled: boolean;
  };
  inventoryExternalUrl?: string;
  createdAt: any;
}

export interface Spreadsheet {
  id: string;
  name: string;
  data: any[][];
  workspaceId: string;
  ownerId?: string;
  userId?: string;
  updatedAt: any;
  updatedBy: string;
}

export interface PostIt {
  id: string;
  content: string;
  color: string;
  createdAt: any;
  userId: string;
  ownerId?: string;
  workspaceId: string;
  x?: number;
  y?: number;
}

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardLine {
  id: string;
  workspaceId: string;
  userId: string;
  ownerId?: string;
  toolType: 'freehand' | 'straight' | 'arrow';
  color: string;
  strokeWidth: number;
  points: WhiteboardPoint[];
  createdAt: any;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discount: string;
  startDate: string;
  endDate: string;
  active: boolean;
  userId: string;
  ownerId?: string;
  workspaceId: string;
}

export interface Order {
  id: string;
  customerName: string;
  total: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  deadline: string;
  userId: string;
  ownerId?: string;
  workspaceId: string;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  location?: string;
  startTime: string;
  endTime: string;
  observations: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  outcome?: 'pending' | 'sold' | 'followup' | 'declined';
  convertedOrderId?: string;
  googleEventId?: string;
  userId?: string;
  ownerId?: string;
  workspaceId: string;
  createdAt?: any;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  category?: 'prospect' | 'active' | 'vip' | 'inactive';
  notes?: string;
  address?: string;
  totalVisits?: number;
  lastVisitDate?: string;
  workspaceId: string;
  userId?: string;
  ownerId?: string;
  createdAt?: any;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  type: string;
  costPrice: number;
  salePrice: number;
  profitPercentage: number;
  stock: number;
  unit: 'un' | 'kg' | 'g' | 'l' | 'ml';
  costBasis: 'unit' | 'weight';
  stockControl?: 'measure' | 'box';
  unitsPerBox?: number;
  minStock?: number;
  price?: number;
  userId?: string;
  ownerId?: string;
  workspaceId: string;
  createdAt?: any;
}

export interface Competitor {
  id: string;
  date: string;
  name: string;
  location: string;
  averagePrice: number;
  promotions: string;
  strengths: string;
  weaknesses: string;
  movement: 'low' | 'medium' | 'high';
  observations: string;
  userId: string;
  ownerId?: string;
  workspaceId: string;
  createdAt: any;
}

export interface ERPData {
  orders: Order[];
  products: Product[];
  stats: {
    dailySales: number;
    monthlySales: number;
    pendingOrders: number;
    activePromotions: number;
  };
}

export interface Message {
  id: string;
  workspaceId: string;
  text: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: any;
}

export interface ShippingOption {
  id: string;
  name: string; // 'Motoboy Express', 'SEDEX', 'PAC', 'Transportadora Rodoviária', 'Frota Própria', 'Retirada no Balcão'
  carrier: string; // 'Loggi / Motoboy', 'Correios', 'Jadlog / Braspress', 'Empresa', 'Loja'
  deliveryDays: string; // 'Hoje em até 2h', '1 a 2 dias úteis', '4 a 7 dias úteis'
  price: number;
  originalCost?: number;
  notes?: string;
  selected?: boolean;
}

export interface ShippingQuote {
  id: string;
  code?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientId?: string;
  originCep: string;
  originCity?: string;
  originState?: string;
  originAddress?: string;
  destinationCep: string;
  destinationCity?: string;
  destinationState?: string;
  destinationNeighborhood?: string;
  destinationAddress?: string;
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  declaredValue?: number;
  packagingFee?: number;
  notes?: string;
  options: ShippingOption[];
  selectedOption?: string; // option id or name
  totalSelectedPrice?: number;
  status: 'pending' | 'approved' | 'rejected' | 'delivered';
  convertedOrderId?: string;
  userId?: string;
  ownerId?: string;
  workspaceId: string;
  createdAt?: any;
  updatedAt?: any;
}
