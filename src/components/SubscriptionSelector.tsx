import * as React from 'react';
import { 
  Check, 
  Zap, 
  Crown, 
  Rocket, 
  ArrowRight, 
  ShieldCheck, 
  Bot, 
  Download, 
  Headphones,
  Package,
  Layers,
  Sparkles,
  Table as TableIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  query 
} from 'firebase/firestore';
import { Plan, UserProfile } from '@/types';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';
import { motion } from 'motion/react';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

interface SubscriptionSelectorProps {
  currentProfile: UserProfile | null;
}

export default function SubscriptionSelector({ currentProfile }: SubscriptionSelectorProps) {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Primary source: backend catalog API
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)));
          setLoading(false);
        }
      })
      .catch(err => console.warn('Backend plans fetch fallback to Firestore:', err));

    const q = query(collection(db, 'plans'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const plansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
        setPlans(plansData.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)));
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'plans'));

    return () => unsubscribe();
  }, []);

  const handleUpgrade = (plan: Plan) => {
    const message = `solicito a mudanca da minha assinatura (para a assinatura ${plan.name})`;
    const whatsappUrl = `https://wa.me/5541996679075?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const getIcon = (planId: string) => {
    switch (planId) {
      case 'base': return Package;
      case 'intermediate': return Rocket;
      case 'pro': return Crown;
      default: return Zap;
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <Badge className="px-4 py-1.5 bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[10px]">Planos de Assinatura</Badge>
        <h1 className="text-5xl font-black tracking-tighter text-neutral-900 italic serif uppercase">Escolha o seu nível</h1>
        <p className="text-neutral-500 max-w-2xl mx-auto font-medium">
          Seja você um pequeno lojista ou uma grande distribuidora, temos o plano perfeito para gerenciar seus produtos, estoque e escalar seu negócio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan, idx) => {
          const Icon = getIcon(plan.id);
          const isCurrent = currentProfile?.planId === plan.id;
          const isPro = plan.id === 'pro';
          const hasErpInPlan = plan.permissions.externalRestockIntegration !== 'none' || !!plan.permissions.erpExpressEnabled;
          
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex"
            >
              <Card className={cn(
                "relative flex flex-col w-full border-none shadow-2xl transition-all duration-500 h-full",
                isPro ? "scale-105 z-10 ring-4 ring-primary/20" : "scale-100",
                isCurrent ? "bg-neutral-50" : "bg-white"
              )}>
                {isPro && (
                  <div className="absolute -top-4 inset-x-0 flex justify-center">
                    <Badge className="bg-primary text-white border-none px-6 py-1 h-8 font-black uppercase tracking-tighter shadow-lg shadow-primary/20">
                      MAIS POPULAR
                    </Badge>
                  </div>
                )}

                <CardHeader className="p-8 pb-4">
                  <div className="flex justify-between items-start">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg",
                      isPro ? "bg-neutral-900 text-white" : "bg-primary/10 text-primary"
                    )}>
                      <Icon className="w-8 h-8" />
                    </div>
                    {isCurrent && (
                      <Badge className="bg-green-500 text-white border-none px-3 py-1 font-black uppercase tracking-tighter shadow-lg shadow-green-500/20 animate-pulse">
                        SEU PLANO
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl font-black italic serif uppercase text-neutral-900">{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tighter text-neutral-900 italic serif">
                      R$ {plan.price.toFixed(2).split('.')[0]}
                    </span>
                    <span className="text-xl font-bold tracking-tighter text-neutral-900 italic serif">
                      ,{plan.price.toFixed(2).split('.')[1]}
                    </span>
                    <span className="text-sm font-bold text-neutral-400 ml-1">/mês</span>
                  </div>
                </CardHeader>

                <CardContent className="p-8 pt-6 space-y-6 flex-1">
                  <div className="space-y-4">
                    <FeatureItem 
                      icon={Package} 
                      label={`${plan.permissions.maxWorkspaces === -1 ? 'Espaços ilimitados' : `${plan.permissions.maxWorkspaces} Espaços de Trabalho`}`} 
                      active={true} 
                    />
                    <FeatureItem 
                      icon={Layers} 
                      label="ERP Express (Produtos, Estoque e Lucros)" 
                      active={hasErpInPlan} 
                    />
                    <FeatureItem 
                      icon={Bot} 
                      label="Assistente AI Personalizado" 
                      active={plan.permissions.aiAssistantEnabled} 
                    />
                    <FeatureItem 
                      icon={Download} 
                      label="Exportação de Dados" 
                      active={plan.permissions.canExportData} 
                    />
                    <FeatureItem 
                      icon={ShieldCheck} 
                      label="Agendamento Avançado" 
                      active={plan.permissions.advancedScheduling} 
                    />
                    <FeatureItem 
                      icon={TableIcon} 
                      label={`${plan.permissions.spreadsheetMaxSheets} Planilhas (${plan.permissions.spreadsheetMaxRows}x${plan.permissions.spreadsheetMaxColumns})`} 
                      active={plan.permissions.spreadsheetEnabled} 
                    />
                    <FeatureItem 
                      icon={Zap} 
                      label="Colaboração em Tempo Real" 
                      active={plan.permissions.spreadsheetRealtimeCollaboration} 
                    />
                  </div>
                </CardContent>

                <CardFooter className="p-8 pt-0">
                  <Button 
                    className={cn(
                      "w-full h-14 text-base font-black tracking-tight rounded-2xl transition-all shadow-xl",
                      isCurrent && "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 shadow-none",
                      !isCurrent && isPro && "bg-neutral-900 hover:bg-neutral-800 text-white shadow-neutral-900/20",
                      !isCurrent && !isPro && "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    )}
                    onClick={() => handleUpgrade(plan)}
                  >
                    {isCurrent ? (
                      <>
                        <ShieldCheck className="w-5 h-5 mr-2" />
                        PLANO ATUAL
                      </>
                    ) : (
                      <>
                        Mudar Plano
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-neutral-900 rounded-[2.5rem] p-12 text-white overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-1000">
          <Zap className="w-64 h-64" />
        </div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-white/10 text-white border-none px-4 py-1 font-bold">SEGURANÇA TOTAL</Badge>
            <h2 className="text-4xl font-black italic serif uppercase leading-tight">Dúvidas sobre os planos?</h2>
            <p className="text-neutral-400 font-medium text-lg leading-relaxed">
              Cada plano foi desenhado para atender diferentes estágios de maturidade digital. Se você precisa de uma solução sob medida para sua rede de lojas, fale com nosso suporte.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={getWhatsAppSupportUrl("Olá! Gostaria de falar com um consultor para tirar dúvidas sobre os planos do Express Tools.")}
                target="_blank"
                rel="noopener noreferrer"
                className="h-14 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
              >
                <Headphones className="w-4 h-4" />
                <span>Falar com Suporte ({SUPPORT_PHONE_FORMATTED})</span>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10 p-6 text-center space-y-2">
              <p className="text-3xl font-black italic serif text-primary">+10k</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Lojas Ativas</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-6 text-center space-y-2">
              <p className="text-3xl font-black italic serif text-primary">99.9%</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Uptime Garantido</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-6 text-center space-y-2">
              <p className="text-3xl font-black italic serif text-primary">24h</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Suporte Pro</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-6 text-center space-y-2">
              <p className="text-3xl font-black italic serif text-primary">Zero</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Taxa de Setup</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, label, active }: { icon: any, label: string, active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 transition-opacity",
      active ? "opacity-100" : "opacity-30"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        active ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-400"
      )}>
        {active ? <Check className="w-5 h-5" /> : <Package className="w-4 h-4" />}
      </div>
      <span className={cn(
        "text-sm font-bold",
        active ? "text-neutral-700" : "text-neutral-400 line-through"
      )}>
        {label}
      </span>
    </div>
  );
}
