import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListTeachers, useCreateTeacher, useDeleteTeacher, useListStudents, useCreateStudent, useDeleteStudent, useListResults, useStartNewSession, useListExams, useToggleExamStatus, getListExamsQueryKey, useStudentCredentials } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, CustomTabs, Badge, Select, PasswordInput } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListTeachersQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { Trash2, UserPlus, RotateCw, ChevronRight, BookOpen, Plus, Upload, School, Printer, TableIcon, Power, PowerOff, ArrowRightLeft, GraduationCap, Briefcase, Medal, Users, KeyRound } from "lucide-react";
import { TeacherDetailModal } from "@/components/teacher-detail-modal";
import { StudentDetailModal } from "@/components/student-detail-modal";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { format } from "date-fns";
import { BulkUploadStudentsModal } from "@/components/bulk-upload-students-modal";

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [activeTab, setActiveTab] = useState("Teachers");
  const queryClient = useQueryClient();

  const [classFilter, setClassFilter] = useState("KG1");
  const CLASSES = ["KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3", "Entrance Exam", "Staff Interview"];
  const REGULAR_CLASSES = CLASSES.filter(c => c !== "Entrance Exam" && c !== "Staff Interview");

  const { data: teachers = [] } = useListTeachers(schoolCode);
  const { data: students = [], isLoading: studentsLoading } = useListStudents(schoolCode, classFilter);
  const { data: results = [] } = useListResults(schoolCode);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [bulkStudentModalOpen, setBulkStudentModalOpen] = useState(false);

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
  const [sClass, setSClass] = useState("KG1");

  const [isSessionModalOpen, setSessionModalOpen] = useState(false);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [academicSessionModalOpen, setAcademicSessionModalOpen] = useState(false);
  const [newAcademicSession, setNewAcademicSession] = useState("2025/2026");
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  // Subjects state
  const [subjects, setSubjects] = useState<{ id: number; name: string; level: string }[]>([]);
  const [isSubjectsLoading, setIsSubjectsLoading] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectLevel, setNewSubjectLevel] = useState<"kg" | "nursery" | "primary" | "junior" | "senior">("kg");
  const [subjectError, setSubjectError] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Term management state
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [currentTerm, setCurrentTerm] = useState("First Term");
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [isUpdatingTerm, setIsUpdatingTerm] = useState(false);
  const [termError, setTermError] = useState("");
  const [academicSession, setAcademicSession] = useState("2025/2026");

  // Bulk subject upload state
  const [bulkSubjectModalOpen, setBulkSubjectModalOpen] = useState(false);
  const [bulkSubjectsText, setBulkSubjectsText] = useState("");
  const [bulkSubjectsLevel, setBulkSubjectsLevel] = useState<"kg" | "nursery" | "primary" | "junior" | "senior">("kg");
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

  // Update academic session
  const updateAcademicSession = async () => {
    // Validate YYYY/YYYY format
    if (!/^\d{4}\/\d{4}$/.test(newAcademicSession.trim())) {
      setSessionError("Please enter a valid session in YYYY/YYYY format (e.g. 2025/2026).");
      return;
    }
    const [y1, y2] = newAcademicSession.trim().split('/').map(Number);
    if (y2 !== y1 + 1) {
      setSessionError("The second year must be one more than the first (e.g. 2025/2026).");
      return;
    }
    setIsUpdatingSession(true);
    setSessionError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/update-academic-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicSession: newAcademicSession }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setSessionError(data.error || "Failed to update academic session");
        return;
      }

      setAcademicSession(newAcademicSession);
      setAcademicSessionModalOpen(false);
    } catch (err) {
      setSessionError("Network error. Please try again.");
    } finally {
      setIsUpdatingSession(false);
    }
  };

  // Fetch school info including term and session
  const fetchSchoolInfo = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = await response.json();
      setSchoolLogo(data.logoUrl);
      setCurrentTerm(data.currentTerm || "First Term");
      setAvailableTerms(data.availableTerms || ["First Term", "Second Term", "Third Term"]);
      setAcademicSession(data.currentAcademicSession || "2025/2026");
    } catch (err) {
      console.error("Failed to fetch school info", err);
    }
  };

  // Update term
  const updateTerm = async () => {
    setIsUpdatingTerm(true);
    setTermError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/update-term`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: currentTerm }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setTermError(data.error || "Failed to update term");
        return;
      }

      setTermModalOpen(false);
    } catch (err) {
      setTermError("Network error. Please try again.");
    } finally {
      setIsUpdatingTerm(false);
    }
  };

  // Fetch subjects
  const fetchSubjects = async () => {
    setIsSubjectsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) setSubjects(data);
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    } finally {
      setIsSubjectsLoading(false);
    }
  };

  // Fetch grading scheme
  const fetchGradingScheme = async () => {
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
    }
  };

  // Update grading scheme
  const updateGradingScheme = async () => {
    setSchemeError("");
    setSchemeSuccess("");

    // Validate component totals sum to 100
    const componentSum = gradingScheme.midTermTotal + gradingScheme.classActivityTotal + gradingScheme.examTotal;
    if (componentSum !== 100) {
      setSchemeError(`Component totals must sum to 100 (currently ${componentSum}).`);
      return;
    }
    // Validate grade boundaries are strictly decreasing
    if (!(gradingScheme.gradeAMin > gradingScheme.gradeBMin &&
          gradingScheme.gradeBMin > gradingScheme.gradeCMin &&
          gradingScheme.gradeCMin > gradingScheme.gradeDMin)) {
      setSchemeError("Grade boundaries must be strictly decreasing: A > B > C > D.");
      return;
    }

    setIsSavingScheme(true);

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
      setNewSubjectLevel("kg");
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "school-logos");

      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();

      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: url }),
        credentials: "include",
      });

      if (response.ok) {
        setSchoolLogo(url);
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

  // All-exams state (for admin publish/unpublish)
  const { data: allExams = [], isLoading: isLoadingExams } = useListExams(schoolCode);
  const { mutate: toggleExamStatus } = useToggleExamStatus({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExamsQueryKey(schoolCode) }) }
  });
  const [examSearchQuery, setExamSearchQuery] = useState("");
  const [examClassFilter, setExamClassFilter] = useState("All");

  // Student move-class state
  const [moveStudentModalOpen, setMoveStudentModalOpen] = useState(false);
  const [moveStudentTarget, setMoveStudentTarget] = useState<{ id: number; fullName: string; currentClass: string } | null>(null);
  const [moveTargetClass, setMoveTargetClass] = useState("KG1");
  const [isMovingStudent, setIsMovingStudent] = useState(false);
  const [moveStudentError, setMoveStudentError] = useState("");

  const handleMoveStudent = async () => {
    if (!moveStudentTarget) return;
    setIsMovingStudent(true);
    setMoveStudentError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${moveStudentTarget.id}/class`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class: moveTargetClass }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const d = await res.json();
        setMoveStudentError(d.error || "Failed to move student");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
      CLASSES.forEach(cls => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, cls) }));
      setMoveStudentModalOpen(false);
      setMoveStudentTarget(null);
    } catch {
      setMoveStudentError("Network error. Please try again.");
    } finally {
      setIsMovingStudent(false);
    }
  };

  // Special results state (Entrance Exam & Staff Interview)
  const [specialResultsType, setSpecialResultsType] = useState<"entrance" | "interview">("entrance");
  const [specialResultsData, setSpecialResultsData] = useState<{ results: any[]; candidates: any[] } | null>(null);
  const [isLoadingSpecial, setIsLoadingSpecial] = useState(false);

  const fetchSpecialResults = async (type: "entrance" | "interview") => {
    setIsLoadingSpecial(true);
    setSpecialResultsData(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/special-results?type=${type}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setSpecialResultsData(data);
    } catch (err) {
      console.error("Failed to fetch special results", err);
    } finally {
      setIsLoadingSpecial(false);
    }
  };

  // Credentials tab state
  const [credentialsClass, setCredentialsClass] = useState("KG1");
  const { data: allCredentials = [], isLoading: credentialsLoading } = useStudentCredentials(schoolCode);
  const credentialsPrintRef = useRef<HTMLDivElement>(null);

  // Broadsheet state
  const [broadsheetClass, setBroadsheetClass] = useState("KG1");
  const [broadsheetData, setBroadsheetData] = useState<{ students: any[]; subjects: string[] } | null>(null);
  const [isLoadingBroadsheet, setIsLoadingBroadsheet] = useState(false);

  const fetchBroadsheet = async (cls: string) => {
    setIsLoadingBroadsheet(true);
    setBroadsheetData(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/broadsheet?class=${encodeURIComponent(cls)}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setBroadsheetData(data);
    } catch (err) {
      console.error("Failed to fetch broadsheet", err);
    } finally {
      setIsLoadingBroadsheet(false);
    }
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">School Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage personnel, students, and academic records.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setTermModalOpen(true)}>
            <RotateCw className="w-3 h-3 mr-1" /> {currentTerm}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewAcademicSession(academicSession); setAcademicSessionModalOpen(true); }}>
            <RotateCw className="w-3 h-3 mr-1" /> {academicSession}
          </Button>
          <Button variant="outline" size="sm" onClick={openGradingModal}>Grading</Button>
          <Button variant="outline" size="sm" onClick={openPasscodeModal}>Passcode</Button>
          <Button variant="outline" size="sm" onClick={() => setSessionModalOpen(true)}>New Session</Button>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <CustomTabs tabs={["Teachers", "Students", "Results", "Subjects", "Exams", "Entrance Exam", "Staff Interview", "Broadsheet", "Credentials", "Local Server"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Teachers Tab */}
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
          <div className="p-4 border-b border-border/50 bg-muted/20">
            {/* Class Filter - Horizontal scroll on mobile */}
            <div className="mb-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Filter by Class:</p>
              <div className="overflow-x-auto pb-2 -mx-1 px-1">
                <div className="flex gap-1.5 min-w-max">
                  {REGULAR_CLASSES.map(c => (
                    <button
                      key={c}
                      onClick={() => setClassFilter(c)}
                      className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${classFilter === c
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {students.length === 0 ? 'No students' : `${students.length} student${students.length !== 1 ? 's' : ''} in ${classFilter}`}
              </p>
            </div>

            {/* Action Buttons - Stack on mobile, side by side on tablet+ */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkStudentModalOpen(true)} className="w-full sm:w-auto">
                <Upload className="w-4 h-4 mr-1" /> Bulk Upload
              </Button>
              <Button size="sm" onClick={() => setStudentModalOpen(true)} className="w-full sm:w-auto">
                <UserPlus className="w-4 h-4 mr-2" /> Add Student
              </Button>
            </div>
          </div>

          {/* Table - Horizontal scroll on mobile */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-125">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-sm">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Username</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading students…</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No students in {classFilter}.</td></tr>
                ) : (
                  students.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                      onClick={() => { setSelectedStudentId(s.id); setSelectedStudentName(s.fullName || s.username); }}
                    >
                      <td className="px-4 py-3 font-semibold text-primary text-sm">{s.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{s.username}</td>
                      <td className="px-4 py-3"><Badge className="text-xs">{s.class}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Move to another class"
                            onClick={e => {
                              e.stopPropagation();
                              setMoveStudentTarget({ id: s.id, fullName: s.fullName || s.username, currentClass: s.class || "" });
                              setMoveTargetClass(s.class || "KG1");
                              setMoveStudentError("");
                              setMoveStudentModalOpen(true);
                            }}
                            className="p-1.5"
                          >
                            <ArrowRightLeft className="w-4 h-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => { e.stopPropagation(); deleteStudent({ schoolCode, studentId: s.id }); }}
                            className="p-1.5"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                      <Badge variant={pct >= gradingScheme.gradeAMin ? "success" : "destructive"}>
                        {pct >= gradingScheme.gradeAMin ? "Pass" : "Fail"}
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
        <Card className="p-4 md:p-6">
          {/* Header - Stacked on mobile, side by side on desktop */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold font-display">Subject Management</h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Add subjects for KG, Nursery, Primary, Junior and Senior Secondary classes
              </p>      </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkSubjectModalOpen(true)} className="w-full sm:w-auto">
                <Upload className="w-4 h-4 mr-2" /> Bulk Upload
              </Button>
              <Button size="sm" onClick={() => setSubjectModalOpen(true)} className="w-full sm:w-auto">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {([
                { level: 'kg', label: 'Kindergarten (KG1, KG2)' },
                { level: 'nursery', label: 'Nursery (Nursery 1, Nursery 2)' },
                { level: 'primary', label: 'Primary (Pry 1-5)' },
                { level: 'junior', label: 'Junior Secondary (JSS1-3)' },
                { level: 'senior', label: 'Senior Secondary (SSS1-3)' },
              ] as const).map(({ level, label }) => (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-semibold">{label}</h3>
                    <Badge variant="default">{subjects.filter(s => s.level === level).length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {subjects.filter(s => s.level === level).length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No subjects added yet</p>
                    ) : subjects.filter(s => s.level === level).map(subject => (
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
              ))}
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
                <Select value={newSubjectLevel} onChange={e => setNewSubjectLevel(e.target.value as "kg" | "nursery" | "primary" | "junior" | "senior")}>
                  <option value="kg">Kindergarten (KG1, KG2)</option>
                  <option value="nursery">Nursery (Nursery 1, Nursery 2)</option>
                  <option value="primary">Primary (Pry 1 - Pry 5)</option>
                  <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                  <option value="senior">Senior Secondary (SSS1 - SSS3)</option>
                </Select>
              </div>
              {subjectError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{subjectError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setSubjectModalOpen(false)} className="flex-1">Cancel</Button>
                <Button type="submit" isLoading={isAddingSubject} className="flex-1">Add Subject</Button>
              </div>
            </form>
          </Modal>

          {/* Bulk Upload Modal */}
          <Modal isOpen={bulkSubjectModalOpen} onClose={() => setBulkSubjectModalOpen(false)} title="Bulk Upload Subjects" size="lg">
            <div className="space-y-4">
              <div>
                <Label>Level</Label>
                <Select value={bulkSubjectsLevel} onChange={e => setBulkSubjectsLevel(e.target.value as "kg" | "nursery" | "primary" | "junior" | "senior")}>
                  <option value="kg">Kindergarten (KG1, KG2)</option>
                  <option value="nursery">Nursery (Nursery 1, Nursery 2)</option>
                  <option value="primary">Primary (Pry 1 - Pry 5)</option>
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
                  {bulkSubjectsLevel === "kg" ? (
                    <>
                      <span>• Literacy</span> <span>• Numeracy</span> <span>• Phonics</span>
                      <span>• Creative Arts</span> <span>• Music & Movement</span> <span>• Environmental Studies</span>
                      <span>• Physical Education</span> <span>• Religious Studies</span> <span>• Social Skills</span>
                    </>
                  ) : bulkSubjectsLevel === "nursery" ? (
                    <>
                      <span>• Literacy</span> <span>• Numeracy</span> <span>• Phonics</span>
                      <span>• Creative Arts</span> <span>• Social Studies</span> <span>• Religious Studies</span>
                      <span>• Physical Education</span> <span>• Music</span> <span>• Environmental Studies</span>
                      <span>• Handwriting</span> <span>• Science</span> <span>• French</span>
                    </>
                  ) : bulkSubjectsLevel === "primary" ? (
                    <>
                      <span>• Mathematics</span> <span>• English Language</span> <span>• Basic Science</span>
                      <span>• Social Studies</span> <span>• Civic Education</span> <span>• Christian Religious Studies</span>
                      <span>• Islamic Religious Studies</span> <span>• Computer Studies</span> <span>• French</span>
                      <span>• Home Economics</span> <span>• Agricultural Science</span> <span>• Cultural & Creative Arts</span>
                      <span>• Handwriting</span> <span>• Phonics</span> <span>• Verbal Reasoning</span>
                      <span>• Quantitative Reasoning</span> <span>• Vocational Aptitude</span> <span>• Physical & Health Education</span>
                    </>
                  ) : bulkSubjectsLevel === "junior" ? (
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

      {/* ── Exams Tab (publish/unpublish teacher exams) ── */}
      {activeTab === "Exams" && (() => {
        const filteredExams = allExams.filter(exam => {
          const matchesClass = examClassFilter === "All" || exam.class === examClassFilter;
          const matchesSearch = !examSearchQuery ||
            exam.title.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
            exam.subject.toLowerCase().includes(examSearchQuery.toLowerCase());
          return matchesClass && matchesSearch;
        });

        const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.username]));
        const publishedCount = filteredExams.filter(e => e.isActive).length;
        const draftCount = filteredExams.filter(e => !e.isActive).length;

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen className="w-5 h-5" /> Manage Exams</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publish or unpublish exams set by teachers.
                  <span className="ml-2 text-green-600 font-semibold">{publishedCount} Published</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-yellow-600 font-semibold">{draftCount} Draft</span>
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Search by title or subject…"
                value={examSearchQuery}
                onChange={e => setExamSearchQuery(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={examClassFilter} onChange={e => setExamClassFilter(e.target.value)} className="sm:max-w-xs">
                <option value="All">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>

            <Card className="p-0 overflow-hidden">
              {isLoadingExams ? (
                <div className="py-12 text-center text-muted-foreground">Loading exams…</div>
              ) : filteredExams.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No exams found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Exam Title</th>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 font-semibold">Teacher</th>
                        <th className="px-4 py-3 font-semibold text-center">Questions</th>
                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                        <th className="px-4 py-3 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExams.map(exam => (
                        <tr key={exam.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold">{exam.title}</td>
                          <td className="px-4 py-3 text-primary font-medium">{exam.subject}</td>
                          <td className="px-4 py-3"><Badge className="text-xs">{exam.class}</Badge></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{teacherMap.get(exam.teacherId) || `Teacher #${exam.teacherId}`}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{(exam as any).questionCount ?? 0}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={exam.isActive ? "success" : "default"} className="text-xs">
                              {exam.isActive ? "Published" : "Draft"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant={exam.isActive ? "outline" : "secondary"}
                              className={`text-xs px-3 py-1 ${exam.isActive ? "text-destructive hover:bg-destructive/10 border-destructive/30" : ""}`}
                              onClick={() => toggleExamStatus({ schoolCode, examId: exam.id, isActive: !exam.isActive })}
                            >
                              {exam.isActive ? (
                                <><PowerOff className="w-3 h-3 mr-1" /> Unpublish</>
                              ) : (
                                <><Power className="w-3 h-3 mr-1" /> Publish</>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* ── Entrance Exam Tab ─────────────────────────── */}
      {(activeTab === "Entrance Exam" || activeTab === "Staff Interview") && (() => {
        const isEntrance = activeTab === "Entrance Exam";
        const type = isEntrance ? "entrance" : "interview";
        const icon = isEntrance ? <GraduationCap className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />;
        const label = isEntrance ? "Entrance Exam" : "Staff Interview / Appraisal";
        const desc = isEntrance
          ? "Candidates who sat the entrance exam and their results."
          : "Staff interview & appraisal candidates and their scores.";

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">{icon} {label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Button onClick={() => fetchSpecialResults(type)} isLoading={isLoadingSpecial}>
                Load Results
              </Button>
            </div>

            {/* Registered candidates */}
            {specialResultsData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Candidates list */}
                <Card className="p-4 lg:col-span-1">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Registered Candidates ({specialResultsData.candidates.length})
                  </h3>
                  {specialResultsData.candidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No candidates yet. Add students with class "{activeTab}" from the Students tab.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {specialResultsData.candidates.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/30 text-sm">
                          <span className="font-medium truncate">{c.fullName}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-2 shrink-0">{c.username}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Results table */}
                <Card className="p-0 overflow-hidden lg:col-span-2">
                  <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Medal className="w-4 h-4 text-primary" />
                      Results & Rankings ({specialResultsData.results.length} submissions)
                    </h3>
                    {specialResultsData.results.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
                        <Printer className="w-3 h-3 mr-1" /> Print
                      </Button>
                    )}
                  </div>
                  {specialResultsData.results.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Medal className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No results yet. Candidates need to take and submit the exam first.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                            <th className="px-3 py-2 font-semibold">Rank</th>
                            <th className="px-3 py-2 font-semibold">Name</th>
                            <th className="px-3 py-2 font-semibold">Exam</th>
                            <th className="px-3 py-2 font-semibold text-center">Score</th>
                            <th className="px-3 py-2 font-semibold text-center">%</th>
                            <th className="px-3 py-2 font-semibold text-center">Grade</th>
                            <th className="px-3 py-2 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {specialResultsData.results.map((r: any) => (
                            <tr key={r.resultId} className={`border-b border-border/40 transition-colors ${r.passed ? "hover:bg-green-50/30" : "hover:bg-red-50/30"}`}>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-bold text-xs ${r.rank === 1 ? "text-yellow-600" : r.rank === 2 ? "text-slate-500" : r.rank === 3 ? "text-orange-600" : "text-muted-foreground"}`}>
                                  #{r.rank}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-semibold">{r.fullName}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground max-w-32">
                                <span className="truncate block" title={r.examTitle}>{r.examTitle}</span>
                              </td>
                              <td className="px-3 py-2 text-center font-medium">{r.score}/{r.totalQuestions}</td>
                              <td className="px-3 py-2 text-center font-bold">
                                <span className={r.percentage >= 70 ? "text-green-600" : r.percentage >= 50 ? "text-yellow-600" : "text-destructive"}>
                                  {r.percentage.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-bold text-sm ${r.grade === "A" ? "text-green-600" : r.grade === "B" ? "text-blue-600" : r.grade === "C" ? "text-yellow-600" : r.grade === "D" ? "text-orange-600" : "text-destructive"}`}>
                                  {r.grade}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={r.passed ? "success" : "destructive"} className="text-xs">
                                  {r.passed ? "Pass" : "Fail"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {!specialResultsData && !isLoadingSpecial && (
              <Card className="py-12 text-center text-muted-foreground">
                {icon}
                <p className="mt-3 font-semibold">Click "Load Results" to fetch {isEntrance ? "entrance exam" : "interview"} data</p>
                <p className="text-xs mt-1">
                  To add candidates: go to the <strong>Students</strong> tab → Add Student → set class to <strong>"{activeTab}"</strong>.<br />
                  To create the exam: teachers set the class to <strong>"{activeTab}"</strong> when creating an exam.
                </p>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ── Broadsheet Tab ───────────────────────────── */}
      {activeTab === "Broadsheet" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><TableIcon className="w-5 h-5" /> Class Broadsheet</h2>
              <p className="text-xs text-muted-foreground mt-0.5">All students in a class with subject scores, grand total, average, and position.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={broadsheetClass} onChange={e => setBroadsheetClass(e.target.value)} className="w-40">
                {REGULAR_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Button onClick={() => fetchBroadsheet(broadsheetClass)} isLoading={isLoadingBroadsheet}>
                Generate
              </Button>
              {broadsheetData && broadsheetData.students.length > 0 && (
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
              )}
            </div>
          </div>

          {isLoadingBroadsheet && (
            <Card className="py-12 text-center text-muted-foreground">Generating broadsheet…</Card>
          )}

          {!isLoadingBroadsheet && broadsheetData && broadsheetData.students.length === 0 && (
            <Card className="py-12 text-center text-muted-foreground">No students found in {broadsheetClass}.</Card>
          )}

          {!isLoadingBroadsheet && broadsheetData && broadsheetData.students.length > 0 && (
            <Card className="p-0 overflow-hidden broadsheet-card print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-2 py-2 font-semibold whitespace-nowrap">S/N</th>
                      <th className="px-2 py-2 font-semibold whitespace-nowrap min-w-40">Student Name</th>
                      {broadsheetData.subjects.map(subj => (
                        <th key={subj} className="px-2 py-2 font-semibold text-center whitespace-nowrap max-w-24">
                          <span className="block truncate max-w-20" title={subj}>{subj}</span>
                          <span className="font-normal text-xs text-muted-foreground">/100</span>
                        </th>
                      ))}
                      <th className="px-2 py-2 font-semibold text-center whitespace-nowrap">Grand Total</th>
                      <th className="px-2 py-2 font-semibold text-center whitespace-nowrap">Avg %</th>
                      <th className="px-2 py-2 font-semibold text-center whitespace-nowrap">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadsheetData.students.map((student, idx) => (
                      <tr key={student.id} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-2 font-semibold">{student.fullName}</td>
                        {broadsheetData!.subjects.map(subj => {
                          const score = student.subjectTotals[subj];
                          return (
                            <td key={subj} className="px-2 py-2 text-center">
                              {score !== null && score !== undefined ? (
                                <span className={score >= 70 ? "text-green-600 font-bold" : score >= 50 ? "text-blue-600" : "text-destructive"}>
                                  {score}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold">{student.grandTotal}</td>
                        <td className="px-2 py-2 text-center font-bold">
                          {student.average !== null ? `${student.average}%` : "—"}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-primary">{student.position ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!broadsheetData && !isLoadingBroadsheet && (
            <Card className="py-12 text-center text-muted-foreground">
              <TableIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Select a class and click Generate</p>
            </Card>
          )}
        </div>
      )}

      {/* ── Credentials Tab ───────────────────────────── */}
      {activeTab === "Credentials" && (() => {
        const classStudents = allCredentials.filter(s => s.class === credentialsClass);

        const handlePrintCredentials = () => {
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) return;
          const rows = classStudents.map((s, i) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;text-align:center;">${i + 1}</td>
              <td style="padding:8px 12px;font-weight:600;">${s.fullName}</td>
              <td style="padding:8px 12px;font-family:monospace;">${s.username}</td>
              <td style="padding:8px 12px;font-family:monospace;">${s.generatedPassword ?? '—'}</td>
            </tr>`).join('');
          win.document.write(`<!DOCTYPE html><html><head><title>Credentials – ${credentialsClass}</title>
            <style>
              body{font-family:Arial,sans-serif;margin:24px;color:#111;}
              h2{margin-bottom:4px;}p{margin-bottom:16px;color:#555;font-size:13px;}
              table{width:100%;border-collapse:collapse;font-size:13px;}
              thead tr{background:#f3f4f6;}th{padding:8px 12px;text-align:left;font-weight:700;border-bottom:2px solid #d1d5db;}
              tr:nth-child(even){background:#f9fafb;}
              @media print{body{margin:12px;}}
            </style></head><body>
            <h2>Student Login Credentials — ${credentialsClass}</h2>
            <p>School: ${schoolCode} &nbsp;|&nbsp; Total: ${classStudents.length} student${classStudents.length !== 1 ? 's' : ''}</p>
            <table><thead><tr><th>#</th><th>Full Name</th><th>Username</th><th>Password</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <script>window.onload=function(){window.print();}<\/script>
            </body></html>`);
          win.document.close();
        };

        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Student Login Credentials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">View and export student usernames and passwords by class.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={credentialsClass} onChange={e => setCredentialsClass(e.target.value)} className="w-44">
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                {classStudents.length > 0 && (
                  <Button variant="outline" onClick={handlePrintCredentials}>
                    <Printer className="w-4 h-4 mr-2" /> Export PDF
                  </Button>
                )}
              </div>
            </div>

            {credentialsLoading && (
              <Card className="py-12 text-center text-muted-foreground">Loading credentials…</Card>
            )}

            {!credentialsLoading && classStudents.length === 0 && (
              <Card className="py-12 text-center text-muted-foreground">
                <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No students found in {credentialsClass}</p>
              </Card>
            )}

            {!credentialsLoading && classStudents.length > 0 && (
              <Card className="p-0 overflow-hidden" ref={credentialsPrintRef}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-4 py-3 font-semibold w-10">#</th>
                        <th className="px-4 py-3 font-semibold">Full Name</th>
                        <th className="px-4 py-3 font-semibold">Username</th>
                        <th className="px-4 py-3 font-semibold">Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b border-border/50 hover:bg-muted/10">
                          <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold">{student.fullName}</td>
                          <td className="px-4 py-3 font-mono text-sm">{student.username}</td>
                          <td className="px-4 py-3 font-mono text-sm">{student.generatedPassword ?? <span className="text-muted-foreground italic">not available</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ── Local Server Tab ──────────────────────────── */}
      {activeTab === "Local Server" && (() => {
        const API = import.meta.env.VITE_API_URL as string;

        const handleDownloadSchoolData = () => {
          window.open(`${API}/schools/${schoolCode}/sync/local-export`, "_blank");
        };

        const handleResultsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const r = await fetch(`${API}/schools/${schoolCode}/sync/results-import`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error ?? "Upload failed");
            alert(`Sync complete: ${data.inserted} new results added, ${data.skipped} already existed, ${data.answersInserted} answers saved.`);
          } catch (err: any) {
            alert(`Error: ${err.message}`);
          }
          e.target.value = "";
        };

        return (
          <div className="max-w-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Local Server Setup</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Use these tools to set up an offline local server for areas with no internet, then sync results back to cloud after the exam session.
              </p>
            </div>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Step 1 — Download School Data</h3>
              <p className="text-sm text-muted-foreground">
                Download a JSON file containing all teachers, students, exams, and questions for your school. Use this to populate the local server before the exam.
              </p>
              <Button variant="outline" onClick={handleDownloadSchoolData}>
                Download School Data
              </Button>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Step 2 — Upload Results from Local Server</h3>
              <p className="text-sm text-muted-foreground">
                After the local exam session, export results from the local server and upload the file here. Duplicate results are automatically skipped.
              </p>
              <label className="inline-block cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Results File
                </span>
                <input type="file" accept=".json" className="hidden" onChange={handleResultsUpload} />
              </label>
            </Card>
          </div>
        );
      })()}

      {/* Add Teacher Modal */}
      <Modal isOpen={isTeacherModalOpen} onClose={() => setTeacherModalOpen(false)} title="Add New Teacher">
        <form onSubmit={e => { e.preventDefault(); createTeacher({ schoolCode, data: { username: tUsername, password: tPassword, fullName: tFullName } }); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={tFullName} onChange={e => setTFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={tUsername} onChange={e => setTUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><PasswordInput value={tPassword} onChange={e => setTPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full mt-2" isLoading={isCTPending}>Create Teacher</Button>
        </form>
      </Modal>

      {/* Add Student Modal */}
      <Modal isOpen={isStudentModalOpen} onClose={() => setStudentModalOpen(false)} title="Add New Student">
        <form onSubmit={e => { e.preventDefault(); createStudent({ schoolCode, data: { username: sUsername, password: sPassword, fullName: sFullName, class: sClass } }); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={sFullName} onChange={e => setSFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={sUsername} onChange={e => setSUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><PasswordInput value={sPassword} onChange={e => setSPassword(e.target.value)} required /></div>
          <div><Label>Class</Label><Select value={sClass} onChange={e => setSClass(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isCSPending}>Create Student</Button>
        </form>
      </Modal>

      {/* Move Student Modal */}
      <Modal isOpen={moveStudentModalOpen} onClose={() => { setMoveStudentModalOpen(false); setMoveStudentError(""); }} title="Move Student to Another Class">
        {moveStudentTarget && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">{moveStudentTarget.fullName}</p>
              <p className="text-muted-foreground text-xs mt-0.5">Current class: <strong>{moveStudentTarget.currentClass}</strong></p>
            </div>
            <div>
              <Label>Move to Class</Label>
              <Select value={moveTargetClass} onChange={e => setMoveTargetClass(e.target.value)}>
                {CLASSES.filter(c => c !== moveStudentTarget.currentClass).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            {moveStudentError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{moveStudentError}</div>
            )}
            <p className="text-xs text-muted-foreground">
              This only changes the student's class going forward. Past exam results remain unchanged.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setMoveStudentModalOpen(false); setMoveStudentError(""); }} className="flex-1">Cancel</Button>
              <Button onClick={handleMoveStudent} isLoading={isMovingStudent} className="flex-1">
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Move Student
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Start New Academic Session">
        <div className="space-y-4 text-muted-foreground">
          <p>Are you sure you want to start a new academic session?</p>
          <p className="text-destructive font-bold">This will automatically promote all students to their next class (e.g. KG1 → KG2, Nursery 2 → Pry 1, JSS1 → JSS2). SSS3 students will be graduated.</p>
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

      {/* Term Management Modal */}
      <Modal isOpen={termModalOpen} onClose={() => setTermModalOpen(false)} title="Academic Term Settings">
        <div className="space-y-4">
          <div>
            <Label>Current Term</Label>
            <Select
              value={currentTerm}
              onChange={(e) => setCurrentTerm(e.target.value)}
            >
              {availableTerms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the current academic term. All new exams and results will use this term.
            </p>
          </div>

          {termError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {termError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setTermModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={updateTerm} isLoading={isUpdatingTerm} className="flex-1">
              Update Term
            </Button>
          </div>
        </div>
      </Modal>

      {/* Academic Session Modal */}
      <Modal isOpen={academicSessionModalOpen} onClose={() => setAcademicSessionModalOpen(false)} title="Academic Session Settings">
        <div className="space-y-4">
          <div>
            <Label>Academic Session</Label>
            <Input
              type="text"
              value={newAcademicSession}
              onChange={(e) => setNewAcademicSession(e.target.value)}
              placeholder="e.g., 2025/2026"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Format: YYYY/YYYY (e.g., 2025/2026)
            </p>
          </div>

          {sessionError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {sessionError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setAcademicSessionModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={updateAcademicSession} isLoading={isUpdatingSession} className="flex-1">
              Update Session
            </Button>
          </div>
        </div>
      </Modal>

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
              <div>
                <label className="block text-sm font-medium mb-2">Total Points</label>
                <Input type="number" value={gradingScheme.midTermTotal}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermTotal: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">CBT Portion</label>
                <Input type="number" value={gradingScheme.midTermCbt}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermCbt: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Theory Portion</label>
                <Input type="number" value={gradingScheme.midTermTheory}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, midTermTheory: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Exam Component */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-4">Final Exam</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Total Points</label>
                <Input type="number" value={gradingScheme.examTotal}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examTotal: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">CBT Portion</label>
                <Input type="number" value={gradingScheme.examCbt}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examCbt: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Theory Portion</label>
                <Input type="number" value={gradingScheme.examTheory}
                  onChange={(e) => setGradingScheme({ ...gradingScheme, examTheory: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Class Activity */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Class Activity</h3>
            <div>
              <label className="block text-sm font-medium mb-2">Total Points</label>
              <Input type="number" value={gradingScheme.classActivityTotal}
                onChange={(e) => setGradingScheme({ ...gradingScheme, classActivityTotal: parseInt(e.target.value) || 0 })}
                className="w-full max-w-md" />
            </div>
          </div>

          {schemeError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {schemeError}
            </div>
          )}

          {schemeSuccess && (
            <div className="bg-success/10 text-success p-3 rounded-lg text-sm">
              {schemeSuccess}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={updateGradingScheme} isLoading={isSavingScheme}>
              Save Grading Scheme
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Students Modal */}
      <BulkUploadStudentsModal
        isOpen={bulkStudentModalOpen}
        onClose={() => setBulkStudentModalOpen(false)}
        schoolCode={schoolCode}
        onSuccess={() => {
          // Refresh students list after bulk upload
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
        }}
      />

      {/* Detail modals */}
      <TeacherDetailModal teacherId={selectedTeacherId} teacherName={selectedTeacherName} schoolCode={schoolCode} onClose={() => setSelectedTeacherId(null)} />
      <StudentDetailModal studentId={selectedStudentId} studentName={selectedStudentName} schoolCode={schoolCode} onClose={() => setSelectedStudentId(null)} />
      <ResultDetailModal resultId={selectedResultId} schoolCode={schoolCode} onClose={() => setSelectedResultId(null)} />
    </DashboardLayout>
  );
}