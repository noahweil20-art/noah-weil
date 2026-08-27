import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  Settings, 
  HelpCircle, 
  Sparkles, 
  MessageSquare,
  ArrowRight,
  Monitor,
  Rocket,
  ShieldCheck,
  Save,
  Globe,
  PlusCircle,
  TrendingUp,
  PackageSearch,
  Users,
  CheckCircle2,
  Headphones,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

export default function AIAssistant() {
  const { currentWorkspace, canEdit } = useWorkspace();
  const { plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [activeView, setActiveView] = React.useState<'chat' | 'guide' | 'settings'>('guide');
  const [chatbotUrl, setChatbotUrl] = React.useState(currentWorkspace?.chatbotConfig?.url || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [guideData, setGuideData] = React.useState<{ platformSteps: any[], integrationSteps: any[], tips: string[] }>({
    platformSteps: [],
    integrationSteps: [],
    tips: []
  });

  const aiEnabled = plan?.permissions.aiAssistantEnabled ?? false;

  React.useEffect(() => {
    fetch('/api/assistant/guide')
      .then(res => res.json())
      .then(data => {
        if (data) setGuideData(data);
      })
      .catch(err => console.error('Error fetching assistant guide from backend:', err));
  }, []);

  React.useEffect(() => {
    if (currentWorkspace?.chatbotConfig?.url) {
      setChatbotUrl(currentWorkspace.chatbotConfig.url);
    }
  }, [currentWorkspace]);

  const handleSaveConfig = async () => {
    if (!currentWorkspace || !canEdit) return;
    if (!checkLimit('ao Assistente de Inteligência Artificial e Chatbot (disponível a partir do Plano Intermediário)', aiEnabled)) {
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'workspaces', currentWorkspace.id), {
        chatbotConfig: {
          url: chatbotUrl,
          enabled: !!chatbotUrl
        }
      });
      setActiveView('chat');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${currentWorkspace.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getStepIcon = (category: string) => {
    switch (category) {
      case 'orders': return PlusCircle;
      case 'competitors': return TrendingUp;
      case 'inventory': return PackageSearch;
      case 'team': return Users;
      default: return Sparkles;
    }
  };

  const platformSteps = (guideData.platformSteps?.length > 0 ? guideData.platformSteps : [
    {
      title: "Gestão de Pedidos & Agenda",
      description: "Utilize a Agenda para organizar as entregas e visitas aos clientes de forma cronológica.",
      category: "orders",
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      title: "Análise de Concorrentes",
      description: "Registre semanalmente os preços e promoções da concorrência para ajustar sua estratégia.",
      category: "competitors",
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    },
    {
      title: "Inteligência de Estoque",
      description: "Consulte o 'Reabastecimento' para ver sugestões baseadas em estoque mínimo e giro de produtos.",
      category: "inventory",
      color: "text-orange-500",
      bg: "bg-orange-50"
    },
    {
      title: "Trabalho em Equipe",
      description: "Convide colaboradores na aba 'Compartilhamento' e use o Chat da Equipe para coordenação.",
      category: "team",
      color: "text-purple-500",
      bg: "bg-purple-50"
    }
  ]).map(s => ({
    ...s,
    icon: getStepIcon(s.category || '')
  }));

  const integrationSteps = guideData.integrationSteps?.length > 0 ? guideData.integrationSteps : [
    {
      id: "01",
      title: "Configuração do Chatbot",
      description: "Integre seu assistente inserindo a URL na aba de configurações.",
    },
    {
      id: "02",
      title: "Treinamento & Contexto",
      description: "Configure seu chatbot para ler os dados do negócio e responder clientes.",
    },
    {
      id: "03",
      title: "Dashboard Operacional",
      description: "Acesse o chatbot de qualquer lugar pelo menu lateral 'Assistente AI'.",
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Bot className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900 italic serif">Assistente AI & Suporte</h1>
          </div>
          <p className="text-neutral-500 max-w-2xl font-medium">
            Potencialize sua operação com inteligência artificial personalizada. Integre seu próprio chatbot e siga nosso guia para extrair o máximo da plataforma.
          </p>
        </div>
        <a
          href={getWhatsAppSupportUrl("Olá! Gostaria de suporte e ajuda técnica sobre o Express Tools e Assistente AI.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 h-fit"
        >
          <Headphones className="w-4 h-4" />
          <span>Falar com Suporte ({SUPPORT_PHONE_FORMATTED})</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </a>
      </header>

      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        <Button 
          variant={activeView === 'chat' ? 'secondary' : 'ghost'} 
          className="rounded-lg h-9 px-4 font-semibold"
          onClick={() => {
            if (!checkLimit('ao Assistente de Inteligência Artificial e Chatbot (disponível a partir do Plano Intermediário)', aiEnabled)) {
              return;
            }
            setActiveView('chat');
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Meu Chatbot
        </Button>
        <Button 
          variant={activeView === 'guide' ? 'secondary' : 'ghost'} 
          className="rounded-lg h-9 px-4 font-semibold"
          onClick={() => setActiveView('guide')}
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          Guia de Uso
        </Button>
        <Button 
          variant={activeView === 'settings' ? 'secondary' : 'ghost'} 
          className="rounded-lg h-9 px-4 font-semibold"
          onClick={() => {
            if (!checkLimit('às configurações de Chatbot e Inteligência Artificial (disponível a partir do Plano Intermediário)', aiEnabled)) {
              return;
            }
            setActiveView('settings');
          }}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurar
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'guide' && (
          <motion.div
            key="guide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            <section className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-2xl font-bold tracking-tight">Como usar a Plataforma</h2>
                <Badge className="bg-emerald-100 text-emerald-700 font-bold">DICAS DE SUCESSO</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {platformSteps.map((step, idx) => (
                  <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-all duration-300 group">
                    <CardContent className="p-6 space-y-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", step.bg, step.color)}>
                        <step.icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-neutral-800">{step.title}</h3>
                        <p className="text-xs text-neutral-500 leading-relaxed font-medium">{step.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold tracking-tight px-1">Integração do Chatbot</h2>
                <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-200">
                  {integrationSteps.map((step) => (
                    <div key={step.id} className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10">
                        <span className="text-xs font-black text-primary">{step.id}</span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-neutral-900">{step.title}</h3>
                        <p className="text-sm text-neutral-500 font-medium leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="bg-primary text-primary-foreground border-none shadow-2xl overflow-hidden relative group h-fit">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Rocket className="w-64 h-64 rotate-12" />
                </div>
                <CardHeader className="relative z-10 p-8 pb-4">
                  <Badge className="w-fit mb-4 bg-white text-primary font-bold">PREMIUM</Badge>
                  <CardTitle className="text-3xl font-bold tracking-tight">Pronto para decolar?</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 p-8 pt-0 space-y-6">
                  <p className="text-primary-foreground/80 font-medium text-sm leading-relaxed">
                    A integração de IA permite automatizar o atendimento, analisar estoques e prever demandas sazonais com precisão.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold">Acesso total às ferramentas</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold">Personalização de IAs</span>
                    </div>
                  </div>
                  <Button variant="secondary" className="w-full h-14 text-lg font-bold rounded-xl" onClick={() => setActiveView('settings')}>
                    Configurar Agora
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {activeView === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="min-h-[600px] w-full bg-white rounded-3xl border shadow-xl overflow-hidden flex flex-col items-center justify-center relative"
          >
            {currentWorkspace?.chatbotConfig?.enabled && currentWorkspace?.chatbotConfig?.url ? (
              <iframe 
                src={currentWorkspace.chatbotConfig.url} 
                className="w-full h-[600px] border-none"
                title="AI Chatbot"
              />
            ) : (
              <div className="max-w-md text-center space-y-6 p-8">
                <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                  <Bot className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900">Chatbot Não Configurado</h3>
                  <p className="text-neutral-500 mt-2 font-medium">Você ainda não integrou seu assistente personalizado. Configure-o na aba de configurações.</p>
                </div>
                <Button onClick={() => setActiveView('settings')} variant="outline" className="rounded-xl h-11 px-8 font-bold">
                   Ir para Configurações
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-none shadow-xl rounded-3xl">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-bold">Configurações do Assistente</CardTitle>
                <CardDescription className="text-base font-medium">Insira a URL do seu chatbot para integrá-lo diretamente no dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-widest pl-1 leading-none">URL do Chatbot</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                    <Input 
                      placeholder="https://sua-url-de-integração.com" 
                      value={chatbotUrl}
                      onChange={(e) => setChatbotUrl(e.target.value)}
                      className="h-12 pl-10 rounded-xl"
                      disabled={!canEdit}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">Exemplo: link de compartilhamento do Voiceflow ou Landbot.</p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3">
                  <HelpCircle className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-blue-900">Como obter o link?</p>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                      Vá até as configurações de 'Embed' ou 'Widget' da sua plataforma de chatbot preferida e copie a URL do iframe.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    onClick={handleSaveConfig} 
                    className="rounded-xl h-12 px-10 font-bold shadow-lg shadow-primary/20"
                    disabled={isSaving || !canEdit}
                  >
                    {isSaving ? "Salvando..." : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Configuração
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2.5 py-1 text-[10px] rounded-lg inline-flex items-center font-black tracking-widest", className)}>
      {children}
    </span>
  );
}
