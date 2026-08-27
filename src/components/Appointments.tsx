import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Appointment } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, Mail, Plus, Trash2, Edit2, ExternalLink, Loader2, StickyNote, Sparkles } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { executeDelete } from '@/lib/deleteHelper';
import { createPostItNote } from '@/lib/postItHelper';

export default function Appointments() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [googleTokens, setGoogleTokens] = React.useState<any>(null);
  const [autoPostIt, setAutoPostIt] = React.useState(true);
  const [postItFeedback, setPostItFeedback] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    clientName: '',
    clientEmail: '',
    startTime: '',
    endTime: '',
    observations: '',
  });

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

  const connectGoogle = async () => {
    if (!checkLimit('à sincronização com Google Calendar (disponível no Plano Pro)', !!plan?.permissions?.googleCalendarEnabled)) {
      return;
    }
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error("Error getting auth URL:", error);
    }
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
      setPostItFeedback(`Anotação de "${appt.clientName}" gerada nos Post-its com sucesso!`);
      setTimeout(() => setPostItFeedback(null), 4000);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    try {
      let googleEventId = '';
      if (googleTokens) {
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokens: googleTokens,
            event: {
              summary: `Visita: ${formData.clientName}`,
              description: formData.observations,
              start: { dateTime: new Date(formData.startTime).toISOString() },
              end: { dateTime: new Date(formData.endTime).toISOString() },
              attendees: [{ email: formData.clientEmail }]
            }
          })
        });
        const data = await response.json();
        googleEventId = data.id;
      }

      await addDoc(collection(db, 'appointments'), {
        ...formData,
        status: 'scheduled',
        googleEventId,
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid
      });

      if (autoPostIt) {
        await handleCreatePostItForAppointment(formData);
      }

      setIsAdding(false);
      setFormData({ clientName: '', clientEmail: '', startTime: '', endTime: '', observations: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  const handleDelete = async (appointment: Appointment) => {
    setIsDeleting(appointment.id);
    try {
      if (googleTokens && appointment.googleEventId) {
        try {
          await fetch(`/api/calendar/events/${appointment.googleEventId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: googleTokens })
          });
        } catch (calErr) {
          console.warn("[DELETE] Falha ao excluir do Google Calendar:", calErr);
        }
      }
      await executeDelete('appointments', appointment.id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir agendamento:", error);
      setIsDeleting(null);
      alert('Não foi possível excluir o agendamento: ' + (error.message || 'Erro desconhecido'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">Visitas e Compromissos</h2>
          <p className="text-muted-foreground">Gerencie sua agenda e sincronize com o Google Calendar.</p>
        </div>
        <div className="flex gap-2">
          {!googleTokens && (
            <Button variant="outline" onClick={connectGoogle}>
              Conectar Google Agenda
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setIsAdding(!isAdding)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          )}
        </div>
      </div>

      {postItFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{postItFeedback}</span>
        </div>
      )}

      {isAdding && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Agendar Nova Visita</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Cliente</label>
                <Input
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail do Cliente</label>
                <Input
                  required
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Início</label>
                <Input
                  required
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fim</label>
                <Input
                  required
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observações</label>
                <Input
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700 select-none">
                  <input
                    type="checkbox"
                    checked={autoPostIt}
                    onChange={(e) => setAutoPostIt(e.target.checked)}
                    className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>📌 Gerar anotação automática no mural de Post-its</span>
                </label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
                <Button type="submit">Agendar Visita</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {appointments.map((appt) => (
          <Card key={appt.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{appt.clientName}</h3>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {appt.status === 'scheduled' ? 'Agendado' : appt.status}
                      </Badge>
                      {appt.googleEventId && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          Google Calendar
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {appt.clientEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(parseISO(appt.startTime), "dd/MM/yy HH:mm")} - {format(parseISO(appt.endTime), "HH:mm")}
                      </span>
                    </div>
                    {appt.observations && (
                      <p className="mt-2 text-sm text-muted-foreground italic">"{appt.observations}"</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreatePostItForAppointment(appt)}
                    title="Gerar um Post-it deste agendamento"
                    className="rounded-xl h-9 text-xs font-bold border-neutral-300 hover:bg-neutral-100 flex items-center gap-1.5"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Criar Anotação</span>
                  </Button>

                  {(canEdit || isAdmin || appt.ownerId === auth.currentUser?.uid || appt.userId === auth.currentUser?.uid) && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting === appt.id}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(appt)}
                      >
                        {isDeleting === appt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {appointments.length === 0 && !isAdding && (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border border-dashed">
            <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhum agendamento encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
