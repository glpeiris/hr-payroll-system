"use client";

import { Shell } from "@/components/Shell";
import {
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  AlertCircle,
  Banknote,
  PieChart,
  ArrowUpRight,
  MoreHorizontal,
  Download,
  Loader2,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { calculateSriLankaPayroll } from "@/lib/payroll-calculations";
import { Employee } from "@/lib/types";
import Link from "next/link";

const chartData = [
  { name: "Jan", value: 400 },
  { name: "Feb", value: 420 },
  { name: "Mar", value: 450 },
  { name: "Apr", value: 480 },
  { name: "May", value: 500 },
  { name: "Jun", value: 550 },
];

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    newThisMonth: 0,
    totalGross: 0,
    totalNet: 0,
    totalTax: 0,
    totalAllowances: 0,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "employees"), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(emps);
      
      const active = emps.filter(e => e.status === "Active");
      const pending = emps.filter(e => e.status === "Pending Approval");
      
      // Basic Payroll Stats for Active Employees
      let gross = 0;
      let net = 0;
      let tax = 0;
      let allows = 0;

      active.forEach(emp => {
        const b1 = parseFloat(String(emp.basicSalary1 || 0));
        const b2 = parseFloat(String(emp.basicSalary2 || 0));
        const fl1 = parseFloat(String(emp.fixedAllowance1 || 0));
        const fl2 = parseFloat(String(emp.fixedAllowance2 || 0));
        const fl3 = parseFloat(String(emp.fixedAllowance3 || 0));
        
        const calc = calculateSriLankaPayroll({
          basicSalary: b1,
          budgetaryReliefAllowance: b2,
          fixedAllowances: fl1 + fl2 + fl3,
          isEpfApplicable: emp.epfApplicable === "Yes"
        });

        gross += calc.grossSalary;
        net += calc.netSalary;
        tax += calc.apitTax;
        allows += (fl1 + fl2 + fl3);
      });

      setStats({
        total: emps.length,
        active: active.length,
        pending: pending.length,
        newThisMonth: 0, // Placeholder
        totalGross: gross,
        totalNet: net,
        totalTax: tax,
        totalAllowances: allows
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const statCards = [
    {
      name: "Total Workforce",
      value: stats.total.toLocaleString(),
      icon: Users,
      change: "+2%",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      badge: "bg-blue-50 text-blue-600 border border-blue-100",
    },
    {
      name: "Active Payroll",
      value: stats.active.toLocaleString(),
      icon: UserCheck,
      change: "Stable",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      badge: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    },
    {
      name: "Pending Audits",
      value: stats.pending.toLocaleString(),
      icon: AlertCircle,
      change: "Follow-up",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      badge: "bg-amber-50 text-amber-700 border border-amber-100",
    },
    {
      name: "Statutory Tax Liability",
      value: `LKR ${stats.totalTax.toLocaleString()}`,
      icon: ShieldCheck,
      change: "Current Month",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      badge: "bg-violet-50 text-violet-600 border border-violet-100",
    },
  ];

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-[60vh] opacity-0 animate-in fade-in duration-1000 delay-500">
           {/* We let Shell's SplashScreen handle the visibility */}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-20">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#014A6E]">
                Operations Hub
              </p>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded uppercase tracking-widest">Live System</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">
              Executive Governance
            </h1>
            <p className="text-slate-500 text-base font-medium">
              Real-time monitoring of HR events and fiscal compliance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="glass-card px-5 py-2.5 text-sm font-semibold flex items-center gap-2 text-slate-600 hover:text-slate-900 border-slate-200 shadow-sm transition-all hover:bg-slate-50">
              <Download size={15} className="text-blue-500" />
              Intelligence Report
            </button>
            <Link href="/payroll">
              <button className="btn-primary flex items-center gap-2 shadow-xl shadow-blue-200">
                <CalendarDays size={18} />
                Process Monthly Payroll
              </button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat) => (
            <div
              key={stat.name}
              className="glass-card p-6 relative overflow-hidden group border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute -right-3 -bottom-3 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity">
                <stat.icon size={90} className="text-slate-900" />
              </div>

              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2.5 rounded-xl", stat.iconBg)}>
                    <stat.icon size={20} className={stat.iconColor} />
                  </div>
                  <button className="text-slate-200 hover:text-slate-400 transition-colors">
                    <MoreHorizontal size={18} />
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {stat.name}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                      {stat.value}
                    </h3>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest flex items-center gap-0.5 px-2 py-0.5 rounded-full",
                        stat.badge
                      )}
                    >
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Area Chart */}
          <div className="xl:col-span-2 glass-panel p-8 border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                  <TrendingUp size={20} className="text-[#014A6E]" />
                  Growth Trajectory
                </h3>
                <p className="text-sm text-slate-400 font-medium font-mono uppercase tracking-[0.1em]">
                  Headcount Analytics • Last 6 Cycles
                </p>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-slate-100" />
                ))}
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#014A6E" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#014A6E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dx={-8} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "none",
                      borderRadius: "16px",
                      boxShadow: "0 12px 36px rgba(1,74,110,0.1)",
                    }}
                    itemStyle={{ color: "#014A6E", fontSize: "12px", fontWeight: 800 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#014A6E"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#chartGradient)"
                    dot={{ fill: "#014A6E", r: 4, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payroll Panel */}
          <div className="glass-panel p-8 space-y-6 border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
              <Banknote size={20} className="text-emerald-500" />
              Fiscal Disbursement
            </h3>

            <div className="space-y-3">
              {[
                { label: "Gross Salary Pot", value: `LKR ${stats.totalGross.toLocaleString()}`, icon: Banknote, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Fixed Allowances", value: `LKR ${stats.totalAllowances.toLocaleString()}`, icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Statutory Deductions", value: `LKR ${(stats.totalGross - stats.totalNet).toLocaleString()}`, icon: TrendingUp, color: "text-red-500", bg: "bg-red-50" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between shadow-sm group hover:border-slate-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl", item.bg)}>
                      <item.icon size={16} className={item.color} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Net payable */}
            <div className="p-8 rounded-[32px] bg-slate-900 relative overflow-hidden group shadow-2xl shadow-slate-300">
              <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-all duration-1000">
                <ShieldCheck size={140} className="text-white" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Net Monthly Liability
              </p>
              <h4 className="text-3xl font-black text-white tracking-tighter">
                LKR {stats.totalNet.toLocaleString()}
              </h4>
              <Link href="/payroll">
                <button className="w-full mt-8 py-4 rounded-2xl bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-[#8AC53E] hover:text-white transition-all active:scale-95 shadow-lg">
                  Verify & Process
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
