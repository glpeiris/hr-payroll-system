"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

interface UserProfile {
  fullName: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: any;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Auth: Initializing onAuthStateChanged...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log("Auth: User detected:", firebaseUser.uid);
          setUser(firebaseUser);
          
          // Fetch profile
          console.log("Auth: Fetching user profile from Firestore...");
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            console.log("Auth: Profile found.");
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            console.log("Auth: Profile NOT found, creating default admin profile.");
            const defaultProfile = {
              fullName: firebaseUser.displayName || "Admin User",
              email: firebaseUser.email || "",
              role: "Master Admin",
              status: "Active",
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, "users", firebaseUser.uid), defaultProfile);
            setUserProfile(defaultProfile as UserProfile);
          }
        } else {
          console.log("Auth: No user detected.");
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Auth: Error in onAuthStateChanged callback:", error);
      } finally {
        console.log("Auth: Setting loading to false.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
