import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

let adminApp: admin.app.App;
if (!admin.apps.length) {
  console.log('[FIREBASE ADMIN] Initializing...');
  try {
    // Check if we have the config available
    if (firebaseConfig.projectId) {
      adminApp = admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('[FIREBASE ADMIN] Initialized with config projectId:', firebaseConfig.projectId);
    } else {
      adminApp = admin.initializeApp();
      console.log('[FIREBASE ADMIN] Initialized with default credentials');
    }
  } catch (e) {
    console.error('[FIREBASE ADMIN] Initialization failed:', e);
    // Final fallback
    adminApp = admin.initializeApp();
  }
} else {
  adminApp = admin.app();
}

// Explicitly use the database ID from config if available
const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

const adminDb = getFirestore(adminApp, dbId);
console.log('[FIREBASE ADMIN] Status:', {
  projectId: adminApp.options.projectId || firebaseConfig.projectId,
  databaseId: dbId || '(default)',
  appName: adminApp.name
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

// Authoritative server-side deletion endpoint with fallback
app.post('/api/delete-doc', async (req, res) => {
  try {
    const { collection, id } = req.body;
    if (!collection || !id) {
      return res.status(400).json({ error: 'Collection and document ID are required' });
    }
    const allowed = [
      'spreadsheets',
      'postits',
      'promotions',
      'orders',
      'appointments',
      'products',
      'competitors',
      'messages',
      'whiteboard_lines',
      'workspaces',
      'users'
    ];
    if (!allowed.includes(collection)) {
      return res.status(403).json({ error: `Deletion not permitted for collection: ${collection}` });
    }
    console.log(`[SERVER DELETE] Deleting document: ${collection}/${id}`);
    await adminDb.collection(collection).doc(id).delete();
    return res.json({ success: true, collection, id });
  } catch (error: any) {
    console.error('[SERVER DELETE] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during deletion' });
  }
});

// Google OAuth URL
app.get('/api/auth/google/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

// OAuth Callback
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                tokens: ${JSON.stringify(tokens)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação bem-sucedida! Fechando janela...</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).send('Authentication failed');
  }
});

// Google Calendar Proxy Endpoints
app.post('/api/calendar/events', async (req, res) => {
  const { tokens, event } = req.body;
  if (!tokens) return res.status(401).send('Unauthorized');

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    res.json(response.data);
  } catch (error) {
    console.error('Calendar Error:', error);
    res.status(500).json(error);
  }
});

app.put('/api/calendar/events/:eventId', async (req, res) => {
  const { tokens, event } = req.body;
  const { eventId } = req.params;
  if (!tokens) return res.status(401).send('Unauthorized');

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });
    res.json(response.data);
  } catch (error) {
    console.error('Calendar Error:', error);
    res.status(500).json(error);
  }
});

app.delete('/api/calendar/events/:eventId', async (req, res) => {
  const { tokens } = req.body;
  const { eventId } = req.params;
  if (!tokens) return res.status(401).send('Unauthorized');

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    res.status(204).send();
  } catch (error) {
    console.error('Calendar Error:', error);
    res.status(500).json(error);
  }
});

// User Management - Password Update
app.post('/api/admin/update-password', async (req, res) => {
  const { uid, newPassword, adminToken } = req.body;
  
  if (!uid || !newPassword || !adminToken) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const authManager = admin.auth(adminApp);
    console.log('[ADMIN] Verifying token...');
    const decodedToken = await authManager.verifyIdToken(adminToken);
    console.log('[ADMIN] Token verified for:', decodedToken.email);
    
    const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
    const userDoc = await userDocRef.get();
    const userData = userDoc.data();
    
    const isSuper = decodedToken.email?.toLowerCase() === 'noahweil20@gmail.com';
    const isAdmin = userData?.role === 'admin';

    if (!isSuper && !isAdmin) {
      console.warn('[ADMIN] Unauthorized access attempt by:', decodedToken.email);
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    console.log('[ADMIN] Updating password for UID:', uid);
    await authManager.updateUser(uid, {
      password: newPassword
    });

    res.json({ success: true, message: 'Senha atualizada com sucesso' });
  } catch (error: any) {
    console.error('Admin API ERROR details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    res.status(500).json({ error: `Admin API Error: ${error.message}` });
  }
});

// User Management - Create User
app.post('/api/admin/create-user', async (req, res) => {
  const { email, password, displayName, role, planId, erpExpressEnabled, adminToken } = req.body;
  
  if (!email || !password || !adminToken) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const authManager = admin.auth(adminApp);
    console.log('[ADMIN CREATE] Verifying token...');
    const decodedToken = await authManager.verifyIdToken(adminToken);
    
    const requesterDocRef = adminDb.collection('users').doc(decodedToken.uid);
    const requesterDoc = await requesterDocRef.get();
    const requesterData = requesterDoc.data();
    
    const isSuper = decodedToken.email?.toLowerCase() === 'noahweil20@gmail.com';
    const isAdmin = requesterData?.role === 'admin';

    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // 1. Create Auth User
    console.log('[ADMIN CREATE] Creating Auth user for:', email);
    const userRecord = await authManager.createUser({
      email: email.toLowerCase(),
      password,
      displayName: displayName || 'Usuário',
    });

    // 2. Create Firestore Profile
    console.log('[ADMIN CREATE] Creating Firestore profile for UID:', userRecord.uid);
    try {
      await adminDb.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: email.toLowerCase(),
        displayName: displayName || 'Usuário',
        role: role || 'user',
        planId: planId || 'base',
        erpExpressEnabled: erpExpressEnabled !== undefined ? erpExpressEnabled : (planId !== 'base'),
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[ADMIN CREATE] Success');
    } catch (firestoreError: any) {
      console.error('[ADMIN CREATE] Firestore Error:', firestoreError);
      await authManager.deleteUser(userRecord.uid);
      throw firestoreError;
    }

    res.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error('Admin Create User ERROR details:', error);
    res.status(500).json({ error: `Admin Create User Error: ${error.message}` });
  }
});

// System Configuration & Support Info
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'Express Tools Hub',
    version: '1.0.0',
    support: {
      phone: '41 996679075',
      formattedPhone: '(41) 99667-9075',
      whatsappNumber: '5541996679075',
      defaultMessage: 'Olá! Gostaria de falar com o suporte do Express Tools.',
      whatsappUrl: 'https://wa.me/5541996679075?text=' + encodeURIComponent('Olá! Gostaria de falar com o suporte do Express Tools.')
    },
    features: {
      whiteboard: true,
      spreadsheets: true,
      aiAssistant: true,
      googleCalendar: true,
      competitorTracker: true,
      orders: true,
      inventory: true,
      promotions: true
    }
  });
});

// Plans & Pricing Catalog (Backend Source of Truth)
const DEFAULT_PLANS = [
  {
    id: 'base',
    name: 'Plano Base',
    price: 0,
    permissions: {
      maxWorkspaces: 2,
      maxMembers: 6,
      spreadsheetEnabled: true,
      spreadsheetMaxSheets: 3,
      spreadsheetMaxRows: 100,
      spreadsheetMaxColumns: 15,
      spreadsheetExportEnabled: false,
      spreadsheetImageUploadEnabled: false,
      spreadsheetAdvancedStyles: false,
      spreadsheetRealtimeCollaboration: false,
      maxPostIts: 10,
      competitorHistoryMonths: 3,
      aiAssistantEnabled: false,
      whiteboardEnabled: false,
      googleCalendarEnabled: false,
      canDeleteMessages: false,
      chatUploadEnabled: false,
      chatLinksEnabled: false,
      canExportData: false,
      advancedScheduling: false,
      externalRestockIntegration: 'none',
      erpExpressEnabled: false
    }
  },
  {
    id: 'intermediate',
    name: 'Plano Intermediário',
    price: 49.90,
    permissions: {
      maxWorkspaces: 4,
      maxMembers: 12,
      spreadsheetEnabled: true,
      spreadsheetMaxSheets: 10,
      spreadsheetMaxRows: 1000,
      spreadsheetMaxColumns: 40,
      spreadsheetExportEnabled: true,
      spreadsheetImageUploadEnabled: false,
      spreadsheetAdvancedStyles: true,
      spreadsheetRealtimeCollaboration: true,
      maxPostIts: 50,
      competitorHistoryMonths: 9,
      aiAssistantEnabled: true,
      whiteboardEnabled: false,
      googleCalendarEnabled: true,
      canDeleteMessages: false,
      chatUploadEnabled: true,
      chatLinksEnabled: true,
      canExportData: true,
      advancedScheduling: true,
      externalRestockIntegration: 'basic',
      erpExpressEnabled: true
    }
  },
  {
    id: 'pro',
    name: 'Plano Pro Master',
    price: 99.90,
    permissions: {
      maxWorkspaces: 10,
      maxMembers: 30,
      spreadsheetEnabled: true,
      spreadsheetMaxSheets: 50,
      spreadsheetMaxRows: 10000,
      spreadsheetMaxColumns: 100,
      spreadsheetExportEnabled: true,
      spreadsheetImageUploadEnabled: true,
      spreadsheetAdvancedStyles: true,
      spreadsheetRealtimeCollaboration: true,
      maxPostIts: 200,
      competitorHistoryMonths: 24,
      aiAssistantEnabled: true,
      whiteboardEnabled: true,
      googleCalendarEnabled: true,
      canDeleteMessages: true,
      chatUploadEnabled: true,
      chatLinksEnabled: true,
      canExportData: true,
      advancedScheduling: true,
      externalRestockIntegration: 'pro',
      erpExpressEnabled: true
    }
  }
];

app.get('/api/plans', (req, res) => {
  res.json(DEFAULT_PLANS);
});

app.get('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  const plan = DEFAULT_PLANS.find(p => p.id === id) || DEFAULT_PLANS[0];
  res.json(plan);
});

// Platform Assistant Guide & Knowledge Information
app.get('/api/assistant/guide', (req, res) => {
  res.json({
    platformSteps: [
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
    ],
    integrationSteps: [
      {
        id: "01",
        title: "Configuração do Chatbot",
        description: "Integre seu assistente inserindo a URL na aba de configurações."
      },
      {
        id: "02",
        title: "Permissões de Acesso",
        description: "Defina quem na equipe pode visualizar ou editar as respostas e fluxos."
      },
      {
        id: "03",
        title: "Sincronização em Tempo Real",
        description: "As mensagens e notificações são distribuídas instantaneamente pelo Firebase."
      }
    ],
    tips: [
      "Mantenha os preços da concorrência atualizados toda segunda-feira.",
      "Defina estoque mínimo com pelo menos 30% de margem de segurança para itens de alto giro.",
      "Utilize planilhas integradas para cálculo rápido de markup e comissões."
    ]
  });
});

// ERP Analytics & Backend Calculations Engine
app.post('/api/erp/calculate-stats', (req, res) => {
  try {
    const { orders = [], products = [], promotions = [] } = req.body;

    const totalSales = orders.reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
    const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
    const deliveredOrders = orders.filter((o: any) => o.status === 'delivered').length;
    const lowStock = products.filter((p: any) => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length;
    const activePromos = promotions.filter((p: any) => Boolean(p.active)).length;

    // Server-side chart calculations
    const chartData = [
      { name: 'Seg', sales: Math.round(totalSales * 0.1 * 100) / 100 },
      { name: 'Ter', sales: Math.round(totalSales * 0.15 * 100) / 100 },
      { name: 'Qua', sales: Math.round(totalSales * 0.12 * 100) / 100 },
      { name: 'Qui', sales: Math.round(totalSales * 0.2 * 100) / 100 },
      { name: 'Sex', sales: Math.round(totalSales * 0.25 * 100) / 100 },
      { name: 'Sáb', sales: Math.round(totalSales * 0.18 * 100) / 100 },
    ];

    res.json({
      stats: {
        totalSales,
        pendingOrders,
        deliveredOrders,
        lowStock,
        activePromos,
      },
      chartData,
      calculatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ERP Dashboard & Suggestions API
app.get('/api/erp/dashboard', async (req, res) => {
  const { workspaceId } = req.query;

  try {
    if (workspaceId && typeof workspaceId === 'string') {
      const [ordersSnap, productsSnap, promosSnap] = await Promise.all([
        adminDb.collection('orders').where('workspaceId', '==', workspaceId).get(),
        adminDb.collection('products').where('workspaceId', '==', workspaceId).get(),
        adminDb.collection('promotions').where('workspaceId', '==', workspaceId).get(),
      ]);

      const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const promotions = promosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const totalSales = orders.reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
      const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
      const lowStock = products.filter((p: any) => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length;
      const activePromos = promotions.filter((p: any) => Boolean(p.active)).length;

      return res.json({
        orders,
        products,
        promotions,
        stats: {
          totalSales,
          dailySales: Math.round(totalSales * 0.14 * 100) / 100,
          monthlySales: totalSales,
          pendingOrders,
          lowStock,
          activePromotions: activePromos,
        }
      });
    }

    // Default system sample data when no workspace is specified
    res.json({
      orders: [],
      products: [],
      stats: {
        totalSales: 0,
        dailySales: 0,
        monthlySales: 0,
        pendingOrders: 0,
        lowStock: 0,
        activePromotions: 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching ERP dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// User Profile Synchronization & Authoritative Role Assignment
app.post('/api/user/sync-profile', async (req, res) => {
  const { uid, email, displayName } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'Missing UID' });
  }

  const isSuper = email?.toLowerCase() === 'noahweil20@gmail.com';
  const plan = DEFAULT_PLANS[0];

  const profile = {
    uid,
    displayName: displayName || 'Usuário',
    email: email ? email.toLowerCase() : null,
    role: isSuper ? 'admin' : 'user',
    status: 'active',
    planId: 'base'
  };

  res.json({
    profile,
    plan
  });
});

// User Management - Delete User
app.post('/api/admin/delete-user', async (req, res) => {
  const { uid, adminToken } = req.body;
  
  if (!uid || !adminToken) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const authManager = admin.auth(adminApp);
    const decodedToken = await authManager.verifyIdToken(adminToken);
    
    // Authorization Check
    const requesterDocRef = adminDb.collection('users').doc(decodedToken.uid);
    const requesterDoc = await requesterDocRef.get();
    const requesterData = requesterDoc.data();
    
    const isSuper = decodedToken.email?.toLowerCase() === 'noahweil20@gmail.com';
    const isAdmin = requesterData?.role === 'admin';

    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    if (uid === decodedToken.uid) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta por este painel.' });
    }

    console.log('[ADMIN DELETE] Deleting user UID:', uid);
    
    // 1. Delete from Auth
    try {
      await authManager.deleteUser(uid);
    } catch (authError: any) {
      // If user doesn't exist in Auth anymore, we still want to clean up Firestore
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // 2. Delete Firestore Profile
    await adminDb.collection('users').doc(uid).delete();
    
    console.log('[ADMIN DELETE] User deleted successfully');
    res.json({ success: true });
  } catch (error: any) {
    console.error('Admin Delete User ERROR details:', error);
    res.status(500).json({ error: `Admin Delete User Error: ${error.message}` });
  }
});

// Vite middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
