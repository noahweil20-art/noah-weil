import * as React from 'react';
import { 
  Store, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle, 
  ShieldAlert, 
  Headphones, 
  ExternalLink,
  Package, 
  Truck, 
  Users, 
  CalendarClock, 
  StickyNote, 
  PenTool, 
  Table as TableIcon, 
  Bot, 
  TrendingUp, 
  Tag, 
  Building2, 
  Zap, 
  ShieldCheck, 
  HeartHandshake, 
  Check, 
  X, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  HelpCircle, 
  Coins, 
  Layers, 
  Crown, 
  Rocket, 
  Clock, 
  Star,
  PhoneCall,
  Smartphone,
  ChevronRight,
  LogIn,
  FileText,
  Database,
  Server,
  Key,
  EyeOff,
  Printer,
  Shield,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Plan } from '@/types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';

interface LandingPageProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  handleAuth: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isAuthLoading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
}

export default function LandingPage({
  email,
  setEmail,
  password,
  setPassword,
  handleAuth,
  isAuthLoading,
  authError,
  setAuthError,
}: LandingPageProps) {
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [expandedFaq, setExpandedFaq] = React.useState<number | null>(0);
  const [showForgotSuccess, setShowForgotSuccess] = React.useState<string | null>(null);

  // Security Policy states
  const [featuresTab, setFeaturesTab] = React.useState<'recursos' | 'seguranca'>('recursos');
  const [expandedSecurityArticle, setExpandedSecurityArticle] = React.useState<number | null>(0);
  const [openSecurityModal, setOpenSecurityModal] = React.useState<boolean>(false);

  // ROI Simulator
  const [monthlyOrders, setMonthlyOrders] = React.useState<number>(120);
  const [manualMinutes, setManualMinutes] = React.useState<number>(20);
  const [teamCount, setTeamCount] = React.useState<number>(3);

  const loginSectionRef = React.useRef<HTMLDivElement>(null);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)));
        } else {
          setPlans(fallbackPlans);
        }
      })
      .catch(() => setPlans(fallbackPlans));
  }, []);

  const scrollToLogin = () => {
    loginSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 500);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError("Por favor, digite seu e-mail no campo acima para recuperar a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setShowForgotSuccess(`Link de redefinição enviado com sucesso para ${email}`);
      setAuthError(null);
    } catch (e: any) {
      setAuthError("Erro ao solicitar redefinição. Verifique se o e-mail está correto.");
    }
  };

  // ROI math
  const minutesSaved = monthlyOrders * (manualMinutes * 0.7);
  const hoursSaved = Math.round(minutesSaved / 60);
  const moneySaved = hoursSaved * 32;

  const fallbackPlans: Plan[] = [
    {
      id: 'base',
      name: 'Plano Base',
      price: 29.9,
      permissions: {
        maxWorkspaces: 1,
        maxMembers: 3,
        competitorHistoryMonths: 3,
        aiAssistantEnabled: false,
        whiteboardEnabled: true,
        googleCalendarEnabled: false,
        canDeleteMessages: false,
        chatUploadEnabled: false,
        chatLinksEnabled: false,
        canExportData: false,
        advancedScheduling: false,
        spreadsheetEnabled: true,
        spreadsheetMaxSheets: 2,
        spreadsheetMaxRows: 200,
        spreadsheetMaxColumns: 20,
        spreadsheetExportEnabled: false,
        spreadsheetImageUploadEnabled: false,
        spreadsheetAdvancedStyles: false,
        spreadsheetRealtimeCollaboration: false,
        maxPostIts: 50,
        externalRestockIntegration: 'none',
        erpExpressEnabled: false,
      }
    },
    {
      id: 'intermediate',
      name: 'Plano Intermediário',
      price: 49.9,
      permissions: {
        maxWorkspaces: 4,
        maxMembers: 12,
        competitorHistoryMonths: 9,
        aiAssistantEnabled: true,
        whiteboardEnabled: true,
        googleCalendarEnabled: true,
        canDeleteMessages: true,
        chatUploadEnabled: true,
        chatLinksEnabled: true,
        canExportData: true,
        advancedScheduling: true,
        spreadsheetEnabled: true,
        spreadsheetMaxSheets: 10,
        spreadsheetMaxRows: 1000,
        spreadsheetMaxColumns: 50,
        spreadsheetExportEnabled: true,
        spreadsheetImageUploadEnabled: true,
        spreadsheetAdvancedStyles: true,
        spreadsheetRealtimeCollaboration: true,
        maxPostIts: 500,
        externalRestockIntegration: 'basic',
        erpExpressEnabled: true,
      }
    },
    {
      id: 'pro',
      name: 'Plano Pro Master',
      price: 99.9,
      permissions: {
        maxWorkspaces: 10,
        maxMembers: 30,
        competitorHistoryMonths: 24,
        aiAssistantEnabled: true,
        whiteboardEnabled: true,
        googleCalendarEnabled: true,
        canDeleteMessages: true,
        chatUploadEnabled: true,
        chatLinksEnabled: true,
        canExportData: true,
        advancedScheduling: true,
        spreadsheetEnabled: true,
        spreadsheetMaxSheets: 50,
        spreadsheetMaxRows: 10000,
        spreadsheetMaxColumns: 100,
        spreadsheetExportEnabled: true,
        spreadsheetImageUploadEnabled: true,
        spreadsheetAdvancedStyles: true,
        spreadsheetRealtimeCollaboration: true,
        maxPostIts: 2000,
        externalRestockIntegration: 'pro',
        erpExpressEnabled: true,
      }
    }
  ];

  const activePlans = plans.length > 0 ? plans : fallbackPlans;

  const featuresList = [
    {
      icon: Package,
      title: 'ERP Express & Estoque Inteligente',
      desc: 'Controle de custos, markup de venda, margem líquida real e alertas de estoque mínimo antes de faltar mercadoria.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: Truck,
      title: 'Cotação Multimodal de Frete',
      desc: 'Compare Motoboy Express, SEDEX, PAC e Transportadoras em 30 segundos por CEP e envie a proposta formatada no WhatsApp.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: Users,
      title: 'Carteira de Clientes (CRM)',
      desc: 'Histórico completo de compras por cliente, ticket médio acumulado, dados de contato e disparo direto de mensagens.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: CalendarClock,
      title: 'Agenda de Pedidos & Kanban',
      desc: 'Cronograma visual de entregas com prazos, status de produção, valores com frete e alertas de atrasos.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: Bot,
      title: 'Assistente AI Estratégico (Gemini)',
      desc: 'Consultor inteligente integrado para sugestão de promoções, cálculo de markup e insights sobre giro de estoque.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: TableIcon,
      title: 'Planilhas em Nuvem em Tempo Real',
      desc: 'Substitua arquivos de Excel que travam por planilhas colaborativas seguras com fórmulas e exportação para CSV.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: StickyNote,
      title: 'Mural de Post-its & Recados',
      desc: 'Quadro ágil para notas de equipe, recados de clientes e lembretes operacionais instantâneos.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: PenTool,
      title: 'Lousa & Quadro Branco Livre',
      desc: 'Área visual infinita para reuniões estratégicas, alinhamento de metas da equipe e fluxogramas.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    },
    {
      icon: Building2,
      title: 'Multi-Workspaces (Filiais)',
      desc: 'Ambientes isolados para gerenciar diferentes lojas, marcas ou setores com controle por permissão de usuário.',
      color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    }
  ];

  const securityPillars = [
    {
      icon: Lock,
      title: 'Criptografia em Trânsito e em Repouso',
      desc: 'Tráfego 100% protegido via TLS 1.3 com chaves HTTPS de 256 bits. Dados em repouso armazenados com algoritmo de cifragem AES-256 em banco de dados seguro na nuvem.',
      badge: 'TLS 1.3 & AES-256'
    },
    {
      icon: ShieldCheck,
      title: 'Conformidade Integral com a LGPD',
      desc: 'Processamento estritamente regido pelas bases legais da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), assegurando os direitos de acesso, retificação e exclusão do titular.',
      badge: 'Lei nº 13.709/2018'
    },
    {
      icon: Building2,
      title: 'Isolamento Lógico por Workspace',
      desc: 'Arquitetura multi-tenant com contêineres lógicos blindados por empresa. Nenhuma organização externa possui acesso aos seus pedidos, clientes, produtos ou margens de lucro.',
      badge: 'Multi-Tenant Blindado'
    },
    {
      icon: Key,
      title: 'Controle de Acesso Granular (RBAC)',
      desc: 'Hierarquia de permissões com papéis de Administrador, Gerente, Operador e Vendedor. Senhas protegidas com hash criptográfico e salvaguarda contra ataques de força bruta.',
      badge: 'Sessões Seguras'
    },
    {
      icon: Server,
      title: 'Backups Automáticos & Alta Disponibilidade',
      desc: 'Rotinas contínuas de backup automatizado e redundância geográfica em datacenters certificados (ISO 27001 e SOC 2), com SLA de 99.9% de disponibilidade ininterrupta.',
      badge: 'SLA 99.9% Uptime'
    },
    {
      icon: EyeOff,
      title: 'Sigilo Comercial & Propriedade Exclusiva',
      desc: 'Seus dados comerciais pertencem 100% à sua empresa. Política de tolerância zero contra mineração, monetização ou compartilhamento de dados comerciais com terceiros.',
      badge: 'Propriedade 100% Sua'
    },
  ];

  const securityArticles = [
    {
      article: 'Artigo 1º',
      title: 'Princípio da Minimização e Coleta de Dados',
      summary: 'Coletamos exclusivamente os dados necessários para a operação comercial e logística.',
      details: 'O Express Tools Hub coleta unicamente os dados estritamente necessários para o fornecimento do serviço: credenciais de autenticação corporativa (e-mail e senha com hash seguro), configurações das filiais/workspaces, cadastros de produtos, ordens de serviço e dados de entrega para orçamentos de frete. Sob nenhuma circunstância coletamos dados pessoais sensíveis (dados biométricos, dados médicos, convicções religiosas ou políticas).'
    },
    {
      article: 'Artigo 2º',
      title: 'Papéis perante a LGPD: Controlador vs. Operador',
      summary: 'Sua empresa é a Controladora dos seus clientes; o Express Tools Hub atua como Operador técnico.',
      details: 'Em estrita conformidade com o Artigo 5º da LGPD (Lei 13.709/2018), a empresa assinante é a Controladora dos dados pessoais de seus clientes finais e equipe. O Express Tools Hub atua exclusivamente na condição de Operador de dados, processando tais informações unicamente para executar cálculos de frete, impressão de ordens e organização de estoques, sob estrito dever de confidencialidade.'
    },
    {
      article: 'Artigo 3º',
      title: 'Segurança da Infraestrutura, Criptografia e Armazenamento',
      summary: 'Infraestrutura em nuvem de alta segurança com certificações SOC 2 e ISO 27001.',
      details: 'Todos os servidores e bancos de dados utilizados pelo Express Tools Hub estão hospedados em datacenters globais de nível corporativo (Google Cloud / AWS), com certificações ISO/IEC 27001, SOC 1, SOC 2 e PCI DSS. Todo o tráfego é criptografado com TLS 1.3 e os dados em repouso contam com criptografia AES-256 bits.'
    },
    {
      article: 'Artigo 4º',
      title: 'Isolamento de Workspaces e Vedações Comerciais',
      summary: 'Isolamento lógico absoluto e proibição expressa de comercialização de dados.',
      details: 'Garantimos segregação lógica por tenant (workspace). Dados de clientes, preços de custo, margens de lucro e relatórios de uma empresa nunca serão visíveis para outras organizações. É expressamente proibido no estatuto do Express Tools Hub comercializar, monetizar, emprestar ou ceder qualquer banco de dados a terceiros.'
    },
    {
      article: 'Artigo 5º',
      title: 'Retenção, Exportação e Eliminação de Dados',
      summary: 'Portabilidade garantida a qualquer momento e descarte seguro após encerramento.',
      details: 'O assinante pode exportar seus dados (produtos, estoque, clientes, pedidos) a qualquer momento em formatos abertos (CSV/Planilhas). Mediante encerramento da conta ou solicitação expressa, os dados serão permanentemente purgados e eliminados de nossos bancos de dados em até 30 dias, ressalvadas obrigações legais ou fiscais aplicáveis.'
    },
    {
      article: 'Artigo 6º',
      title: 'Canal Direto com o Encarregado de Dados (DPO)',
      summary: 'Atendimento prioritário para titulares de dados e solicitações de conformidade.',
      details: `Nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser acionado diretamente pelo canal de suporte no WhatsApp (${SUPPORT_PHONE_FORMATTED}) ou via chamado interno para solicitação de confirmação de existência de tratamento, correção de dados incompletos ou eliminação.`
    }
  ];

  const faqs = [
    {
      q: 'Como faço para entrar ou criar meu acesso no Express Tools Hub?',
      a: 'Se você já possui cadastro, basta preencher seu e-mail e senha no formulário "Acessar Sistema" no topo da página. Se você ainda não é assinante, clique em "Falar no WhatsApp" para que nossa equipe configure seu ambiente em menos de 5 minutos.'
    },
    {
      q: 'Preciso instalar programas pesados ou ter servidor próprio?',
      a: 'Não! O Express Tools Hub roda 100% na nuvem. Você pode acessar de qualquer computador, notebook, tablet ou smartphone com internet.'
    },
    {
      q: 'Como funciona a cotação de fretes integrada?',
      a: 'Você insere o CEP de destino ou escolhe um cliente cadastrado. O sistema calcula automaticamente os prazos e custos para Motoboy local e Correios (SEDEX/PAC), permitindo gerar uma mensagem elegante pronta para colar no WhatsApp do seu cliente.'
    },
    {
      q: 'Posso cancelar ou mudar de plano quando quiser?',
      a: 'Sim, com total liberdade. Não cobramos multa rescisória nem exigimos contratos longos de fidelidade. Você ajusta o plano de acordo com o crescimento da sua empresa.'
    },
    {
      q: 'Meus dados e clientes estão seguros?',
      a: 'Sim, utilizamos servidores seguros com criptografia de ponta e isolamento seguro por workspace, garantindo total privacidade e backups automáticos.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* TOP NOTIFICATION / PROMO BAR */}
      <div className="bg-neutral-900 text-neutral-200 text-xs py-2 px-4 text-center flex items-center justify-center gap-2 border-b border-neutral-800">
        <Sparkles className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
        <span className="font-medium">
          Plataforma Express Tools Hub: Gestão de estoque, cotação de frete e vendas integradas.
        </span>
        <a 
          href={getWhatsAppSupportUrl("Olá! Gostaria de uma demonstração do Express Tools Hub.")}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 font-bold text-white hover:underline text-[11px] ml-2"
        >
          Solicitar demonstração grátis &rarr;
        </a>
      </div>

      {/* STICKY MAIN HEADER / NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center shadow-md shadow-neutral-900/10">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-xl tracking-tight text-neutral-900">
                  Express Tools
                </span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-neutral-900 text-white border border-neutral-800">
                  Hub
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-500 font-medium hidden xs:block">
                Gestão, Logística & Estoque
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-neutral-600">
            <a 
              href="#recursos" 
              onClick={() => setFeaturesTab('recursos')}
              className="hover:text-neutral-900 transition-colors"
            >
              Recursos
            </a>
            <a 
              href="#seguranca" 
              onClick={() => setFeaturesTab('seguranca')}
              className="hover:text-neutral-900 transition-colors flex items-center gap-1.5 font-bold"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
              <span>Política de Segurança</span>
            </a>
            <a href="#vantagens" className="hover:text-neutral-900 transition-colors">
              Antes vs Depois
            </a>
            <a href="#planos" className="hover:text-neutral-900 transition-colors">
              Planos & Preços
            </a>
            <a href="#calculadora" className="hover:text-neutral-900 transition-colors">
              Economia (ROI)
            </a>
            <a href="#faq" className="hover:text-neutral-900 transition-colors">
              Dúvidas
            </a>
          </nav>

          {/* Actions: WhatsApp & Entrar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={getWhatsAppSupportUrl("Olá! Tenho dúvidas sobre os planos do Express Tools Hub.")}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl transition-all"
            >
              <Headphones className="w-3.5 h-3.5 text-neutral-800" />
              <span>Suporte WhatsApp</span>
            </a>

            <Button
              onClick={scrollToLogin}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm shadow-md gap-2"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>Entrar no Hub</span>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION: VALUE PROP + DIRECT LOGIN CARD */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24 border-b border-neutral-200/80 bg-gradient-to-b from-white via-neutral-50/50 to-[#fafafa]">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-neutral-200/30 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* LEFT COLUMN: HERO PITCH & VALUE PROPOSITION */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-bold text-neutral-700">
                <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />
                <span>Central Integrada para Lojistas e Empresas</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black tracking-tight text-neutral-900 leading-[1.12]">
                Elimine planilhas confusas. <br />
                <span className="text-neutral-500 font-extrabold">Acelere pedidos, fretes e lucros</span> em um só lugar.
              </h1>

              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                O <strong>Express Tools Hub</strong> unifica a cotação de fretes para seus clientes, controle de estoque com preço de custo e margem real, carteira de clientes, agenda de pedidos com kanban e assistência de inteligência artificial.
              </p>

              {/* Key Value Bullets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left max-w-xl mx-auto lg:mx-0">
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-800 bg-white p-2.5 rounded-2xl border border-neutral-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
                  <span>Cotação de frete por CEP em 30s</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-800 bg-white p-2.5 rounded-2xl border border-neutral-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
                  <span>Cálculo automático de margem real</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-800 bg-white p-2.5 rounded-2xl border border-neutral-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
                  <span>Disparo de propostas no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-800 bg-white p-2.5 rounded-2xl border border-neutral-200/80 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
                  <span>100% em nuvem e multi-filiais</span>
                </div>
              </div>

              {/* Action Buttons for Mobile/Hero */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-3">
                <Button
                  onClick={scrollToLogin}
                  size="lg"
                  className="rounded-2xl h-12 px-6 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-neutral-900/20 gap-2"
                >
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Acessar Meu Painel</span>
                </Button>

                <a
                  href="#planos"
                  className="inline-flex items-center gap-1.5 h-12 px-6 rounded-2xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  <Coins className="w-4 h-4 text-neutral-500" />
                  <span>Ver Planos & Preços</span>
                </a>
              </div>

              {/* Social proof strip */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-4 text-neutral-500 text-xs">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    LJ
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    EX
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    BR
                  </div>
                </div>
                <span className="font-semibold text-neutral-700">
                  Mais de 1.200 pedidos e fretes otimizados
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: THE ACCESS / LOGIN CARD */}
            <div className="lg:col-span-5" ref={loginSectionRef}>
              <Card className="rounded-3xl border-2 border-neutral-900/90 shadow-2xl shadow-neutral-900/10 bg-white overflow-hidden relative">
                {/* Top Badge */}
                <div className="bg-neutral-900 text-white px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider">Área de Acesso do Lojista</span>
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-400">Acesso Seguro</span>
                </div>

                <CardHeader className="p-6 sm:p-8 pb-4 text-center">
                  <div className="mx-auto w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-900 mb-2 border border-neutral-200">
                    <Store className="w-7 h-7 text-neutral-900" />
                  </div>
                  <CardTitle className="text-2xl font-black text-neutral-900 tracking-tight">
                    Entrar no Express Tools Hub
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 mt-1">
                    Digite suas credenciais para gerenciar sua loja e pedidos.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700">E-mail de Acesso</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                          <Input
                            ref={emailInputRef}
                            type="email"
                            placeholder="seuemail@empresa.com"
                            className="pl-10 h-11 rounded-xl border-neutral-200 focus-visible:ring-neutral-900 text-xs sm:text-sm font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-neutral-700">Senha</label>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                          >
                            Esqueceu a senha?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                          <Input
                            type="password"
                            placeholder="Sua senha de acesso"
                            className="pl-10 h-11 rounded-xl border-neutral-200 focus-visible:ring-neutral-900 text-xs sm:text-sm font-medium"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {authError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200"
                      >
                        <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{authError}</span>
                      </motion.div>
                    )}

                    {showForgotSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{showForgotSuccess}</span>
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full h-12 font-black text-xs uppercase tracking-wider bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-md transition-all gap-2"
                    >
                      {isAuthLoading ? (
                        <span>Autenticando...</span>
                      ) : (
                        <>
                          <span>Acessar Plataforma</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </Button>
                  </form>

                  {/* WhatsApp Support Box */}
                  <div className="pt-4 border-t border-neutral-100 text-center space-y-2">
                    <p className="text-[11px] text-neutral-500 font-medium">
                      Ainda não tem conta ou precisa de suporte?
                    </p>
                    <a
                      href={getWhatsAppSupportUrl("Olá! Gostaria de assinar ou criar minha conta no Express Tools Hub.")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Headphones className="w-4 h-4 text-neutral-700" />
                      <span>Falar com Consultor ({SUPPORT_PHONE_FORMATTED})</span>
                      <ExternalLink className="w-3 h-3 text-neutral-500 opacity-70" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: MODULES / RECURSOS DA PLATAFORMA */}
      <section id="recursos" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-12 scroll-mt-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          {/* Sub-navigation tabs: Recursos & Política de Segurança lado a lado */}
          <div className="flex justify-center items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 border border-neutral-300 w-fit mx-auto">
            <button
              type="button"
              onClick={() => setFeaturesTab('recursos')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                featuresTab === 'recursos' 
                  ? "bg-neutral-900 text-white shadow-xs" 
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Recursos & Módulos</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeaturesTab('seguranca');
                document.getElementById('seguranca')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                featuresTab === 'seguranca' 
                  ? "bg-neutral-900 text-white shadow-xs" 
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Política de Segurança & LGPD</span>
            </button>
          </div>

          <Badge className="bg-neutral-100 text-neutral-900 border-neutral-300 font-bold uppercase text-[10px] tracking-wider">
            Recursos Completos
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
            Tudo o que sua operação precisa no dia a dia
          </h2>
          <p className="text-neutral-600 text-sm sm:text-base">
            Desenvolvido sob medida para simplificar o cotidiano de quem atende clientes, organiza estoque e precisa despachar mercadorias no prazo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <Card key={idx} className="rounded-3xl border border-neutral-200/90 shadow-xs hover:shadow-md transition-all bg-white p-6 space-y-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border", feat.color)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-neutral-900">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick Link Banner from Recursos to Segurança */}
        <div className="p-6 rounded-3xl bg-neutral-900 text-white border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-black text-base text-white">Todos os recursos operam sob blindagem e conformidade LGPD</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Criptografia TLS 1.3, isolamento lógico de filiais (multi-tenant) e propriedade integral dos dados para o lojista.
              </p>
            </div>
          </div>
          <a
            href="#seguranca"
            onClick={() => setFeaturesTab('seguranca')}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-neutral-900 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Conhecer Política de Segurança</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* SECTION: POLÍTICA DE SEGURANÇA & CONFORMIDADE LGPD (DO LADO DE RECURSOS) */}
      <section id="seguranca" className="py-20 bg-neutral-100/70 border-t border-neutral-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          {/* Header */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge className="bg-neutral-900 text-white border-neutral-800 font-bold uppercase text-[10px] tracking-wider">
              Segurança & LGPD • Lei 13.709/2018
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
              Política de Segurança da Informação & Proteção de Dados
            </h2>
            <p className="text-neutral-600 text-sm sm:text-base">
              Conheça as salvaguardas técnicas, estruturais e jurídicas que garantem sigilo absoluto, alta disponibilidade e privacidade total para as operações do seu negócio.
            </p>
          </div>

          {/* 4 Trust Highlights Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs text-center space-y-1">
              <div className="flex justify-center mb-2">
                <Lock className="w-5 h-5 text-neutral-900" />
              </div>
              <span className="font-black text-sm text-neutral-900 block">TLS 1.3 & AES-256</span>
              <p className="text-[11px] text-neutral-500 font-medium">Criptografia em trânsito e em repouso</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs text-center space-y-1">
              <div className="flex justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-neutral-900" />
              </div>
              <span className="font-black text-sm text-neutral-900 block">100% LGPD</span>
              <p className="text-[11px] text-neutral-500 font-medium">Conformidade com a Lei nº 13.709/2018</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs text-center space-y-1">
              <div className="flex justify-center mb-2">
                <Building2 className="w-5 h-5 text-neutral-900" />
              </div>
              <span className="font-black text-sm text-neutral-900 block">Workspaces Isolados</span>
              <p className="text-[11px] text-neutral-500 font-medium">Multi-tenant com segregação lógica</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs text-center space-y-1">
              <div className="flex justify-center mb-2">
                <Server className="w-5 h-5 text-neutral-900" />
              </div>
              <span className="font-black text-sm text-neutral-900 block">Backups Diários</span>
              <p className="text-[11px] text-neutral-500 font-medium">Redundância e SLA de 99.9% Uptime</p>
            </div>
          </div>

          {/* 6 Core Security Architecture Cards */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-neutral-900 tracking-tight">
              Pilares Arquiteturais de Blindagem Digital
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {securityPillars.map((pillar, idx) => {
                const Icon = pillar.icon;
                return (
                  <Card key={idx} className="rounded-3xl border border-neutral-200 shadow-xs hover:shadow-md transition-all bg-white p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-neutral-300 text-neutral-800 bg-neutral-50">
                        {pillar.badge}
                      </Badge>
                    </div>
                    <h4 className="text-base font-black text-neutral-900">{pillar.title}</h4>
                    <p className="text-xs text-neutral-600 leading-relaxed">{pillar.desc}</p>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Interactive Articles / Diretrizes Formais da Política */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-black text-neutral-900 tracking-tight">
                  Diretrizes & Artigos da Política de Privacidade
                </h3>
                <p className="text-xs text-neutral-500">
                  Clique para expandir os termos práticos que regulam o tratamento dos dados da sua empresa e dos seus clientes.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenSecurityModal(true)}
                className="rounded-xl font-bold text-xs gap-1.5 border-neutral-300 shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-800" />
                <span>Ler Minuta Jurídica Completa</span>
              </Button>
            </div>

            <div className="space-y-3">
              {securityArticles.map((item, idx) => {
                const isOpen = expandedSecurityArticle === idx;
                return (
                  <div 
                    key={idx} 
                    className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-xs transition-all"
                  >
                    <button
                      onClick={() => setExpandedSecurityArticle(isOpen ? null : idx)}
                      className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-neutral-900 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 text-[10px] font-black uppercase tracking-wider shrink-0 border border-neutral-200">
                          {item.article}
                        </span>
                        <div>
                          <span className="text-sm font-black block">{item.title}</span>
                          <span className="text-xs text-neutral-500 font-normal">{item.summary}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-neutral-700" /> : <ChevronDown className="w-4 h-4 text-neutral-700" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="p-5 pt-0 border-t border-neutral-100 text-xs text-neutral-700 leading-relaxed bg-neutral-50/50">
                        <p className="pt-4">{item.details}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Security Action Banner */}
          <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                <FileCheck className="w-6 h-6 text-neutral-900" />
              </div>
              <div>
                <h4 className="font-black text-sm text-neutral-900">Precisa de auditoria ou contrato corporativo de conformidade (DPA)?</h4>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Nossa equipe e o Encarregado de Proteção de Dados (DPO) estão à disposição para formalizar termos de confidencialidade e auditoria.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button
                onClick={() => setOpenSecurityModal(true)}
                variant="outline"
                className="flex-1 md:flex-none rounded-xl text-xs font-bold border-neutral-300 h-10"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5 text-neutral-800" />
                <span>Termos Técnicos</span>
              </Button>
              <a
                href={getWhatsAppSupportUrl("Olá! Gostaria de falar com o DPO / Suporte de Segurança do Express Tools Hub.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none h-10 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Headphones className="w-3.5 h-3.5 text-white" />
                <span>Falar com DPO</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: ANTES VS DEPOIS (POR QUE USAR) */}
      <section id="vantagens" className="py-20 bg-neutral-100/70 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge className="bg-neutral-200 text-neutral-900 border-neutral-300 font-bold uppercase text-[10px] tracking-wider">
              Transformação Real
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
              Por que substituir planilhas soltas pelo Express Tools Hub?
            </h2>
            <p className="text-neutral-600 text-sm sm:text-base">
              Veja a diferença prática entre operar no modo manual e desorganizado versus uma plataforma centralizada e inteligente.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* SEM A PLATAFORMA */}
            <Card className="rounded-3xl border-2 border-neutral-300 bg-white p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-neutral-200 text-neutral-700 flex items-center justify-center font-black">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-neutral-900">Sem o Express Tools Hub</h3>
                  <p className="text-xs text-neutral-500 font-semibold">Desperdício de tempo e prejuízos invisíveis</p>
                </div>
              </div>

              <div className="space-y-3 text-xs font-semibold text-neutral-700">
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <XCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Demora de até 1 hora para orçar frete para o cliente, causando desistências de compra.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <XCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Planilhas de Excel soltas que travam, corrompem e não sincronizam com a equipe.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <XCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Produtos esgotando de surpresa por falta de cálculo de estoque mínimo de reposição.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <XCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Venda de mercadorias sem clareza da margem líquida real, correndo risco de prejuízo.</span>
                </div>
              </div>
            </Card>

            {/* COM O EXPRESS TOOLS */}
            <Card className="rounded-3xl border-2 border-neutral-900 bg-neutral-900 text-white p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white text-neutral-900 flex items-center justify-center font-black">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Com o Express Tools Hub</h3>
                  <p className="text-xs text-neutral-300 font-semibold">Produtividade máxima e vendas multiplicadas</p>
                </div>
              </div>

              <div className="space-y-3 text-xs font-semibold text-neutral-100">
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-800 border border-neutral-700 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>Cotação de frete por CEP em menos de 30 segundos pronta para enviar no WhatsApp.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-800 border border-neutral-700 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>Sistema 100% na nuvem acessível do celular, tablet ou computador por toda a equipe.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-800 border border-neutral-700 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>Alertas automáticos de ponto de reposição antes de qualquer ruptura de estoque.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-neutral-800 border border-neutral-700 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>Margem de lucro e markup calculados automaticamente em cada produto e pedido.</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION: PLANOS & PREÇOS */}
      <section id="planos" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <Badge className="bg-neutral-100 text-neutral-900 border-neutral-300 font-bold uppercase text-[10px] tracking-wider">
              Investimento Acessível
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
              Planos claros, sem surpresas
            </h2>
            <p className="text-neutral-500 text-xs sm:text-sm">
              Sem taxa de adesão, sem taxas ocultas. Escolha o ideal para o porte do seu negócio.
            </p>
          </div>

          {/* Toggle Monthly vs Annual */}
          <div className="flex items-center bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-xs">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                billingCycle === 'monthly' ? "bg-neutral-900 text-white shadow-xs" : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                billingCycle === 'annual' ? "bg-neutral-900 text-white shadow-xs" : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <span>Anual</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-md uppercase font-black",
                billingCycle === 'annual' ? "bg-white text-neutral-900" : "bg-neutral-200 text-neutral-800"
              )}>
                -20% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Plans Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {activePlans.map((plan) => {
            const isPro = plan.id === 'pro';
            const isIntermediate = plan.id === 'intermediate';
            const basePrice = Number(plan.price) || 0;
            const price = billingCycle === 'annual' ? basePrice * 0.8 : basePrice;
            const [intP, decP] = price.toFixed(2).split('.');

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative rounded-3xl border-2 flex flex-col justify-between transition-all bg-white",
                  isPro 
                    ? "border-neutral-900 shadow-xl scale-[1.02] ring-2 ring-neutral-900/10" 
                    : isIntermediate
                    ? "border-neutral-600 shadow-md"
                    : "border-neutral-300 shadow-xs"
                )}
              >
                {isPro && (
                  <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                    <span className="bg-neutral-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-xs border border-neutral-700">
                      ★ MAIS COMPLETO PARA ESCALA
                    </span>
                  </div>
                )}
                {isIntermediate && (
                  <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                    <span className="bg-neutral-800 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-xs border border-neutral-700">
                      RECOMENDADO PARA PEQUENAS LOJAS
                    </span>
                  </div>
                )}

                <CardHeader className="p-7 pb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-100 text-neutral-900 mb-3 border border-neutral-200">
                    {isPro ? <Crown className="w-6 h-6 text-neutral-900" /> : isIntermediate ? <Rocket className="w-6 h-6 text-neutral-900" /> : <Package className="w-6 h-6 text-neutral-700" />}
                  </div>

                  <h3 className="text-2xl font-black text-neutral-900">{plan.name}</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {plan.id === 'base' && 'Para autônomos e pequenos negócios no início.'}
                    {plan.id === 'intermediate' && 'Para lojas e distribuidoras com equipe ativa.'}
                    {plan.id === 'pro' && 'Para redes de lojas e operações que exigem capacidade máxima.'}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-xs font-bold text-neutral-500">R$</span>
                    <span className="text-4xl font-black text-neutral-900 tracking-tight">{intP}</span>
                    <span className="text-base font-bold text-neutral-900">,{decP}</span>
                    <span className="text-xs text-neutral-500 font-bold ml-1">/mês</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-[11px] text-neutral-600 font-bold mt-1">
                      Cobrado anualmente com 20% de desconto
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-7 pt-2 space-y-3 flex-1 text-xs">
                  <div className="pt-3 border-t border-neutral-100 space-y-2.5">
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>{plan.permissions.maxWorkspaces} Espaço(s) de Trabalho (Filiais)</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>{plan.permissions.maxMembers} Membros de equipe</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>Cotação de Frete Correios & Motoboy</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>Carteira de Clientes & CRM Completo</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>Agenda de Pedidos & Kanban</span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      {plan.permissions.aiAssistantEnabled ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      )}
                      <span className={cn(!plan.permissions.aiAssistantEnabled && "text-neutral-400 line-through")}>
                        Assistente AI Estratégico (Gemini)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-neutral-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                      <span>Planilhas Inteligentes em Nuvem ({plan.permissions.spreadsheetMaxSheets} un.)</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-7 pt-0">
                  <a
                    href={getWhatsAppSupportUrl(`Olá! Gostaria de contratar o plano ${plan.name} (${billingCycle === 'annual' ? 'Anual com 20% OFF' : 'Mensal'}) do Express Tools Hub.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-all shadow-md bg-neutral-900 hover:bg-neutral-800 text-white"
                  >
                    <span>Quero Assinar {plan.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* SECTION: SIMULADOR DE ROI / ECONOMIA */}
      <section id="calculadora" className="py-20 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="px-3.5 py-1 rounded-full bg-neutral-800 text-neutral-200 font-black text-[10px] uppercase tracking-wider border border-neutral-700">
              Calculadora de Eficiência
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Quanto tempo e dinheiro você economiza?
            </h2>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Ao eliminar cálculos manuais e cotações demoradas, sua equipe ganha dezenas de horas produtivas todos os meses.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center bg-neutral-800/80 p-8 sm:p-12 rounded-3xl border border-neutral-700">
            {/* Sliders */}
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-300">
                  <span>Pedidos & Cotações por mês:</span>
                  <span className="text-white font-black text-sm px-3 py-1 bg-neutral-900 rounded-xl border border-neutral-700">
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
                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-300">
                  <span>Minutos gastos manualmente por pedido hoje:</span>
                  <span className="text-white font-black text-sm px-3 py-1 bg-neutral-900 rounded-xl border border-neutral-700">
                    {manualMinutes} minutos
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="5"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-300">
                  <span>Pessoas na equipe operacional/comercial:</span>
                  <span className="text-white font-black text-sm px-3 py-1 bg-neutral-900 rounded-xl border border-neutral-700">
                    {teamCount} pessoas
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>

            {/* Results Block */}
            <div className="bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-700 space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                  Tempo Livre Recuperado / Mês
                </span>
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  ~{hoursSaved} horas
                </div>
                <p className="text-xs text-neutral-400">
                  Horas que sua equipe deixa de preencher tabelas e usa para vender e prospectar.
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                  Economia Financeira Estimada
                </span>
                <div className="text-3xl font-black text-white tracking-tight">
                  R$ {moneySaved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <span className="text-xs text-neutral-400 font-normal ml-2">/mês em retrabalho</span>
                </div>
              </div>

              <Button
                onClick={scrollToLogin}
                className="w-full h-11 rounded-2xl bg-white hover:bg-neutral-200 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md"
              >
                Começar a Economizar Agora
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: FAQ / DÚVIDAS */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-3">
          <Badge className="bg-neutral-100 text-neutral-800 border-neutral-300 font-bold uppercase text-[10px] tracking-wider">
            Tire Suas Dúvidas
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-neutral-500 text-xs sm:text-sm">
            Tudo o que você precisa saber antes de entrar ou assinar a plataforma.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="border border-neutral-200 rounded-2xl bg-white overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-5 text-left font-bold text-xs sm:text-sm text-neutral-900 flex items-center justify-between gap-4 hover:bg-neutral-50"
                >
                  <span>{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                  )}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 text-xs sm:text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-neutral-200 py-12 text-neutral-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-black">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-neutral-900">Express Tools Hub</span>
              <p className="text-[11px] text-neutral-400">© {new Date().getFullYear()} Todos os direitos reservados.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-bold text-neutral-500">
            <a 
              href="#recursos" 
              onClick={() => setFeaturesTab('recursos')}
              className="hover:text-neutral-900"
            >
              Recursos
            </a>
            <a 
              href="#seguranca" 
              onClick={() => setFeaturesTab('seguranca')}
              className="hover:text-neutral-900 flex items-center gap-1 font-bold text-neutral-800"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
              <span>Política de Segurança</span>
            </a>
            <a href="#vantagens" className="hover:text-neutral-900">Vantagens</a>
            <a href="#planos" className="hover:text-neutral-900">Planos</a>
            <a href="#faq" className="hover:text-neutral-900">FAQ</a>
            <a 
              href={getWhatsAppSupportUrl("Olá! Gostaria de falar com o suporte do Express Tools Hub.")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-700 hover:text-neutral-900"
            >
              Suporte WhatsApp ({SUPPORT_PHONE_FORMATTED})
            </a>
          </div>

          <Button
            onClick={scrollToLogin}
            variant="outline"
            size="sm"
            className="rounded-xl font-bold text-xs gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5 text-neutral-800" />
            <span>Voltar ao Login</span>
          </Button>
        </div>
      </footer>

      {/* MODAL: MINUTA JURÍDICA COMPLETA DA POLÍTICA DE SEGURANÇA & LGPD */}
      <Dialog open={openSecurityModal} onOpenChange={setOpenSecurityModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 bg-white border border-neutral-300 rounded-3xl text-neutral-900">
          <DialogHeader className="space-y-2 pb-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-900">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                Documento Oficial de Governança & LGPD
              </span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-neutral-900">
              Política de Segurança da Informação, Privacidade e LGPD
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600">
              Termos técnicos e salvaguardas operacionais aplicáveis a todos os planos e workspaces da plataforma Express Tools Hub em conformidade com a Lei Federal nº 13.709/2018.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6 text-xs text-neutral-700 leading-relaxed">
            {/* Cláusula 1 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">1. Identificação do Controlador e do Operador</h4>
              <p>
                Para os fins da Lei Geral de Proteção de Dados Pessoais (LGPD), a empresa assinante atua na qualidade de <strong>Controladora</strong> dos dados de seus colaboradores e clientes finais cadastrados. A plataforma Express Tools Hub atua estritamente na qualidade de <strong>Operadora</strong>, realizando o processamento técnico em nome da Controladora e sob suas exclusivas diretrizes.
              </p>
            </div>

            {/* Cláusula 2 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">2. Princípio da Minimização e Coleta de Dados</h4>
              <p>
                Coletamos unicamente os dados necessários para a execução dos serviços contratados: credenciais de acesso corporativo (e-mail e senhas protegidas com algoritmo de hash seguro), identificação de filiais/workspaces, cadastros de produtos e informações logísticas (endereços de remetente e destinatário para fins de cotação de frete). Não solicitamos nem processamos dados pessoais sensíveis (conforme Art. 5º, II da LGPD).
              </p>
            </div>

            {/* Cláusula 3 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">3. Criptografia e Armazenamento em Nuvem</h4>
              <p>
                Todo o fluxo de comunicação entre as estações de trabalho e os servidores é criptografado utilizando o protocolo <strong>TLS 1.3 (HTTPS de 256 bits)</strong>. Em repouso, todos os bancos de dados são cifrados por meio do padrão <strong>AES-256 bits</strong> em data centers corporativos de alta resiliência (certificados com ISO/IEC 27001, SOC 1, SOC 2 e PCI-DSS).
              </p>
            </div>

            {/* Cláusula 4 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">4. Isolamento Lógico de Workspaces (Multi-Tenancy Blindado)</h4>
              <p>
                A arquitetura da plataforma emprega segregação lógica estrita entre ambientes. Os registros de vendas, orçamentos, produtos e margens comerciais de um assinante permanecem isolados e inacessíveis a qualquer outro usuário ou organização cadastrada na plataforma.
              </p>
            </div>

            {/* Cláusula 5 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">5. Sigilo Comercial e Vedação de Comercialização de Dados</h4>
              <p>
                100% dos dados cadastrados e operados na plataforma são e permanecerão de titularidade e propriedade exclusiva da empresa assinante. O Express Tools Hub não comercializa, não aluga, não compartilha e não utiliza os dados comerciais ou listas de clientes para finalidades publicitárias ou cruzamento de audiências.
              </p>
            </div>

            {/* Cláusula 6 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">6. Política de Backups e Recuperação de Desastres</h4>
              <p>
                São executadas rotinas automáticas e contínuas de cópia de segurança (backups diários redundantes) em zonas de disponibilidade distintas. A arquitetura foi projetada para garantir continuidade ininterrupta de negócio e rápida restauração operacional em eventuais contingências.
              </p>
            </div>

            {/* Cláusula 7 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">7. Direitos dos Titulares de Dados (Art. 18 da LGPD)</h4>
              <p>
                Asseguramos aos titulares e à empresa contratante o exercício pleno dos direitos garantidos pelo Art. 18 da LGPD, incluindo confirmação de tratamento, acesso facilitado, retificação de dados incorretos, portabilidade das informações em formatos universais e eliminação definitiva após a extinção do contrato.
              </p>
            </div>

            {/* Cláusula 8 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">8. Retenção e Expurgamento Definitivo</h4>
              <p>
                Em caso de cancelamento da assinatura ou solicitação formal de exclusão de conta, todos os dados operacionais e cadastrais serão expurgados de forma definitiva e irrecuperável em até 30 (trinta) dias úteis, resguardadas obrigações legais ou fiscais de guarda aplicáveis pela legislação brasileira.
              </p>
            </div>

            {/* Cláusula 9 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">9. Gestão e Notificação de Incidentes</h4>
              <p>
                Mantemos rotinas de monitoramento contínuo contra ameaças e intrusões. Na improvável hipótese de ocorrência de qualquer incidente de segurança relevante que possa acarretar risco ou dano aos titulares, a plataforma comunicará a Controladora e a Autoridade Nacional de Proteção de Dados (ANPD) em conformidade com o Art. 48 da LGPD.
              </p>
            </div>

            {/* Cláusula 10 */}
            <div className="space-y-1.5">
              <h4 className="font-black text-sm text-neutral-900">10. Contato com o Encarregado de Proteção de Dados (DPO)</h4>
              <p>
                Para exercer seus direitos, solicitar relatórios de conformidade ou sanar dúvidas relativas à presente política, entre em contato diretamente com o Encarregado pelo Tratamento de Dados Pessoais através do canal oficial de atendimento WhatsApp: <strong>{SUPPORT_PHONE_FORMATTED}</strong>.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-neutral-500 font-medium">
              Última atualização: Versão 2.4 (Válida para todo o território nacional)
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex-1 sm:flex-none text-xs font-bold gap-1.5 border-neutral-300"
              >
                <Printer className="w-3.5 h-3.5 text-neutral-700" />
                <span>Imprimir / Salvar</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setOpenSecurityModal(false)}
                className="flex-1 sm:flex-none text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white"
              >
                Entendi e Aceito
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
