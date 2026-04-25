"use client";

import React, { useState } from "react";
import {
  auth
} from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  UserPlus,
  LogIn
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  // Robust redirection: Handle "One-Click" flow via Auth State observation
  React.useEffect(() => {
    if (authUser && !authLoading) {
      // Force a direct transition to bypass any router-swallowed clicks
      router.replace("/");
    }
  }, [authUser, authLoading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double trigger
    
    setLoading(true);
    setError("");

    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Access keys do not match. Please verify.");
        setLoading(false);
        return;
      }
      if (!fullName || !phoneNumber) {
        setError("Please complete all profile details.");
        setLoading(false);
        return;
      }
    }

    try {
      if (isRegister) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Create Pending Profile in Firestore
        await setDoc(doc(db, "users", user.uid), {
          fullName,
          email,
          phoneNumber,
          role: "Employee", // Default role
          status: "Pending", // Awaiting Admin Approval
          createdAt: serverTimestamp(),
          isNewRegistration: true
        });

        // Trigger Telegram Notification (Bridge function)
        notifyAdminOfNewUser(fullName, email, phoneNumber);

        setIsRegister(false);
        setError("Registration submitted! Please wait for administrative approval.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // We no longer call router.push here to avoid race conditions.
        // The useEffect will handle the redirect as soon as Firebase confirms the user.
        return;
      }
    } catch (err: any) {
      console.error("Auth bug:", err);
      if (err.code === "auth/user-not-found") {
        setError("Account not found. If this is your first time, please use the Register option.");
      } else if (err.code === "auth/wrong-password") {
        setError("Invalid security code. Please check your credentials.");
      } else if (err.code === "auth/invalid-credential") {
        setError("Invalid security ID or cipher. Please verify your access credentials.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Auth provider not enabled. Please check Firebase Console.");
      } else {
        setError("Authentication failure: " + (err.message || "Unknown error"));
      }
      setLoading(false); 
    } 
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your Security ID (Email) to receive the reset link.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setError("✅ A cipher reset link has been dispatched to your email channel.");
    } catch (err: any) {
      console.error("Reset issue:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Account not found within the registry network.");
      } else {
        setError("Failed to dispatch reset link. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const notifyAdminOfNewUser = async (name: string, email: string, phone: string) => {
    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || BOT_TOKEN.includes("YOUR")) {
      console.warn("⚠️ Admin notification skipped: Bot configuration missing.");
      return;
    }

    const message = `🚨 *New User Registration*\n\n*Name:* ${name}\n*Email:* ${email}\n*Phone:* ${phone}\n\n_System is awaiting your approval._`;

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      console.error("Telegram notify failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#014A6E] flex items-center justify-center p-6 selection:bg-lime-200 selection:text-lime-900 overflow-hidden relative font-sans">
      {/* Dynamic Background Elements - Mirroring the Image Aesthetic */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Diagonal Lime Section */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[120%] bg-[#8AC53E] rotate-[35deg] shadow-[-20px_0_60px_rgba(0,0,0,0.1)]" />

        {/* Geometric Accents */}
        <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-white/[0.03] rounded-full border border-white/[0.05]" />
        <div className="absolute bottom-[20%] left-[15%] w-24 h-24 bg-lime-400/[0.1] rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-[1000px] flex flex-col md:flex-row items-center gap-12 lg:gap-20 animate-in fade-in slide-in-from-bottom-12 duration-1000">

        {/* Left Side: Branding (Petrol Blue Context) */}
        <div className="flex-1 text-white space-y-8 animate-in slide-in-from-left-8 duration-1000 delay-300">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
            <Building2 className="text-[#8AC53E]" size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Single Source of Truth</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.85] drop-shadow-2xl uppercase italic">
              GSOFT <br />
              <span className="text-[#8AC53E]">ERP</span>
            </h1>
            <p className="text-xl text-blue-100/70 font-medium leading-relaxed max-w-md pt-4">
              The ultimate high-fidelity Enterprise Resource Planning system for modern governance.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <div className="w-12 h-1 bg-[#8AC53E] rounded-full" />
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/40">Revision 2.0.26</p>
          </div>
        </div>

        {/* Right Side: Auth Card (Transition Context) */}
        <div className="w-full max-w-[440px] animate-in scale-in-95 duration-700 delay-500">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[48px] p-10 md:p-12 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.3)] border border-white/20">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-[#014A6E] shadow-xl mb-6">
                <LogIn className="text-[#8AC53E]" size={28} />
              </div>
              <h2 className="text-2xl font-black text-[#014A6E] tracking-tight">
                {isResetPassword ? "Cipher Recovery" : isRegister ? "Join System" : "Account Login"}
              </h2>
              <p className="text-sm text-slate-400 mt-2 font-medium italic">
                {isResetPassword ? "Dispatch new encryption keys via registered relay." : isRegister ? "Secure registry for enterprise personnel." : "Initialize secure session gateway."}
              </p>
            </div>

            <form onSubmit={isResetPassword ? handleResetPassword : handleAuth} className="space-y-5">
              {error && (
                <div className={cn(
                  "p-4 rounded-3xl flex items-center gap-4 animate-in shake duration-500 border-2",
                  error.includes("submitted") ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"
                )}>
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-xs font-black leading-tight uppercase tracking-wider">{error}</p>
                </div>
              )}

              {isRegister && (
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Identity Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alexander Pierce"
                      className="input-field h-14"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Contact Channel (Phone)</label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="input-field h-14"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Security ID (Email)</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#014A6E] transition-colors" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@corp.ext"
                    className="input-field pl-14 h-14"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {!isResetPassword && (
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Access Cipher</label>
                    <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#014A6E] transition-colors" size={20} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field pl-14 h-14"
                      />
                    </div>
                  </div>
                )}
                {isRegister && !isResetPassword && (
                  <div className="space-y-2 relative animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Confirm Cipher</label>
                    <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#014A6E] transition-colors" size={20} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field pl-14 h-14"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!isRegister && !isResetPassword && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPassword(true);
                      setError("");
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#014A6E] transition-colors"
                  >
                    Forgot Cipher Keys?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-16 flex items-center justify-center gap-4 text-sm uppercase tracking-[0.25em] font-black shadow-2xl active:scale-[0.98] transition-all group mt-4 overflow-hidden relative"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-6 h-6" />
                ) : (
                  <>
                    <span>{isResetPassword ? "Dispatch Protocol" : isRegister ? "Register Core" : "Initialize System"}</span>
                    <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col gap-3">
              {isResetPassword && (
                <button
                  onClick={() => {
                    setIsResetPassword(false);
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-[#014A6E] hover:text-[#8AC53E] transition-colors"
                >
                  <LogIn size={16} />
                  <span>Return to Access Gateway</span>
                </button>
              )}
              {!isResetPassword && (
                <button
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-[#014A6E] hover:text-[#8AC53E] transition-colors"
                >
                  {isRegister ? (
                    <>
                      <LogIn size={16} />
                      <span>Existing personnel? Sign In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>New personnel? Request Access</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branding Footer */}
      <div className="absolute bottom-10 left-10 md:left-20 flex items-center gap-3 text-white/30 text-[10px] font-black tracking-widest uppercase">
        <Building2 size={16} />
        <span>Proprietary GSOFT Engine © 2026</span>
      </div>
    </div>
  );
}

