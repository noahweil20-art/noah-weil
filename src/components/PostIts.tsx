import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, doc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { PostIt } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, StickyNote, Edit2, Check, X, Palette, Layout as WhiteboardIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import Whiteboard from './Whiteboard';

import { executeDelete } from '@/lib/deleteHelper';

const COLORS = [
  'bg-yellow-100 border-yellow-200',
  'bg-blue-100 border-blue-200',
  'bg-green-100 border-green-200',
  'bg-pink-100 border-pink-200',
  'bg-purple-100 border-purple-200',
];

const EXTENDED_COLORS = [
  ...COLORS,
  'bg-orange-100 border-orange-200',
  'bg-cyan-100 border-cyan-200',
  'bg-rose-100 border-rose-200',
  'bg-indigo-100 border-indigo-200',
  'bg-teal-100 border-teal-200',
];

interface PostItsProps {
  defaultView?: 'grid' | 'whiteboard';
  onNavigateToTab?: (tab: string) => void;
}

export default function PostIts({ defaultView = 'grid', onNavigateToTab }: PostItsProps) {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [notes, setNotes] = React.useState<PostIt[]>([]);
  const [newNote, setNewNote] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState(COLORS[0]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'whiteboard'>(defaultView);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Sync view if defaultView prop changes from navigation
  React.useEffect(() => {
    if (defaultView) {
      setView(defaultView);
    }
  }, [defaultView]);

  const colorsToUse = plan?.id === 'base' ? COLORS : EXTENDED_COLORS;
  const whiteboardEnabled = plan?.permissions?.whiteboardEnabled !== false;

  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'postits'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PostIt[];
      setNotes(notesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'postits');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !auth.currentUser || !currentWorkspace) return;

    const maxPosts = plan?.permissions.maxPostIts ?? 10;
    if (maxPosts !== -1) {
      if (!checkLimit(`criar novas notas adesivas (limite de ${maxPosts} post-its do seu plano atingido)`, notes.length < maxPosts)) {
        return;
      }
    }

    try {
      await addDoc(collection(db, 'postits'), {
        content: newNote,
        color: selectedColor,
        createdAt: serverTimestamp(),
        userId: auth.currentUser.uid,
        ownerId: auth.currentUser.uid,
        workspaceId: currentWorkspace.id,
        x: Math.random() * 400 + 50,
        y: Math.random() * 300 + 50,
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'postits');
    }
  };

  const handleDeleteNote = async (id: string, noteOwnerId?: string) => {
    setIsDeleting(id);
    try {
      await executeDelete('postits', id);
      setIsDeleting(null);
    } catch (error: any) {
      console.error("[DELETE] Erro ao excluir Post-it:", error);
      setIsDeleting(null);
      alert('Não foi possível excluir a nota: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleUpdateNote = async (id: string, customContent?: string) => {
    const textToSave = customContent !== undefined ? customContent : editContent;
    if (!textToSave.trim()) return;
    try {
      await updateDoc(doc(db, 'postits', id), {
        content: textToSave
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `postits/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">
            {view === 'whiteboard' ? 'Quadro Branco Interativo' : 'Post-its Digitais'}
          </h2>
          <p className="text-muted-foreground">
            {view === 'whiteboard' 
              ? 'Desenhe esquemas, trace conexões e posicione notas livres no quadro interativo em tempo real.'
              : 'Organize lembretes, avisos de clientes e tarefas rápidas em cartões coloridos.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-xl self-start sm:self-auto border border-neutral-200/60 shadow-inner">
          <Button 
            variant={view === 'grid' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-lg h-9 font-semibold text-xs transition-all"
            onClick={() => {
              setView('grid');
              onNavigateToTab?.('postits');
            }}
          >
            <Palette className="w-4 h-4 mr-1.5" />
            Grade de Post-its
          </Button>
          <Button 
            variant={view === 'whiteboard' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-lg h-9 font-semibold text-xs transition-all"
            onClick={() => {
              setView('whiteboard');
              onNavigateToTab?.('whiteboard');
            }}
          >
            <WhiteboardIcon className="w-4 h-4 mr-1.5 text-primary" />
            Quadro Branco (Canvas)
          </Button>
        </div>
      </div>

      {view === 'whiteboard' ? (
        <div className="space-y-4">
          {canEdit && (
            <div className="bg-white p-4 rounded-2xl flex flex-wrap gap-3 items-center shadow-sm border border-neutral-200">
              <Input
                placeholder="Digitar nova ideia no quadro..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="h-11 rounded-xl flex-1 min-w-[240px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote(e);
                }}
              />
              <div className="flex gap-1.5">
                {colorsToUse.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      color.split(' ')[0],
                      selectedColor === color ? "scale-110 border-neutral-800 ring-2 ring-neutral-300" : "border-transparent hover:scale-105"
                    )}
                  />
                ))}
              </div>
              <Button onClick={handleAddNote} disabled={!newNote.trim()} className="h-11 px-6 rounded-xl font-bold">
                <Plus className="w-4 h-4 mr-1.5" />
                Criar Nota
              </Button>
            </div>
          )}
          <Whiteboard
            notes={notes}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleUpdateNote}
            colorsToUse={colorsToUse}
          />
        </div>
      ) : (
        <>
          {canEdit && (
            <Card className="max-w-xl rounded-2xl border-neutral-200 shadow-sm">
              <CardContent className="p-6">
                <form onSubmit={handleAddNote} className="space-y-4">
                  <Textarea
                    placeholder="Escreva uma nova nota..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[100px] resize-none rounded-xl"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {colorsToUse.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-transform",
                            color.split(' ')[0],
                            selectedColor === color ? "scale-125 border-neutral-800" : "border-transparent"
                          )}
                        />
                      ))}
                    </div>
                    <Button type="submit" disabled={!newNote.trim()} className="rounded-xl font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Nota
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {notes.map((note) => {
                const currentUid = auth.currentUser?.uid;
                const isOwner = Boolean(
                  (note.ownerId && note.ownerId === currentUid) ||
                  (note.userId && note.userId === currentUid)
                );
                const canDeleteThisNote = canEdit || isAdmin || isOwner;

                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={cn("h-full border-t-4 shadow-sm rounded-2xl overflow-hidden", note.color)}>
                      <CardContent className="p-4 flex flex-col h-full min-h-[160px]">
                        <div className="flex-1">
                          {editingId === note.id ? (
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[100px] text-sm bg-white/70 rounded-xl"
                              autoFocus
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium text-neutral-900">{note.content}</p>
                          )}
                        </div>
                        <div className="flex justify-end mt-4 gap-1 pt-2 border-t border-black/5">
                          {canEdit && (
                            <>
                              {editingId === note.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                    onClick={() => handleUpdateNote(note.id)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-neutral-500 rounded-lg"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-neutral-500 hover:text-neutral-900 rounded-lg"
                                    onClick={() => {
                                      setEditingId(note.id);
                                      setEditContent(note.content);
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  {canDeleteThisNote && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isDeleting === note.id}
                                      className="h-8 w-8 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                      onClick={() => handleDeleteNote(note.id, note.ownerId || note.userId)}
                                      title="Excluir nota"
                                    >
                                      {isDeleting === note.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </Button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {notes.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-white rounded-2xl border border-dashed border-neutral-300">
                <StickyNote className="w-12 h-12 mb-3 opacity-30 text-neutral-400" />
                <p className="font-semibold text-neutral-600">Nenhuma nota ainda no workspace.</p>
                <p className="text-xs text-neutral-400">Adicione uma nota acima para começar.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

