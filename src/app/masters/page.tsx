"use client";

import { Shell } from "@/components/Shell";
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, Building2, Loader2, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { cn, downloadExcel } from "@/lib/utils";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  orderBy,
  deleteDoc,
  updateDoc,
  doc,
  writeBatch 
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { FileUp, CheckCircle, XCircle, Download } from "lucide-react";
import { useRef } from "react";

const masterCategories = [
  "Divisions", "Departments", "Designations", "Employment Types",
  "Salary Scales", "Allowance Types", "Deduction Types", "Bank Branches",
  "Loan Types", "Training Types", "Warning Types", "Letter Templates"
];

interface MasterRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  status: string;
  createdAt: any;
  // Dynamic fields for Salary Scales
  salaryGroup?: string;
  salaryRangeMin?: string;
  salaryRangeMax?: string;
}

export default function MastersPage() {
  const [selectedCategory, setSelectedCategory] = useState("Divisions");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = userProfile?.role === "Master Admin";
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    salaryGroup: "",
    salaryRangeMin: "",
    salaryRangeMax: ""
  });

  // ── Real-time Data Sync ──────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "masters"),
      where("category", "==", selectedCategory)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as MasterRecord[];

      // Sort client-side to avoid index requirement
      data.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

      setRecords(data);
      setLoading(false);
    }, (error: Error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCategory]);

  // ── Handle Save (Add or Update) ──────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;

    setIsSubmitting(true);
    try {
      if (editId) {
        // Update Existing
        await updateDoc(doc(db, "masters", editId), {
          ...formData
        });
      } else {
        // Add New
        await addDoc(collection(db, "masters"), {
          ...formData,
          category: selectedCategory,
          status: "Active",
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditId(null);
      setFormData({ 
        name: "", 
        code: "", 
        description: "",
        salaryGroup: "",
        salaryRangeMin: "",
        salaryRangeMax: ""
      });
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("Failed to save record. Check Firebase permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle Edit Initialization ──────────────────
  const startEdit = (record: MasterRecord) => {
    setEditId(record.id);
    setFormData({
      name: record.name,
      code: record.code,
      description: record.description,
      salaryGroup: record.salaryGroup || "",
      salaryRangeMin: record.salaryRangeMin || "",
      salaryRangeMax: record.salaryRangeMax || ""
    });
    setIsModalOpen(true);
  };

  // ── Handle Status Toggle ────────────────────────
  const handleToggleStatus = async (record: MasterRecord) => {
    const newStatus = record.status === "Active" ? "Deactivated" : "Active";
    try {
      await updateDoc(doc(db, "masters", record.id), {
        status: newStatus
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // ── Handle Delete ────────────────────────────
  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm("Are you sure you want to delete this record permanentally?")) {
      try {
        await deleteDoc(doc(db, "masters", id));
      } catch (error) {
        console.error("Error deleting document: ", error);
      }
    }
  };

  // ── Handle Bulk Status ──────────────────────────
  const handleBulkStatus = async (status: "Active" | "Deactivated") => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to set the ${selectedIds.length} selected records in ${selectedCategory} to ${status}?`)) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const docRef = doc(db, "masters", id);
        batch.update(docRef, { status });
      });
      await batch.commit();
      alert(`Successfully updated ${selectedIds.length} records.`);
      setSelectedIds([]);
    } catch (error) {
      console.error("Bulk update failed:", error);
      alert("Bulk update failed. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handle CSV Upload ───────────────────────────
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      
      const newItems = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(",").map(v => v.trim());
        const item: any = {
          category: selectedCategory,
          status: "Active",
          createdAt: serverTimestamp()
        };
        
        headers.forEach((header, index) => {
          if (header === "name") item.name = values[index];
          if (header === "code") item.code = values[index];
          if (header === "description") item.description = values[index];
          if (header === "group") item.salaryGroup = values[index];
          if (header === "min") item.salaryRangeMin = values[index];
          if (header === "max") item.salaryRangeMax = values[index];
        });
        return item;
      });

      if (newItems.length === 0) {
        alert("No valid data found in CSV. Expected headers: name, code, description, group, min, max");
        return;
      }

      if (!confirm(`Import ${newItems.length} records into ${selectedCategory}?`)) return;

      setIsSubmitting(true);
      try {
        const batch = writeBatch(db);
        newItems.forEach((item) => {
          const docRef = doc(collection(db, "masters"));
          batch.set(docRef, item);
        });
        await batch.commit();
        alert(`Successfully imported ${newItems.length} records.`);
      } catch (error) {
        console.error("Import failed:", error);
        alert("Import failed. Check CSV format.");
      } finally {
        setIsSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = () => {
    if (records.length === 0) return;
    
    // Prepare flattened data for Excel
    const data = records.map(record => {
      const item: any = {
        "Name": record.name,
        "Code": record.code,
        "Description": record.description
      };
      
      if (selectedCategory === "Salary Scales") {
        item["Salary Group"] = record.salaryGroup;
        item["Min Salary"] = record.salaryRangeMin;
        item["Max Salary"] = record.salaryRangeMax;
      }
      return item;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, selectedCategory);
    
    // Generate Base64 content to bypass Blob naming issues
    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    downloadExcel(excelBase64, `${selectedCategory}_Export_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <Shell>
      <div className="space-y-8 max-w-[1600px] mx-auto">

        {/* ── Page Header ─────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8AC53E]">
              Configuration
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">
              Master Configuration
            </h1>
            <p className="text-slate-500 text-base font-medium">
              Manage core organisational entities and classifications.
            </p>
          </div>
          <button 
            onClick={() => {
              setEditId(null);
              setFormData({ 
                name: "", 
                code: "", 
                description: "",
                salaryGroup: "",
                salaryRangeMin: "",
                salaryRangeMax: ""
              });
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2 group self-start lg:self-auto"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Add New {selectedCategory.slice(0, -1)}</span>
          </button>
        </div>

        {/* ── Category Tabs ────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {masterCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all duration-300 flex items-center justify-between gap-2",
                selectedCategory === category
                  ? "bg-[#8AC53E] border-[#8AC53E] text-white shadow-lg shadow-lime-200"
                  : "bg-white border-slate-200 text-slate-600 hover:border-lime-300 hover:bg-lime-50 hover:text-[#7AB42F] shadow-sm"
              )}
            >
              <span className="truncate">{category}</span>
              {selectedCategory === category && (
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* ── Content Panel ────────────────────────── */}
        <div className="glass-panel overflow-hidden">

          {/* Action Bar */}
          <div className="p-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/60 border-b border-slate-200/80">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                placeholder={`Search ${selectedCategory}...`}
                className="input-field pl-11"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {isAdmin && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 pr-4 border-r border-slate-200 animate-in fade-in slide-in-from-right-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#8AC53E] mr-2">
                    {selectedIds.length} Selected
                  </span>
                  <button 
                    onClick={() => handleBulkStatus("Active")}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50"
                  >
                    <CheckCircle size={13} />
                    Activate
                  </button>
                  <button 
                    onClick={() => handleBulkStatus("Deactivated")}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all disabled:opacity-50"
                  >
                    <XCircle size={13} />
                    Deactivate
                  </button>
                </div>
              )}
              {isAdmin && (
                <>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleCSVUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-lime-300 hover:text-[#7AB42F] hover:bg-lime-50 transition-all shadow-sm disabled:opacity-50"
                  >
                    <FileUp size={15} className="text-[#8AC53E]" />
                    Import CSV
                  </button>
                  <button 
                    onClick={handleExportExcel}
                    disabled={records.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-50"
                  >
                    <Download size={15} className="text-emerald-500" />
                    Export Excel
                  </button>
                </>
              )}

              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                <Filter size={15} className="text-[#8AC53E]" />
                Filter
              </button>
              <div className="h-6 w-px bg-slate-200 hidden md:block" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {records.length} records found
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-10 h-10 text-[#8AC53E] animate-spin" />
                <p className="text-slate-400 font-medium">Syncing with Cloud Registry...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <Plus size={32} />
                </div>
                <div>
                  <h4 className="text-slate-800 font-bold">No Records Found</h4>
                  <p className="text-slate-400 text-sm">Add your first {selectedCategory.slice(0, -1)} to get started.</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {isAdmin && (
                      <th className="p-5 w-10 text-center">
                        <input 
                          type="checkbox" 
                          className="accent-[#8AC53E] w-4 h-4 rounded cursor-pointer"
                          checked={records.length > 0 && selectedIds.length === records.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(records.map(r => r.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Code / ID</th>
                    <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Name / Description</th>
                    <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Status</th>
                    <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Added Date</th>
                    <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id} className={cn("table-row group cursor-pointer", item.status !== "Active" && "opacity-60 grayscale-[0.5]", selectedIds.includes(item.id) && "bg-lime-50/50")}>
                      {isAdmin && (
                        <td className="p-5 text-center">
                          <input 
                            type="checkbox" 
                            className="accent-[#8AC53E] w-4 h-4 rounded cursor-pointer"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedIds([...selectedIds, item.id]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== item.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      <td className="p-5">
                        <span className="font-mono text-xs font-bold text-primary bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                          {item.code}
                        </span>
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800 group-hover:text-primary transition-colors">
                          {item.name}
                        </p>
                        {selectedCategory === "Salary Scales" && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#8AC53E]">
                              Group: {item.salaryGroup || "Unassigned"}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Range: {Number(item.salaryRangeMin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {Number(item.salaryRangeMax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1 font-medium italic">{item.description}</p>
                      </td>
                      <td className="p-5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          item.status === "Active" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", item.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                          {item.status}
                        </span>
                      </td>
                      <td className="p-5 text-sm font-medium text-slate-500">
                        {item.createdAt?.toDate() ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-50 transition-all"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              item.status === "Active" 
                                ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50" 
                                : "text-slate-400 hover:text-[#8AC53E] hover:bg-lime-50"
                            )}
                            title={item.status === "Active" ? "Deactivate" : "Activate"}
                          >
                            <Lock size={15} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Modal ────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl shadow-slate-900/20 border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{editId ? 'Modify' : 'New'} {selectedCategory.slice(0, -1)}</h3>
                  <p className="text-sm text-slate-500">{editId ? 'Update existing registry parameters.' : 'Configure parameters for the new entry.'}</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleSave}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Instance Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={`e.g. ${selectedCategory === 'Divisions' ? 'Engineering' : 'Head Office'}`} 
                    className="input-field" 
                    autoFocus 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Short Code / Key</label>
                  <input 
                    type="text" 
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    placeholder="e.g. DIV-004" 
                    className="input-field" 
                  />
                </div>

                {selectedCategory === "Salary Scales" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Salary Group</label>
                      <input 
                        type="text" 
                        value={formData.salaryGroup}
                        onChange={(e) => setFormData({...formData, salaryGroup: e.target.value})}
                        placeholder="e.g. Manager / Executive" 
                        className="input-field" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Min Salary</label>
                        <input 
                          type="text" 
                          value={formData.salaryRangeMin}
                          onChange={(e) => setFormData({...formData, salaryRangeMin: e.target.value})}
                          placeholder="e.g. 100,000.00" 
                          className="input-field" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Max Salary</label>
                        <input 
                          type="text" 
                          value={formData.salaryRangeMax}
                          onChange={(e) => setFormData({...formData, salaryRangeMax: e.target.value})}
                          placeholder="e.g. 250,000.00" 
                          className="input-field" 
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Detailed Description</label>
                  <textarea 
                    rows={2} 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Provide context regarding this configuration..." 
                    className="input-field resize-none py-3" 
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : (editId ? 'Commit Changes' : 'Confirm & Save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
