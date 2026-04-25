"use client";

import React, { useState, useEffect } from "react";
import { Shell } from "@/components/Shell";
import {
  ShieldCheck,
  Users,
  Database,
  Activity,
  ChevronRight,
  FileLock2,
  Settings,
  UserCheck,
  FileUp,
  Trash2,
  Lock,
  UserCog,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

const adminModules = [
  { name: "Employee Induction", desc: "Audit and authorize new personnel", icon: UserCheck, count: 0, path: "/admin/employee-approvals" },
  { name: "User Management", desc: "Manage roles and access levels", icon: Users, count: 124, path: "/admin/users" },
  { name: "Bulk Data Induction", desc: "CSV mass upload for HR & Masters", icon: FileUp, path: "/admin/bulk-upload" },
  { name: "System Settings", desc: "Configure global parameters", icon: Settings, path: "/admin/settings" },
  { name: "Payroll Governance", desc: "Define calculation rates and processing logic", icon: FileLock2, path: "/admin/payroll-rules" },
  { name: "Workflow Config", desc: "Module approval hierarchies", icon: ShieldCheck, path: "/admin/workflow" },
  { name: "Registry Grid Permissions", desc: "Manage edit access in grid views", icon: Database, path: "/admin/grid-permissions" },
  { name: "Company Setup", desc: "Configure company profile and legal entities", icon: Building2, path: "/admin/company" }, // Added Company Setup
  { name: "Clear Monthly Variable Data", desc: "Permanently reset monthly adjustments by fiscal period", icon: Trash2, path: "/admin/clear-data", danger: true },
];

export default function AdminPage() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const q = query(collection(db, "employees"), where("status", "==", "Pending Approval"));
    const unsub = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    });
    return unsub;
  }, []);

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Control Center
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Administrative Control
            </h1>
            <p className="text-slate-500 text-lg font-medium">Configure enterprise protocols and secure registry dynamics.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM INTEGRITY: OPTIMAL
          </div>
        </div>

        {/* Dashboard Stat Quick View */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Active Admins", value: "4", icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Roles", value: "8", icon: Lock, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Total Sessions", value: "12", icon: UserCog, color: "text-violet-600", bg: "bg-violet-50" },
            { label: "System Health", value: "99.9%", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 flex items-center justify-between group overflow-hidden relative border-slate-200">
              <div className="relative z-10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1.5">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
              <div className={cn("p-3 rounded-2xl transition-all duration-500 group-hover:scale-110", stat.bg, stat.color)}>
                <stat.icon size={22} />
              </div>
            </div>
          ))}
        </div>

        {/* Module Configuration Header & Period Selector */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Module Command Center</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configure & Manage Registry Lifecycles</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-2 bg-slate-50 rounded-3xl border border-slate-100">
             <div className="flex items-center gap-2 px-4 py-2">
                <Database size={16} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Period:</span>
             </div>
             <select 
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
               className="bg-white border border-slate-200 text-xs font-black text-[#014A6E] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 uppercase tracking-widest"
             >
               {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
             </select>
             <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(parseInt(e.target.value))}
               className="bg-white border border-slate-200 text-xs font-black text-[#014A6E] rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 uppercase tracking-widest"
             >
               {years.map((y) => <option key={y} value={y}>{y}</option>)}
             </select>
          </div>
        </div>

        {/* Admin Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.map((mod) => (
            <button
              key={mod.name}
              onClick={() => {
                const path = mod.name === "Clear Monthly Variable Data" 
                  ? `${mod.path}?month=${selectedMonth}&year=${selectedYear}`
                  : mod.path;
                router.push(path);
              }}
              className={cn(
                "glass-panel p-8 text-left group transition-all duration-500 relative border-slate-200",
                (mod as any).danger
                  ? "bg-red-50/30 hover:bg-red-50 hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5"
                  : "bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5"
              )}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={cn(
                  "w-14 h-14 rounded-2xl bg-white border flex items-center justify-center transition-all duration-500",
                  (mod as any).danger
                    ? "border-red-100 text-red-300 group-hover:text-red-600 group-hover:border-red-200"
                    : "border-slate-200 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200"
                )}>
                  <mod.icon size={24} />
                </div>
                {(mod.count || (mod.name === "Employee Induction" && pendingCount > 0)) && (
                  <span className={cn(
                    "px-3 py-1 rounded-full border text-[10px] font-black",
                    mod.name === "Employee Induction" ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-blue-50 border-blue-100 text-blue-600"
                  )}>
                    {mod.name === "Employee Induction" ? pendingCount : mod.count} ACTIVE
                  </span>
                )}
                {(mod as any).danger && (
                  <span className="px-3 py-1 rounded-full bg-red-50 border border-red-100 text-[10px] font-black text-red-500">
                    ADMIN ONLY
                  </span>
                )}
              </div>
              <h3 className={cn(
                "text-lg font-bold text-slate-900 group-hover:translate-x-1 transition-all duration-500",
                (mod as any).danger && "group-hover:text-red-700"
              )}>{mod.name}</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{mod.desc}</p>

              {(mod as any).danger && (
                <p className="mt-3 text-[10px] font-black uppercase text-red-600 flex items-center gap-2">
                   <Database size={12} /> Targeting: {months[selectedMonth]} {selectedYear}
                </p>
              )}

              <div className={cn(
                "mt-8 pt-6 border-t border-slate-100 flex items-center justify-between transition-all duration-500",
                (mod as any).danger ? "group-hover:border-red-100" : "group-hover:border-blue-100"
              )}>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors",
                  (mod as any).danger ? "group-hover:text-red-600" : "group-hover:text-blue-600"
                )}>Access Module</span>
                <ChevronRight size={14} className={cn(
                  "text-slate-300 group-hover:translate-x-1 transition-all",
                  (mod as any).danger ? "group-hover:text-red-600" : "group-hover:text-blue-600"
                )} />
              </div>
            </button>
          ))}
        </div>

        {/* Audit Log Preview */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200">
                <Database size={18} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Recent System Logs</h2>
            </div>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
              View Detailed Audit
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {[
              { user: "Admin User", action: "Updated Payroll Rule [TAX-2024]", time: "14 mins ago", color: "bg-blue-500" },
              { user: "System", action: "Backup Cycle Completed", time: "2 hours ago", color: "bg-emerald-500" },
              { user: "Data Entry", action: "Registered Employee [EMP-9402]", time: "5 hours ago", color: "bg-indigo-500" },
            ].map((log, i) => (
              <div key={i} className="flex items-center justify-between p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center gap-5">
                  <div className={cn("w-1 h-6 rounded-full group-hover:h-8 transition-all duration-500", log.color)} />
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{log.action}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{log.user}</p>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  {log.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

