"use client";

import React, { useState, useEffect, useRef } from "react";
import { Shell } from "@/components/Shell";
import {
  User,
  Briefcase,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Camera,
  Fingerprint,
  Plus,
  Info,
  Banknote,
  Building2,
  Calendar,
  Mail,
  Phone,
  Hash,
  MapPin,
  Heart,
  ShieldCheck,
  ToggleLeft,
  Loader2,
  Search,
  X,
  Lock,
  Edit,
  GraduationCap,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, getDocs, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const steps = [
  { id: 1, name: "Identity Profile", icon: User, description: "Personal details & identification" },
  { id: 2, name: "Job Logistics", icon: Briefcase, description: "Role, scale & compensation" },
  { id: 3, name: "Bank & Statutory", icon: CreditCard, description: "Dual account configuration" },
  { id: 4, name: "Verification", icon: ShieldCheck, description: "Compliance review & audit" },
];

export default function RegistrationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-[#014A6E]" size={48} /></div>}>
      <RegistrationContent />
    </Suspense>
  );
}

function RegistrationContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for retrieving pending records
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingEmployees, setPendingEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Data Grid View State
  const [viewMode, setViewMode] = useState<"form" | "grid">("form");
  const [gridEditEnabled, setGridEditEnabled] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Masters Data for Dropdowns
  const [mastersData, setMastersData] = useState<any>({
    Divisions: [],
    Departments: [],
    Designations: [],
    "Employment Types": [],
    "Salary Scales": [],
    "Bank Branches": []
  });

  // Unified Form State (Reset Template)
  const resetTemplate = {
    memberId: "",
    nameWithInitials: "",
    fullName: "",
    permanentAddress: "",
    idPassportNo: "",
    dob: "",
    religion: "",
    civilStatus: "Unmarried",
    contactNo: "",
    email: "",
    gender: "Male",
    qualification: "",
    experience: "",
    jointDate: "",
    appointmentDate: "",
    employeeType: "",
    division: "",
    department: "",
    designation: "",
    salaryScale: "",
    epfActive: "Yes",
    grossSalary: "",
    entitledLeave: "",
    allowAllowance: "No",
    allowOvertime: "No",
    basicSalary1: "",
    basicSalary2: "",
    fixedAllowance1: "",
    fixedAllowance2: "",
    fixedAllowance3: "",
    specialNote: "",
    bank1: { name: "", branch: "", accountNo: "", branchId: "", isActive: true },
    bank2: { name: "", branch: "", accountNo: "", branchId: "", isActive: false }
  };

  const [formData, setFormData] = useState(resetTemplate);

  // Fetch Masters for Dropdowns
  useEffect(() => {
    const categories = Object.keys(mastersData);
    const unsubscribes = categories.map(category => {
      const q = query(collection(db, "masters"), where("category", "==", category), where("status", "==", "Active"));
      return onSnapshot(q, (snapshot) => {
        setMastersData((prev: any) => ({
          ...prev,
          [category]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Fetch pending employees when search is open
  useEffect(() => {
    if (isSearchOpen) {
      const q = query(collection(db, "employees"), where("status", "==", "Pending Approval"));
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side sort by createdAt (Latest first)
        data.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setPendingEmployees(data);
      }, (err) => {
        console.error("Registry buffer fetch error:", err);
      });
      return unsub;
    }
  }, [isSearchOpen]);

  // Fetch Grid Permissions
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "registrationGrid"), (docSnap) => {
      if (docSnap.exists()) {
        setGridEditEnabled(docSnap.data().editEnabled || false);
      }
    });
    return unsub;
  }, []);

  // Handle direct Edit ID from URL
  useEffect(() => {
    if (editId) {
      const fetchEmployee = async () => {
        try {
          const docRef = doc(db, "employees", editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const emp = { id: docSnap.id, ...docSnap.data() };
            handleRetrieveRequest(emp);
          }
        } catch (error) {
          console.error("Error fetching employee for edit:", error);
        }
      };
      fetchEmployee();
    }
  }, [editId]);

  // Fetch all employees for Data Grid View
  useEffect(() => {
    if (viewMode === "grid") {
      const q = query(collection(db, "employees"));
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAllEmployees(data);
      });
      return unsub;
    }
  }, [viewMode]);

  const validateSalaries = (data: any = formData) => {
    const gross = parseFloat(data.grossSalary) || 0;
    const b1 = parseFloat(data.basicSalary1) || 0;
    const b2 = parseFloat(data.basicSalary2) || 0;
    const f1 = parseFloat(data.fixedAllowance1) || 0;
    const f2 = parseFloat(data.fixedAllowance2) || 0;
    const f3 = parseFloat(data.fixedAllowance3) || 0;
    
    // 1. Scale Validation
    if (data.salaryScale) {
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankChange = (bankNum: 1 | 2, field: string, value: any) => {
    const bankKey = bankNum === 1 ? 'bank1' : 'bank2';
    setFormData(prev => ({
      ...prev,
      [bankKey]: { ...(prev as any)[bankKey], [field]: value }
    }));
  };

  const handleRetrieveRequest = (emp: any) => {
    setEditingId(emp.id);
    setFormData({
      memberId: emp.memberId || "",
      nameWithInitials: emp.nameWithInitials || "",
      fullName: emp.fullName || "",
      permanentAddress: emp.permanentAddress || "",
      idPassportNo: emp.idPassportNo || "",
      dob: emp.dob || "",
      religion: emp.religion || "",
      civilStatus: emp.civilStatus || "Unmarried",
      contactNo: emp.contactNo || "",
      email: emp.email || "",
      gender: emp.gender || "Male",
      qualification: emp.qualification || "",
      experience: emp.experience || "",
      jointDate: emp.jointDate || "",
      appointmentDate: emp.appointmentDate || "",
      employeeType: emp.employeeType || "",
      division: emp.division || "",
      department: emp.department || "",
      designation: emp.designation || "",
      salaryScale: emp.salaryScale || "",
      epfActive: emp.epfActive || "Yes",
      grossSalary: emp.grossSalary || "",
      entitledLeave: emp.entitledLeave || "",
      basicSalary1: emp.basicSalary1 || "",
      basicSalary2: emp.basicSalary2 || "",
      fixedAllowance1: emp.fixedAllowance1 || "",
      fixedAllowance2: emp.fixedAllowance2 || "",
      fixedAllowance3: emp.fixedAllowance3 || "",
      specialNote: emp.specialNote || "",
      allowAllowance: emp.allowAllowance || "No",
      allowOvertime: emp.allowOvertime || "No",
      bank1: emp.bank1 || resetTemplate.bank1,
      bank2: emp.bank2 || resetTemplate.bank2,
    });
    setProfileImage(emp.profileImage || null);
    setIsSearchOpen(false);
    setCurrentStep(1);
    alert(`📂 Record for ${emp.fullName} retrieved. You can now finalize the entry.`);
  };

  // ── Biometric Capture Logic ──────────────────────
  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera access for biometric capture.");
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

   const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      // Attempt to capture with slightly lower quality if needed to keep size under control
      let quality = 0.9;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // Approximate size in bytes (base64 string is about 1.33x the actual size)
      const approxSize = dataUrl.length * 0.75;
      
      if (approxSize > 500 * 1024) {
        alert("🚨 Biometric Induction failed: Image exceeds 500 KB protocol limit. Try moving backwards or adjusting lighting.");
        return;
      }
      
      setProfileImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert(`🚨 Registry Breach: Document size (${(file.size / 1024).toFixed(1)} KB) exceeds 500 KB security protocol. Upload aborted.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalise = async () => {
    // Final Reconciliation Guard
    if (!validateSalaries()) {
      setCurrentStep(2); // Redirect back to fix the values
      return;
    }

    setIsSubmitting(true);
    try {
      const recordData = {
        ...formData,
        profileImage,
        status: "Pending Approval",
        registryStatus: "Draft Finalized",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "employees", editingId), recordData);
        alert("✅ Registry record updated. Identity is now awaiting induction audit.");
      } else {
        await addDoc(collection(db, "employees"), {
          ...recordData,
          createdAt: serverTimestamp(),
        });
        alert("✅ New registry submission complete. Identity is now awaiting induction audit.");
      }

      // Reset State
      setFormData(resetTemplate);
      setProfileImage(null);
      setEditingId(null);
      setCurrentStep(1);
    } catch (error) {
      console.error("Registry commit error:", error);
      alert("❌ Submission failed. Security layer blocked the commit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-12 pb-24">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8AC53E]">
              Human Capital Management
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-slate-900">
              Registration <span className="text-[#014A6E] italic">Information</span>
              {editingId && (
                <span className="ml-4 px-4 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                  Finalizing Draft
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-lg font-medium max-w-xl">
              Constructing an enterprise-grade digital identity for the corporate registry.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 z-10">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setViewMode("form")}
                className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === "form" ? "bg-white text-[#014A6E] shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Draft Form
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === "grid" ? "bg-white text-[#014A6E] shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Data Grid
              </button>
            </div>
            {viewMode === "form" && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#014A6E] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#013550] transition-all shadow-xl shadow-[#014A6E]/20"
              >
                <Search size={16} /> Retrieve Pending Record
              </button>
            )}
            <div className="hidden lg:flex flex-col items-end">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-1">Entry Protocol</div>
              <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs font-bold text-[#014A6E]">
                REQ-GSOFT-{new Date().getFullYear()}-0422
              </div>
            </div>
          </div>
        </div>

        {viewMode === "form" ? (
          <>
            {/* Professional Stepper (Petrol/Lime Theme) */}
            <div className="bg-white rounded-[40px] p-2 border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex flex-col lg:flex-row gap-1">
                {steps.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const Icon = step.icon;

                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex-1 flex items-center gap-4 p-6 rounded-[32px] transition-all duration-700 text-left relative overflow-hidden group",
                        isActive ? "bg-[#014A6E]/5" : "hover:bg-slate-50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 border relative z-10",
                          isActive ? "bg-[#014A6E] text-white border-[#014A6E] shadow-2xl shadow-[#014A6E]/30 scale-110" :
                            isCompleted ? "bg-[#8AC53E]/10 text-[#8AC53E] border-[#8AC53E]/20" :
                              "bg-slate-50 text-slate-400 border-slate-100"
                        )}
                      >
                        {isCompleted ? <CheckCircle2 size={26} className="text-white" /> : <Icon size={26} />}
                        {isCompleted && <div className="absolute inset-0 bg-[#8AC53E] rounded-2xl -z-10" />}
                      </div>
                      <div className="relative z-10">
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] transition-colors mb-0.5", isActive ? "text-[#014A6E]" : isCompleted ? "text-[#8AC53E]" : "text-slate-400")}>
                          Phase 0{step.id}
                        </p>
                        <p className={cn("text-base font-black tracking-tight transition-colors", isActive ? "text-[#014A6E]" : "text-slate-700")}>
                          {step.name}
                        </p>
                      </div>
                      {isActive && <div className="absolute bottom-0 left-6 right-6 h-1.5 bg-[#8AC53E] rounded-t-full shadow-[0_-4px_10px_rgba(138,197,62,0.5)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phase Container */}
            <div className="glass-panel p-12 lg:p-16">
              <div className="space-y-16">

                {/* ── PHASE 1: IDENTITY PROFILE ────────────────── */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    {/* Visual Identity Profile */}
                    <div className="xl:col-span-1 flex flex-col items-center group">
                      <div className="relative">
                        <div className={cn(
                          "w-64 h-64 rounded-[64px] bg-[#014A6E]/5 border-2 flex flex-col items-center justify-center gap-4 transition-all duration-700 cursor-pointer overflow-hidden shadow-inner",
                          profileImage ? "border-[#8AC53E]" : "border-dashed border-[#014A6E]/20"
                        )}>
                          {isCapturing ? (
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                          ) : profileImage ? (
                            <img src={profileImage} alt="Identity Profile" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Camera size={48} className="text-[#014A6E]/20 group-hover:text-[#8AC53E] group-hover:scale-110 transition-all duration-700" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#014A6E]/30 text-center px-4">Induction Photo Pending</span>
                            </>
                          )}
                        </div>

                        {/* Hidden Canvas for capture */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Dual Action Layer */}
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full justify-center px-4">
                          {isCapturing ? (
                            <button
                              onClick={capturePhoto}
                              className="flex-1 bg-[#8AC53E] text-white py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-lime-200 border border-white hover:scale-105 transition-transform"
                            >
                              <CheckCircle2 size={16} />
                              <span className="text-[9px] font-black uppercase tracking-widest">Capture</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={startCamera}
                                className="p-3 bg-[#014A6E] text-white rounded-2xl shadow-xl shadow-[#014A6E]/30 hover:bg-[#014A6E]/90 transition-all border border-white/20"
                                title="Live Biometric Capture"
                              >
                                <Camera size={20} />
                              </button>
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 bg-white text-[#014A6E] rounded-2xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-all"
                                title="Upload Induction Image"
                              >
                                <Plus size={20} />
                              </button>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                              />
                            </>
                          )}
                        </div>

                        <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#8AC53E] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-lime-200 border-4 border-white group-hover:scale-110 transition-transform duration-500">
                          <Fingerprint size={20} />
                        </div>
                      </div>

                      <div className="mt-12 text-center">
                        <p className="text-sm font-black text-[#014A6E] uppercase tracking-widest">Biometric Induction</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Registry Standard 1.0</p>
                      </div>
                    </div>

                    {/* Identity Fields */}
                    <div className="xl:col-span-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                        <div className="md:col-span-2 flex items-center gap-4 bg-[#014A6E]/5 p-4 rounded-3xl border border-[#014A6E]/10 mb-2">
                          <Info className="text-[#014A6E]" size={20} />
                          <p className="text-xs font-bold text-[#014A6E]/70 uppercase tracking-widest">Personal Identification Metrics</p>
                        </div>

                        <div className="space-y-2.5 relative">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Hash size={14} className="text-[#8AC53E]" /> Member ID (EPF No)
                          </label>
                          <input
                            type="text"
                            value={formData.memberId}
                            onChange={(e) => handleChange('memberId', e.target.value)}
                            placeholder="e.g. EPF-9020"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <User size={14} className="text-[#8AC53E]" /> Name with Initials
                          </label>
                          <input
                            type="text"
                            value={formData.nameWithInitials}
                            onChange={(e) => handleChange('nameWithInitials', e.target.value)}
                            placeholder="e.g. Mr. J.R.R. Tolkien"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <User size={14} className="text-[#8AC53E]" /> Full Name
                          </label>
                          <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            placeholder="e.g. Mr. Jonathan Arthur Smith"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <MapPin size={14} className="text-[#8AC53E]" /> Permanent Address
                          </label>
                          <textarea
                            rows={2}
                            value={formData.permanentAddress}
                            onChange={(e) => handleChange('permanentAddress', e.target.value)}
                            placeholder="Registry registered residence..."
                            className="input-field border-[#014A6E]/10 bg-white resize-none"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <ShieldCheck size={14} className="text-[#8AC53E]" /> ID/Passport No
                          </label>
                          <input
                            type="text"
                            value={formData.idPassportNo}
                            onChange={(e) => handleChange('idPassportNo', e.target.value)}
                            placeholder="NIC/Passport identifier"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Calendar size={14} className="text-[#8AC53E]" /> Date of Birth
                          </label>
                          <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => handleChange('dob', e.target.value)}
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Heart size={14} className="text-[#8AC53E]" /> Religion
                          </label>
                          <input
                            type="text"
                            value={formData.religion}
                            onChange={(e) => handleChange('religion', e.target.value)}
                            placeholder="Optional"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <User size={14} className="text-[#8AC53E]" /> Civil Status
                          </label>
                          <select
                            value={formData.civilStatus}
                            onChange={(e) => handleChange('civilStatus', e.target.value)}
                            className="input-field border-[#014A6E]/10 bg-white"
                          >
                            {["Unmarried", "Married", "Divorced", "Widowed"].map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Phone size={14} className="text-[#8AC53E]" /> Contact No
                          </label>
                          <input
                            type="tel"
                            value={formData.contactNo}
                            onChange={(e) => handleChange('contactNo', e.target.value)}
                            placeholder="+94 7X XXX XXXX"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Mail size={14} className="text-[#8AC53E]" /> Email
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="official.email@gsoft.com"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        {/* NEW FIELDS: Gender, Qualification, Experience */}
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <User size={14} className="text-[#8AC53E]" /> Gender Identification
                          </label>
                          <select
                            value={formData.gender}
                            onChange={(e) => handleChange('gender', e.target.value)}
                            className="input-field border-[#014A6E]/10 bg-white font-bold"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <GraduationCap size={14} className="text-[#8AC53E]" /> Highest Qualification
                          </label>
                          <input
                            type="text"
                            value={formData.qualification}
                            onChange={(e) => handleChange('qualification', e.target.value)}
                            placeholder="e.g. B.Sc in Computer Science"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-1">
                            <Briefcase size={14} className="text-[#8AC53E]" /> Professional Experience
                          </label>
                          <input
                            type="text"
                            value={formData.experience}
                            onChange={(e) => handleChange('experience', e.target.value)}
                            placeholder="e.g. 5 Years in Software Engineering"
                            className="input-field border-[#014A6E]/10 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PHASE 2: JOB LOGISTICS ────────────────────── */}
                {currentStep === 2 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-12">
                    <div className="flex items-center gap-4 bg-[#8AC53E]/10 p-5 rounded-3xl border border-[#8AC53E]/20">
                      <Briefcase className="text-[#8AC53E]" size={24} />
                      <div>
                        <h4 className="text-sm font-black text-[#014A6E] uppercase tracking-widest">Placement & Compensation Logic</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mapping the employee into the organisational hierarchy</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {/* 1. Joint Date */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">1. Joint Date</label>
                        <input type="date" value={formData.jointDate} onChange={(e) => handleChange('jointDate', e.target.value)} className="input-field" />
                      </div>

                      {/* 2. Date of Appointment */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">2. Date of Appointment</label>
                        <input type="date" value={formData.appointmentDate} onChange={(e) => handleChange('appointmentDate', e.target.value)} className="input-field" />
                      </div>

                      {/* 3. Employee Type */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">3. Employee Type</label>
                        <select value={formData.employeeType} onChange={(e) => handleChange('employeeType', e.target.value)} className="input-field">
                          <option value="">Select Type</option>
                          {mastersData["Employment Types"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* 4. Division */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">4. Division</label>
                        <select value={formData.division} onChange={(e) => handleChange('division', e.target.value)} className="input-field">
                          <option value="">Select Division</option>
                          {mastersData["Divisions"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* 5. Department */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">5. Department</label>
                        <select value={formData.department} onChange={(e) => handleChange('department', e.target.value)} className="input-field">
                          <option value="">Select Department</option>
                          {mastersData["Departments"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* 6. Designation */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">6. Designation</label>
                        <select value={formData.designation} onChange={(e) => handleChange('designation', e.target.value)} className="input-field">
                          <option value="">Select Designation</option>
                          {mastersData["Designations"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* 7. Salary Scale */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">7. Salary Scale</label>
                        <select 
                          value={formData.salaryScale} 
                          onChange={(e) => handleChange('salaryScale', e.target.value)} 
                          className="input-field"
                        >
                          <option value="">Select Salary Scale</option>
                          {mastersData["Salary Scales"]?.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        {formData.salaryScale && (
                          <div className="mt-2 text-[9px] font-bold text-[#014A6E] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center justify-between">
                            <span>LIMITS:</span>
                            <span className="font-mono">
                              {mastersData["Salary Scales"]?.find((m: any) => m.name === formData.salaryScale)?.salaryRangeMin || "0"} 
                              - 
                              {mastersData["Salary Scales"]?.find((m: any) => m.name === formData.salaryScale)?.salaryRangeMax || "0"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 8. Gross Salary Control */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#014A6E] ml-1 font-black">8. Gross Salary Control</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={formData.grossSalary} 
                            onChange={(e) => handleChange('grossSalary', e.target.value)} 
                            className="input-field bg-blue-50/50 border-blue-200 pl-10" 
                            placeholder="0.00" 
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">LKR</span>
                        </div>
                      </div>

                      {/* ── Structured Basic Salary Panel ────────────────── */}
                      <div className="lg:col-span-3 mt-6 p-8 bg-slate-50 border border-slate-200 rounded-[32px] space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#014A6E] flex items-center justify-center text-white shadow-lg">
                              <DollarSign size={20} />
                            </div>
                            <div>
                              <h5 className="text-sm font-black text-[#014A6E] uppercase tracking-widest italic">Fiscal <span className="text-[#8AC53E]">Matrix</span> Expansion</h5>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Reconcile individual components against the Gross control</p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                            Math.abs((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0) - (parseFloat(formData.grossSalary) || 0)) < 0.01
                            ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                            : "bg-red-50 border-red-100 text-red-600 animate-pulse"
                          )}>
                             {Math.abs((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0) - (parseFloat(formData.grossSalary) || 0)) < 0.01 
                             ? "✓ Total Reconciled" 
                             : "⚠ Mismatch in Components"}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                          {/* 9. Basic Salary I */}
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Basic Salary I</label>
                            <input 
                              type="number" 
                              value={formData.basicSalary1} 
                              onChange={(e) => handleChange('basicSalary1', e.target.value)} 
                              className="input-field bg-white" 
                              placeholder="0.00" 
                            />
                          </div>

                          {/* 10. Basic Salary II */}
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Basic II / BR</label>
                            <input 
                              type="number" 
                              value={formData.basicSalary2} 
                              onChange={(e) => handleChange('basicSalary2', e.target.value)} 
                              className="input-field bg-white" 
                              placeholder="0.00" 
                            />
                          </div>

                          {/* 11. Fixed Allowance I */}
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Fixed Allow I</label>
                            <input 
                              type="number" 
                              value={formData.fixedAllowance1} 
                              onChange={(e) => handleChange('fixedAllowance1', e.target.value)} 
                              className="input-field bg-white" 
                              placeholder="0.00" 
                            />
                          </div>

                          {/* 12. Fixed Allowance II */}
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Fixed Allow II</label>
                            <input 
                              type="number" 
                              value={formData.fixedAllowance2} 
                              onChange={(e) => handleChange('fixedAllowance2', e.target.value)} 
                              className="input-field bg-white" 
                              placeholder="0.00" 
                            />
                          </div>

                          {/* 13. Fixed Allowance III */}
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Fixed Allow III</label>
                            <input 
                              type="number" 
                              value={formData.fixedAllowance3} 
                              onChange={(e) => handleChange('fixedAllowance3', e.target.value)} 
                              className="input-field bg-white" 
                              placeholder="0.00" 
                            />
                          </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             Aggregate: LKR {((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0)).toLocaleString()}
                           </div>
                        </div>
                      </div>

                      {/* 14. EPF Active Protocol */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">14. EPF Active Protocol</label>
                        <select value={formData.epfActive} onChange={(e) => handleChange('epfActive', e.target.value)} className="input-field">
                          <option value="Yes">Yes (Enabled)</option>
                          <option value="No">No (Disabled)</option>
                        </select>
                      </div>

                      {/* 15. Standard Allowance and Overtime Enable */}
                      <div className="space-y-2.5 lg:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">15. Allowance & O.T. Entitlement</label>
                        <div className="flex flex-wrap gap-8 items-center h-12 px-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={formData.allowAllowance === "Yes"} 
                              onChange={(e) => handleChange('allowAllowance', e.target.checked ? "Yes" : "No")} 
                              className="w-5 h-5 rounded-lg text-[#8AC53E] border-slate-300 focus:ring-[#8AC53E]" 
                            />
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover:text-[#014A6E] transition-colors">Standard Allowance</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={formData.allowOvertime === "Yes"} 
                              onChange={(e) => handleChange('allowOvertime', e.target.checked ? "Yes" : "No")} 
                              className="w-5 h-5 rounded-lg text-blue-600 border-slate-300 focus:ring-blue-500" 
                            />
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover:text-[#014A6E] transition-colors">Overtime Enable</span>
                          </label>
                        </div>
                      </div>

                      {/* 16. Entitled Leave Per Annum */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">16. Entitled Leave Per Annum</label>
                        <input type="text" value={formData.entitledLeave} onChange={(e) => handleChange('entitledLeave', e.target.value)} placeholder="e.g. 14 Days" className="input-field" />
                      </div>

                      {/* 17. Special Note */}
                      <div className="lg:col-span-2 space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">17. Special Note</label>
                        <input type="text" value={formData.specialNote} onChange={(e) => handleChange('specialNote', e.target.value)} placeholder="Personnel logistics remarks..." className="input-field" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PHASE 3: BANK & STATUTORY ─────────────────── */}
                {currentStep === 3 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-12">
                    <div className="flex items-center gap-4 bg-[#014A6E]/5 p-6 rounded-3xl border border-[#014A6E]/10">
                      <CreditCard className="text-[#014A6E]" size={28} />
                      <div>
                        <h4 className="text-base font-black text-[#014A6E] uppercase tracking-widest italic">Electronic <span className="text-[#8AC53E]">Disbursement</span> Architecture</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configure dual-path banking for automated payroll reconciliation</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                      {/* Bank 1 */}
                      <div className={cn(
                        "p-10 rounded-[48px] border-2 transition-all duration-500 space-y-8",
                        formData.bank1.isActive ? "bg-white border-[#8AC53E] shadow-2xl shadow-lime-100" : "bg-slate-50 border-slate-200 grayscale opacity-60"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#8AC53E] flex items-center justify-center text-white">01</div>
                            <h5 className="font-black text-[#014A6E] uppercase tracking-widest">Primary Bank Channel</h5>
                          </div>
                          <button
                            onClick={() => handleBankChange(1, 'isActive', !formData.bank1.isActive)}
                            className={cn("px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                              formData.bank1.isActive ? "bg-[#8AC53E] text-white" : "bg-slate-200 text-slate-500")}
                          >
                            {formData.bank1.isActive ? 'Active Path' : 'Enable Path'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Bank Name</label>
                            <select
                              value={formData.bank1.name}
                              onChange={(e) => handleBankChange(1, 'name', e.target.value)}
                              className="input-field"
                            >
                              <option value="">Select Bank</option>
                              {mastersData["Bank Branches"]?.map((m: any) => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Branch Name</label>
                            <input type="text" value={formData.bank1.branch} onChange={(e) => handleBankChange(1, 'branch', e.target.value)} className="input-field" placeholder="Branch identifier" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Account No</label>
                            <input type="text" value={formData.bank1.accountNo} onChange={(e) => handleBankChange(1, 'accountNo', e.target.value)} className="input-field font-mono" placeholder="Digital account key" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Branch ID</label>
                            <input type="text" value={formData.bank1.branchId} onChange={(e) => handleBankChange(1, 'branchId', e.target.value)} className="input-field" placeholder="B-ID Code" />
                          </div>
                        </div>
                      </div>

                      {/* Bank 2 */}
                      <div className={cn(
                        "p-10 rounded-[48px] border-2 transition-all duration-500 space-y-8",
                        formData.bank2.isActive ? "bg-white border-[#8AC53E] shadow-2xl shadow-lime-100" : "bg-slate-50 border-slate-200 grayscale opacity-60"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#014A6E] flex items-center justify-center text-white">02</div>
                            <h5 className="font-black text-[#014A6E] uppercase tracking-widest">Secondary Bank Channel</h5>
                          </div>
                          <button
                            onClick={() => handleBankChange(2, 'isActive', !formData.bank2.isActive)}
                            className={cn("px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                              formData.bank2.isActive ? "bg-[#8AC53E] text-white" : "bg-slate-200 text-slate-500")}
                          >
                            {formData.bank2.isActive ? 'Active Path' : 'Enable Path'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Bank Name</label>
                            <select
                              value={formData.bank2.name}
                              onChange={(e) => handleBankChange(2, 'name', e.target.value)}
                              className="input-field"
                            >
                              <option value="">Select Bank</option>
                              {mastersData["Bank Branches"]?.map((m: any) => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Branch Name</label>
                            <input type="text" value={formData.bank2.branch} onChange={(e) => handleBankChange(2, 'branch', e.target.value)} className="input-field" placeholder="Branch identifier" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Account No</label>
                            <input type="text" value={formData.bank2.accountNo} onChange={(e) => handleBankChange(2, 'accountNo', e.target.value)} className="input-field font-mono" placeholder="Digital account key" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Branch ID</label>
                            <input type="text" value={formData.bank2.branchId} onChange={(e) => handleBankChange(2, 'branchId', e.target.value)} className="input-field" placeholder="B-ID Code" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-[#8AC53E]/5 border border-[#8AC53E]/20 flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#8AC53E] shadow-sm border border-slate-100 flex-shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-[#014A6E] uppercase tracking-widest">Validation Protocol</p>
                        <p className="text-xs text-slate-500 font-medium">Monthly disbursement will only target the channel marked as <span className="text-[#8AC53E] font-black">ACTIVE</span>. If both paths are enabled, the primary channel takes precedence during the batch process.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PHASE 4: VERIFICATION ──────────────────── */}
                {currentStep === 4 && (
                  <div className="py-24 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-1000">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-[#014A6E]/5 border-2 border-[#014A6E]/10 flex items-center justify-center text-[#014A6E] shadow-inner">
                        <Fingerprint size={64} className="animate-pulse" />
                      </div>
                      <div className="absolute top-0 right-0 w-10 h-10 bg-[#8AC53E] rounded-full border-4 border-white flex items-center justify-center text-white scale-125">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>
                    <div className="max-w-md space-y-4">
                      <h3 className="text-3xl font-black text-[#014A6E] tracking-tight italic uppercase">Identity <span className="text-[#8AC53E]">Verification</span></h3>
                      <p className="text-slate-500 font-medium leading-relaxed">
                        All registry attributes have been mapped. Finalizing the entry will trigger a <span className="text-[#014A6E] font-black">Security Audit</span> and notify the administrative panel for induction approval.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 w-full max-w-2xl py-8">
                      {[
                        { label: "Identity", status: "Validated", color: "text-[#8AC53E]" },
                        { label: "Logistics", status: "Calculated", color: "text-[#8AC53E]" },
                        { label: "Fiscal Bridge", status: Math.abs(((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0)) - (parseFloat(formData.grossSalary) || 0)) < 0.01 ? "Bridged" : "Imbalance", color: Math.abs(((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0)) - (parseFloat(formData.grossSalary) || 0)) < 0.01 ? "text-[#8AC53E]" : "text-red-500 animate-pulse" },
                      ].map(stat => (
                        <div key={stat.label} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                          <p className={cn("text-xs font-black uppercase tracking-widest", stat.color)}>{stat.status}</p>
                        </div>
                      ))}
                    </div>

                    <div className="w-full max-w-2xl p-8 bg-blue-50/50 rounded-3xl border border-blue-100 text-left space-y-4">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">Final Fiscal Check-Sum</h5>
                       <div className="flex items-center justify-between">
                          <div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase">Gross Salary Control</p>
                             <p className="text-sm font-black text-[#014A6E]">LKR {Number(formData.grossSalary || 0).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-bold text-slate-400 uppercase">Calculated Matrix Sum</p>
                             <p className="text-sm font-black text-[#014A6E]">LKR {((parseFloat(formData.basicSalary1) || 0) + (parseFloat(formData.basicSalary2) || 0) + (parseFloat(formData.fixedAllowance1) || 0) + (parseFloat(formData.fixedAllowance2) || 0) + (parseFloat(formData.fixedAllowance3) || 0)).toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {/* Global Controls */}
                <div className="mt-12 pt-10 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                    disabled={currentStep === 1}
                    className="px-10 py-4 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#014A6E] hover:bg-slate-50 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center gap-3 group"
                  >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Phase Back
                  </button>

                  <div className="flex items-center gap-4">
                    <button className="px-10 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-[#014A6E] hover:bg-white hover:border-[#014A6E]/20 transition-all active:scale-95">
                      Cache Draft
                    </button>
                    <button
                      onClick={() => {
                        if (currentStep === 4) {
                          handleFinalise();
                          return;
                        }

                         // VALIDATION: Step 2 to 3
                        if (currentStep === 2) {
                          if (!validateSalaries()) return;
                        }

                        setCurrentStep(currentStep + 1);
                      }}
                      disabled={isSubmitting}
                      className="btn-primary flex items-center gap-3 group px-12 py-4 shadow-[#8AC53E]/20"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                          <span>{currentStep === steps.length ? "Finalise Entry" : "Commit Segment"}</span>
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registry Grid Interface</h2>
                {gridEditEnabled ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheck size={16} /> Edit Enabled
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <Lock size={16} /> Read-Only Mode
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-[32px] border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky left-0 bg-slate-50 z-10 w-[280px]">Employee Identity</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact & Personal</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Placement Matrix</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Compensation Scale</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Dates & Status</th>
                      {gridEditEnabled && (
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right sticky right-0 bg-slate-50 z-10">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                        {/* Employee Identity */}
                        <td className="px-6 py-5 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#014A6E] font-black text-lg overflow-hidden shrink-0 shadow-sm">
                              {emp.profileImage ? <img src={emp.profileImage} alt="" className="w-full h-full object-cover" /> : (emp.fullName?.charAt(0) || "?")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-[#014A6E] truncate" title={emp.fullName}>{emp.fullName || "Unnamed"}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{emp.memberId || "Pending ID"} • {emp.idPassportNo || "No NIC"}</p>
                            </div>
                          </div>
                        </td>
                        {/* Contact & Personal */}
                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-slate-800 tracking-tight">{emp.contactNo || "No Phone"}</p>
                          <p className="text-[10px] font-bold text-slate-500 truncate max-w-[200px]" title={emp.email}>{emp.email || "No Email"}</p>
                        </td>
                        {/* Placement Matrix */}
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-[#014A6E] truncate max-w-[200px]">{emp.designation || "No Designation"}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[200px]">{emp.division || "No Div"} / {emp.department || "No Dept"}</p>
                        </td>
                        {/* Compensation Scale */}
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-slate-800">{emp.salaryScale || "No Scale"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("px-2 py-0.5 rounded-[6px] text-[8px] font-black uppercase tracking-widest border", emp.epfActive === "Yes" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                               EPF: {emp.epfActive || "No"}
                            </span>
                            <span className="px-2 py-0.5 rounded-[6px] text-[8px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-600 border-indigo-200">
                              {emp.employeeType || "Unclassified"}
                            </span>
                          </div>
                        </td>
                        {/* Dates & Status */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5 align-start items-start">
                            <span className={cn("px-3 py-1.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest shadow-sm",
                              emp.status === "Pending Approval" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            )}>
                              {emp.status || "Registered"}
                            </span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                              Joined: {emp.jointDate ? new Date(emp.jointDate).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                        </td>
                        {/* Actions */}
                        {gridEditEnabled && (
                          <td className="px-6 py-5 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors">
                            <button
                              onClick={() => {
                                handleRetrieveRequest(emp);
                                setViewMode("form");
                              }}
                              title="Edit Record"
                              className="p-3 bg-white text-[#8AC53E] rounded-2xl hover:bg-[#8AC53E] hover:text-white transition-all shadow-md border border-slate-200 hover:border-[#8AC53E] hover:scale-105 active:scale-95 inline-flex items-center justify-center group/btn"
                            >
                              <Edit size={18} className="transition-transform group-hover/btn:-rotate-12" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {allEmployees.length === 0 && (
                      <tr>
                        <td colSpan={gridEditEnabled ? 6 : 5} className="px-6 py-32 text-center">
                          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-5 border-2 border-slate-100 border-dashed">
                            <Lock size={32} />
                          </div>
                          <p className="text-slate-500 font-bold text-lg mb-1">No Registry Records Found</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Database is currently empty</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RETRIEVE PENDING MODAL ─────────────────── */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-12">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[48px] shadow-2xl border border-white overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[85vh]">

            {/* Modal Header */}
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[24px] bg-[#014A6E] text-white flex items-center justify-center shadow-xl shadow-[#014A6E]/20">
                  <Search size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#014A6E] tracking-tight">Retrieve Registry Drafts</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {(() => {
                      const filtered = pendingEmployees.filter(emp =>
                        emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        emp.memberId?.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      if (searchQuery) {
                        return `Found ${filtered.length} matching records`;
                      }
                      return `Found ${pendingEmployees.length} total records awaiting finalization`;
                    })()}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-8 px-10 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  type="text"
                  placeholder="Search by Employee Name or Member ID (EPF No)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-bold text-[#014A6E] focus:bg-white focus:border-[#8AC53E] transition-all outline-none"
                />
              </div>
            </div>

            {/* Records List */}
            <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar">
              {(() => {
                const filtered = pendingEmployees.filter(emp =>
                  emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  emp.memberId?.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-20 text-center space-y-4 animate-in fade-in duration-500">
                      <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-100">
                        <Search size={40} />
                      </div>
                      <p className="text-slate-400 font-bold italic">No matching registry drafts found in the induction buffer.</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Operational Status: Try adjusting your search query</p>
                    </div>
                  );
                }

                return filtered.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedId(selectedId === emp.id ? null : emp.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-6 rounded-[32px] border transition-all duration-500 text-left group",
                      selectedId === emp.id
                        ? "bg-[#8AC53E]/5 border-[#8AC53E] shadow-xl shadow-lime-100"
                        : "bg-slate-50/50 border-slate-100 hover:bg-white hover:border-[#8AC53E]"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      {/* Checkbox Selector */}
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        selectedId === emp.id
                          ? "bg-[#8AC53E] border-[#8AC53E] shadow-sm"
                          : "border-slate-200 bg-white"
                      )}>
                        {selectedId === emp.id && <CheckCircle2 size={14} className="text-white" />}
                      </div>

                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[#014A6E] font-black text-lg overflow-hidden group-hover:scale-110 transition-all duration-700">
                        {emp.profileImage ? (
                          <img src={emp.profileImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.fullName?.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8AC53E] mb-1">{emp.memberId || "Pending ID"}</p>
                        <h4 className="text-lg font-black text-[#014A6E] tracking-tight">{emp.fullName}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.division || "No Division"}</p>
                          <div className="w-1 h-1 rounded-full bg-slate-300" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.designation || "No Designation"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right mr-4 hidden md:block">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Entry Date</p>
                        <p className="text-xs font-bold text-slate-900">
                          {emp.createdAt?.toDate ? new Date(emp.createdAt.toDate()).toLocaleDateString() : 'Manual Entry'}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        selectedId === emp.id ? "bg-[#8AC53E] text-white" : "bg-[#014A6E]/5 text-[#014A6E]"
                      )}>
                        <ArrowRight size={22} />
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-8 px-10 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  selectedId ? "bg-[#8AC53E]" : "bg-slate-300"
                )} />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#014A6E]">
                  {selectedId ? "Record Isolated for Ammendment" : "Awaiting Record Selection"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedId(null)}
                  className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all"
                >
                  Clear Selection
                </button>
                <button
                  disabled={!selectedId}
                  onClick={() => {
                    const emp = pendingEmployees.find(e => e.id === selectedId);
                    if (emp) handleRetrieveRequest(emp);
                  }}
                  className={cn(
                    "px-10 py-4 rounded-2xl flex items-center gap-3 transition-all duration-500",
                    selectedId
                      ? "bg-[#8AC53E] text-white shadow-xl shadow-lime-200 hover:scale-105 active:scale-95"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-black uppercase tracking-widest">Amend Selected Record</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
