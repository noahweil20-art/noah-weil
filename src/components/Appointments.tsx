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
import { Appointment, Client, Order } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  Loader2, 
  StickyNote, 
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Building2,
  MapPin,
  Users,
  CalendarCheck,
  Search,
  FileSpreadsheet,
  ArrowRight,
  UserPlus,
  CalendarDays
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { executeDelete } from '@/lib/deleteHelper';
import { createPostItNote } from '@/lib/postItHelper';
import { motion, AnimatePresence } from 'motion/react';

interface AppointmentsProps {
  onNavigateToTab?: (tab: string, preselectedData?: any) => void;
  preselectedClient?: Client | null;
}

export default function Appointments({ onNavigateToTab, preselectedClient }: AppointmentsProps) {
  const { currentWorkspace, canEdit } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();

  // State collections
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);

  // Navigation & Filtering inside module
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // UI Dialog / Modal states
  const [isAddingAppointment, setIsAddingAppointment] = React.useState(false);
  const [convertingAppointment, setConvertingAppointment] = React.useState<Appointment | null>(null);

  // Loading / Deletion states
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  // Google Calendar state
  const [googleTokens, setGoogleTokens] = React.useState<any>(null);

  // Appointment Form Data
  const [appointmentForm, setAppointmentForm] = React.useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    location: '',
    startTime: '',
    endTime: '',
    observations: '',
    autoPostIt: true
  });

  // Convert to Order Form Data
  const [orderForm, setOrderForm] = React.useState({
    total: '',
    deadline: '',
    status: 'pending' as Order['status']
  });

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // If preselectedClient is passed from CRM
  React.useEffect(() => {
    if (preselectedClient) {
      setAppointmentForm(prev => ({
        ...prev,
        clientId: preselectedClient.id,
        clientName: preselectedClient.name,
        clientEmail: preselectedClient.email || '',
        clientPhone: preselectedClient.phone || '',
        location: preselectedClient.address || '',
        observations: preselectedClient.notes ? `Notas: ${preselectedClient.notes}` : ''
      }));
      setIsAddingAppointment(true);
    }
  }, [preselectedClient]);

  // Google OAuth listener
  React.useEffect(() => {
    const savedTokens = localStorage.getItem('google_calendar_tokens');
    if (savedTokens) {
      setGoogleTokens(JSON.parse(savedTokens));
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setGoogleTokens(event.data.tokens);
        localStorage.setItem('google_calendar_tokens', JSON.stringify(event.data.tokens));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Listen to Appointments
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'appointments'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('startTime', 'asc')
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

  // Listen to Clients
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const qClients = query(
      collection(db, 'clients'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(qClients, (snapshot) => {
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

  const connectGoogle = async () => {
    if (!checkLimit('à sincronização com Google Calendar (disponível no Plano Pro)', !!plan?.permissions?.googleCalendarEnabled)) {
      return;
    }
    try {
      const response = await fetch('/api/auth/google/url');
      const ct = response.headers.get('content-type');
      if (response.ok && ct && ct.includes('application/json')) {
        const { url } = await response.json();
        if (url) {
          window.open(url, 'google_auth', 'width=600,height=700');
          return;
        }
      }
      alert('Integração com Google Calendar disponível no ambiente completo com backend ativo.');
    } catch (error) {
      console.error("Error getting auth URL:", error);
    }
  };

  const openClientWhatsApp = (phoneStr?: string, nameStr?: string, dateTimeStr?: string) => {
    if (!phoneStr) return;
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const num = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    let text = `Olá ${nameStr || ''}!`;
    if (dateTimeStr) {
      const dtFormatted = format(parseISO(dateTimeStr), "dd/MM/yyyy 'às' HH:mm");
      text = `Olá ${nameStr || ''}! Confirmamos sua visita/reunião agendada para ${dtFormatted}. Ficamos à disposição!`;
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCreatePostItForAppointment = async (appt: { clientName: string; clientEmail?: string; startTime: string; endTime?: string; observations?: string }) => {
    if (!currentWorkspace) return;
    const formattedDate = appt.startTime ? format(parseISO(appt.startTime), "dd/MM/yyyy HH:mm") : 'A definir';
    const endStr = appt.endTime ? ` até ${format(parseISO(appt.endTime), "HH:mm")}` : '';
    const obsStr = appt.observations ? `\n📝 Obs: ${appt.observations}` : '';
    const emailStr = appt.clientEmail ? `\n📧 Email: ${appt.clientEmail}` : '';
    
    const content = `📌 [VISITA/CLIENTE] ${appt.clientName}\n📅 Horário: ${formattedDate}${endStr}${emailStr}${obsStr}`;
    
    const success = await createPostItNote({
      workspaceId: currentWorkspace.id,
      title: `Visita: ${appt.clientName}`,
      content,
      type: 'appointment'
    });

    if (success) {
      showFeedback(`Anotação de "${appt.clientName}" gerada nos Post-its com sucesso!`);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setActionLoading(true);

    try {
      let googleEventId = '';
      if (googleTokens) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokens: googleTokens,
              event: {
                summary: `Visita: ${appointmentForm.clientName}`,
                description: appointmentForm.observations,
                start: { dateTime: new Date(appointmentForm.startTime).toISOString() },
                end: { dateTime: new Date(appointmentForm.endTime).toISOString() },
                attendees: appointmentForm.clientEmail ? [{ email: appointmentForm.clientEmail }] : []
              }
            })
          });
          const ct = response.headers.get('content-type');
          if (response.ok && ct && ct.includes('application/json')) {
            const data = await response.json();
            googleEventId = data.id || '';
          }
        } catch (_) {}
      }

      await addDoc(collection(db, 'appointments'), {
        clientName: appointmentForm.clientName,
        clientEmail: appointmentForm.clientEmail,
        clientPhone: appointmentForm.clientPhone || '',
        location: appointmentForm.location || '',
        startTime: appointmentForm.startTime,
        endTime: appointmentForm.endTime,
        observations: appointmentForm.observations,
        status: 'scheduled',
        outcome: 'pending',
        googleEventId,
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      // Also ensure client is saved/updated in clients database
      if (appointmentForm.clientName) {
        const existing = clients.find(c => c.name.toLowerCase() === appointmentForm.clientName.toLowerCase());
        if (existing) {
          await setDoc(doc(db, 'clients', existing.id), {
            totalVisits: (existing.totalVisits || 0) + 1,
            lastVisitDate: appointmentForm.startTime
          }, { merge: true });
        } else {
          await addDoc(collection(db, 'clients'), {
            name: appointmentForm.clientName,
            email: appointmentForm.clientEmail || '',
            phone: appointmentForm.clientPhone || '',
            company: '',
            category: 'active',
            address: appointmentForm.location || '',
            notes: appointmentForm.observations || '',
            totalVisits: 1,
            lastVisitDate: appointmentForm.startTime,
            workspaceId: currentWorkspace.id,
            userId: auth.currentUser?.uid,
            ownerId: auth.currentUser?.uid,
            createdAt: serverTimestamp()
          });
        }
      }

      if (appointmentForm.autoPostIt) {
        await handleCreatePostItForAppointment(appointmentForm);
      }

      setIsAddingAppointment(false);
      setAppointmentForm({
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        location: '',
        startTime: '',
        endTime: '',
        observations: '',
        autoPostIt: true
      });
      showFeedback(`Visita para "${appointmentForm.clientName}" agendada com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (appt: Appointment, newStatus: Appointment['status'], outcome?: Appointment['outcome']) => {
    try {
      const updatePayload: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      if (outcome) updatePayload.outcome = outcome;

      await setDoc(doc(db, 'appointments', appt.id), updatePayload, { merge: true });
      showFeedback(`Visita com ${appt.clientName} atualizada para ${newStatus === 'completed' ? 'Concluída' : newStatus === 'cancelled' ? 'Cancelada' : 'Agendada'}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${appt.id}`);
    }
  };

  const handleConvertVisitToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !convertingAppointment) return;
    setActionLoading(true);

    try {
      const totalNum = Number(orderForm.total) || 0;
      const deadlineVal = orderForm.deadline || convertingAppointment.startTime.split('T')[0] || new Date().toISOString().split('T')[0];

      const orderRef = await addDoc(collection(db, 'orders'), {
        customerName: convertingAppointment.clientName,
        total: totalNum,
        status: orderForm.status || 'pending',
        deadline: deadlineVal,
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, 'appointments', convertingAppointment.id), {
        status: 'completed',
        outcome: 'sold',
        convertedOrderId: orderRef.id,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await createPostItNote({
        workspaceId: currentWorkspace.id,
        title: `Venda: ${convertingAppointment.clientName}`,
        content: `🎉 [VENDA CONVERTIDA DE VISITA]\n👤 Cliente: ${convertingAppointment.clientName}\n💰 Valor: R$ ${totalNum.toFixed(2)}\n📅 Prazo de Entrega: ${deadlineVal}`,
        type: 'order'
      });

      showFeedback(`Visita convertida em Pedido de R$ ${totalNum.toFixed(2)} na Agenda de Pedidos!`);
      setConvertingAppointment(null);
      setOrderForm({ total: '', deadline: '', status: 'pending' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAppointment = async (appointment: Appointment) => {
    if (!confirm(`Deseja realmente excluir o agendamento de "${appointment.clientName}"?`)) return;
    setIsDeleting(appointment.id);
    try {
      if (googleTokens && appointment.googleEventId) {
        try {
          await fetch(`/api/calendar/events/${appointment.googleEventId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: googleTokens })
          });
        } catch (_) {}
      }
      await executeDelete('appointments', appointment.id);
      showFeedback('Agendamento excluído.');
    } catch (error: any) {
      alert('Não foi possível excluir: ' + (error.message || 'Erro'));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleExportCSV = () => {
    if (appointments.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }

    const rows = [
      ['Cliente', 'E-mail', 'Telefone', 'Status', 'Início', 'Término', 'Local', 'Observações']
    ];

    appointments.forEach(a => {
      rows.push([
        `"${a.clientName || ''}"`,
        `"${a.clientEmail || ''}"`,
        `"${a.clientPhone || ''}"`,
        `"${a.status || ''}"`,
        `"${a.startTime ? format(parseISO(a.startTime), 'dd/MM/yyyy HH:mm') : ''}"`,
        `"${a.endTime ? format(parseISO(a.endTime), 'dd/MM/yyyy HH:mm') : ''}"`,
        `"${(a.location || '').replace(/"/g, '""')}"`,
        `"${(a.observations || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `visitas_agendadas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const totalScheduled = appointments.filter(a => a.status === 'scheduled').length;
  const totalCompleted = appointments.filter(a => a.status === 'completed').length;
  const totalSold = appointments.filter(a => a.outcome === 'sold' || a.convertedOrderId).length;
  const totalCancelled = appointments.filter(a => a.status === 'cancelled').length;

  // Filtered Appointments
  const filteredAppointments = appointments.filter(appt => {
    const matchesFilter = activeFilter === 'all' || appt.status === activeFilter;
    const matchesSearch = !searchTerm || 
      appt.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appt.observations && appt.observations.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (appt.location && appt.location.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-neutral-900 text-white rounded-xl shadow-md">
              <CalendarCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-neutral-900">
                Visitas & Agendamentos
              </h2>
              <p className="text-sm text-neutral-500 font-medium">
                Planeje reuniões, visitas técnicas e comerciais, envie lembretes e converta em vendas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!googleTokens ? (
            <Button 
              variant="outline" 
              onClick={connectGoogle}
              className="rounded-xl border-neutral-300 text-xs font-bold gap-2 hover:bg-neutral-50 h-10"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              Sincronizar Google Agenda
            </Button>
          ) : (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Google Agenda Conectado
            </Badge>
          )}

          <Button 
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-xl border-neutral-300 text-xs font-bold gap-1.5 h-10 hover:bg-neutral-50"
            title="Exportar agenda para arquivo CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          {onNavigateToTab && (
            <Button 
              variant="outline"
              onClick={() => onNavigateToTab('clients')}
              className="rounded-xl border-neutral-900 text-neutral-900 hover:bg-neutral-100 text-xs font-bold gap-1.5 h-10"
            >
              <Users className="w-4 h-4 text-blue-600" />
              Ver Carteira de Clientes
            </Button>
          )}

          {canEdit && (
            <Button 
              onClick={() => setIsAddingAppointment(!isAddingAppointment)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold gap-1.5 h-10 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Agendar Visita
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
            className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Agendamentos Ativos</p>
              <h3 className="text-2xl font-black text-neutral-900">{totalScheduled}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Compromissos pendentes</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Visitas Concluídas</p>
              <h3 className="text-2xl font-black text-emerald-600">{totalCompleted}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Reuniões realizadas</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Vendas Geradas</p>
              <h3 className="text-2xl font-black text-purple-600">{totalSold}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Convertidas em pedidos</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Canceladas</p>
              <h3 className="text-2xl font-black text-red-600">{totalCancelled}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Desistências / reagendadas</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form: New Appointment */}
      <AnimatePresence>
        {isAddingAppointment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-neutral-900 shadow-xl bg-white">
              <CardHeader className="bg-neutral-900 text-white p-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-400" />
                  Agendar Nova Visita / Reunião
                </CardTitle>
                <CardDescription className="text-neutral-300 text-xs">
                  Preencha os detalhes do compromisso. É possível selecionar um cliente já cadastrado ou digitar um novo contato.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCreateAppointment} className="space-y-4">
                  {clients.length > 0 && (
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <label className="text-xs font-bold text-neutral-700 block mb-1.5">
                        💡 Selecionar Cliente Existente da Carteira (Opcional)
                      </label>
                      <select
                        aria-label="Selecionar cliente existente"
                        className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={appointmentForm.clientId}
                        onChange={(e) => {
                          const sel = clients.find(c => c.id === e.target.value);
                          if (sel) {
                            setAppointmentForm({
                              ...appointmentForm,
                              clientId: sel.id,
                              clientName: sel.name,
                              clientEmail: sel.email || '',
                              clientPhone: sel.phone || '',
                              location: sel.address || '',
                              observations: sel.notes ? `Notas: ${sel.notes}` : appointmentForm.observations
                            });
                          } else {
                            setAppointmentForm({ ...appointmentForm, clientId: '' });
                          }
                        }}
                      >
                        <option value="">-- Digitar manualmente ou selecionar cliente --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.company ? `(${c.company})` : ''} - {c.phone || c.email || 'Sem contato'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Nome do Cliente *</label>
                      <Input
                        required
                        placeholder="Ex: Carlos Mendes"
                        value={appointmentForm.clientName}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, clientName: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Telefone / WhatsApp</label>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={appointmentForm.clientPhone}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, clientPhone: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">E-mail do Cliente</label>
                      <Input
                        type="email"
                        placeholder="carlos@empresa.com"
                        value={appointmentForm.clientEmail}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, clientEmail: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Data e Hora de Início *</label>
                      <Input
                        required
                        type="datetime-local"
                        value={appointmentForm.startTime}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Data e Hora de Término *</label>
                      <Input
                        required
                        type="datetime-local"
                        value={appointmentForm.endTime}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">Local / Endereço da Visita</label>
                      <Input
                        placeholder="Ex: Sede do cliente ou Link Online"
                        value={appointmentForm.location}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, location: e.target.value })}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Observações e Pauta da Reunião</label>
                    <Input
                      placeholder="Ex: Apresentação de proposta comercial, demonstração de produtos..."
                      value={appointmentForm.observations}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, observations: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700 select-none">
                      <input
                        type="checkbox"
                        checked={appointmentForm.autoPostIt}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, autoPostIt: e.target.checked })}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
                      />
                      <span>📌 Gerar anotação automática no mural de Post-its</span>
                    </label>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsAddingAppointment(false)}
                        className="rounded-xl h-10 text-xs font-bold"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={actionLoading}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-10 text-xs font-bold px-5"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Agendamento'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Convert Visit into Order */}
      <AnimatePresence>
        {convertingAppointment && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-neutral-200"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-purple-700">
                  <ShoppingBag className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Converter Visita em Pedido</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConvertingAppointment(null)} className="rounded-full">
                  ✕
                </Button>
              </div>

              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-xs space-y-1 text-purple-900">
                <p className="font-bold text-sm">Cliente: {convertingAppointment.clientName}</p>
                <p className="text-purple-700">
                  Data da Visita: {convertingAppointment.startTime ? format(parseISO(convertingAppointment.startTime), "dd/MM/yyyy HH:mm") : ''}
                </p>
                <p className="text-purple-600 italic">"{convertingAppointment.observations || 'Sem observações'}"</p>
              </div>

              <form onSubmit={handleConvertVisitToOrder} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Valor Total do Pedido (R$) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={orderForm.total}
                    onChange={(e) => setOrderForm({ ...orderForm, total: e.target.value })}
                    className="h-11 text-base font-bold rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Prazo de Entrega *</label>
                    <Input
                      required
                      type="date"
                      value={orderForm.deadline}
                      onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Status Inicial do Pedido</label>
                    <select
                      aria-label="Status inicial do pedido"
                      className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                      value={orderForm.status}
                      onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as any })}
                    >
                      <option value="pending">🟡 Pendente</option>
                      <option value="shipped">🔵 Enviado</option>
                      <option value="delivered">🟢 Entregue</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t">
                  <Button type="button" variant="ghost" onClick={() => setConvertingAppointment(null)} className="rounded-xl h-10 text-xs font-bold">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={actionLoading} className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl h-10 text-xs font-bold px-5 gap-2">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Criar Pedido na Agenda
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <Input
            placeholder="Buscar visita por cliente, e-mail, local ou pauta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl border-neutral-200"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('all')}
            className="rounded-xl text-xs font-bold h-9"
          >
            Todas ({appointments.length})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'scheduled' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('scheduled')}
            className={cn("rounded-xl text-xs font-bold h-9", activeFilter === 'scheduled' && "bg-amber-600 hover:bg-amber-700")}
          >
            Agendadas ({totalScheduled})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'completed' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('completed')}
            className={cn("rounded-xl text-xs font-bold h-9", activeFilter === 'completed' && "bg-emerald-600 hover:bg-emerald-700")}
          >
            Concluídas ({totalCompleted})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('cancelled')}
            className={cn("rounded-xl text-xs font-bold h-9", activeFilter === 'cancelled' && "bg-red-600 hover:bg-red-700")}
          >
            Canceladas ({totalCancelled})
          </Button>
        </div>
      </div>

      {/* Grid of Appointments */}
      {filteredAppointments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-neutral-200">
          <CalendarIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">Nenhum agendamento encontrado</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || activeFilter !== 'all'
              ? 'Nenhuma visita corresponde aos filtros aplicados.'
              : 'Agende sua primeira visita ou sincronize seus compromissos com o Google Agenda.'}
          </p>
          {canEdit && !searchTerm && activeFilter === 'all' && (
            <Button
              onClick={() => setIsAddingAppointment(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Primeiro Agendamento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAppointments.map((appointment) => {
            const isCompleted = appointment.status === 'completed';
            const isCancelled = appointment.status === 'cancelled';
            const isSold = appointment.outcome === 'sold' || !!appointment.convertedOrderId;

            return (
              <Card 
                key={appointment.id} 
                className={cn(
                  "border-neutral-200/80 hover:border-neutral-400 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between overflow-hidden bg-white",
                  isCompleted && "bg-neutral-50/50 border-emerald-200",
                  isCancelled && "opacity-60 bg-red-50/30 border-red-200"
                )}
              >
                <div>
                  <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="font-black text-neutral-900 text-base">
                        {appointment.clientName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>
                          {appointment.startTime ? format(parseISO(appointment.startTime), "dd 'de' MMM, HH:mm", { locale: ptBR }) : 'A definir'}
                          {appointment.endTime ? ` - ${format(parseISO(appointment.endTime), "HH:mm")}` : ''}
                        </span>
                      </div>
                    </div>

                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                        isSold && "bg-purple-50 text-purple-800 border-purple-300",
                        !isSold && isCompleted && "bg-emerald-50 text-emerald-800 border-emerald-300",
                        isCancelled && "bg-red-50 text-red-800 border-red-300",
                        !isCompleted && !isCancelled && "bg-amber-50 text-amber-800 border-amber-300"
                      )}
                    >
                      {isSold ? '🎉 Venda Fechada' : isCompleted ? '🟢 Concluída' : isCancelled ? '🔴 Cancelada' : '🟡 Agendada'}
                    </Badge>
                  </div>

                  <div className="p-5 space-y-3 text-xs">
                    {appointment.clientPhone && (
                      <div className="flex items-center justify-between text-neutral-700">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-600">
                          <Phone className="w-3.5 h-3.5 text-neutral-400" />
                          {appointment.clientPhone}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openClientWhatsApp(appointment.clientPhone, appointment.clientName, appointment.startTime)}
                          className="h-7 px-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Confirmar
                        </Button>
                      </div>
                    )}

                    {appointment.clientEmail && (
                      <p className="text-neutral-600 flex items-center gap-1.5 truncate" title={appointment.clientEmail}>
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{appointment.clientEmail}</span>
                      </p>
                    )}

                    {appointment.location && (
                      <p className="text-neutral-600 flex items-center gap-1.5 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{appointment.location}</span>
                      </p>
                    )}

                    {appointment.observations && (
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 text-[11px] text-neutral-600">
                        <strong>Pauta/Notas:</strong> {appointment.observations}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-neutral-50/80 border-t border-neutral-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1.5">
                    {canEdit && !isCompleted && !isCancelled && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConvertingAppointment(appointment)}
                          className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold h-8 flex-1 gap-1 shadow-sm"
                          title="Converter esta visita em um Pedido"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Gerar Pedido
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(appointment, 'completed')}
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold h-8"
                          title="Marcar como visita concluída"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}

                    {canEdit && isCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(appointment, 'scheduled')}
                        className="text-xs font-bold rounded-xl h-8 flex-1"
                      >
                        Reabrir Agendamento
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCreatePostItForAppointment(appointment)}
                      className="h-8 w-8 rounded-lg hover:bg-amber-100 text-amber-700"
                      title="Criar anotação rápida no Post-it"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                    </Button>

                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isDeleting === appointment.id}
                        onClick={() => handleDeleteAppointment(appointment)}
                        className="h-8 w-8 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Excluir agendamento"
                      >
                        {isDeleting === appointment.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
