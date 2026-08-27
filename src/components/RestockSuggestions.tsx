import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Layers, 
  Loader2, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  ArrowRight,
  RefreshCw,
  Boxes,
  Tag,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { executeDelete } from '@/lib/deleteHelper';
import ERPExpress from './ERPExpress';
import ERPExpressLite from './ERPExpressLite';

export default function RestockSuggestions() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [activeTab, setActiveTab] = React.useState<'external' | 'inventory'>('external');
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [restockingId, setRestockingId] = React.useState<string | null>(null);
  const [customRestockQty, setCustomRestockQty] = React.useState<{ [key: string]: number }>({});
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'products'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Product[];
      setProducts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await executeDelete('products', id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir produto:", error);
      setIsDeleting(null);
      alert('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleQuickRestock = async (product: Product, addAmount: number) => {
    if (!currentWorkspace || addAmount <= 0) return;
    setRestockingId(product.id);

    try {
      const currentStock = Number(product.stock) || 0;
      const newStock = currentStock + addAmount;

      await updateDoc(doc(db, 'products', product.id), {
        stock: newStock,
        updatedAt: serverTimestamp()
      });

      setSuccessMessage(`Estoque de "${product.name}" atualizado para ${newStock} unidades (+${addAmount})!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setRestockingId(null);
    }
  };

  // Restock suggestions from ERP products: stock <= minStock (default minStock = 5)
  const suggestions = React.useMemo(() => {
    return products.filter(p => {
      const stockVal = Number(p.stock) || 0;
      const minVal = Number(p.minStock ?? 5);
      return stockVal <= minVal;
    });
  }, [products]);

  const outOfStockItems = React.useMemo(() => suggestions.filter(p => (Number(p.stock) || 0) <= 0), [suggestions]);
  const lowStockItems = React.useMemo(() => suggestions.filter(p => (Number(p.stock) || 0) > 0), [suggestions]);

  // Total estimated restock budget needed
  const totalRestockBudget = React.useMemo(() => {
    return suggestions.reduce((acc, p) => {
      const stockVal = Number(p.stock) || 0;
      const minVal = Number(p.minStock ?? 5);
      const suggestedUnits = Math.max(1, (minVal * 2) - stockVal);
      const cost = Number(p.costPrice) || 0;
      return acc + (suggestedUnits * cost);
    }, 0);
  }, [suggestions]);

  const totalProjectedSalesValue = React.useMemo(() => {
    return suggestions.reduce((acc, p) => {
      const stockVal = Number(p.stock) || 0;
      const minVal = Number(p.minStock ?? 5);
      const suggestedUnits = Math.max(1, (minVal * 2) - stockVal);
      const price = Number(p.salePrice) || Number(p.price) || 0;
      return acc + (suggestedUnits * price);
    }, 0);
  }, [suggestions]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight text-neutral-900">ERP Express & Alertas</h2>
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 font-bold">
              SINCRONIZADO
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Gerenciamento completo de estoque, custos, preços de venda e alertas de reposição integrados.
          </p>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-2">
          {activeTab === 'inventory' && (
            <Button
              onClick={() => setActiveTab('external')}
              variant="outline"
              className="rounded-xl font-bold h-10 border-neutral-300 hover:bg-neutral-100 text-xs"
            >
              <Layers className="w-4 h-4 mr-2 text-emerald-600" />
              Abrir Painel ERP Express
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 p-1.5 bg-neutral-200/60 rounded-2xl w-fit shadow-xs">
        <Button 
          variant={activeTab === 'external' ? 'default' : 'ghost'} 
          className={cn(
            "rounded-xl h-11 px-6 font-black text-sm flex items-center gap-2 transition-all",
            activeTab === 'external' ? "bg-neutral-900 text-white shadow-md" : "text-neutral-600 hover:text-neutral-900"
          )}
          onClick={() => setActiveTab('external')}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>{plan?.permissions?.erpExpressEnabled ? 'ERP Express Pro' : 'ERP Express Lite'}</span>
          <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] ml-1 py-0 px-2 border-none font-bold">
            {products.length} {products.length === 1 ? 'Produto' : 'Produtos'}
          </Badge>
        </Button>

        <Button 
          variant={activeTab === 'inventory' ? 'default' : 'ghost'} 
          className={cn(
            "rounded-xl h-11 px-6 font-black text-sm flex items-center gap-2 transition-all",
            activeTab === 'inventory' ? "bg-neutral-900 text-white shadow-md" : "text-neutral-600 hover:text-neutral-900"
          )}
          onClick={() => setActiveTab('inventory')}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Alertas de Reposição</span>
          {suggestions.length > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] ml-1 py-0 px-2 border-none font-black animate-pulse">
              {suggestions.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* TAB 1: ERP Express (Full ERP if plan has permissions, otherwise ERP Lite with essential options) */}
      {activeTab === 'external' && (
        <div className="mt-4">
          {plan?.permissions?.erpExpressEnabled || (plan?.permissions?.externalRestockIntegration && plan?.permissions?.externalRestockIntegration !== 'none') ? (
            <ERPExpress />
          ) : (
            <ERPExpressLite />
          )}
        </div>
      )}

      {/* TAB 2: Alertas de Reposição (Directly Linked to ERP Express data) */}
      {activeTab === 'inventory' && (
        <div className="mt-4 space-y-6">
          {/* KPI Cards for Restock Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-xs bg-white p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Produtos no ERP</span>
                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-700">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black italic serif text-neutral-900 mt-2">{products.length}</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Cadastrados no ERP Express</p>
            </Card>

            <Card className="border shadow-xs bg-white p-5 rounded-2xl border-destructive/20 bg-destructive/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-destructive uppercase tracking-wider">Estoque Zerado</span>
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black italic serif text-destructive mt-2">{outOfStockItems.length}</p>
              <p className="text-xs text-destructive/80 font-medium mt-1">Itens esgotados</p>
            </Card>

            <Card className="border shadow-xs bg-white p-5 rounded-2xl border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Abaixo do Mínimo</span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <RefreshCw className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black italic serif text-amber-700 mt-2">{suggestions.length}</p>
              <p className="text-xs text-amber-600 font-medium mt-1">Precisam de reposição</p>
            </Card>

            <Card className="border shadow-xs bg-white p-5 rounded-2xl border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Investimento Estimado</span>
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black italic serif text-emerald-700 mt-2">
                R$ {totalRestockBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">Preço de custo no ERP</p>
            </Card>
          </div>

          {/* List of Products Needing Restock */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Produtos com Alerta de Reposição Ativo
              </h3>
              <span className="text-xs font-bold text-neutral-400">
                {suggestions.length} {suggestions.length === 1 ? 'item necessita' : 'itens necessitam'} de compra
              </span>
            </div>

            {suggestions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed p-8 shadow-xs">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-neutral-900">Estoque Saudável</h4>
                <p className="text-neutral-500 text-sm max-w-md mt-1">
                  Todos os produtos cadastrados no ERP Express estão dentro ou acima do nível mínimo de estoque.
                </p>
                <Button 
                  onClick={() => setActiveTab('external')}
                  className="mt-6 font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl"
                >
                  <Layers className="w-4 h-4 mr-2 text-emerald-400" />
                  Ir para o ERP Express
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {suggestions.map((product) => {
                  const currentStock = Number(product.stock) || 0;
                  const minStock = Number(product.minStock ?? 5);
                  const isZero = currentStock <= 0;
                  const costPrice = Number(product.costPrice) || 0;
                  const salePrice = Number(product.salePrice) || Number(product.price) || 0;
                  const unitsPerBox = Number(product.unitsPerBox) || 1;
                  const suggestedUnits = Math.max(1, (minStock * 2) - currentStock);
                  const suggestedBoxes = Math.ceil(suggestedUnits / unitsPerBox);
                  const estimatedCost = suggestedUnits * costPrice;
                  const profitVal = salePrice - costPrice;
                  const customQty = customRestockQty[product.id] ?? suggestedUnits;

                  return (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "rounded-2xl border-2 transition-all bg-white shadow-xs overflow-hidden",
                        isZero ? "border-destructive/30 bg-destructive/[0.02]" : "border-amber-200/80"
                      )}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          {/* Product Info */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
                              isZero ? "bg-destructive text-white" : "bg-amber-500 text-white"
                            )}>
                              <Package className="w-6 h-6" />
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {product.code && (
                                  <Badge variant="outline" className="font-mono text-xs text-neutral-600 bg-neutral-50">
                                    {product.code}
                                  </Badge>
                                )}
                                <h4 className="text-lg font-black text-neutral-900">{product.name}</h4>
                                {isZero ? (
                                  <Badge variant="destructive" className="font-bold text-[10px] uppercase">
                                    Zerado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[10px] uppercase">
                                    Estoque Baixo
                                  </Badge>
                                )}
                                {product.type && (
                                  <Badge variant="outline" className="text-[10px] text-neutral-500">
                                    {product.type}
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-neutral-600 pt-2">
                                <div>
                                  <span className="text-neutral-400 block font-medium">Estoque Atual:</span>
                                  <strong className={cn("text-sm", isZero ? "text-destructive font-black" : "text-amber-600 font-bold")}>
                                    {currentStock} {product.unit || 'UN'}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-medium">Estoque Mínimo:</span>
                                  <strong className="text-sm font-bold text-neutral-800">{minStock} {product.unit || 'UN'}</strong>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-medium">Preço de Custo (ERP):</span>
                                  <strong className="text-sm font-bold text-neutral-800">R$ {costPrice.toFixed(2)}</strong>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-medium">Preço de Venda:</span>
                                  <strong className="text-sm font-bold text-emerald-700">R$ {salePrice.toFixed(2)}</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Suggested Reposition & Investment */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t lg:border-t-0 lg:border-l lg:pl-6 pt-4 lg:pt-0 border-neutral-100 shrink-0">
                            <div className="bg-neutral-50 p-3 rounded-xl space-y-1 min-w-[140px]">
                              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Sugestão de Compra</p>
                              <p className="text-xl font-black text-primary">
                                +{suggestedUnits} <span className="text-xs font-bold text-neutral-600">{product.unit || 'un'}</span>
                              </p>
                              {product.stockControl === 'box' && unitsPerBox > 1 && (
                                <p className="text-[10px] text-neutral-500 font-medium">
                                  ({suggestedBoxes} {suggestedBoxes === 1 ? 'caixa' : 'caixas'} de {unitsPerBox} un)
                                </p>
                              )}
                              <p className="text-[10px] text-emerald-700 font-bold">
                                Custo Est.: R$ {estimatedCost.toFixed(2)}
                              </p>
                            </div>

                            {/* Quick Restock Actions */}
                            {canEdit && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    disabled={restockingId === product.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl h-9 px-3 shadow-xs"
                                    onClick={() => handleQuickRestock(product, suggestedUnits)}
                                  >
                                    {restockingId === product.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        Repor Sugerido (+{suggestedUnits})
                                      </>
                                    )}
                                  </Button>

                                  {product.stockControl === 'box' && unitsPerBox > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={restockingId === product.id}
                                      className="font-bold text-xs rounded-xl h-9 px-2.5 border-neutral-300"
                                      onClick={() => handleQuickRestock(product, unitsPerBox)}
                                      title={`Adicionar 1 Caixa (+${unitsPerBox} un)`}
                                    >
                                      +1 Cx ({unitsPerBox})
                                    </Button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    min="1"
                                    className="h-8 w-20 text-xs font-bold bg-white text-center rounded-lg"
                                    value={customQty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      setCustomRestockQty({
                                        ...customRestockQty,
                                        [product.id]: isNaN(val) ? 1 : Math.max(1, val)
                                      });
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={restockingId === product.id}
                                    className="font-bold text-xs rounded-xl h-8 px-2 border-neutral-300 hover:bg-neutral-100 flex-1"
                                    onClick={() => handleQuickRestock(product, customQty)}
                                  >
                                    + Adicionar Qtd
                                  </Button>
                                </div>
                              </div>
                            )}

                            {(canEdit || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isDeleting === product.id}
                                className="text-neutral-400 hover:text-destructive self-end sm:self-center"
                                onClick={() => handleDelete(product.id)}
                                title="Excluir produto do ERP"
                              >
                                {isDeleting === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
