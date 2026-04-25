"use client";

import { Shell } from "@/components/Shell";
import {
  Users, UserCheck, ArrowUpRight, ArrowLeftRight, AlertTriangle,
  GraduationCap, FileText, History, MoreVertical, Search, Filter, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn, downloadExcel } from "@/lib/utils";
import * as XLSX from "xlsx";

import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { X, Briefcase, Building, ShieldCheck, Download, Edit3, Save, Check, DollarSign, CreditCard } from "lucide-react";
import { notifyRecordChange } from "@/lib/notifications";

const hrActions = [
  { name: "Confirmations", icon: UserCheck, count: 0, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", border: "border-emerald-200" },
  { name: "Promotions", icon: ArrowUpRight, count: 0, iconBg: "bg-blue-100", iconColor: "text-blue-600", border: "border-blue-200" },
  { name: "Transfers", icon: ArrowLeftRight, count: 0, iconBg: "bg-violet-100", iconColor: "text-violet-600", border: "border-violet-200" },
  { name: "Disciplinary", icon: AlertTriangle, count: 0, iconBg: "bg-red-100", iconColor: "text-red-600", border: "border-red-200" },
  { name: "Trainings", icon: GraduationCap, count: 0, iconBg: "bg-amber-100", iconColor: "text-amber-600", border: "border-amber-200" },
  { name: "Resignations", icon: History, count: 0, iconBg: "bg-slate-100", iconColor: "text-slate-500", border: "border-slate-200" },
];

export default function HRPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, resigned: 0 });
  const [resignationData, setResignationData] = useState({
    resignationDate: "",
    lastWorkingDay: "",
    reason: "",
    clearanceStatus: "Pending"
  });
  const [mastersData, setMastersData] = useState<any>({});

  useEffect(() => {
    // Sort by memberId (EPF No) as requested
    const q = query(collection(db, "employees"), orderBy("memberId", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setEmployees(data);
      
      setLoading(false);
      setCounts({
        pending: data.filter(e => e.status === "Pending Approval").length,
        resigned: data.filter(e => e.status === "Resigned").length
      });
    }, (error) => {
      console.error("Firesore stream error:", error);
      setLoading(false);
    });

    // Fetch Masters for Dropdowns
    const mastersQ = query(collection(db, "masters"));
    const unsubMasters = onSnapshot(mastersQ, (snapshot) => {
      const masters: any = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!masters[data.category]) masters[data.category] = [];
        masters[data.category].push({ id: doc.id, ...data });
      });
      setMastersData(masters);
    });

    return () => {
      unsubscribe();
      unsubMasters();
    };
  }, []);

  const handleManageIdentity = (emp: any) => {
    setSelectedEmployee({ ...emp });
    setIsEditModalOpen(true);
  };

  const handleUpdateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "employees", selectedEmployee.id);
      await updateDoc(docRef, { ...selectedEmployee });
      
      // Notify Admin
      await notifyRecordChange(
        selectedEmployee.fullName || "Unnamed", 
        selectedEmployee.memberId || "N/A", 
        "Identity & Demographics Correction"
      );

      alert("✅ Identity parameters updated successfully in the registry.");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Registry update failure:", error);
      alert("❌ Critical Error: Identity modification rejected by security layer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateSalaries = (data: any) => {
    if (!data) return true;
    const gross = parseFloat(data.grossSalary) || 0;
    const b1 = parseFloat(data.basicSalary1) || 0;
    const b2 = parseFloat(data.basicSalary2) || 0;
    const f1 = parseFloat(data.fixedAllowance1) || 0;
    const f2 = parseFloat(data.fixedAllowance2) || 0;
    const f3 = parseFloat(data.fixedAllowance3) || 0;
    
    // 1. Scale Validation
    if (data.salaryScale && mastersData["Salary Scales"]) {
      const scale = mastersData["Salary Scales"]?.find((m: any) => m.name === data.salaryScale);
      if (scale) {
        const min = parseFloat(scale.salaryRangeMin) || 0;
        const max = parseFloat(scale.salaryRangeMax) || 0;
        if (gross > 0 && (gross < min || gross > max)) {
          alert(`⚠️ Salary Scale Violation!\n\nThe entered Gross Salary (LKR ${gross.toLocaleString()}) falls outside the selected scale [${data.salaryScale}] range:\nMin: LKR ${min.toLocaleString()}\nMax: LKR ${max.toLocaleString()}`);
          return false;
        }
      }
    }

    // 2. Sum Validation
    const componentSum = b1 + b2 + f1 + f2 + f3;
    if (gross > 0 && componentSum > 0 && Math.abs(componentSum - gross) > 0.01) {
      alert(`❌ Fiscal Mismatch Detected!\n\nThe sum of Basic Salaries and Fixed Allowances (LKR ${componentSum.toLocaleString()}) does not match the Gross Salary Control (LKR ${gross.toLocaleString()}).\n\nPlease reconcile the components before proceeding.`);
      return false;
    }
    
    return true;
  };

  const handleResignEmployee = async () => {
    if (!selectedEmployee || !resignationData.resignationDate || !resignationData.lastWorkingDay) {
      alert("Please provide the resignation date and last working day.");
      return;
    }

    if (!confirm(`WARNING: You are about to mark ${selectedEmployee.fullName} as RESIGNED. This will terminate their active status in the payroll loop. Proceed?`)) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "employees", selectedEmployee.id);
      await updateDoc(docRef, {
        status: "Resigned",
        resignationDetails: {
          ...resignationData,
          updatedAt: new Date().toISOString()
        }
      });

      await notifyRecordChange(
        selectedEmployee.fullName || "Unnamed", 
        selectedEmployee.memberId || "N/A", 
        "Employment Separation (Resignation)"
      );

      alert("✅ Resignation successfully processed. Employee status updated to 'Resigned'.");
      setIsResigning(false);
      setIsEditModalOpen(false);
    } catch (error) {
      alert("❌ Failed to process resignation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSaveLogistics = async () => {
    if (!selectedEmployee) return;

    // Strict Fiscal Validation
    if (!validateSalaries(selectedEmployee)) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "employees", selectedEmployee.id);
      await updateDoc(docRef, {
        fullName: selectedEmployee.fullName || "",
        permanentAddress: selectedEmployee.permanentAddress || "",
        idPassportNo: selectedEmployee.idPassportNo || "",
        dob: selectedEmployee.dob || "",
        gender: selectedEmployee.gender || "Male",
        civilStatus: selectedEmployee.civilStatus || "Unmarried",
        religion: selectedEmployee.religion || "",
        division: selectedEmployee.division || "",
        department: selectedEmployee.department || "",
        designation: selectedEmployee.designation || "",
        jointDate: selectedEmployee.jointDate || "",
        appointmentDate: selectedEmployee.appointmentDate || "",
        employeeType: selectedEmployee.employeeType || "",
        salaryScale: selectedEmployee.salaryScale || "",
        epfActive: selectedEmployee.epfActive || "No",
        grossSalary: selectedEmployee.grossSalary || "",
        entitledLeave: selectedEmployee.entitledLeave || "",
        epfApplicable: selectedEmployee.epfApplicable || "No",
        allowAllowance: selectedEmployee.allowAllowance || "No",
        allowOvertime: selectedEmployee.allowOvertime || "No",
        basicSalary1: selectedEmployee.basicSalary1 || "",
        basicSalary2: selectedEmployee.basicSalary2 || "",
        fixedAllowance1: selectedEmployee.fixedAllowance1 || "",
        fixedAllowance2: selectedEmployee.fixedAllowance2 || "",
        fixedAllowance3: selectedEmployee.fixedAllowance3 || "",
        bank1: selectedEmployee.bank1 || {},
        bank2: selectedEmployee.bank2 || {},
        approvedLogisticsUpdatedAt: new Date().toISOString()
      });

      // Notify Admin
      await notifyRecordChange(
        selectedEmployee.fullName || "Unnamed", 
        selectedEmployee.memberId || "N/A", 
        "Logistics & Fiscal Structure Update"
      );

      alert("✅ Logistics & Fiscal record successfully optimized. Timestamp logged.");
      setIsEditingDossier(false);
    } catch (error) {
      console.error("Failed to commit logistics change:", error);
      alert("❌ Failed to save logistics parameters.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.memberId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.division?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Comprehensive column mapping for "All Fields"
    // Comprehensive column mapping for "All Fields"
    const exportColumns = [
      { key: 'memberId', label: 'EPF Number' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'nameWithInitials', label: 'Name with Initials' },
      { key: 'idPassportNo', label: 'ID / Passport No' },
      { key: 'email', label: 'Official Email' },
      { key: 'contactNo', label: 'Contact No' },
      { key: 'gender', label: 'Gender' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'religion', label: 'Religion' },
      { key: 'civilStatus', label: 'Civil Status' },
      { key: 'permanentAddress', label: 'Permanent Address' },
      { key: 'division', label: 'Division' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'employeeType', label: 'Employee Type' },
      { key: 'salaryScale', label: 'Salary Scale' },
      { key: 'status', label: 'Registry Status' },
      { key: 'jointDate', label: 'Joining Date' },
      { key: 'appointmentDate', label: 'Appointment Date' },
      { key: 'qualification', label: 'Qualification' },
      { key: 'experience', label: 'Experience' },
      { key: 'grossSalary', label: 'Gross Salary' },
      { key: 'basicSalary1', label: 'Basic Salary 1' },
      { key: 'basicSalary2', label: 'Basic Salary 2/BR' },
      { key: 'fixedAllowance1', label: 'Fixed Allowance 1' },
      { key: 'fixedAllowance2', label: 'Fixed Allowance 2' },
      { key: 'fixedAllowance3', label: 'Fixed Allowance 3' },
      { key: 'epfActive', label: 'EPF Active Protocol' },
      { key: 'allowAllowance', label: 'Standard Allowance' },
      { key: 'allowOvertime', label: 'Overtime Enable' },
      { key: 'entitledLeave', label: 'Entitled Leave' },
      { key: 'specialNote', label: 'Initial Induction Note' },
      { key: 'bank1Name', label: 'Bank 1 Name' },
      { key: 'bank1Branch', label: 'Bank 1 Branch' },
      { key: 'bank1BranchId', label: 'Bank 1 Branch ID' },
      { key: 'bank1Account', label: 'Bank 1 Account' },
      { key: 'bank1Active', label: 'Bank 1 Protocol' },
      { key: 'bank2Name', label: 'Bank 2 Name' },
      { key: 'bank2Branch', label: 'Bank 2 Branch' },
      { key: 'bank2BranchId', label: 'Bank 2 Branch ID' },
      { key: 'bank2Account', label: 'Bank 2 Account' },
      { key: 'bank2Active', label: 'Bank 2 Protocol' }
    ];

    const data = filteredEmployees.map(emp => {
      const row: any = {};
      exportColumns.forEach(col => {
        // Handle nested bank objects if they aren't flattened in the emp object
        if (col.key === 'bank1Name') row[col.label] = emp.bank1?.name || "N/A";
        else if (col.key === 'bank1Branch') row[col.label] = emp.bank1?.branch || "N/A";
        else if (col.key === 'bank1BranchId') row[col.label] = emp.bank1?.branchId || "N/A";
        else if (col.key === 'bank1Account') row[col.label] = emp.bank1?.accountNo || "N/A";
        else if (col.key === 'bank1Active') row[col.label] = emp.bank1?.isActive ? "ENABLED" : "DISABLED";
        else if (col.key === 'bank2Name') row[col.label] = emp.bank2?.name || "N/A";
        else if (col.key === 'bank2Branch') row[col.label] = emp.bank2?.branch || "N/A";
        else if (col.key === 'bank2BranchId') row[col.label] = emp.bank2?.branchId || "N/A";
        else if (col.key === 'bank2Account') row[col.label] = emp.bank2?.accountNo || "N/A";
        else if (col.key === 'bank2Active') row[col.label] = emp.bank2?.isActive ? "ENABLED" : "DISABLED";
        else row[col.label] = (emp as any)[col.key] || "N/A";
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "EmployeeData");
    
    // Base64 logic to bypass browser naming issues
    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    downloadExcel(excelBase64, `HR_Employee_Directory_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <Shell>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8AC53E]">Human Resources</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">HR Management</h1>
            <p className="text-slate-500 text-base font-medium">
              Manage employee lifecycles, events, and performance tracking.
            </p>
          </div>
          <button className="btn-primary flex items-center gap-2 self-start md:self-auto shadow-xl shadow-lime-200">
            <FileText size={17} /> Generate HR Letter
          </button>
        </div>

        {/* HR Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {hrActions.map((action) => {
            const displayCount = action.name === "Confirmations" ? counts.pending : (action.name === "Resignations" ? counts.resigned : 0);
            return (
              <div
                key={action.name}
                className={cn(
                  "glass-card p-5 flex flex-col items-center gap-3 cursor-pointer hover:-translate-y-1 transition-all duration-300",
                  "border", action.border
                )}
              >
                <div className={cn("p-3 rounded-2xl", action.iconBg)}>
                  <action.icon size={22} className={action.iconColor} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">{action.name}</p>
                <p className="text-2xl font-black text-slate-800">{displayCount}</p>
              </div>
            );
          })}
        </div>

        {/* Employee Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-[#8AC53E]" />
              Employee Directory
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={17} />
                <input
                  type="text"
                  placeholder="Registry search (Name, ID, Division)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-12 py-3 text-sm"
                />
              </div>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-5 py-3 bg-[#014A6E] border border-transparent rounded-2xl text-sm font-black text-white hover:bg-[#8AC53E] transition-all shadow-md shadow-[#014A6E]/20"
              >
                <Download size={15} /> Export Excel
              </button>
            </div>
          </div>

          <div className="glass-panel overflow-hidden border-slate-200">
            <table className="w-full text-left font-medium">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Employee Identity", "Organisation", "Joined", "Registry Status", "Actions"].map((h) => (
                    <th key={h} className={cn("p-5 text-[10px] font-black uppercase tracking-widest text-slate-400", h === "Actions" && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <Loader2 className="animate-spin text-[#8AC53E] mx-auto mb-3" size={32} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Registry...</span>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic text-sm">
                      No active employee records found in the current buffer.
                    </td>
                  </tr>
                ) : filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="table-row group cursor-pointer hover:bg-slate-50/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center font-black text-slate-300 shadow-sm">
                          {emp.profileImage ? (
                            <img src={emp.profileImage} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            emp.fullName?.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#014A6E] tracking-tight group-hover:text-[#8AC53E] transition-colors">{emp.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{emp.memberId || "UNASSIGNED"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-tight">{emp.designation || "N/A"}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">{emp.division || "No Division"}</p>
                    </td>
                    <td className="p-5 text-xs font-bold text-slate-500 font-mono italic">
                      {emp.jointDate || "Pending"}
                    </td>
                    <td className="p-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        emp.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : emp.status === "Pending Approval"
                            ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                      )}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => {
                            // Route to the view dossier screen
                            setSelectedEmployee(emp);
                            setIsEditingDossier(false);
                            setIsEditModalOpen(true);
                          }}
                          className="px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-200 transition-all"
                        >
                          View Dossier
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Identity Correction Modal */}
      {isEditModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 drop-shadow-2xl">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsEditModalOpen(false)} />

          <div className="relative w-full max-w-5xl bg-white rounded-[40px] border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-500">
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 border border-cyan-100 shadow-inner">
                    <UserCheck size={26} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Identity <span className="text-cyan-600">Dossier</span></h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Registry Profile: {selectedEmployee.memberId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[65vh] pr-4 custom-scrollbar">
                <div className="space-y-8">

                  {/* Quick Profile Section */}
                  <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 overflow-hidden shadow-sm flex items-center justify-center shrink-0">
                      {selectedEmployee.profileImage ? (
                        <img src={selectedEmployee.profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-black text-slate-300">{selectedEmployee.fullName?.charAt(0) || "?"}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-cyan-900 tracking-tight">{selectedEmployee.fullName}</h4>
                      <p className="text-sm font-bold text-slate-500 mt-1">{selectedEmployee.designation || "N/A"}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-cyan-200">
                          {selectedEmployee.department || "No Dept"}
                        </span>
                        <span className="px-2 py-1 bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 shadow-sm">
                          {selectedEmployee.status || "Unknown"}
                        </span>
                      </div>
                    </div>
                      <div className="space-y-12">
                        {/* Phase 0: Personal Demographics & Identification */}
                        <div className={cn("p-8 rounded-[32px] border transition-all", isEditingDossier ? "bg-[#8AC53E]/5 border-lime-200 shadow-xl" : "bg-slate-50 border-slate-100")}>
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E] mb-8 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center text-lime-600">
                              <Users size={16} />
                            </div>
                            Personal Demographics & Identification
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Full Name</p>
                               {isEditingDossier ? (
                                 <input type="text" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.fullName || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, fullName: e.target.value })} />
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.fullName || "N/A"}</p>}
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">NIC / Passport No</p>
                               {isEditingDossier ? (
                                 <input type="text" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.idPassportNo || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, idPassportNo: e.target.value })} />
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.idPassportNo || "N/A"}</p>}
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Date of Birth</p>
                               {isEditingDossier ? (
                                 <input type="date" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.dob || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, dob: e.target.value })} />
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.dob || "N/A"}</p>}
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Gender</p>
                               {isEditingDossier ? (
                                 <select className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.gender || "Male"} onChange={e => setSelectedEmployee({ ...selectedEmployee, gender: e.target.value })}>
                                   <option value="Male">Male</option>
                                   <option value="Female">Female</option>
                                 </select>
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.gender || "Male"}</p>}
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Civil Status</p>
                               {isEditingDossier ? (
                                 <select className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.civilStatus || "Unmarried"} onChange={e => setSelectedEmployee({ ...selectedEmployee, civilStatus: e.target.value })}>
                                   <option value="Unmarried">Unmarried</option>
                                   <option value="Married">Married</option>
                                   <option value="Divorced">Divorced</option>
                                   <option value="Widowed">Widowed</option>
                                 </select>
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.civilStatus || "Unmarried"}</p>}
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Religion</p>
                               {isEditingDossier ? (
                                 <input type="text" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.religion || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, religion: e.target.value })} />
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.religion || "N/A"}</p>}
                             </div>
                             <div className="md:col-span-3 space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Permanent Residence</p>
                               {isEditingDossier ? (
                                 <textarea rows={2} className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1 resize-none" value={selectedEmployee.permanentAddress || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, permanentAddress: e.target.value })} />
                               ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.permanentAddress || "N/A"}</p>}
                             </div>
                          </div>
                        </div>
                    {/* Phase 1: Hierarchy & Appointment */}
                    <div className={cn("p-8 rounded-[32px] border transition-all", isEditingDossier ? "bg-white border-blue-200 shadow-xl" : "bg-slate-50 border-slate-100")}>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E] mb-8 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                           <Users size={16} />
                        </div>
                        Corporate Hierarchy & Appointment
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Division (Master)</p>
                          <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.division || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Operational Unit (Master)</p>
                          <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.department || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Designation (Master)</p>
                          <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.designation || "N/A"}</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[9px] font-black uppercase text-slate-400">Date of Joining</p>
                           {isEditingDossier ? (
                             <input type="date" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.jointDate || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, jointDate: e.target.value })} />
                           ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.jointDate || "N/A"}</p>}
                        </div>
                        <div className="space-y-2">
                           <p className="text-[9px] font-black uppercase text-slate-400">Appointment Date</p>
                           {isEditingDossier ? (
                             <input type="date" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none mt-1" value={selectedEmployee.appointmentDate || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, appointmentDate: e.target.value })} />
                           ) : <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.appointmentDate || "N/A"}</p>}
                        </div>
                        <div className="space-y-2">
                           <p className="text-[9px] font-black uppercase text-slate-400">Contract Modality (Master)</p>
                           <p className="text-xs font-bold text-slate-700 bg-slate-100/50 p-3 rounded-xl border border-dashed border-slate-200">{selectedEmployee.employeeType || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Phase 2: Fiscal Matrix Reconstruction */}
                    <div className={cn("p-8 rounded-[32px] border transition-all", isEditingDossier ? "bg-[#014A6E]/5 border-blue-300 shadow-xl" : "bg-slate-50 border-slate-100")}>
                       <div className="flex items-center justify-between mb-8">
                         <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                             <DollarSign size={16} />
                           </div>
                           Fiscal Structure & Compensation
                         </h5>
                         {isEditingDossier && (
                           <div className={cn(
                             "px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                             Math.abs((parseFloat(selectedEmployee.basicSalary1) || 0) + (parseFloat(selectedEmployee.basicSalary2) || 0) + (parseFloat(selectedEmployee.fixedAllowance1) || 0) + (parseFloat(selectedEmployee.fixedAllowance2) || 0) + (parseFloat(selectedEmployee.fixedAllowance3) || 0) - (parseFloat(selectedEmployee.grossSalary) || 0)) < 0.01
                             ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                             : "bg-red-50 border-red-100 text-red-600 animate-pulse"
                           )}>
                              {Math.abs((parseFloat(selectedEmployee.basicSalary1) || 0) + (parseFloat(selectedEmployee.basicSalary2) || 0) + (parseFloat(selectedEmployee.fixedAllowance1) || 0) + (parseFloat(selectedEmployee.fixedAllowance2) || 0) + (parseFloat(selectedEmployee.fixedAllowance3) || 0) - (parseFloat(selectedEmployee.grossSalary) || 0)) < 0.01 
                              ? "✓ Matrix Reconciled" 
                              : "⚠ Fiscal Imbalance"}
                           </div>
                         )}
                       </div>

                       <div className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Salary Scale (Master)</p>
                               <p className="p-3 bg-white/50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-600">{selectedEmployee.salaryScale || "N/A"}</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Gross Salary Control</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-[#014A6E] bg-white border border-[#014A6E]/30 rounded-lg p-3 focus:ring-1 outline-none" value={selectedEmployee.grossSalary || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, grossSalary: e.target.value })} />
                               ) : <p className="p-3 bg-white/50 border border-slate-200 rounded-xl text-xs font-mono font-black text-[#014A6E]">LKR {Number(selectedEmployee.grossSalary || 0).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-2">
                               <p className="text-[9px] font-black uppercase text-slate-400">Entitled Leave</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-3 focus:ring-1 outline-none" value={selectedEmployee.entitledLeave || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, entitledLeave: e.target.value })} />
                               ) : <p className="p-3 bg-white/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">{selectedEmployee.entitledLeave || "N/A"}</p>}
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6 bg-white/40 border border-slate-200 rounded-2xl">
                            <div className="space-y-2">
                               <p className="text-[8px] font-black uppercase text-slate-400">Basic I</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none text-center" value={selectedEmployee.basicSalary1 || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, basicSalary1: e.target.value })} />
                               ) : <p className="text-xs font-mono font-bold text-slate-600">LKR {Number(selectedEmployee.basicSalary1 || 0).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-2">
                               <p className="text-[8px] font-black uppercase text-slate-400">Basic II / BR</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none text-center" value={selectedEmployee.basicSalary2 || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, basicSalary2: e.target.value })} />
                               ) : <p className="text-xs font-mono font-bold text-slate-600">LKR {Number(selectedEmployee.basicSalary2 || 0).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-2 font-mono">
                               <p className="text-[8px] font-black uppercase text-slate-400">Fixed Allow I</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none text-center" value={selectedEmployee.fixedAllowance1 || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, fixedAllowance1: e.target.value })} />
                               ) : <p className="text-xs font-mono font-bold text-slate-600">LKR {Number(selectedEmployee.fixedAllowance1 || 0).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-2">
                               <p className="text-[8px] font-black uppercase text-slate-400">Fixed Allow II</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none text-center" value={selectedEmployee.fixedAllowance2 || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, fixedAllowance2: e.target.value })} />
                               ) : <p className="text-xs font-mono font-bold text-slate-600">LKR {Number(selectedEmployee.fixedAllowance2 || 0).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-2">
                               <p className="text-[8px] font-black uppercase text-slate-400">Fixed Allow III</p>
                               {isEditingDossier ? (
                                  <input type="text" className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none text-center" value={selectedEmployee.fixedAllowance3 || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, fixedAllowance3: e.target.value })} />
                               ) : <p className="text-xs font-mono font-bold text-slate-600">LKR {Number(selectedEmployee.fixedAllowance3 || 0).toLocaleString()}</p>}
                            </div>
                         </div>
                       </div>
                    </div>

                    {/* Phase 3: Banking & Statutory Protocols */}
                    <div className={cn("p-8 rounded-[32px] border transition-all", isEditingDossier ? "bg-white border-blue-200 shadow-xl" : "bg-slate-50 border-slate-100")}>
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E] mb-8 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                             <CreditCard size={16} />
                           </div>
                           Banking & Statutory Protocols
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           {/* Bank 1 */}
                           <div className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
                              <div className="flex items-center justify-between">
                                 <p className="text-[10px] font-black uppercase text-[#014A6E]">Primary Bank Path</p>
                                 <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-full">Always Active</div>
                              </div>
                              <div className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                         <p className="text-[8px] font-black uppercase text-slate-400">Institution</p>
                                         {isEditingDossier ? (
                                           <select className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" value={selectedEmployee.bank1?.name || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank1: { ...selectedEmployee.bank1, name: e.target.value } })}>
                                             <option value="">Select Bank</option>
                                             {mastersData["Bank Branches"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                                           </select>
                                         ) : <p className="text-[11px] font-bold text-slate-700">{selectedEmployee.bank1?.name || "N/A"}</p>}
                                     </div>
                                     <div className="space-y-1">
                                         <p className="text-[8px] font-black uppercase text-slate-400">Branch</p>
                                         {isEditingDossier ? (
                                           <input type="text" className="w-full text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" value={selectedEmployee.bank1?.branch || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank1: { ...selectedEmployee.bank1, branch: e.target.value } })} />
                                         ) : <p className="text-[11px] font-bold text-slate-700">{selectedEmployee.bank1?.branch || "N/A"}</p>}
                                     </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <p className="text-[8px] font-black uppercase text-slate-400">Branch ID / Code</p>
                                          {isEditingDossier ? (
                                            <input type="text" className="w-full text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" value={selectedEmployee.bank1?.branchId || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank1: { ...selectedEmployee.bank1, branchId: e.target.value } })} />
                                          ) : <p className="text-[11px] font-mono font-bold text-[#014A6E]">{selectedEmployee.bank1?.branchId || "N/A"}</p>}
                                      </div>
                                     <div className="space-y-1">
                                         <p className="text-[8px] font-black uppercase text-slate-400">Account No</p>
                                         {isEditingDossier ? (
                                           <input type="text" className="w-full text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" value={selectedEmployee.bank1?.accountNo || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank1: { ...selectedEmployee.bank1, accountNo: e.target.value } })} />
                                         ) : <p className="text-xs font-mono font-black text-[#014A6E]">{selectedEmployee.bank1?.accountNo || "N/A"}</p>}
                                     </div>
                                  </div>
                              </div>
                           </div>

                           {/* Bank 2 */}
                           <div className={cn("p-6 border rounded-2xl space-y-4 transition-all", selectedEmployee.bank2?.isActive ? "bg-white border-blue-200 shadow-sm" : "bg-slate-100/50 border-slate-100 opacity-60")}>
                              <div className="flex items-center justify-between">
                                 <p className="text-[10px] font-black uppercase text-[#014A6E]">Secondary Bank Path</p>
                                 {isEditingDossier && (
                                   <button 
                                     onClick={() => setSelectedEmployee({ ...selectedEmployee, bank2: { ...(selectedEmployee.bank2 || {}), isActive: !selectedEmployee.bank2?.isActive } })}
                                     className={cn("px-2 py-1 rounded text-[8px] font-black uppercase", selectedEmployee.bank2?.isActive ? "bg-[#8AC53E] text-white" : "bg-slate-300 text-slate-500")}
                                   >
                                     {selectedEmployee.bank2?.isActive ? "ENABLED" : "DISABLED"}
                                   </button>
                                 )}
                              </div>
                              <div className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                         <p className="text-[8px] font-black uppercase text-slate-400">Institution</p>
                                         {isEditingDossier ? (
                                           <select className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" disabled={!selectedEmployee.bank2?.isActive} value={selectedEmployee.bank2?.name || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank2: { ...selectedEmployee.bank2, name: e.target.value } })}>
                                             <option value="">Select Bank</option>
                                             {mastersData["Bank Branches"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                                           </select>
                                         ) : <p className="text-[11px] font-bold text-slate-700">{selectedEmployee.bank2?.name || "N/A"}</p>}
                                     </div>
                                     <div className="space-y-1">
                                         <p className="text-[8px] font-black uppercase text-slate-400">Branch</p>
                                         {isEditingDossier ? (
                                           <input type="text" className="w-full text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" disabled={!selectedEmployee.bank2?.isActive} value={selectedEmployee.bank2?.branch || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank2: { ...selectedEmployee.bank2, branch: e.target.value } })} />
                                         ) : <p className="text-[11px] font-bold text-slate-700">{selectedEmployee.bank2?.branch || "N/A"}</p>}
                                     </div>
                                 </div>
                                 <div className="space-y-1">
                                     <p className="text-[8px] font-black uppercase text-slate-400">Account No</p>
                                     {isEditingDossier ? (
                                       <input type="text" className="w-full text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 outline-none mt-1" disabled={!selectedEmployee.bank2?.isActive} value={selectedEmployee.bank2?.accountNo || ""} onChange={e => setSelectedEmployee({ ...selectedEmployee, bank2: { ...selectedEmployee.bank2, accountNo: e.target.value } })} />
                                     ) : <p className="text-xs font-mono font-black text-[#014A6E]">{selectedEmployee.bank2?.accountNo || "N/A"}</p>}
                                 </div>
                              </div>
                           </div>

                           <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[24px]">
                                 <p className="text-[9px] font-black uppercase text-slate-400 mb-4">EPF Active Protocol</p>
                                 {isEditingDossier ? (
                                   <select className="w-full text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none" value={selectedEmployee.epfActive || "No"} onChange={e => setSelectedEmployee({ ...selectedEmployee, epfActive: e.target.value })}>
                                     <option value="Yes">Yes (Enabled)</option>
                                     <option value="No">No (Disabled)</option>
                                   </select>
                                 ) : (
                                   <span className={cn("px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border block text-center shadow-sm", selectedEmployee.epfActive === "Yes" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100")}>
                                       {selectedEmployee.epfActive || "No"}
                                   </span>
                                 )}
                              </div>
                              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[24px]">
                                 <p className="text-[9px] font-black uppercase text-slate-400 mb-4">Standard Allowance</p>
                                 {isEditingDossier ? (
                                   <select className="w-full text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none" value={selectedEmployee.allowAllowance || "No"} onChange={e => setSelectedEmployee({ ...selectedEmployee, allowAllowance: e.target.value })}>
                                     <option value="Yes">Yes (Enabled)</option>
                                     <option value="No">No (Disabled)</option>
                                   </select>
                                 ) : (
                                   <span className={cn("px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border block text-center shadow-sm", selectedEmployee.allowAllowance === "Yes" ? "bg-cyan-50 text-cyan-700 border-cyan-100" : "bg-slate-200 text-slate-400 border-slate-300")}>
                                       {selectedEmployee.allowAllowance || "No"}
                                   </span>
                                 )}
                              </div>
                              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[24px]">
                                 <p className="text-[9px] font-black uppercase text-slate-400 mb-4">Overtime Entitlement</p>
                                 {isEditingDossier ? (
                                   <select className="w-full text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none" value={selectedEmployee.allowOvertime || "No"} onChange={e => setSelectedEmployee({ ...selectedEmployee, allowOvertime: e.target.value })}>
                                     <option value="Yes">Yes (Enabled)</option>
                                     <option value="No">No (Disabled)</option>
                                   </select>
                                 ) : (
                                   <span className={cn("px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border block text-center shadow-sm", selectedEmployee.allowOvertime === "Yes" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-slate-200 text-slate-500 border-slate-300")}>
                                       {selectedEmployee.allowOvertime || "No"}
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                    </div>

                    {/* Phase 4: Separation & Resignation (New Option) */}
                    <div className={cn(
                      "p-8 rounded-[32px] border transition-all mt-8", 
                      selectedEmployee.status === "Resigned" ? "bg-red-50/50 border-red-200" : "bg-slate-50 border-slate-100"
                    )}>
                        <div className="flex items-center justify-between mb-8">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                                <History size={16} />
                              </div>
                              Separation & Resignation
                           </h5>
                           {selectedEmployee.status === "Active" && !isResigning && (
                             <button 
                               onClick={() => setIsResigning(true)}
                               className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                             >
                               Initiate Resignation
                             </button>
                           )}
                        </div>

                        {isResigning || selectedEmployee.status === "Resigned" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-300">
                             <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400">Resignation Date</p>
                                <input 
                                  type="date" 
                                  disabled={selectedEmployee.status === "Resigned"}
                                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 outline-none" 
                                  value={isResigning ? resignationData.resignationDate : selectedEmployee.resignationDetails?.resignationDate || ""} 
                                  onChange={e => setResignationData({...resignationData, resignationDate: e.target.value})} 
                                />
                             </div>
                             <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400">Last Working Day</p>
                                <input 
                                  type="date" 
                                  disabled={selectedEmployee.status === "Resigned"}
                                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 outline-none" 
                                  value={isResigning ? resignationData.lastWorkingDay : selectedEmployee.resignationDetails?.lastWorkingDay || ""} 
                                  onChange={e => setResignationData({...resignationData, lastWorkingDay: e.target.value})} 
                                />
                             </div>
                             <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400">Reason for Leaving</p>
                                <select 
                                  disabled={selectedEmployee.status === "Resigned"}
                                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 outline-none"
                                  value={isResigning ? resignationData.reason : selectedEmployee.resignationDetails?.reason || ""}
                                  onChange={e => setResignationData({...resignationData, reason: e.target.value})}
                                >
                                  <option value="">Select Reason...</option>
                                  <option value="Resigned">Resigned</option>
                                  <option value="Terminated">Terminated</option>
                                  <option value="Mutual Separation">Mutual Separation</option>
                                  <option value="Abandonment">Abandonment (Dropout)</option>
                                  <option value="Retired">Retired</option>
                                </select>
                             </div>
                             <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400">Clearance Status</p>
                                <select 
                                  disabled={selectedEmployee.status === "Resigned"}
                                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 outline-none"
                                  value={isResigning ? resignationData.clearanceStatus : selectedEmployee.resignationDetails?.clearanceStatus || ""}
                                  onChange={e => setResignationData({...resignationData, clearanceStatus: e.target.value})}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Cleared">Cleared</option>
                                </select>
                             </div>

                             {isResigning && (
                               <div className="lg:col-span-4 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                                  <button onClick={() => setIsResigning(false)} className="text-[10px] font-black uppercase text-slate-400 px-4 py-2 hover:text-slate-600">Cancel</button>
                                  <button 
                                    onClick={handleResignEmployee}
                                    className="bg-red-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
                                  >
                                    Confirm Separation
                                  </button>
                               </div>
                             )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-center opacity-40">
                             <Check size={32} className="text-emerald-500 mb-2" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Employee is currently Active</p>
                          </div>
                        )}
                    </div>
                  </div>
       </div>

                  <div className="mt-10 pt-6 border-t border-slate-100 grid gap-3 grid-cols-2">
                    {isEditingDossier ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingDossier(false)}
                          className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 text-sm font-black uppercase tracking-widest shadow-sm hover:bg-slate-200 active:scale-[0.98] transition-all"
                        >
                          Discard Edits
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleQuickSaveLogistics}
                          className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-[#014A6E] text-white text-sm font-black uppercase tracking-widest shadow-xl hover:bg-[#8AC53E] group active:scale-[0.98] transition-all"
                        >
                          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} className="group-hover:scale-110" /> Commit Overrides</>}
                        </button>
                      </>
                    ) : (
                      <div className="col-span-2 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setIsEditModalOpen(false)}
                          className="w-full py-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
                        >
                          Close Dossier
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingDossier(true)}
                          className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-slate-900 text-white text-sm font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
                        >
                          <Edit3 size={18} /> Modify Logistics & Bank
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}


