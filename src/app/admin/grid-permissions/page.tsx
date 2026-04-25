"use client";

import React, { useState, useEffect } from "react";
import { Shell } from "@/components/Shell";
import { ShieldCheck, ToggleLeft, ToggleRight, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export default function GridPermissionsPage() {
    const [editEnabled, setEditEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "registrationGrid"), (docSnap) => {
            if (docSnap.exists()) {
                setEditEnabled(docSnap.data().editEnabled || false);
            }
            setIsLoading(false);
        });
        return unsub;
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "settings", "registrationGrid"), { editEnabled }, { merge: true });
            alert("✅ Grid permissions updated successfully.");
        } catch (error) {
            console.error("Failed to update grid permissions:", error);
            alert("❌ Failed to update grid permissions.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Shell>
            <div className="max-w-[1000px] mx-auto space-y-12 pb-24">
                {/* Header */}
                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#014A6E]">
                        Admin Control Center
                    </p>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                        Registry Grid <span className="text-[#8AC53E] italic">Permissions</span>
                    </h1>
                    <p className="text-slate-500 text-lg font-medium max-w-xl">
                        Configure global access rights for the registration data grid interface.
                    </p>
                </div>

                <div className="glass-panel p-12 rounded-[48px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-[#014A6E]" size={40} />
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="flex items-start gap-6">
                                <div className="w-16 h-16 rounded-[24px] bg-[#014A6E]/5 text-[#014A6E] flex items-center justify-center border border-[#014A6E]/10 flex-shrink-0">
                                    <ShieldCheck size={32} />
                                </div>
                                <div className="space-y-2 mt-1 flex-1">
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Data Grid Edit Access</h3>
                                    <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                                        When enabled, authorized personnel can modify existing registry entries directly from the Registration Information data grid view. When disabled, the grid becomes view-only.
                                    </p>
                                </div>

                                <button
                                    onClick={() => setEditEnabled(!editEnabled)}
                                    className="flex-shrink-0 focus:outline-none"
                                >
                                    {editEnabled ? (
                                        <ToggleRight className="text-[#8AC53E] w-16 h-16 transition-all duration-300" />
                                    ) : (
                                        <ToggleLeft className="text-slate-300 w-16 h-16 transition-all duration-300" />
                                    )}
                                </button>
                            </div>

                            <div className="pt-8 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="btn-primary flex items-center gap-3 px-10 py-4 shadow-[#8AC53E]/20"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    <span>Save Configuration</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Shell>
    );
}
