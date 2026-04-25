"use client";

import React, { useState, useRef } from "react";
import { Shell } from "@/components/Shell";
import { 
  FileUp, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Download, 
  Info, 
  AlertCircle,
  Users,
  Database,
  ArrowRight
} from "lucide-react";
import { cn, downloadCSV } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";

const uploadSectors = [
  { 
    id: "employees", 
    name: "Registration Information", 
    icon: Users,
    desc: "Bulk induct personnel into the HR registry.",
    fields: [
      "memberId", "fullName", "nameWithInitials", "email", "contactNo", 
      "division", "department", "designation", "jointDate", "employeeType",
      "idPassportNo", "dob", "religion", "civilStatus", "basicSalary1",
      "basicSalary2", "fixedAllowance1", "fixedAllowance2", "fixedAllowance3"
    ],
    collection: "employees"
  },
  { 
    id: "masters-divisions", 
    name: "Divisions Index", 
    icon: Database,
    desc: "Mass-configure organisational divisions.",
    fields: ["name", "code", "description"],
    collection: "masters",
    masterCategory: "Divisions"
  },
  { 
    id: "masters-departments", 
    name: "Departments Index", 
    icon: Database,
    desc: "Mass-configure organisational departments.",
    fields: ["name", "code", "description"],
    collection: "masters",
    masterCategory: "Departments"
  },
  { 
    id: "masters-designations", 
    name: "Designations Index", 
    icon: Database,
    desc: "Mass-configure employee designations.",
    fields: ["name", "code", "description"],
    collection: "masters",
    masterCategory: "Designations"
  },
  { 
    id: "masters-salary", 
    name: "Salary Scales Index", 
    icon: Database,
    desc: "Mass-configure fiscal scales and groups.",
    fields: ["name", "code", "description", "group", "min", "max"],
    collection: "masters",
    masterCategory: "Salary Scales"
  },
  { 
    id: "masters-banks", 
    name: "Bank Branches Index", 
    icon: Database,
    desc: "Mass-configure financial institutions.",
    fields: ["name", "code", "description"],
    collection: "masters",
    masterCategory: "Bank Branches"
  }
];

export default function BulkUploadPage() {
  const [selectedSector, setSelectedSector] = useState(uploadSectors[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{success: boolean, message: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = selectedSector.fields.join(",");
    downloadCSV(headers, `GSOFT_${selectedSector.name.replace(/ /g, "_")}_Template`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setUploadStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split("\n").filter(line => line.trim());
        if (lines.length < 2) throw new Error("File is empty or missing data rows.");

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const batch = writeBatch(db);
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim());
          const item: any = {
            createdAt: serverTimestamp(),
            status: selectedSector.id === "employees" ? "Pending Approval" : "Active"
          };

          // Auto-assign category for master records
          if (selectedSector.collection === "masters") {
            item.category = selectedSector.masterCategory;
          }

          headers.forEach((header, index) => {
            const val = values[index];
            if (!val) return;

            // Mapping logic
            if (selectedSector.collection === "masters") {
               if (header === "name") item.name = val;
               if (header === "code") item.code = val;
               if (header === "description") item.description = val;
               if (header === "group") item.salaryGroup = val;
               if (header === "min") item.salaryRangeMin = val;
               if (header === "max") item.salaryRangeMax = val;
            } else {
               item[header] = val;
            }
          });

          const docRef = doc(collection(db, selectedSector.collection));
          batch.set(docRef, item);
          count++;
        }

        await batch.commit();
        setUploadStatus({ 
          success: true, 
          message: `Successfully induced ${count} records into the ${selectedSector.name} segment.` 
        });
      } catch (error: any) {
        console.error("Bulk induction failure:", error);
        setUploadStatus({ 
          success: false, 
          message: `Induction failed: ${error.message || "Invalid CSV structure or security block."}` 
        });
      } finally {
        setIsSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
        
        {/* Header */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8AC53E]">Data Governance</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Bulk <span className="text-[#014A6E] italic">Data Induction</span></h1>
          <p className="text-slate-500 text-lg font-medium">Mass-process enterprise records via high-fidelity CSV ingestion.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Sector Selection */}
          <div className="lg:col-span-1 space-y-4">
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Ingestion Sector</h3>
             <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {uploadSectors.map((sector) => (
                  <button
                    key={sector.id}
                    onClick={() => {
                      setSelectedSector(sector);
                      setUploadStatus(null);
                    }}
                    className={cn(
                      "w-full p-6 rounded-[32px] border-2 text-left transition-all duration-300 group",
                      selectedSector.id === sector.id 
                        ? "bg-white border-[#8AC53E] shadow-xl shadow-lime-100" 
                        : "bg-slate-50 border-transparent hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "p-3 rounded-2xl transition-colors",
                         selectedSector.id === sector.id ? "bg-[#8AC53E] text-white" : "bg-white text-slate-400 shadow-sm"
                       )}>
                          <sector.icon size={20} />
                       </div>
                       <div>
                          <p className={cn("text-xs font-black uppercase tracking-widest", selectedSector.id === sector.id ? "text-[#014A6E]" : "text-slate-500")}>{sector.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">{sector.desc}</p>
                       </div>
                    </div>
                  </button>
                ))}
             </div>

             <div className="p-6 bg-[#014A6E] rounded-[32px] text-white space-y-4 shadow-xl shadow-[#014A6E]/20">
                <div className="flex items-center gap-3">
                   <AlertCircle size={20} className="text-[#8AC53E]" />
                   <p className="text-xs font-black uppercase tracking-widest">Pre-Induction Audit</p>
                </div>
                <p className="text-[10px] leading-relaxed opacity-70 font-medium italic">Ensure your CSV headers exactly match the required field list. Data with missing mandatory headers will be discarded by the security layer.</p>
             </div>
          </div>

          {/* Upload & Field List */}
          <div className="lg:col-span-2 space-y-6">
             <div className="glass-panel p-10 space-y-8 border-slate-200">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#8AC53E] border border-slate-100">
                         <Info size={18} />
                      </div>
                      <h4 className="text-sm font-black text-[#014A6E] uppercase tracking-widest">Required Field Matrix</h4>
                   </div>
                   <button 
                     onClick={handleDownloadTemplate}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#014A6E] hover:bg-slate-100 transition-colors"
                   >
                      <Download size={14} /> Download Template
                   </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                   {selectedSector.fields.map((field) => (
                      <div key={field} className="px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-[#8AC53E]" />
                         <span className="text-[11px] font-bold text-slate-600">{field}</span>
                      </div>
                   ))}
                </div>

                <div className="pt-8 border-t border-slate-100">
                   {uploadStatus ? (
                      <div className={cn(
                        "p-6 rounded-[24px] flex items-center gap-4 animate-in slide-in-from-top-4 duration-500",
                        uploadStatus.success ? "bg-emerald-50 border border-emerald-100 text-emerald-800" : "bg-red-50 border border-red-100 text-red-800"
                      )}>
                         {uploadStatus.success ? <CheckCircle size={24} /> : <XCircle size={24} />}
                         <p className="text-sm font-bold">{uploadStatus.message}</p>
                         <button 
                           onClick={() => setUploadStatus(null)}
                           className="ml-auto text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100"
                         >
                           Dismiss
                         </button>
                      </div>
                   ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-[40px] hover:border-[#8AC53E] hover:bg-lime-50/30 transition-all cursor-pointer relative overflow-hidden"
                      >
                         <input 
                           type="file" 
                           accept=".csv" 
                           className="hidden" 
                           ref={fileInputRef} 
                           onChange={handleFileUpload}
                         />
                         
                         <div className="w-16 h-16 rounded-[24px] bg-white border border-slate-100 shadow-lg flex items-center justify-center text-[#8AC53E] group-hover:scale-110 transition-transform duration-500 mb-6">
                            {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <FileUp size={24} />}
                         </div>

                         <div className="text-center">
                            <h5 className="text-lg font-black text-[#014A6E] tracking-tight">
                               {isSubmitting ? "Inducting Data Stream..." : "Initiate Bulk Ingestion"}
                            </h5>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Click or drag CSV file into this sector</p>
                         </div>

                         {/* Pulse Background */}
                         <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#8AC53E]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                   )}
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 italic">Target Collection: <span className="text-[#014A6E] font-black uppercase">{selectedSector.collection}</span></p>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8AC53E]">
                      Protocol Secure <ArrowRight size={14} />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
