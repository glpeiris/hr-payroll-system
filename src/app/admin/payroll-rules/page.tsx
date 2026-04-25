"use client";

import React, { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { 
  FileLock2, 
  Save, 
  Loader2, 
  Percent, 
  ShieldCheck, 
  Building,
  User,
  Clock,
  PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

export default function PayrollRulesPage() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  
  const [rules, setRules] = useState<any>({
    epfEmployeeRate: 8,
    epfEmployerRate: 12,
    etfEmployerRate: 3,
    otRate: 1.5,
    allowanceRates: {}
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "payroll");
        const docSnap = await getDoc(docRef);
        
        let existingRules = {
          epfEmployeeRate: 8,
          epfEmployerRate: 12,
          etfEmployerRate: 3,
          otRate: 1.5,
          allowanceRates: {}
        };

        if (docSnap.exists()) {
          existingRules = { ...existingRules, ...docSnap.data() };
        }
        
        // Fetch master allowance types
        const qAllow = query(collection(db, "masters"), where("category", "==", "Allowance Types"), where("status", "==", "Active"));
        const allowSnap = await getDocs(qAllow);
        const allowances = allowSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        
        setAllowanceTypes(allowances);
        setRules(existingRules);
        
      } catch (error) {
        console.error("Error fetching rules:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "settings", "payroll");
      await setDoc(docRef, {
        ...rules,
        updatedAt: serverTimestamp()
      });
      alert("✅ Payroll calculation rates updated successfully!");
    } catch (error) {
      console.error("Error saving rules:", error);
      alert("❌ Failed to save payroll rules. Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateAllowanceRate = (id: string, value: number) => {
    setRules((prev: any) => ({
      ...prev,
      allowanceRates: {
        ...prev.allowanceRates,
        [id]: value
      }
    }));
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">
              <ShieldCheck size={14} /> Compliance Protocol
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">Payroll <span className="text-blue-600">Governance</span></h1>
            <p className="text-slate-500 font-medium">Define calculation rates used for payroll processing.</p>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary py-4 px-10 flex items-center gap-3 shadow-xl shadow-blue-200 active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Synchronize Rates
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Statutory Matrix Section */}
          <div className="glass-panel p-8 bg-white border-slate-200 space-y-8 shadow-sm">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Building size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Statutory Requirements</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">EPF Company Contribution Percentage</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    value={rules.epfEmployerRate}
                    onChange={(e) => setRules({...rules, epfEmployerRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                  />
                  <Percent className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">ETF Company Contribution Percentage</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    value={rules.etfEmployerRate}
                    onChange={(e) => setRules({...rules, etfEmployerRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                  />
                  <Percent className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-amber-600">EPF Employee Contribution Percentage</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    value={rules.epfEmployeeRate}
                    onChange={(e) => setRules({...rules, epfEmployeeRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-5 py-4 font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-amber-200 outline-none transition-all" 
                  />
                  <Percent className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Operational Matrix Section */}
          <div className="space-y-8">
            <div className="glass-panel p-8 bg-white border-slate-200 space-y-8 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Overtime Matrix</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">OT Rate Multiplier</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 1.5"
                    value={rules.otRate}
                    onChange={(e) => setRules({...rules, otRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all" 
                  />
                </div>
                <p className="text-[10px] font-bold text-slate-400">System baseline logic handles actual per-hour computation.</p>
              </div>
            </div>

            <div className="glass-panel p-8 bg-white border-slate-200 space-y-8 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                  <PlusCircle size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Active Master Allowances</h3>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {allowanceTypes.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 font-medium italic bg-slate-50 rounded-xl">
                    No active allowances found in Master Setup.
                  </div>
                ) : (
                  allowanceTypes.map(type => (
                    <div key={type.id} className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{type.name} Rate</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          value={rules.allowanceRates?.[type.id] || 0}
                          onChange={(e) => updateAllowanceRate(type.id, parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-violet-100 outline-none transition-all" 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="glass-panel p-8 bg-slate-900 text-white border-transparent flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400">
              <FileLock2 size={24} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Synchronize Global Fiscal Matrix</p>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Affects all active registries and future payroll cycles.</p>
            </div>
          </div>
          <button 
            onClick={handleSave}
            className="w-full md:w-auto px-8 py-3 bg-[#8AC53E] hover:bg-[#a3e64d] text-[#014A6E] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </Shell>
  );
}
