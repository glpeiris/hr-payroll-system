"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function SplashScreen() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;
    
    // Per-session splash shown check
    const splashShown = sessionStorage.getItem("splash_shown_" + user.uid);
    if (splashShown) return;

    setShow(true);

    const initializeSystem = async () => {
      try {
        // Step 1: Fetch Employer Branding as requested
        const docRef = doc(db, "system", "company");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompany(docSnap.data());
        }

        // Step 2: Ensure minimum display duration (2.5s) for branding perception
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Wait for userProfile data to be actually present before clearing splash
        if (!userProfile) {
           // Wait a bit more if needed
           await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 3: Fade out and persist session state
        setFadeOut(true);
        setTimeout(() => {
          setShow(false);
          sessionStorage.setItem("splash_shown_" + user.uid, "true");
        }, 800);
      } catch (error) {
        console.error("Flash Screen Sequence Interrupt:", error);
        setShow(false);
      }
    };

    initializeSystem();
  }, [user, authLoading, userProfile]);

  if (!show) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-in-out",
      fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
    )}>
      <div className="max-w-xl w-full p-10 text-center space-y-12 animate-in zoom-in-95 duration-700">
        
        {/* Step 2 Feature: Employer Branding (Logo & Identity) */}
        <div className="relative inline-block">
          <div className="w-48 h-48 bg-white rounded-[40px] shadow-2xl shadow-blue-100 flex items-center justify-center p-8 border border-slate-50 relative z-10">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-slate-100 rounded-3xl flex items-center justify-center">
                <span className="text-4xl font-black text-slate-300 italic">{company?.name?.charAt(0) || "U"}</span>
              </div>
            )}
          </div>
          {/* Animated decorative ring */}
          <div className="absolute inset-0 -m-4 border-2 border-blue-500/10 rounded-[50px] animate-[spin_12s_linear_infinite]" />
        </div>

        {/* Employer Attributes */}
        <div className="space-y-5">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase leading-tight">
            {company?.name || "System Verification"}
          </h2>
          
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-12 bg-[#8AC53E] rounded-full" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">
              Authorized Environment
            </p>
            <div className="h-[2px] w-12 bg-[#8AC53E] rounded-full" />
          </div>

          <div className="pt-4 flex flex-col items-center gap-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed max-w-[280px]">
              {company?.address || "Loading Master Identity Registry..."}
            </p>
            {company?.phone1 && (
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{company.phone1} • {company.email}</p>
            )}
          </div>
        </div>

        {/* Unified Sync Loader */}
        <div className="flex flex-col items-center gap-4 mt-8">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">Synchronizing Registered Protocols...</p>
        </div>
      </div>
      
      {/* Visual Depth Accents */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-blue-50/40 to-transparent -z-10 blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-emerald-50/40 to-transparent -z-10 blur-3xl opacity-50" />
    </div>
  );
}
