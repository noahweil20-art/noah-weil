import * as React from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  StickyNote, 
  CalendarClock, 
  Tag, 
  PackageSearch, 
  MessageSquare, 
  LogOut, 
  Menu, 
  X, 
  Store,
  CalendarDays,
  Users,
  Share2,
  ChevronDown,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  Bot,
  Check,
  Plus,
  Trash2,
  Loader2,
  Table as TableIcon,
  Headphones,
  PhoneCall,
  ExternalLink,
  Lock,
  PenTool
} from 'lucide-react';
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from './ui/input';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, onLogout }: LayoutProps) {
  const { isSuperUser, plan } = useUser();
  const { checkLimit, showPlanLimitModal } = usePlanLimit();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [newWsName, setNewWsName] = React.useState('');
  const [isCreatingWs, setIsCreatingWs] = React.useState(false);
  const { 
    currentWorkspace, 
    workspaces, 
    setCurrentWorkspace, 
    createWorkspace,
    deleteWorkspace,
    leaveWorkspace
  } = useWorkspace();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'whiteboard', label: 'Quadro Branco', icon: PenTool, permission: true },
    { id: 'postits', label: 'Post-its', icon: StickyNote, permission: true },
    { id: 'spreadsheets', label: 'Planilhas em Branco', icon: TableIcon, permission: plan?.permissions.spreadsheetEnabled },
    { id: 'orders', label: 'Agenda de Pedidos', icon: CalendarClock },
    { id: 'appointments', label: 'Visitas & Agendamentos', icon: CalendarDays },
    { id: 'clients', label: 'Carteira de Clientes', icon: Users },
    { id: 'promotions', label: 'Promoções', icon: Tag },
    { id: 'competitors', label: 'Concorrentes', icon: TrendingUp },
    { id: 'restock', label: plan?.permissions?.erpExpressEnabled ? 'ERP Express' : 'ERP Express Lite', icon: PackageSearch, permission: true },
    { id: 'ai_assistant', label: 'Assistente AI', icon: Bot, permission: plan?.permissions.aiAssistantEnabled },
    { id: 'sharing', label: 'Compartilhamento', icon: Share2 },
    { id: 'chat', label: 'Chat da Equipe', icon: MessageSquare },
  ];

  const allNavItems = [...menuItems];
  allNavItems.push({ id: 'subscription', label: 'Minha Assinatura', icon: CreditCard, permission: true });

  if (isSuperUser) {
    allNavItems.push({ id: 'admin', label: 'Painel Admin', icon: ShieldCheck, permission: true });
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || isCreatingWs) return;

    const maxWs = plan?.permissions?.maxWorkspaces ?? 2;
    const ownedCount = workspaces.filter(ws => ws.ownerId === auth.currentUser?.uid).length;
    if (!checkLimit(`criar novos workspaces (limite de ${maxWs} workspaces do seu plano atingido)`, ownedCount < maxWs)) {
      return;
    }

    setIsCreatingWs(true);
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName('');
    } catch (error) {
      console.error("Failed to create workspace");
    } finally {
      setIsCreatingWs(false);
    }
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, wsId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`TEM CERTEZA que deseja excluir o workspace "${name}"?\nIsso apagará o acesso de todos os membros.`)) return;
    try {
      await deleteWorkspace(wsId);
    } catch (error: any) {
      alert(error.message || "Erro ao excluir workspace");
    }
  };

  const handleLeaveWorkspace = async (e: React.MouseEvent, wsId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Deseja realmente sair do workspace "${name}"?`)) return;
    try {
      await leaveWorkspace(wsId);
    } catch (error: any) {
      alert(error.message || "Erro ao sair do workspace");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-black text-lg tracking-tight">Express Tools</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={getWhatsAppSupportUrl("Olá! Preciso de ajuda com o suporte do Express Tools.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
            title="Contatar Suporte no WhatsApp (41) 99667-9075"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Suporte</span>
          </a>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 lg:relative lg:z-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0 bg-white border-r w-72 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Store className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight leading-none">Express Tools</span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Hub do Lojista</span>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="px-4 mb-6">
          <Popover>
            <PopoverTrigger className={cn(
              "w-full flex items-center justify-between h-12 px-4 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              "text-neutral-900 group"
            )}>
              <div className="flex items-center gap-2 truncate">
                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Store className="w-3 h-3" />
                </div>
                <span className="truncate text-xs font-bold">{currentWorkspace?.name || 'Carregando...'}</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">Seus Workspaces</p>
                {workspaces.map((ws) => {
                  const isOwner = ws.ownerId === auth.currentUser?.uid;
                  return (
                    <div key={ws.id} className="flex items-center gap-1 group/ws">
                      <button
                        onClick={() => {
                          setCurrentWorkspace(ws);
                          setIsMobileMenuOpen(false);
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-between px-2 py-2 rounded-md text-xs transition-colors truncate",
                          currentWorkspace?.id === ws.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-neutral-100"
                        )}
                      >
                        <span className="truncate">{ws.name}</span>
                        {currentWorkspace?.id === ws.id && <Check className="w-3 h-3 shrink-0 ml-1" />}
                      </button>
                      
                      {isOwner ? (
                        workspaces.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteWorkspace(e, ws.id, ws.name)}
                            className="p-2 text-neutral-300 hover:text-red-500 opacity-0 group-hover/ws:opacity-100 transition-opacity"
                            title="Excluir Workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : (
                        <button
                          onClick={(e) => handleLeaveWorkspace(e, ws.id, ws.name)}
                          className="p-2 text-neutral-300 hover:text-orange-500 opacity-0 group-hover/ws:opacity-100 transition-opacity"
                          title="Sair do Workspace"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 border-t pt-2 p-2">
                <form onSubmit={handleCreateWorkspace} className="space-y-2">
                  <Input
                    placeholder="Nome do novo workspace"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  <Button type="submit" className="w-full h-8 text-[10px] font-bold" disabled={isCreatingWs}>
                    {isCreatingWs ? 'Criando...' : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        Novo Workspace
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isLocked = item.permission === false;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isLocked) {
                    showPlanLimitModal(`ao recurso ${item.label} (disponível em planos superiores)`);
                    return;
                  }
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 translate-x-1" 
                    : isLocked
                    ? "text-neutral-400 hover:bg-amber-50/60 hover:text-amber-900"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "animate-pulse" : "")} />
                  <span>{item.label}</span>
                </div>
                {isLocked && (
                  <span className="p-1 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t bg-neutral-50/50 space-y-3">
          {/* Suporte WhatsApp */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <Headphones className="w-3 h-3" />
                </div>
                <span>Contatar Suporte</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-[11px] text-emerald-700 leading-tight">
              Atendimento oficial via WhatsApp: <strong className="font-bold">{SUPPORT_PHONE_FORMATTED}</strong>
            </p>
            <a
              href={getWhatsAppSupportUrl(`Olá! Sou ${auth.currentUser?.displayName || 'lojista'} (${auth.currentUser?.email || ''}) e preciso de suporte com o Express Tools.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all hover:shadow"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Mandar Mensagem</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
            </a>
          </div>

          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 h-10 rounded-full bg-neutral-200 overflow-hidden border-2 border-white shadow-sm shrink-0">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500 font-bold">
                  {auth.currentUser?.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">{auth.currentUser?.displayName}</span>
              <span className="text-[10px] text-muted-foreground truncate">{auth.currentUser?.email}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-neutral-500 hover:text-destructive hover:bg-destructive/5 font-bold h-9 text-xs"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2.5" />
            Sair da Conta
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-h-screen relative">
        <div className="max-w-7xl mx-auto pb-16">
          {children}
        </div>

        {/* Floating WhatsApp Support Button - Compact with Expand-on-Hover */}
        <div className="fixed bottom-5 right-5 z-40">
          <a
            href={getWhatsAppSupportUrl(`Olá! Sou ${auth.currentUser?.displayName || 'usuário'} e preciso de suporte com a plataforma.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl shadow-emerald-950/20 hover:shadow-2xl transition-all duration-300 p-3 hover:pr-4.5 hover:pl-3.5 hover:scale-105"
            title={`Suporte WhatsApp: ${SUPPORT_PHONE_FORMATTED}`}
            id="floating-support-btn"
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            
            {/* Expanded Content on Hover */}
            <div className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-xs group-hover:opacity-100 transition-all duration-300 ease-in-out whitespace-nowrap pl-0 group-hover:pl-2.5 flex items-center gap-2">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider leading-none">Suporte Online</span>
                <span className="text-xs font-black leading-tight text-white">{SUPPORT_PHONE_FORMATTED}</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
