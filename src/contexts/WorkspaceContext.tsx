import * as React from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, limit, or, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Workspace } from '@/types';
import { useUser } from './UserContext';
import { executeDelete } from '@/lib/deleteHelper';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  leaveWorkspace: (workspaceId: string) => Promise<void>;
  joinWorkspaceWithCode: (code: string) => Promise<void>;
  updateMemberRole: (workspaceId: string, targetUserId: string, newRole: 'view' | 'edit' | 'admin') => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  canCreateWorkspace: boolean;
}

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, plan, isSuperUser } = useUser();
  const userId = user?.uid;
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = React.useState<Workspace | null>(null);
  const [loading, setLoading] = React.useState(true);

  const isOwner = currentWorkspace?.ownerId === userId;
  const currentMember = currentWorkspace?.members && userId ? currentWorkspace.members[userId] : null;
  const isAdminOfWs = isSuperUser || isOwner || (currentMember && currentMember.role === 'admin');
  const canEdit = isSuperUser || isOwner || (currentMember && (currentMember.role === 'edit' || currentMember.role === 'admin'));

  const canCreateWorkspace = React.useMemo(() => {
    if (!plan) return false;
    const ownedCount = workspaces.filter(ws => ws.ownerId === userId).length;
    return ownedCount < plan.permissions.maxWorkspaces;
  }, [plan, workspaces, userId]);

  React.useEffect(() => {
    if (!userId) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    const email = user?.email?.toLowerCase();
    if (!email || !userId) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'workspaces'), 
      or(
        where('ownerId', '==', userId),
        where(`members.${userId}.role`, 'in', ['view', 'edit', 'admin'])
      )
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Workspace[];

      // Migration: Ensure owner is in members and has a joinCode
      results.forEach(ws => {
        let updates: any = {};
        if (!ws.joinCode) {
          updates.joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        if (!ws.members || !ws.members[ws.ownerId]) {
          updates[`members.${ws.ownerId}`] = { 
            role: 'admin', 
            email: user?.email || '', 
            name: user?.displayName || 'Dono' 
          };
        }
        if (Object.keys(updates).length > 0) {
          updateDoc(doc(db, 'workspaces', ws.id), updates).catch(err => console.error("Migration failed:", err));
        }
      });
      
      setWorkspaces(results);
      
      const savedId = localStorage.getItem('currentWorkspaceId');
      if (results.length > 0) {
        // If we have a currentWorkspace, find it in the new results to get the updated data
        // Otherwise use the savedId or the first one.
        const currentId = currentWorkspace?.id || savedId;
        const updatedWs = results.find(w => w.id === currentId) || results[0];
        
        setCurrentWorkspace(updatedWs);
        if (updatedWs.id !== savedId) {
          localStorage.setItem('currentWorkspaceId', updatedWs.id);
        }
      } else {
        createDefaultWorkspace(userId);
      }
      
      setLoading(false);
    }, (error) => {
      import('@/lib/firebase').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'workspaces');
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const createDefaultWorkspace = async (uid: string) => {
    const email = user?.email?.toLowerCase();
    if (!email) return;

    try {
      const q = query(collection(db, 'workspaces'), where('ownerId', '==', uid), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) return;

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'workspaces'), {
        name: `Meu Workspace`,
        ownerId: uid,
        joinCode: code,
        members: {
          [uid]: {
            role: 'admin',
            email: email,
            name: user?.displayName || 'Dono'
          }
        },
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating default workspace:", error);
    }
  };

  const createWorkspace = async (name: string) => {
    if (!userId || !canCreateWorkspace) return;
    const email = user?.email?.toLowerCase();
    if (!email) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, 'workspaces'), {
        name,
        ownerId: userId,
        joinCode: code,
        members: {
          [userId]: {
            role: 'admin',
            email: email,
            name: user?.displayName || 'Dono'
          }
        },
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating workspace:", error);
      throw error;
    }
  };

  const joinWorkspaceWithCode = async (code: string) => {
    if (!userId || !user) return;
    const q = query(collection(db, 'workspaces'), where('joinCode', '==', code.toUpperCase()), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      throw new Error("Código inválido ou workspace não encontrado.");
    }

    const wsDoc = snap.docs[0];
    const wsData = wsDoc.data() as Workspace;

    if (wsData.members && wsData.members[userId]) {
      throw new Error("Você já faz parte deste workspace.");
    }

    await updateDoc(doc(db, 'workspaces', wsDoc.id), {
      [`members.${userId}`]: {
        role: 'view',
        email: user.email,
        name: user.displayName || 'Membro'
      }
    });
  };

  const updateMemberRole = async (workspaceId: string, targetUserId: string, newRole: 'view' | 'edit' | 'admin') => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;
    
    // Only admins of the workspace can change roles
    if (ws.members[userId]?.role !== 'admin' && ws.ownerId !== userId) {
      throw new Error("Apenas administradores do workspace podem alterar cargos.");
    }

    await updateDoc(doc(db, 'workspaces', workspaceId), {
      [`members.${targetUserId}.role`]: newRole
    });
  };

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id);
  };

  const deleteWorkspace = async (workspaceId: string) => {
    if (!userId) return;
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws || (!isSuperUser && ws.ownerId !== userId)) {
      throw new Error("Apenas o dono pode excluir o workspace.");
    }

    try {
      await executeDelete('workspaces', workspaceId);
      
      if (currentWorkspace?.id === workspaceId) {
        localStorage.removeItem('currentWorkspaceId');
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      throw error;
    }
  };

  const leaveWorkspace = async (workspaceId: string) => {
    if (!userId) return;
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;
    if (ws.ownerId === userId) {
      throw new Error("O dono não pode sair do workspace. Você deve excluí-lo ou transferir a posse.");
    }

    try {
      await import('firebase/firestore').then(async ({ updateDoc, doc, deleteField }) => {
        await updateDoc(doc(db, 'workspaces', workspaceId), {
          [`members.${userId}`]: deleteField()
        });
      });
      
      if (currentWorkspace?.id === workspaceId) {
        localStorage.removeItem('currentWorkspaceId');
      }
    } catch (error) {
      console.error("Error leaving workspace:", error);
      throw error;
    }
  };

  return (
    <WorkspaceContext.Provider value={{ 
      currentWorkspace, 
      workspaces, 
      loading, 
      setCurrentWorkspace: handleSetCurrentWorkspace,
      createWorkspace,
      deleteWorkspace,
      leaveWorkspace,
      joinWorkspaceWithCode,
      updateMemberRole,
      canEdit: !!canEdit,
      isAdmin: !!isAdminOfWs,
      isOwner: !!isOwner,
      canCreateWorkspace
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
