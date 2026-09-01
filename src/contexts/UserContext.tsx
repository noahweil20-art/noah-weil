import * as React from 'react';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { UserProfile, Plan } from '@/types';

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  plan: Plan | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperUser: boolean;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export const FALLBACK_PLANS: Record<string, Plan> = {
  base: {
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
      whiteboardEnabled: true,
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
  intermediate: {
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
      whiteboardEnabled: true,
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
  pro: {
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
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [firestorePlans, setFirestorePlans] = React.useState<Record<string, Plan>>({});
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Helper to compute effective plan based on profile + firestore plans + custom overrides
  const computeEffectivePlan = React.useCallback((currentProfile: UserProfile | null, allPlans: Record<string, Plan>): Plan => {
    const planId = currentProfile?.planId || 'base';
    const basePlan = allPlans[planId] || FALLBACK_PLANS[planId] || FALLBACK_PLANS.base;
    
    // Deep clone permissions
    const effectivePermissions = { ...basePlan.permissions };

    // Apply customPermissions override if defined on the profile
    if (currentProfile?.customPermissions) {
      Object.assign(effectivePermissions, currentProfile.customPermissions);
    }

    // Apply erpExpressEnabled override
    if (currentProfile?.erpExpressEnabled !== undefined) {
      effectivePermissions.erpExpressEnabled = currentProfile.erpExpressEnabled;
      if (currentProfile.erpExpressEnabled) {
        effectivePermissions.externalRestockIntegration = 'pro';
      } else if (planId === 'base' && !currentProfile.customPermissions?.externalRestockIntegration) {
        effectivePermissions.externalRestockIntegration = 'none';
      }
    }

    return {
      ...basePlan,
      permissions: effectivePermissions
    };
  }, []);

  // Listen to Firestore Plans in real time
  React.useEffect(() => {
    const plansCol = collection(db, 'plans');
    const unsubPlans = onSnapshot(plansCol, (snapshot) => {
      if (!snapshot.empty) {
        const plansMap: Record<string, Plan> = {};
        snapshot.docs.forEach(docSnap => {
          plansMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Plan;
        });
        setFirestorePlans(plansMap);
      }
    }, (err) => {
      console.warn('Could not listen to Firestore plans collection, using fallbacks:', err);
    });

    return () => unsubPlans();
  }, []);

  // Re-compute active plan whenever profile or firestorePlans change
  React.useEffect(() => {
    if (profile) {
      const resolved = computeEffectivePlan(profile, firestorePlans);
      setPlan(resolved);
    } else {
      setPlan(FALLBACK_PLANS.base);
    }
  }, [profile, firestorePlans, computeEffectivePlan]);

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        // Realtime Firestore profile listener for reactive updates
        const userRef = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
            setProfile(profileData);
            
            // Force admin promotion for the owner email
            if (u.email?.toLowerCase() === 'noahweil20@gmail.com' && profileData.role !== 'admin') {
              updateDoc(userRef, { role: 'admin' }).catch(console.error);
            }
          } else {
            // Check if there's a manually created profile with this email or create new
            try {
              const isSuper = u.email?.toLowerCase() === 'noahweil20@gmail.com';
              const q = query(
                collection(db, 'users'), 
                where('email', '==', u.email?.toLowerCase()),
                limit(1)
              );
              const querySnap = await getDocs(q);

              if (!querySnap.empty) {
                const manualDoc = querySnap.docs[0];
                const manualData = manualDoc.data();
                
                if (manualDoc.id.startsWith('manual_')) {
                  await setDoc(userRef, {
                    ...manualData,
                    uid: u.uid,
                    role: isSuper ? 'admin' : (manualData.role || 'user'),
                    updatedAt: serverTimestamp()
                  });
                  await deleteDoc(manualDoc.ref);
                } else {
                  await setDoc(userRef, {
                    uid: u.uid,
                    displayName: u.displayName || 'Usuário',
                    email: u.email?.toLowerCase() || null,
                    role: isSuper ? 'admin' : 'user',
                    status: 'active',
                    planId: 'base',
                    createdAt: serverTimestamp()
                  });
                }
              } else {
                const newProfile: any = {
                  uid: u.uid,
                  displayName: u.displayName || 'Usuário',
                  email: u.email?.toLowerCase() || null,
                  role: isSuper ? 'admin' : 'user',
                  status: 'active',
                  planId: 'base',
                  createdAt: serverTimestamp()
                };
                await setDoc(userRef, newProfile);
              }
            } catch (err) {
              console.error("Error during profile lookup/creation:", err);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to profile:", error);
          import('@/lib/firebase').then(({ handleFirestoreError, OperationType }) => {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          });
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setPlan(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isSuperUser = user?.email?.toLowerCase() === 'noahweil20@gmail.com';

  return (
    <UserContext.Provider value={{ user, profile, plan, loading, isAdmin, isSuperUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
