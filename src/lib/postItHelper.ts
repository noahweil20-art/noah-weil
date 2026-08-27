import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export interface CreatePostItParams {
  workspaceId: string;
  title: string;
  content: string;
  type?: 'order' | 'appointment' | 'promotion' | 'custom';
  color?: string;
}

const TYPE_COLORS: Record<string, string> = {
  order: 'bg-blue-100 border-blue-200',
  appointment: 'bg-green-100 border-green-200',
  promotion: 'bg-pink-100 border-pink-200',
  custom: 'bg-yellow-100 border-yellow-200',
};

export async function createPostItNote(params: CreatePostItParams): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !params.workspaceId) return false;

  const color = params.color || (params.type ? TYPE_COLORS[params.type] : 'bg-yellow-100 border-yellow-200');

  try {
    await addDoc(collection(db, 'postits'), {
      content: params.content,
      color: color,
      createdAt: serverTimestamp(),
      userId: user.uid,
      ownerId: user.uid,
      workspaceId: params.workspaceId,
      x: Math.random() * 350 + 50,
      y: Math.random() * 250 + 50,
    });
    return true;
  } catch (error) {
    console.error('Erro ao criar post-it:', error);
    handleFirestoreError(error, OperationType.CREATE, 'postits');
    return false;
  }
}
