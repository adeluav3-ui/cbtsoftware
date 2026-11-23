import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useListSchools, useUpdateSchoolName } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Badge, PasswordInput } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListSchoolsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Building, Edit2, Plus, Trash2, Eye, Users, GraduationCap, BookOpen, Shield, Key, AlertTriangle, X, ShieldOff, ShieldCheck, Download, FileText } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback";

const API = import.meta.env.VITE_API_URL as string;

interface DeviceInfo {
  deviceId: string;
  firstSeen: string;
  lastSeen: string;
  ipAddress: string;
  userAgent: string;
  userId: number | null;
  username: string | null;
  fullName: string | null;
  role: string | null;
  schoolCode: string | null;
}

interface SchoolOverview {
  teachers: number;
  students: number;
  exams: number;
  admin: { username: string; fullName: string | null } | null;
}

interface School {
  id: number;
  code: string;
  name: string | null;
  createdAt: string | null;
  isDisabled?: boolean;
  licenseValidUntil?: string | null;
  maxDevices?: number | null;
  pureCbtMode?: boolean;
}

interface QaExam {
  id: number;
  title: string;
  subject: string;
  class: string;
  durationMinutes: number;
  isActive: boolean;
  assessmentType: string | null;
  term: string | null;
  createdAt: string | null;
  questionCount: number;
}

interface QaQuestion {
  id: number;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string;
  questionType: string | null;
  correctAnswerText: string | null;
  imageUrl: string | null;
  groupOrder: number | null;
  questionGroupId: number | null;
}

interface QaGroupedItem {
  isGroup: boolean;
  question?: QaQuestion;
  groupId?: number;
  groupTitle?: string | null;
  groupText?: string | null;
  questions?: QaQuestion[];
}

export default function SuperAdminDashboard() {
  const { data: schools = [], isLoading } = useListSchools();
  const queryClient = useQueryClient();

  // Edit name modal
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [nameInput, setNameInput] = useState("");

  // Add school modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newMaxDevices, setNewMaxDevices] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // School detail modal
  const [detailSchool, setDetailSchool] = useState<School | null>(null);
  const [overviewCache, setOverviewCache] = useState<Record<string, SchoolOverview>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Reset admin password (inside detail modal)
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Delete confirmation modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Disable/enable school
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  // Extend license
  const [licenseDate, setLicenseDate] = useState("");
  const [isExtendingLicense, setIsExtendingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState("");
  const [licenseSuccess, setLicenseSuccess] = useState("");

  // Max devices
  const [maxDevicesInput, setMaxDevicesInput] = useState("");
  const [isUpdatingMaxDevices, setIsUpdatingMaxDevices] = useState(false);
  const [maxDevicesError, setMaxDevicesError] = useState("");
  const [maxDevicesSuccess, setMaxDevicesSuccess] = useState("");

  // Pure CBT mode
  const [pureCbtMode, setPureCbtMode] = useState(false);
  const [isTogglingPureCbt, setIsTogglingPureCbt] = useState(false);
  const [pureCbtSuccess, setPureCbtSuccess] = useState("");

  // Generate offline license (inside school detail modal — for existing cloud schools)
  const [genLicenseDays, setGenLicenseDays] = useState("365");
  const [genLicenseMaxDevices, setGenLicenseMaxDevices] = useState("");
  const [isGeneratingLicense, setIsGeneratingLicense] = useState(false);
  const [genLicenseError, setGenLicenseError] = useState("");

  // Standalone offline license modal — no cloud school record required
  const [isOfflineLicenseOpen, setIsOfflineLicenseOpen] = useState(false);
  const [olCode, setOlCode] = useState("");
  const [olDays, setOlDays] = useState("365");
  const [olMaxDevices, setOlMaxDevices] = useState("");
  const [olError, setOlError] = useState("");
  const [isOlGenerating, setIsOlGenerating] = useState(false);

  // Q&A tab (NEW-1004)
  const [activeTab, setActiveTab] = useState<"schools" | "qa">("schools");
  const [qaExams, setQaExams] = useState<QaExam[]>([]);
  const [qaExamsLoading, setQaExamsLoading] = useState(false);
  const [qaExamsError, setQaExamsError] = useState("");
  const [qaSelectedExam, setQaSelectedExam] = useState<QaExam | null>(null);
  const [qaQuestions, setQaQuestions] = useState<QaGroupedItem[]>([]);
  const [qaQuestionsLoading, setQaQuestionsLoading] = useState(false);

  const handleUpdateMaxDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailSchool) return;
    setIsUpdatingMaxDevices(true);
    setMaxDevicesError(""); setMaxDevicesSuccess("");
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}/max-devices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ maxDevices: maxDevicesInput === "" ? null : Number(maxDevicesInput) }),
      });
      const data = await res.json();
      if (!res.ok) { setMaxDevicesError(data.error || "Failed to update"); }
      else {
        setMaxDevicesSuccess(`Device limit updated to ${data.maxDevices ?? "unlimited"}.`);
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      }
    } catch { setMaxDevicesError("Network error"); }
    finally { setIsUpdatingMaxDevices(false); }
  };

  const handleTogglePureCbt = async (enabled: boolean) => {
    if (!detailSchool) return;
    setIsTogglingPureCbt(true);
    setPureCbtSuccess("");
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}/pure-cbt-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pureCbtMode: enabled }),
      });
      if (res.ok) {
        setPureCbtMode(enabled);
        setPureCbtSuccess(enabled ? "Pure CBT mode enabled." : "Pure CBT mode disabled.");
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      }
    } catch {}
    finally { setIsTogglingPureCbt(false); }
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailSchool) return;
    setIsGeneratingLicense(true);
    setGenLicenseError("");
    try {
      const res = await fetch(`${API}/schools/generate-offline-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          schoolCode: detailSchool.code,
          maxDevices: genLicenseMaxDevices === "" ? null : Number(genLicenseMaxDevices),
          validDays: Number(genLicenseDays),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGenLicenseError(data.error || "Failed to generate license");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cbt-license-${detailSchool.code}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setGenLicenseError("Network error");
    } finally {
      setIsGeneratingLicense(false);
    }
  };

  // Standalone offline license generator — no cloud school record required
  const handleGenerateOfflineLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOlGenerating(true);
    setOlError("");
    try {
      const res = await fetch(`${API}/schools/generate-offline-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          schoolCode: olCode.trim().toUpperCase(),
          maxDevices: olMaxDevices === "" ? null : Number(olMaxDevices),
          validDays: Number(olDays),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOlError(data.error || "Failed to generate license");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cbt-license-${olCode.trim().toUpperCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      // Reset form after successful download
      setOlCode(""); setOlDays("365"); setOlMaxDevices("");
      setIsOfflineLicenseOpen(false);
    } catch {
      setOlError("Network error");
    } finally {
      setIsOlGenerating(false);
    }
  };

  const handleExtendLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailSchool || !licenseDate) return;
    setIsExtendingLicense(true);
    setLicenseError(""); setLicenseSuccess("");
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}/license`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ licenseValidUntil: new Date(licenseDate).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) { setLicenseError(data.error || "Failed to update license"); }
      else {
        setLicenseSuccess(`License updated to ${format(new Date(data.licenseValidUntil), "MMM d, yyyy")}.`);
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      }
    } catch { setLicenseError("Network error"); }
    finally { setIsExtendingLicense(false); }
  };

  // Change password modal
  const [isChangePwOpen, setIsChangePwOpen] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError(""); setCpSuccess("");
    if (cpNew.length < 8) { setCpError("New password must be at least 8 characters"); return; }
    setCpLoading(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) { setCpError(data.error || "Failed to change password"); }
      else { setCpSuccess("Password changed successfully."); setCpCurrent(""); setCpNew(""); }
    } catch { setCpError("Network error"); }
    finally { setCpLoading(false); }
  };

  // Connected devices
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceStats, setDeviceStats] = useState({ totalEverSeen: 0, activeNow: 0 });
  useEffect(() => {
    const fetchDevices = () =>
      fetch(`${API}/devices`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : { devices: [], totalEverSeen: 0, activeNow: 0 })
        .then((data) => {
          setDevices(data.devices ?? []);
          setDeviceStats({ totalEverSeen: data.totalEverSeen ?? 0, activeNow: data.activeNow ?? 0 });
        })
        .catch(() => null);
    fetchDevices();
    const id = setInterval(fetchDevices, 30_000);
    return () => clearInterval(id);
  }, []);

  const { mutate: updateName, isPending } = useUpdateSchoolName({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setIsAssignOpen(false);
      }
    }
  });

  const openAssignModal = (code: string, currentName: string) => {
    setSelectedCode(code);
    setNameInput(currentName || "");
    setIsAssignOpen(true);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    updateName({ code: selectedCode, name: nameInput });
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setIsAdding(true);
    try {
      const res = await fetch(`${API}/schools/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: newCode,
          name: newName,
          adminUsername: newAdminUsername,
          adminPassword: newAdminPassword,
          maxDevices: newMaxDevices ? Number(newMaxDevices) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to create school");
      } else {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setIsAddOpen(false);
        setNewCode(""); setNewName(""); setNewAdminUsername(""); setNewAdminPassword(""); setNewMaxDevices("");
      }
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const openDetail = async (school: School) => {
    setDetailSchool(school);
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
    setLicenseDate("");
    setLicenseError("");
    setLicenseSuccess("");
    setMaxDevicesInput(school.maxDevices != null ? String(school.maxDevices) : "");
    setMaxDevicesError("");
    setMaxDevicesSuccess("");
    setPureCbtMode(school.pureCbtMode ?? false);
    setPureCbtSuccess("");
    setGenLicenseDays("365");
    setGenLicenseMaxDevices(school.maxDevices != null ? String(school.maxDevices) : "");
    setGenLicenseError("");
    if (!overviewCache[school.code]) {
      setOverviewLoading(true);
      try {
        const res = await fetch(`${API}/schools/${school.code}/overview`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setOverviewCache(prev => ({ ...prev, [school.code]: data }));
        }
      } catch {}
      setOverviewLoading(false);
    }
  };

  const handleResetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailSchool) return;
    setIsResetting(true);
    setResetError("");
    setResetSuccess("");
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}/reset-admin-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Failed to reset password");
      } else {
        setResetSuccess("Admin password updated successfully");
        setResetPassword("");
      }
    } catch {
      setResetError("Network error. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const openDeleteConfirm = () => {
    setIsDeleteOpen(true);
  };

  const handleDeleteSchool = async () => {
    if (!detailSchool) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setIsDeleteOpen(false);
        setDetailSchool(null);
        setOverviewCache(prev => {
          const next = { ...prev };
          delete next[detailSchool.code];
          return next;
        });
      }
    } catch {
      // errors surface via the ConfirmDialog's loading state
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleDisabled = async (school: School) => {
    const newDisabled = !school.isDisabled;
    setTogglingCode(school.code);
    try {
      const res = await fetch(`${API}/schools/${school.code}/set-disabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disabled: newDisabled }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      }
    } catch {}
    setTogglingCode(null);
  };

  const overview = detailSchool ? overviewCache[detailSchool.code] : null;

  const fetchQaExams = async () => {
    setQaExamsLoading(true);
    setQaExamsError("");
    try {
      const res = await fetch(`${API}/schools/NEW-1004/exams`, { credentials: "include" });
      if (res.ok) {
        setQaExams(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setQaExamsError(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }
    } catch (e: any) {
      setQaExamsError(`Network error: ${e?.message ?? "unknown"}`);
    }
    setQaExamsLoading(false);
  };

  const fetchQaQuestions = async (exam: QaExam) => {
    setQaSelectedExam(exam);
    setQaQuestionsLoading(true);
    setQaQuestions([]);
    try {
      const res = await fetch(`${API}/schools/NEW-1004/exams/${exam.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQaQuestions(data.questions ?? []);
      }
    } catch {}
    setQaQuestionsLoading(false);
  };

  const renderQaQuestion = (q: QaQuestion, num: number) => {
    const isSubjective = q.questionType === "subjective";
    let acceptedAnswers: string[] = [];
    if (isSubjective && q.correctAnswerText) {
      try { acceptedAnswers = JSON.parse(q.correctAnswerText); } catch {}
    }
    const opts = [
      { k: "A", t: q.optionA }, { k: "B", t: q.optionB },
      { k: "C", t: q.optionC }, { k: "D", t: q.optionD },
    ].filter(o => o.t);

    return (
      <div key={q.id} className="p-4 bg-card rounded-xl border border-border">
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{num}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-relaxed">{q.text}</p>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg object-contain" />
            )}
            {isSubjective ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accepted Answers</p>
                {acceptedAnswers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {acceptedAnswers.map((ans, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium border border-secondary/20">{ans}</span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No accepted answers configured.</span>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                {opts.map(o => (
                  <div
                    key={o.k}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${o.k === q.correctOption ? "bg-secondary/10 border border-secondary/40 font-semibold text-secondary" : "bg-muted/30 border border-transparent text-muted-foreground"}`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${o.k === q.correctOption ? "bg-secondary text-white" : "bg-muted text-muted-foreground"}`}>{o.k}</span>
                    <span className="flex-1">{o.t}</span>
                    {o.k === q.correctOption && <span className="text-xs text-secondary ml-auto">✓ correct</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout allowedRoles={["super_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Registered Schools</h1>
          <p className="text-muted-foreground mt-1">Manage schools, admins, and platform access.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setCpError(""); setCpSuccess(""); setCpCurrent(""); setCpNew(""); setIsChangePwOpen(true); }}>
            <Key className="w-4 h-4 mr-2" /> Change Password
          </Button>
          <Button variant="outline" onClick={() => { setOlCode(""); setOlDays("365"); setOlMaxDevices(""); setOlError(""); setIsOfflineLicenseOpen(true); }}>
            <Download className="w-4 h-4 mr-2" /> New Offline License
          </Button>
          <Button onClick={() => { setAddError(""); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Cloud School
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("schools")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "schools" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Building className="w-4 h-4" /> Schools
        </button>
        <button
          onClick={() => { setActiveTab("qa"); if (qaExams.length === 0 && !qaExamsError) fetchQaExams(); }}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "qa" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FileText className="w-4 h-4" /> NEW-1004 Q&A
        </button>
      </div>

      {activeTab === "schools" && (
      <>
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading schools...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">School Code</th>
                  <th className="px-6 py-4 font-semibold">School Name</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">License</th>
                  <th className="px-6 py-4 font-semibold">Created</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(schools as School[]).map(school => (
                  <tr key={school.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-primary">{school.code}</td>
                    <td className="px-6 py-4 font-semibold">
                      {school.name ? school.name : <Badge variant="warning">Not Assigned</Badge>}
                    </td>
                    <td className="px-6 py-4">
                      {school.isDisabled
                        ? <Badge variant="destructive">Suspended</Badge>
                        : <Badge variant="success">Active</Badge>}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {school.licenseValidUntil ? (() => {
                        const d = new Date(school.licenseValidUntil!);
                        const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
                        return daysLeft <= 0
                          ? <Badge variant="destructive">Expired</Badge>
                          : daysLeft <= 14
                            ? <Badge variant="warning">{format(d, "MMM d, yyyy")}</Badge>
                            : <span className="text-muted-foreground">{format(d, "MMM d, yyyy")}</span>;
                      })() : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {school.createdAt ? format(new Date(school.createdAt), "MMM d, yyyy") : "-"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(school)}>
                        <Eye className="w-4 h-4 mr-2" /> Details
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openAssignModal(school.code, school.name || "")}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {school.name ? "Edit Name" : "Assign Name"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={togglingCode === school.code}
                        className={school.isDisabled ? "border-secondary/40 text-secondary hover:bg-secondary hover:text-secondary-foreground" : "border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"}
                        onClick={() => handleToggleDisabled(school)}
                      >
                        {school.isDisabled
                          ? <><ShieldCheck className="w-4 h-4 mr-2" /> Enable</>
                          : <><ShieldOff className="w-4 h-4 mr-2" /> Disable</>}
                      </Button>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Building className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      No schools found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Connected Devices */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Users className="w-5 h-5" /> Connected Devices
          </h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span><span className="font-semibold text-foreground">{deviceStats.activeNow}</span> active now</span>
            <span><span className="font-semibold text-foreground">{deviceStats.totalEverSeen}</span> ever seen</span>
            <span className="text-xs">(active = last 30 min)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Devices from offline (local) servers appear here after a results sync, showing their last sync time.
        </p>
        {devices.length === 0 ? (
          <Card className="py-10 text-center text-muted-foreground text-sm">
            No devices seen recently. Devices appear here once they load the app.
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">School</th>
                    <th className="px-4 py-3 font-semibold">IP</th>
                    <th className="px-4 py-3 font-semibold">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const secAgo = (Date.now() - new Date(d.lastSeen).getTime()) / 1000;
                    const status = secAgo < 90 ? "active" : secAgo < 300 ? "idle" : "offline";
                    const statusColor = status === "active" ? "bg-secondary" : status === "idle" ? "bg-warning" : "bg-muted-foreground/40";
                    return (
                      <tr key={d.deviceId} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span className="capitalize text-xs text-muted-foreground">{status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{d.fullName ?? d.username ?? <span className="text-muted-foreground italic">not logged in</span>}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{d.role ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.schoolCode ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.ipAddress || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {secAgo < 60 ? `${Math.round(secAgo)}s ago` : `${Math.round(secAgo / 60)}m ago`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      </>
      )}

      {activeTab === "qa" && (
        <div className="flex gap-6 items-start">
          {/* Exam list sidebar */}
          <div className="w-72 shrink-0">
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-sm">Exams & Tests</h2>
                <p className="text-xs text-muted-foreground font-mono">NEW-1004</p>
              </div>
              {qaExamsLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading exams…</div>
              ) : qaExamsError ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs text-destructive font-medium">{qaExamsError}</p>
                  <button onClick={fetchQaExams} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/80 font-medium transition-colors">Retry</button>
                </div>
              ) : qaExams.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No exams found for NEW-1004.
                </div>
              ) : (
                <div className="max-h-[72vh] overflow-y-auto divide-y divide-border/50">
                  {qaExams.map(exam => (
                    <button
                      key={exam.id}
                      onClick={() => fetchQaQuestions(exam)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${qaSelectedExam?.id === exam.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <p className="font-medium text-sm leading-tight">{exam.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{exam.class} · {exam.subject}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={exam.isActive ? "success" : "default"}>{exam.isActive ? "Active" : "Inactive"}</Badge>
                        <span className="text-xs text-muted-foreground">{exam.questionCount}q</span>
                        {exam.assessmentType && <span className="text-xs text-muted-foreground capitalize">{exam.assessmentType}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Questions panel */}
          <div className="flex-1 min-w-0">
            {!qaSelectedExam ? (
              <Card className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Select an exam from the list to view its questions and answers.</p>
              </Card>
            ) : qaQuestionsLoading ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">Loading questions…</Card>
            ) : (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-bold">{qaSelectedExam.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {qaSelectedExam.class} · {qaSelectedExam.subject}
                    {qaSelectedExam.term && ` · ${qaSelectedExam.term}`}
                    {qaSelectedExam.assessmentType && ` · ${qaSelectedExam.assessmentType}`}
                  </p>
                </div>
                <div className="space-y-3">
                  {(() => {
                    let n = 0;
                    return qaQuestions.map((item, idx) => {
                      if (!item.isGroup) {
                        n++;
                        return renderQaQuestion(item.question!, n);
                      }
                      const groupContent = (
                        <Card key={`g${item.groupId ?? idx}`} className="p-0 overflow-hidden">
                          {(item.groupTitle || item.groupText) && (
                            <div className="px-5 py-3 bg-muted/30 border-b border-border">
                              {item.groupTitle && <p className="font-semibold text-sm">{item.groupTitle}</p>}
                              {item.groupText && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.groupText}</p>}
                            </div>
                          )}
                          <div className="p-3 space-y-3">
                            {item.questions!.map(q => { n++; return renderQaQuestion(q, n); })}
                          </div>
                        </Card>
                      );
                      return groupContent;
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit School Name Modal */}
      <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title="Edit School Name">
        <form onSubmit={handleAssign} className="space-y-5">
          <div>
            <Label>School Code</Label>
            <Input value={selectedCode} disabled className="bg-muted/50 font-mono text-muted-foreground" />
          </div>
          <div>
            <Label>School Name</Label>
            <Input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Enter school name"
              required
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setIsAssignOpen(false)} type="button" className="mr-3">Cancel</Button>
            <Button type="submit" isLoading={isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* New Offline License Modal */}
      <Modal isOpen={isOfflineLicenseOpen} onClose={() => setIsOfflineLicenseOpen(false)} title="Generate Offline License">
        <form onSubmit={handleGenerateOfflineLicense} className="space-y-5">
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">For offline (desktop) installations only</p>
            <p>The school fills in their own name and admin credentials when they first open the app. You only need to assign them a code and set the license terms.</p>
          </div>
          {olError && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20">
              {olError}
            </div>
          )}
          <div>
            <Label>School Code <span className="text-muted-foreground font-normal">(you assign this — share it with the school)</span></Label>
            <Input
              value={olCode}
              onChange={e => setOlCode(e.target.value.toUpperCase())}
              placeholder="e.g. ACME2025"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Validity (days)</Label>
              <Input
                type="number"
                min="1"
                max="1825"
                value={olDays}
                onChange={e => { setOlDays(e.target.value); setOlError(""); }}
                placeholder="e.g. 365"
                required
              />
            </div>
            <div>
              <Label>Max Devices <span className="text-muted-foreground font-normal">(blank = unlimited)</span></Label>
              <Input
                type="number"
                min="1"
                value={olMaxDevices}
                onChange={e => { setOlMaxDevices(e.target.value); setOlError(""); }}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            After downloading, send the <code className="font-mono bg-muted px-1 rounded">cbt-license-{olCode || "SCHOOLCODE"}.json</code> file to the school via WhatsApp or email. They upload it when setting up the app.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsOfflineLicenseOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isOlGenerating}>
              <Download className="w-4 h-4 mr-2" /> Generate &amp; Download License
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Cloud School Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Cloud School">
        <form onSubmit={handleAddSchool} className="space-y-5">
          <div className="p-4 bg-muted/40 rounded-xl border border-border text-sm text-muted-foreground space-y-1">
            <p>Creates a cloud account for the school. If an offline license was already generated for this school code, entering the same code here will upgrade it to a <span className="font-semibold text-foreground">hybrid school</span> — accessible on both cloud and offline.</p>
          </div>
          {addError && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20">
              {addError}
            </div>
          )}
          <div>
            <Label>School Code</Label>
            <Input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="e.g. ACME2025 (unique identifier)"
              required
            />
          </div>
          <div>
            <Label>School Name</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Enter school name"
              required
            />
          </div>
          <div>
            <Label>Max Devices <span className="text-muted-foreground font-normal">(optional — leave blank for unlimited)</span></Label>
            <Input
              type="number"
              min="1"
              value={newMaxDevices}
              onChange={e => setNewMaxDevices(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-4 font-medium">School Admin Account</p>
            <div className="space-y-4">
              <div>
                <Label>Admin Username</Label>
                <Input
                  value={newAdminUsername}
                  onChange={e => setNewAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  required
                />
              </div>
              <div>
                <Label>Admin Password</Label>
                <PasswordInput
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} type="button" className="mr-3">Cancel</Button>
            <Button type="submit" isLoading={isAdding}>Create School</Button>
          </div>
        </form>
      </Modal>

      {/* School Detail Modal — hidden when delete confirmation is open to avoid z-index overlap */}
      <Modal isOpen={!!detailSchool && !isDeleteOpen} onClose={() => setDetailSchool(null)} title={`${detailSchool?.name || detailSchool?.code || "School"} Details`}>
        {detailSchool && (
          <div className="space-y-6">
            {/* Identity */}
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
              <Building className="w-8 h-8 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-lg leading-tight">{detailSchool.name || <span className="text-muted-foreground italic">Name not set</span>}</p>
                <p className="font-mono text-sm text-muted-foreground">{detailSchool.code}</p>
              </div>
            </div>

            {/* Stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Stats</p>
              {overviewLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading stats...</div>
              ) : overview ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
                    <Users className="w-5 h-5 text-primary mb-2" />
                    <span className="text-2xl font-bold">{overview.teachers}</span>
                    <span className="text-xs text-muted-foreground mt-1">Teachers</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
                    <GraduationCap className="w-5 h-5 text-secondary mb-2" />
                    <span className="text-2xl font-bold">{overview.students}</span>
                    <span className="text-xs text-muted-foreground mt-1">Students</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
                    <BookOpen className="w-5 h-5 text-accent mb-2" />
                    <span className="text-2xl font-bold">{overview.exams}</span>
                    <span className="text-xs text-muted-foreground mt-1">Exams</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">Could not load stats.</div>
              )}
            </div>

            {/* Admin account */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Admin Account</p>
              <div className="p-4 bg-muted/30 rounded-xl border border-border mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{overview?.admin?.username ?? "—"}</span>
                </div>
                {overview?.admin?.fullName && (
                  <p className="text-xs text-muted-foreground pl-6">{overview.admin.fullName}</p>
                )}
              </div>
              <form onSubmit={handleResetAdminPassword} className="space-y-3">
                <Label>Reset Admin Password</Label>
                <div className="flex gap-2">
                  <PasswordInput
                    value={resetPassword}
                    onChange={e => { setResetPassword(e.target.value); setResetError(""); setResetSuccess(""); }}
                    placeholder="New password (min 6 chars)"
                    className="flex-1"
                  />
                  <Button type="submit" variant="outline" size="sm" isLoading={isResetting}>
                    <Key className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </div>
                {resetError && <p className="text-sm text-destructive font-medium">{resetError}</p>}
                {resetSuccess && <p className="text-sm text-secondary font-medium">{resetSuccess}</p>}
              </form>
            </div>

            {/* License */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">License</p>
              {detailSchool.licenseValidUntil ? (
                <p className="text-sm text-muted-foreground mb-3">
                  Currently valid until{" "}
                  <span className="font-semibold text-foreground">
                    {format(new Date(detailSchool.licenseValidUntil), "MMMM d, yyyy")}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">No license date set.</p>
              )}
              <form onSubmit={handleExtendLicense} className="space-y-3">
                <Label>Set new expiry date</Label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={licenseDate}
                    onChange={e => { setLicenseDate(e.target.value); setLicenseError(""); setLicenseSuccess(""); }}
                    className="flex-1 border border-input rounded-xl px-3 py-2 text-sm bg-background"
                    min={new Date().toISOString().slice(0, 10)}
                  />
                  <Button type="submit" variant="outline" size="sm" isLoading={isExtendingLicense} disabled={!licenseDate}>
                    Save
                  </Button>
                </div>
                {licenseError && <p className="text-sm text-destructive font-medium">{licenseError}</p>}
                {licenseSuccess && <p className="text-sm text-secondary font-medium">{licenseSuccess}</p>}
              </form>
              {detailSchool.licenseValidUntil && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Send this file to the school so they can update their offline server's license without re-importing data.
                  </p>
                  <button
                    onClick={async () => {
                      const res = await fetch(`${API}/schools/${detailSchool.code}/sync/license-patch`, { credentials: "include" });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `cbt-license-${detailSchool.code}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/80 font-medium transition-colors"
                  >
                    Download License Patch File
                  </button>
                </div>
              )}
            </div>

            {/* Max Devices */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Device Limit (Offline Mode)</p>
              <p className="text-sm text-muted-foreground mb-3">
                {detailSchool.maxDevices != null
                  ? <>Limit: <span className="font-semibold text-foreground">{detailSchool.maxDevices} devices</span></>
                  : "No device limit set (unlimited)."}
              </p>
              <form onSubmit={handleUpdateMaxDevices} className="space-y-3">
                <Label>Set device limit</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={maxDevicesInput}
                    onChange={e => { setMaxDevicesInput(e.target.value); setMaxDevicesError(""); setMaxDevicesSuccess(""); }}
                    placeholder="e.g. 30 (blank = unlimited)"
                    className="flex-1"
                  />
                  <Button type="submit" variant="outline" size="sm" isLoading={isUpdatingMaxDevices}>
                    Save
                  </Button>
                </div>
                {maxDevicesError && <p className="text-sm text-destructive font-medium">{maxDevicesError}</p>}
                {maxDevicesSuccess && <p className="text-sm text-secondary font-medium">{maxDevicesSuccess}</p>}
              </form>
            </div>

            {/* Pure CBT Mode */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Exam Mode</p>
              <div className="flex items-start justify-between gap-4 p-4 bg-muted/20 rounded-xl border border-border">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Pure CBT Mode</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, exam scores out of the full total (60 marks), mid-term out of 20 marks — no theory input needed. Class activities remain manually entered.
                  </p>
                  {pureCbtSuccess && <p className="text-xs text-secondary font-medium mt-1">{pureCbtSuccess}</p>}
                </div>
                <button
                  onClick={() => handleTogglePureCbt(!pureCbtMode)}
                  disabled={isTogglingPureCbt}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 mt-0.5 ${pureCbtMode ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${pureCbtMode ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {/* Generate Offline License */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Generate Offline License</p>
              <p className="text-xs text-muted-foreground mb-3">
                Create a signed license file to send to the school for their offline (desktop) installation. The school uploads this file when setting up the app for the first time.
              </p>
              <form onSubmit={handleGenerateLicense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Validity (days)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="1825"
                      value={genLicenseDays}
                      onChange={e => { setGenLicenseDays(e.target.value); setGenLicenseError(""); }}
                      placeholder="e.g. 365"
                      required
                    />
                  </div>
                  <div>
                    <Label>Max Devices <span className="text-muted-foreground font-normal">(blank = unlimited)</span></Label>
                    <Input
                      type="number"
                      min="1"
                      value={genLicenseMaxDevices}
                      onChange={e => { setGenLicenseMaxDevices(e.target.value); setGenLicenseError(""); }}
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>
                {genLicenseError && <p className="text-sm text-destructive font-medium">{genLicenseError}</p>}
                <Button type="submit" variant="outline" size="sm" isLoading={isGeneratingLicense}>
                  <Download className="w-4 h-4 mr-2" /> Generate &amp; Download License
                </Button>
              </form>
            </div>

            {/* Danger zone */}
            <div className="border-t border-destructive/20 pt-4">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3">Danger Zone</p>
              <div className="flex items-start gap-3 p-4 bg-destructive/5 rounded-xl border border-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">Delete this school</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently removes all teachers, students, exams, results, and scores. This cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                    onClick={openDeleteConfirm}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete School
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDetailSchool(null)}>
                <X className="w-4 h-4 mr-2" /> Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        variant="type-to-confirm"
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteSchool}
        title="Confirm School Deletion"
        description={`All data for "${detailSchool?.name || detailSchool?.code}" will be permanently deleted: teachers, students, all exams, all results, and all scores. This action is permanent and irreversible.`}
        confirmText={detailSchool?.code ?? ""}
        confirmLabel="Delete Forever"
        isLoading={isDeleting}
      />

      {/* Change Password modal */}
      <Modal isOpen={isChangePwOpen} onClose={() => setIsChangePwOpen(false)} title="Change Super Admin Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label htmlFor="cp-current">Current Password</Label>
            <PasswordInput id="cp-current" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="cp-new">New Password <span className="text-muted-foreground text-xs">(min 8 characters)</span></Label>
            <PasswordInput id="cp-new" value={cpNew} onChange={e => setCpNew(e.target.value)} required autoComplete="new-password" />
          </div>
          {cpError && <p className="text-sm text-destructive">{cpError}</p>}
          {cpSuccess && <p className="text-sm text-secondary font-semibold">{cpSuccess}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsChangePwOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={cpLoading}>{cpLoading ? "Saving…" : "Change Password"}</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
