import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBhZkq-eiqdQP5ZWv8k3cO7PgqVcW_regs", // Placeholder, will be configured by User/Admin
  authDomain: "gshrpayroll.firebaseapp.com",
  projectId: "gshrpayroll",
  storageBucket: "gshrpayroll.firebasestorage.app",
  messagingSenderId: "524579315277",
  appId: "1:524579315277:web:8e8ca3ec0eec20ebe5c604"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
