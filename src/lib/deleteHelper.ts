import { deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Safely executes document deletion via Firestore client SDK with automated fallback to server API.
 */
export async function executeDelete(collectionName: string, id: string): Promise<boolean> {
  console.log(`[DELETE HELPER] Executing deletion for ${collectionName}/${id}...`);
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    console.log(`[DELETE HELPER] Client SDK deletion succeeded for ${collectionName}/${id}`);
    return true;
  } catch (clientErr: any) {
    console.warn(`[DELETE HELPER] Client SDK deletion failed (${clientErr?.message}), executing server-side fallback...`);
    try {
      const res = await fetch('/api/delete-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionName, id })
      });
      if (res.ok) {
        console.log(`[DELETE HELPER] Server fallback deletion succeeded for ${collectionName}/${id}`);
        return true;
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Server deletion failed');
    } catch (serverErr) {
      console.error(`[DELETE HELPER] Server fallback also failed:`, serverErr);
      throw clientErr;
    }
  }
}
