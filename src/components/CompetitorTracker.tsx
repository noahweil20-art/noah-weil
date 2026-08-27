import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Competitor } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  MapPin, 
  DollarSign, 
  AlertCircle,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Download,
  FileSpreadsheet,
  Loader2,
  FileText,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Share2,
  X
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { executeDelete } from '@/lib/deleteHelper';

export default function CompetitorTracker() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [competitors, setCompetitors] = React.useState<Competitor[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCompetitor, setEditingCompetitor] = React.useState<Competitor | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterDate, setFilterDate] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [exportPeriod, setExportPeriod] = React.useState<'all' | 'month' | '30days' | 'filtered'>('all');
  const [copyFeedback, setCopyFeedback] = React.useState(false);
  const [isExportSectionOpen, setIsExportSectionOpen] = React.useState(true);

  const historyLimitMonths = plan?.permissions.competitorHistoryMonths || 3;
  const canExport = plan?.id === 'pro' || !!plan?.permissions?.canExportData;

  const [formData, setFormData] = React.useState<{
    date: string;
    name: string;
    location: string;
    averagePrice: number | string;
    promotions: string;
    strengths: string;
    weaknesses: string;
    movement: 'low' | 'medium' | 'high';
    observations: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    name: '',
    location: '',
    averagePrice: 0,
    promotions: '',
    strengths: '',
    weaknesses: '',
    movement: 'medium',
    observations: '',
  });

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const limitDate = format(subMonths(new Date(), historyLimitMonths), 'yyyy-MM-dd');

    const q = query(
      collection(db, 'competitors'),
      where('workspaceId', '==', currentWorkspace.id),
      where('date', '>=', limitDate),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Competitor[];
      setCompetitors(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competitors');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !auth.currentUser) return;

    try {
      if (editingCompetitor) {
        await updateDoc(doc(db, 'competitors', editingCompetitor.id), {
          ...formData,
          averagePrice: Number(formData.averagePrice)
        });
      } else {
        await addDoc(collection(db, 'competitors'), {
          ...formData,
          averagePrice: Number(formData.averagePrice),
          userId: auth.currentUser.uid,
          ownerId: auth.currentUser.uid,
          workspaceId: currentWorkspace.id,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingCompetitor ? OperationType.UPDATE : OperationType.CREATE, 'competitors');
    }
  };

  const handleDelete = async (competitor: Competitor) => {
    setIsDeleting(competitor.id);
    try {
      await executeDelete('competitors', competitor.id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir concorrente:", error);
      setIsDeleting(null);
      alert('Não foi possível excluir o concorrente: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const openModal = (competitor?: Competitor) => {
    if (competitor) {
      setEditingCompetitor(competitor);
      setFormData({
        date: competitor.date,
        name: competitor.name,
        location: competitor.location,
        averagePrice: competitor.averagePrice,
        promotions: competitor.promotions,
        strengths: competitor.strengths,
        weaknesses: competitor.weaknesses,
        movement: competitor.movement,
        observations: competitor.observations,
      });
    } else {
      setEditingCompetitor(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        name: '',
        location: '',
        averagePrice: 0,
        promotions: '',
        strengths: '',
        weaknesses: '',
        movement: 'medium',
        observations: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompetitor(null);
  };

  const filteredCompetitors = competitors.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = filterDate ? c.date === filterDate : true;
    return matchesSearch && matchesDate;
  });

  const averagePriceAll = competitors.length > 0 
    ? competitors.reduce((acc, c) => acc + (Number(c.averagePrice) || 0), 0) / competitors.length 
    : 0;

  const getExportDataSet = () => {
    if (exportPeriod === 'filtered') {
      return filteredCompetitors;
    }
    if (exportPeriod === 'month') {
      const currentMonth = format(new Date(), 'yyyy-MM');
      return competitors.filter(c => c.date.startsWith(currentMonth));
    }
    if (exportPeriod === '30days') {
      const thirtyDaysAgo = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
      return competitors.filter(c => c.date >= thirtyDaysAgo);
    }
    return competitors;
  };

  const exportData = (type: 'txt' | 'csv' | 'json' | 'copy') => {
    if (!checkLimit('à exportação de dados de concorrência (disponível no Plano Pro)', canExport)) {
      return;
    }

    const dataSet = getExportDataSet();
    if (dataSet.length === 0) {
      alert('Nenhum dado encontrado para o período selecionado.');
      return;
    }
    
    let content = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (type === 'csv') {
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
      content = '\uFEFF' + 'Data;Nome Concorrente;Localizacao;Preco Medio;Movimento;Promocoes;Pontos Fortes;Pontos Fracos;Observacoes\n';
      dataSet.forEach(c => {
        content += `"${c.date}";"${c.name.replace(/"/g, '""')}";"${(c.location || '').replace(/"/g, '""')}";${Number(c.averagePrice) || 0};"${c.movement}";"${(c.promotions || '').replace(/"/g, '""')}";"${(c.strengths || '').replace(/"/g, '""')}";"${(c.weaknesses || '').replace(/"/g, '""')}";"${(c.observations || '').replace(/"/g, '""')}"\n`;
      });
    } else if (type === 'json') {
      mimeType = 'application/json';
      extension = 'json';
      content = JSON.stringify({
        workspace: currentWorkspace?.name || 'Workspace',
        exportedAt: new Date().toISOString(),
        totalRecords: dataSet.length,
        records: dataSet
      }, null, 2);
    } else {
      // Formatted TXT or Copy
      content = `========================================================\n` +
        `RELATÓRIO DE HISTÓRICO DE CONCORRENTES - EXPRESS TOOLS\n` +
        `Workspace: ${currentWorkspace?.name || 'Geral'}\n` +
        `Data de Exportação: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n` +
        `Total de Registros: ${dataSet.length}\n` +
        `========================================================\n\n`;

      dataSet.forEach((c, idx) => {
        content += `[${idx + 1}] DATA: ${format(parseISO(c.date), 'dd/MM/yyyy')} | CONCORRENTE: ${c.name}\n` +
          `  Localização: ${c.location || 'Não informada'}\n` +
          `  Preço Médio: R$ ${(Number(c.averagePrice) || 0).toFixed(2)}\n` +
          `  Nível de Movimento: ${c.movement === 'high' ? 'Alto' : c.movement === 'medium' ? 'Médio' : 'Baixo'}\n` +
          (c.promotions ? `  Promoções: ${c.promotions}\n` : '') +
          (c.strengths ? `  Pontos Fortes: ${c.strengths}\n` : '') +
          (c.weaknesses ? `  Pontos Fracos: ${c.weaknesses}\n` : '') +
          (c.observations ? `  Observações: ${c.observations}\n` : '') +
          `--------------------------------------------------------\n`;
      });
    }

    if (type === 'copy') {
      navigator.clipboard.writeText(content);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 3000);
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_concorrentes_${exportPeriod}_${format(new Date(), 'yyyy-MM-dd')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">Controle de Concorrentes</h2>
          <p className="text-muted-foreground">Acompanhamento semanal de mercado e concorrência.</p>
        </div>
        <div className="flex gap-2">
          {competitors.length > 0 && (
            <Button variant="outline" onClick={() => exportData('txt')} title="Exportar TXT">
              <Download className="w-4 h-4 mr-2" />
              TXT
            </Button>
          )}
          {competitors.length > 0 && (
            <Button variant="outline" onClick={() => exportData('csv')} title="Exportar CSV">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              CSV
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => openModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Registro
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Preço Médio Geral</p>
              <h3 className="text-xl font-bold">R$ {averagePriceAll.toFixed(2)}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Registros este Mês</p>
              <h3 className="text-xl font-bold">
                {competitors.filter(c => c.date.startsWith(format(new Date(), 'yyyy-MM'))).length}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-100 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Concorrente mais Ativo</p>
              <h3 className="text-xl font-bold truncate max-w-[150px]">
                {competitors.length > 0 ? competitors[0].name : '---'}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Área Dedicada de Exportação de Histórico */}
      {competitors.length > 0 && (
        <Card className="rounded-2xl border border-neutral-200 shadow-sm bg-gradient-to-br from-white to-neutral-50 overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs shrink-0">
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base font-black text-neutral-900 flex items-center gap-2">
                  Área de Exportação do Histórico
                  {canExport ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                      PRO HABILITADO
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-neutral-500 text-[10px] font-bold">
                      REQUER PLANO PRO
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Gere relatórios completos, planilhas CSV para Excel ou faça cópia rápida do histórico gerado.
                </p>
              </div>
            </div>

            {/* Scope Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-600">Período:</span>
              <select
                value={exportPeriod}
                onChange={(e) => setExportPeriod(e.target.value as any)}
                className="h-9 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 shadow-2xs"
              >
                <option value="all">Todo o Histórico ({competitors.length} itens)</option>
                <option value="month">Este Mês ({competitors.filter(c => c.date.startsWith(format(new Date(), 'yyyy-MM'))).length} itens)</option>
                <option value="30days">Últimos 30 dias</option>
                <option value="filtered">Conforme Filtro da Tabela ({filteredCompetitors.length} itens)</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Quick Metrics of Export Dataset */}
            {(() => {
              const dataset = getExportDataSet();
              const avg = dataset.length > 0 
                ? dataset.reduce((acc, c) => acc + (Number(c.averagePrice) || 0), 0) / dataset.length 
                : 0;
              const uniqueCompetitors = new Set(dataset.map(c => c.name)).size;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-neutral-200 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 font-medium">Registros a Exportar</span>
                    <span className="text-sm font-black text-neutral-900">{dataset.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-neutral-200 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 font-medium">Concorrentes no Lote</span>
                    <span className="text-sm font-black text-neutral-900">{uniqueCompetitors}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-neutral-200 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 font-medium">Preço Médio do Lote</span>
                    <span className="text-sm font-black text-emerald-700">R$ {avg.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Export Buttons Bar */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl font-bold text-xs bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs flex items-center gap-2"
                onClick={() => exportData('csv')}
                title="Exportar em formato CSV estruturado para Excel ou Google Planilhas"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar Planilha (CSV)</span>
              </Button>

              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl font-bold text-xs bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs flex items-center gap-2"
                onClick={() => exportData('txt')}
                title="Baixar relatório formatado em texto para leitura ou impressão"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Relatório Formatado (TXT)</span>
              </Button>

              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl font-bold text-xs bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs flex items-center gap-2"
                onClick={() => exportData('json')}
                title="Exportar backup completo em JSON"
              >
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Backup JSON</span>
              </Button>

              <Button
                variant="default"
                className={cn(
                  "h-10 px-4 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2",
                  copyFeedback 
                    ? "bg-emerald-600 text-white" 
                    : "bg-neutral-900 hover:bg-neutral-800 text-white"
                )}
                onClick={() => exportData('copy')}
                title="Copiar relatório formatado para a área de transferência"
              >
                {copyFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Relatório</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Histórico de Acompanhamento</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar concorrente..."
                  className="pl-9 w-[200px] h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="w-[160px] h-9"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-neutral-50 border-y">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Concorrente</th>
                  <th className="px-6 py-3 font-medium">Localização</th>
                  <th className="px-6 py-3 font-medium">Preço Médio</th>
                  <th className="px-6 py-3 font-medium">Movimento</th>
                  <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCompetitors.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(parseISO(c.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {c.name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c.location || '---'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      R$ {(Number(c.averagePrice) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "capitalize",
                          c.movement === 'high' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          c.movement === 'medium' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        {c.movement === 'high' ? 'Alto' : c.movement === 'medium' ? 'Médio' : 'Baixo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-neutral-500 hover:text-primary"
                              onClick={() => openModal(c)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {(canEdit || isAdmin || c.ownerId === auth.currentUser?.uid || c.userId === auth.currentUser?.uid) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                disabled={isDeleting === c.id}
                                className="h-8 w-8 text-neutral-500 hover:text-destructive"
                                onClick={() => handleDelete(c)}
                              >
                                {isDeleting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCompetitors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{editingCompetitor ? 'Editar Registro' : 'Novo Acompanhamento'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={closeModal}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data do Registro</label>
                    <Input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do Concorrente</label>
                    <Input
                      required
                      placeholder="Ex: Mercado do João"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Localização</label>
                    <Input
                      placeholder="Ex: Bairro Centro / Rua X"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preço Médio (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={formData.averagePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, averagePrice: val === '' ? '' : (parseFloat(val) || 0) });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Movimento</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={formData.movement}
                      onChange={(e) => setFormData({ ...formData, movement: e.target.value as any })}
                    >
                      <option value="low">Baixo</option>
                      <option value="medium">Médio</option>
                      <option value="high">Alto</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Promoções Ativas</label>
                    <Textarea
                      placeholder="Descreva as promoções que observou..."
                      value={formData.promotions}
                      onChange={(e) => setFormData({ ...formData, promotions: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-emerald-600">Pontos Fortes</label>
                      <Textarea
                        placeholder="O que eles fazem bem?"
                        value={formData.strengths}
                        onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-destructive">Pontos Fracos</label>
                      <Textarea
                        placeholder="Onde eles falham?"
                        value={formData.weaknesses}
                        onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Observações Gerais</label>
                    <Textarea
                      placeholder="Outros detalhes relevantes..."
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
                  <Button type="submit">
                    {editingCompetitor ? 'Salvar Alterações' : 'Criar Registro'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
