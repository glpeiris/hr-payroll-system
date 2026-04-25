"use client";

import { Bell, Search, Plus } from "lucide-react";

export function Header() {
  return (
    <header className="h-18 px-8 py-4 flex items-center justify-between z-40 sticky top-0
                       bg-white/80 backdrop-blur-xl border-b border-slate-200/80
                       shadow-[0_1px_12px_0_rgba(30,41,99,0.06)]">

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400
                       group-focus-within:text-[#8AC53E] transition-all duration-300"
            size={17}
          />
          <input
            type="text"
            placeholder="Search employees, payroll, reports…"
            className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl
                       pl-11 pr-5 py-2.5 text-sm outline-none
                       focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100
                       transition-all font-medium text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4 ml-6">

        {/* Notification Bell */}
        <button className="relative p-2.5 rounded-2xl bg-slate-100 border border-slate-200
                           text-slate-500 hover:text-lime-600 hover:bg-lime-50 hover:border-lime-200
                           transition-all group shadow-sm">
          <Bell size={19} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#8AC53E] rounded-full
                           border-2 border-white shadow-[0_0_8px_rgba(138,197,62,0.6)]
                           group-hover:scale-125 transition-transform" />
        </button>

        <div className="h-7 w-px bg-slate-200" />

        {/* New Action */}
        <button className="btn-primary flex items-center gap-2 group">
          <Plus size={17} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>New Action</span>
        </button>
      </div>
    </header>
  );
}
