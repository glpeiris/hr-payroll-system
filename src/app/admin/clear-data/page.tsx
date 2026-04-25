"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import {
  Trash2,
  AlertTriangle,
  Calendar,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Database,
  ChevronRight,
  RotateCcw,
  FileX2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export default function ClearDataPage() {
  return (
    <Suspense fallback={<Shell><div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" /></div></Shell>}>
      <ClearDataContent />
    </Suspense>
  );
}

function ClearDataContent() {
  const searchParams = useSearchParams();
  const paramMonth = searchParams.get("month");
  const paramYear = searchParams.get("year");

  const [selectedMonth, setSelectedMonth] = useState(paramMonth ? parseInt(paramMonth) : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(paramYear ? parseInt(paramYear) : new Date().getFullYear());
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const periodLabel = `${months[selectedMonth]} ${selectedYear}${selectedEmployee ? ` for ${selectedEmployee.fullName}` : ""}`;
  const CONFIRM_PHRASE = `CLEAR ${months[selectedMonth].toUpperCase()} ${selectedYear}${selectedEmployee ? " FOR ONE" : " FOR ALL"}`;

  // Fetch Employees
  useEffect(() => {
    const q = query(collection(db, "employees"), where("status", "==", "Active"));
    const unsub = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  // Count records when period changes
  useEffect(() => {
    setRecordCount(null);
    setConfirmed(false);
    setSuccessMsg("");
    setConfirmText("");

    const checkRecords = async () => {
      setChecking(true);
      try {
        let q = query(
          collection(db, "monthly_adjustments"),
          where("month", "==", selectedMonth + 1),
          where("year", "==", selectedYear)
        );
        
        if (selectedEmployeeId) {
          q = query(q, where("employeeId", "==", selectedEmployeeId));
        }

        const snap = await getDocs(q);
        setRecordCount(snap.size);
      } catch {
        setRecordCount(0);
      } finally {
        setChecking(false);
      }
    };
    checkRecords();
  }, [selectedMonth, selectedYear, selectedEmployeeId]);

  const handleClear = async () => {
    if (!confirmed || confirmText !== CONFIRM_PHRASE) return;
    setClearing(true);
    try {
      let q = query(
        collection(db, "monthly_adjustments"),
        where("month", "==", selectedMonth + 1),
        where("year", "==", selectedYear)
      );

      if (selectedEmployeeId) {
        q = query(q, where("employeeId", "==", selectedEmployeeId));
      }

      const snap = await getDocs(q);
      if (snap.empty) {
        setSuccessMsg("No records found for the selected period.");
        return;
      }

      // Batch delete (Firestore limit: 500)
      const batchSize = 500;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setSuccessMsg(
        `✅ Successfully cleared ${docs.length} Monthly Variable Data record(s) for ${periodLabel}.`
      );
      setRecordCount(0);
      setConfirmed(false);
      setConfirmText("");
    } catch (err) {
      console.error(err);
      setSuccessMsg("❌ An error occurred while clearing data. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <ShieldAlert size={14} /> Destructive Operation
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">
            Clear Monthly{" "}
            <span className="text-red-600">Variable Data</span>
          </h1>
          <p className="text-slate-500 font-medium">
            Permanently remove all monthly adjustment records for a selected fiscal period.
            This action cannot be undone.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-5 p-6 rounded-3xl bg-amber-50 border border-amber-200">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-700 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-1">
            <p className="font-black text-amber-900 text-sm">
              Irreversible Action Warning
            </p>
            <p className="text-amber-800 text-sm font-medium leading-relaxed">
              Clearing monthly variable data will permanently delete all No-Pay, OT, Allowance, 
              Arrears, and Deduction entries for the selected period. Ensure payroll for this 
              period has not been finalized before proceeding. Use this only to re-enter data 
              or correct mistakes before payroll lock.
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="glass-panel p-8 bg-white border-slate-200 space-y-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Select Fiscal Period
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-red-100"
              >
                {months.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-red-100"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-50 mt-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Users size={12} className="text-blue-500" /> Target Employee (Optional)
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">ALL EMPLOYEES (Bulk Destructive)</option>
              {employees
                .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.memberId})
                  </option>
                ))}
            </select>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
              {selectedEmployeeId ? "ONLY THE SELECTED EMPLOYEE'S DATA WILL BE CLEARED" : "WARNING: EVERY ACTIVE EMPLOYEE'S DATA FOR THIS PERIOD WILL BE CLEARED"}
            </p>
          </div>

          {/* Record Count Badge */}
          <div
            className={cn(
              "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-500",
              checking
                ? "bg-slate-50 border-slate-200"
                : recordCount === 0
                ? "bg-emerald-50/50 border-emerald-200"
                : recordCount === null
                ? "bg-slate-50 border-slate-200"
                : "bg-red-50/50 border-red-200"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-xl",
                checking
                  ? "bg-slate-100 text-slate-400"
                  : recordCount === 0
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-red-100 text-red-600"
              )}
            >
              {checking ? (
                <Loader2 size={18} className="animate-spin" />
              ) : recordCount === 0 ? (
                <CheckCircle2 size={18} />
              ) : (
                <Database size={18} />
              )}
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">
                {checking
                  ? "Scanning database..."
                  : recordCount === null
                  ? "Select a period to scan"
                  : recordCount === 0
                  ? `No variable data found for ${periodLabel}`
                  : `${recordCount} employee record(s) found for ${periodLabel}`}
              </p>
              {!checking && recordCount !== null && recordCount > 0 && (
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-0.5">
                  These records will be permanently deleted
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Zone — only shown if records exist */}
        {!checking && recordCount !== null && recordCount > 0 && !successMsg && (
          <div className="glass-panel p-8 bg-white border-red-200 space-y-6 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-center gap-3 pb-4 border-b border-red-100">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <FileX2 size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Confirmation Required
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                To confirm, type the following phrase exactly in the box below:
              </p>
              <div className="p-4 bg-slate-900 rounded-2xl font-mono text-emerald-400 text-sm font-bold tracking-widest text-center">
                {CONFIRM_PHRASE}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type the confirmation phrase..."
                  className={cn(
                    "w-full border text-sm font-bold text-slate-700 rounded-2xl px-5 py-5 outline-none transition-all font-mono tracking-wider",
                    confirmText.trim() === CONFIRM_PHRASE 
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                      : confirmText.length > 0 
                      ? "bg-red-50 border-red-300 text-red-700" 
                      : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-red-100 shadow-inner"
                  )}
                />
                {confirmText.trim() === CONFIRM_PHRASE && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-600 animate-in zoom-in duration-300">
                    <CheckCircle2 size={18} />
                  </div>
                )}
              </div>
              {confirmText.length > 0 && confirmText.trim() !== CONFIRM_PHRASE && (
                <p className="text-[10px] font-black uppercase text-red-500 tracking-widest px-1 animate-in slide-in-from-top-1 duration-300">
                  ⚠️ Confirmation Phrase Mismatch - Check the highlighted text box above
                </p>
              )}
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 accent-red-600 w-4 h-4"
                />
                <span className="text-sm text-slate-700 font-medium leading-relaxed">
                  I understand this action will permanently delete{" "}
                  <strong>{recordCount} record(s)</strong> for{" "}
                  <strong>{periodLabel}</strong> and this cannot be undone.
                </span>
              </label>
            </div>

            <button
              onClick={handleClear}
              disabled={
                clearing ||
                !confirmed ||
                confirmText.trim() !== CONFIRM_PHRASE
              }
              className={cn(
                "w-full py-5 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg",
                confirmed && confirmText.trim() === CONFIRM_PHRASE
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200 active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              {clearing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              {clearing
                ? "Clearing Records..."
                : `Permanently Clear ${periodLabel} Data`}
            </button>
          </div>
        )}

        {/* Success / Status Message */}
        {successMsg && (
          <div
            className={cn(
              "p-6 rounded-3xl border flex items-start gap-4 animate-in fade-in duration-500",
              successMsg.startsWith("✅")
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-xl",
                successMsg.startsWith("✅")
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              )}
            >
              {successMsg.startsWith("✅") ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">{successMsg}</p>
              <button
                onClick={() => setSuccessMsg("")}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Clear & Select Another Period
              </button>
            </div>
          </div>
        )}

        {/* Empty state if no records */}
        {!checking && recordCount === 0 && !successMsg && (
          <div className="glass-panel p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 opacity-60 bg-slate-50">
            <CheckCircle2 size={40} className="text-slate-300" />
            <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm">
              No Data to Clear
            </h3>
            <p className="text-slate-400 text-sm max-w-xs font-medium">
              There are no monthly variable data records for{" "}
              <strong>{periodLabel}</strong>. Select a different period.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
