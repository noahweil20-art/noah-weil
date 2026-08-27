import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Order } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Package, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Loader2, StickyNote, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, parseISO, isPast } from 'date-fns';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { executeDelete } from '@/lib/deleteHelper';
import { createPostItNote } from '@/lib/postItHelper';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  shipped: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export default function OrderSchedule() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [autoPostIt, setAutoPostIt] = React.useState(true);
  const [postItFeedback, setPostItFeedback] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<{
    customerName: string;
    total: number | string;
    status: Order['status'];
    deadline: string;
  }>({
    customerName: '',
    total: '',
    status: 'pending',
    deadline: ''
  });

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'orders'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('deadline', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];
      setOrders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleCreatePostItForOrder = async (order: { customerName: string; total: number | string; deadline: string; status: Order['status'] }) => {
    if (!currentWorkspace) return;
    const formattedDate = order.deadline ? format(parseISO(order.deadline), "dd/MM/yyyy") : 'A definir';
    const statusLabel = STATUS_LABELS[order.status] || order.status;
    const content = `📌 [PEDIDO] ${order.customerName}\n💰 Total: R$ ${(Number(order.total) || 0).toFixed(2)}\n📅 Prazo: ${formattedDate}\n🚦 Status: ${statusLabel}`;
    
    const success = await createPostItNote({
      workspaceId: currentWorkspace.id,
      title: `Pedido: ${order.customerName}`,
      content,
      type: 'order'
    });

    if (success) {
      setPostItFeedback(`Anotação de "${order.customerName}" gerada nos Post-its com sucesso!`);
      setTimeout(() => setPostItFeedback(null), 4000);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    try {
      const newOrder = {
        customerName: formData.customerName,
        total: Number(formData.total) || 0,
        status: formData.status,
        deadline: formData.deadline,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid,
        workspaceId: currentWorkspace.id
      };

      await addDoc(collection(db, 'orders'), newOrder);

      if (autoPostIt) {
        await handleCreatePostItForOrder(formData);
      }

      setIsAdding(false);
      setFormData({ customerName: '', total: '', status: 'pending', deadline: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const handleUpdateStatus = async (id: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
    } catch (error: any) {
      alert('Erro ao atualizar status.');
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleDelete = async (order: Order) => {
    setIsDeleting(order.id);
    try {
      await executeDelete('orders', order.id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir pedido:", error);
      setIsDeleting(null);
      alert('Não foi possível excluir o pedido: ' + (error.message || 'Erro desconhecido'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">Agenda de Pedidos</h2>
          <p className="text-muted-foreground">Acompanhe prazos e status de entrega em tempo real.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        )}
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
            <CardTitle>Cadastrar Novo Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Cliente</label>
                <Input
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor Total (R$)</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.total}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, total: val === '' ? '' : (parseFloat(val) || 0) });
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prazo de Entrega</label>
                <Input
                  required
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status Inicial</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
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
                <Button type="submit">Cadastrar Pedido</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {orders.map((order) => {
          const deadlineDate = parseISO(order.deadline);
          const isOverdue = isPast(deadlineDate) && order.status !== 'delivered';

          return (
            <Card key={order.id} className={cn(
              "hover:shadow-md transition-shadow",
              isOverdue ? "border-destructive/50 bg-destructive/5" : ""
            )}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-full",
                      isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    )}>
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{order.customerName}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[order.status]}>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Atrasado
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Prazo: {format(deadlineDate, "dd/MM/yyyy")}
                        </span>
                        <span className="font-medium text-foreground">
                          R$ {(Number(order.total) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreatePostItForOrder(order)}
                      title="Gerar um Post-it desta encomenda"
                      className="rounded-xl h-9 text-xs font-bold border-neutral-300 hover:bg-neutral-100 flex items-center gap-1.5"
                    >
                      <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                      <span>Criar Anotação</span>
                    </Button>

                    {canEdit && (
                      <>
                        <select
                          className="h-9 px-2 rounded-md border border-input bg-background text-xs"
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as Order['status'])}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        {(canEdit || isAdmin || order.ownerId === auth.currentUser?.uid || order.userId === auth.currentUser?.uid) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting === order.id}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(order)}
                          >
                            {isDeleting === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {orders.length === 0 && !isAdding && (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border border-dashed">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhum pedido agendado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
