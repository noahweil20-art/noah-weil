import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Shield, 
  Users, 
  KeyRound, 
  Copy, 
  Check, 
  ArrowUpRight,
  Crown,
  Loader2
} from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { cn } from '@/lib/utils';

export default function WorkspaceSharing() {
  const { currentWorkspace, joinWorkspaceWithCode, updateMemberRole } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [joinCodeInput, setJoinCodeInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const userId = auth.currentUser?.uid;
  const isOwner = currentWorkspace?.ownerId === userId;
  const currentMember = currentWorkspace?.members && userId ? currentWorkspace.members[userId] : null;
  const isAdmin = isOwner || currentMember?.role === 'admin';

  const memberCount = Object.keys(currentWorkspace?.members || {}).length;
  const maxMembers = plan?.permissions?.maxMembers || 6;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setLoading(true);
    try {
      await joinWorkspaceWithCode(joinCodeInput);
      setJoinCodeInput('');
      alert('Você entrou no workspace com sucesso!');
    } catch (error: any) {
      alert(error.message || "Erro ao entrar no workspace.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!currentWorkspace?.joinCode) return;
    if (!checkLimit(`adicionar mais membros ao workspace (limite de ${maxMembers} membros atingido)`, memberCount < maxMembers)) {
      return;
    }
    navigator.clipboard.writeText(currentWorkspace.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = async (memberUserId: string) => {
    if (!currentWorkspace || !isAdmin) return;
    if (memberUserId === currentWorkspace.ownerId) {
      alert("Não é possível remover o proprietário.");
      return;
    }

    setIsDeleting(memberUserId);
    try {
      const wsRef = doc(db, 'workspaces', currentWorkspace.id);
      await updateDoc(wsRef, {
        [`members.${memberUserId}`]: deleteField()
      });
      setIsDeleting(null);
    } catch (error) {
      console.error("Error removing member:", error);
      setIsDeleting(null);
      alert('Erro ao remover membro.');
    }
  };

  const toggleRole = async (memberUserId: string, currentRole: 'view' | 'edit' | 'admin') => {
    if (!currentWorkspace || !isAdmin) return;
    if (memberUserId === currentWorkspace.ownerId) return;

    let nextRole: 'view' | 'edit' | 'admin' = 'view';
    if (currentRole === 'view') nextRole = 'edit';
    else if (currentRole === 'edit') nextRole = 'admin';
    else if (currentRole === 'admin') nextRole = 'view';

    try {
      await updateMemberRole(currentWorkspace.id, memberUserId, nextRole);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 rounded-xl text-white">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 italic serif uppercase">Compartilhamento</h1>
        </div>
        <p className="text-neutral-500 max-w-2xl font-medium">
          Gerencie o acesso ao workspace via códigos de convite e controle os níveis de permissão.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Join Form */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-neutral-400" />
                Entrar em Workspace
              </CardTitle>
              <CardDescription className="text-xs font-medium">Insira um código para participar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <Input
                  placeholder="EX: A1B2C3"
                  className="h-12 text-center uppercase font-black text-xl tracking-widest border-neutral-100 bg-neutral-50 focus-visible:ring-neutral-900"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  maxLength={6}
                />
                <Button type="submit" className="w-full h-12 font-bold rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar no Workspace'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Current Code Display */}
          {currentWorkspace && (
            <Card className="border-none shadow-md bg-neutral-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Shield className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  Código do Workspace
                </CardTitle>
                <CardDescription className="text-neutral-400 text-xs font-medium">Compartilhe este código com sua equipe.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                <div className="bg-white/10 rounded-2xl p-6 text-center border border-white/10 group relative">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">Código de Convite</p>
                  <h2 className="text-4xl font-black tracking-[0.3em] font-mono">{currentWorkspace.joinCode}</h2>
                  
                  <button 
                    onClick={handleCopyCode}
                    className="mt-4 flex items-center gap-2 mx-auto text-[10px] font-bold uppercase tracking-widest hover:text-green-400 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copiado!" : "Copiar Código"}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {currentWorkspace ? (
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                      <Users className="w-6 h-6 text-neutral-900" />
                      Membros da Equipe
                    </CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                      {Object.keys(currentWorkspace.members || {}).length} pessoas com acesso
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {Object.entries(currentWorkspace.members || {}).map(([memberId, memberInfo]) => (
                    <div key={memberId} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all",
                          memberInfo.role === 'admin' ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200"
                        )}>
                          {memberInfo.name?.[0].toUpperCase() || memberInfo.email?.[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900">{memberInfo.name}</p>
                            {memberId === currentWorkspace.ownerId && (
                              <Badge className="bg-amber-100 text-amber-700 border-none h-4 px-1 text-[8px] font-black uppercase tracking-tighter">
                                DONO
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-neutral-500">{memberInfo.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest",
                            memberInfo.role === 'admin' ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white border-neutral-200 text-neutral-600"
                          )}>
                            {memberInfo.role === 'admin' ? <Crown className="w-3 h-3 text-amber-400" /> : <Shield className="w-3 h-3" />}
                            {memberInfo.role === 'admin' ? 'Admin' : memberInfo.role === 'edit' ? 'Editor' : 'Leitor'}
                          </div>

                          {isAdmin && memberId !== currentWorkspace.ownerId && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="w-8 h-8 rounded-lg border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all"
                              onClick={() => toggleRole(memberId, memberInfo.role)}
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {isAdmin && memberId !== currentWorkspace.ownerId && memberId !== userId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting === memberId}
                            className="h-10 w-10 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                            onClick={() => handleRemove(memberId)}
                          >
                            {isDeleting === memberId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-neutral-200">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl">Nenhum Workspace Selecionado</h3>
              <p className="text-neutral-500 text-sm max-w-sm mx-auto">
                Selecione um workspace no menu lateral ou entre em um workspace existente usando um código de convite.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
