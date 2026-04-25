"use client";

import React, { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { 
  Calendar, 
  User, 
  Save, 
  PlusCircle, 
  History as HistoryIcon, 
  Loader2, 
  AlertCircle,
  FileEdit,
  Coins,
  Clock3,
  MinusCircle,
  ChevronRight,
  Briefcase,
  Wallet,
  Calculator,
  GanttChart,
  LayoutGrid,
  FileSpreadsheet,
  Users,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  RotateCcw
} from "lucide-react";
import { cn, downloadExcel } from "@/lib/utils";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { Employee } from "@/lib/types";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export default function AdjustmentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "grid">("form");
  const [allAdjustments, setAllAdjustments] = useState<any[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  const [dynamicAllowances, setDynamicAllowances] = useState<Record<string, number>>({});
  const [globalRates, setGlobalRates] = useState<any>({ allowanceRates: {} });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [showStatus, setShowStatus] = useState<"success" | "error" | null>(null);

  // Grouped Adjustments State
  const [adjustments, setAdjustments] = useState({
    // Group 1
    noPayDays: 0,
    salaryArrears: 0,
    
    // Group 2
    holidayWorks: 0,
    extraDayWorks: 0,
    nightShiftAllowance: 0,
    overNightAllowance: 0,
    allowanceArrears: 0,
    overtimeHours: 0,
    otArrears: 0,

    // Group 3
    welfare: 0,
    fine: 0,
    loan: 0,
    otherDeductions: 0
  });

  // Fetch employees & Allowance Types
  useEffect(() => {
    const qEmp = query(collection(db, "employees"), where("status", "==", "Active"));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(emps);
    });

    const qAllow = query(collection(db, "masters"), where("category", "==", "Allowance Types"), where("status", "==", "Active"));
    const unsubAllow = onSnapshot(qAllow, (snapshot) => {
      setAllowanceTypes(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    const unsubRates = onSnapshot(doc(db, "settings", "payroll"), (snap) => {
      if (snap.exists()) setGlobalRates(snap.data());
    });

    return () => {
      unsubEmp();
      unsubAllow();
      unsubRates();
    };
  }, []);

  // Fetch adjustments for grid view
  useEffect(() => {
    if (viewMode !== "grid") return;

    const qAdj = query(
      collection(db, "monthly_adjustments"),
      where("month", "==", selectedMonth + 1),
      where("year", "==", selectedYear)
    );

    const unsubscribe = onSnapshot(qAdj, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAdjustments(data);
    });

    return () => unsubscribe();
  }, [viewMode, selectedMonth, selectedYear]);

  // Fetch existing values for form
  useEffect(() => {
    if (!selectedEmployeeId || viewMode !== "form") return;

    const fetchAdjustments = async () => {
      setLoading(true);
      try {
        const id = `${selectedEmployeeId}_${selectedYear}_${selectedMonth + 1}`;
        const docRef = doc(db, "monthly_adjustments", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setAdjustments({
            noPayDays: data.noPayDays || 0,
            salaryArrears: data.salaryArrears || 0,
            holidayWorks: data.holidayWorks || 0,
            extraDayWorks: data.extraDayWorks || 0,
            nightShiftAllowance: data.nightShiftAllowance || 0,
            overNightAllowance: data.overNightAllowance || 0,
            allowanceArrears: data.allowanceArrears || 0,
            overtimeHours: data.overtimeHours || 0,
            otArrears: data.otArrears || 0,
            welfare: data.welfare || 0,
            fine: data.fine || 0,
            loan: data.loan || 0,
            otherDeductions: data.otherDeductions || 0
          });
          setDynamicAllowances(data.dynamicAllowances || {});
        } else {
          setAdjustments({
            noPayDays: 0,
            salaryArrears: 0,
            holidayWorks: 0,
            extraDayWorks: 0,
            nightShiftAllowance: 0,
            overNightAllowance: 0,
            allowanceArrears: 0,
            overtimeHours: 0,
            otArrears: 0,
            welfare: 0,
            fine: 0,
            loan: 0,
            otherDeductions: 0
          });
          setDynamicAllowances({});
        }
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdjustments();
  }, [selectedEmployeeId, selectedMonth, selectedYear, viewMode]);

  const handleSave = async () => {
    if (!selectedEmployeeId) return;
    setIsSaving(true);
    try {
      const id = `${selectedEmployeeId}_${selectedYear}_${selectedMonth + 1}`;
      const docRef = doc(db, "monthly_adjustments", id);
      await setDoc(docRef, {
        employeeId: selectedEmployeeId,
        month: selectedMonth + 1,
        year: selectedYear,
        ...adjustments,
        dynamicAllowances,
        updatedAt: serverTimestamp()
      });
      setShowStatus("success");
      setTimeout(() => setShowStatus(null), 4000);
    } catch (error) {
      setShowStatus("error");
      setTimeout(() => setShowStatus(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`⚠️ Are you sure you want to CLEAR ALL variable data for ${selectedIds.length} selected employees for ${months[selectedMonth]} ${selectedYear}?\n\nThis will reset all OT, No-Pay, Shifts and Deductions to zero.`)) return;

    setIsClearing(true);
    try {
      for (const empId of selectedIds) {
        const docId = `${empId}_${selectedYear}_${selectedMonth + 1}`;
        const docRef = doc(db, "monthly_adjustments", docId);
        
        await setDoc(docRef, {
          employeeId: empId,
          month: selectedMonth + 1,
          year: selectedYear,
          noPayDays: 0,
          salaryArrears: 0,
          holidayWorks: 0,
          extraDayWorks: 0,
          nightShiftAllowance: 0,
          overNightAllowance: 0,
          allowanceArrears: 0,
          overtimeHours: 0,
          otArrears: 0,
          welfare: 0,
          fine: 0,
          loan: 0,
          otherDeductions: 0,
          dynamicAllowances: {},
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setSelectedIds([]);
      alert("✅ Selected employee variable data has been cleared.");
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("❌ Failed to clear data.");
    } finally {
      setIsClearing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExportGrid = () => {
    if (allAdjustments.length === 0) return;
    
    const exportData = allAdjustments.map(adj => {
      const emp = employees.find(e => e.id === adj.employeeId);
      return {
        "Employee ID": emp?.memberId || "N/A",
        "Employee Name": emp?.fullName || "N/A",
        "Month": months[selectedMonth],
        "Year": selectedYear,
        "No Pay Days": Number((adj.noPayDays || 0).toFixed(2)),
        "Salary Arrears": Number((adj.salaryArrears || 0).toFixed(2)),
        "Allowance Arrears": Number((adj.allowanceArrears || 0).toFixed(2)),
        "Holiday Works": Number((adj.holidayWorks || 0).toFixed(2)),
        "Extra Day Works": Number((adj.extraDayWorks || 0).toFixed(2)),
        "Night Shift Allowance": Number((adj.nightShiftAllowance || 0).toFixed(2)),
        "Overnight Allowance": Number((adj.overNightAllowance || 0).toFixed(2)),
        "OT Hours": Number((adj.overtimeHours || 0).toFixed(2)),
        "OT Arrears": Number((adj.otArrears || 0).toFixed(2)),
        "Welfare": Number((adj.welfare || 0).toFixed(2)),
        "Fine": Number((adj.fine || 0).toFixed(2)),
        "Loan": Number((adj.loan || 0).toFixed(2)),
        "Other Deductions": Number((adj.otherDeductions || 0).toFixed(2)),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Adjustments");
    
    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    downloadExcel(excelBase64, `Monthly_Variables_${selectedYear}_${selectedMonth + 1}`);
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <Shell>
      <div className="max-w-[1600px] mx-auto space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#014A6E] font-black text-[10px] uppercase tracking-[0.2em]">
              <GanttChart size={14} /> Workflow Module
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">Monthly <span className="text-blue-600">Variable Data</span></h1>
            <p className="text-slate-500 font-medium text-lg">Induct period-specific adjustments for the workforce registry.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {viewMode === "grid" && selectedIds.length > 0 && (
              <button
                onClick={handleClearSelected}
                disabled={isClearing}
                className="flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100 animate-in slide-in-from-right-4"
              >
                {isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Clear {selectedIds.length} Personnel Data
              </button>
            )}

            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              <button 
                onClick={() => setViewMode("form")}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  viewMode === "form" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <FileEdit size={14} /> Entry Form
              </button>
              <button 
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutGrid size={14} /> Period Registry
              </button>
            </div>

            {viewMode === "form" ? (
              <button 
                onClick={handleSave}
                disabled={isSaving || !selectedEmployeeId}
                className="btn-primary py-4 px-10 flex items-center gap-3 shadow-xl shadow-blue-200 active:scale-95 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Commit Period Data
              </button>
            ) : (
              <button 
                onClick={handleExportGrid}
                disabled={allAdjustments.length === 0}
                className="px-10 py-4 bg-[#014A6E] text-white rounded-2xl flex items-center gap-3 shadow-xl shadow-blue-200 active:scale-95 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                <Download size={18} className="text-[#8AC53E]" /> Export Excel
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Global Filter Panel */}
          <div className="xl:col-span-1 space-y-6">
             <div className="glass-panel p-8 bg-white border-slate-200 space-y-8 sticky top-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500" /> Fiscal Period Selection
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {viewMode === "form" && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                      <Users size={14} className="text-blue-500" /> Personnel Target
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select 
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="">Select Employee...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {selectedEmployee && (
                      <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 space-y-4 mt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#014A6E] flex items-center justify-center text-white font-black">
                            {selectedEmployee.fullName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#014A6E]">{selectedEmployee.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmployee.memberId}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "grid" && (
                  <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 space-y-2 animate-in fade-in duration-500 text-center">
                    <FileSpreadsheet size={32} className="mx-auto text-blue-400 mb-2" />
                    <p className="text-xs font-black text-blue-900 uppercase tracking-widest">{allAdjustments.length} Active Adjustments</p>
                    <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-widest">For {months[selectedMonth]} {selectedYear}</p>
                  </div>
                )}
             </div>
          </div>

          {/* Main Content Area */}
          <div className="xl:col-span-3 space-y-8">
            {showStatus && (
              <div className={cn(
                "p-6 rounded-3xl border flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500",
                showStatus === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl", showStatus === "success" ? "bg-emerald-100" : "bg-red-100")}>
                    {showStatus === "success" ? <CheckCircle2 size={20} className="text-emerald-600" /> : <ShieldAlert size={20} className="text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">
                      {showStatus === "success" ? "Period Registry Synchronized" : "Critical Sync Failure"}
                    </p>
                    <p className="text-[11px] font-bold opacity-70">
                      {showStatus === "success" 
                        ? `Monthly variable data for ${selectedEmployee?.fullName} has been committed for ${months[selectedMonth]} ${selectedYear}.`
                        : "An error occurred while communicating with the workforce database. Please check your connection."}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowStatus(null)} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                  <RotateCcw size={16} className="opacity-40" />
                </button>
              </div>
            )}

            {viewMode === "form" ? (
              !selectedEmployeeId ? (
                <div className="glass-panel h-[600px] border-dashed border-2 flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-50 bg-slate-50">
                  <Calculator size={48} className="text-slate-300" />
                  <h3 className="font-black text-slate-400 uppercase tracking-widest">Initialization Required</h3>
                  <p className="max-w-xs text-slate-400 text-sm font-medium italic">Please select the target personnel and fiscal period from the left panel to access the induction form.</p>
                </div>
              ) : (
                <div className={cn("space-y-8 transition-opacity duration-500", loading && "opacity-30 pointer-events-none")}>
                  
                  {/* Group 1: Basic Salary Adjustment */}
                  <div className="glass-panel p-10 bg-white border-slate-200 space-y-8 shadow-sm">
                    <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                        <Wallet size={20} />
                      </div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight italic">Group 1: <span className="text-amber-600">Basic Salary Adjustment</span></h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <InputField 
                        label="No Pay Days" 
                        value={adjustments.noPayDays} 
                        onChange={(v: number) => setAdjustments({...adjustments, noPayDays: v})} 
                        icon={<MinusCircle size={18} />}
                        suffix="DAYS"
                        color="red"
                      />
                      <InputField 
                        label="Salary Arrears Adjustment" 
                        value={adjustments.salaryArrears} 
                        onChange={(v: number) => setAdjustments({...adjustments, salaryArrears: v})} 
                        icon={<Coins size={18} />}
                        prefix="LKR"
                        color="amber"
                      />
                    </div>
                  </div>

                  {/* Group 2: Additions */}
                  <div className="glass-panel p-10 bg-white border-slate-200 space-y-8 shadow-sm">
                    <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <PlusCircle size={20} />
                      </div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight italic">Group 2: <span className="text-emerald-600">Additions (Variable)</span></h3>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Sub-panel 1: OT Processing */}
                      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">OT Processing</h4>
                          {selectedEmployee?.allowOvertime !== "Yes" && (
                            <span className="text-[9px] bg-red-50 border border-red-100 text-red-500 px-2 py-1 rounded-md font-black tracking-widest uppercase shadow-sm">Not Eligible</span>
                          )}
                        </div>
                        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 transition-all duration-300", selectedEmployee?.allowOvertime !== "Yes" && "opacity-40 pointer-events-none grayscale blur-[1px]")}>
                          <InputField label="OT Hours" value={adjustments.overtimeHours} onChange={(v: number) => setAdjustments({...adjustments, overtimeHours: v})} icon={<Briefcase size={18} />} suffix="HRS" color="blue" />
                          <InputField label="OT Arrears" value={adjustments.otArrears} onChange={(v: number) => setAdjustments({...adjustments, otArrears: v})} icon={<Coins size={18} />} prefix="LKR" color="lime" />
                        </div>
                      </div>

                      {/* Sub-panel 2: Statutory & Additions */}
                      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">Statutory & Additions</h4>
                          {selectedEmployee?.allowAllowance !== "Yes" && (
                            <span className="text-[9px] bg-red-50 border border-red-100 text-red-500 px-2 py-1 rounded-md font-black tracking-widest uppercase shadow-sm">Not Eligible</span>
                          )}
                        </div>
                        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 transition-all duration-300", selectedEmployee?.allowAllowance !== "Yes" && "opacity-40 pointer-events-none grayscale blur-[1px]")}>
                          <InputField label="Night Shift Allowance - A1" value={adjustments.nightShiftAllowance} onChange={(v: number) => setAdjustments({...adjustments, nightShiftAllowance: v})} icon={<Clock3 size={18} />} suffix="SHIFTS" color="indigo" />
                          <InputField label="Over Night Allowance - A2" value={adjustments.overNightAllowance} onChange={(v: number) => setAdjustments({...adjustments, overNightAllowance: v})} icon={<Clock3 size={18} />} suffix="COUNTS" color="violet" />
                          <InputField label="Extra Day Works - A3" value={adjustments.extraDayWorks} onChange={(v: number) => setAdjustments({...adjustments, extraDayWorks: v})} icon={<Calendar size={18} />} suffix="DAYS" color="emerald" />
                          <InputField label="Holiday Works - A4" value={adjustments.holidayWorks} onChange={(v: number) => setAdjustments({...adjustments, holidayWorks: v})} icon={<Calendar size={18} />} suffix="DAYS" color="emerald" />
                          <InputField label="Allowance Arrears" value={adjustments.allowanceArrears} onChange={(v: number) => setAdjustments({...adjustments, allowanceArrears: v})} icon={<Coins size={18} />} prefix="LKR" color="teal" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Deductions */}
                  <div className="glass-panel p-10 bg-white border-slate-200 space-y-8 shadow-sm">
                    <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                      <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                        <AlertCircle size={20} />
                      </div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight italic">Group 3: <span className="text-red-600">Deductions</span></h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
                      <InputField label="Welfare" value={adjustments.welfare} onChange={(v: number) => setAdjustments({...adjustments, welfare: v})} icon={<AlertCircle size={18}/>} prefix="LKR" color="rose" />
                      <InputField label="Fine" value={adjustments.fine} onChange={(v: number) => setAdjustments({...adjustments, fine: v})} icon={<AlertCircle size={18}/>} prefix="LKR" color="red" />
                      <InputField label="Loan" value={adjustments.loan} onChange={(v: number) => setAdjustments({...adjustments, loan: v})} icon={<Coins size={18}/>} prefix="LKR" color="orange" />
                      <InputField label="Other" value={adjustments.otherDeductions} onChange={(v: number) => setAdjustments({...adjustments, otherDeductions: v})} icon={<MinusCircle size={18}/>} prefix="LKR" color="slate" />
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="glass-panel bg-white border-slate-200 overflow-hidden animate-in fade-in duration-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-[#014A6E] border-b border-blue-100 bg-blue-50/50 w-12 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.length === employees.length && employees.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 text-[#8AC53E] focus:ring-[#8AC53E]"
                          />
                        </th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Employee Profile</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">B. Salary Adj</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Variable Additions</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Total Deductions</th>
                        <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-20 text-center text-slate-400 font-medium italic">No active personnel found in the registry.</td>
                        </tr>
                      ) : (
                        employees
                          .sort((a, b) => (a.memberId || "").localeCompare(b.memberId || "", undefined, { numeric: true }))
                          .map(emp => {
                          const adj = allAdjustments.find(a => a.employeeId === emp.id) || {};
                          const rates = globalRates.allowanceRates || {};
                          
                          const getRate = (name: string) => {
                            const master = allowanceTypes.find(t => t.name === name);
                            return master ? (rates[master.id] || 0) : 0;
                          };

                          const holidayVal = (adj.holidayWorks || 0) * getRate("Holiday Works");
                          const extraVal = (adj.extraDayWorks || 0) * getRate("Extra Day Works");
                          const nightVal = (adj.nightShiftAllowance || 0) * getRate("Night Shift Allowance");
                          const overVal = (adj.overNightAllowance || 0) * getRate("Overnight Allowance");

                          const dynamicSum = Object.entries(adj.dynamicAllowances || {}).reduce((sum: number, [id, val]: any) => sum + ((parseFloat(val) || 0) * (rates[id] || 1)), 0);
                          const totalAdd = (adj.allowanceArrears || 0) + (adj.otArrears || 0) + holidayVal + extraVal + nightVal + overVal + dynamicSum;
                          const totalDed = (adj.welfare || 0) + (adj.fine || 0) + (adj.loan || 0) + (adj.otherDeductions || 0);
                          
                          return (
                            <tr key={emp.id} className={cn("hover:bg-blue-50/30 transition-colors group", selectedIds.includes(emp.id) && "bg-blue-50/50")}>
                               <td className="p-6 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedIds.includes(emp.id)}
                                    onChange={() => toggleSelect(emp.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-[#8AC53E] focus:ring-[#8AC53E]"
                                  />
                                </td>
                              <td className="p-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                    {emp?.fullName?.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-800">{emp?.fullName || "Unregistered"}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp?.memberId || "N/A"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-red-600">No Pay: {(adj.noPayDays || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}d</p>
                                  <p className="text-xs font-bold text-amber-600">Arrears: {(adj.salaryArrears || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="space-y-1">
                                  <div className="flex gap-2">
                                    <p className="text-[10px] font-bold text-blue-600">OT: {(adj.overtimeHours || 0)}h</p>
                                    {adj.holidayWorks > 0 && <p className="text-[10px] font-bold text-emerald-600">H: {adj.holidayWorks}d</p>}
                                    {adj.extraDayWorks > 0 && <p className="text-[10px] font-bold text-emerald-600">Ex: {adj.extraDayWorks}d</p>}
                                  </div>
                                  <p className="text-xs font-bold text-[#014A6E]">Total Add: {totalAdd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                              </td>
                              <td className="p-6">
                                <p className="text-sm font-mono font-bold text-rose-600">{totalDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aggregate</p>
                              </td>
                              <td className="p-6 text-right">
                                <button 
                                  onClick={() => {
                                    setSelectedEmployeeId(emp.id);
                                    setViewMode("form");
                                  }}
                                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                                >
                                  <FileEdit size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function InputField({ label, value, onChange, icon, prefix, suffix, color }: any) {
  const colors: any = {
    red: "focus:ring-red-100 bg-red-50/30",
    rose: "focus:ring-rose-100 bg-rose-50/30",
    amber: "focus:ring-amber-100 bg-amber-50/30",
    emerald: "focus:ring-emerald-100 bg-emerald-50/30",
    indigo: "focus:ring-indigo-100 bg-indigo-50/30",
    violet: "focus:ring-violet-100 bg-violet-50/30",
    blue: "focus:ring-blue-100 bg-blue-50/30",
    teal: "focus:ring-teal-100 bg-teal-50/30",
    lime: "focus:ring-lime-100 bg-lime-50/30",
    orange: "focus:ring-orange-100 bg-orange-50/30",
    slate: "focus:ring-slate-100 bg-slate-50/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      </div>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
          {icon}
        </div>
        {prefix && <span className="absolute left-12 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{prefix}</span>}
        <input 
          type="number" 
          step="0.01"
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn(
            "w-full border border-slate-200 rounded-2xl py-4 font-mono font-bold text-slate-700 outline-none transition-all",
            prefix ? "pl-20" : "pl-12",
            suffix ? "pr-16" : "pr-4",
            colors[color] || "bg-slate-50"
          )}
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
