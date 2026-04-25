"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const menuItems = [
  { name: "Dashboard",            icon: LayoutDashboard, path: "/" },
  { name: "Master Records",       icon: Building2,       path: "/masters" },
  { name: "Registration Information", icon: UserPlus,    path: "/registration" },
  { name: "Human Resource",       icon: Users,           path: "/hr" },
  { name: "Payroll",              icon: CreditCard,      path: "/payroll" },
  { name: "Reports",              icon: BarChart3,       path: "/reports" },
  { name: "Admin Panel",          icon: Settings,        path: "/admin" },
];

import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { userProfile } = useAuth();

  const handleLogout = async () => {
    try {
      // Clear branding session states before signing out
      const keysToRemove = Object.keys(sessionStorage).filter(key => key.startsWith("splash_shown_"));
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="w-80 h-screen sticky top-0 p-5 flex-shrink-0 bg-[#013550] border-r border-white/5 selection:bg-lime-200">
      <div className="h-full flex flex-col bg-[#014A6E] rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative">
        
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

        {/* Logo Section */}
        <div className="relative flex flex-col gap-2 px-10 py-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#8AC53E] flex items-center justify-center shadow-lg shadow-lime-900/20 rotate-3 group-hover:rotate-0 transition-transform">
              <Building2 className="text-[#014A6E] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter leading-none italic uppercase">
                GSOFT <span className="text-[#8AC53E]">PRO</span>
              </h1>
              <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.4em] mt-2 ml-0.5">Unified HR Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation Core */}
        <div className="relative flex-1 px-5 space-y-10 overflow-y-auto custom-scrollbar no-scrollbar">
          
          <div className="space-y-4">
            <p className="px-5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Operational Modules</p>
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative",
                      isActive 
                        ? "bg-white/10 text-white shadow-inner" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon
                      size={20}
                      className={cn(
                        "transition-all duration-300",
                        isActive ? "text-[#8AC53E] scale-110 drop-shadow-[0_0_8px_rgba(138,197,62,0.4)]" : "group-hover:text-[#8AC53E]/60"
                      )}
                    />
                    <span className={cn("text-sm font-bold tracking-tight", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                      {item.name}
                    </span>
                    
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8AC53E] shadow-[0_0_12px_#8AC53E]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* System Terminal Profile */}
        <div className="relative p-5 mt-auto">
          <div className="p-5 bg-black/20 rounded-[32px] border border-white/5 space-y-5 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#013550] border border-white/10 shadow-inner flex items-center justify-center font-black text-[#8AC53E] text-sm overflow-hidden ring-4 ring-white/5">
                {userProfile ? getInitials(userProfile.fullName) : "AD"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black text-white truncate tracking-tight uppercase">
                  {userProfile?.fullName || "Operator"}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500/80 font-black uppercase tracking-widest">
                    {userProfile?.role || "Console"}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all text-[10px] font-black uppercase tracking-widest border border-white/5 hover:border-red-400/20 active:scale-95"
            >
              <LogOut size={16} />
              <span>Terminate Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
