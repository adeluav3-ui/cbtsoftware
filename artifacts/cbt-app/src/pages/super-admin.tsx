import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useListSchools, useUpdateSchoolName } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListSchoolsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Building, Edit2, Plus } from "lucide-react";

export default function SuperAdminDashboard() {
  const { data: schools = [], isLoading } = useListSchools();
  const queryClient = useQueryClient();

  // Assign name modal
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [nameInput, setNameInput] = useState("");

  // Add new school modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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
    updateName({ data: { code: selectedCode, name: nameInput } });
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setIsAdding(true);
    try {
      const res = await fetch("/api/schools/create", {
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

  return (
    <DashboardLayout allowedRoles={["super_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Registered Schools</h1>
          <p className="text-muted-foreground mt-1">Manage schools and their admin accounts.</p>
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
                  <th className="px-6 py-4 font-semibold">Created At</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map(school => (
                  <tr key={school.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-primary">
                      {school.code}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {school.name ? school.name : <Badge variant="warning">Not Assigned</Badge>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {school.createdAt ? format(new Date(school.createdAt), "MMM d, yyyy") : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => openAssignModal(school.code, school.name || "")}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {school.name ? "Edit Name" : "Assign Name"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
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

      {/* Assign / Edit School Name Modal */}
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
              placeholder="Enter unique school code"
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
                <Input
                  type="password"
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
    </DashboardLayout>
  );
}
