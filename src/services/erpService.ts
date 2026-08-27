import { ERPData, Product, Order } from '../types';

export const erpService = {
  getDashboardData: async (workspaceId?: string): Promise<ERPData> => {
    try {
      const url = workspaceId ? `/api/erp/dashboard?workspaceId=${encodeURIComponent(workspaceId)}` : '/api/erp/dashboard';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Falha ao obter dados do backend');
      }
      return await response.json();
    } catch (error) {
      console.error('[ERP Service] Erro ao carregar dados do backend:', error);
      return {
        orders: [],
        products: [],
        stats: {
          dailySales: 0,
          monthlySales: 0,
          pendingOrders: 0,
          activePromotions: 0
        }
      };
    }
  },

  calculateStats: async (orders: Order[], products: Product[], promotions: any[]) => {
    try {
      const response = await fetch('/api/erp/calculate-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, products, promotions })
      });
      if (!response.ok) throw new Error('Falha ao processar estatísticas no backend');
      return await response.json();
    } catch (error) {
      console.error('[ERP Service] Erro no cálculo de estatísticas:', error);
      return null;
    }
  },
  
  getRestockSuggestions: (products: Product[]) => {
    return products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
  }
};

