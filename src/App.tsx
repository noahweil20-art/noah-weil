import * as React from 'react';
import { 
  logout, 
  db, 
  signInWithEmailAndPassword,
  auth 
} from './lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Store, Loader2, Mail, Lock, ArrowRight, CheckCircle, ShieldAlert, Headphones, ExternalLink } from 'lucide-react';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { PlanLimitProvider } from './contexts/PlanLimitContext';
import PlanLimitModal from './components/PlanLimitModal';
import { cn } from './lib/utils';
import { motion } from 'motion/react';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from './lib/support';

// Code-Splitting: Lazy load module components to keep initial bundle ultra-light
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const SubscriptionSelector = React.lazy(() => import('./components/SubscriptionSelector'));
const SuspendedView = React.lazy(() => import('./components/SuspendedView'));
const PostIts = React.lazy(() => import('./components/PostIts'));
const OrderSchedule = React.lazy(() => import('./components/OrderSchedule'));
const PromotionManager = React.lazy(() => import('./components/PromotionManager'));
const RestockSuggestions = React.lazy(() => import('./components/RestockSuggestions'));
const SupportChat = React.lazy(() => import('./components/SupportChat'));
const AIAssistant = React.lazy(() => import('./components/AIAssistant'));
const Appointments = React.lazy(() => import('./components/Appointments'));
const CompetitorTracker = React.lazy(() => import('./components/CompetitorTracker'));
const WorkspaceSharing = React.lazy(() => import('./components/WorkspaceSharing'));
const SpreadsheetArea = React.lazy(() => import('./components/SpreadsheetArea'));

function TabLoadingFallback() {
  return (
    <div className="w-full h-80 flex flex-col items-center justify-center gap-3 text-neutral-400 animate-pulse">
      <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
      <span className="text-xs font-semibold tracking-wide uppercase text-neutral-400">Carregando módulo...</span>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, isAdmin } = useUser();
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  // Test connection to Firestore
  React.useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError("E-mail ou senha inválidos. Verifique suas credenciais.");
      } else {
        setAuthError("Erro ao tentar entrar. Tente novamente.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Carregando Express Tools...</p>
        </div>
      </div>
    );
  }

  // Check for suspended status
  if (user && profile?.status === 'suspended') {
    return <SuspendedView />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <Card className="max-w-md w-full shadow-xl border-none">
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Store className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black tracking-tight">Express Tools Hub</CardTitle>
              <p className="text-muted-foreground text-sm">A central de ferramentas definitiva para o seu negócio.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="E-mail profissional"
                      className="pl-10 h-11 border-neutral-200 focus-visible:ring-neutral-900"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Sua senha"
                      className="pl-10 h-11 border-neutral-200 focus-visible:ring-neutral-900"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={async () => {
                        if (!email) {
                          setAuthError("Digite seu e-mail para recuperar a senha.");
                          return;
                        }
                        try {
                          await sendPasswordResetEmail(auth, email);
                          setAuthError("E-mail de recuperação enviado para " + email);
                        } catch (e: any) {
                          setAuthError("Erro ao enviar e-mail de recuperação.");
                        }
                      }}
                      className="text-[10px] font-bold text-neutral-400 hover:text-neutral-900 uppercase tracking-widest transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </div>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
                    authError.includes("enviado") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}
                >
                  {authError.includes("enviado") ? <CheckCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {authError}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 font-bold bg-neutral-900 hover:bg-neutral-800 transition-all rounded-xl shadow-lg shadow-neutral-900/10"
                disabled={isAuthLoading}
              >
                {isAuthLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Acessar Painel
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>
            
            <p className="text-[10px] text-center text-muted-foreground mt-6 px-8">
              Ao continuar, você concorda com nossos termos de uso e política de privacidade.
            </p>

            {/* Suporte WhatsApp */}
            <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Precisa de ajuda ou deseja assinar?</span>
              <a
                href={getWhatsAppSupportUrl("Olá! Gostaria de falar com o suporte do Express Tools para tirar dúvidas ou solicitar acesso.")}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
              >
                <Headphones className="w-4 h-4 text-emerald-600" />
                <span>Falar com Suporte no WhatsApp ({SUPPORT_PHONE_FORMATTED})</span>
                <ExternalLink className="w-3 h-3 ml-1 text-emerald-600 opacity-80" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'postits': return <PostIts />;
      case 'spreadsheets': return <SpreadsheetArea />;
      case 'orders': return <OrderSchedule />;
      case 'promotions': return <PromotionManager />;
      case 'restock': return <RestockSuggestions />;
      case 'ai_assistant': return <AIAssistant />;
      case 'appointments': return <Appointments />;
      case 'competitors': return <CompetitorTracker />;
      case 'sharing': return <WorkspaceSharing />;
      case 'chat': return <SupportChat />;
      case 'admin': return <AdminPanel />;
      case 'subscription': return <SubscriptionSelector currentProfile={profile} />;
      default: return <Dashboard />;
    }
  };

  return (
    <PlanLimitProvider onNavigateToPlans={() => setActiveTab('subscription')}>
      <WorkspaceProvider>
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={logout}>
          <React.Suspense fallback={<TabLoadingFallback />}>
            {renderContent()}
          </React.Suspense>
        </Layout>
        <PlanLimitModal onNavigateToPlans={() => setActiveTab('subscription')} />
      </WorkspaceProvider>
    </PlanLimitProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
