import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { TrendingUp, ShoppingBag, Users, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Product, Promotion } from '@/types';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const ordersQ = query(collection(db, 'orders'), where('workspaceId', '==', currentWorkspace.id));
    const productsQ = query(collection(db, 'products'), where('workspaceId', '==', currentWorkspace.id));
    const promosQ = query(collection(db, 'promotions'), where('workspaceId', '==', currentWorkspace.id));

    const unsubOrders = onSnapshot(ordersQ, (s) => setOrders(s.docs.map(d => d.data() as Order)));
    const unsubProducts = onSnapshot(productsQ, (s) => setProducts(s.docs.map(d => d.data() as Product)));
    const unsubPromos = onSnapshot(promosQ, (s) => setPromotions(s.docs.map(d => d.data() as Promotion)));

    return () => {
      unsubOrders();
      unsubProducts();
      unsubPromos();
    };
  }, [currentWorkspace]);

  const [stats, setStats] = React.useState({
    totalSales: 0,
    pendingOrders: 0,
    lowStock: 0,
    activePromos: 0,
  });

  const [chartData, setChartData] = React.useState<any[]>([
    { name: 'Seg', sales: 0 },
    { name: 'Ter', sales: 0 },
    { name: 'Qua', sales: 0 },
    { name: 'Qui', sales: 0 },
    { name: 'Sex', sales: 0 },
    { name: 'Sáb', sales: 0 },
  ]);

  React.useEffect(() => {
    // Calculate via backend analytics engine
    fetch('/api/erp/calculate-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders, products, promotions })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.stats) {
          setStats(data.stats);
        }
        if (data?.chartData) {
          setChartData(data.chartData);
        }
      })
      .catch(err => {
        console.warn('Backend calculation fallback:', err);
        const totalSales = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        setStats({
          totalSales,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          lowStock: products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length,
          activePromos: promotions.filter(p => Boolean(p.active)).length,
        });
      });
  }, [orders, products, promotions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral do seu negócio em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Vendas Totais" 
          value={`R$ ${stats.totalSales.toLocaleString()}`} 
          icon={<TrendingUp className="w-4 h-4" />}
          trend="+12.5%"
          trendUp={true}
        />
        <StatCard 
          title="Pedidos Pendentes" 
          value={stats.pendingOrders.toString()} 
          icon={<ShoppingBag className="w-4 h-4" />}
          trend="Fluxo normal"
          trendUp={true}
        />
        <StatCard 
          title="Estoque Crítico" 
          value={stats.lowStock.toString()} 
          icon={<AlertCircle className="w-4 h-4" />}
          trend={stats.lowStock > 0 ? "Ação necessária" : "Tudo ok"}
          trendUp={false}
          warning={stats.lowStock > 0}
        />
        <StatCard 
          title="Promoções Ativas" 
          value={stats.activePromos.toString()} 
          icon={<Users className="w-4 h-4" />}
          trend="Impacto alto"
          trendUp={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-medium">Desempenho de Vendas (Semana)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full relative">
              <div className="absolute inset-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-medium">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full relative">
              <div className="absolute inset-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <BarChart data={[
                    { name: 'Pendente', count: stats.pendingOrders },
                    { name: 'Enviado', count: orders.filter(o => o.status === 'shipped').length },
                    { name: 'Entregue', count: orders.filter(o => o.status === 'delivered').length },
                    { name: 'Cancelado', count: orders.filter(o => o.status === 'cancelled').length },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f8f8f8'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendUp, warning }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
            {icon}
          </div>
          <div className={cn(
            "flex items-center text-xs font-medium",
            warning ? "text-destructive" : trendUp ? "text-emerald-600" : "text-neutral-500"
          )}>
            {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
