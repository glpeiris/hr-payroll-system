"use client";

import React, { useState, useEffect } from "react";
import { Shell } from "@/components/Shell";
import { 
  UserCheck, 
  ShieldCheck, 
  XCircle, 
  Loader2, 
  Search, 
  Filter, 
  Briefcase, 
  CreditCard, 
  Info,
  Calendar,
  Building2,
  MoreVertical,
  Fingerprint,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc,
  orderBy 
} from "firebase/firestore";

interface Employee {
  id: string;
  fullName: string;
  nameWithInitials?: string;
  memberId: string;
  email: string;
  contactNo?: string;
  gender?: string;
  dob?: string;
  division: string;
  department?: string;
  designation: string;
  employeeType?: string;
  salaryScale?: string;
  grossSalary?: string | number;
  basicSalary1?: string | number;
  basicSalary2?: string | number;
  fixedAllowance1?: string | number;
  fixedAllowance2?: string | number;
  fixedAllowance3?: string | number;
  epfActive?: string;
  allowAllowance?: string;
  allowOvertime?: string;
  specialNote?: string;
  entitledLeave?: string;
  profileImage: string | null;
  jointDate: string;
  appointmentDate?: string;
  status: string;
  createdAt: any;
}

export default function EmployeeApprovalsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    // Simplified query to bypass potential index requirements while in early induction phase
    const q = query(
      collection(db, "employees"), 
      where("status", "==", "Pending Approval")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      
      // Sort in-memory for safety
      const sortedData = [...data].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setEmployees(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Induction registry fetch failure:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const notifyInductionStatus = async (employee: Employee, status: "Approved" | "Rejected") => {
    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || BOT_TOKEN.includes("YOUR")) {
      console.warn("⚠️ Telegram notification skipped: Bot configuration missing.");
      return;
    }

    const emoji = status === "Approved" ? "✅" : "⚠️";
    const title = status === "Approved" ? "Induction Authorized" : "Induction Denied";
    
    const message = `${emoji} *Employee ${title}*\n\n*Name:* ${employee.fullName}\n*EPF No:* ${employee.memberId}\n*Designation:* ${employee.designation}\n*Unit:* ${employee.division}\n\n_Status updated in the GSOFT Enterprise Registry._`;

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
      console.error("Telegram notification failed:", e);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const emp = employees.find(e => e.id === id);
    try {
      await updateDoc(doc(db, "employees", id), {
        status: "Active",
        inductionApprovedAt: new Date().toISOString(),
        registryStatus: "Verified"
      });
      
      if (emp) await notifyInductionStatus(emp, "Approved");
      
      alert("✅ Employee induction successfully authorized.");
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Approval error:", error);
      alert("❌ Critical: Authorization protocol failed.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("DENY this induction request? This will mark the registration as Rejected.")) return;
    setProcessingId(id);
    const emp = employees.find(e => e.id === id);
    try {
      await updateDoc(doc(db, "employees", id), {
        status: "Rejected",
        inductionRejectedAt: new Date().toISOString()
      });
      
      if (emp) await notifyInductionStatus(emp, "Rejected");
      
      alert("⚠️ Registry entry has been denied and archived.");
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Rejection error:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-10 pb-24">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8AC53E]">
              Governance & Compliance
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Employee <span className="text-[#014A6E] italic">Induction</span> Audit
            </h1>
            <p className="text-slate-500 text-lg font-medium">Authorise newly registered entities into the enterprise registry.</p>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 bg-[#8AC53E]/10 border border-[#8AC53E]/20 rounded-2xl">
            <UserCheck size={18} className="text-[#8AC53E]" />
            <span className="text-xs font-black text-[#014A6E] uppercase tracking-widest">{employees.length} Pending Actions</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Induction Queue */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel overflow-hidden border-slate-200">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Registry Input Queue</h3>
                <div className="flex items-center gap-2">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input type="text" placeholder="Search Filter..." className="pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-[10px] focus:ring-1 ring-[#8AC53E] outline-none" />
                   </div>
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-[#8AC53E]" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Accessing High-Fidelity Data...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto text-slate-200 border border-slate-100">
                    <ShieldCheck size={32} />
                  </div>
                  <p className="text-sm font-medium text-slate-400 italic">No pending induction requests detected in the channel.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {employees.map((emp) => (
                    <div 
                      key={emp.id} 
                      onClick={() => setSelectedEmployee(emp)}
                      className={cn(
                        "p-6 flex items-center justify-between group cursor-pointer transition-all hover:bg-slate-50/80",
                        selectedEmployee?.id === emp.id ? "bg-[#014A6E]/5 border-l-4 border-l-[#8AC53E]" : "border-l-4 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center">
                          {emp.profileImage ? (
                            <img src={emp.profileImage} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <Fingerprint className="text-slate-200" size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-base font-black text-[#014A6E] tracking-tight">{emp.fullName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-lg">{emp.memberId || "NEW-EMP"}</span>
                            <span className="text-[10px] font-bold text-slate-400">{emp.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black uppercase text-slate-400">{emp.division || "Unassigned"}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">{emp.designation || "Pending Role"}</p>
                        </div>
                        <ChevronRight className={cn("text-slate-300 transition-transform group-hover:translate-x-1", selectedEmployee?.id === emp.id && "text-[#8AC53E] translate-x-1")} size={20} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit & Action Panel */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-8 sticky top-10 border-[#014A6E]/10 bg-slate-50/30">
              {!selectedEmployee ? (
                <div className="py-20 text-center space-y-4">
                   <div className="w-20 h-20 rounded-[32px] bg-[#014A6E]/5 flex items-center justify-center mx-auto text-[#014A6E]/10">
                      <Info size={40} />
                   </div>
                   <div>
                      <h4 className="text-sm font-black text-[#014A6E] uppercase tracking-widest">Audit Terminal</h4>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium px-6 leading-relaxed italic">Select an entry from the induction queue to perform high-fidelity audit and authorization.</p>
                   </div>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
                  {/* Mini Profile */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-[40px] border-4 border-white shadow-2xl overflow-hidden bg-white">
                        {selectedEmployee.profileImage ? (
                          <img src={selectedEmployee.profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                             <Fingerprint className="text-slate-200" size={40} />
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#8AC53E] rounded-2xl border-4 border-white flex items-center justify-center text-white shadow-lg">
                        <ShieldCheck size={20} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-[#014A6E] tracking-tight">{selectedEmployee.fullName}</h4>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8AC53E] mt-1">{selectedEmployee.memberId}</p>
                    </div>
                          {/* Detail Groups */}
                  <div className="space-y-8 h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                    <div className="space-y-4">
                       <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">Employment & Compensation Metrics</h5>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                             <img src="https://img.icons8.com/parakeet-line/32/737373/building.png" className="w-5 h-5 opacity-40" />
                             <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">Unit / Dept</p>
                                <p className="text-xs font-bold text-slate-700">{selectedEmployee.division || "N/A"}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <img src="https://img.icons8.com/parakeet-line/32/737373/briefcase.png" className="w-5 h-5 opacity-40" />
                             <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">Designation</p>
                                <p className="text-xs font-bold text-slate-700">{selectedEmployee.designation || "N/A"}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <img src="https://img.icons8.com/parakeet-line/32/737373/calendar.png" className="w-5 h-5 opacity-40" />
                             <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">Joint Date</p>
                                <p className="text-xs font-bold text-slate-700">{selectedEmployee.jointDate || "N/A"}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <img src="https://img.icons8.com/parakeet-line/32/737373/user.png" className="w-5 h-5 opacity-40" />
                             <div>
                                <p className="text-[9px] font-black uppercase text-slate-400">Type</p>
                                <p className="text-xs font-bold text-slate-700">{selectedEmployee.employeeType || "N/A"}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 col-span-2 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                             <img src="https://img.icons8.com/parakeet-line/32/014A6E/money-bag.png" className="w-5 h-5" />
                             <div>
                                <p className="text-[9px] font-black uppercase text-[#014A6E]">Expected Gross Protocol</p>
                                <p className="text-sm font-black text-[#014A6E] tracking-tight">LKR {Number(selectedEmployee.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">Status & Benefit Protocols</h5>
                       <div className="grid grid-cols-2 gap-3">
                          <div className={cn("p-2 rounded-xl border flex flex-col gap-1", selectedEmployee.epfActive === "Yes" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                             <p className="text-[8px] font-black uppercase text-slate-500">EPF Protocol</p>
                             <p className={cn("text-[10px] font-black", selectedEmployee.epfActive === "Yes" ? "text-emerald-700" : "text-red-700")}>{selectedEmployee.epfActive === "Yes" ? "ACTIVE" : "DISABLED"}</p>
                          </div>
                          <div className={cn("p-2 rounded-xl border flex flex-col gap-1", selectedEmployee.allowAllowance === "Yes" ? "bg-cyan-50 border-cyan-100" : "bg-slate-50 border-slate-100")}>
                             <p className="text-[8px] font-black uppercase text-slate-500">Std Allowance</p>
                             <p className={cn("text-[10px] font-black", selectedEmployee.allowAllowance === "Yes" ? "text-cyan-700" : "text-slate-400")}>{selectedEmployee.allowAllowance === "Yes" ? "YES" : "NO"}</p>
                          </div>
                          <div className={cn("p-2 rounded-xl border flex flex-col gap-1", selectedEmployee.allowOvertime === "Yes" ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100")}>
                             <p className="text-[8px] font-black uppercase text-slate-500">O.T. Protocol</p>
                             <p className={cn("text-[10px] font-black", selectedEmployee.allowOvertime === "Yes" ? "text-amber-700" : "text-slate-400")}>{selectedEmployee.allowOvertime === "Yes" ? "ENABLED" : "LOCKED"}</p>
                          </div>
                          <div className="p-2 rounded-xl border bg-slate-50 border-slate-100 flex flex-col gap-1">
                             <p className="text-[8px] font-black uppercase text-slate-500">Entitled Leave</p>
                             <p className="text-[10px] font-black text-slate-700">{selectedEmployee.entitledLeave || "N/A"}</p>
                          </div>
                       </div>
                    </div>

                    {selectedEmployee.specialNote && (
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">Entry Memo</h5>
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 relative">
                           <div className="absolute -top-2 -left-2 text-amber-300"><Info size={20} fill="currentColor" /></div>
                           <p className="text-xs font-medium text-amber-800 italic leading-relaxed">"{selectedEmployee.specialNote}"</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-10">
                       <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">Fiscal Configuration</h5>
                       <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3">
                             <CreditCard size={18} className="text-[#8AC53E]" />
                             <p className="text-xs font-bold text-slate-700">Dual-Bank Channels</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black italic">CONFIGURED</span>
                       </div>
                    </div>
                  </div>

                  {/* Action Cluster */}
                  <div className="pt-6 space-y-3">
                    <button 
                      onClick={() => handleApprove(selectedEmployee.id)}
                      disabled={!!processingId}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-[#8AC53E] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-lime-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {processingId === selectedEmployee.id ? <Loader2 className="animate-spin" size={18} /> : (
                        <>
                          <ShieldCheck size={18} />
                          Authorize Induction
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => handleReject(selectedEmployee.id)}
                      disabled={!!processingId}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-white text-red-500 border border-red-100 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      Deny Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
