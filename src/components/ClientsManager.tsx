import * as React from 'react';
import { cn } from '@/lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Client, Appointment } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  Calendar, 
  Edit2, 
  Trash2, 
  MessageCircle, 
  Sparkles, 
  Loader2, 
  FileSpreadsheet, 
  Star, 
  Clock, 
  CalendarPlus,
  TrendingUp,
  UserCheck,
  Truck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { executeDelete } from '@/lib/deleteHelper';
import { motion, AnimatePresence } from 'motion/react';

interface ClientsManagerProps {
  onNavigateToTab?: (tab: string, clientPreselect?: any) => void;
}

export default function ClientsManager({ onNavigateToTab }: ClientsManagerProps) {
  const { currentWorkspace, canEdit } = useWorkspace();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<'all' | 'active' | 'vip' | 'prospect' | 'inactive'>('all');
  
  const [isAddingClient, setIsAddingClient] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = React.useState<Client | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  const [clientForm, setClientForm] = React.useState<{
    name: string;
    company: string;
    phone: string;
    email: string;
    category: Client['category'];
    address: string;
    notes: string;
  }>({
    name: '',
    company: '',
    phone: '',
    email: '',
    category: 'active',
    address: '',
    notes: ''
  });

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Listen to Clients in current workspace
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'clients'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  // Listen to Appointments for client history
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'appointments'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      setAppointments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setActionLoading(true);

    try {
      if (editingClient) {
        await setDoc(doc(db, 'clients', editingClient.id), {
          ...clientForm,
          updatedAt: serverTimestamp()
        }, { merge: true });
        showFeedback(`Cliente "${clientForm.name}" atualizado com sucesso!`);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...clientForm,
          totalVisits: 0,
          workspaceId: currentWorkspace.id,
          userId: auth.currentUser?.uid,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        showFeedback(`Cliente "${clientForm.name}" cadastrado com sucesso!`);
      }

      setIsAddingClient(false);
      setEditingClient(null);
      setClientForm({
        name: '',
        company: '',
        phone: '',
        email: '',
        category: 'active',
        address: '',
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clients');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name || '',
      company: client.company || '',
      phone: client.phone || '',
      email: client.email || '',
      category: client.category || 'active',
      address: client.address || '',
      notes: client.notes || ''
    });
    setIsAddingClient(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Deseja realmente remover o cliente "${client.name}" da carteira?`)) return;
    try {
      await executeDelete('clients', client.id);
      showFeedback(`Cliente "${client.name}" removido.`);
      if (selectedClientForDetails?.id === client.id) {
        setSelectedClientForDetails(null);
      }
    } catch (error: any) {
      alert('Erro ao excluir: ' + (error.message || 'Erro'));
    }
  };

  const openWhatsApp = (phoneStr?: string, nameStr?: string) => {
    if (!phoneStr) return;
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const num = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const text = `Olá ${nameStr || ''}, tudo bem? Entramos em contato a partir do Express Tools. Como podemos ajudar hoje?`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportCSV = () => {
    if (clients.length === 0) {
      alert('Não há clientes para exportar.');
      return;
    }

    const rows = [
      ['Nome', 'Empresa', 'Categoria', 'Telefone', 'E-mail', 'Endereço', 'Total de Visitas', 'Observações']
    ];

    clients.forEach(c => {
      rows.push([
        `"${c.name || ''}"`,
        `"${c.company || ''}"`,
        `"${c.category || 'active'}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${c.totalVisits || 0}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `carteira_clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const totalVIP = clients.filter(c => c.category === 'vip').length;
  const totalActive = clients.filter(c => c.category === 'active' || !c.category).length;
  const totalProspect = clients.filter(c => c.category === 'prospect').length;
  const totalInactive = clients.filter(c => c.category === 'inactive').length;

  const filteredClients = clients.filter(c => {
    const matchesCategory = categoryFilter === 'all' || (c.category || 'active') === categoryFilter;
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(s) ||
      (c.company && c.company.toLowerCase().includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.phone && c.phone.includes(s)) ||
      (c.address && c.address.toLowerCase().includes(s));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-neutral-900 text-white rounded-xl shadow-md">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-neutral-900">
                Carteira de Clientes (CRM)
              </h2>
              <p className="text-sm text-neutral-500 font-medium">
                Cadastre contatos, organize categorias de clientes, controle histórico de visitas e acione via WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-xl border-neutral-300 text-xs font-bold gap-1.5 h-10 hover:bg-neutral-50"
            title="Exportar clientes para arquivo CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          {canEdit && (
            <Button 
              onClick={() => {
                if (isAddingClient) {
                  setIsAddingClient(false);
                  setEditingClient(null);
                } else {
                  setEditingClient(null);
                  setClientForm({ name: '', company: '', phone: '', email: '', category: 'active', address: '', notes: '' });
                  setIsAddingClient(true);
                }
              }}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold gap-1.5 h-10 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Novo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Floating Feedback Notice */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-blue-50 border border-blue-200 text-blue-900 text-sm font-semibold rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total de Clientes</p>
              <h3 className="text-2xl font-black text-neutral-900">{clients.length}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Base completa</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Clientes Ativos</p>
              <h3 className="text-2xl font-black text-emerald-600">{totalActive}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Compradores frequentes</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Clientes VIP</p>
              <h3 className="text-2xl font-black text-amber-600">{totalVIP}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Alto faturamento</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Prospectos</p>
              <h3 className="text-2xl font-black text-purple-600">{totalProspect}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Em prospecção ativa</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form: Add / Edit Client */}
      <AnimatePresence>
        {isAddingClient && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-neutral-900 shadow-xl bg-white">
              <CardHeader className="bg-neutral-900 text-white p-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  {editingClient ? 'Editar Informações do Cliente' : 'Cadastrar Novo Cliente na Carteira'}
                </CardTitle>
                <CardDescription className="text-neutral-300 text-xs">
                  Centralize contatos, empresa, endereço e notas para agendamentos ágeis e atendimento personalizado.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveClient} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Nome Completo / Contato Principal *</label>
                      <Input
                        required
                        placeholder="Ex: Maria Oliveira"
                        value={clientForm.name}
                        onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Empresa / Razão Social</label>
                      <Input
                        placeholder="Ex: Comercial Brasil Ltda"
                        value={clientForm.company}
                        onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Categoria do Cliente</label>
                      <select
                        aria-label="Categoria do cliente"
                        className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={clientForm.category}
                        onChange={(e) => setClientForm({ ...clientForm, category: e.target.value as any })}
                      >
                        <option value="active">🟢 Ativo (Comprador Regular)</option>
                        <option value="vip">⭐ VIP (Cliente Prioritário)</option>
                        <option value="prospect">🟡 Prospecto (Em Negociação)</option>
                        <option value="inactive">⚪ Inativo (Sem Atividade Recente)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Telefone / WhatsApp</label>
                      <Input
                        placeholder="(11) 98765-4321"
                        value={clientForm.phone}
                        onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">E-mail</label>
                      <Input
                        type="email"
                        placeholder="contato@cliente.com"
                        value={clientForm.email}
                        onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Endereço / Cidade</label>
                      <Input
                        placeholder="Av. Paulista, 1000 - São Paulo/SP"
                        value={clientForm.address}
                        onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Anotações Internas & Preferências do Cliente</label>
                    <Input
                      placeholder="Ex: Prefere entregas às terças-feiras, contato via WhatsApp..."
                      value={clientForm.notes}
                      onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-neutral-100">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingClient(false);
                        setEditingClient(null);
                      }}
                      className="rounded-xl h-10 text-xs font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-10 text-xs font-bold px-5"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <Input
            placeholder="Buscar por nome, empresa, telefone, e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl border-neutral-200"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('all')}
            className="rounded-xl text-xs font-bold h-9"
          >
            Todos ({clients.length})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('active')}
            className={cn("rounded-xl text-xs font-bold h-9", categoryFilter === 'active' && "bg-emerald-600 hover:bg-emerald-700")}
          >
            Ativos ({totalActive})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'vip' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('vip')}
            className={cn("rounded-xl text-xs font-bold h-9", categoryFilter === 'vip' && "bg-amber-600 hover:bg-amber-700")}
          >
            VIP ({totalVIP})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'prospect' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('prospect')}
            className={cn("rounded-xl text-xs font-bold h-9", categoryFilter === 'prospect' && "bg-purple-600 hover:bg-purple-700")}
          >
            Prospectos ({totalProspect})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'inactive' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('inactive')}
            className="rounded-xl text-xs font-bold h-9 text-neutral-500"
          >
            Inativos ({totalInactive})
          </Button>
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-neutral-200">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">Nenhum cliente encontrado</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Tente alterar os termos da busca ou os filtros de categoria.' 
              : 'Comece adicionando seu primeiro cliente para organizar atendimentos e vendas.'}
          </p>
          {canEdit && !searchTerm && categoryFilter === 'all' && (
            <Button
              onClick={() => {
                setEditingClient(null);
                setClientForm({ name: '', company: '', phone: '', email: '', category: 'active', address: '', notes: '' });
                setIsAddingClient(true);
              }}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold h-9"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Cadastrar Primeiro Cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => {
            const clientAppointments = appointments.filter(a => 
              a.clientName.toLowerCase() === client.name.toLowerCase() || 
              (client.email && a.clientEmail && a.clientEmail.toLowerCase() === client.email.toLowerCase())
            );

            return (
              <Card 
                key={client.id} 
                className="border-neutral-200/80 hover:border-neutral-400 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between overflow-hidden group bg-white"
              >
                <div>
                  <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-neutral-900 text-base group-hover:text-blue-600 transition-colors">
                          {client.name}
                        </h4>
                      </div>
                      {client.company && (
                        <p className="text-xs text-neutral-600 font-semibold flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                          {client.company}
                        </p>
                      )}
                    </div>

                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                        client.category === 'vip' && "bg-amber-50 text-amber-800 border-amber-300",
                        client.category === 'active' && "bg-emerald-50 text-emerald-800 border-emerald-300",
                        client.category === 'prospect' && "bg-purple-50 text-purple-800 border-purple-300",
                        client.category === 'inactive' && "bg-neutral-100 text-neutral-600 border-neutral-300"
                      )}
                    >
                      {client.category === 'vip' ? '⭐ VIP' : client.category === 'prospect' ? '🟡 Prospecto' : client.category === 'inactive' ? '⚪ Inativo' : '🟢 Ativo'}
                    </Badge>
                  </div>

                  <div className="p-5 space-y-3 text-xs">
                    {client.phone && (
                      <div className="flex items-center justify-between text-neutral-700">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-600">
                          <Phone className="w-3.5 h-3.5 text-neutral-400" />
                          {client.phone}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openWhatsApp(client.phone, client.name)}
                          className="h-7 px-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          WhatsApp
                        </Button>
                      </div>
                    )}

                    {client.email && (
                      <p className="text-neutral-600 flex items-center gap-1.5 truncate" title={client.email}>
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </p>
                    )}

                    {client.address && (
                      <p className="text-neutral-600 flex items-center gap-1.5 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </p>
                    )}

                    {client.notes && (
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 text-[11px] text-neutral-600 italic">
                        "{client.notes}"
                      </div>
                    )}

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                      <span>Visitas registradas: <strong>{clientAppointments.length || client.totalVisits || 0}</strong></span>
                      {clientAppointments.length > 0 && clientAppointments[0].startTime && (
                        <span className="text-neutral-400">
                          Última: {format(parseISO(clientAppointments[0].startTime), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between gap-2">
                  {onNavigateToTab && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onNavigateToTab('appointments', client)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold h-8 flex-1 gap-1"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
                        Visita
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigateToTab('shipping', client)}
                        className="border-neutral-300 hover:bg-amber-50 hover:border-amber-400 text-neutral-800 rounded-xl text-xs font-bold h-8 gap-1"
                        title="Cotar frete para este cliente"
                      >
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                        Frete
                      </Button>
                    </>
                  )}

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditClick(client)}
                        className="h-8 w-8 rounded-lg hover:bg-neutral-200 text-neutral-700"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteClient(client)}
                        className="h-8 w-8 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
