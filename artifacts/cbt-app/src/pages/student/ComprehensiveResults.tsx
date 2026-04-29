import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button, Badge, Input, Textarea } from "@/components/ui-elements";
import { ArrowLeft, Download, Printer, Upload, Save, User, School } from "lucide-react";
import { format } from "date-fns";

interface SubjectResult {
    subjectName: string;
    midTermScore: number | null;
    classActivityScore: number | null;
    examScore: number | null;
    totalScore: number | null;
    percentage: number | null;
    grade: string | null;
    teacherComment: string | null;
}

interface Student {
    id: number;
    fullName: string;
    username: string;
    class: string;
    profilePicture: string | null;
}

interface SchoolInfo {
    name: string;
    logoUrl: string | null;
    currentTerm: string;
    academicSession: string;
}
export default function ComprehensiveResults() {
    const { user } = useAuth();
    const schoolCode = user?.schoolCode || "";
    const [, setLocation] = useLocation();
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [comment, setComment] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: "",
        logoUrl: null,
        currentTerm: "First Term",
        academicSession: "2025/2026"
    });
    const [selectedClass, setSelectedClass] = useState<string>("JSS1");
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    const CLASSES = ["Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

    useEffect(() => {
        fetchSchoolInfo();
        fetchStudents();
    }, [schoolCode]);

    useEffect(() => {
        if (selectedStudent) {
            fetchStudentResults();
        }
    }, [selectedStudent]);

    const fetchSchoolInfo = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}`, {
                credentials: "include",
            });
            const data = await response.json();
            setSchoolInfo({
                name: data.name || "School",
                logoUrl: data.logoUrl,
                currentTerm: data.currentTerm || "First Term",
                academicSession: data.currentAcademicSession || "2025/2026"
            });
        } catch (err) {
            console.error("Failed to fetch school info", err);
        }
    };


    const fetchStudents = async () => {
        setIsLoadingStudents(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students`, {
                credentials: "include",
            });
            const data = await response.json();
            setStudents(data);
        } catch (err) {
            console.error("Failed to fetch students", err);
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const fetchStudentResults = async () => {
        if (!selectedStudent) return;
        setIsLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${selectedStudent.id}/subject-scores`,
                { credentials: "include" }
            );
            const data = await response.json();
            setSubjects(data);

            // Set existing comment if any
            const existingComment = data.find((s: any) => s.teacherComment)?.teacherComment || "";
            setComment(existingComment);
        } catch (err) {
            console.error("Failed to fetch results", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveComment = async () => {
        if (!selectedStudent) return;

        setIsSavingComment(true);
        try {
            // Save comment for each subject (or you can save per subject)
            for (const subject of subjects) {
                await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${selectedStudent.id}/subject-comment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subjectName: subject.subjectName, comment }),
                    credentials: "include",
                });
            }
            alert("Comment saved successfully!");
        } catch (err) {
            console.error("Failed to save comment", err);
            alert("Failed to save comment");
        } finally {
            setIsSavingComment(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getGradeColor = (grade?: string | null) => {
        if (!grade) return "text-muted-foreground";
        switch (grade) {
            case 'A': return "text-green-600 font-bold";
            case 'B': return "text-blue-600 font-bold";
            case 'C': return "text-yellow-600 font-bold";
            case 'D': return "text-orange-600 font-bold";
            default: return "text-red-600 font-bold";
        }
    };

    const filteredStudents = students.filter(s => s.class === selectedClass);

    const getOverallAverage = () => {
        const completedSubjects = subjects.filter(s => s.percentage !== null);
        if (completedSubjects.length === 0) return 0;
        const total = completedSubjects.reduce((acc, s) => acc + (s.percentage || 0), 0);
        return total / completedSubjects.length;
    };

    const overallAvg = getOverallAverage();
    const overallGrade = overallAvg >= 70 ? 'A' : overallAvg >= 60 ? 'B' : overallAvg >= 50 ? 'C' : overallAvg >= 40 ? 'D' : 'F';

    return (
        <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
            <div className="mb-6">
                <button
                    onClick={() => setLocation("/teacher")}
                    className="inline-flex items-center text-sm text-primary hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold font-display">Comprehensive Results</h1>
                <p className="text-muted-foreground text-sm">View and print student results</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar - Student List */}
                <div className="md:col-span-1">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-3">Select Class</h3>
                        <div className="space-y-1 mb-4">
                            {CLASSES.map(className => (
                                <button
                                    key={className}
                                    onClick={() => setSelectedClass(className)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedClass === className
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted"
                                        }`}
                                >
                                    {className}
                                </button>
                            ))}
                        </div>

                        <h3 className="font-semibold mb-3 mt-4">Students</h3>
                        {isLoadingStudents ? (
                            <div className="text-center py-4 text-sm">Loading...</div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">No students in {selectedClass}</div>
                        ) : (
                            <div className="space-y-2 max-h-100 overflow-y-auto">
                                {filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedStudent?.id === student.id
                                            ? "bg-primary/10 border border-primary/30"
                                            : "hover:bg-muted"
                                            }`}
                                    >
                                        {student.profilePicture ? (
                                            <img src={student.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-muted-foreground" />
                                        )}
                                        <span className="truncate">{student.fullName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Main Content - Results Display */}
                <div className="md:col-span-3">
                    {selectedStudent ? (
                        <Card className="p-6 print:shadow-none">
                            {/* Header with School Logo and Student Info */}
                            {/* Header with School Logo and Student Info */}
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-border print:border-black">
                                <div className="flex items-center gap-3">
                                    {schoolInfo.logoUrl ? (
                                        <img src={schoolInfo.logoUrl} alt="School Logo" className="w-12 h-12 object-contain" />
                                    ) : (
                                        <School className="w-12 h-12 text-muted-foreground" />
                                    )}
                                    <div>
                                        <h2 className="text-xl font-bold">{schoolInfo.name}</h2>
                                        <p className="text-xs text-muted-foreground">
                                            {schoolInfo.currentTerm} • {schoolInfo.academicSession}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {selectedStudent.profilePicture ? (
                                        <img
                                            src={selectedStudent.profilePicture}
                                            alt={selectedStudent.fullName}
                                            className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-primary"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                            <User className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                    )}
                                    <p className="font-semibold mt-2 text-sm">{selectedStudent.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{selectedStudent.class}</p>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="text-center py-12">Loading results...</div>
                            ) : subjects.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">No results available for this student.</div>
                            ) : (
                                <>
                                    {/* Results Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-border print:border-black">
                                                    <th className="px-2 py-2 font-semibold">Subject</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Mid-Term (20)</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Class Activity (20)</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Exam (60)</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Total (100)</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Grade</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map((subject) => {
                                                    const hasMidTerm = subject.midTermScore !== null;
                                                    const hasActivity = subject.classActivityScore !== null;
                                                    const hasExam = subject.examScore !== null;
                                                    const isComplete = hasMidTerm && hasActivity && hasExam;

                                                    return (
                                                        <tr key={subject.subjectName} className="border-b border-border/50 print:border-black/30">
                                                            <td className="px-2 py-2 font-medium">{subject.subjectName}</td>
                                                            <td className="px-2 py-2 text-center">{hasMidTerm ? subject.midTermScore : "—"}</td>
                                                            <td className="px-2 py-2 text-center">{hasActivity ? subject.classActivityScore : "—"}</td>
                                                            <td className="px-2 py-2 text-center">{hasExam ? subject.examScore : "—"}</td>
                                                            <td className="px-2 py-2 text-center font-bold">{isComplete ? `${subject.totalScore}/100` : "—"}</td>
                                                            <td className={`px-2 py-2 text-center ${getGradeColor(subject.grade)}`}>
                                                                {subject.grade || "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="border-t-2 border-border print:border-black">
                                                <tr>
                                                    <td colSpan={4} className="px-2 py-3 font-bold">Overall Average</td>
                                                    <td className="px-2 py-3 text-center font-bold">{overallAvg.toFixed(1)}%</td>
                                                    <td className={`px-2 py-3 text-center ${getGradeColor(overallGrade)}`}>{overallGrade}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Teacher Commentary Section */}
                                    <div className="mt-6 pt-4 border-t border-border print:mt-4 print:pt-2">
                                        <h3 className="font-semibold text-sm mb-2">Teacher's Comment</h3>
                                        {user?.role === "teacher" || user?.role === "school_admin" ? (
                                            <div className="flex gap-2">
                                                <Textarea
                                                    value={comment}
                                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                                                    placeholder="Add a comment or remark for this student..."
                                                    className="flex-1 text-sm"
                                                    rows={3}
                                                />
                                                <Button onClick={handleSaveComment} isLoading={isSavingComment} size="sm">
                                                    <Save className="w-4 h-4 mr-1" /> Save
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">{comment || "No comment added yet."}</p>
                                        )}
                                    </div>

                                    {/* Print Button */}
                                    <div className="mt-6 flex justify-end gap-3 print:hidden">
                                        <Button variant="outline" onClick={handlePrint}>
                                            <Printer className="w-4 h-4 mr-2" /> Print Results
                                        </Button>
                                        <Button variant="outline">
                                            <Download className="w-4 h-4 mr-2" /> Download PDF
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Card>
                    ) : (
                        <Card className="p-12 text-center text-muted-foreground">
                            <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Select a student from the left to view their results</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none, .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          .print\\:border-black {
            border-color: black !important;
          }
          .print\\:border-black\\/30 {
            border-color: rgba(0,0,0,0.3) !important;
          }
          .print\\:mt-4 {
            margin-top: 1rem !important;
          }
          .print\\:pt-2 {
            padding-top: 0.5rem !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          button, .no-print {
            display: none !important;
          }
        }
      `}</style>
        </DashboardLayout>
    );
}