import * as React from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Sparkles, 
  Layers,
  Box,
  CheckCircle2,
  X,
  Crown,
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Product } from '@/types';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { executeDelete } from '@/lib/deleteHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { getWhatsAppSupportUrl } from '@/lib/support';

const DEFAULT_CATEGORIES = [
  'Geral',
  'Alimentos',
  'Bebidas',
  'Eletrônicos',
  'Vestuário',
  'Limpeza',
  'Cosméticos',
  'Outros'
];

interface ERPExpressLiteProps {
  onUpgradeClick?: () => void;
}

export default function ERPExpressLite({ onUpgradeClick }: ERPExpressLiteProps) {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [stockFilter, setStockFilter] = React.useState<'all' | 'low' | 'out'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Simplified Form State
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('Geral');
  const [salePrice, setSalePrice] = React.useState<number | string>('');
  const [stock, setStock] = React.useState<number | string>('');
  const [minStock, setMinStock] = React.useState<number | string>(5);

  React.useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);

    const q = query(
      collection(db, 'products'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const sale = Number(data.salePrice ?? data.price ?? 0);
        
        return {
          id: docSnap.id,
          code: data.code || `PRD-${docSnap.id.substring(0, 4).toUpperCase()}`,
          name: data.name || 'Produto Sem Nome',
          type: data.type || 'Geral',
          costPrice: Number(data.costPrice || 0),
          salePrice: sale,
          profitPercentage: Number(data.profitPercentage || 0),
          stock: Number(data.stock || 0),
          unit: data.unit || 'un',
          costBasis: data.costBasis || 'unit',
          stockControl: data.stockControl || 'measure',
          unitsPerBox: Number(data.unitsPerBox || 1),
          minStock: Number(data.minStock ?? 5),
          price: sale,
          workspaceId: data.workspaceId || currentWorkspace.id,
          userId: data.userId || '',
          ownerId: data.ownerId || '',
          createdAt: data.createdAt || new Date().toISOString()
        } as Product;
      });

      setProducts(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const generateAutoCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setCode(`PRD-${randomNum}`);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    generateAutoCode();
    setName('');
    setType('Geral');
    setSalePrice('');
    setStock('');
    setMinStock(5);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setType(p.type || 'Geral');
    setSalePrice(p.salePrice);
    setStock(p.stock);
    setMinStock(p.minStock ?? 5);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !auth.currentUser) return;

    const numSale = parseFloat(String(salePrice)) || 0;
    const numStock = parseInt(String(stock), 10) || 0;
    const numMinStock = parseInt(String(minStock), 10) || 0;

    const payload = {
      code: code.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      type,
      costPrice: editingProduct?.costPrice || 0,
      salePrice: numSale,
      profitPercentage: editingProduct?.profitPercentage || 0,
      stock: numStock,
      unit: 'un',
      costBasis: 'unit',
      stockControl: 'measure',
      unitsPerBox: 1,
      minStock: numMinStock,
      price: numSale,
      userId: auth.currentUser.uid,
      ownerId: auth.currentUser.uid,
      workspaceId: currentWorkspace.id,
      createdAt: editingProduct?.createdAt || new Date().toISOString()
    };

    setIsSavingProduct(true);
    try {
      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
      } else {
        await addDoc(collection(db, 'products'), payload);
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleQuickStockAdjust = async (p: Product, delta: number) => {
    if (!p.id || !canEdit) return;
    const newStock = Math.max(0, p.stock + delta);
    try {
      await updateDoc(doc(db, 'products', p.id), {
        stock: newStock
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${p.id}`);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!confirm(`Deseja realmente excluir o produto "${prodName}"?`)) return;
    setIsDeleting(id);
    try {
      await executeDelete('products', id);
    } catch (error: any) {
      alert('Erro ao excluir produto: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(null);
    }
  };

  // KPIs
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSaleValue = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);
  const outOfStockCount = products.filter(p => p.stock <= 0).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5)).length;

  const categoriesList = Array.from(new Set(['all', ...DEFAULT_CATEGORIES, ...products.map(p => p.type)]));

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory;
    
    let matchesStock = true;
    if (stockFilter === 'out') matchesStock = p.stock <= 0;
    if (stockFilter === 'low') matchesStock = p.stock > 0 && p.stock <= (p.minStock ?? 5);

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Banner ERP Lite */}
      <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-primary/10 border border-amber-300/60 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-neutral-900">ERP Express Lite</h3>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]">
                MODO SIMPLIFICADO
              </Badge>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5">
              Controle essencial de produtos, preços de venda e estoque rápido disponível no seu plano.
            </p>
          </div>
        </div>

        <a
          href="https://wa.me/5541996679075?text=solicito%20a%20mudanca%20da%20minha%20assinatura%20(para%20a%20assinatura%20Pro)"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 hover:scale-105"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Desbloquear ERP Express Pro</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </a>
      </div>

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-neutral-900">Meus Produtos (ERP Lite)</h2>
          <p className="text-xs text-muted-foreground">Cadastre produtos e controle o estoque do dia a dia.</p>
        </div>

        {canEdit && (
          <Button
            onClick={handleOpenAdd}
            className="rounded-xl font-bold bg-neutral-900 hover:bg-neutral-800 text-white h-10 px-4 text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Cadastrar Produto
          </Button>
        )}
      </div>

      {/* Simplified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-neutral-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Total de Produtos</p>
              <h4 className="text-xl font-black text-neutral-900">{totalProducts}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-neutral-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Itens em Estoque</p>
              <h4 className="text-xl font-black text-emerald-700">{totalStockUnits} un</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-neutral-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Valor em Estoque</p>
              <h4 className="text-xl font-black text-neutral-900">
                R$ {totalSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-neutral-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              outOfStockCount > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            )}>
              {outOfStockCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Estoque Crítico</p>
              <h4 className={cn("text-xl font-black", outOfStockCount > 0 ? "text-red-600" : "text-neutral-900")}>
                {outOfStockCount} zerados
              </h4>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <Input
            placeholder="Buscar produto ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-neutral-50 border-neutral-200 text-xs font-medium"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700"
          >
            <option value="all">Todas Categorias</option>
            {categoriesList.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="h-9 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700"
          >
            <option value="all">Todo o Estoque</option>
            <option value="low">Estoque Baixo</option>
            <option value="out">Esgotados</option>
          </select>
        </div>
      </div>

      {/* Simplified Products Table */}
      <Card className="rounded-2xl border border-neutral-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-3 px-4">Código / Produto</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Preço de Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= (p.minStock ?? 5);

                return (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md border border-neutral-200">
                            {p.code}
                          </span>
                          <span className="font-bold text-neutral-900 text-sm">{p.name}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="outline" className="bg-neutral-50 font-medium text-xs">
                        {p.type}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-neutral-900">
                      R$ {p.salePrice.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          {canEdit && (
                            <button
                              onClick={() => handleQuickStockAdjust(p, -1)}
                              className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-xs"
                              title="Diminuir 1 un"
                            >
                              -
                            </button>
                          )}
                          <span className={cn(
                            "font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border",
                            isOutOfStock ? "bg-red-50 text-red-700 border-red-200" :
                            isLowStock ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-neutral-50 text-neutral-800 border-neutral-200"
                          )}>
                            {p.stock} un
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleQuickStockAdjust(p, 1)}
                              className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-xs"
                              title="Aumentar 1 un"
                            >
                              +
                            </button>
                          )}
                        </div>
                        {isOutOfStock && <span className="text-[10px] font-bold text-red-600 mt-0.5">Esgotado</span>}
                        {isLowStock && <span className="text-[10px] font-bold text-amber-600 mt-0.5">Mín: {p.minStock ?? 5}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-neutral-600 hover:text-neutral-900"
                            onClick={() => handleOpenEdit(p)}
                            title="Editar Produto"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}
                        {(canEdit || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting === p.id}
                            className="h-8 w-8 rounded-lg text-neutral-400 hover:text-red-600"
                            onClick={() => p.id && handleDeleteProduct(p.id, p.name)}
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-neutral-700 text-sm">Nenhum produto cadastrado</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Clique em "+ Cadastrar Produto" para começar.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Simplified Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-md w-full overflow-hidden"
            >
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                    <Box className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-black text-neutral-900">
                    {editingProduct ? 'Editar Produto (Lite)' : 'Novo Produto (Lite)'}
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="rounded-lg h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                    <span>Código / SKU *</span>
                    <button 
                      type="button" 
                      onClick={generateAutoCode}
                      className="text-[10px] text-emerald-600 hover:underline font-bold flex items-center gap-0.5"
                    >
                      <Sparkles className="w-3 h-3" /> Gerar Código
                    </button>
                  </label>
                  <Input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ex: PRD-1010"
                    className="font-mono uppercase font-bold h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Nome do Produto *</label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Camiseta Básica Algodão"
                    className="h-10 rounded-xl font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Categoria *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Preço de Venda (R$) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="0.00"
                      className="h-10 rounded-xl font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Estoque Inicial *</label>
                    <Input
                      type="number"
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0"
                      className="h-10 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Alerta de Estoque Mínimo</label>
                  <Input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="5"
                    className="h-10 rounded-xl font-bold"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-10 text-xs font-bold">
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSavingProduct}
                    className="rounded-xl h-10 px-5 text-xs font-black bg-neutral-900 hover:bg-neutral-800 text-white"
                  >
                    {isSavingProduct ? 'Salvando...' : editingProduct ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
