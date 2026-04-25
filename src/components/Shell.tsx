"use client";

import React, { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SplashScreen } from "./SplashScreen";

export function Shell({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userProfile) {
      router.replace("/login");
    }
  }, [userProfile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#014A6E] flex flex-col items-center justify-center space-y-6">
        <SplashScreen />
        <div className="relative">
          <Loader2 className="w-16 h-16 text-[#8AC53E] animate-spin" />
        </div>
      </div>
    );
  }

  if (!userProfile) return null;

  if (userProfile.status === "Pending") {
    return (
      <div className="min-h-screen bg-[#014A6E] flex items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8AC53E]/10 rounded-full blur-[120px]" />
        
        <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl rounded-[48px] p-12 border border-white/20 shadow-[0_32px_80px_rgba(0,0,0,0.5)] space-y-10 animate-in zoom-in-95 duration-500 relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-[#014A6E] flex items-center justify-center mx-auto shadow-2xl relative group">
            <div className="absolute inset-0 bg-[#8AC53E]/20 blur-xl group-hover:blur-2xl transition-all" />
            <Loader2 className="w-10 h-10 text-[#8AC53E] animate-spin relative z-10" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-[#014A6E] tracking-tight uppercase italic">Security <span className="text-[#8AC53E]">Checkpoint</span></h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              Identity logged. Registry status is currently <span className="text-[#8AC53E] font-black underline underline-offset-4 decoration-2">Pending Validation</span>. Access will be granted following administrative induction.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registry ID</p>
              <p className="text-xs font-bold text-[#014A6E] truncate">{userProfile.email.split('@')[0]}</p>
            </div>
            <div className="p-4 rounded-3xl bg-lime-50 border border-lime-100 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-lime-600">Protocol</p>
              <p className="text-xs font-black text-lime-700 uppercase">Awaiting Authorization</p>
            </div>
          </div>

          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-[24px] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-[10px] font-black uppercase tracking-[0.2em] border border-transparent hover:border-red-100 active:scale-95"
          >
            Abort Protocol & Log Out
          </button>
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-white/10 text-[9px] font-black tracking-[0.5em] uppercase">
          Proprietary GSOFT Engine • High Fidelity Data Layer
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-background text-foreground min-h-screen">
      <div className="no-print">
        <Sidebar  />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="no-print">
          <Header />
        </div>
        <main className="flex-1 p-6 lg:p-10 overflow-x-hidden print:p-0">
          <SplashScreen />
          {children}
        </main>
      </div>
    </div>
  );
}
