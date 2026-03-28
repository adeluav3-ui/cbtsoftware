import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListTeachers, useCreateTeacher, useDeleteTeacher, useListStudents, useCreateStudent, useDeleteStudent, useListResults, useStartNewSession } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, CustomTabs, Badge, Select } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListTeachersQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { Trash2, UserPlus, RotateCw, ChevronRight, BookOpen, Plus, Upload, School } from "lucide-react";
import { TeacherDetailModal } from "@/components/teacher-detail-modal";
import { StudentDetailModal } from "@/components/student-detail-modal";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [activeTab, setActiveTab] = useState("Teachers");
  const queryClient = useQueryClient();

  const [classFilter, setClassFilter] = useState("JSS1");
  const CLASSES = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  const { data: teachers = [] } = useListTeachers(schoolCode);
  const { data: students = [] } = useListStudents(schoolCode, classFilter);
  const { data: results = [] } = useListResults(schoolCode);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [isLoadingPasscode, setIsLoadingPasscode] = useState(false);
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);
  // Detail modal state
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [tUsername, setTUsername] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [tFullName, setTFullName] = useState("");

  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sFullName, setSFullName] = useState("");
  const [sClass, setSClass] = useState("JSS1");

  const [isSessionModalOpen, setSessionModalOpen] = useState(false);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  // Subjects state
  const [subjects, setSubjects] = useState<{ id: number; name: string; level: string }[]>([]);
  const [isSubjectsLoading, setIsSubjectsLoading] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectLevel, setNewSubjectLevel] = useState<"junior" | "senior">("junior");
  const [subjectError, setSubjectError] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Bulk subject upload state
  const [bulkSubjectModalOpen, setBulkSubjectModalOpen] = useState(false);
  const [bulkSubjectsText, setBulkSubjectsText] = useState("");
  const [bulkSubjectsLevel, setBulkSubjectsLevel] = useState<"junior" | "senior">("junior");
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkSubjectError, setBulkSubjectError] = useState("");
  const [bulkSubjectSuccess, setBulkSubjectSuccess] = useState("");

  // Grading scheme state
  const [gradingScheme, setGradingScheme] = useState({
    midTermTotal: 20,
    midTermCbt: 10,
    midTermTheory: 10,
    examTotal: 60,
    examCbt: 30,
    examTheory: 30,
    classActivityTotal: 20,
    gradeAMin: 70,
    gradeBMin: 60,
    gradeCMin: 50,
    gradeDMin: 40,
    gradeFMax: 39,
  });
  const [isLoadingScheme, setIsLoadingScheme] = useState(false);
  const [isSavingScheme, setIsSavingScheme] = useState(false);
  const [schemeError, setSchemeError] = useState("");
  const [schemeSuccess, setSchemeSuccess] = useState("");

  const { mutate: createTeacher, isPending: isCTPending } = useCreateTeacher({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(schoolCode) });
        setTeacherModalOpen(false);
        setTUsername(""); setTPassword(""); setTFullName("");
      }
    }
  });

  const { mutate: deleteTeacher } = useDeleteTeacher({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(schoolCode) }) }
  });

  const { mutate: createStudent, isPending: isCSPending } = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
        setStudentModalOpen(false);
        setSUsername(""); setSPassword(""); setSFullName("");
      }
    }
  });

  const { mutate: deleteStudent } = useDeleteStudent({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) }) }
  });

  const { mutate: newSession, isPending: isNSPending } = useStartNewSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
        setSessionModalOpen(false);
      }
    }
  });

  // Fetch school info
  const fetchSchoolInfo = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}`, {
        credentials: "include",
      });
      const data = await response.json();
      setSchoolLogo(data.logoUrl);
    } catch (err) {
      console.error("Failed to fetch school info", err);
    }
  };

  // Fetch subjects
  const fetchSubjects = async () => {
    setIsSubjectsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects`, {
        credentials: "include",
      });
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    } finally {
      setIsSubjectsLoading(false);
    }
  };

  // Fetch grading scheme
  const fetchGradingScheme = async () => {
    setIsLoadingScheme(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/grading-scheme`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setGradingScheme(data);
      }
    } catch (err) {
      console.error("Failed to fetch grading scheme", err);
    } finally {
      setIsLoadingScheme(false);
    }
  };

  // Update grading scheme
  const updateGradingScheme = async () => {
    setIsSavingScheme(true);
    setSchemeError("");
    setSchemeSuccess("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/grading-scheme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gradingScheme),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setSchemeError(data.error || "Failed to update grading scheme");
        return;
      }

      setSchemeSuccess("Grading scheme updated successfully!");
      setTimeout(() => setSchemeSuccess(""), 3000);
    } catch (err) {
      setSchemeError("Network error. Please try again.");
    } finally {
      setIsSavingScheme(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      setSubjectError("Subject name is required");
      return;
    }

    setIsAddingSubject(true);
    setSubjectError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubjectName.trim(), level: newSubjectLevel }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setSubjectError(data.error || "Failed to add subject");
        return;
      }

      await fetchSubjects();
      setSubjectModalOpen(false);
      setNewSubjectName("");
      setNewSubjectLevel("junior");
      setSubjectError("");
    } catch (err) {
      setSubjectError("Network error. Please try again.");
    } finally {
      setIsAddingSubject(false);
    }
  };

  // Delete subject
  const handleDeleteSubject = async (subjectId: number) => {
    if (!confirm("Are you sure you want to delete this subject? This will affect all exams that use this subject.")) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects/${subjectId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await fetchSubjects();
      }
    } catch (err) {
      console.error("Failed to delete subject", err);
    }
  };

  // Bulk add subjects
  const handleBulkAddSubjects = async () => {
    if (!bulkSubjectsText.trim()) {
      setBulkSubjectError("Please enter at least one subject");
      return;
    }

    setIsBulkAdding(true);
    setBulkSubjectError("");
    setBulkSubjectSuccess("");

    const subjectNames = bulkSubjectsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (subjectNames.length === 0) {
      setBulkSubjectError("No valid subjects found");
      setIsBulkAdding(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const subjectName of subjectNames) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: subjectName, level: bulkSubjectsLevel }),
          credentials: "include",
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      await fetchSubjects();
      setBulkSubjectSuccess(`Added ${successCount} subjects successfully. ${failCount > 0 ? `${failCount} failed.` : ""}`);

      if (failCount === 0) {
        setTimeout(() => {
          setBulkSubjectModalOpen(false);
          setBulkSubjectsText("");
          setBulkSubjectSuccess("");
        }, 1500);
      }
    }

    if (failCount > 0 && successCount === 0) {
      setBulkSubjectError(`Failed to add ${failCount} subjects. Check for duplicates or network issues.`);
    }

    setIsBulkAdding(false);

    setTimeout(() => {
      setBulkSubjectSuccess("");
      setBulkSubjectError("");
    }, 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `school-logo-${Date.now()}.${fileExt}`;
      const filePath = `school-logos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('school-logos')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(filePath);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: publicUrl }),
        credentials: "include",
      });

      if (response.ok) {
        setSchoolLogo(publicUrl);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Fetch current retake passcode
  const fetchCurrentPasscode = async () => {
    setIsLoadingPasscode(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/retake-passcode`, {
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentPasscode(data.passcode);
      }
    } catch (err) {
      console.error("Failed to fetch passcode", err);
    } finally {
      setIsLoadingPasscode(false);
    }
  };

  // Update retake passcode
  const updatePasscode = async () => {
    if (!/^\d{4}$/.test(newPasscode)) {
      setPasscodeError("Passcode must be exactly 4 digits");
      return;
    }

    setIsUpdatingPasscode(true);
    setPasscodeError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/retake-passcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: newPasscode }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setPasscodeError(data.error || "Failed to update passcode");
        return;
      }

      setCurrentPasscode(newPasscode);
      setPasscodeModalOpen(false);
      setNewPasscode("");
    } catch (err) {
      setPasscodeError("Network error. Please try again.");
    } finally {
      setIsUpdatingPasscode(false);
    }
  };

  const openPasscodeModal = () => {
    fetchCurrentPasscode();
    setPasscodeModalOpen(true);
  };

  const openGradingModal = () => {
    fetchGradingScheme();
    setGradingModalOpen(true);
  };

  useEffect(() => {
    if (schoolCode) {
      fetchSchoolInfo();
      fetchSubjects();
      fetchGradingScheme();
    }
  }, [schoolCode]);

  return (
    <DashboardLayout allowedRoles={["school_admin"]}>
      {/* School Logo Section */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-muted/20 rounded-xl">
        <div className="relative">
          {schoolLogo ? (
            <img src={schoolLogo} alt="School Logo" className="w-16 h-16 object-contain rounded-lg" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <School className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <label className="absolute -bottom-2 -right-2 cursor-pointer bg-primary rounded-full p-1 shadow-lg hover:bg-primary/80 transition-colors">
            <Upload className="w-3 h-3 text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <p className="text-sm font-semibold">School Logo</p>
          <p className="text-xs text-muted-foreground">Upload your school's logo. It will appear on student results.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">School Administration</h1>
          <p className="text-muted-foreground mt-1">Manage personnel, students, and academic records.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={openGradingModal}>
            <RotateCw className="w-4 h-4 mr-2" />
            Grading Scheme
          </Button>
          <Button variant="outline" onClick={openPasscodeModal}>
            <RotateCw className="w-4 h-4 mr-2" />
            Retake Passcode
          </Button>
          <Button variant="outline" onClick={() => setSessionModalOpen(true)}>
            <RotateCw className="w-4 h-4 mr-2 text-primary" />
            Start New Session
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <CustomTabs tabs={["Teachers", "Students", "Results", "Subjects"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Teachers Tab - same as before */}
      {activeTab === "Teachers" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
            <div>
              <h2 className="text-lg font-bold">Teacher Directory</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Click a row to view all exams and student results</p>
            </div>
            <Button size="sm" onClick={() => setTeacherModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Teacher
            </Button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr
                  key={t.id}
                  className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => { setSelectedTeacherId(t.id); setSelectedTeacherName(t.fullName || t.username); }}
                >
                  <td className="px-6 py-4 font-semibold text-primary">{t.fullName}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{t.username}</td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); deleteTeacher({ schoolCode, teacherId: t.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No teachers found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Students Tab */}
      {activeTab === "Students" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center bg-muted/20 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-muted-foreground mr-2">Filter Class:</span>
                <CustomTabs tabs={CLASSES} activeTab={classFilter} onChange={setClassFilter} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click a student row to view their full exam history</p>
            </div>
            <Button size="sm" onClick={() => setStudentModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr
                  key={s.id}
                  className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => { setSelectedStudentId(s.id); setSelectedStudentName(s.fullName || s.username); }}
                >
                  <td className="px-6 py-4 font-semibold text-primary">{s.fullName}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{s.username}</td>
                  <td className="px-6 py-4"><Badge>{s.class}</Badge></td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); deleteStudent({ schoolCode, studentId: s.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No students in {classFilter}.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Results Tab */}
      {activeTab === "Results" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">Click any result row to view the full question & answer breakdown</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold">Exam Title</th>
                <th className="px-6 py-4 font-semibold">Score</th>
                <th className="px-6 py-4 font-semibold">Percentage</th>
                <th className="px-6 py-4 font-semibold text-center">Grade</th>
                <th className="px-6 py-4 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => {
                const pct = r.percentage ?? 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedResultId(r.id)}
                  >
                    <td className="px-6 py-4 font-semibold text-primary">{r.fullName}</td>
                    <td className="px-6 py-4"><Badge>{r.class}</Badge></td>
                    <td className="px-6 py-4 font-medium">{r.examTitle || r.subject}</td>
                    <td className="px-6 py-4 font-bold">{r.score} / {r.totalQuestions}</td>
                    <td className="px-6 py-4 font-semibold">{pct.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={pct >= 70 ? "success" : "destructive"}>
                        {pct >= 70 ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy h:mm a") : "—"}
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No results available yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Subjects Tab */}
      {activeTab === "Subjects" && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold font-display">Subject Management</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Add subjects for Junior Secondary (JSS1-3) and Senior Secondary (SSS1-3)
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setBulkSubjectModalOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Bulk Upload
              </Button>
              <Button onClick={() => setSubjectModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Subject
              </Button>
            </div>
          </div>

          {isSubjectsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold">No subjects added yet</p>
              <p className="text-sm mt-1">Click "Add Subject" to start adding subjects for your school</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Junior Secondary (JSS1-3)</h3>
                  <Badge variant="default">{subjects.filter(s => s.level === 'junior').length}</Badge>
                </div>
                <div className="space-y-2">
                  {subjects.filter(s => s.level === 'junior').map(subject => (
                    <div key={subject.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40">
                      <span className="font-medium">{subject.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Senior Secondary (SSS1-3)</h3>
                  <Badge variant="default">{subjects.filter(s => s.level === 'senior').length}</Badge>
                </div>
                <div className="space-y-2">
                  {subjects.filter(s => s.level === 'senior').map(subject => (
                    <div key={subject.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40">
                      <span className="font-medium">{subject.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Add Subject Modal */}
          <Modal isOpen={subjectModalOpen} onClose={() => setSubjectModalOpen(false)} title="Add New Subject">
            <form onSubmit={handleAddSubject} className="space-y-4">
              <div>
                <Label>Subject Name</Label>
                <Input
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  placeholder="e.g., Mathematics, English, Physics"
                  required
                />
              </div>
              <div>
                <Label>Level</Label>
                <Select value={newSubjectLevel} onChange={e => setNewSubjectLevel(e.target.value as "junior" | "senior")}>
                  <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                  <option value="senior">Senior Secondary (SSS1 - SSS3)</option>
                </Select>
              </div>
              {subjectError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                  {subjectError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setSubjectModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" isLoading={isAddingSubject} className="flex-1">
                  Add Subject
                </Button>
              </div>
            </form>
          </Modal>

          {/* Bulk Upload Modal */}
          <Modal isOpen={bulkSubjectModalOpen} onClose={() => setBulkSubjectModalOpen(false)} title="Bulk Upload Subjects" size="lg">
            <div className="space-y-4">
              <div>
                <Label>Level</Label>
                <Select value={bulkSubjectsLevel} onChange={e => setBulkSubjectsLevel(e.target.value as "junior" | "senior")}>
                  <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                  <option value="senior">Senior Secondary (SSS1 - SSS3)</option>
                </Select>
              </div>
              <div>
                <Label>Subjects (one per line)</Label>
                <textarea
                  value={bulkSubjectsText}
                  onChange={e => setBulkSubjectsText(e.target.value)}
                  placeholder="Mathematics&#10;English Language&#10;Basic Science&#10;Social Studies&#10;..."
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all min-h-50 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">Enter one subject per line. Duplicate subjects will be ignored.</p>
              </div>
              {bulkSubjectError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{bulkSubjectError}</div>
              )}
              {bulkSubjectSuccess && (
                <div className="bg-success/10 text-success p-3 rounded-lg text-sm">{bulkSubjectSuccess}</div>
              )}
              <div className="bg-muted/20 p-3 rounded-lg">
                <p className="text-sm font-semibold mb-2">Common Subjects:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {bulkSubjectsLevel === "junior" ? (
                    <>
                      <span>• Mathematics</span> <span>• English Language</span> <span>• Basic Science</span>
                      <span>• Basic Technology</span> <span>• Social Studies</span> <span>• Civic Education</span>
                      <span>• Christian Religious Studies</span> <span>• Islamic Religious Studies</span>
                      <span>• Business Studies</span> <span>• Computer Studies</span> <span>• French</span>
                      <span>• Home Economics</span> <span>• Agricultural Science</span> <span>• Cultural & Creative Arts</span>
                    </>
                  ) : (
                    <>
                      <span>• Mathematics</span> <span>• English Language</span> <span>• Physics</span>
                      <span>• Chemistry</span> <span>• Biology</span> <span>• Economics</span>
                      <span>• Government</span> <span>• Literature in English</span> <span>• Christian Religious Studies</span>
                      <span>• Islamic Religious Studies</span> <span>• Geography</span> <span>• Commerce</span>
                      <span>• Accounting</span> <span>• Further Mathematics</span> <span>• Civic Education</span>
                      <span>• Computer Science</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setBulkSubjectModalOpen(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleBulkAddSubjects} isLoading={isBulkAdding} disabled={!bulkSubjectsText.trim()} className="flex-1">
                  Upload Subjects
                </Button>
              </div>
            </div>
          </Modal>
        </Card>
      )}

      {/* Grading Scheme Modal */}
      <Modal isOpen={gradingModalOpen} onClose={() => setGradingModalOpen(false)} title="Grading Scheme Configuration" size="lg">
        <div className="space-y-6">
          {/* Grade Ranges */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-4">Grade Boundaries</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Grade A (min %)</label>
                <Input type="number" min={0} max={100} value={gradingScheme.gradeAMin}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, gradeAMin: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grade B (min %)</label>
                <Input type="number" min={0} max={100} value={gradingScheme.gradeBMin}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, gradeBMin: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grade C (min %)</label>
                <Input type="number" min={0} max={100} value={gradingScheme.gradeCMin}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, gradeCMin: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grade D (min %)</label>
                <Input type="number" min={0} max={100} value={gradingScheme.gradeDMin}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, gradeDMin: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grade F (max %)</label>
                <Input type="number" min={0} max={100} value={gradingScheme.gradeFMax}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, gradeFMax: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Mid-term Component */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-4">Mid-term Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium mb-2">Total Points</label>
                <Input type="number" value={gradingScheme.midTermTotal}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermTotal: parseInt(e.target.value) || 0 })} />
              </div>
              <div><label className="block text-sm font-medium mb-2">CBT Portion</label>
                <Input type="number" value={gradingScheme.midTermCbt}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermCbt: parseInt(e.target.value) || 0 })} />
              </div>
              <div><label className="block text-sm font-medium mb-2">Theory Portion</label>
                <Input type="number" value={gradingScheme.midTermTheory}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermTheory: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Exam Component */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-4">Final Exam</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium mb-2">Total Points</label>
                <Input type="number" value={gradingScheme.examTotal}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examTotal: parseInt(e.target.value) || 0 })} />
              </div>
              <div><label className="block text-sm font-medium mb-2">CBT Portion</label>
                <Input type="number" value={gradingScheme.examCbt}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examCbt: parseInt(e.target.value) || 0 })} />
              </div>
              <div><label className="block text-sm font-medium mb-2">Theory Portion</label>
                <Input type="number" value={gradingScheme.examTheory}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examTheory: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Class Activity */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Class Activity</h3>
            <div><label className="block text-sm font-medium mb-2">Total Points</label>
              <Input type="number" value={gradingScheme.classActivityTotal}
                onChange={(e) => setGradingScheme({ ...gradingScheme, classActivityTotal: parseInt(e.target.value) || 0 })} className="w-full max-w-md" />
            </div>
          </div>

          {schemeError && <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{schemeError}</div>}
          {schemeSuccess && <div className="bg-success/10 text-success p-3 rounded-lg text-sm">{schemeSuccess}</div>}

          <div className="flex justify-end pt-4">
            <Button onClick={updateGradingScheme} isLoading={isSavingScheme}>Save Grading Scheme</Button>
          </div>
        </div>
      </Modal>

      {/* Add Teacher Modal */}
      <Modal isOpen={isTeacherModalOpen} onClose={() => setTeacherModalOpen(false)} title="Add New Teacher">
        <form onSubmit={e => { e.preventDefault(); createTeacher({ schoolCode, data: { username: tUsername, password: tPassword, fullName: tFullName } }); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={tFullName} onChange={e => setTFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={tUsername} onChange={e => setTUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={tPassword} onChange={e => setTPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full mt-2" isLoading={isCTPending}>Create Teacher</Button>
        </form>
      </Modal>

      {/* Add Student Modal */}
      <Modal isOpen={isStudentModalOpen} onClose={() => setStudentModalOpen(false)} title="Add New Student">
        <form onSubmit={e => { e.preventDefault(); createStudent({ schoolCode, data: { username: sUsername, password: sPassword, fullName: sFullName, class: sClass } }); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={sFullName} onChange={e => setSFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={sUsername} onChange={e => setSUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={sPassword} onChange={e => setSPassword(e.target.value)} required /></div>
          <div><Label>Class</Label><Select value={sClass} onChange={e => setSClass(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isCSPending}>Create Student</Button>
        </form>
      </Modal>

      {/* New Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Start New Academic Session">
        <div className="space-y-4 text-muted-foreground">
          <p>Are you sure you want to start a new academic session?</p>
          <p className="text-destructive font-bold">This will automatically promote all students to their next class (e.g. JSS1 to JSS2). SSS3 students will be graduated.</p>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setSessionModalOpen(false)} className="mr-3">Cancel</Button>
            <Button variant="destructive" onClick={() => newSession({ schoolCode })} isLoading={isNSPending}>Yes, Promote Students</Button>
          </div>
        </div>
      </Modal>

      {/* Retake Passcode Modal */}
      <Modal isOpen={passcodeModalOpen} onClose={() => setPasscodeModalOpen(false)} title="Retake Exam Passcode">
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <label className="text-sm font-medium text-muted-foreground">Current Passcode</label>
            <div className="text-2xl font-mono font-bold tracking-wider mt-1">
              {isLoadingPasscode ? "Loading..." : currentPasscode || "1234"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">New Passcode (4 digits)</label>
            <Input type="password" maxLength={4} placeholder="Enter new 4-digit passcode" value={newPasscode}
              onChange={(e) => { setNewPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setPasscodeError(""); }}
              className="text-center text-2xl tracking-widest" />
          </div>
          {passcodeError && <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{passcodeError}</div>}
          <p className="text-xs text-muted-foreground">Students will need this 4-digit code to retake exams. Keep it secure.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setPasscodeModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={updatePasscode} isLoading={isUpdatingPasscode} disabled={!newPasscode} className="flex-1">Update Passcode</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modals */}
      <TeacherDetailModal teacherId={selectedTeacherId} teacherName={selectedTeacherName} schoolCode={schoolCode} onClose={() => setSelectedTeacherId(null)} />
      <StudentDetailModal studentId={selectedStudentId} studentName={selectedStudentName} schoolCode={schoolCode} onClose={() => setSelectedStudentId(null)} />
      <ResultDetailModal resultId={selectedResultId} schoolCode={schoolCode} onClose={() => setSelectedResultId(null)} />
    </DashboardLayout>
  );
}