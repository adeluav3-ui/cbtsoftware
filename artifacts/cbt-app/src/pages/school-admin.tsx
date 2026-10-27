import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";

const SLUG_TO_TAB: Record<string, string> = {
  "teachers":        "Teachers",
  "students":        "Students",
  "credentials":     "Credentials",
  "subjects":        "Subjects",
  "exams":           "Exams",
  "entrance-exam":   "Entrance Exam",
  "staff-interview": "Staff Interview",
  "results":         "Results",
  "upload-results":  "Upload Results",
  "broadsheet":      "Broadsheet",
  "devices":         "Devices",
  "local-server":    "Local Server",
};
import { useAuth } from "@/lib/auth";
import { useListTeachers, useCreateTeacher, useDeleteTeacher, useListStudents, useCreateStudent, useDeleteStudent, useListResults, useStartNewSession, useListExams, useToggleExamStatus, getListExamsQueryKey, useStudentCredentials } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Badge, Select, PasswordInput } from "@/components/ui-elements";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getListTeachersQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { Trash2, UserPlus, RotateCw, ChevronRight, BookOpen, Plus, Upload, School, Printer, TableIcon, Power, PowerOff, ArrowRightLeft, GraduationCap, Briefcase, Medal, Users, KeyRound, Smartphone, Tablet, Monitor, Download } from "lucide-react";
import { TeacherDetailModal } from "@/components/teacher-detail-modal";
import { StudentDetailModal } from "@/components/student-detail-modal";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { ConfirmDialog } from "@/components/feedback";
import { format } from "date-fns";
import { BulkUploadStudentsModal } from "@/components/bulk-upload-students-modal";
import { ClassResultsView } from "@/components/class-results-modal";
import { getGradeColor } from "@/lib/grade";

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const queryClient = useQueryClient();

  // URL-driven tab: /school-admin/:category/:tab
  const { tab: tabSlug } = useParams() as { category?: string; tab?: string };
  const [, setLocation] = useLocation();
  const activeTab = SLUG_TO_TAB[tabSlug ?? ""] ?? "Teachers";

  // Redirect bare /school-admin → /school-admin/people/teachers
  useEffect(() => {
    if (!tabSlug) setLocation("/school-admin/people/teachers", { replace: true });
  }, [tabSlug]);

  const [classFilter, setClassFilter] = useState("KG1");
  const CLASSES = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3", "Entrance Exam", "Staff Interview"];
  const REGULAR_CLASSES = CLASSES.filter(c => c !== "Entrance Exam" && c !== "Staff Interview");

  const { data: teachers = [] } = useListTeachers(schoolCode);
  const { data: students = [], isLoading: studentsLoading } = useListStudents(schoolCode, classFilter);
  const { data: results = [] } = useListResults(schoolCode);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
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

  // Results tab filter state
  const [resClassFilter, setResClassFilter] = useState("");
  const [resSubjectFilter, setResSubjectFilter] = useState("");
  const [resTypeFilter, setResTypeFilter] = useState("");
  const [resExpandedGroup, setResExpandedGroup] = useState<{ class: string; subject: string; type: string } | null>(null);

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
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<number | null>(null);

  // Term management state
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [currentTerm, setCurrentTerm] = useState("First Term");
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [isUpdatingTerm, setIsUpdatingTerm] = useState(false);
  const [termError, setTermError] = useState("");
  const [academicSession, setAcademicSession] = useState("2025/2026");
  const [nextTermBeginsDate, setNextTermBeginsDate] = useState("");
  const [isSavingNextTermDate, setIsSavingNextTermDate] = useState(false);

  // Subject merge state
  const [mergeSubject, setMergeSubject] = useState<{ id: number; name: string; level: string } | null>(null);
  const [mergeTargetName, setMergeTargetName] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

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
      setSchoolName(data.name || "");
      setCurrentTerm(data.currentTerm || "First Term");
      setAvailableTerms(data.availableTerms || ["First Term", "Second Term", "Third Term"]);
      setAcademicSession(data.currentAcademicSession || "2025/2026");
      setNextTermBeginsDate(data.nextTermBegins || "");
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

  // Save next term begins date
  const handleSaveNextTermDate = async () => {
    setIsSavingNextTermDate(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/next-term-begins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nextTermBegins: nextTermBeginsDate || null }),
      });
      if (!res.ok) throw new Error();
    } catch {
      alert("Failed to save next term date");
    } finally {
      setIsSavingNextTermDate(false);
    }
  };

  // Merge subject into another
  const handleMergeSubject = async () => {
    if (!mergeSubject || !mergeTargetName.trim()) return;
    setIsMerging(true);
    setMergeError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // mergeSubject is the TARGET (survivor); mergeTargetName is the SOURCE to absorb
        body: JSON.stringify({ fromName: mergeTargetName.trim(), toName: mergeSubject.name, level: mergeSubject.level }),
      });
      const data = await res.json();
      if (!res.ok) { setMergeError(data.error || "Merge failed"); return; }
      setMergeSubject(null);
      setMergeTargetName("");
      await fetchSubjects();
    } catch {
      setMergeError("Network error. Please try again.");
    } finally {
      setIsMerging(false);
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
  const [reassignExam, setReassignExam] = useState<{ id: number; title: string; subject: string; assessmentType: string } | null>(null);
  const [reassignNewSubject, setReassignNewSubject] = useState("");
  const [reassignNewType, setReassignNewType] = useState("mid_term");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<string | null>(null);

  // Student move-class state
  const [moveStudentModalOpen, setMoveStudentModalOpen] = useState(false);
  const [moveStudentTarget, setMoveStudentTarget] = useState<{ id: number; fullName: string; currentClass: string } | null>(null);
  const [moveTargetClass, setMoveTargetClass] = useState("KG1");
  const [isMovingStudent, setIsMovingStudent] = useState(false);
  const [moveStudentError, setMoveStudentError] = useState("");

  const handleReassignExam = async () => {
    if (!reassignExam || !reassignNewSubject.trim()) return;
    setIsReassigning(true);
    setReassignResult(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${reassignExam.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newSubject: reassignNewSubject.trim(), newAssessmentType: reassignNewType }),
      });
      const data = await res.json();
      if (!res.ok) { setReassignResult(`Error: ${data.error}`); return; }
      setReassignResult(data.message);
      queryClient.invalidateQueries({ queryKey: getListExamsQueryKey(schoolCode) });
    } catch {
      setReassignResult("Network error. Please try again.");
    } finally {
      setIsReassigning(false);
    }
  };

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
  const [credentialsView, setCredentialsView] = useState<"students" | "teachers">("students");
  const { data: allCredentials = [], isLoading: credentialsLoading } = useStudentCredentials(schoolCode);
  const [teacherCredentials, setTeacherCredentials] = useState<Array<{ id: number; fullName: string; username: string; generatedPassword: string | null }>>([]);
  const [teacherCredentialsLoading, setTeacherCredentialsLoading] = useState(false);
  const credentialsPrintRef = useRef<HTMLDivElement>(null);

  // Local server — connected devices (polled every 30 s when tab is open)
  const [localDevices, setLocalDevices] = useState<Array<{
    deviceId: string; lastSeen: string; fullName: string | null;
    username: string | null; role: string | null; schoolCode: string | null; ipAddress: string;
  }>>([]);
  useEffect(() => {
    if (activeTab !== "Local Server") return;
    const LAPI = import.meta.env.VITE_API_URL as string;
    const poll = () =>
      fetch(`${LAPI}/devices`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => setLocalDevices(Array.isArray(d) ? d : (d?.devices ?? [])))
        .catch(() => null);
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [activeTab]);

  // Cloud mode — connected devices (active in last 30 min, polled every 30 s)
  type CloudDevice = {
    deviceId: string;
    deviceType: "phone" | "tablet" | "desktop";
    ipAddress: string | null;
    fullName: string | null;
    username: string | null;
    role: string | null;
    firstSeen: string;
    lastSeen: string;
  };
  const { data: cloudDevicesData } = useQuery<{ devices: CloudDevice[]; count: number } | null>({
    queryKey: ["school-devices", schoolCode],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/devices/school-devices`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === "Devices",
    refetchInterval: activeTab === "Devices" ? 30_000 : false,
  });

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

  const handleBroadsheetPDF = () => {
    if (!broadsheetData) return;
    const { students, subjects } = broadsheetData;
    const title = `${schoolName || schoolCode} — ${broadsheetClass} Broadsheet`;
    const subtitle = `${currentTerm} · ${academicSession}`;

    const thCols = ['#', 'Student Name', ...subjects, 'Grand Total', 'Avg %', 'Position']
      .map(h => `<th>${h}</th>`).join('');

    const rows = students.map((s, i) => {
      const subjectCells = subjects.map(subj => {
        const score = s.subjectTotals[subj];
        const val = score !== null && score !== undefined ? score : '—';
        const colour = typeof score === 'number'
          ? score >= 70 ? '#16a34a' : score >= 50 ? '#2563eb' : '#dc2626'
          : '#9ca3af';
        return `<td style="text-align:center;color:${colour};font-weight:${typeof score === 'number' && score >= 70 ? '700' : '400'}">${val}</td>`;
      }).join('');
      return `<tr>
        <td style="text-align:center;color:#6b7280">${i + 1}</td>
        <td style="font-weight:600">${s.fullName}</td>
        ${subjectCells}
        <td style="text-align:center;font-weight:700">${s.grandTotal}</td>
        <td style="text-align:center;font-weight:700">${s.average !== null ? `${s.average}%` : '—'}</td>
        <td style="text-align:center;font-weight:700;color:#7c3aed">${s.position ?? '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A3 landscape; margin: 1.2cm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
        h2 { margin: 0 0 2px; font-size: 15px; }
        p { margin: 0 0 12px; color: #555; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f3f4f6; }
        th { padding: 6px 8px; text-align: left; font-weight: 700; border-bottom: 2px solid #d1d5db; white-space: nowrap; font-size: 10px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        tr:nth-child(even) { background: #f9fafb; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h2>${title}</h2>
      <p>${subtitle} &nbsp;·&nbsp; ${students.length} student${students.length !== 1 ? 's' : ''}</p>
      <table><thead><tr>${thCols}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;

    const win = window.open('', '_blank', 'width=1400,height=900');
    if (!win) { alert('Allow popups for this site to export PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const handleBroadsheetDocx = async () => {
    if (!broadsheetData) return;
    const { Document, Packer, Table, TableCell, TableRow, Paragraph, TextRun, WidthType, AlignmentType, PageOrientation, HeadingLevel } = await import('docx');
    const { students, subjects } = broadsheetData;

    const allCols = ['#', 'Student Name', ...subjects, 'Grand Total', 'Avg %', 'Position'];
    const colCount = allCols.length;
    const colWidth = Math.floor(9000 / colCount);

    const makeCell = (text: string, bold = false, center = false) =>
      new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, bold, size: 18 })],
        })],
      });

    const headerRow = new TableRow({
      tableHeader: true,
      children: allCols.map((h, i) => makeCell(h, true, i >= 2)),
    });

    const dataRows = students.map((s: any, idx: number) => new TableRow({
      children: [
        makeCell(String(idx + 1), false, true),
        makeCell(s.fullName, true),
        ...subjects.map((subj: string) => {
          const score = s.subjectTotals[subj];
          return makeCell(score !== null && score !== undefined ? String(score) : '—', false, true);
        }),
        makeCell(String(s.grandTotal), true, true),
        makeCell(s.average !== null ? `${s.average}%` : '—', true, true),
        makeCell(String(s.position ?? '—'), true, true),
      ],
    }));

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${schoolName || schoolCode} — ${broadsheetClass} Broadsheet`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `${currentTerm} · ${academicSession}   |   ${students.length} student${students.length !== 1 ? 's' : ''}`, color: '555555' })] }),
          new Paragraph(''),
          table,
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broadsheet-${broadsheetClass}-${currentTerm.replace(/\s+/g, '-')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      <div>

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
      {activeTab === "Results" && (() => {
        const CLASS_ORDER = ["Pre-School","KG1","KG2","Nursery 1","Nursery 2","Pry 1","Pry 2","Pry 3","Pry 4","Pry 5","JSS1","JSS2","JSS3","SSS1","SSS2","SSS3"];
        const getType = (r: any) => (r.assessmentType && r.assessmentType !== "undefined") ? r.assessmentType : "unknown";
        const typeLabel = (t: string) => t === "mid_term" ? "Mid-term Test" : t === "exam" ? "Final Exam" : "Unknown";

        // Build unique filter options from all results
        const allClasses = [...new Set(results.map(r => r.class).filter(Boolean))].sort((a, b) => CLASS_ORDER.indexOf(a!) - CLASS_ORDER.indexOf(b!));
        const allSubjects = [...new Set(results.filter(r => !resClassFilter || r.class === resClassFilter).map(r => r.subject).filter(Boolean))].sort();
        const allTypes = [...new Set(results.map(r => getType(r)).filter(t => t !== "unknown"))];

        // Filtered results matching current dropdowns
        const filtered = results.filter(r =>
          (!resClassFilter || r.class === resClassFilter) &&
          (!resSubjectFilter || r.subject === resSubjectFilter) &&
          (!resTypeFilter || getType(r) === resTypeFilter)
        );

        // Group into (class, subject, assessmentType) buckets for summary
        type GroupKey = string;
        const groupMap = new Map<GroupKey, typeof results>();
        for (const r of filtered) {
          const key = `${r.class}||${r.subject}||${getType(r)}`;
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(r);
        }
        const groups = [...groupMap.entries()]
          .map(([key, rows]) => {
            const [cls, subj, type] = key.split("||");
            const avgPct = rows.reduce((s, r) => s + (r.percentage ?? 0), 0) / rows.length;
            return { cls, subj, type, rows, avgPct };
          })
          .sort((a, b) => {
            const ci = CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls);
            if (ci !== 0) return ci;
            const si = a.subj.localeCompare(b.subj);
            if (si !== 0) return si;
            return (a.type === "mid_term" ? 0 : 1) - (b.type === "mid_term" ? 0 : 1);
          });

        const expandedRows = resExpandedGroup
          ? filtered.filter(r =>
              r.class === resExpandedGroup.class &&
              r.subject === resExpandedGroup.subject &&
              getType(r) === resExpandedGroup.type
            )
          : null;

        return (
          <div className="space-y-4">
            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-xs mb-1 block">Class</Label>
                  <Select value={resClassFilter} onChange={e => { setResClassFilter(e.target.value); setResSubjectFilter(""); setResExpandedGroup(null); }}>
                    <option value="">All Classes</option>
                    {allClasses.map(c => <option key={c} value={c!}>{c}</option>)}
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs mb-1 block">Subject</Label>
                  <Select value={resSubjectFilter} onChange={e => { setResSubjectFilter(e.target.value); setResExpandedGroup(null); }}>
                    <option value="">All Subjects</option>
                    {allSubjects.map(s => <option key={s} value={s!}>{s}</option>)}
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs mb-1 block">Exam Type</Label>
                  <Select value={resTypeFilter} onChange={e => { setResTypeFilter(e.target.value); setResExpandedGroup(null); }}>
                    <option value="">All Types</option>
                    {allTypes.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </Select>
                </div>
                {(resClassFilter || resSubjectFilter || resTypeFilter) && (
                  <Button variant="outline" onClick={() => { setResClassFilter(""); setResSubjectFilter(""); setResTypeFilter(""); setResExpandedGroup(null); }} className="shrink-0">
                    Clear
                  </Button>
                )}
              </div>
            </Card>

            {/* Detail view — when a group row is clicked */}
            {resExpandedGroup && expandedRows ? (
              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-3 flex-wrap">
                  <button onClick={() => setResExpandedGroup(null)} className="text-primary text-sm hover:underline flex items-center gap-1">
                    ← Back to summary
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <Badge>{resExpandedGroup.class}</Badge>
                  <span className="font-semibold text-sm">{resExpandedGroup.subject}</span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-sm text-muted-foreground">{typeLabel(resExpandedGroup.type)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{expandedRows.length} submission{expandedRows.length !== 1 ? "s" : ""} · Click row for breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Student</th>
                        <th className="px-4 py-3 font-semibold">Score</th>
                        <th className="px-4 py-3 font-semibold">Percentage</th>
                        <th className="px-4 py-3 font-semibold">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedRows.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).map(r => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-primary/5 cursor-pointer" onClick={() => setSelectedResultId(r.id)}>
                          <td className="px-4 py-3 font-semibold text-primary">{r.fullName}</td>
                          <td className="px-4 py-3 font-bold">{r.score} / {r.totalQuestions}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${(r.percentage ?? 0) >= 50 ? "text-secondary" : "text-destructive"}`}>
                              {(r.percentage ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy h:mm a") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              /* Summary grouped table */
              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/20">
                  <p className="text-xs text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""} found — click any row to see individual student results</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Exam Type</th>
                        <th className="px-4 py-3 font-semibold text-center">Submissions</th>
                        <th className="px-4 py-3 font-semibold text-center">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(({ cls, subj, type, rows, avgPct }) => (
                        <tr
                          key={`${cls}||${subj}||${type}`}
                          className="border-b border-border/50 hover:bg-primary/5 cursor-pointer transition-colors"
                          onClick={() => setResExpandedGroup({ class: cls, subject: subj, type })}
                        >
                          <td className="px-4 py-3"><Badge>{cls}</Badge></td>
                          <td className="px-4 py-3 font-medium">{subj}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${type === "mid_term" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                              {typeLabel(type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">{rows.length}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${avgPct >= 50 ? "text-secondary" : "text-destructive"}`}>{avgPct.toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                      {groups.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No results match the selected filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Upload Results Tab */}
      {activeTab === "Upload Results" && (
        <Card className="p-4 md:p-6">
          <div className="mb-5">
            <h2 className="text-lg md:text-xl font-bold font-display flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Class Result Entry
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Select a class and subject, then enter or update scores for all students at once.
            </p>
          </div>
          <ClassResultsView schoolCode={schoolCode} tableMaxHeight="max-h-[65vh]" />
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
                Add subjects for Pre-School, KG, Nursery, Primary, Junior and Senior Secondary classes. Pre-School has its own independent subject list.
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
                { level: 'kg', label: 'Pre-School / Kindergarten (Pre-School, KG1, KG2)' },
                { level: 'nursery', label: 'Nursery (Nursery 1, Nursery 2)' },
                { level: 'primary', label: 'Primary (Pry 1-5)' },
                { level: 'junior', label: 'Junior Secondary (JSS1-3)' },
                { level: 'senior', label: 'Senior Secondary (SSS1-3)' },
                { level: 'entrance', label: 'Entrance Exam' },
                { level: 'interview', label: 'Staff Interview' },
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setMergeSubject(subject); setMergeTargetName(""); setMergeError(""); }}
                            title="Merge into another subject"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteSubjectId(subject.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Merge Subject Modal */}
          <Modal isOpen={mergeSubject !== null} onClose={() => setMergeSubject(null)} title="Absorb Into Subject">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the other subject name whose scores and exams should be absorbed into <strong>"{mergeSubject?.name}"</strong>. That name will be removed and all its data moved here. Only {mergeSubject?.level}-level data is affected.
              </p>
              <div>
                <Label>Absorb from (other subject name to remove)</Label>
                <Input
                  value={mergeTargetName}
                  onChange={e => setMergeTargetName(e.target.value)}
                  placeholder={`e.g., ${mergeSubject?.level === 'junior' ? 'English Studies' : 'English Language'}`}
                  list="merge-target-options"
                />
                <datalist id="merge-target-options">
                  {subjects
                    .filter(s => s.level === mergeSubject?.level && s.name !== mergeSubject?.name)
                    .map(s => <option key={s.id} value={s.name} />)}
                </datalist>
                <p className="text-xs text-muted-foreground mt-1">Can be a name that only exists in CBT exam data, not necessarily in the subject list.</p>
              </div>
              {mergeError && <p className="text-sm text-destructive">{mergeError}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setMergeSubject(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleMergeSubject}
                  isLoading={isMerging}
                  disabled={!mergeTargetName.trim()}
                  className="flex-1"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Merge
                </Button>
              </div>
            </div>
          </Modal>

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
                <Select value={newSubjectLevel} onChange={e => setNewSubjectLevel(e.target.value as any)}>
                  <option value="kg">Pre-School / Kindergarten (Pre-School, KG1, KG2)</option>
                  <option value="nursery">Nursery (Nursery 1, Nursery 2)</option>
                  <option value="primary">Primary (Pry 1 - Pry 5)</option>
                  <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                  <option value="senior">Senior Secondary (SSS1 - SSS3)</option>
                  <option value="entrance">Entrance Exam</option>
                  <option value="interview">Staff Interview</option>
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
                <Select value={bulkSubjectsLevel} onChange={e => setBulkSubjectsLevel(e.target.value as any)}>
                  <option value="kg">Pre-School / Kindergarten (Pre-School, KG1, KG2)</option>
                  <option value="nursery">Nursery (Nursery 1, Nursery 2)</option>
                  <option value="primary">Primary (Pry 1 - Pry 5)</option>
                  <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                  <option value="senior">Senior Secondary (SSS1 - SSS3)</option>
                  <option value="entrance">Entrance Exam</option>
                  <option value="interview">Staff Interview</option>
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
                  <span className="ml-2 text-secondary font-semibold">{publishedCount} Published</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-warning font-semibold">{draftCount} Draft</span>
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
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 font-semibold">Teacher</th>
                        <th className="px-4 py-3 font-semibold text-center">Qs</th>
                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                        <th className="px-4 py-3 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExams.map(exam => {
                        const atype = (exam as any).assessmentType ?? "exam";
                        const atypeLabel = atype === "mid_term" ? "Mid-term" : atype === "exam" ? "Final Exam" : "CA";
                        const atypeColor = atype === "mid_term" ? "bg-primary/10 text-primary" : atype === "exam" ? "bg-accent/10 text-accent" : "bg-secondary/10 text-secondary";
                        return (
                        <tr key={exam.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold">{exam.title}</td>
                          <td className="px-4 py-3 text-primary font-medium">{exam.subject}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${atypeColor}`}>{atypeLabel}</span>
                          </td>
                          <td className="px-4 py-3"><Badge className="text-xs">{exam.class}</Badge></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{teacherMap.get(exam.teacherId) || `Teacher #${exam.teacherId}`}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{(exam as any).questionCount ?? 0}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={exam.isActive ? "success" : "default"} className="text-xs">
                              {exam.isActive ? "Published" : "Draft"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
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
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs px-2 py-1"
                                title="Fix subject name or exam type"
                                onClick={() => {
                                  setReassignExam({ id: exam.id, title: exam.title, subject: exam.subject, assessmentType: atype });
                                  setReassignNewSubject(exam.subject);
                                  setReassignNewType(atype);
                                  setReassignResult(null);
                                }}
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* ── Entrance Exam / Staff Interview Tabs ─────────── */}
      {(activeTab === "Entrance Exam" || activeTab === "Staff Interview") && (() => {
        const isEntrance = activeTab === "Entrance Exam";
        const type = isEntrance ? "entrance" : "interview";
        const level = type; // matches the subject level key
        const icon = isEntrance ? <GraduationCap className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />;
        const label = isEntrance ? "Entrance Exam" : "Staff Interview / Appraisal";
        const classSubjects = subjects.filter(s => s.level === level);
        const classExams = allExams.filter(e => e.class === activeTab);
        const teacherMap = new Map(teachers.map(t => [t.id, t.fullName || t.username]));

        return (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">{icon} {label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage subjects, exams, and view candidate results for this class.
              </p>
            </div>

            {/* Subjects section */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Subjects ({classSubjects.length})
                </h3>
                <Button size="sm" onClick={() => { setNewSubjectLevel(level as any); setSubjectModalOpen(true); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add Subject
                </Button>
              </div>
              {classSubjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No subjects yet. Click "Add Subject" to add subjects for this class.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classSubjects.map(s => (
                    <div key={s.id} className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-3 py-1.5">
                      <span className="text-sm font-medium">{s.name}</span>
                      <button
                        onClick={() => setConfirmDeleteSubjectId(s.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Exams section */}
            <Card className="p-0 overflow-hidden">
              <div className="p-3 border-b border-border/50 bg-muted/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Exams ({classExams.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Teachers create exams from their dashboard. Publish here to make them available to candidates.
                </p>
              </div>
              {classExams.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No exams yet. Teachers can create exams and set the class to "{activeTab}".</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-semibold">Title</th>
                        <th className="px-4 py-2 font-semibold">Subject</th>
                        <th className="px-4 py-2 font-semibold">Teacher</th>
                        <th className="px-4 py-2 font-semibold text-center">Status</th>
                        <th className="px-4 py-2 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classExams.map(exam => (
                        <tr key={exam.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2 font-semibold">{exam.title}</td>
                          <td className="px-4 py-2 text-primary font-medium">{exam.subject}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{teacherMap.get(exam.teacherId) || `Teacher #${exam.teacherId}`}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${exam.isActive ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                              {exam.isActive ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExamStatus({ schoolCode, examId: exam.id, isActive: !exam.isActive })}
                              className="text-xs"
                            >
                              {exam.isActive ? <><PowerOff className="w-3 h-3 mr-1" /> Unpublish</> : <><Power className="w-3 h-3 mr-1" /> Publish</>}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Candidates & Results section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Medal className="w-4 h-4 text-primary" />
                  Candidate Results
                </h3>
                <Button size="sm" onClick={() => fetchSpecialResults(type)} isLoading={isLoadingSpecial}>
                  Load Results
                </Button>
              </div>

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
                          </tr>
                        </thead>
                        <tbody>
                          {specialResultsData.results.map((r: any) => (
                            <tr key={r.resultId} className="border-b border-border/40 transition-colors hover:bg-muted/20">
                              <td className="px-3 py-2 text-center">
                                <span className={`font-bold text-xs ${r.rank === 1 ? "text-warning" : r.rank === 2 ? "text-muted-foreground" : r.rank === 3 ? "text-accent" : "text-muted-foreground"}`}>
                                  #{r.rank}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-semibold">{r.fullName}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground max-w-32">
                                <span className="truncate block" title={r.examTitle}>{r.examTitle}</span>
                              </td>
                              <td className="px-3 py-2 text-center font-medium">{r.score}/{r.totalQuestions}</td>
                              <td className="px-3 py-2 text-center font-bold">
                                <span className={r.percentage >= 70 ? "text-secondary" : r.percentage >= 50 ? "text-warning" : "text-destructive"}>
                                  {r.percentage.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="font-bold text-sm" style={{ color: getGradeColor(r.grade) }}>
                                  {r.grade}
                                </span>
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

            </div>{/* end candidates section */}
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
              {broadsheetData && broadsheetData.students.length > 0 && (<>
                <Button variant="outline" onClick={handleBroadsheetPDF}>
                  <Printer className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" onClick={handleBroadsheetDocx}>
                  <Download className="w-4 h-4 mr-2" /> DOCX
                </Button>
              </>)}
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
                                <span className={score >= 70 ? "text-secondary font-bold" : score >= 50 ? "text-primary" : "text-destructive"}>
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

        const handlePrintStudents = () => {
          const rows = classStudents.map((s, i) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;text-align:center;">${i + 1}</td>
              <td style="padding:8px 12px;font-weight:600;">${s.fullName}</td>
              <td style="padding:8px 12px;font-family:monospace;">${s.username}</td>
              <td style="padding:8px 12px;font-family:monospace;">${s.generatedPassword ?? '—'}</td>
            </tr>`).join('');
          const html = `<!DOCTYPE html><html><head><title>Credentials – ${credentialsClass}</title>
            <style>body{font-family:Arial,sans-serif;margin:24px;color:#111;}h2{margin-bottom:4px;}p{margin-bottom:16px;color:#555;font-size:13px;}
            table{width:100%;border-collapse:collapse;font-size:13px;}thead tr{background:#f3f4f6;}th{padding:8px 12px;text-align:left;font-weight:700;border-bottom:2px solid #d1d5db;}
            tr:nth-child(even){background:#f9fafb;}@media print{body{margin:12px;}}</style></head><body>
            <h2>Student Login Credentials — ${credentialsClass}</h2>
            <p>School: ${schoolCode} &nbsp;|&nbsp; Total: ${classStudents.length} student${classStudents.length !== 1 ? 's' : ''}</p>
            <table><thead><tr><th>#</th><th>Full Name</th><th>Username</th><th>Password</th></tr></thead>
            <tbody>${rows}</tbody></table></body></html>`;
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) { alert('Allow popups for this site to print credentials.'); return; }
          win.document.write(html);
          win.document.close();
          setTimeout(() => { win.focus(); win.print(); }, 400);
        };

        const handlePrintTeachers = () => {
          const rows = teacherCredentials.map((t, i) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;text-align:center;">${i + 1}</td>
              <td style="padding:8px 12px;font-weight:600;">${t.fullName}</td>
              <td style="padding:8px 12px;font-family:monospace;">${t.username}</td>
              <td style="padding:8px 12px;font-family:monospace;">${t.generatedPassword ?? '—'}</td>
            </tr>`).join('');
          const html = `<!DOCTYPE html><html><head><title>Teacher Credentials</title>
            <style>body{font-family:Arial,sans-serif;margin:24px;color:#111;}h2{margin-bottom:4px;}p{margin-bottom:16px;color:#555;font-size:13px;}
            table{width:100%;border-collapse:collapse;font-size:13px;}thead tr{background:#f3f4f6;}th{padding:8px 12px;text-align:left;font-weight:700;border-bottom:2px solid #d1d5db;}
            tr:nth-child(even){background:#f9fafb;}@media print{body{margin:12px;}}</style></head><body>
            <h2>Teacher Login Credentials</h2>
            <p>School: ${schoolCode} &nbsp;|&nbsp; Total: ${teacherCredentials.length} teacher${teacherCredentials.length !== 1 ? 's' : ''}</p>
            <table><thead><tr><th>#</th><th>Full Name</th><th>Username</th><th>Password</th></tr></thead>
            <tbody>${rows}</tbody></table></body></html>`;
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) { alert('Allow popups for this site to print credentials.'); return; }
          win.document.write(html);
          win.document.close();
          setTimeout(() => { win.focus(); win.print(); }, 400);
        };

        const loadTeacherCredentials = async () => {
          if (teacherCredentials.length > 0) return;
          setTeacherCredentialsLoading(true);
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/teachers/credentials`, { credentials: "include" });
            if (res.ok) setTeacherCredentials(await res.json());
          } catch (_) {}
          setTeacherCredentialsLoading(false);
        };

        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Login Credentials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">View and export usernames and passwords.</p>
              </div>
              {/* Students/Teachers toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCredentialsView("students")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${credentialsView === "students" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Students
                </button>
                <button
                  onClick={() => { setCredentialsView("teachers"); loadTeacherCredentials(); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${credentialsView === "teachers" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Teachers
                </button>
              </div>
            </div>

            {/* ── Students ── */}
            {credentialsView === "students" && (
              <>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Select value={credentialsClass} onChange={e => setCredentialsClass(e.target.value)} className="w-44">
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  {classStudents.length > 0 && (
                    <Button variant="outline" onClick={handlePrintStudents}>
                      <Printer className="w-4 h-4 mr-2" /> Export PDF
                    </Button>
                  )}
                </div>
                {credentialsLoading && <Card className="py-12 text-center text-muted-foreground">Loading credentials…</Card>}
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
              </>
            )}

            {/* ── Teachers ── */}
            {credentialsView === "teachers" && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  {teacherCredentials.length > 0 && (
                    <Button variant="outline" onClick={handlePrintTeachers}>
                      <Printer className="w-4 h-4 mr-2" /> Export PDF
                    </Button>
                  )}
                </div>
                {teacherCredentialsLoading && <Card className="py-12 text-center text-muted-foreground">Loading credentials…</Card>}
                {!teacherCredentialsLoading && teacherCredentials.length === 0 && (
                  <Card className="py-12 text-center text-muted-foreground">
                    <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-semibold">No teachers found</p>
                  </Card>
                )}
                {!teacherCredentialsLoading && teacherCredentials.length > 0 && (
                  <Card className="p-0 overflow-hidden">
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
                          {teacherCredentials.map((t, idx) => (
                            <tr key={t.id} className="border-b border-border/50 hover:bg-muted/10">
                              <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold">{t.fullName}</td>
                              <td className="px-4 py-3 font-mono text-sm">{t.username}</td>
                              <td className="px-4 py-3 font-mono text-sm">{t.generatedPassword ?? <span className="text-muted-foreground italic">Reset password to reveal</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Devices Tab (cloud mode) ──────────────────── */}
      {activeTab === "Devices" && (
        <div className="max-w-2xl space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Connected Devices</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Devices active in the last 30 minutes. Auto-refreshes every 30 seconds.
                </p>
              </div>
              {cloudDevicesData != null && (
                <div className="text-right shrink-0">
                  <span className="text-3xl font-bold">{cloudDevicesData.count}</span>
                  <p className="text-xs text-muted-foreground">active</p>
                </div>
              )}
            </div>

            {cloudDevicesData === undefined ? (
              <p className="text-sm text-muted-foreground italic">Loading...</p>
            ) : cloudDevicesData === null ? (
              <p className="text-sm text-muted-foreground italic">Not available in local mode.</p>
            ) : cloudDevicesData.devices.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No active devices in the last 30 minutes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-4 font-semibold">User</th>
                      <th className="py-2 pr-4 font-semibold">Role</th>
                      <th className="py-2 pr-4 font-semibold">IP</th>
                      <th className="py-2 font-semibold">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloudDevicesData.devices.map(d => {
                      const secAgo = (Date.now() - new Date(d.lastSeen).getTime()) / 1000;
                      const DeviceIcon = d.deviceType === "phone" ? Smartphone : d.deviceType === "tablet" ? Tablet : Monitor;
                      const iconColor = secAgo < 90 ? "text-secondary" : secAgo < 300 ? "text-warning" : "text-muted-foreground";
                      return (
                        <tr key={d.deviceId} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-2 pr-3">
                            <DeviceIcon className={`w-4 h-4 ${iconColor}`} />
                          </td>
                          <td className="py-2 pr-4 font-medium">
                            {d.fullName ?? d.username ?? <span className="italic text-muted-foreground">guest</span>}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground capitalize text-xs">{d.role ?? "—"}</td>
                          <td className="py-2 pr-4 font-mono text-muted-foreground text-xs">{d.ipAddress || "—"}</td>
                          <td className="py-2 text-muted-foreground text-xs">
                            {secAgo < 60 ? `${Math.round(secAgo)}s ago` : `${Math.round(secAgo / 60)}m ago`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Local Server Tab ──────────────────────────── */}
      {activeTab === "Local Server" && (() => {
        const API = (import.meta.env.VITE_API_URL as string) || "https://cbtsoftware.onrender.com/api";

        const handleDownloadSchoolData = async () => {
          try {
            const res = await fetch(`${API}/schools/${schoolCode}/sync/local-export`, {
              credentials: "include",
            });
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `cbt-school-${schoolCode}-export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
          } catch (err: any) {
            alert(`Download failed: ${err.message}`);
          }
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

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Connected Devices</h3>
              <p className="text-sm text-muted-foreground">
                Devices that have loaded the app in the last 30 minutes. Refreshes every 30 seconds.
              </p>
              {localDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No devices seen yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2 pr-4 font-semibold">User</th>
                        <th className="py-2 pr-4 font-semibold">Role</th>
                        <th className="py-2 pr-4 font-semibold">IP</th>
                        <th className="py-2 font-semibold">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localDevices.map(d => {
                        const secAgo = (Date.now() - new Date(d.lastSeen).getTime()) / 1000;
                        const dot = secAgo < 90 ? "bg-secondary" : secAgo < 300 ? "bg-warning" : "bg-muted-foreground/40";
                        return (
                          <tr key={d.deviceId} className="border-b border-border/30">
                            <td className="py-1.5 pr-4 font-medium flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                              {d.fullName ?? d.username ?? <span className="italic text-muted-foreground">guest</span>}
                            </td>
                            <td className="py-1.5 pr-4 text-muted-foreground capitalize">{d.role ?? "—"}</td>
                            <td className="py-1.5 pr-4 font-mono text-muted-foreground">{d.ipAddress || "—"}</td>
                            <td className="py-1.5 text-muted-foreground">
                              {secAgo < 60 ? `${Math.round(secAgo)}s ago` : `${Math.round(secAgo / 60)}m ago`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3 border-warning/30 bg-warning/5">
              <h3 className="font-semibold text-warning-foreground">App Display Issues?</h3>
              <p className="text-sm text-warning-foreground/80">
                If the app looks wrong — missing fonts, broken layout, or stuck on an old version — clear the cached app files and reload. This does not affect exam data or results.
              </p>
              <Button
                variant="outline"
                className="border-warning/40 text-warning-foreground hover:bg-warning/10"
                onClick={async () => {
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                  }
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                  }
                  window.location.reload();
                }}
              >
                Clear Cache &amp; Reload
              </Button>
            </Card>
          </div>
        );
      })()}

      </div>{/* end tab content */}

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

      {/* Reassign Exam Modal */}
      <Modal isOpen={reassignExam !== null} onClose={() => { setReassignExam(null); setReassignResult(null); }} title="Fix Exam Subject / Type">
        {reassignExam && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">{reassignExam.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Currently: <strong>{reassignExam.subject}</strong> · <strong>{reassignExam.assessmentType === "mid_term" ? "Mid-term Test" : reassignExam.assessmentType === "exam" ? "Final Exam" : "Class Activity"}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Student CBT scores will be recalculated using the new exam type's scale and moved to the correct column. Raw result data is never deleted.
            </p>
            <div>
              <Label>Subject Name</Label>
              <Input value={reassignNewSubject} onChange={e => setReassignNewSubject(e.target.value)} placeholder="e.g. English Language" />
            </div>
            <div>
              <Label>Exam Type</Label>
              <Select value={reassignNewType} onChange={e => setReassignNewType(e.target.value)}>
                <option value="mid_term">Mid-term Test</option>
                <option value="exam">Final Exam</option>
                <option value="class_activity">Class Activity</option>
              </Select>
            </div>
            {reassignResult && (
              <p className={`text-sm font-medium ${reassignResult.startsWith("Error") ? "text-destructive" : "text-secondary"}`}>
                {reassignResult}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setReassignExam(null); setReassignResult(null); }} className="flex-1">Cancel</Button>
              <Button
                onClick={handleReassignExam}
                isLoading={isReassigning}
                disabled={!reassignNewSubject.trim() || !!reassignResult?.startsWith("Reassigned")}
                className="flex-1"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Apply Fix
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Start New Academic Session">
        <div className="space-y-4 text-muted-foreground">
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-foreground">Next Term Begins</Label>
            <p className="text-xs">This date appears on student report cards. You can update it any time without promoting students.</p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={nextTermBeginsDate}
                onChange={e => setNextTermBeginsDate(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveNextTermDate} isLoading={isSavingNextTermDate} variant="outline" className="shrink-0">
                Save Date
              </Button>
            </div>
            {nextTermBeginsDate && (
              <p className="text-xs text-primary">
                Set to: {new Date(nextTermBeginsDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <hr className="border-border" />
          <p>Are you sure you want to start a new academic session?</p>
          <p className="text-destructive font-bold">This will automatically promote all students to their next class (e.g. KG1 → KG2, Nursery 2 → Pry 1, JSS1 → JSS2). SSS3 students will be graduated.</p>
          <div className="flex justify-end pt-2">
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
      <StudentDetailModal
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        schoolCode={schoolCode}
        onClose={() => setSelectedStudentId(null)}
        onNameUpdated={(name) => {
          setSelectedStudentName(name);
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
        }}
      />
      <ResultDetailModal resultId={selectedResultId} schoolCode={schoolCode} onClose={() => setSelectedResultId(null)} />
      <ConfirmDialog
        variant="standard"
        open={confirmDeleteSubjectId !== null}
        onClose={() => setConfirmDeleteSubjectId(null)}
        onConfirm={() => { handleDeleteSubject(confirmDeleteSubjectId!); setConfirmDeleteSubjectId(null); }}
        title="Delete Subject"
        description="Delete this subject? All associated scores and data will be lost. This cannot be undone."
        confirmLabel="Delete"
      />
    </DashboardLayout>
  );
}