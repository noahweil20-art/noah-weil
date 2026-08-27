import * as React from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Message } from '@/types';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function useWorkspaceMessages() {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!currentWorkspace) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  const sendMessage = async (text: string) => {
    if (!currentWorkspace || !auth.currentUser || !text.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        workspaceId: currentWorkspace.id,
        text: text.trim(),
        userId: auth.currentUser.uid,
        ownerId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Usuário',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  };

  return { messages, sendMessage, deleteMessage, loading };
}
