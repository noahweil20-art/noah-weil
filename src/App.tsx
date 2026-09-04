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
import LandingPage from './components/LandingPage';
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
const ClientsManager = React.lazy(() => import('./components/ClientsManager'));
const ShippingQuotes = React.lazy(() => import('./components/ShippingQuotes'));
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
  const [preselectedClient, setPreselectedClient] = React.useState<any>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const handleNavigateWithData = (tab: string, data?: any) => {
    if (tab === 'appointments' && data) {
      setPreselectedClient(data);
    }
    setActiveTab(tab);
  };
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
      <LandingPage
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        handleAuth={handleAuth}
        isAuthLoading={isAuthLoading}
        authError={authError}
        setAuthError={setAuthError}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'whiteboard': return <PostIts defaultView="whiteboard" onNavigateToTab={setActiveTab} />;
      case 'postits': return <PostIts defaultView="grid" onNavigateToTab={setActiveTab} />;
      case 'spreadsheets': return <SpreadsheetArea />;
      case 'orders': return <OrderSchedule />;
      case 'promotions': return <PromotionManager />;
      case 'restock': return <RestockSuggestions />;
      case 'ai_assistant': return <AIAssistant />;
      case 'appointments': return <Appointments onNavigateToTab={handleNavigateWithData} preselectedClient={preselectedClient} />;
      case 'clients': return <ClientsManager onNavigateToTab={handleNavigateWithData} />;
      case 'shipping': return <ShippingQuotes onNavigateToTab={handleNavigateWithData} preselectedClient={preselectedClient} />;
      case 'competitors': return <CompetitorTracker />;
      case 'sharing': return <WorkspaceSharing />;
      case 'chat': return <SupportChat />;
      case 'admin': return <AdminPanel />;
      case 'subscription': return <SubscriptionSelector currentProfile={profile} onNavigateToTab={setActiveTab} />;
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
