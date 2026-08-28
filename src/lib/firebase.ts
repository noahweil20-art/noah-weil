import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile };
export const logout = () => signOut(auth);

/**
 * Creates a new user directly in Firebase Auth and Firestore using a secondary Firebase App.
 * This guarantees the currently logged-in Admin is NEVER logged out, and works seamlessly
 * on serverless / static hosting platforms like Vercel where the custom backend server is not running.
 */
export async function createSecondaryUser(params: {
  email: string;
  password: string;
  displayName: string;
  role: 'user' | 'admin';
  planId: 'base' | 'intermediate' | 'pro';
  erpExpressEnabled: boolean;
}) {
  const secondaryAppName = `SecondaryAuth_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, params.email, params.password);
    const createdUser = cred.user;

    if (params.displayName) {
      await updateProfile(createdUser, { displayName: params.displayName });
    }

    // Save profile to Firestore
    await setDoc(doc(db, 'users', createdUser.uid), {
      uid: createdUser.uid,
      email: params.email.toLowerCase(),
      displayName: params.displayName || 'Novo Usuário',
      role: params.role || 'user',
      planId: params.planId || 'base',
      erpExpressEnabled: params.erpExpressEnabled,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return createdUser;
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (_) {}
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Detection for missing indexes
  if (errorMessage.includes('FAILED_PRECONDITION') && errorMessage.includes('index')) {
    const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
    const indexUrl = urlMatch ? urlMatch[0] : null;
    
    alert(`Erro de Banco de Dados: Um índice composto é necessário para esta consulta. ${indexUrl ? 'Crie o índice aqui: ' + indexUrl : 'Consulte o administrador.'}`);
  } else if (errorMessage.includes('permission-denied')) {
    alert('Acesso negado: Você não tem permissão para esta operação.');
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
