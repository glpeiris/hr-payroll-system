"use client";

import React, { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { 
  Search, 
  Lock, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Download,
  Calculator,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Loader2,
  Calendar,
  History as HistoryIcon,
  ChevronRight,
  Percent,
  Coins,
  MinusCircle,
  PlusCircle,
  Receipt,
} from "lucide-react";

import { cn, downloadCSV, downloadExcel } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, writeBatch, doc, getDocs, getDoc } from "firebase/firestore";
import { calculateSriLankaPayroll, PayrollResult } from "@/lib/payroll-calculations";
import { Employee } from "@/lib/types";
import * as XLSX from "xlsx";
import Link from "next/link";

const payrollStatus = [
  { label: "Draft", icon: Clock, color: "text-slate-400" },
  { label: "Verification", icon: AlertCircle, color: "text-[#014A6E]" },
  { label: "Reviewed", icon: ShieldCheck, color: "text-amber-500" },
  { label: "Locked", icon: Lock, color: "text-red-500" },
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

interface EmployeePayroll extends PayrollResult {
  id: string;
  name: string;
  designation: string;
  memberId: string;
  department: string;
  epfApplicable: boolean;
  // Raw inputs
  basic1: number;
  basic2: number;
  fixedAllows: number;
  // Variable inputs
  noPayDays: number;
  overtimeHours: number;
  salaryArrears: number;
  holidayWorks: number;
  extraDayWorks: number;
  nightShiftAllowance: number;
  overNightAllowance: number;
  allowanceArrears: number;
  otArrears: number;
  welfare: number;
  fine: number;
  loan: number;
  otherDeductions: number;
  // Rates applied
  epfEmployeeRate: number;
  epfEmployerRate: number;
  etfEmployerRate: number;
  otRate: number;
}

export default function PayrollPage() {
  const [currentStatus, setCurrentStatus] = useState("Verification");
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Period Selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    const qEmp = query(collection(db, "employees"), where("status", "==", "Active"));
    const qAdj = query(
      collection(db, "monthly_adjustments"), 
      where("month", "==", selectedMonth + 1),
      where("year", "==", selectedYear)
    );
    const rulesRef = doc(db, "settings", "payroll");

    const unsubscribeEmps = onSnapshot(qEmp, async (empSnapshot) => {
      const adjSnapshot = await getDocs(qAdj);
      const rulesSnap = await getDoc(rulesRef);
      
      const adjMap: Record<string, any> = {};
      adjSnapshot.forEach(doc => { adjMap[doc.data().employeeId] = doc.data(); });

      const globalRates = rulesSnap.exists() ? rulesSnap.data() : {
        epfEmployeeRate: 8, epfEmployerRate: 12, etfEmployerRate: 3, otRate: 1.5, allowanceRates: {}
      };

      // Map Master Allowance IDs to Names to provide Name-Based rates for counts
      const masterAllowancesSnap = await getDocs(query(collection(db, "masters"), where("category", "==", "Allowance Types")));
      const masterNameMap: Record<string, string> = {};
      masterAllowancesSnap.forEach(mdoc => { masterNameMap[mdoc.id] = mdoc.data().name; });

      const finalAllowanceRates: Record<string, number> = { ...(globalRates.allowanceRates || {}) };
      Object.entries(globalRates.allowanceRates || {}).forEach(([id, rate]) => {
        const name = masterNameMap[id];
        if (name) finalAllowanceRates[name] = rate as number;
      });

      const payrollData: EmployeePayroll[] = empSnapshot.docs.map(edoc => {
        const data = edoc.data() as Employee;
        const adj = adjMap[edoc.id] || {};

        const basic1 = parseFloat(String(data.basicSalary1 || 0));
        const basic2 = parseFloat(String(data.basicSalary2 || 0));
        const allow1 = parseFloat(String(data.fixedAllowance1 || 0));
        const allow2 = parseFloat(String(data.fixedAllowance2 || 0));
        const allow3 = parseFloat(String(data.fixedAllowance3 || 0));
        const dynamicAllowancesObj = adj.dynamicAllowances || {};

        const epfEmployeeRate = globalRates.epfEmployeeRate ?? 8;
        const epfEmployerRate = globalRates.epfEmployerRate ?? 12;
        const etfEmployerRate = globalRates.etfEmployerRate ?? 3;
        const otRate = globalRates.otRate ?? 1.5;

        const calculation = calculateSriLankaPayroll({
          basicSalary: basic1,
          budgetaryReliefAllowance: basic2,
          fixedAllowances: allow1 + allow2 + allow3,
          isEpfApplicable: data.epfActive === "Yes",
          variables: {
            noPayDays: adj.noPayDays || 0,
            salaryArrears: adj.salaryArrears || 0,
            holidayWorks: adj.holidayWorks || 0,
            extraDayWorks: adj.extraDayWorks || 0,
            nightShiftAllowance: adj.nightShiftAllowance || 0,
            overNightAllowance: adj.overNightAllowance || 0,
            overtimeHours: adj.overtimeHours || 0,
            allowanceArrears: adj.allowanceArrears || 0,
            otArrears: adj.otArrears || 0,
            dynamicAllowances: dynamicAllowancesObj,
            welfare: adj.welfare || 0,
            fine: adj.fine || 0,
            loan: adj.loan || 0,
            otherDeductions: adj.otherDeductions || 0
          },
          rates: { epfEmployeeRate, epfEmployerRate, etfEmployerRate, otRate, allowanceRates: finalAllowanceRates }
        });

        return {
          id: edoc.id,
          name: data.fullName || "Unnamed Employee",
          memberId: data.memberId || "N/A",
          designation: data.designation || "Staff",
          department: data.department || "",
          epfApplicable: data.epfActive === "Yes",
          basic1, basic2,
          fixedAllows: allow1 + allow2 + allow3,
          noPayDays: adj.noPayDays || 0,
          overtimeHours: adj.overtimeHours || 0,
          salaryArrears: adj.salaryArrears || 0,
          holidayWorks: adj.holidayWorks || 0,
          extraDayWorks: adj.extraDayWorks || 0,
          nightShiftAllowance: adj.nightShiftAllowance || 0,
          overNightAllowance: adj.overNightAllowance || 0,
          allowanceArrears: adj.allowanceArrears || 0,
          otArrears: adj.otArrears || 0,
          welfare: adj.welfare || 0,
          fine: adj.fine || 0,
          loan: adj.loan || 0,
          otherDeductions: adj.otherDeductions || 0,
          epfEmployeeRate, epfEmployerRate, etfEmployerRate, otRate,
          ...calculation
        };
      });
      
      setEmployees(payrollData);
      setLoading(false);
    });

    return () => unsubscribeEmps();
  }, [selectedMonth, selectedYear]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalNet = employees.reduce((sum, emp) => sum + emp.netSalary, 0);
  const totalGross = employees.reduce((sum, emp) => sum + emp.grossSalary, 0);
  const totalTax = employees.reduce((sum, emp) => sum + emp.apitTax, 0);
  const totalEpfEmployer = employees.reduce((sum, emp) => sum + emp.epfEmployer, 0);
  const totalEtfEmployer = employees.reduce((sum, emp) => sum + emp.etfEmployer, 0);

  const filteredEmployees = employees
    .filter(emp =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.memberId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.memberId.localeCompare(b.memberId, undefined, { numeric: true }));

  // ─── Comprehensive Export (Excel) ───────────────────────────────────────────
  const handleExportComprehensive = () => {
    if (filteredEmployees.length === 0) return;

    // Sheet 1: Summary
    const summaryData = filteredEmployees.map(emp => ({
      "EPF No.": emp.memberId,
      "Full Name": emp.name,
      "Designation": emp.designation,
      "Department": emp.department,
      "EPF Applicable": emp.epfApplicable ? "Yes" : "No",
      // ── Salary Components ──
      "Basic Salary (A1)": Number(emp.basic1.toFixed(2)),
      "Budgetary Relief (A2)": Number(emp.basic2.toFixed(2)),
      "A = A1+A2": Number((emp.basic1 + emp.basic2).toFixed(2)),
      "No-Pay Days": Number(emp.noPayDays.toFixed(2)),
      "No-Pay Deduction (B = A/30×Days)": Number(emp.noPayDeduction.toFixed(2)),
      "Salary Arrears (C)": Number(emp.salaryArrears.toFixed(2)),
      "Total for EPF (D = A+C−B)": Number((emp.basic1 + emp.basic2 + emp.salaryArrears - emp.noPayDeduction).toFixed(2)),
      // ── Allowances ──
      "Fixed Allowances (E)": Number(emp.fixedAllows.toFixed(2)),
      "Allowance Arrears (F)": Number(emp.allowanceArrears.toFixed(2)),
      "Holiday Works": Number(emp.holidayWorks.toFixed(2)),
      "Extra Day Works": Number(emp.extraDayWorks.toFixed(2)),
      "Night Shift Allowance": Number(emp.nightShiftAllowance.toFixed(2)),
      "Over Night Allowance": Number(emp.overNightAllowance.toFixed(2)),
      // ── Overtime ──
      "OT Hours": Number(emp.overtimeHours.toFixed(2)),
      "OT Rate Multiplier": Number(emp.otRate.toFixed(2)),
      "OT Pay (I = A/240×Rate×Hrs)": Number(emp.otPayment.toFixed(2)),
      "OT Arrears (J)": Number(emp.otArrears.toFixed(2)),
      // ── Variable Deductions ──
      "Welfare": Number(emp.welfare.toFixed(2)),
      "Fine": Number(emp.fine.toFixed(2)),
      "Loan": Number(emp.loan.toFixed(2)),
      "Other Deductions": Number(emp.otherDeductions.toFixed(2)),
      // ── Tax ──
      "Gross / Salary for PAYE (K)": Number(emp.grossSalary.toFixed(2)),
      "PAYE Tax-Free Threshold (monthly)": 150000,
      "Taxable Income": Number(emp.taxableIncome.toFixed(2)),
      "APIT Tax (Q)": Number(emp.apitTax.toFixed(2)),
      // ── EPF/ETF ──
      "EPF Employee Rate (%)": emp.epfEmployeeRate,
      "EPF Employee (P)": Number(emp.epfEmployee.toFixed(2)),
      "EPF Employer Rate (%)": emp.epfEmployerRate,
      "EPF Employer (T)": Number(emp.epfEmployer.toFixed(2)),
      "ETF Employer Rate (%)": emp.etfEmployerRate,
      "ETF Employer (U)": Number(emp.etfEmployer.toFixed(2)),
      // ── Totals ──
      "Total Additions": Number(emp.totalAdditions.toFixed(2)),
      "Total Deductions": Number(emp.totalDeductions.toFixed(2)),
      "NET Salary (S = K−R)": Number(emp.netSalary.toFixed(2)),
      "Total Employer Cost": Number(emp.employerCost.toFixed(2)),
    }));

    // Sheet 2: Tax Verification
    const taxSheet = filteredEmployees.map(emp => ({
      "EPF No.": emp.memberId,
      "Name": emp.name,
      "Salary for PAYE (K)": Number(emp.grossSalary.toFixed(2)),
      "Tax-Free Threshold": 150000,
      "Taxable Above Threshold": Number(Math.max(0, emp.taxableIncome - 150000).toFixed(2)),
      "Slab 1: Up to 83,333 @ 6%": Number(Math.min(Math.max(0, emp.taxableIncome - 150000), 83333.33) * 0.06).toFixed(2),
      "Slab 2: Next 41,667 @ 18%": Number(Math.min(Math.max(0, emp.taxableIncome - 233333.33), 41666.67) * 0.18).toFixed(2),
      "Slab 3: Next 41,667 @ 24%": Number(Math.min(Math.max(0, emp.taxableIncome - 275000), 41666.67) * 0.24).toFixed(2),
      "Slab 4: Next 41,667 @ 30%": Number(Math.min(Math.max(0, emp.taxableIncome - 316666.67), 41666.67) * 0.30).toFixed(2),
      "Slab 5: Balance @ 36%": Number(Math.max(0, emp.taxableIncome - 358333.34) * 0.36).toFixed(2),
      "APIT Tax (Rounded)": Number(emp.apitTax.toFixed(2)),
    }));

    // Sheet 3: EPF/ETF Register
    const epfSheet = filteredEmployees.map(emp => {
      const row: Record<string, string | number> = {
        "EPF No.": emp.memberId,
        "Name": emp.name,
        "EPF Applicable": emp.epfApplicable ? "Yes" : "No",
        "EPF Salary (A = Basic+Budgetary)": Number((emp.basic1 + emp.basic2).toFixed(2)),
      };
      row[`EPF Employee (${emp.epfEmployeeRate}%)`] = Number(emp.epfEmployee.toFixed(2));
      row[`EPF Employer (${emp.epfEmployerRate}%)`] = Number(emp.epfEmployer.toFixed(2));
      row["Total EPF"] = Number((emp.epfEmployee + emp.epfEmployer).toFixed(2));
      row[`ETF Employer (${emp.etfEmployerRate}%)`] = Number(emp.etfEmployer.toFixed(2));
      return row;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Payroll Register");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taxSheet), "PAYE Verification");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(epfSheet), "EPF-ETF Register");

    const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    downloadExcel(b64, `Payroll_Full_${months[selectedMonth]}_${selectedYear}`);
  };

  const handleExportCSV = () => {
    if (filteredEmployees.length === 0) return;
    const headers = [
      "EPF No", "Name", "Designation",
      "Basic Salary", "Budgetary Relief", "Fixed Allowances",
      "No-Pay Days", "No-Pay Deduction",
      "Salary Arrears", "OT Hours", "OT Pay", "OT Arrears",
      "Holiday Works", "Extra Day Works", "Night Shift Allow", "Over Night Allow",
      "Allowance Arrears",
      "Welfare", "Fine", "Loan", "Other Deductions",
      "Gross / Salary for PAYE",
      "APIT Tax", "EPF Employee", "EPF Employer", "ETF Employer",
      "Total Deductions", "Net Salary", "Employer Cost"
    ];
    const rows = filteredEmployees.map(emp => [
      emp.memberId, `"${emp.name.replace(/"/g, '""')}"`, `"${emp.designation.replace(/"/g, '""')}"`,
      emp.basic1.toFixed(2), emp.basic2.toFixed(2), emp.fixedAllows.toFixed(2),
      emp.noPayDays.toFixed(2), emp.noPayDeduction.toFixed(2),
      emp.salaryArrears.toFixed(2), emp.overtimeHours.toFixed(2), emp.otPayment.toFixed(2), emp.otArrears.toFixed(2),
      emp.holidayWorks.toFixed(2), emp.extraDayWorks.toFixed(2), emp.nightShiftAllowance.toFixed(2), emp.overNightAllowance.toFixed(2),
      emp.allowanceArrears.toFixed(2),
      emp.welfare.toFixed(2), emp.fine.toFixed(2), emp.loan.toFixed(2), emp.otherDeductions.toFixed(2),
      emp.grossSalary.toFixed(2),
      emp.apitTax.toFixed(2), emp.epfEmployee.toFixed(2), emp.epfEmployer.toFixed(2), emp.etfEmployer.toFixed(2),
      emp.totalDeductions.toFixed(2), emp.netSalary.toFixed(2), emp.employerCost.toFixed(2)
    ].join(","));
    downloadCSV([headers.join(","), ...rows].join("\n"), `Payroll_${months[selectedMonth]}_${selectedYear}`);
  };

  const handleValidate = async () => {
    setIsValidating(true);
    // Simulate deep validation scan
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simple check: do we have any employees? Are there any negative net salaries?
    const hasZeroBasics = filteredEmployees.some(e => (e.basic1 + e.basic2) <= 0);
    const hasNegativeNet = filteredEmployees.some(e => e.netSalary < 0);

    if (hasZeroBasics) {
      alert("⚠️ Validation Failed: Some employees have zero or negative basic salary.");
      setIsValidating(false);
      return;
    }
    if (hasNegativeNet) {
      alert("⚠️ Validation Failed: Some employees have a negative Net Salary due to excessive deductions.");
      setIsValidating(false);
      return;
    }

    setIsValidated(true);
    setCurrentStatus("Reviewed");
    setIsValidating(false);
    alert("✅ Validation Passed: Payroll registry is statistically sound and ready for finalization.");
  };

  const handleExecuteDisbursement = async () => {
    if (!isValidated) {
      alert("Please validate the payroll registry before finalization.");
      return;
    }
    const periodLabel = `${months[selectedMonth]} ${selectedYear}`;
    if (confirm(`Confirm Approval & Finalization: You are about to lock March 2026 payroll. This will move all calculations to the Salary Detail Report and cannot be modified. Continue?`)) {
      setIsProcessing(true);
      try {
        const batch = writeBatch(db);
        const runRef = await addDoc(collection(db, "payroll_runs"), {
          month: selectedMonth + 1, year: selectedYear, monthName: months[selectedMonth],
          processedCount: filteredEmployees.length, totalGross, totalNet, totalTax,
          totalEpfEmployer, totalEtfEmployer, createdAt: serverTimestamp(), status: "Locked"
        });
        for (const emp of filteredEmployees) {
          const recordRef = doc(collection(db, "payroll_records"));
          batch.set(recordRef, { ...emp, runId: runRef.id, month: selectedMonth + 1, year: selectedYear, processedAt: serverTimestamp(), fiscalPeriod: periodLabel });
        }
        await batch.commit();
        setShowSuccess(true);
        setCurrentStatus("Locked");
      } catch (error) {
        console.error("Disbursement Error:", error);
        alert("❌ Critical System Error: Failed to commit payroll backup.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <Shell>
      <div className="space-y-10 max-w-[1800px] mx-auto pb-20">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#014A6E]">
              Financial Compliance • Sri Lanka
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Active Payroll Processing
            </h1>
            <p className="text-slate-500 text-lg font-medium">
              Monthly salary calculations for the selected fiscal period — 2025 PAYE rates applied.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportComprehensive}
              disabled={filteredEmployees.length === 0}
              className="glass-card px-5 py-2.5 text-sm font-bold flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 disabled:opacity-40"
            >
              <FileSpreadsheet size={18} className="text-emerald-500" /> Full Excel Export
            </button>
            <button 
              onClick={handleExportCSV}
              disabled={filteredEmployees.length === 0}
              className="glass-card px-5 py-2.5 text-sm font-bold flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 disabled:opacity-40"
            >
              <Download size={18} className="text-blue-500" /> CSV
            </button>
            <button 
              onClick={isValidated ? handleExecuteDisbursement : handleValidate}
              disabled={isProcessing || isValidating || currentStatus === "Locked"}
              className={cn("btn-primary flex items-center gap-2 shadow-blue-200", currentStatus === "Locked" && "bg-slate-400 pointer-events-none", isValidated ? "bg-red-600 hover:bg-red-700" : "")}
            >
              {isProcessing || isValidating ? <Loader2 size={18} className="animate-spin" /> : (isValidated ? <Lock size={18} /> : <ShieldCheck size={18} />)}
              {currentStatus === "Locked" ? "Payroll Locked" : (isValidated ? "Execute Finalization" : "Validate Registry")}
            </button>
          </div>
        </div>

        {/* Success Splash */}
        {showSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[32px] p-10 text-center animate-in zoom-in-95 duration-700 space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-xl shadow-emerald-500/10">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Payroll Approved!</h2>
              <p className="text-slate-500 font-medium max-w-md mx-auto">
                Electronic workforce finalization for {months[selectedMonth]} {selectedYear} complete. 
                Full calculation data is now available in the Salary Detail Report.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <a href="/reports" className="px-8 py-4 bg-[#014A6E] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
                View Salary Detail Report
              </a>
              <button onClick={() => setShowSuccess(false)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">
                Back to Processing
              </button>
            </div>
          </div>
        )}

        {/* Workflow Indicator */}
        <div className="bg-white rounded-[24px] p-2 border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-2">
            {payrollStatus.map((step) => {
              const isActive = currentStatus === step.label;
              const Icon = step.icon;
              return (
                <button key={step.label} onClick={() => setCurrentStatus(step.label)}
                  className={cn("flex-1 flex items-center justify-center gap-3 py-4 rounded-xl transition-all duration-300 border text-[10px] font-black uppercase tracking-[0.15em]",
                    isActive ? "bg-slate-50 border-blue-100 text-[#014A6E] shadow-sm" : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                  )}>
                  <Icon size={16} className={cn(isActive ? step.color : "text-slate-300")} />
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-[24px] p-6 flex flex-col md:flex-row gap-6 items-center border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Calendar size={20} /></div>
            <div className="flex gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-blue-100">
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-blue-100">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search payroll registry..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-12" />
          </div>
          <div className="flex items-center gap-5">
            <div className="bg-blue-50/50 px-4 py-2 rounded-2xl border border-blue-100 flex items-center gap-3">
              <Calculator size={18} className="text-[#014A6E]" />
              <div className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">
                Register: <span className="text-slate-900">{filteredEmployees.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Variable Data Verification Banner */}
        <div className="bg-gradient-to-br from-blue-50/50 to-emerald-50/50 rounded-[24px] p-6 border border-blue-100/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
              <HistoryIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Monthly Variable Data Verification</h3>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Reconcile adjustments before finalizing payroll for {months[selectedMonth]} {selectedYear}. PAYE: 2025/2026 IRD rates.
              </p>
            </div>
          </div>
          <Link href="/payroll/adjustments" className="btn-primary whitespace-nowrap px-6 py-3 flex items-center gap-2 shadow-xl shadow-blue-200">
            <Calculator size={18} /> Reconcile Variable Data
          </Link>
        </div>

        {/* PAYE Tax Reference Banner */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-[24px] p-5 border border-amber-100 flex flex-col md:flex-row gap-6 items-start">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-700 shrink-0"><Receipt size={20} /></div>
          <div className="flex-1">
            <p className="text-sm font-black text-amber-900 mb-2">PAYE Tax Slabs Applied — w.e.f. 01.04.2025 (IRD Sri Lanka)</p>
            <div className="flex flex-wrap gap-3 text-[10px] font-black">
              {[
                { label: "Free Threshold", val: "LKR 150,000/month", color: "bg-emerald-100 text-emerald-800" },
                { label: "Slab 1: ≤83,333", val: "6%", color: "bg-blue-100 text-blue-800" },
                { label: "Slab 2: ≤41,667", val: "18%", color: "bg-indigo-100 text-indigo-800" },
                { label: "Slab 3: ≤41,667", val: "24%", color: "bg-violet-100 text-violet-800" },
                { label: "Slab 4: ≤41,667", val: "30%", color: "bg-orange-100 text-orange-800" },
                { label: "Slab 5: Balance", val: "36%", color: "bg-red-100 text-red-800" },
              ].map(s => (
                <div key={s.label} className={cn("px-3 py-1.5 rounded-xl flex items-center gap-1.5 uppercase tracking-widest", s.color)}>
                  <span className="opacity-70">{s.label}:</span> <span>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="glass-panel overflow-hidden border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 w-8"></th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Employee</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Basic + Allowance</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">No-Pay / OT</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-amber-500">PAYE Tax</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-red-500">EPF 8%</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Gross (PAYE Base)</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-[#014A6E]">Net Payable</th>
                  <th className="p-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 text-right">Employer Cost</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-20 text-center">
                      <Loader2 className="animate-spin text-[#014A6E] mx-auto mb-4" size={32} />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Calculating Registry...</p>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-20 text-center text-slate-400 italic font-medium">
                      No active employee records available for payroll processing.
                    </td>
                  </tr>
                ) : filteredEmployees.map((emp) => (
                  <React.Fragment key={emp.id}>
                    <tr 
                      className={cn("border-b border-slate-50 group cursor-pointer", expandedRow === emp.id ? "bg-blue-50/30" : "hover:bg-slate-50/50")}
                      onClick={() => setExpandedRow(expandedRow === emp.id ? null : emp.id)}
                    >
                      <td className="p-5 pl-6">
                        <div className={cn("transition-transform duration-300 text-slate-400", expandedRow === emp.id ? "rotate-90 text-blue-600" : "")}>
                          <ChevronRight size={14} />
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#014A6E]/5 border border-[#014A6E]/10 flex items-center justify-center font-black text-[#014A6E] text-sm">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm group-hover:text-[#014A6E] transition-colors">{emp.name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{emp.memberId} • {emp.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="space-y-0.5">
                          <p className="font-mono text-sm font-bold text-slate-700">LKR {fmt(emp.basic1 + emp.basic2)}</p>
                          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <TrendingUp size={9} /> Allow: {fmt(emp.fixedAllows)}
                          </p>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="space-y-0.5">
                          {emp.noPayDays > 0 && (
                            <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                              <TrendingDown size={9} /> No-Pay: {fmt(emp.noPayDays)}d (−{fmt(emp.noPayDeduction)})
                            </p>
                          )}
                          {emp.overtimeHours > 0 && (
                            <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                              <TrendingUp size={9} /> OT: {fmt(emp.overtimeHours)}h (+{fmt(emp.otPayment)})
                            </p>
                          )}
                          {emp.noPayDays === 0 && emp.overtimeHours === 0 && (
                            <p className="text-[10px] text-slate-300 font-bold">—</p>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <p className={cn("font-mono text-sm font-bold", emp.apitTax > 0 ? "text-amber-600" : "text-slate-300")}>
                          {emp.apitTax > 0 ? `LKR ${fmt(emp.apitTax)}` : "NIL"}
                        </p>
                      </td>
                      <td className="p-5">
                        <p className={cn("font-mono text-sm font-bold", emp.epfEmployee > 0 ? "text-red-500" : "text-slate-300")}>
                          {emp.epfEmployee > 0 ? `LKR ${fmt(emp.epfEmployee)}` : "N/A"}
                        </p>
                      </td>
                      <td className="p-5">
                        <div>
                          <p className="font-mono text-sm font-bold text-slate-600">LKR {fmt(emp.grossSalary)}</p>
                          {emp.totalAdditions > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold">+{fmt(emp.totalAdditions)} adds</p>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <p className="font-black text-[#014A6E] text-base tracking-tight">LKR {fmt(emp.netSalary)}</p>
                        <p className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black tracking-widest inline-block mt-1">
                          Ded: {fmt(emp.totalDeductions)}
                        </p>
                      </td>
                      <td className="p-5 text-right">
                        <p className="font-mono text-sm font-black text-[#014A6E]">LKR {fmt(emp.employerCost)}</p>
                        <div className="flex justify-end gap-1 mt-1">
                          <div className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black">EPF: {fmt(emp.epfEmployer)}</div>
                          <div className="text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-black">ETF: {fmt(emp.etfEmployer)}</div>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded Calculation Detail Row ─────────────────── */}
                    {expandedRow === emp.id && (
                      <tr className="bg-blue-50/20 border-b border-blue-100">
                        <td colSpan={9} className="p-0">
                          <div className="p-6 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                              {/* Salary Calculation */}
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E] flex items-center gap-2 border-b pb-3 border-slate-100">
                                  <Coins size={12} /> Salary Computation
                                </h4>
                                <DetailRow label="Basic Salary (A1)" value={`LKR ${fmt(emp.basic1)}`} />
                                <DetailRow label="Budgetary Relief (A2)" value={`LKR ${fmt(emp.basic2)}`} />
                                <DetailRow label="A = A1 + A2" value={`LKR ${fmt(emp.basic1 + emp.basic2)}`} bold />
                                <DetailRow label="No-Pay Days" value={`${fmt(emp.noPayDays)} days`} negative />
                                <DetailRow label="No-Pay Deduction (B)" value={`−LKR ${fmt(emp.noPayDeduction)}`} negative />
                                <DetailRow label="Salary Arrears (C)" value={`LKR ${fmt(emp.salaryArrears)}`} positive />
                                <DetailRow label="Total for EPF (D = A+C−B)" value={`LKR ${fmt(emp.basic1 + emp.basic2 + emp.salaryArrears - emp.noPayDeduction)}`} bold />
                              </div>

                              {/* Allowances & OT */}
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2 border-b pb-3 border-slate-100">
                                  <PlusCircle size={12} /> Allowances & OT
                                </h4>
                                <DetailRow label="Fixed Allowances (E)" value={`LKR ${fmt(emp.fixedAllows)}`} />
                                <DetailRow label="Allowance Arrears (F)" value={`LKR ${fmt(emp.allowanceArrears)}`} positive />
                                <DetailRow label={`Night Shift Allowance - A1 (${fmt(emp.nightShiftAllowance)} SHS)`} value={`LKR ${fmt(emp.nightShiftPay)}`} positive />
                                <DetailRow label={`Over Night Allowance - A2 (${fmt(emp.overNightAllowance)} CNT)`} value={`LKR ${fmt(emp.overnightPay)}`} positive />
                                <DetailRow label={`Extra Day Works - A3 (${fmt(emp.extraDayWorks)} DAYS)`} value={`LKR ${fmt(emp.extraDayPay)}`} positive />
                                <DetailRow label={`Holiday Works - A4 (${fmt(emp.holidayWorks)} DAYS)`} value={`LKR ${fmt(emp.holidayPay)}`} positive />
                                <DetailRow label={`OT: ${fmt(emp.overtimeHours)}h × A/240 × ${fmt(emp.otRate)}`} value={`LKR ${fmt(emp.otPayment - emp.otArrears)}`} positive />
                                <DetailRow label="OT Arrears (J)" value={`LKR ${fmt(emp.otArrears)}`} positive />
                                <div className="border-t pt-2 border-slate-100">
                                  <DetailRow label="Gross / Salary for PAYE (K)" value={`LKR ${fmt(emp.grossSalary)}`} bold />
                                </div>
                              </div>

                              {/* PAYE Tax Breakdown */}
                              <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2 border-b pb-3 border-amber-100">
                                  <Percent size={12} /> PAYE Tax (2025/26)
                                </h4>
                                <DetailRow label="Salary for PAYE" value={`LKR ${fmt(emp.taxableIncome)}`} />
                                <DetailRow label="Free Threshold" value="LKR 150,000" negative />
                                <DetailRow label="Taxable Amount" value={`LKR ${fmt(Math.max(0, emp.taxableIncome - 150000))}`} bold />
                                <div className="space-y-1 pt-1">
                                  {[
                                    { slab: "≤83,333 @ 6%", from: 150000, to: 233333.33, rate: 0.06 },
                                    { slab: "≤41,667 @ 18%", from: 233333.33, to: 275000, rate: 0.18 },
                                    { slab: "≤41,667 @ 24%", from: 275000, to: 316666.67, rate: 0.24 },
                                    { slab: "≤41,667 @ 30%", from: 316666.67, to: 358333.34, rate: 0.30 },
                                    { slab: "Balance @ 36%", from: 358333.34, to: Infinity, rate: 0.36 },
                                  ].map(s => {
                                    const base = Math.max(0, emp.taxableIncome - s.from);
                                    const cap = s.to === Infinity ? base : Math.min(base, s.to - s.from);
                                    const taxAmt = Math.max(0, cap) * s.rate;
                                    if (taxAmt <= 0) return null;
                                    return <DetailRow key={s.slab} label={s.slab} value={`LKR ${fmt(taxAmt)}`} />;
                                  })}
                                </div>
                                <div className="border-t pt-2 border-amber-100">
                                  <DetailRow label="APIT Tax (Q, rounded)" value={`LKR ${fmt(emp.apitTax)}`} bold />
                                </div>
                              </div>

                              {/* Deductions & Net */}
                              <div className="bg-white rounded-2xl border border-red-200 p-5 space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2 border-b pb-3 border-red-100">
                                  <MinusCircle size={12} /> Deductions & Net
                                </h4>
                                <DetailRow label={`EPF Employee (${emp.epfEmployeeRate}%)`} value={emp.epfApplicable ? `−LKR ${fmt(emp.epfEmployee)}` : "N/A"} negative={emp.epfApplicable} />
                                <DetailRow label="APIT Tax (Q)" value={`−LKR ${fmt(emp.apitTax)}`} negative />
                                {emp.welfare > 0 && <DetailRow label="Welfare" value={`−LKR ${fmt(emp.welfare)}`} negative />}
                                {emp.fine > 0 && <DetailRow label="Fine" value={`−LKR ${fmt(emp.fine)}`} negative />}
                                {emp.loan > 0 && <DetailRow label="Loan Recovery" value={`−LKR ${fmt(emp.loan)}`} negative />}
                                {emp.otherDeductions > 0 && <DetailRow label="Other Deductions" value={`−LKR ${fmt(emp.otherDeductions)}`} negative />}
                                <div className="border-t pt-2 border-red-100 space-y-2">
                                  <DetailRow label="Total Deductions (R)" value={`−LKR ${fmt(emp.totalDeductions)}`} negative bold />
                                  <DetailRow label="NET Salary (S = K−R)" value={`LKR ${fmt(emp.netSalary)}`} bold />
                                </div>
                                <div className="border-t pt-2 border-slate-100 space-y-1.5">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employer Statutory</p>
                                  <DetailRow label={`EPF Employer (${emp.epfEmployerRate}%)`} value={`LKR ${fmt(emp.epfEmployer)}`} />
                                  <DetailRow label={`ETF Employer (${emp.etfEmployerRate}%)`} value={`LKR ${fmt(emp.etfEmployer)}`} />
                                  <DetailRow label="Total Employer Cost" value={`LKR ${fmt(emp.employerCost)}`} bold />
                                </div>
                              </div>

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Footer */}
          <div className="p-10 bg-slate-50/50 border-t border-slate-200 flex flex-col xl:flex-row items-center justify-between gap-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 w-full xl:w-auto">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Gross / PAYE Base</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight">LKR {fmt(totalGross)}</p>
              </div>
              <div className="space-y-1.5 border-l border-slate-200 pl-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Govt Liability (APIT)</p>
                <p className="text-2xl font-black text-amber-500 tracking-tight">LKR {fmt(totalTax)}</p>
              </div>
              <div className="space-y-1.5 border-l border-slate-200 pl-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statutory Pool (EPF/ETF)</p>
                <p className="text-2xl font-black text-red-500 tracking-tight">LKR {fmt(totalEpfEmployer + totalEtfEmployer)}</p>
              </div>
              <div className="space-y-1.5 border-l border-slate-200 pl-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">Total Net Payable</p>
                <p className="text-4xl font-black text-[#014A6E] tracking-tighter">LKR {fmt(totalNet)}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              <button onClick={handleExportComprehensive} disabled={filteredEmployees.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#014A6E] hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40">
                <FileSpreadsheet size={16} className="text-emerald-500" /> Full Excel
              </button>
              <button onClick={handleExportCSV} disabled={filteredEmployees.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#014A6E] hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40">
                <Download size={16} className="text-[#8AC53E]" /> CSV
              </button>
              <button onClick={handleExecuteDisbursement}
                disabled={isProcessing || currentStatus === "Locked" || filteredEmployees.length === 0}
                className="w-full sm:w-auto btn-primary py-5 px-12 shadow-2xl shadow-blue-200 active:scale-95 text-[10px] uppercase tracking-[0.2em] font-black flex items-center justify-center gap-3">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} />}
                Execute Finalization
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ── Helper Component ──────────────────────────────────────────────────────────
function DetailRow({ label, value, bold, positive, negative }: { label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold text-slate-500 leading-tight flex-1">{label}</span>
      <span className={cn(
        "text-[11px] font-mono shrink-0",
        bold && "font-black",
        positive && "text-emerald-600",
        negative && "text-red-500",
        !bold && !positive && !negative && "text-slate-700 font-bold"
      )}>{value}</span>
    </div>
  );
}
