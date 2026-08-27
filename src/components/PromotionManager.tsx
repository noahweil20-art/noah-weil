import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Promotion } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tag, Calendar, Trash2, Plus, Power, Edit2, Loader2, StickyNote, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { executeDelete } from '@/lib/deleteHelper';
import { createPostItNote } from '@/lib/postItHelper';

export default function PromotionManager() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [autoPostIt, setAutoPostIt] = React.useState(true);
  const [postItFeedback, setPostItFeedback] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    discount: '',
    startDate: '',
    endDate: '',
  });

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'promotions'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promoData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Promotion[];
      setPromotions(promoData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'promotions');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleCreatePostItForPromo = async (promo: { title: string; discount: string; startDate: string; endDate: string; description?: string }) => {
    if (!currentWorkspace) return;
    const descStr = promo.description ? `\n📝 Detalhes: ${promo.description}` : '';
    const content = `📌 [PROMOÇÃO] ${promo.title}\n🎁 Desconto: ${promo.discount}\n📅 Período: ${promo.startDate} até ${promo.endDate}${descStr}`;
    
    const success = await createPostItNote({
      workspaceId: currentWorkspace.id,
      title: `Promoção: ${promo.title}`,
      content,
      type: 'promotion'
    });

    if (success) {
      setPostItFeedback(`Anotação de "${promo.title}" gerada nos Post-its com sucesso!`);
      setTimeout(() => setPostItFeedback(null), 4000);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !currentWorkspace) return;

    try {
      await addDoc(collection(db, 'promotions'), {
        ...formData,
        active: true,
        userId: auth.currentUser.uid,
        ownerId: auth.currentUser.uid,
        workspaceId: currentWorkspace.id
      });

      if (autoPostIt) {
        await handleCreatePostItForPromo(formData);
      }

      setFormData({ title: '', description: '', discount: '', startDate: '', endDate: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'promotions');
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await executeDelete('promotions', id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir promoção:", error);
      setIsDeleting(null);
      alert('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'promotions', id), { active: !current });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `promotions/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">Controle de Promoções</h2>
          <p className="text-muted-foreground">Agende e gerencie suas ofertas especiais.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Promoção
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
            <CardTitle>Criar Nova Promoção</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Título da Promoção</label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Desconto (ex: 20% ou R$ 50)</label>
                <Input
                  required
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início</label>
                <Input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  required
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
                <Button type="submit">Publicar Promoção</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.map((promo) => (
          <Card key={promo.id} className={cn(
            "overflow-hidden transition-all hover:shadow-lg border-l-4",
            promo.active ? "border-l-primary" : "border-l-neutral-300 opacity-75"
          )}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Tag className="w-5 h-5" />
                </div>
                <Badge variant={promo.active ? "default" : "secondary"}>
                  {promo.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              
              <h3 className="font-bold text-xl mb-1">{promo.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{promo.description}</p>
              
              <div className="text-3xl font-black text-primary mb-6">
                {promo.discount} OFF
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{promo.startDate} até {promo.endDate}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreatePostItForPromo(promo)}
                  title="Gerar anotação desta promoção nos Post-its"
                  className="w-full text-xs font-bold border-neutral-200 hover:bg-neutral-100 flex items-center justify-center gap-1.5"
                >
                  <StickyNote className="w-3.5 h-3.5 text-pink-500" />
                  <span>Criar Anotação</span>
                </Button>

                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs font-bold"
                      onClick={() => toggleActive(promo.id, promo.active)}
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" />
                      {promo.active ? "Desativar" : "Ativar"}
                    </Button>
                    {(canEdit || isAdmin) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting === promo.id}
                        className="text-muted-foreground hover:text-destructive h-9 w-9"
                        onClick={() => handleDelete(promo.id)}
                      >
                        {isDeleting === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {promotions.length === 0 && !isAdding && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border border-dashed">
            <Tag className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhuma promoção cadastrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
