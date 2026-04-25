"use client";

import React, { useState, useEffect } from "react";
import { Shell } from "@/components/Shell";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Lock, 
  Loader2,
  Mail,
  UserCheck,
  MessageCircle,
  X,
  Download
} from "lucide-react";
import { cn, downloadExcel } from "@/lib/utils";
import * as XLSX from "xlsx";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  updateDoc, 
  doc, 
  deleteDoc,
  setDoc,
  serverTimestamp,
  orderBy 
} from "firebase/firestore";

const roles = ["Master Admin", "HR Manager", "Payroll Officer", "Employee"];

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  createdAt: any;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [activeUserForMsg, setActiveUserForMsg] = useState<UserProfile | null>(null);
  const [customMsg, setCustomMsg] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    role: "Employee"
  });

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(userData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editUser) {
        await updateDoc(doc(db, "users", editUser.id), {
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          role: formData.role
        });
      } else {
        const userRef = doc(collection(db, "users"));
        await setDoc(userRef, {
          ...formData,
          status: "Active",
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setFormData({ fullName: "", email: "", phoneNumber: "", role: "Employee" });
      setEditUser(null);
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      role: user.role
    });
    setIsModalOpen(true);
  };

  const openMessageModal = (user: UserProfile) => {
    setActiveUserForMsg(user);
    setCustomMsg("");
    setIsMsgModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!activeUserForMsg || !customMsg) return;
    setIsSubmitting(true);
    try {
      await sendStatusEmail(activeUserForMsg.email, activeUserForMsg.fullName, "Message", customMsg);
      setIsMsgModalOpen(false);
      setCustomMsg("");
      alert("✅ Transmission Successful: The message has been dispatched to the user's registry email.");
    } catch (e) {
      console.error("Msg failed:", e);
      alert("❌ Transmission Failed: Please ensure your EmailJS configuration (Service ID, Template ID, Public Key) is correctly set up in the source code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        status: "Active"
      });
      
      // Trigger Approval Email
      await sendStatusEmail(user.email, user.fullName, "Approved");
      
      // Trigger Telegram Update for Admin
      notifyAdminOfAction(user.fullName, "Authorized");
    } catch (error) {
      console.error("Approval error:", error);
    }
  };

  const handleReject = async (user: UserProfile) => {
    if (confirm(`Are you sure you want to DENY access to ${user.fullName}? This will remove their registration request.`)) {
      try {
        // Trigger Rejection Email BEFORE deleting
        await sendStatusEmail(user.email, user.fullName, "Rejected");
        
        await deleteDoc(doc(db, "users", user.id));
        
        // Trigger Telegram Update for Admin
        notifyAdminOfAction(user.fullName, "Denied");
      } catch (error) {
        console.error("Rejection error:", error);
      }
    }
  };

  const sendStatusEmail = async (email: string, name: string, status: "Approved" | "Rejected" | "Message", customMsgContent?: string) => {
    // Configuration retrieved from environment variables (.env.local)
    const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_placeholder";
    const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "user_placeholder";
    
    // Select template based on status
    let templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DIRECT_MSG || "template_direct_msg";
    if (status === "Approved") templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_APPROVAL || "template_approval";
    if (status === "Rejected") templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_REJECTION || "template_rejection";

    if (SERVICE_ID.includes("placeholder")) {
      console.warn("⚠️ Email service not configured. Please define NEXT_PUBLIC_EMAILJS_SERVICE_ID in .env.local");
      return;
    }

    const payload = {
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      template_params: {
        to_email: email,
        user_name: name,
        status: status,
        custom_message: customMsgContent || "No additional message provided.",
        system_name: "GSOFT Enterprise HRMS",
        login_url: window.location.origin + "/login"
      }
    };

    try {
      console.log(`📡 Dispatching ${status} transmission to: ${email}`);
      
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`EmailJS Error: ${errorText}`);
      }

      console.log(`✅ ${status} email transmitted successfully.`);
    } catch (e) {
      console.error("❌ Email transmission failed:", e);
      throw e; // Bubble up for the UI to handle
    }
  };

  const notifyAdminOfAction = async (name: string, action: string) => {
    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
    
    if (!BOT_TOKEN || BOT_TOKEN.includes("YOUR")) {
      console.warn("⚠️ Telegram notification skipped: No BOT_TOKEN configured.");
      return;
    }

    const message = `✅ *Access ${action}*\n\n*User:* ${name}\n*Time:* ${new Date().toLocaleTimeString()}\n\n_Registry has been updated successfully._`;
    
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "Markdown" })
      });
    } catch (e) {
      console.error("Telegram status update failed:", e);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === "Active" ? "Suspended" : "Active";
    try {
      await updateDoc(doc(db, "users", user.id), {
        status: newStatus
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this user profile?")) {
      try {
        await deleteDoc(doc(db, "users", id));
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  const handleExportExcel = () => {
    if (users.length === 0) return;
    
    // Prepare flattened data for Excel
    const data = users.map(user => ({
      "Full Name": user.fullName || "N/A",
      "Email": user.email,
      "Phone": user.phoneNumber || "N/A",
      "Role": user.role,
      "Status": user.status || "Active"
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "UserRegistry");
    
    // Generate Base64 to bypass naming issues
    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    downloadExcel(excelBase64, "User_Registry_Export");
  };

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8AC53E]">
              Identity & Access Management
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              User Registry (RBAC)
            </h1>
            <p className="text-slate-500 text-lg font-medium">Define roles, manage permissions, and track system access.</p>
          </div>
          <button 
            onClick={() => {
              setEditUser(null);
              setFormData({ fullName: "", email: "", phoneNumber: "", role: "Employee" });
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2 group shadow-xl shadow-lime-200"
          >
            <UserPlus size={18} className="group-hover:scale-110 transition-transform" />
            <span>Register New User</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: "Total Users", value: users.length, icon: Users, color: "text-[#014A6E]", bg: "bg-slate-100" },
            { label: "Pending Approval", value: users.filter(u => u.status === "Pending").length, icon: Lock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Active Admins", value: users.filter(u => u.role === "Master Admin").length, icon: Shield, color: "text-[#8AC53E]", bg: "bg-lime-50" },
            { label: "Online Now", value: "1", icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl", stat.bg, stat.color)}>
                  <stat.icon size={18} />
                </div>
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* User Table */}
        <div className="glass-panel overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={17} />
              <input 
                type="text" 
                placeholder="Search by name, email, or role..."
                className="input-field pl-11 h-11"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-all">
                <Filter size={14} />
                Role: All
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-all"
              >
                <Download size={14} className="text-emerald-500" />
                Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-[#8AC53E]" size={32} />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hydrating User Data...</p>
              </div>
            ) : (
              <table className="w-full text-left font-medium">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">User Identity</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact / Phone</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Access Role</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-slate-500 text-xs border border-white">
                            {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('') : "U"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{user.fullName}</p>
                            <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-sm text-slate-600 font-bold">{user.phoneNumber || "N/A"}</span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className={cn(
                             user.role === "Master Admin" ? "text-[#8AC53E]" : "text-primary"
                          )} />
                          <span className="text-sm font-bold text-slate-700">{user.role}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          user.status === "Active" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : user.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-700 border-red-100"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", user.status === "Active" ? "bg-emerald-500 " : user.status === "Pending" ? "bg-amber-500 animate-pulse" : "bg-red-500")} />
                          {user.status}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {user.status === "Pending" && (
                            <>
                              <button 
                                onClick={() => handleApprove(user)}
                                className="px-3 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all mr-1"
                              >
                                Authorize Access
                              </button>
                              <button 
                                onClick={() => handleReject(user)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-red-100 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all mr-2"
                              >
                                Deny Request
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => openMessageModal(user)}
                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                            title="Direct Message"
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button onClick={() => startEdit(user)} className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-50 transition-all">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleToggleStatus(user)} className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all">
                            <Lock size={16} />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                            <Trash2 size={16} />
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

      {/* Direct Message Modal */}
      {isMsgModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMsgModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                    <MessageCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Direct Correspondence</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">To: {activeUserForMsg?.fullName}</p>
                  </div>
                </div>
                <button onClick={() => setIsMsgModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Transmission Payload (Message)</label>
                  <textarea
                    required
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Type your message here... (e.g. Please update your phone number for payroll verification.)"
                    className="input-field min-h-[160px] p-5 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setIsMsgModalOpen(false)} className="flex-1 px-8 py-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                    Discard
                  </button>
                  <button 
                    onClick={handleSendMessage} 
                    disabled={isSubmitting || !customMsg} 
                    className="flex-1 btn-primary py-4 flex items-center justify-center gap-3 shadow-xl shadow-lime-200 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : (
                      <>
                        <span>Broadcast Email</span>
                        <Mail size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {editUser ? "Modify Identity" : "Identity Ingestion"}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Configure security role & profile parameters.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Full Legal Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    placeholder="e.g. Alexander Pierce" 
                    className="input-field h-12"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Enterprise Email</label>
                    <input 
                      type="email" 
                      required
                      disabled={!!editUser}
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="a.pierce@company.com" 
                      className="input-field h-12 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      required
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="+1 (555) 000-0000" 
                      className="input-field h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Security Access Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({...formData, role})}
                        className={cn(
                          "px-4 py-3 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all",
                          formData.role === role 
                            ? "bg-[#8AC53E] border-[#8AC53E] text-white shadow-lg shadow-lime-200" 
                            : "bg-white border-slate-200 text-slate-500 hover:border-lime-300 hover:bg-lime-50"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary py-4 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : (editUser ? "Commit Profile" : "Finalize Registry")}
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

// Re-using the Plus icon rotated as a close button, but need to import it if not available
function Plus({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
