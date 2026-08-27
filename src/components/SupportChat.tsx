import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User as UserIcon, MessageSquare, Loader2, Trash2, Hash, Headphones, ExternalLink } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useWorkspaceMessages } from '@/hooks/useWorkspaceMessages';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { motion, AnimatePresence } from 'motion/react';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

export default function SupportChat() {
  const { messages, sendMessage, deleteMessage, loading } = useWorkspaceMessages();
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [inputText, setInputText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const canDelete = (userId?: string) => isAdmin || userId === auth.currentUser?.uid;

  const handleDeleteMessage = async (msg: any) => {
    const isOwner = msg.userId === auth.currentUser?.uid;
    if (!isAdmin && !isOwner) {
      alert('Somente o autor da mensagem ou administradores podem excluir conteúdo.');
      return;
    }
    
    if (!isAdmin && plan?.permissions?.canDeleteMessages === false) {
      if (!checkLimit('à exclusão de mensagens no chat (disponível no Plano Pro)', false)) {
        return;
      }
    }

    if (!confirm('Excluir esta mensagem permanentemente?')) return;
    
    setIsDeleting(msg.id);
    try {
      await deleteMessage(msg.id);
      setIsDeleting(null);
    } catch (error: any) {
      setIsDeleting(null);
      const isPermissionError = error.code === 'permission-denied';
      const detail = isPermissionError ? 'Permissão negada no Servidor.' : (error.message || 'Erro desconhecido.');
      alert(`Erro ao excluir mensagem: ${detail}\n\nPath: messages/${msg.id}`);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const containsLink = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi.test(inputText);
    if (containsLink && plan?.permissions?.chatLinksEnabled === false) {
      if (!checkLimit('ao envio de links no chat da equipe (disponível a partir do Plano Intermediário)', false)) {
        return;
      }
    }

    const text = inputText;
    setInputText('');
    try {
      await sendMessage(text);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!currentWorkspace) {
    return (
      <div className="h-[calc(100vh-12rem)] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
          <Hash className="w-8 h-8 text-neutral-400" />
        </div>
        <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Aguardando Contexto</p>
        <p className="text-neutral-500 text-sm italic serif">Selecione um workspace para sincronizar o chat.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight">Chat da Equipe</h2>
        <p className="text-muted-foreground">Comunicação em tempo real para colaboradores do workspace.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/50 py-4 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{currentWorkspace.name}</CardTitle>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Chat Ativo</span>
              </div>
            </div>
          </div>
          <a
            href={getWhatsAppSupportUrl(`Olá! Sou ${auth.currentUser?.displayName || 'lojista'} e preciso de atendimento com a equipe de suporte.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shrink-0"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Suporte WhatsApp: {SUPPORT_PHONE_FORMATTED}</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 bg-muted/10">
          <ScrollArea className="h-full p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isMe = msg.userId === auth.currentUser?.uid;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex flex-col max-w-[80%] gap-1",
                          isMe ? "ml-auto items-end" : "items-start"
                        )}
                      >
                        <span className="text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-tighter">
                          {isMe ? 'Você' : msg.userName}
                        </span>
                        <div className="flex gap-2">
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                              <UserIcon className="w-4 h-4" />
                            </div>
                          )}
                          <div className={cn(
                            "p-3 rounded-2xl text-sm shadow-sm relative group max-w-full break-words",
                            isMe 
                              ? "bg-primary text-primary-foreground rounded-tr-none" 
                              : "bg-background border rounded-tl-none text-foreground"
                          )}>
                            {msg.text}
                            
                            {canDelete(msg.userId) && (
                              <button 
                                disabled={isDeleting === msg.id}
                                onClick={() => handleDeleteMessage(msg)}
                                className={cn(
                                  "absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-background border shadow-sm text-destructive hover:bg-destructive/10",
                                  isMe ? "-right-2" : "-left-2"
                                )}
                              >
                                {isDeleting === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              </button>
                            )}
                            
                            <p className={cn(
                              "text-[8px] mt-1 opacity-70 font-mono",
                              isMe ? "text-right" : ""
                            )}>
                              {msg.createdAt?.toDate ? 
                                msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                                'Enviando...'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={scrollRef} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
                <p className="text-xs">Comece a conversa com sua equipe!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-background">
          <form onSubmit={handleSend} className="flex w-full gap-2">
            <Input
              placeholder="Sua mensagem..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-muted/30 border-input h-11 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" className="h-11 w-11" disabled={!inputText.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
