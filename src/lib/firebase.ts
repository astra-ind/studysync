import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, query, where, setDoc } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

// Initialize Firebase (safely avoid re-initializing)
const app = getApps().length === 0 ? initializeApp(config) : getApp();
export const db = getFirestore(app);

export { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, query, where, setDoc };
