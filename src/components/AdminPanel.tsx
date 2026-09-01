import * as React from 'react';
import { 
  Users, 
  Shield, 
  Ban, 
  CheckCircle, 
  Search, 
  CreditCard, 
  Settings2, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  Unlock,
  Package,
  Plus,
  KeyRound,
  Mail,
  Zap,
  Globe,
  MessageSquare,
  History,
  Download,
  LayoutGrid,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  X,
  RefreshCw,
  Table as TableIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { db, handleFirestoreError, OperationType, createSecondaryUser } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { UserProfile, Plan } from '@/types';
import { executeDelete } from '@/lib/deleteHelper';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useUser, FALLBACK_PLANS } from '@/contexts/UserContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminPanel() {
  const { isSuperUser, isAdmin, user } = useUser();
  const hasAdminAccess = isSuperUser || isAdmin;
  const [activeSubTab, setActiveSubTab] = React.useState<'users' | 'plans'>('users');
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = React.useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setSaveSuccessNotice(msg);
    setTimeout(() => {
      setSaveSuccessNotice((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Seed default plans into Firestore if not present
  const seedDefaultPlansIfEmpty = React.useCallback(async (currentPlans: Plan[]) => {
    if (!hasAdminAccess) return;
    const requiredPlanIds = ['base', 'intermediate', 'pro'];
    const missingPlanIds = requiredPlanIds.filter(id => !currentPlans.some(p => p.id === id));
    
    if (missingPlanIds.length > 0) {
      for (const id of missingPlanIds) {
        const defaultPlan = FALLBACK_PLANS[id];
        if (defaultPlan) {
          try {
            await setDoc(doc(db, 'plans', id), defaultPlan, { merge: true });
          } catch (e) {
            console.warn(`Could not seed plan ${id}:`, e);
          }
        }
      }
    }
  }, [hasAdminAccess]);

  React.useEffect(() => {
    if (!hasAdminAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Load Users
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Initialize with fallback plans first
    const initialPlans = Object.values(FALLBACK_PLANS);
    setPlans(initialPlans);

    const plansQuery = query(collection(db, 'plans'));
    const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
      if (!snapshot.empty) {
        const plansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
        // Merge with fallback to ensure all required fields exist
        const mergedPlans = requiredPlanList(plansData);
        setPlans(mergedPlans);
      } else {
        seedDefaultPlansIfEmpty([]);
      }
    }, (error) => {
      console.warn('Plans collection snapshot fallback:', error);
      handleFirestoreError(error, OperationType.LIST, 'plans');
    });

    return () => {
      unsubscribeUsers();
      unsubscribePlans();
    };
  }, [hasAdminAccess, seedDefaultPlansIfEmpty]);

  // Helper to ensure base, intermediate, and pro always exist in the array
  function requiredPlanList(firestoreData: Plan[]): Plan[] {
    const list: Plan[] = [];
    for (const key of ['base', 'intermediate', 'pro']) {
      const existing = firestoreData.find(p => p.id === key);
      const fallback = FALLBACK_PLANS[key];
      if (existing) {
        list.push({
          ...fallback,
          ...existing,
          permissions: {
            ...fallback.permissions,
            ...(existing.permissions || {})
          }
        });
      } else if (fallback) {
        list.push(fallback);
      }
    }
    return list;
  }

  if (!hasAdminAccess) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold tracking-tight italic serif uppercase">Acesso Restrito</h2>
          <p className="text-neutral-500 font-medium">Apenas administradores podem realizar configurações globais.</p>
        </div>
      </div>
    );
  }

  const resetPlansToDefaults = async () => {
    if (!confirm('Deseja restaurar as permissões e valores padrão originais para todos os planos?')) return;
    try {
      for (const plan of Object.values(FALLBACK_PLANS)) {
        await setDoc(doc(db, 'plans', plan.id), plan);
      }
      showFeedback('Planos restaurados com os padrões originais com sucesso!');
    } catch (err: any) {
      alert('Erro ao restaurar planos: ' + err.message);
    }
  };

  const toggleUserStatus = async (targetUser: UserProfile) => {
    if (!hasAdminAccess) {
      alert("Apenas administradores podem alterar o status de usuários.");
      return;
    }
    const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
    try {
      await setDoc(doc(db, 'users', targetUser.uid), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showFeedback(`Status do usuário ${targetUser.displayName || targetUser.email} alterado para ${newStatus === 'active' ? 'Ativo' : 'Suspenso'}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  const toggleUserErp = async (targetUser: UserProfile) => {
    if (!hasAdminAccess) {
      alert("Apenas administradores podem alterar a disponibilidade do ERP Express.");
      return;
    }
    const currentStatus = targetUser.erpExpressEnabled !== undefined 
      ? targetUser.erpExpressEnabled 
      : (targetUser.planId !== 'base');
    const newStatus = !currentStatus;
    
    try {
      await setDoc(doc(db, 'users', targetUser.uid), {
        erpExpressEnabled: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showFeedback(`ERP Express ${newStatus ? 'Habilitado' : 'Desabilitado'} para ${targetUser.displayName || targetUser.email}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  const updatePlanInfo = async (planId: string, field: 'name' | 'price', value: any) => {
    if (!hasAdminAccess) {
      alert("Apenas administradores podem alterar as configurações do plano.");
      return;
    }
    try {
      const currentPlan = plans.find(p => p.id === planId) || FALLBACK_PLANS[planId];
      await setDoc(doc(db, 'plans', planId), {
        ...currentPlan,
        [field]: value
      }, { merge: true });
      showFeedback(`Plano ${planId.toUpperCase()}: ${field === 'name' ? 'Nome' : 'Preço'} atualizado com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
    }
  };

  const updatePlanPermission = async (planId: string, permissionKey: keyof Plan['permissions'], value: any) => {
    if (!hasAdminAccess) {
      alert("Apenas administradores podem alterar as permissões do plano.");
      return;
    }
    try {
      const currentPlan = plans.find(p => p.id === planId) || FALLBACK_PLANS[planId];
      const updatedPermissions = {
        ...(currentPlan.permissions || {}),
        [permissionKey]: value
      };
      await setDoc(doc(db, 'plans', planId), {
        ...currentPlan,
        permissions: updatedPermissions
      }, { merge: true });
      showFeedback(`Plano ${planId.toUpperCase()}: Permissão "${permissionKey}" atualizada em tempo real!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
    }
  };

  const deleteUser = async (userToDelete: UserProfile) => {
    if (!hasAdminAccess) {
      alert("Apenas administradores podem excluir usuários.");
      return;
    }
    
    try {
      await executeDelete('users', userToDelete.uid);
    } catch (error: any) {
      alert('Erro ao excluir usuário: ' + (error.message || 'Erro desconhecido'));
      console.error('Error deleting user:', error);
    }
  };

  const [migrating, setMigrating] = React.useState(false);
  const migrateHistoricalData = async () => {
    if (!hasAdminAccess) return;
    if (!confirm("Isso irá atribuir todos os documentos sem Workspace ao primeiro workspace do proprietário. Continuar?")) return;
    
    setMigrating(true);
    try {
      const collections = ['postits', 'promotions', 'orders', 'appointments', 'products', 'competitors', 'messages', 'spreadsheets'];
      let count = 0;

      // Get first available workspace
      const wsSnap = await getDocs(query(collection(db, 'workspaces'), limit(1)));
      if (wsSnap.empty) {
        alert("Nenhum workspace encontrado para migração.");
        return;
      }
      const targetWsId = wsSnap.docs[0].id;

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          const data = d.data();
          const updates: any = {};
          
          if (!data.workspaceId) {
            updates.workspaceId = targetWsId;
          }
          
          if (!data.ownerId && !data.userId) {
            updates.ownerId = user?.uid;
            updates.userId = user?.uid;
          }

          // Special case for spreadsheets: stringify nested arrays
          if (colName === 'spreadsheets' && Array.isArray(data.data)) {
            updates.data = JSON.stringify(data.data);
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(d.ref, updates);
            count++;
          }
        }
      }
      alert(`Migração concluída! ${count} documentos atualizados.`);
    } catch (error: any) {
      alert("Erro na migração: " + error.message);
    } finally {
      setMigrating(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Gerencie usuários, status de contas e configurações de permissões dos planos de assinatura.
        </p>
      </header>

      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        <Button 
          variant={activeSubTab === 'users' ? 'secondary' : 'ghost'} 
          className="rounded-lg h-9 px-4 font-semibold"
          onClick={() => setActiveSubTab('users')}
        >
          <Users className="w-4 h-4 mr-2" />
          Usuários
        </Button>
        <Button 
          variant={activeSubTab === 'plans' ? 'secondary' : 'ghost'} 
          className="rounded-lg h-9 px-4 font-semibold"
          onClick={() => setActiveSubTab('plans')}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Planos
        </Button>
      </div>

      <AnimatePresence>
        {saveSuccessNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm font-semibold shadow-sm"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeSubTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  placeholder="Buscar usuários por nome ou e-mail..." 
                  className="pl-10 h-11 border-none bg-neutral-50 focus-visible:ring-1 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  className="rounded-xl h-11 px-4 font-bold border-dashed border-neutral-300 hover:bg-neutral-50"
                  onClick={migrateHistoricalData}
                  disabled={migrating}
                >
                  {migrating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <History className="w-4 h-4 mr-2" />}
                  Migrar Histórico
                </Button>
                <Badge variant="outline" className="h-11 px-4 rounded-xl border-dashed whitespace-nowrap">
                  {filteredUsers.length} Usuários
                </Badge>
                <AddUserDialog />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredUsers.map((user) => (
                <Card key={user.uid} className={cn(
                  "border-none shadow-sm transition-all hover:shadow-md",
                  user.status === 'suspended' ? "bg-red-50/30" : "bg-white"
                )}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                      user.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600"
                    )}>
                      <UserIcon className="w-6 h-6" />
                    </div>
                    
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-neutral-900 truncate flex items-center gap-2">
                              {user.displayName || 'Sem Nome'}
                              {user.status === 'suspended' && (
                                <Badge variant="destructive" className="h-5 text-[9px] font-black uppercase">SUSPENSO</Badge>
                              )}
                            </h3>
                          </div>
                          <p className="text-sm text-neutral-500 font-medium truncate italic">{user.jobTitle || 'Sem cargo definido'}</p>
                          <p className="text-xs text-neutral-400 font-medium truncate">{user.email}</p>
                        </div>
                        
                        <div className="hidden md:grid grid-cols-3 gap-6 px-6 border-x border-neutral-100">
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Nível de Acesso</p>
                            <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className={cn(
                              "font-bold",
                              user.role === 'admin' ? "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none" : "text-neutral-500"
                            )}>
                              {user.role === 'admin' ? 'ADMINISTRADOR' : 'USUÁRIO'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Assinatura</p>
                            <p className="text-sm font-black text-neutral-900 capitalize tracking-tight">{user.planId || 'Base'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">ERP Express</p>
                            <button
                              onClick={() => toggleUserErp(user)}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black transition-all border",
                                (user.erpExpressEnabled !== undefined ? user.erpExpressEnabled : user.planId !== 'base')
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                  : "bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200"
                              )}
                              title="Clique para alternar a disponibilidade do ERP Express para este usuário"
                            >
                              <Layers className="w-3 h-3" />
                              <span>{(user.erpExpressEnabled !== undefined ? user.erpExpressEnabled : user.planId !== 'base') ? "ATIVO" : "INATIVO"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <EditUserDialog user={user} />
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="rounded-xl h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteUser(user)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'plans' && (
          <motion.div
            key="plans"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900 text-white shadow-lg">
              <div className="space-y-1">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Sincronização em Tempo Real de Planos e Permissões
                </h3>
                <p className="text-xs text-neutral-300">
                  Todas as alterações em limites, ferramentas ou valores entram em vigor imediatamente para todos os usuários conectados.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetPlansToDefaults}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-xl h-10 gap-2 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restaurar Padrões dos Planos
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.sort((a, b) => a.price - b.price).map((plan) => (
              <Card key={plan.id} className={cn(
                "border-2 transition-all duration-300 relative",
                plan.id === 'pro' 
                  ? "border-neutral-900 shadow-2xl ring-4 ring-neutral-900/5" 
                  : "border-neutral-100 shadow-sm hover:shadow-md"
              )}>
                {plan.id === 'pro' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-neutral-900 text-white border-none px-4 py-1 text-xs font-bold rounded-full uppercase tracking-tighter">
                      RECOMENDADO
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                  <div className="flex justify-between items-center mb-6">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      plan.id === 'pro' ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 border shadow-sm"
                    )}>
                      <Package className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold text-neutral-400 border-neutral-200">
                      ID: {plan.id.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Nome do Plano</label>
                      <Input 
                        className="font-bold text-lg h-12 border-neutral-200 bg-white focus-visible:ring-neutral-900"
                        value={plan.name}
                        onChange={(e) => updatePlanInfo(plan.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Preço Mensal (R$)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">R$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          className="pl-12 text-2xl h-14 font-black tracking-tighter border-neutral-200 bg-white focus-visible:ring-neutral-900"
                          value={typeof plan.price === 'number' && !isNaN(plan.price) ? plan.price : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updatePlanInfo(plan.id, 'price', isNaN(val) ? 0 : val);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-8">
                  {/* Grupo Destaque: Módulo ERP Express */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 border-2 border-emerald-400/40 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                          <Layers className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">Módulo ERP Express</h4>
                          <p className="text-[10px] text-neutral-500 font-medium">Estoque, Custos e Margens de Lucro</p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[10px] font-black border px-2 py-0.5",
                        (plan.permissions.externalRestockIntegration !== 'none' || !!plan.permissions.erpExpressEnabled)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-neutral-100 text-neutral-500 border-neutral-200"
                      )}>
                        {(plan.permissions.externalRestockIntegration !== 'none' || !!plan.permissions.erpExpressEnabled) ? "ATIVO" : "INATIVO"}
                      </Badge>
                    </div>

                    <PermissionToggle 
                      icon={<Layers className="w-4 h-4 text-emerald-600" />}
                      label="Disponibilizar ERP Express"
                      description="Habilita catálogo de produtos, controle de estoque (unidade/caixa) e alertas de reposição para assinantes deste plano."
                      enabled={plan.permissions.externalRestockIntegration !== 'none' || !!plan.permissions.erpExpressEnabled}
                      onChange={(val) => {
                        updatePlanPermission(plan.id, 'externalRestockIntegration', val ? (plan.id === 'pro' ? 'pro' : 'basic') : 'none');
                        updatePlanPermission(plan.id, 'erpExpressEnabled' as any, val);
                      }}
                    />
                  </div>

                  {/* Grupo: Workspace */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <LayoutGrid className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Workspace</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <PermissionInput
                        icon={<Layers className="w-4 h-4" />}
                        label="Max Workspaces"
                        value={plan.permissions.maxWorkspaces ?? 0}
                        onChange={(val) => updatePlanPermission(plan.id, 'maxWorkspaces', val)}
                      />
                      <PermissionInput
                        icon={<Users className="w-4 h-4" />}
                        label="Max Membros"
                        value={plan.permissions.maxMembers ?? 0}
                        onChange={(val) => updatePlanPermission(plan.id, 'maxMembers', val)}
                      />
                    </div>
                  </div>

                  {/* Grupo: Planilhas */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <TableIcon className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Planilhas</h4>
                    </div>
                    <div className="space-y-3">
                      <PermissionToggle 
                        icon={<TableIcon className="w-4 h-4" />}
                        label="Habilitar Planilhas"
                        description="Ativa o módulo de planilhas."
                        enabled={plan.permissions.spreadsheetEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetEnabled', val)}
                      />
                      <PermissionInput
                        icon={<TableIcon className="w-4 h-4" />}
                        label="Max de Planilhas"
                        value={plan.permissions.spreadsheetMaxSheets ?? 0}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetMaxSheets', val)}
                      />
                      <PermissionInput
                        icon={<TableIcon className="w-4 h-4" />}
                        label="Max de Linhas"
                        value={plan.permissions.spreadsheetMaxRows ?? 0}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetMaxRows', val)}
                      />
                      <PermissionInput
                        icon={<TableIcon className="w-4 h-4" />}
                        label="Max de Colunas"
                        value={plan.permissions.spreadsheetMaxColumns ?? 0}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetMaxColumns', val)}
                      />
                      <PermissionToggle 
                        icon={<Download className="w-4 h-4" />}
                        label="Exportação de Planilhas"
                        description="Permite baixar em XLSX/CSV."
                        enabled={plan.permissions.spreadsheetExportEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetExportEnabled', val)}
                      />
                      <PermissionToggle 
                        icon={<Globe className="w-4 h-4" />}
                        label="Colaboração Realtime"
                        description="Edição simultânea."
                        enabled={plan.permissions.spreadsheetRealtimeCollaboration}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetRealtimeCollaboration', val)}
                      />
                      <PermissionToggle 
                        icon={<Settings2 className="w-4 h-4" />}
                        label="Estilos Avançados"
                        description="Cores e bordas personalizadas."
                        enabled={plan.permissions.spreadsheetAdvancedStyles}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetAdvancedStyles', val)}
                      />
                      <PermissionToggle 
                        icon={<Plus className="w-4 h-4" />}
                        label="Upload de Imagens"
                        description="Inserir imagens nas células."
                        enabled={plan.permissions.spreadsheetImageUploadEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'spreadsheetImageUploadEnabled', val)}
                      />
                    </div>
                  </div>

                  {/* Grupo: Inteligência Artificial */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Zap className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Inteligência Artificial</h4>
                    </div>
                    <PermissionToggle 
                      icon={<MessageSquare className="w-4 h-4" />}
                      label="Assistente AI"
                      description="Chatbot inteligente no painel."
                      enabled={plan.permissions.aiAssistantEnabled}
                      onChange={(val) => updatePlanPermission(plan.id, 'aiAssistantEnabled', val)}
                    />
                  </div>

                  {/* Grupo: Exportação */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Download className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Exportação</h4>
                    </div>
                    <PermissionToggle 
                      icon={<Download className="w-4 h-4" />}
                      label="Exportar Dados"
                      description="Permite relatórios em Excel/CSV."
                      enabled={plan.permissions.canExportData}
                      onChange={(val) => updatePlanPermission(plan.id, 'canExportData', val)}
                    />
                  </div>

                  {/* Grupo: Chat */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <MessageSquare className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Configuração de Chat</h4>
                    </div>
                    <div className="space-y-3">
                      <PermissionToggle 
                        icon={<Package className="w-4 h-4" />}
                        label="Upload de Imagens"
                        description="Anexos em tempo real."
                        enabled={plan.permissions.chatUploadEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'chatUploadEnabled', val)}
                      />
                      <PermissionToggle 
                        icon={<Globe className="w-4 h-4" />}
                        label="Links Ativos"
                        description="Visualização de URLs."
                        enabled={plan.permissions.chatLinksEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'chatLinksEnabled', val)}
                      />
                      <PermissionToggle 
                        icon={<History className="w-4 h-4" />}
                        label="Apagar Mensagens"
                        description="Moderação do workspace."
                        enabled={plan.permissions.canDeleteMessages}
                        onChange={(val) => updatePlanPermission(plan.id, 'canDeleteMessages', val)}
                      />
                    </div>
                  </div>

                  {/* Grupo: Histórico */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <History className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Histórico</h4>
                    </div>
                    <PermissionInput
                      icon={<History className="w-4 h-4" />}
                      label="Histórico de Concorrentes (Meses)"
                      value={plan.permissions.competitorHistoryMonths ?? 0}
                      onChange={(val) => updatePlanPermission(plan.id, 'competitorHistoryMonths', val)}
                    />
                  </div>

                  {/* Grupo: Integrações */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Globe className="w-3 h-3 text-neutral-400" />
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Integrações</h4>
                    </div>
                    <div className="space-y-3">
                      <PermissionToggle 
                        icon={<Calendar className="w-4 h-4" />}
                        label="Google Agenda"
                        description="Sincronização bidirecional."
                        enabled={plan.permissions.googleCalendarEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'googleCalendarEnabled', val)}
                      />
                      <PermissionToggle 
                        icon={<ArrowRight className="w-4 h-4" />}
                        label="Agendamento Avançado"
                        description="Otimização de turnos."
                        enabled={plan.permissions.advancedScheduling}
                        onChange={(val) => updatePlanPermission(plan.id, 'advancedScheduling', val)}
                      />
                      <PermissionToggle 
                        icon={<LayoutGrid className="w-4 h-4" />}
                        label="Quadro Branco"
                        description="Ferramenta visual de Post-Its."
                        enabled={plan.permissions.whiteboardEnabled}
                        onChange={(val) => updatePlanPermission(plan.id, 'whiteboardEnabled', val)}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t mt-auto">
                    <div className="flex items-center justify-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-[9px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Sincronizado com Firebase
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PermissionToggle({ label, description, enabled, onChange, icon }: { 
  label: string; 
  description: string; 
  enabled: boolean; 
  onChange: (val: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer group",
        enabled ? "bg-neutral-50 border-neutral-200" : "bg-white border-neutral-100 opacity-60 hover:opacity-100"
      )}
      onClick={() => onChange(!enabled)}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn(
            "p-2 rounded-xl transition-colors",
            enabled ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200"
          )}>
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-neutral-900">{label}</p>
          <p className="text-[10px] text-neutral-500 font-medium leading-none">{description}</p>
        </div>
      </div>
      <div 
        className={cn(
          "w-10 h-5 px-0.5 rounded-full relative transition-colors duration-200 flex items-center",
          enabled ? "bg-neutral-900" : "bg-neutral-200"
        )}
      >
        <motion.div 
          className="w-4 h-4 bg-white rounded-full shadow-lg"
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  );
}

function PermissionInput({ label, value = 0, onChange, icon }: { 
  label: string; 
  value?: number; 
  onChange: (val: number) => void;
  icon?: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const getSafeString = (v?: number) => {
    if (typeof v === 'number' && !isNaN(v)) return v.toString();
    return '0';
  };
  const [localValue, setLocalValue] = React.useState(getSafeString(value));

  React.useEffect(() => {
    setLocalValue(getSafeString(value));
  }, [value]);

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-100 bg-white hover:border-neutral-200 transition-all group">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-xl bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200 group-hover:text-neutral-600 transition-colors">
            {icon}
          </div>
        )}
        <p className="text-sm font-bold text-neutral-900">{label}</p>
      </div>
      <div className="relative">
        <Input 
          type="number"
          className="w-20 h-10 rounded-xl text-center font-black text-base border-neutral-200 bg-neutral-50 focus-visible:ring-neutral-900 transition-all hover:bg-white"
          value={localValue}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            const parsed = parseInt(localValue, 10);
            onChange(isNaN(parsed) ? 0 : parsed);
          }}
          onChange={(e) => setLocalValue(e.target.value)}
        />
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-1 -right-1"
          >
            <div className="w-2 h-2 bg-neutral-900 rounded-full animate-pulse" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return <Users className={className} />;
}

function AddUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'user' | 'admin'>('user');
  const [planId, setPlanId] = React.useState<'base' | 'intermediate' | 'pro'>('base');
  const [erpExpressEnabled, setErpExpressEnabled] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleAdd = async () => {
    if (!email || !name || !password) {
      alert('Por favor, preencha todos os campos obrigatórios (E-mail, Nome e Senha).');
      return;
    }
    if (password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // Direct Firebase secondary client-side creation (works seamlessly on Vercel and all hosts)
      await createSecondaryUser({
        email: email.trim().toLowerCase(),
        password,
        displayName: name.trim(),
        role,
        planId,
        erpExpressEnabled,
      });

      alert('Usuário cadastrado com sucesso!');
      setOpen(false);
      setEmail('');
      setName('');
      setPassword('');
      setRole('user');
      setPlanId('base');
      setErpExpressEnabled(false);
    } catch (e: any) {
      console.error('Error creating user:', e);
      let msg = e.message || 'Erro desconhecido';
      if (e.code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
        msg = 'Este e-mail já está cadastrado no sistema.';
      } else if (e.code === 'auth/invalid-email' || msg.includes('invalid-email')) {
        msg = 'Formato de e-mail inválido.';
      } else if (e.code === 'auth/weak-password' || msg.includes('weak-password')) {
        msg = 'A senha informada é muito fraca (mínimo 6 caracteres).';
      }
      alert('Erro ao salvar usuário: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="rounded-xl h-11 px-6 font-black text-white bg-neutral-900 border-none hover:bg-neutral-800 shadow-xl shadow-neutral-900/10">
        <Plus className="w-4 h-4 mr-2" />
        NOVO USUÁRIO
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden">
            <CardHeader className="bg-primary p-6">
              <div className="flex justify-between items-start">
                <div className="text-primary-foreground">
                  <CardTitle className="text-xl font-bold tracking-tight">Recrutar Membro</CardTitle>
                  <CardDescription className="text-primary-foreground/70 text-xs mt-1">
                    Criação de credenciais corporativas.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-primary-foreground hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Nome Completo</label>
                <Input 
                  placeholder="Nome de exibição" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="h-12 border-neutral-200 bg-neutral-50 px-4 font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Identidade Digital (E-mail)</label>
                <Input 
                  placeholder="exemplo@corporativo.com" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="h-12 border-neutral-200 bg-neutral-50 px-4 font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-4 w-4 text-neutral-400" />
                  <Input 
                    placeholder="Mínimo 6 caracteres" 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="h-12 pl-11 pr-11 border-neutral-200 bg-neutral-50 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Atribuição</label>
                  <select 
                    className="w-full h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-black focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                  >
                    <option value="user">USER</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Plano Base</label>
                  <select 
                    className="w-full h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-black focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                    value={planId}
                    onChange={e => {
                      const newPlan = e.target.value as any;
                      setPlanId(newPlan);
                      if (newPlan !== 'base') setErpExpressEnabled(true);
                    }}
                  >
                    <option value="base">BASE</option>
                    <option value="intermediate">MEDIUM</option>
                    <option value="pro">PRO</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-neutral-900 leading-tight">Habilitar ERP Express</p>
                    <p className="text-[10px] text-neutral-500 font-medium leading-tight">Módulo de produtos e estoque.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={erpExpressEnabled ? "default" : "outline"}
                  className={cn(
                    "h-7 px-2.5 text-[11px] font-bold rounded-lg",
                    erpExpressEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-neutral-300 text-neutral-600"
                  )}
                  onClick={() => setErpExpressEnabled(!erpExpressEnabled)}
                >
                  {erpExpressEnabled ? "Sim (Ativo)" : "Não (Inativo)"}
                </Button>
              </div>

              <div className="pt-6 border-t border-neutral-100 flex gap-3">
                <Button variant="ghost" className="flex-1 rounded-xl h-14 font-bold" onClick={() => setOpen(false)}>
                  CANCELAR
                </Button>
                <Button 
                  className="flex-1 rounded-xl h-14 font-black bg-neutral-900 text-white hover:bg-neutral-800 shadow-xl shadow-neutral-900/20" 
                  onClick={handleAdd} 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRMAR CADASTRO'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function EditUserDialog({ user }: { user: UserProfile }) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'profile' | 'permissions' | 'security'>('profile');
  
  // Profile State
  const [name, setName] = React.useState(user.displayName || '');
  const [jobTitle, setJobTitle] = React.useState(user.jobTitle || '');
  const [phone, setPhone] = React.useState(user.phoneNumber || '');
  
  // Permissions State
  const [role, setRole] = React.useState(user.role || 'user');
  const [planId, setPlanId] = React.useState(user.planId || 'base');
  const [status, setStatus] = React.useState(user.status || 'active');
  const [erpExpressEnabled, setErpExpressEnabled] = React.useState<boolean>(
    user.erpExpressEnabled !== undefined ? user.erpExpressEnabled : (user.planId !== 'base')
  );
  
  // Security State
  const [newPassword, setNewPassword] = React.useState('');
  
  const [loading, setLoading] = React.useState(false);
  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name || 'Sem Nome',
        jobTitle: jobTitle || '',
        phoneNumber: phone || '',
        role,
        planId: planId || 'base',
        erpExpressEnabled,
        status,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao atualizar usuário: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setPasswordLoading(true);
    try {
      let updatedViaApi = false;
      try {
        const adminToken = await auth.currentUser?.getIdToken();
        if (adminToken) {
          const response = await fetch('/api/admin/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, newPassword, adminToken }),
          });
          const ct = response.headers.get('content-type');
          if (response.ok && ct && ct.includes('application/json')) {
            const data = await response.json();
            if (data.success) {
              updatedViaApi = true;
            }
          }
        }
      } catch (_) {}

      if (updatedViaApi) {
        alert('Senha atualizada com sucesso!');
      } else {
        // Fallback: send password reset email via Firebase Auth
        if (user.email) {
          await sendPasswordResetEmail(auth, user.email);
          alert(`Link de redefinição de senha enviado com sucesso para ${user.email}! O usuário poderá cadastrar a nova senha pelo link.`);
        } else {
          alert('Não foi possível atualizar a senha.');
        }
      }
      setNewPassword('');
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('EXTREMA ATENÇÃO:\n\nIsso removerá o usuário:\n' + user.email + '\n\nO perfil do usuário será removido. Prosseguir?')) {
      return;
    }

    setDeleteLoading(true);
    try {
      try {
        const adminToken = await auth.currentUser?.getIdToken();
        if (adminToken) {
          await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, adminToken }),
          });
        }
      } catch (_) {}

      // Delete from Firestore directly
      await deleteDoc(doc(db, 'users', user.uid));

      alert('Usuário removido da base de dados com sucesso.');
      setOpen(false);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-10 w-10 p-0 rounded-xl hover:bg-neutral-100">
        <Settings2 className="w-4 h-4 text-neutral-500" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl border-none overflow-hidden flex flex-col max-h-[90vh]">
            <CardHeader className="bg-primary p-6">
              <div className="flex justify-between items-start">
                <div className="text-primary-foreground">
                  <CardTitle className="text-xl font-bold tracking-tight">Ficha do Usuário</CardTitle>
                  <CardDescription className="text-primary-foreground/70 text-xs mt-1">
                    Gestão centralizada: {user.email}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-primary-foreground hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>

            <div className="flex bg-muted p-1 mx-6 mt-4 rounded-lg border">
              {(['profile', 'permissions', 'security'] as const).map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all",
                    activeTab === tab ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'profile' && 'Perfil'}
                  {tab === 'permissions' && 'Acessos'}
                  {tab === 'security' && 'Segurança'}
                </button>
              ))}
            </div>

            <CardContent className="p-8 overflow-y-auto flex-1">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="tab-profile"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Nome Completo</label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="h-11 border-neutral-200 bg-neutral-50" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Cargo / Função</label>
                        <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Ex: Diretor Comercial" className="h-11 border-neutral-200 bg-neutral-50" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Telefone / WhatsApp</label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-11 border-neutral-200 bg-neutral-50" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'permissions' && (
                  <motion.div
                    key="tab-permissions"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Cargo no Sistema</label>
                        <select 
                          className="w-full h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-bold"
                          value={role}
                          onChange={e => setRole(e.target.value as any)}
                        >
                          <option value="user">Usuário Padrão</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Plano de Assinatura</label>
                        <select 
                          className="w-full h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-bold"
                          value={planId}
                          onChange={e => setPlanId(e.target.value as any)}
                        >
                          <option value="base">Plano Base</option>
                          <option value="intermediate">Plano Medium</option>
                          <option value="pro">Plano Pro</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Status da Conta</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={status === 'active' ? 'default' : 'outline'}
                          className="flex-1 rounded-xl h-11 font-bold"
                          onClick={() => setStatus('active')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Ativo
                        </Button>
                        <Button
                          type="button"
                          variant={status === 'suspended' ? 'destructive' : 'outline'}
                          className="flex-1 rounded-xl h-11 font-bold"
                          onClick={() => setStatus('suspended')}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Suspenso
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-neutral-900">Disponibilidade do ERP Express</p>
                            <p className="text-[10px] text-neutral-500 font-medium">Controle administrativo individual de acesso ao estoque e produtos.</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={erpExpressEnabled ? "default" : "outline"}
                          className={cn(
                            "h-8 px-3 text-xs font-bold rounded-lg transition-all",
                            erpExpressEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" : "border-neutral-300 text-neutral-600"
                          )}
                          onClick={() => setErpExpressEnabled(!erpExpressEnabled)}
                        >
                          {erpExpressEnabled ? "Habilitado" : "Desabilitado"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div
                    key="tab-security"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Atenção Admin</p>
                        <p className="text-[10px] text-amber-700 leading-tight">Ao redefinir a senha, o usuário perderá o acesso antigo imediatamente. Certifique-se de avisá-lo.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Nova Senha</label>
                      <div className="flex gap-2">
                        <Input 
                          type="password" 
                          placeholder="Mínimo 6 caracteres" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)}
                          className="h-11 border-neutral-200 bg-neutral-50"
                        />
                        <Button 
                          onClick={handleUpdatePassword}
                          disabled={passwordLoading}
                          className="h-11 px-6 rounded-xl font-bold bg-neutral-900 text-white"
                        >
                          {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redefinir'}
                        </Button>
                      </div>
                    </div>

                    <div className="pt-10 border-t border-neutral-100 mt-10">
                      <div className="p-6 rounded-2xl bg-red-50 border border-red-100 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-900">Zona de Perigo</p>
                          <p className="text-xs text-red-700 leading-tight">A exclusão da conta é irreversível e remove o acesso do usuário imediatamente.</p>
                        </div>
                        <Button 
                          variant="destructive" 
                          className="w-full md:w-auto h-12 px-8 rounded-xl font-black uppercase text-xs"
                          onClick={handleDeleteAccount}
                          disabled={deleteLoading}
                        >
                          {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir Conta'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <div className="p-8 bg-neutral-50 border-t flex gap-4">
              <Button variant="ghost" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setOpen(false)}>
                Descartar
              </Button>
              <Button 
                className="flex-1 rounded-xl h-12 font-bold bg-neutral-900 text-white hover:bg-neutral-800" 
                onClick={handleUpdate} 
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
