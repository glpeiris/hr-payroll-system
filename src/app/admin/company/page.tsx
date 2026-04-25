"use client";

import { Shell } from "@/components/Shell";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Upload, 
  Save, 
  Loader2, 
  CheckCircle2,
  Info,
  Hash,
  ShieldCheck
} from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function CompanyRegistrationPage() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [company, setCompany] = useState({
    name: "",
    address: "",
    phone1: "",
    phone2: "",
    email: "",
    website: "",
    logoUrl: "",
    regNo: "",
    taxId: "",
    epfNo: "",
    currency: "LKR",
    timezone: "Asia/Colombo"
  });

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const docRef = doc(db, "system", "company");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompany(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompanyData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, "system", "company"), {
        ...company,
        updatedAt: serverTimestamp()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert("⚠️ Sync Failure: Registry modification failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompany(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        <div className="flex items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#014A6E] font-black text-[10px] uppercase tracking-[0.2em]">
              <ShieldCheck size={14} /> System Governance
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">
              Employer <span className="text-blue-600">Registration</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg italic">
              Configure the master identity and fiscal parameters of the organization.
            </p>
          </div>
          
          <button 
            type="submit" 
            form="companyForm"
            disabled={isSaving}
            className={cn(
              "btn-primary py-4 px-10 flex items-center gap-3 shadow-xl transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50",
              success ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200" : "shadow-blue-200"
            )}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {success ? "Registry Synchronized" : "Commit Entity Profile"}
          </button>
        </div>

        <form id="companyForm" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="glass-panel p-8 bg-white border-slate-200 space-y-8">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                <Building2 size={14} className="text-blue-500" /> Entity Identity
              </label>
              
              <div className="space-y-6">
                <div className="relative group cursor-pointer h-48 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden transition-all hover:border-blue-400">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                        <Upload size={20} className="text-slate-400" />
                      </div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Upload Logo</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>

                <div className="space-y-4">
                  <InputField 
                    label="Official Entity Name" 
                    value={company.name} 
                    onChange={(v: string) => setCompany({...company, name: v})} 
                    placeholder="e.g. Acme Corporation (Pvt) Ltd"
                  />
                  <InputField 
                    label="Registration Number" 
                    value={company.regNo} 
                    onChange={(v: string) => setCompany({...company, regNo: v})} 
                    placeholder="e.g. PV-123456"
                    icon={<Hash size={16}/>}
                  />
                </div>
              </div>
            </div>
            <div className="glass-panel p-8 bg-blue-600 border-none text-white space-y-4">
               <Info size={24} className="text-blue-200" />
               <h3 className="font-black italic text-lg tracking-tight">Systemic Branding</h3>
               <p className="text-sm font-medium text-blue-100 leading-relaxed">
                 The logo inducted here will be displayed during the system initialization sequence.
               </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="glass-panel p-10 bg-white border-slate-200 space-y-10 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 border-b pb-4">
                    <MapPin size={14} className="text-blue-500" /> Logistic Parameters
                  </label>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Official Head Office Address</label>
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 min-h-[120px]" 
                        value={company.address}
                        onChange={e => setCompany({...company, address: e.target.value})}
                        placeholder="Complete postal address..."
                      />
                    </div>
                    <InputField label="Official Website" value={company.website} onChange={(v: string) => setCompany({...company, website: v})} icon={<Globe size={18}/>} placeholder="www.example.com" />
                  </div>
                </div>

                <div className="space-y-8">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 border-b pb-4">
                    <Phone size={14} className="text-blue-500" /> Communication Lines
                  </label>
                  <div className="space-y-6">
                    <InputField label="Primary Hotline" value={company.phone1} onChange={(v: string) => setCompany({...company, phone1: v})} icon={<Phone size={18}/>} placeholder="+94 11 123 4567" />
                    <InputField label="Secondary / Fax" value={company.phone2} onChange={(v: string) => setCompany({...company, phone2: v})} icon={<Phone size={18}/>} placeholder="+94 11 123 4568" />
                    <InputField label="Support Email" value={company.email} onChange={(v: string) => setCompany({...company, email: v})} icon={<Mail size={18}/>} placeholder="hr@example.com" />
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-100 space-y-8">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-blue-500" /> Statutory Compliance Identification
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <InputField label="Tax Identification (TIN)" value={company.taxId} onChange={(v: string) => setCompany({...company, taxId: v})} icon={<Hash size={18}/>} placeholder="TIN-XXXXXX" color="amber" />
                  <InputField label="EPF Registration Number" value={company.epfNo} onChange={(v: string) => setCompany({...company, epfNo: v})} icon={<Hash size={18}/>} placeholder="GP/XXXXX" color="emerald" />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function InputField({ label, value, onChange, placeholder, icon, color }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, icon?: any, color?: string }) {
  const colors: any = {
    blue: "focus:ring-blue-100 bg-blue-50/20",
    amber: "focus:ring-amber-100 bg-amber-50/20",
    emerald: "focus:ring-emerald-100 bg-emerald-50/20",
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
            {icon}
          </div>
        )}
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full border border-slate-200 rounded-2xl py-4 font-bold text-slate-700 outline-none transition-all",
            icon ? "pl-12" : "pl-4",
            "pr-4",
            color && colors[color] ? colors[color] : "bg-slate-50 focus:ring-slate-100"
          )}
        />
      </div>
    </div>
  );
}
