import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useListSchools, useUpdateSchoolName } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Badge, PasswordInput } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListSchoolsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Building, Edit2, Plus, Trash2, Eye, Users, GraduationCap, BookOpen, Shield, Key, AlertTriangle, X, ShieldOff, ShieldCheck } from "lucide-react";

const API = import.meta.env.VITE_API_URL as string;

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
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Disable/enable school
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to create school");
      } else {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setIsAddOpen(false);
        setNewCode(""); setNewName(""); setNewAdminUsername(""); setNewAdminPassword("");
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
    setDeleteInput("");
    setDeleteError("");
    setIsDeleteOpen(true);
  };

  const handleDeleteSchool = async () => {
    if (!detailSchool) return;
    if (deleteInput !== detailSchool.code) {
      setDeleteError("School code does not match");
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API}/schools/${detailSchool.code}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete school");
      } else {
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
      setDeleteError("Network error. Please try again.");
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

  return (
    <DashboardLayout allowedRoles={["super_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Registered Schools</h1>
          <p className="text-muted-foreground mt-1">Manage schools, admins, and platform access.</p>
        </div>
        <Button onClick={() => { setAddError(""); setIsAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add New School
        </Button>
      </div>

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
                        className={school.isDisabled ? "border-green-500/40 text-green-600 hover:bg-green-500 hover:text-white" : "border-destructive/40 text-destructive hover:bg-destructive hover:text-white"}
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
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
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

      {/* Add New School Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New School">
        <form onSubmit={handleAddSchool} className="space-y-5">
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
                    <Users className="w-5 h-5 text-blue-500 mb-2" />
                    <span className="text-2xl font-bold">{overview.teachers}</span>
                    <span className="text-xs text-muted-foreground mt-1">Teachers</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
                    <GraduationCap className="w-5 h-5 text-green-500 mb-2" />
                    <span className="text-2xl font-bold">{overview.students}</span>
                    <span className="text-xs text-muted-foreground mt-1">Students</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
                    <BookOpen className="w-5 h-5 text-purple-500 mb-2" />
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
                {resetSuccess && <p className="text-sm text-green-600 font-medium">{resetSuccess}</p>}
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

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm School Deletion">
        <div className="space-y-5">
          <div className="flex gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive text-sm">This action is permanent and irreversible.</p>
              <p className="text-sm text-muted-foreground mt-1">
                All data for <span className="font-semibold">{detailSchool?.name || detailSchool?.code}</span> will be permanently deleted:
                teachers, students, all exams, all results, and all scores.
              </p>
            </div>
          </div>
          <div>
            <Label>Type the school code <span className="font-mono font-bold">{detailSchool?.code}</span> to confirm</Label>
            <Input
              value={deleteInput}
              onChange={e => { setDeleteInput(e.target.value); setDeleteError(""); }}
              placeholder={detailSchool?.code}
              className="font-mono mt-2"
            />
          </div>
          {deleteError && (
            <p className="text-sm text-destructive font-medium">{deleteError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} type="button">Cancel</Button>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white"
              onClick={handleDeleteSchool}
              isLoading={isDeleting}
              disabled={deleteInput !== detailSchool?.code}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Forever
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
