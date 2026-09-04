import * as React from 'react';
import { 
  Check, 
  X,
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
  Table as TableIcon,
  Truck,
  Users,
  CalendarClock,
  CalendarDays,
  Tag,
  TrendingUp,
  MessageSquare,
  Clock,
  Coins,
  FileSpreadsheet,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  Star,
  HeartHandshake,
  Store,
  Briefcase,
  PenTool,
  StickyNote,
  Building2,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Smartphone,
  Flame,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { Plan, UserProfile } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

interface SubscriptionSelectorProps {
  currentProfile: UserProfile | null;
  onNavigateToTab?: (tab: string) => void;
}

export default function SubscriptionSelector({ currentProfile, onNavigateToTab }: SubscriptionSelectorProps) {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annual'>('monthly');
  const [activeSection, setActiveSection] = React.useState<'plans' | 'features' | 'why' | 'compare' | 'roi' | 'faq' | 'all'>('plans');

  // ROI Calculator states
  const [monthlyOrders, setMonthlyOrders] = React.useState<number>(120);
  const [teamMembersCount, setTeamMembersCount] = React.useState<number>(3);
  const [manualMinutesPerOrder, setManualMinutesPerOrder] = React.useState<number>(20);

  // FAQ Accordion states
  const [expandedFaq, setExpandedFaq] = React.useState<number | null>(0);

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
    const cycleText = billingCycle === 'annual' ? 'Anual (com 20% OFF)' : 'Mensal';
    const message = `Olá! Solicito a mudança da minha assinatura no Express Tools para o plano ${plan.name} (${cycleText}). Poderiam me orientar com a ativação?`;
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

  // ROI calculations
  const totalMinutesSavedMonthly = monthlyOrders * (manualMinutesPerOrder * 0.7); // 70% reduction in admin time
  const totalHoursSavedMonthly = Math.round(totalMinutesSavedMonthly / 60);
  const estimatedSavingsBRL = totalHoursSavedMonthly * 32; // Assuming ~R$ 32/hour average staff cost

  // Modules / Features List
  const platformFeatures = [
    {
      id: 'restock',
      title: 'ERP Express & Estoque',
      category: 'Gestão Financeira & Produtos',
      icon: Package,
      badge: 'Essencial',
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      description: 'Cadastro detalhado de mercadorias com preço de custo, markup sugerido, margem de lucro líquida, estoque mínimo e alerta de reposição antes da ruptura.',
      benefits: ['Adeus à falta de mercadoria', 'Cálculo de lucro automático', 'Giro de estoque otimizado']
    },
    {
      id: 'shipping',
      title: 'Cotação de Entregas & Frete',
      category: 'Logística & Atendimento',
      icon: Truck,
      badge: 'Novo Módulo',
      color: 'text-blue-500 bg-blue-50 border-blue-200',
      description: 'Simulador multimodais integrado: compare Motoboy Express, SEDEX, PAC e Transportadoras em segundos. Busca automática por CEP e envio de proposta via WhatsApp.',
      benefits: ['Proposta de frete em 30s', 'Autocompletar de endereço por CEP', 'Disparo direto para o WhatsApp']
    },
    {
      id: 'clients',
      title: 'Carteira de Clientes (CRM)',
      category: 'Vendas & Relacionamento',
      icon: Users,
      badge: 'CRM Completo',
      color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
      description: 'Registro centralizado de clientes B2B e B2C, dados de contato, histórico completo de compras, ticket médio acumulado e disparo de mensagens em 1 clique.',
      benefits: ['Histórico do cliente na mão', 'Agendamento de visitas', 'Acompanhamento do ticket médio']
    },
    {
      id: 'orders',
      title: 'Agenda de Pedidos & Kanban',
      category: 'Operação & Entregas',
      icon: CalendarClock,
      badge: 'Produtividade',
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      description: 'Painel visual de controle de pedidos com prazos de entrega, status de produção, valores com frete incluso e sinalizadores de atraso.',
      benefits: ['Visão cronológica de prazos', 'Integração de frete + produtos', 'Organização por status visual']
    },
    {
      id: 'postits',
      title: 'Post-its & Mural de Recados',
      category: 'Colaboração Ágil',
      icon: StickyNote,
      badge: 'Em Tempo Real',
      color: 'text-yellow-500 bg-yellow-50 border-yellow-200',
      description: 'Mural estilo Kanban para anotações rápidas da equipe, notas automáticas de pedidos e clientes, lembretes de tarefas e notas visuais coloridas.',
      benefits: ['Lembretes visuais instantâneos', 'Zero recados perdidos', 'Sincronização em tempo real']
    },
    {
      id: 'whiteboard',
      title: 'Quadro Branco Digital',
      category: 'Criatividade & Brainstorming',
      icon: PenTool,
      badge: 'Lousa Livre',
      color: 'text-purple-500 bg-purple-50 border-purple-200',
      description: 'Lousa digital infinita para reuniões estratégicas, desenhos de fluxo de atendimento, alinhamento de metas e planejamento visual de lojas.',
      benefits: ['Desenho livre e setas', 'Brainstorming com a equipe', 'Exportação de ideias']
    },
    {
      id: 'spreadsheets',
      title: 'Planilhas em Branco Inteligentes',
      category: 'Dados & Análise',
      icon: TableIcon,
      badge: 'Planilhas Pro',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      description: 'Substitua planilhas do Excel que travam por grades na nuvem com fórmulas, formatação de células, abas ilimitadas e edição simultânea.',
      benefits: ['Sem perdas de arquivo', 'Colaboração multiusuário', 'Exportação para CSV/Excel']
    },
    {
      id: 'ai_assistant',
      title: 'Assistente AI Estratégico',
      category: 'Inteligência Artificial',
      icon: Bot,
      badge: 'Powered by Gemini',
      color: 'text-violet-500 bg-violet-50 border-violet-200',
      description: 'Consultor de negócios inteligente que analisa seu catálogo, gera estratégias de preço, sugere ações de marketing e responde dúvidas comerciais.',
      benefits: ['Análise de giro e tendências', 'Geração de copy e promoções', 'Insights em segundos']
    },
    {
      id: 'competitors',
      title: 'Monitor de Concorrentes',
      category: 'Inteligência de Mercado',
      icon: TrendingUp,
      badge: 'Estratégico',
      color: 'text-rose-500 bg-rose-50 border-rose-200',
      description: 'Acompanhe os preços e movimentações dos seus concorrentes diretos para manter suas margens competitivas sem queimar dinheiro.',
      benefits: ['Histórico de preços', 'Detecção de oportunidades', 'Precificação mais assertiva']
    },
    {
      id: 'promotions',
      title: 'Promoções & Campanhas',
      category: 'Marketing de Vendas',
      icon: Tag,
      badge: 'Conversão',
      color: 'text-orange-500 bg-orange-50 border-orange-200',
      description: 'Criação e agendamento de campanhas promocionais sazonais com cálculo do impacto de desconto na margem e data limite de validade.',
      benefits: ['Controle de datas e metas', 'Prevenção de margem negativa', 'Aumento de vendas pontual']
    },
    {
      id: 'appointments',
      title: 'Visitas & Agendamentos',
      category: 'Equipe de Campo & Vendas',
      icon: CalendarDays,
      badge: 'Comercial',
      color: 'text-teal-500 bg-teal-50 border-teal-200',
      description: 'Gestão de visitas comerciais presenciais ou reuniões remotas, com anotações de follow-up, resultado comercial e conversão direta em pedido.',
      benefits: ['Controle de roteiro de visitas', 'Anotações de reunião', 'Conversão em vendas']
    },
    {
      id: 'sharing',
      title: 'Multi-Workspaces & Equipes',
      category: 'Gestão de Acessos',
      icon: Building2,
      badge: 'Escalabilidade',
      color: 'text-neutral-700 bg-neutral-100 border-neutral-300',
      description: 'Ambientes de trabalho isolados para cada filial, marca ou departamento, com convites por código e permissões seguras por usuário.',
      benefits: ['Lojas ou filiais separadas', 'Acesso por nível de cargo', 'Trabalho simultâneo seguro']
    }
  ];

  // FAQ Items
  const faqItems = [
    {
      q: 'Como funciona a ativação e alteração do plano?',
      a: 'A ativação ou upgrade de plano é feita de forma instantânea através do nosso time de suporte especializado via WhatsApp. Você clica no botão "Mudar Plano" e enviamos as instruções de ativação com chave Pix ou cartão.'
    },
    {
      q: 'Posso cancelar ou mudar de plano quando quiser?',
      a: 'Sim, com total liberdade! Não trabalhamos com contratos de fidelidade compulsória ou multas por cancelamento. Você pode alterar entre os planos Base, Intermediário e Pro sempre que a necessidade da sua empresa mudar.'
    },
    {
      q: 'Preciso instalar algum software ou aplicativo pesado no computador?',
      a: 'Não! O Express Tools é 100% hospedado em nuvem de alta velocidade. Você e sua equipe acessam de qualquer navegador no computador, notebook, tablet ou celular, com sincronização em tempo real.'
    },
    {
      q: 'Como funciona a Cotação de Entregas & Frete?',
      a: 'Você digita o CEP de destino ou seleciona um cliente da sua carteira. O sistema calcula automaticamente os valores e prazos para Motoboy, SEDEX, PAC e Transportadoras, permitindo enviar a proposta formatada com 1 clique para o WhatsApp do cliente e transformá-la diretamente em um Pedido na Agenda.'
    },
    {
      q: 'Meus dados, clientes e informações de estoque estão seguros?',
      a: 'Sim, utilizamos servidores protegidos com criptografia de ponta e isolamento seguro por workspace. Cada empresa possui seu ambiente de dados reservado e backups automáticos contínuos.'
    },
    {
      q: 'O suporte via WhatsApp é com pessoas reais?',
      a: 'Sim! Nosso suporte é humanizado e especializado no varejo e distribuição. Atendemos você diretamente pelo WhatsApp no (41) 99667-9075 para tirar dúvidas, importar planilhas ou orientar sua equipe.'
    }
  ];

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
        <p className="text-xs text-neutral-500 font-semibold">Carregando informações da plataforma...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Top Banner & Hero */}
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-neutral-900 text-white rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Central de Recursos & Planos Express Tools
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-neutral-900">
          A plataforma completa para acelerar <br className="hidden sm:inline" />
          suas vendas, estoques e logística.
        </h1>
        <p className="text-neutral-600 max-w-3xl mx-auto text-sm md:text-base leading-relaxed">
          Tudo o que sua loja, distribuidora ou equipe comercial precisa para abandonar planilhas confusas e operar com máxima eficiência, lucratividade e rapidez.
        </p>

        {/* Quick Navigation Anchors */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          <Button
            variant={activeSection === 'plans' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('plans')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            Planos & Preços
          </Button>
          <Button
            variant={activeSection === 'features' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('features')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            O que tem na Plataforma
          </Button>
          <Button
            variant={activeSection === 'why' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('why')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <Star className="w-3.5 h-3.5 text-emerald-500" />
            Por que usar?
          </Button>
          <Button
            variant={activeSection === 'compare' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('compare')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            Tabela Comparativa
          </Button>
          <Button
            variant={activeSection === 'roi' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('roi')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            Calculadora de Economia
          </Button>
          <Button
            variant={activeSection === 'faq' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('faq')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
            Dúvidas Frequentes
          </Button>
          <Button
            variant={activeSection === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('all')}
            className="rounded-xl text-xs font-bold gap-1.5 h-9 border-dashed"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Ver Tudo
          </Button>
        </div>
      </div>

      {/* SECTION 1: PLANS & PRICING */}
      <section className={cn("space-y-8", activeSection !== 'plans' && activeSection !== 'all' && "hidden")}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 sm:p-6 rounded-3xl border border-neutral-200">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
              Escolha o plano ideal para a sua operação
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              Sem taxas escondidas de setup, sem surpresas no fim do mês.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                billingCycle === 'monthly' ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                billingCycle === 'annual' ? "bg-emerald-600 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <span>Anual</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider",
                billingCycle === 'annual' ? "bg-white text-emerald-700" : "bg-emerald-100 text-emerald-800"
              )}>
                -20% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => {
            const Icon = getIcon(plan.id);
            const isCurrent = currentProfile?.planId === plan.id;
            const isPro = plan.id === 'pro';
            const isIntermediate = plan.id === 'intermediate';
            const hasErpInPlan = plan.permissions.externalRestockIntegration !== 'none' || !!plan.permissions.erpExpressEnabled;

            // Compute price based on cycle
            const basePrice = Number(plan.price) || 0;
            const finalPrice = billingCycle === 'annual' ? basePrice * 0.8 : basePrice;
            const [intPart, decPart] = finalPrice.toFixed(2).split('.');

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex"
              >
                <Card className={cn(
                  "relative flex flex-col w-full rounded-3xl transition-all duration-300 h-full border-2",
                  isPro 
                    ? "border-neutral-900 shadow-2xl scale-[1.02] bg-white ring-4 ring-amber-400/20" 
                    : isIntermediate
                    ? "border-emerald-500/80 shadow-lg bg-white"
                    : "border-neutral-200 shadow-sm bg-white"
                )}>
                  {isPro && (
                    <div className="absolute -top-4 inset-x-0 flex justify-center">
                      <Badge className="bg-neutral-900 text-amber-400 border-none px-4 py-1 font-black uppercase tracking-wider text-xs shadow-md">
                        ★ MAIS COMPLETO & POTENTE
                      </Badge>
                    </div>
                  )}

                  {isIntermediate && !isPro && (
                    <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                      <Badge className="bg-emerald-600 text-white border-none px-4 py-0.5 font-bold uppercase tracking-wider text-[11px] shadow-sm">
                        RECOMENDADO PARA PEQUENAS EMPRESAS
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="p-7 pb-4">
                    <div className="flex justify-between items-start">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        isPro ? "bg-neutral-900 text-amber-400" : isIntermediate ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-800"
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>

                      {isCurrent && (
                        <Badge className="bg-emerald-500 text-white border-none px-3 py-1 font-black uppercase text-[10px] tracking-wider shadow-sm animate-pulse">
                          SEU PLANO ATUAL
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4">
                      <h3 className="text-2xl font-black text-neutral-900">{plan.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        {plan.id === 'base' && 'Para profissionais autônomos e pequenos negócios no início.'}
                        {plan.id === 'intermediate' && 'Para lojas e negócios em crescimento com equipe ativa.'}
                        {plan.id === 'pro' && 'Para distribuidoras, redes de lojas e operações de alta escala.'}
                      </p>
                    </div>

                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="text-xs font-bold text-neutral-500">R$</span>
                      <span className="text-4xl font-black tracking-tight text-neutral-900">
                        {intPart}
                      </span>
                      <span className="text-lg font-bold text-neutral-900">
                        ,{decPart}
                      </span>
                      <span className="text-xs font-bold text-neutral-500 ml-1">/mês</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                        Cobrado anualmente (economia de R$ {(basePrice * 12 * 0.2).toFixed(2)}/ano)
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="p-7 pt-4 space-y-4 flex-1">
                    <div className="pt-2 border-t border-neutral-100 space-y-3">
                      <FeatureCheck 
                        label={`${plan.permissions.maxWorkspaces === -1 ? 'Workspaces ilimitados' : `${plan.permissions.maxWorkspaces} Espaço(s) de Trabalho (Lojas)`}`} 
                        active={true}
                      />
                      <FeatureCheck 
                        label={`${plan.permissions.maxMembers ?? 5} Usuários / Membros de equipe`} 
                        active={true}
                      />
                      <FeatureCheck 
                        label="ERP Express (Produtos, Estoque & Margem)" 
                        active={hasErpInPlan}
                        highlight={hasErpInPlan && isIntermediate}
                      />
                      <FeatureCheck 
                        label="Cotação de Entregas & Frete (Correios/Motoboy)" 
                        active={true}
                      />
                      <FeatureCheck 
                        label="Carteira de Clientes & CRM Integrado" 
                        active={true}
                      />
                      <FeatureCheck 
                        label="Agenda de Pedidos & Kanban de Produção" 
                        active={true}
                      />
                      <FeatureCheck 
                        label="Assistente AI Estratégico (Gemini Pro)" 
                        active={plan.permissions.aiAssistantEnabled}
                      />
                      <FeatureCheck 
                        label={`${plan.permissions.spreadsheetMaxSheets} Planilhas Inteligentes na Nuvem`} 
                        active={plan.permissions.spreadsheetEnabled}
                      />
                      <FeatureCheck 
                        label="Colaboração em Tempo Real" 
                        active={plan.permissions.spreadsheetRealtimeCollaboration}
                      />
                      <FeatureCheck 
                        label={`Histórico de Concorrentes: ${plan.permissions.competitorHistoryMonths} meses`} 
                        active={true}
                      />
                      <FeatureCheck 
                        label="Exportação de Relatórios em CSV/Excel" 
                        active={plan.permissions.canExportData}
                      />
                      <FeatureCheck 
                        label="Suporte Especializado via WhatsApp" 
                        active={true}
                        highlight={isPro}
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="p-7 pt-0">
                    <Button 
                      className={cn(
                        "w-full h-12 text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md",
                        isCurrent && "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200 shadow-none",
                        !isCurrent && isPro && "bg-neutral-900 hover:bg-neutral-800 text-amber-400 shadow-neutral-900/20",
                        !isCurrent && isIntermediate && "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
                        !isCurrent && !isPro && !isIntermediate && "bg-neutral-900 hover:bg-neutral-800 text-white"
                      )}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                          Plano Atual da Empresa
                        </>
                      ) : (
                        <>
                          Mudar para {plan.name}
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: O QUE TEM NA PLATAFORMA (ALL MODULES SHOWCASE) */}
      <section className={cn("space-y-8", activeSection !== 'features' && activeSection !== 'all' && "hidden")}>
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold uppercase text-[10px] tracking-wider">
            Ecossistema Completo
          </Badge>
          <h2 className="text-3xl font-black text-neutral-900">
            O que tem na plataforma Express Tools?
          </h2>
          <p className="text-sm text-neutral-500">
            Conheça todos os módulos integrados projetados para eliminar gargalos e fazer sua empresa faturar mais com menos esforço.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {platformFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <Card 
                key={feat.id} 
                className="rounded-3xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all hover:border-neutral-300 flex flex-col justify-between"
              >
                <CardHeader className="p-6 pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center border", feat.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700">
                      {feat.badge}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      {feat.category}
                    </span>
                    <h3 className="text-lg font-black text-neutral-900 mt-0.5">
                      {feat.title}
                    </h3>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {feat.description}
                  </p>
                </CardHeader>

                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="pt-3 border-t border-neutral-100 space-y-1.5">
                    {feat.benefits.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  {onNavigateToTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToTab(feat.id)}
                      className="w-full text-xs font-bold text-neutral-800 hover:bg-neutral-100 rounded-xl h-9 gap-1.5"
                    >
                      Acessar Módulo
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: POR QUE USAR A PLATAFORMA? (BEFORE VS AFTER & PILLARS) */}
      <section className={cn("space-y-10", activeSection !== 'why' && activeSection !== 'all' && "hidden")}>
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase text-[10px] tracking-wider">
            Vantagens Reais
          </Badge>
          <h2 className="text-3xl font-black text-neutral-900">
            Por que usar o Express Tools no seu negócio?
          </h2>
          <p className="text-sm text-neutral-500">
            Compare o modo tradicional de gerenciar no papel e Excel solto com o modelo inteligente e integrado da nossa plataforma.
          </p>
        </div>

        {/* Before vs After Dual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SEM A PLATAFORMA */}
          <Card className="rounded-3xl border-2 border-rose-200 bg-rose-50/40 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black">
                <X className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-rose-950">Sem a Plataforma (Modo Tradicional)</h3>
                <p className="text-xs text-rose-700 font-medium">Planilhas dispersas, retrabalho e descontrole</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs font-semibold text-rose-900">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Planilhas de Excel soltas em computadores diferentes, correndo risco constante de perda de arquivos.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Demora de até 1 hora para passar valor de frete para o cliente, gerando desistência de compras.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Mercadorias esgotando de surpresa por falta de alertas de estoque mínimo e previsão de giro.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Preços calculados "no chute", vendendo produtos caros sem saber se está tendo lucro real ou prejuízo.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Equipe comercial sem histórico de compras dos clientes, perdendo oportunidades de recompra.</span>
              </div>
            </div>
          </Card>

          {/* COM O EXPRESS TOOLS */}
          <Card className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/50 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-emerald-950">Com o Express Tools (Alta Performance)</h3>
                <p className="text-xs text-emerald-700 font-medium">Controle unificado, agilidade de atendimento e lucro garantido</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs font-semibold text-emerald-950">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/90 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Tudo 100% na nuvem: acesse pedidos, clientes e produtos do celular, notebook ou tablet em qualquer lugar.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/90 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Cotação de frete por CEP em menos de 30 segundos, com proposta formatada pronta para enviar no WhatsApp.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/90 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Alertas inteligentes de ponto de reposição para encomendar produtos antes de faltarem na prateleira.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/90 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Cálculo automático de markup e margem de lucro líquida com clareza em cada item e pedido.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/90 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Carteira com histórico completo de cada cliente para reativações e aumento direto do ticket médio.</span>
              </div>
            </div>
          </Card>
        </div>

        {/* 4 Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-neutral-900 text-white space-y-2">
            <Zap className="w-8 h-8 text-amber-400" />
            <h4 className="font-bold text-base">Ativação Imediata</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Sem semanas de implantação. Em menos de 10 minutos sua empresa já está cotando fretes e organizando pedidos.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900 text-white space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h4 className="font-bold text-base">Sem Contratos Presos</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Cancele ou faça upgrade a qualquer momento. Confiamos na qualidade da nossa ferramenta para você continuar conosco.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900 text-white space-y-2">
            <Bot className="w-8 h-8 text-blue-400" />
            <h4 className="font-bold text-base">Inteligência Estratégica</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              IA integrada que analisa seu catálogo e sugere promoções, preços e compras com base no comportamento de vendas.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900 text-white space-y-2">
            <HeartHandshake className="w-8 h-8 text-purple-400" />
            <h4 className="font-bold text-base">Suporte Humanizado</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Atendimento pelo WhatsApp com consultores de verdade, prontos para orientar o crescimento do seu negócio.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: TABELA COMPARATIVA DETALHADA */}
      <section className={cn("space-y-6", activeSection !== 'compare' && activeSection !== 'all' && "hidden")}>
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-bold uppercase text-[10px] tracking-wider">
            Raio-X Completo
          </Badge>
          <h2 className="text-3xl font-black text-neutral-900">
            Comparativo detalhado entre os planos
          </h2>
          <p className="text-sm text-neutral-500">
            Confira exatamente quais permissões e limites acompanham cada categoria.
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-neutral-200 shadow-sm bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-900 text-white border-b border-neutral-800">
                <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Recurso / Capacidade</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-center w-44">Plano Base</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-center w-48 bg-emerald-800 text-amber-300">
                  Plano Intermediário
                </th>
                <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-center w-48">Plano Pro Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Espaços de Trabalho (Workspaces / Filiais)</td>
                <td className="p-4 text-center">1 Workspace</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">Até 4 Workspaces</td>
                <td className="p-4 text-center font-bold text-neutral-900">Até 10 Workspaces</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Membros de Equipe por Workspace</td>
                <td className="p-4 text-center">Até 3 membros</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">Até 12 membros</td>
                <td className="p-4 text-center font-bold text-neutral-900">Até 30 membros</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">ERP Express (Gestão de Estoque & Margens)</td>
                <td className="p-4 text-center text-neutral-400">Versão Lite</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Completo</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Pro Avançado</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Cotação de Entregas & Frete (Correios & Motoboy)</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Ilimitado</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Carteira de Clientes & CRM Comercial</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Incluso</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Agenda de Pedidos & Kanban de Produção</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Incluso</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Assistente AI com Gemini (Consultor de Vendas)</td>
                <td className="p-4 text-center text-neutral-300">✕</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Incluso</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Alta Capacidade</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Planilhas Inteligentes na Nuvem</td>
                <td className="p-4 text-center">Até 2 planilhas</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">Até 10 planilhas (1.000 linhas)</td>
                <td className="p-4 text-center font-bold text-neutral-900">Até 50 planilhas (10.000 linhas)</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Post-its Colaborativos & Mural de Recados</td>
                <td className="p-4 text-center">Até 10 post-its</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">Até 50 post-its</td>
                <td className="p-4 text-center font-bold text-neutral-900">Até 200 post-its</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Monitor de Concorrentes & Histórico</td>
                <td className="p-4 text-center">3 meses</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">9 meses</td>
                <td className="p-4 text-center font-bold text-neutral-900">24 meses (Completo)</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Exportação de Relatórios CSV & Planilhas</td>
                <td className="p-4 text-center text-neutral-300">✕</td>
                <td className="p-4 text-center text-emerald-700 font-bold bg-emerald-50/30">✓ Ilimitado</td>
                <td className="p-4 text-center text-emerald-700 font-bold">✓ Ilimitado</td>
              </tr>
              <tr className="hover:bg-neutral-50">
                <td className="p-4 font-bold text-neutral-900">Nível de Atendimento & Suporte</td>
                <td className="p-4 text-center">Suporte Padrão</td>
                <td className="p-4 text-center font-bold text-emerald-800 bg-emerald-50/30">Suporte Prioritário</td>
                <td className="p-4 text-center font-bold text-neutral-900">Gerente de Conta Dedicado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 5: CALCULADORA INTERATIVA DE ECONOMIA & ROI */}
      <section className={cn("space-y-6", activeSection !== 'roi' && activeSection !== 'all' && "hidden")}>
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold uppercase text-[10px] tracking-wider">
            Simulador de Retorno
          </Badge>
          <h2 className="text-3xl font-black text-neutral-900">
            Quanto tempo e dinheiro você economiza?
          </h2>
          <p className="text-sm text-neutral-500">
            Ajuste os parâmetros da sua rotina e veja o impacto financeiro de automatizar cotações, pedidos e controle de estoque.
          </p>
        </div>

        <Card className="rounded-3xl border-2 border-neutral-900 shadow-xl bg-white p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                  <span>Pedidos & Cotações atendidos por mês:</span>
                  <span className="text-neutral-900 text-sm font-black px-3 py-1 bg-neutral-100 rounded-xl">
                    {monthlyOrders} pedidos
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={monthlyOrders}
                  onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                />
                <div className="flex justify-between text-[11px] text-neutral-400 font-semibold">
                  <span>20/mês</span>
                  <span>500/mês</span>
                  <span>1.000+/mês</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                  <span>Tempo gasto hoje por pedido (cotação, cadastro, cobrança):</span>
                  <span className="text-neutral-900 text-sm font-black px-3 py-1 bg-neutral-100 rounded-xl">
                    {manualMinutesPerOrder} minutos
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="5"
                  value={manualMinutesPerOrder}
                  onChange={(e) => setManualMinutesPerOrder(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                />
                <div className="flex justify-between text-[11px] text-neutral-400 font-semibold">
                  <span>5 min</span>
                  <span>20 min</span>
                  <span>45 min</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                  <span>Membros na equipe comercial e expedição:</span>
                  <span className="text-neutral-900 text-sm font-black px-3 py-1 bg-neutral-100 rounded-xl">
                    {teamMembersCount} pessoas
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={teamMembersCount}
                  onChange={(e) => setTeamMembersCount(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                />
              </div>
            </div>

            {/* Live Result Highlights */}
            <div className="p-8 rounded-3xl bg-neutral-900 text-white space-y-6 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4" />
                Impacto Mensal Estimado
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Horas Economizadas</p>
                  <p className="text-3xl font-black text-amber-400">~{totalHoursSavedMonthly} h</p>
                  <p className="text-[11px] text-neutral-400">Tempo livre por mês</p>
                </div>

                <div className="space-y-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Economia Estimada</p>
                  <p className="text-3xl font-black text-emerald-400">R$ {estimatedSavingsBRL.toLocaleString('pt-BR')}</p>
                  <p className="text-[11px] text-neutral-400">Em retrabalho evitado</p>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Centralizando fretes, pedidos e estoque no Express Tools, sua equipe responde aos clientes até <strong className="text-white">4x mais rápido</strong>, reduzindo cancelamentos de vendas por demora no atendimento.
              </p>

              <Button
                onClick={() => {
                  setActiveSection('plans');
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl h-11"
              >
                Garantir Minha Assinatura Agora
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* SECTION 6: FAQ (PERGUNTAS FREQUENTES) */}
      <section className={cn("space-y-6", activeSection !== 'faq' && activeSection !== 'all' && "hidden")}>
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-neutral-100 text-neutral-700 border-neutral-300 font-bold uppercase text-[10px] tracking-wider">
            Tire Suas Dúvidas
          </Badge>
          <h2 className="text-3xl font-black text-neutral-900">
            Perguntas Frequentes sobre a Plataforma
          </h2>
          <p className="text-sm text-neutral-500">
            Tudo o que você precisa saber sobre contratação, segurança e uso diário.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqItems.map((item, fIdx) => {
            const isExpanded = expandedFaq === fIdx;
            return (
              <div 
                key={fIdx}
                className="border border-neutral-200 rounded-2xl bg-white overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : fIdx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-neutral-900 hover:bg-neutral-50"
                >
                  <span className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    {item.q}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3"
                    >
                      {item.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA & SUPPORT BANNER */}
      <div className="bg-neutral-900 rounded-[2.5rem] p-8 sm:p-12 text-white overflow-hidden relative group shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-1000">
          <Zap className="w-64 h-64" />
        </div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-amber-400">
              <Headphones className="w-3.5 h-3.5" />
              Atendimento Especializado
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Ainda tem dúvidas sobre qual plano escolher?
            </h2>
            <p className="text-neutral-400 font-medium text-sm sm:text-base leading-relaxed">
              Fale diretamente com nossa equipe de consultores no WhatsApp. Analisamos o perfil da sua loja e indicamos o plano com o melhor custo-benefício para sua realidade.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href={getWhatsAppSupportUrl("Olá! Gostaria de conversar com um consultor para tirar dúvidas e escolher o melhor plano do Express Tools para a minha empresa.")}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Conversar no WhatsApp ({SUPPORT_PHONE_FORMATTED})</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="bg-white/5 border-white/10 p-5 text-center space-y-1 rounded-2xl">
              <p className="text-2xl sm:text-3xl font-black text-amber-400">+10.000</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Cotações Geradas</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-5 text-center space-y-1 rounded-2xl">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">99.9%</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Disponibilidade</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-5 text-center space-y-1 rounded-2xl">
              <p className="text-2xl sm:text-3xl font-black text-blue-400">100%</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Em Nuvem Segura</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-5 text-center space-y-1 rounded-2xl">
              <p className="text-2xl sm:text-3xl font-black text-purple-400">Zero</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Taxa de Adesão</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCheck({ label, active, highlight }: { label: string, active: boolean, highlight?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 transition-opacity",
      active ? "opacity-100" : "opacity-40"
    )}>
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs",
        active 
          ? highlight ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-800" 
          : "bg-neutral-100 text-neutral-400"
      )}>
        {active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
      </div>
      <span className={cn(
        "text-xs font-semibold",
        active ? (highlight ? "text-emerald-950 font-bold" : "text-neutral-700") : "text-neutral-400 line-through"
      )}>
        {label}
      </span>
    </div>
  );
}
