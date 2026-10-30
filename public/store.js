// Data layer: Firebase anonymous sign-in + Firestore, with offline cache.
// Each family list lives at lists/{listId}/items/{itemId}. The listId is a long random
// code carried in the invite link, so only people who received the link can reach the list.
//
// Adding Google sign-in later: call linkWithPopup(auth.currentUser, new GoogleAuthProvider()).
// The anonymous account is upgraded in place, so the same person keeps the same uid and nothing
// in the stored data has to change.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export function isConfigured() {
  return firebaseConfig && firebaseConfig.projectId && firebaseConfig.projectId !== "PASTE_HERE";
}

let db, auth;

export async function init() {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    // Keeps the list readable and editable without signal (supermarket basements); syncs when back online.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, u => { if (u) { stop(); resolve(u); } });
    signInAnonymously(auth).catch(err => { stop(); reject(err); });
  });
  return { uid: user.uid };
}

const items = listId => collection(db, "lists", listId, "items");

export function subscribe(listId, onItems, onError) {
  return onSnapshot(query(items(listId), orderBy("createdAt")), { includeMetadataChanges: true },
    snap => onItems(snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata),
    onError);
}
export const addItem = (listId, data) => addDoc(items(listId), data);
export const updateItem = (listId, id, patch) => updateDoc(doc(items(listId), id), patch);
export const removeItem = (listId, id) => deleteDoc(doc(items(listId), id));
export async function removeMany(listId, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(db);
    ids.slice(i, i + 400).forEach(id => b.delete(doc(items(listId), id)));
    await b.commit();
  }
}
