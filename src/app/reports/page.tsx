"use client";

import React, { useState } from "react";
import { Shell } from "@/components/Shell";
import { cn, downloadExcel } from "@/lib/utils";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { 
  FileText, 
  BarChart, 
  Download, 
  Printer, 
  Search,
  LayoutGrid,
  List,
  Loader2,
  Database,
  Users as UsersIcon,
  ChevronRight,
  ShieldCheck,
  FileCode2,
  Receipt,
  Building2
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

// Add this style block at the top level
const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    body { 
      background: white !important;
      font-size: 10pt !important;
    }
    .report-container { 
      border: none !important; 
      box-shadow: none !important; 
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: none !important;
      overflow: visible !important;
      height: auto !important;
    }
    table { 
      width: 100% !important; 
      border-collapse: collapse !important; 
      margin-top: 20px !important;
      page-break-inside: auto;
    }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { 
      background-color: #f8fafc !important;
      color: black !important;
      border: 1px solid #ddd !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      font-size: 8pt !important;
    }
    td { 
      border: 1px solid #eee !important;
      padding: 8px !important;
      color: black !important;
      font-size: 9pt !important;
    }
    
    /* Payslip specific print styles */
    .payslip-card {
      page-break-inside: avoid;
      border: 1px solid #000 !important;
      margin-bottom: 20px !important;
      padding: 20px !important;
      border-radius: 0 !important;
      background: white !important;
      box-shadow: none !important;
    }
    table.staff-list-table {
      width: 100% !important;
      border: 1px solid #000 !important;
      border-collapse: collapse !important;
    }
    table.staff-list-table th {
      background-color: #d1d5db !important; /* Grey header */
      border: 1px solid #000 !important;
      color: #000 !important;
      padding: 10px !important;
      text-transform: uppercase !important;
      font-weight: bold !important;
      -webkit-print-color-adjust: exact;
    }
    table.staff-list-table td {
      border: 1px solid #000 !important;
      padding: 8px !important;
      color: #000 !important;
      font-size: 10pt !important;
    }
    .staff-list-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-end !important;
      margin-bottom: 20px !important;
      font-weight: bold !important;
    }
    .staff-list-title {
      text-align: center !important;
      font-size: 24pt !important;
      font-weight: 800 !important;
      margin-bottom: 40px !important;
      text-transform: uppercase !important;
      text-decoration: underline !important;
    }
    .staff-list-footer {
      margin-top: 60px !important;
      display: flex !important;
      justify-content: space-between !important;
      width: 100% !important;
    }
    .staff-list-footer div {
      width: 45% !important;
    }

    /* Landscape Report Styles */
    .landscape-report {
      width: 297mm !important; /* A4 Landscape width */
    }
  }

  @media print {
    .print-landscape {
      size: landscape;
      margin: 1in !important;
    }
    
    @page {
      size: A4 landscape !important;
      margin: 1in !important;
    }

    .salary-detail-table {
      width: 100% !important;
      max-width: 100% !important;
      border: 1px solid #000 !important;
      border-collapse: collapse !important;
      table-layout: fixed !important; /* Force fit within page width */
    }
    .salary-detail-table th {
      border: 1px solid #000 !important;
      font-size: 6.5pt !important; /* Slightly smaller for 13 columns */
      padding: 6px 1px !important;
      background-color: #f1f5f9 !important;
      -webkit-print-color-adjust: exact;
      text-transform: uppercase !important;
      font-weight: 800 !important;
      word-wrap: break-word !important;
    }
    .salary-detail-table td {
      border: 1px solid #000 !important;
      font-size: 6.8pt !important;
      padding: 2px 2px !important;
      word-wrap: break-word !important;
    }
    .salary-detail-table .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    }
  }

  /* Screen preview styling for paper-like landscape page */
  @media screen {
    .report-preview-landscape {
      width: 100%;
      max-width: 1122px;
      margin: 0 auto;
      background: white;
      padding: 1in;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      aspect-ratio: 297 / 210;
      min-height: 794px;
    }

    .salary-detail-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      table-layout: fixed;
    }
    .salary-detail-table th {
      background-color: #f8fafc;
      padding: 10px 2px;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 900;
    }
    .salary-detail-table td {
      padding: 6px 4px;
      font-size: 10px;
    }
  }
`;

const reportCategories = [
  { 
    name: "Employee Reports", 
    icon: UsersIcon,
    reports: ["Master Report", "Staff List", "Active Employees", "Inactive / Resigned", "By Division"]
  },
  { 
    name: "Global Masters", 
    icon: Database,
    reports: ["Divisions", "Departments", "Designations", "Salary Scales", "Bank Branches"]
  },
  { 
    name: "Payroll Reports", 
    icon: BarChart,
    reports: ["Salary Detail Report", "Bank TXT Submitter", "Salary Slips", "Salary Invoice"]
  }
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedDivision, setSelectedDivision] = useState<string>("All Divisions");
  const [divisions, setDivisions] = useState<string[]>([]);
  const [company, setCompany] = useState<any>(null);

  React.useEffect(() => {
    // Fetch Divisions for dropdown
    const fetchMasters = async () => {
      const q = query(collection(db, "masters"), where("category", "==", "Divisions"));
      const snap = await getDocs(q);
      const divList = snap.docs.map(doc => doc.data().name as string).sort();
      setDivisions(divList);

      const compSnap = await getDoc(doc(db, "system", "company"));
      if (compSnap.exists()) setCompany(compSnap.data());
    };
    fetchMasters();
  }, []);

  // Auto-refetch when filters change for the active report
  React.useEffect(() => {
    if (activeReport && activeCategory) {
      fetchReportData(activeCategory, activeReport);
    }
  }, [selectedDivision, selectedMonth, selectedYear]);

  const fetchReportData = async (cat: string, report: string) => {
    setActiveReport(report);
    setActiveCategory(cat);
    setIsLoading(true);
    setReportData([]);

    try {
      if (cat === "Global Masters") {
        const q = query(
          collection(db, "masters"), 
          where("category", "==", report)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        setReportData(data);
      } else if (cat === "Employee Reports") {
        let q;
        const employeeCollection = collection(db, "employees");
        
        if (report === "Master Report") {
          q = query(employeeCollection);
        } else if (report === "Staff List") {
          if (selectedDivision === "All Divisions") {
            q = query(employeeCollection, where("status", "==", "Active"));
          } else {
            q = query(employeeCollection, where("status", "==", "Active"), where("division", "==", selectedDivision));
          }
        } else if (report === "Active Employees") {
          q = query(employeeCollection, where("status", "==", "Active"));
        } else if (report === "Inactive / Resigned") {
          q = query(employeeCollection, where("status", "==", "Inactive"));
        } else {
          q = query(employeeCollection, where("status", "==", "Active"));
        }
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            // Sort by MemberId (EPF No) naturally
            const numA = parseInt(a.memberId) || 0;
            const numB = parseInt(b.memberId) || 0;
            return numA - numB || (a.fullName || "").localeCompare(b.fullName || "");
          });
        setReportData(data);
      } else if (cat === "Payroll Reports") {
        // Fetch from historically executed payroll records
        const q = query(
          collection(db, "payroll_records"),
          where("fiscalPeriod", "==", `${selectedMonth} ${selectedYear}`)
        );
        const snapshot = await getDocs(q);
        
        // Fetch corresponding employee data to join Bank info and other details if needed
        const empSnap = await getDocs(collection(db, "employees"));
        const empMap: any = {};
        empSnap.forEach(e => { empMap[e.id] = e.data(); });

        const data = snapshot.docs.map(doc => {
          const rec = doc.data();
          const emp = empMap[rec.employeeId] || {};
          return {
            id: doc.id,
            ...rec,
            employeeName: rec.name || emp.fullName || "UNKNOWN",
            bankName: emp.bank1Name || "N/A",
            bankBranch: emp.bank1Branch || "N/A",
            accountNo: emp.bank1Account || "N/A",
            designation: emp.designation || "N/A",
            division: emp.division || "N/A"
          };
        }).sort((a,b) => (a.employeeName || "").localeCompare(b.employeeName || ""));
        
        setReportData(data);
        
        // If Bank TXT is selected, generate the TXT automatically upon load
        if (report === "Bank TXT Submitter") {
           generateBankTextFile(data, selectedMonth, selectedYear);
        }
      }
    } catch (error) {
      console.error("Report generation failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateBankTextFile = (data: any[], month: string, year: string) => {
    if (!data || data.length === 0) {
      alert("No payroll records found for this period to generate Bank TXT.");
      return;
    }
    
    // Bank txt standard format example: <AccountNo>|<Amount>|<Name>
    let txtContent = `PAYROLL DISBURSEMENT - ${month.toUpperCase()} ${year}\n\n`;
    txtContent += `ACC_NO|AMOUNT|BENEFICIARY_NAME|BANK|BRANCH\n`;
    
    data.forEach(record => {
      const net = Number(record.netSalary || 0).toFixed(2);
      // Skip zero or negative nets
      if (parseFloat(net) <= 0) return;
      
      const acc = record.accountNo || "NO_ACC";
      const name = record.employeeName || "UNKNOWN";
      const bank = record.bankName || "N/A";
      const branch = record.bankBranch || "N/A";
      
      txtContent += `${acc}|${net}|${name}|${bank}|${branch}\n`;
    });

    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BankSubmit_${month}_${year}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!reportData || reportData.length === 0) return;

    const fileName = activeReport ? activeReport.replace(/ /g, "_") : "Report";
    const data = reportData.map(item => {
      const row: any = {};
      
      if (activeCategory === "Payroll Reports") {
        row["Employee Name"] = item.employeeName;
        row["Gross Salary"] = item.grossSalary;
        row["Total Additions"] = item.totalAdditions;
        row["Total Deductions"] = item.totalDeductions;
        row["Net Salary"] = item.netSalary;
        row["Bank Account"] = item.accountNo;
      } else {
        const actualHeaders = activeCategory === "Employee Reports" 
          ? ["memberId", "fullName", "email", "contactNo", "division", "designation", "status"]
          : ["name", "code", "description"];
        
        actualHeaders.forEach(h => {
          row[h.charAt(0).toUpperCase() + h.slice(1)] = item[h] || "";
        });
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");
    
    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    downloadExcel(excelBase64, `GSOFT_${fileName}_Export`);
  };

  return (
    <Shell>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="max-w-[1500px] mx-auto space-y-10 pb-20">
        
        {/* Header no-print */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8AC53E]">Operational Intelligence</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Reports <span className="text-[#014A6E] italic">& Analytics</span></h1>
            <p className="text-slate-500 text-lg font-medium">Generate high-fidelity organisational insights, payroll slips, and bank exports.</p>
          </div>

          <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-[#8AC53E]">
            <div className="flex items-center gap-2 pl-2">
              <Building2 size={16} className="text-[#014A6E]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">Org Filtering:</span>
            </div>
            <select 
              value={selectedDivision} 
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-[#8AC53E]/20"
            >
              <option value="All Divisions">All Dimensions</option>
              {divisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <div className="w-px h-6 bg-slate-200 mx-2" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-[#8AC53E]/20"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-[#8AC53E]/20"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories Grid no-print */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
          {reportCategories.map((cat) => (
            <div key={cat.name} className="glass-panel p-6 flex flex-col gap-6 border-slate-200 bg-white group hover:border-[#8AC53E] transition-all duration-500">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                 <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-lime-50 group-hover:text-[#8AC53E] transition-colors">
                    <cat.icon size={20} />
                 </div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-[#014A6E]">{cat.name}</h3>
              </div>
              <div className="space-y-2">
                {cat.reports.map((report) => (
                  <button 
                    key={report} 
                    onClick={() => fetchReportData(cat.name, report)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all text-[11px] font-bold group flex items-center justify-between",
                      activeReport === report 
                        ? "bg-[#014A6E] border-[#014A6E] text-white shadow-lg shadow-[#014A6E]/20" 
                        : "bg-slate-50/50 border-slate-100 text-slate-500 hover:border-[#8AC53E] hover:bg-white hover:text-[#014A6E]"
                    )}
                  >
                    <span>{report}</span>
                    <ChevronRight size={14} className={cn("transition-transform", activeReport === report ? "translate-x-1" : "opacity-0")} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Report View */}
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50 min-h-[600px] flex flex-col report-container">
          
          {activeReport ? (
            <>
              {/* Report Header */}
              <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-slate-50/30 no-print">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] bg-white border border-slate-100 shadow-xl flex items-center justify-center text-[#8AC53E]">
                    {activeReport === "Bank TXT Submitter" ? <FileCode2 size={28} /> : (activeReport === "Salary Slips" ? <Receipt size={28} /> : <BarChart size={28} />)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{activeCategory}</p>
                       <div className="w-1 h-1 rounded-full bg-slate-300" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-[#8AC53E]">Operational Index</p>
                    </div>
                    <h2 className="text-3xl font-black text-[#014A6E] tracking-tight mt-1">{activeReport} Engine</h2>
                    {activeCategory === "Payroll Reports" && (
                       <p className="text-xs font-bold text-slate-500 mt-2">Active Period: {selectedMonth} {selectedYear}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-3">
                    {activeReport === "Bank TXT Submitter" && (
                      <button 
                        onClick={() => generateBankTextFile(reportData, selectedMonth, selectedYear)}
                        disabled={isLoading || reportData.length === 0}
                        className="px-6 py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20"
                      >
                        <FileCode2 size={18} /> Regenerate TXT
                      </button>
                    )}

                    <button onClick={handlePrint} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                      <Printer size={18} /> Print Document
                    </button>
                    <button 
                      onClick={handleExportExcel}
                      disabled={isLoading || reportData.length === 0}
                      className="px-6 py-3 rounded-2xl bg-[#014A6E] text-white text-sm font-bold hover:bg-[#013550] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-xl shadow-[#014A6E]/20"
                    >
                      <Download size={18} className="text-[#8AC53E]" /> Export to Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className={cn("flex-1 p-10 transition-colors duration-500", activeReport === "Salary Detail Report" ? "bg-slate-100" : "bg-white")}>
                 {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-40 no-print">
                       <Loader2 className="animate-spin text-[#8AC53E] mb-4" size={40} />
                       <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Inducting Report Buffer...</p>
                    </div>
                 ) : reportData.length > 0 ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                       
                       {/* Print Header for generic reports */}
                       {activeReport !== "Salary Slips" && activeReport !== "Staff List" && (
                         <div className="hidden print:block space-y-4 mb-8 print-header">
                            <div className="flex justify-between items-start">
                               <div>
                                  <h1 className="text-2xl font-black text-slate-900 uppercase">GSOFT {activeReport}</h1>
                                  <p className="text-sm font-bold text-slate-500">{activeCategory}</p>
                               </div>
                               <div className="text-right">
                                  {activeCategory === "Payroll Reports" && (
                                    <>
                                      <p className="text-[10px] font-black uppercase text-slate-400">Payroll Period</p>
                                      <p className="text-sm font-black text-slate-900">{selectedMonth} {selectedYear}</p>
                                    </>
                                  )}
                                  <p className="text-[10px] font-black uppercase text-slate-400 mt-2">Print Date</p>
                                  <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
                               </div>
                            </div>
                         </div>
                       )}

                       {/* Staff List Specialized View (Consolidated Screen & Print) */}
                       {activeReport === "Staff List" && (
                         <div className="font-serif staff-list-view">
                            {/* Logo and Name - Global branded header */}
                            <div className="flex items-start gap-4 mb-6">
                              {company?.logoUrl ? (
                                <img src={company.logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
                              ) : (
                                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center font-black text-slate-300">LOGO</div>
                              )}
                              <div>
                                <h1 className="text-2xl font-black text-slate-900 leading-none">{company?.name || "LAKWIN AVIATION (PVT) LTD"}</h1>
                                <p className="text-[12px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{company?.address || "Head Office, Sri Lanka"}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-relaxed">
                                  {company?.phone1} {company?.email && `• ${company.email}`}
                                </p>
                              </div>
                            </div>

                            <hr className="border-slate-200 mb-8 no-print" />

                            {/* Centered Title */}
                            <h1 className="text-center font-black text-4xl tracking-tighter uppercase mb-12 underline underline-offset-[12px] decoration-4 text-slate-900">
                               Monthly Staff List
                            </h1>

                            {/* Record Attributes */}
                            <div className="flex justify-between items-center font-bold mb-8 uppercase text-sm border-y border-slate-100 py-4 px-2 bg-slate-50/50 print:bg-transparent print:border-black">
                               <p className="flex items-center gap-2">
                                 <span className="text-slate-400 print:text-black">DEPARTMENT :-</span> 
                                 <span className="text-slate-900 underline decoration-dotted">{selectedDivision}</span>
                               </p>
                               <p className="flex items-center gap-2">
                                 <span className="text-slate-400 print:text-black">Month :</span> 
                                 <span className="text-slate-900">{selectedMonth} {selectedYear}</span>
                               </p>
                            </div>

                            {/* Staff List High-Fidelity Table */}
                            <div className="overflow-hidden rounded-none border-collapse">
                              <table className="staff-list-table w-full">
                                 <thead>
                                    <tr>
                                       <th style={{ width: '12%', textAlign: 'center' }}>E.P.F. No</th>
                                       <th style={{ width: '40%', textAlign: 'left' }}>FULL NAME</th>
                                       <th style={{ width: '33%', textAlign: 'left' }}>DESIGNATION</th>
                                       <th style={{ width: '15%', textAlign: 'left' }}>Remarks</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {reportData.map((emp) => (
                                       <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="text-center font-bold px-4 py-3">{emp.memberId}</td>
                                          <td className="uppercase px-4 py-3 font-medium text-slate-900">{emp.fullName}</td>
                                          <td className="uppercase px-4 py-3 text-slate-600">{emp.designation}</td>
                                          <td className="italic text-[10px] text-slate-400 px-4 py-3">
                                            {emp.resignationDate ? `${emp.resignationDate} Last day` : ""}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                            </div>

                            {/* Executive Endorsements */}
                            <div className="staff-list-footer mt-24 text-xs font-bold leading-relaxed">
                               <div className="border-t-2 border-slate-900 pt-3">
                                  <p className="uppercase tracking-widest text-[#014A6E]">Prepared By :</p>
                                  <div className="mt-8 border-b border-dotted border-slate-400 w-full" />
                                  <p className="mt-2 text-slate-400 font-bold uppercase tracking-widest">(Name / Date)</p>
                               </div>
                               <div className="border-t-2 border-slate-900 pt-3 text-center">
                                  <p className="uppercase tracking-widest text-[#014A6E]">Checked By :</p>
                                  <div className="mt-8 border-b border-dotted border-slate-400 w-full mx-auto" />
                                  <p className="mt-2 text-slate-400 font-bold uppercase tracking-widest">(Name / Date)</p>
                               </div>
                               <div className="border-t-2 border-slate-900 pt-3 text-right">
                                  <p className="uppercase tracking-widest text-[#014A6E]">Approved By :</p>
                                  <div className="mt-8 border-b border-dotted border-slate-400 w-full ml-auto" />
                                  <p className="mt-2 text-slate-400 font-bold uppercase tracking-widest">(Name / Date)</p>
                               </div>
                            </div>
                         </div>
                       )}                       {/* Salary Detail Report especializada */}
                       {activeReport === "Salary Detail Report" && (
                         <div className="report-preview-landscape salary-detail-report print-landscape font-serif">
                            {/* Report Header */}
                            <div className="flex justify-between items-start mb-8 w-full">
                               <div className="w-1/3">
                                  {company?.logoUrl ? (
                                    <img src={company.logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
                                  ) : (
                                    <div className="w-20 h-20 bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-300 border border-slate-200 rounded-xl">COMPANY LOGO</div>
                                  )}
                               </div>
                               <div className="w-1/3 text-center">
                                  <h1 className="text-xl font-black text-slate-900 leading-tight uppercase">{company?.name || "LAKWIN AVIATION (PVT) LTD"}</h1>
                                  <h2 className="text-md font-black text-slate-800 tracking-[0.1em] mt-1 underline decoration-2 underline-offset-4 uppercase">Salary Detail Report</h2>
                               </div>
                               <div className="w-1/3 text-right">
                                  <p className="text-[11px] font-black uppercase text-slate-900">Period: {selectedMonth} {selectedYear}</p>
                                  <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Division: {selectedDivision}</p>
                               </div>
                            </div>

                            {/* Report Body Table */}
                            <table className="salary-detail-table w-full border-collapse border border-black text-[10px]">
                               <thead>
                                  <tr className="bg-slate-100 print:bg-slate-200">
                                     <th className="border border-black p-1 text-center" style={{ width: '3%' }}>No</th>
                                     <th className="border border-black p-1 text-center" style={{ width: '6%' }}>EPF No</th>
                                     <th className="border border-black p-1 text-left" style={{ width: '16%' }}>Name with Initials</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '7%' }}>Total for EPF</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '8.5%' }}>Allowances & OT Total</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '9%' }}>Gross / Salary for PAYE</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '7%' }}>APIT Tax</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '7.5%' }}>EPF Employee (8%)</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '7.5%' }}>Total Deductions</th>
                                     <th className="border border-black p-1 text-right bg-slate-50 print:bg-slate-300" style={{ width: '8.5%' }}>NET Salary</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '6.5%' }}>EPF Employer (12%)</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '6.5%' }}>ETF Employer (3%)</th>
                                     <th className="border border-black p-1 text-right" style={{ width: '7%' }}>Total Employer Cost</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {reportData.map((rec, i) => {
                                     const epfEarnings = Number(rec.basic1 || 0) + Number(rec.basic2 || 0) + Number(rec.fixedAllows || 0);
                                     return (
                                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                           <td className="border border-black p-1 text-center">{i + 1}</td>
                                           <td className="border border-black p-1 text-center font-bold">{rec.memberId}</td>
                                           <td className="border border-black p-1 uppercase font-medium truncate max-w-[180px]">{rec.employeeName}</td>
                                           <td className="border border-black p-1 text-right font-mono">{epfEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{(Number(rec.totalAdditions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.apitTax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.epfEmployee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono font-black bg-slate-50/50">{Number(rec.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.epfEmployer || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.etfEmployer || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                           <td className="border border-black p-1 text-right font-mono">{Number(rec.employerCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                     );
                                  })}
                                  {/* Grand Totals Row */}
                                  <tr className="bg-slate-200 print:bg-slate-300 font-black">
                                     <td colSpan={3} className="border border-black p-2 text-center uppercase tracking-widest text-[9px]">Grand Totals</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.basic1 || 0) + Number(r.basic2 || 0) + Number(r.fixedAllows || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.totalAdditions || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.grossSalary || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.apitTax || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.epfEmployee || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.totalDeductions || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.netSalary || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.epfEmployer || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.etfEmployer || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                     <td className="border border-black p-1 text-right font-mono">{reportData.reduce((s, r) => s + (Number(r.employerCost || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                               </tbody>
                            </table>

                            {/* Signatories Footer */}
                            <div className="flex justify-between items-end mt-24 text-[10px] font-bold uppercase gap-16 px-4">
                               <div className="flex-1 text-center">
                                  <div className="w-full border-t-2 border-black pt-3">Prepared By</div>
                                  <p className="mt-1 text-[8px] text-slate-400">(Signature / Date)</p>
                               </div>
                               <div className="flex-1 text-center">
                                  <div className="w-full border-t-2 border-black pt-3">Checked By</div>
                                  <p className="mt-1 text-[8px] text-slate-400">(Signature / Date)</p>
                               </div>
                               <div className="flex-1 text-center">
                                  <div className="w-full border-t-2 border-black pt-3">Approved By</div>
                                  <p className="mt-1 text-[8px] text-slate-400">(Signature / Date)</p>
                               </div>
                            </div>

                            {/* System Info Footer */}
                            <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">
                               <div>Print Date & Time: {new Date().toLocaleString('en-GB')}</div>
                               <div className="font-serif italic italic font-black text-[#014A6E]">ERP Component: {company?.name || "GSOFT PRO Unified HRMS"}</div>
                               <div>Page 1 of 1</div>
                            </div>
                         </div>
                       )}

                       {/* Salary Slips Render View */}
                       {activeReport === "Salary Slips" && (
                         <div className="space-y-12">
                           {reportData.map((slip, i) => (
                             <div key={i} className="payslip-card max-w-2xl mx-auto border border-slate-200 rounded-3xl p-8 bg-slate-50/30">
                                <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                                  <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">SALARY SLIP</h2>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8AC53E] mt-1">{selectedMonth} {selectedYear}</p>
                                  </div>
                                  <div className="text-right">
                                    <h1 className="text-xl font-black text-[#014A6E]">HR SYSTEM</h1>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Employee Name</p>
                                    <p className="text-sm font-black text-slate-900">{slip.employeeName}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] font-black uppercase text-slate-400">Member ID</p>
                                    <p className="text-sm font-black text-slate-900">{slip.memberId || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Designation</p>
                                    <p className="text-xs font-bold text-slate-700">{slip.designation}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] font-black uppercase text-slate-400">Division</p>
                                    <p className="text-xs font-bold text-slate-700">{slip.division}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-12 border-t border-slate-200 pt-6">
                                  <div>
                                    <p className="text-xs font-black uppercase text-slate-900 border-b border-slate-200 pb-2 mb-3">Earnings</p>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Basic & BRA</span>
                                        <span className="font-mono font-bold">{(Number(slip.basic1 || 0) + Number(slip.basic2 || 0)).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Fixed Allowances</span>
                                        <span className="font-mono font-bold">{(slip.fixedAllows || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Total Additions</span>
                                        <span className="font-mono font-bold">{(slip.totalAdditions || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-[#8AC53E] font-black pt-2 border-t border-slate-100">
                                        <span>Gross Earnings</span>
                                        <span className="font-mono">{Number(slip.grossSalary || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-black uppercase text-slate-900 border-b border-slate-200 pb-2 mb-3">Deductions</p>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">EPF Employee</span>
                                        <span className="font-mono font-bold text-red-500">{(slip.epfEmployee || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">PAYE Tax</span>
                                        <span className="font-mono font-bold text-red-500">{(slip.apitTax || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Other Deductions</span>
                                        <span className="font-mono font-bold text-red-500">{(Number(slip.totalDeductions || 0) - Number(slip.epfEmployee || 0) - Number(slip.apitTax || 0)).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-red-600 font-black pt-2 border-t border-slate-100">
                                        <span>Total Deductions</span>
                                        <span className="font-mono">{(slip.totalDeductions || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-8 bg-[#014A6E] text-white p-6 rounded-2xl flex justify-between items-center print:border print:border-black print:text-black print:bg-slate-100">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 print:text-slate-600">Net Salary Payable</p>
                                    <p className={cn("text-[10px] mt-1", slip.bankName !== 'N/A' ? 'block' : 'hidden')}>Transfer to: {slip.bankName} - {slip.accountNo}</p>
                                  </div>
                                  <h2 className="text-3xl font-black font-mono text-[#8AC53E] print:text-slate-900">Rs. {Number(slip.netSalary || 0).toFixed(2)}</h2>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}

                       {/* Data Table for non-slip tabular views */}
                       {activeReport !== "Salary Slips" && activeReport !== "Staff List" && (
                         <div className="border border-slate-100 rounded-[32px] overflow-hidden shadow-sm overflow-x-auto no-print">
                            <table className="w-full text-left whitespace-nowrap">
                               <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100">
                                     {activeCategory === "Payroll Reports" ? (
                                        <>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Basic & Allow</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Gross</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Deductions</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-emerald-50">Net Salary</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Bank Details</th>
                                        </>
                                     ) : activeCategory === "Employee Reports" ? (
                                        <>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Identity</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Channels</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Organisation</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Registry Status</th>
                                        </>
                                     ) : (
                                        <>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Name / Designation</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Code</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                                           <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Status</th>
                                        </>
                                     )}
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {reportData.map((item) => (
                                     <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {activeCategory === "Payroll Reports" ? (
                                           <>
                                              <td className="p-5">
                                                <p className="font-black text-[#014A6E] text-sm uppercase">{item.employeeName}</p>
                                                <p className="text-[10px] font-mono font-bold text-slate-400">{item.memberId}</p>
                                              </td>
                                              <td className="p-5 font-mono text-xs font-bold text-slate-600">
                                                {(Number(item.basic1 || 0) + Number(item.basic2 || 0) + Number(item.fixedAllows || 0)).toFixed(2)}
                                              </td>
                                              <td className="p-5 font-mono text-xs font-black text-[#014A6E]">
                                                {Number(item.grossSalary || 0).toFixed(2)}
                                              </td>
                                              <td className="p-5 font-mono text-xs font-bold text-red-500">
                                                {Number(item.totalDeductions || 0).toFixed(2)}
                                              </td>
                                              <td className="p-5 font-mono text-xs font-black text-emerald-600 bg-emerald-50/30">
                                                {Number(item.netSalary || 0).toFixed(2)}
                                              </td>
                                              <td className="p-5">
                                                <p className="text-[10px] font-black text-slate-600">{item.bankName}</p>
                                                <p className="text-[10px] font-mono text-slate-400 uppercase">{item.accountNo}</p>
                                              </td>
                                           </>
                                        ) : activeCategory === "Employee Reports" ? (
                                           <>
                                              <td className="p-5">
                                                 <div className="flex items-center gap-4">
                                                    <div>
                                                       <p className="font-black text-[#014A6E] text-sm uppercase">{item.fullName}</p>
                                                       <p className="text-[10px] font-mono font-bold text-slate-400">{item.memberId || "UNASSIGNED"}</p>
                                                    </div>
                                                 </div>
                                              </td>
                                              <td className="p-5">
                                                 <p className="text-xs font-bold text-slate-600">{item.email || "—"}</p>
                                                 <p className="text-[10px] font-black text-slate-400">{item.contactNo || "—"}</p>
                                              </td>
                                              <td className="p-5">
                                                 <p className="text-xs font-black uppercase text-[#014A6E]">{item.designation || "N/A"}</p>
                                                 <p className="text-[10px] font-black uppercase text-slate-400 italic">{item.division || "No Division"}</p>
                                              </td>
                                              <td className="p-5 text-right">
                                                 <span className={cn(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                    item.status === "Active" 
                                                       ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                                       : "bg-amber-50 text-amber-600 border-amber-100"
                                                 )}>
                                                    {item.status || "Pending"}
                                                 </span>
                                              </td>
                                           </>
                                        ) : (
                                           <>
                                              <td className="p-5">
                                                 <p className="font-black text-[#014A6E] text-sm uppercase">{item.name}</p>
                                              </td>
                                              <td className="p-5 font-mono text-xs font-bold text-slate-400 tracking-widest">{item.code}</td>
                                              <td className="p-5 text-xs font-bold text-slate-500">{item.description || "—"}</td>
                                              <td className="p-5 text-right">
                                                 <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">Active</span>
                                              </td>
                                           </>
                                        )}
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                       )}
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center py-40 no-print">
                       <div className="w-20 h-20 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
                          <LayoutGrid size={32} />
                       </div>
                       <p className="text-sm font-black text-slate-600 uppercase tracking-tight">Empty Registry Set</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 text-center max-w-xs leading-relaxed">
                          {activeCategory === "Payroll Reports" 
                             ? `No processed payroll records locked for ${selectedMonth} ${selectedYear}.`
                             : "No records found matching your analytical constraints."}
                       </p>
                    </div>
                 )}
              </div>
            </>
          ) : (
             <div className="h-full flex flex-col items-center justify-center py-40">
                <div className="w-24 h-24 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-8 shadow-sm">
                   <BarChart size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Awaiting Analytical Target</h3>
                <p className="text-slate-400 mt-2 text-sm font-medium">Select a module from the telemetry grid above to initiate fetch.</p>
             </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
