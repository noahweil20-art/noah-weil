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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        // Authoritative server-side profile sync
        try {
          const syncRes = await fetch('/api/user/sync-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName
            })
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.profile) setProfile(syncData.profile);
            if (syncData.plan) setPlan(syncData.plan);
          }
        } catch (syncErr) {
          console.warn('[USER SYNC] Backend profile sync fallback to Firestore listener:', syncErr);
        }

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

            // Fetch authoritative plan from backend API
            try {
              const planRes = await fetch(`/api/plans/${profileData.planId || 'base'}`);
              if (planRes.ok) {
                const planData = await planRes.json();
                if (planData && planData.permissions) {
                  if (profileData.customPermissions) {
                    planData.permissions = {
                      ...planData.permissions,
                      ...profileData.customPermissions
                    };
                  }
                  if (profileData.erpExpressEnabled !== undefined) {
                    planData.permissions.erpExpressEnabled = profileData.erpExpressEnabled;
                    if (profileData.erpExpressEnabled) {
                      planData.permissions.externalRestockIntegration = 'pro';
                    } else if (profileData.planId === 'base') {
                      planData.permissions.externalRestockIntegration = 'none';
                    }
                  }
                }
                setPlan(planData);
              }
            } catch (err) {
              console.error("Error fetching plan from backend:", err);
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
