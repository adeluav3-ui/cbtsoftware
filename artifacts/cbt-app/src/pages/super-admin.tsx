import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useListSchools, useUpdateSchoolName } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListSchoolsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Building, Edit2 } from "lucide-react";

export default function SuperAdminDashboard() {
  const { data: schools = [], isLoading } = useListSchools();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [nameInput, setNameInput] = useState("");

  const { mutate, isPending } = useUpdateSchoolName({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
        setIsModalOpen(false);
      }
    }
  });

  const openAssignModal = (code: string, currentName: string) => {
    setSelectedCode(code);
    setNameInput(currentName || "");
    setIsModalOpen(true);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ data: { code: selectedCode, name: nameInput } });
  };

  return (
    <DashboardLayout allowedRoles={["super_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Registered Schools</h1>
          <p className="text-muted-foreground mt-1">Manage and assign names to school codes.</p>
        </div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assign School Name">
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
              placeholder="e.g. Newbridge International School" 
              required 
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} type="button" className="mr-3">Cancel</Button>
            <Button type="submit" isLoading={isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
