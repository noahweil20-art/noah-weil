import * as React from 'react';
import { 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  Edit3, 
  Package, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Download, 
  Sparkles, 
  Layers,
  Box,
  Scale,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  X
} from 'lucide-react';
import { Product } from '@/types';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { executeDelete } from '@/lib/deleteHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = [
  'Geral',
  'Alimentos',
  'Bebidas',
  'Eletrônicos',
  'Vestuário',
  'Limpeza',
  'Cosméticos',
  'Serviços',
  'Embalagens',
  'Outros'
];

export default function ERPExpress() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedUnit, setSelectedUnit] = React.useState<string>('all');
  const [stockFilter, setStockFilter] = React.useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'profit' | 'stockAsc' | 'stockDesc' | 'salePrice'>('name');

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Form State
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('Geral');
  const [customType, setCustomType] = React.useState('');
  const [unit, setUnit] = React.useState<'un' | 'kg' | 'g' | 'l' | 'ml'>('un');
  const [costBasis, setCostBasis] = React.useState<'unit' | 'weight'>('unit');
  const [stockControl, setStockControl] = React.useState<'measure' | 'box'>('measure');
  const [unitsPerBox, setUnitsPerBox] = React.useState<number | string>(1);
  const [costPrice, setCostPrice] = React.useState<number | string>('');
  const [salePrice, setSalePrice] = React.useState<number | string>('');
  const [profitPercentage, setProfitPercentage] = React.useState<number | string>('');
  const [stock, setStock] = React.useState<number | string>('');
  const [minStock, setMinStock] = React.useState<number | string>(5);

  // Load products from Firestore
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
        const cost = Number(data.costPrice ?? data.price ?? 0);
        const sale = Number(data.salePrice ?? data.price ?? 0);
        const profit = Number(data.profitPercentage ?? (cost > 0 ? ((sale - cost) / cost) * 100 : 0));
        
        return {
          id: docSnap.id,
          code: data.code || `PRD-${docSnap.id.substring(0, 4).toUpperCase()}`,
          name: data.name || 'Produto Sem Nome',
          type: data.type || 'Geral',
          costPrice: cost,
          salePrice: sale,
          profitPercentage: profit,
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
    setCustomType('');
    setUnit('un');
    setCostBasis('unit');
    setStockControl('measure');
    setUnitsPerBox(1);
    setCostPrice('');
    setSalePrice('');
    setProfitPercentage('');
    setStock('');
    setMinStock(5);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    if (DEFAULT_CATEGORIES.includes(p.type)) {
      setType(p.type);
      setCustomType('');
    } else {
      setType('Outros');
      setCustomType(p.type);
    }
    setUnit(p.unit);
    setCostBasis(p.costBasis);
    setStockControl(p.stockControl || 'measure');
    setUnitsPerBox(p.unitsPerBox || 1);
    setCostPrice(p.costPrice);
    setSalePrice(p.salePrice);
    setProfitPercentage(p.profitPercentage.toFixed(1));
    setStock(p.stock);
    setMinStock(p.minStock ?? 5);
    setIsModalOpen(true);
  };

  // Profit/Sale Price bidirectional calculators
  const handleCostPriceChange = (val: string) => {
    setCostPrice(val);
    const numCost = parseFloat(val) || 0;
    const numSale = parseFloat(String(salePrice)) || 0;
    if (numCost > 0 && numSale >= 0) {
      const margin = ((numSale - numCost) / numCost) * 100;
      setProfitPercentage(margin.toFixed(1));
    }
  };

  const handleSalePriceChange = (val: string) => {
    setSalePrice(val);
    const numSale = parseFloat(val) || 0;
    const numCost = parseFloat(String(costPrice)) || 0;
    if (numCost > 0) {
      const margin = ((numSale - numCost) / numCost) * 100;
      setProfitPercentage(margin.toFixed(1));
    }
  };

  const handleMarginChange = (val: string) => {
    setProfitPercentage(val);
    const margin = parseFloat(val) || 0;
    const numCost = parseFloat(String(costPrice)) || 0;
    if (numCost > 0) {
      const calculatedSale = numCost * (1 + margin / 100);
      setSalePrice(calculatedSale.toFixed(2));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !auth.currentUser) return;

    const numCost = parseFloat(String(costPrice)) || 0;
    const numSale = parseFloat(String(salePrice)) || 0;
    const numProfit = parseFloat(String(profitPercentage)) || (numCost > 0 ? ((numSale - numCost) / numCost) * 100 : 0);
    const numStock = parseInt(String(stock), 10) || 0;
    const numMinStock = parseInt(String(minStock), 10) || 0;
    const numUnitsBox = parseFloat(String(unitsPerBox)) || 1;
    const finalType = type === 'Outros' && customType.trim() ? customType.trim() : type;

    const payload = {
      code: code.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      type: finalType,
      costPrice: numCost,
      salePrice: numSale,
      profitPercentage: Number(numProfit.toFixed(2)),
      stock: numStock,
      unit,
      costBasis,
      stockControl,
      unitsPerBox: stockControl === 'box' ? numUnitsBox : 1,
      minStock: numMinStock,
      price: numSale, // Compatibility
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
    if (!confirm(`Deseja realmente excluir o produto "${prodName}" do ERP?`)) return;
    setIsDeleting(id);
    try {
      await executeDelete('products', id);
    } catch (error: any) {
      alert('Erro ao excluir produto: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleExportCSV = () => {
    if (!checkLimit('à exportação de dados do ERP (disponível no Plano Pro)', !!plan?.permissions?.canExportData)) {
      return;
    }

    if (products.length === 0) {
      alert('Não há produtos para exportar.');
      return;
    }

    const headers = [
      'Código',
      'Produto',
      'Categoria',
      'Unidade',
      'Base de Custo',
      'Controle Estoque',
      'Qtd p/ Caixa',
      'Preço Custo (R$)',
      'Preço Venda (R$)',
      'Lucro Unitário (R$)',
      'Margem de Lucro (%)',
      'Estoque Atual',
      'Estoque Mínimo',
      'Valor Total Custo (R$)',
      'Valor Total Venda (R$)'
    ];

    const rows = products.map(p => {
      const profitVal = p.salePrice - p.costPrice;
      const totalCost = p.costPrice * p.stock;
      const totalSale = p.salePrice * p.stock;
      return [
        `"${p.code}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.type}"`,
        `"${p.unit}"`,
        `"${p.costBasis === 'unit' ? 'Por Unidade' : 'Por Peso'}"`,
        `"${p.stockControl === 'box' ? 'Por Caixa' : 'Por Medida'}"`,
        p.unitsPerBox || 1,
        p.costPrice.toFixed(2),
        p.salePrice.toFixed(2),
        profitVal.toFixed(2),
        p.profitPercentage.toFixed(2),
        p.stock,
        p.minStock ?? 5,
        totalCost.toFixed(2),
        totalSale.toFixed(2)
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `erp_produtos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs
  const totalProducts = products.length;
  const totalCostValue = products.reduce((acc, p) => acc + (p.costPrice * p.stock), 0);
  const totalSaleValue = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);
  const totalProjectedProfit = totalSaleValue - totalCostValue;
  const averageMargin = totalCostValue > 0 ? ((totalSaleValue - totalCostValue) / totalCostValue) * 100 : 0;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5)).length;

  // Filter and Sort
  const categoriesList = Array.from(new Set(['all', ...DEFAULT_CATEGORIES, ...products.map(p => p.type)]));

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory;
    const matchesUnit = selectedUnit === 'all' || p.unit === selectedUnit;
    
    let matchesStock = true;
    if (stockFilter === 'out') matchesStock = p.stock <= 0;
    if (stockFilter === 'low') matchesStock = p.stock > 0 && p.stock <= (p.minStock ?? 5);

    return matchesSearch && matchesCategory && matchesUnit && matchesStock;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'profit') return b.profitPercentage - a.profitPercentage;
    if (sortBy === 'stockAsc') return a.stock - b.stock;
    if (sortBy === 'stockDesc') return b.stock - a.stock;
    if (sortBy === 'salePrice') return b.salePrice - a.salePrice;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-md">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-neutral-900">ERP Express Integrado</h2>
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 font-bold">PRODUTOS & LUCROS</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Gerenciamento completo de estoque, base de custos, margem de lucro e precificação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl font-bold border-dashed text-xs"
            onClick={handleExportCSV}
            title="Exportar dados para planilha CSV"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
          {canEdit && (
            <Button
              size="sm"
              className="h-10 rounded-xl font-bold bg-neutral-900 hover:bg-neutral-800 text-xs shadow-md shadow-neutral-900/10"
              onClick={handleOpenAdd}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Produto ERP
            </Button>
          )}
        </div>
      </div>

      {/* Executive Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-gradient-to-br from-white to-neutral-50/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itens Cadastrados</p>
                  <h3 className="text-2xl font-black text-neutral-900">{totalProducts}</h3>
                  <p className="text-[11px] text-neutral-500 font-medium">{outOfStockCount > 0 ? `${outOfStockCount} sem estoque` : 'Estoque ativo'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-gradient-to-br from-white to-neutral-50/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custo do Estoque</p>
                  <h3 className="text-2xl font-black text-neutral-900">R$ {totalCostValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[11px] text-neutral-500 font-medium">Investimento total</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lucro Estimado</p>
                  <h3 className="text-2xl font-black text-emerald-700">R$ {totalProjectedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    Margem Média: {averageMargin.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-neutral-200/80 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  (outOfStockCount + lowStockCount) > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {(outOfStockCount + lowStockCount) > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Atenção Estoque</p>
                  <h3 className="text-2xl font-black text-neutral-900">{outOfStockCount + lowStockCount}</h3>
                  <p className="text-[11px] text-neutral-500 font-medium">
                    {outOfStockCount} zerados · {lowStockCount} baixos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
              <Input
                placeholder="Buscar por código, nome ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-neutral-50 border-neutral-200 text-xs font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="all">Todas as Categorias</option>
                {categoriesList.filter(c => c !== 'all').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Unit Filter */}
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="all">Todas Unidades</option>
                <option value="un">Unidade (un)</option>
                <option value="kg">Quilo (kg)</option>
                <option value="g">Grama (g)</option>
                <option value="l">Litro (l)</option>
                <option value="ml">Mililitro (ml)</option>
              </select>

              {/* Stock Filter */}
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="all">Todo o Estoque</option>
                <option value="low">Estoque Baixo</option>
                <option value="out">Esgotado (Zerado)</option>
              </select>

              {/* Sort Filter */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="name">Ordenar: Nome A-Z</option>
                <option value="profit">Maior Margem de Lucro</option>
                <option value="salePrice">Maior Preço de Venda</option>
                <option value="stockDesc">Maior Estoque</option>
                <option value="stockAsc">Menor Estoque</option>
              </select>
            </div>
          </div>

          {/* Products Table */}
          <Card className="rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    <th className="py-3.5 px-4">Código & Produto</th>
                    <th className="py-3.5 px-4">Categoria & Medida</th>
                    <th className="py-3.5 px-4 text-right">Preço de Custo</th>
                    <th className="py-3.5 px-4 text-right">Preço de Venda</th>
                    <th className="py-3.5 px-4 text-right">Lucro / Margem</th>
                    <th className="py-3.5 px-4 text-center">Estoque Atual</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map((p) => {
                    const unitProfit = p.salePrice - p.costPrice;
                    const isOutOfStock = p.stock <= 0;
                    const isLowStock = p.stock > 0 && p.stock <= (p.minStock ?? 5);

                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                        {/* Código & Nome */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md border border-neutral-200">
                                {p.code}
                              </span>
                              <span className="font-bold text-neutral-900 text-sm">{p.name}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Cadastrado em {new Date(p.createdAt || Date.now()).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </td>

                        {/* Categoria & Medida */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="bg-neutral-50 font-bold text-[11px]">
                              {p.type}
                            </Badge>
                            <Badge variant="secondary" className="font-bold text-[11px]">
                              {p.unit.toUpperCase()}
                            </Badge>
                            {p.stockControl === 'box' && (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-bold">
                                Caixa ({p.unitsPerBox}un)
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Preço de Custo */}
                        <td className="py-3.5 px-4 text-right font-medium text-neutral-600">
                          R$ {p.costPrice.toFixed(2)}
                          <span className="block text-[10px] text-muted-foreground">
                            {p.costBasis === 'weight' ? 'por peso' : 'por unidade'}
                          </span>
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-3.5 px-4 text-right font-bold text-neutral-900">
                          R$ {p.salePrice.toFixed(2)}
                        </td>

                        {/* Margem e Lucro */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-black text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-0.5",
                              p.profitPercentage >= 50 ? "bg-emerald-100 text-emerald-800" :
                              p.profitPercentage > 0 ? "bg-blue-100 text-blue-800" :
                              "bg-red-100 text-red-800"
                            )}>
                              {p.profitPercentage >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {p.profitPercentage.toFixed(1)}%
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                              Lucro: R$ {unitProfit.toFixed(2)}
                            </span>
                          </div>
                        </td>

                        {/* Estoque */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <div className="flex items-center gap-1.5">
                              {canEdit && (
                                <button
                                  onClick={() => handleQuickStockAdjust(p, -1)}
                                  className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black flex items-center justify-center transition-colors text-xs"
                                  title="Diminuir 1 un"
                                >
                                  -
                                </button>
                              )}
                              <span className={cn(
                                "font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border",
                                isOutOfStock ? "bg-red-50 text-red-700 border-red-200" :
                                isLowStock ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-neutral-50 text-neutral-800 border-neutral-200"
                              )}>
                                {p.stock} {p.unit}
                              </span>
                              {canEdit && (
                                <button
                                  onClick={() => handleQuickStockAdjust(p, 1)}
                                  className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black flex items-center justify-center transition-colors text-xs"
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

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
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
                                className="h-8 w-8 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
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
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-bold text-neutral-700">Nenhum produto encontrado</p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {searchTerm ? 'Tente ajustar seus termos de busca ou filtros.' : 'Clique em "+ Novo Produto ERP" para cadastrar seu primeiro item.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

      {/* Modal de Cadastro / Edição de Produto ERP */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-neutral-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                    <Box className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">
                      {editingProduct ? 'Editar Produto ERP' : 'Novo Produto no ERP'}
                    </h3>
                    <p className="text-xs text-muted-foreground">Defina custos, margens e regras de estoque</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
                {/* Linha 1: Código & Nome */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                      <span>Código / SKU *</span>
                      <button 
                        type="button" 
                        onClick={generateAutoCode}
                        className="text-[10px] text-emerald-600 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" /> Gerar
                      </button>
                    </label>
                    <Input
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Ex: PRD-1020"
                      className="font-mono uppercase font-bold h-11 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Nome do Produto *</label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Suco Integral de Uva 1.5L"
                      className="h-11 rounded-xl font-medium"
                    />
                  </div>
                </div>

                {/* Linha 2: Categoria & Unidade */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Categoria / Tipo *</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-neutral-900"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {type === 'Outros' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Nome da Categoria</label>
                      <Input
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Ex: Automotivo"
                        className="h-11 rounded-xl text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Unidade de Medida *</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as any)}
                      className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Quilograma (kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="l">Litro (l)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Base de Custo *</label>
                    <select
                      value={costBasis}
                      onChange={(e) => setCostBasis(e.target.value as any)}
                      className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="unit">Por Unidade Fixa</option>
                      <option value="weight">Por Peso / Volume</option>
                    </select>
                  </div>
                </div>

                {/* Linha 3: Controle de Caixa e Estoque */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Controle de Estoque</label>
                    <select
                      value={stockControl}
                      onChange={(e) => setStockControl(e.target.value as any)}
                      className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                    >
                      <option value="measure">Por Medida Simples</option>
                      <option value="box">Por Caixa / Fardo</option>
                    </select>
                  </div>

                  {stockControl === 'box' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Unidades por Caixa</label>
                      <Input
                        type="number"
                        min="1"
                        value={unitsPerBox}
                        onChange={(e) => setUnitsPerBox(e.target.value)}
                        placeholder="Ex: 12"
                        className="h-11 rounded-xl font-bold bg-white"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Estoque Inicial *</label>
                    <Input
                      type="number"
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0"
                      className="h-11 rounded-xl font-bold bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Estoque Mínimo (Alerta)</label>
                    <Input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      placeholder="5"
                      className="h-11 rounded-xl font-bold bg-white"
                    />
                  </div>
                </div>

                {/* Linha 4: Precificação Inteligente & Margem de Lucro */}
                <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      Calculadora Inteligente de Precificação
                    </span>
                    <span className="text-[11px] text-neutral-400">Cálculo bidirecional instantâneo</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300">Preço de Custo (R$) *</label>
                      <Input
                        type="number"
                        step="0.01"
                        required
                        value={costPrice}
                        onChange={(e) => handleCostPriceChange(e.target.value)}
                        placeholder="0.00"
                        className="h-11 rounded-xl font-bold text-neutral-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300">Margem / Lucro (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={profitPercentage}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        placeholder="Ex: 50%"
                        className="h-11 rounded-xl font-bold text-neutral-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300">Preço de Venda (R$) *</label>
                      <Input
                        type="number"
                        step="0.01"
                        required
                        value={salePrice}
                        onChange={(e) => handleSalePriceChange(e.target.value)}
                        placeholder="0.00"
                        className="h-11 rounded-xl font-black text-emerald-700 bg-white border-2 border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Resumo da Margem */}
                  <div className="pt-3 border-t border-neutral-700/60 flex items-center justify-between text-xs">
                    <span className="text-neutral-400">
                      Lucro Líquido por Unidade: 
                      <strong className="text-white ml-1 font-bold">
                        R$ {((parseFloat(String(salePrice)) || 0) - (parseFloat(String(costPrice)) || 0)).toFixed(2)}
                      </strong>
                    </span>
                    <span className="text-neutral-400">
                      Margem Calculada: 
                      <strong className="text-emerald-400 ml-1 font-bold">
                        {profitPercentage ? `${profitPercentage}%` : '0%'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11 px-6 font-bold">
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSavingProduct}
                    className="rounded-xl h-11 px-8 font-black bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-neutral-900/20"
                  >
                    {isSavingProduct ? 'Salvando...' : editingProduct ? 'Atualizar Produto' : 'Cadastrar no ERP'}
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
