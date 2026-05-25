import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button } from "@/components/ui-elements";
import { ArrowLeft, Printer, User, School, BookOpen } from "lucide-react";
import { useLocation } from "wouter";

interface SubjectResult {
    subjectName: string;
    midTermScore: number | null;
    classActivityScore: number | null;
    examScore: number | null;
    totalScore: number | null;
    percentage: number | null;
    grade: string | null;
}

interface SchoolInfo {
    name: string;
    logoUrl: string | null;
    currentTerm: string;
    academicSession: string;
}

interface GradingScheme {
    midTermTotal: number;
    classActivityTotal: number;
    examTotal: number;
    gradeAMin: number;
    gradeBMin: number;
    gradeCMin: number;
    gradeDMin: number;
}

const DEFAULT_SCHEME: GradingScheme = { midTermTotal: 20, classActivityTotal: 20, examTotal: 60, gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 };

export default function MyResults() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const schoolCode = user?.schoolCode || "";

    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: "",
        logoUrl: null,
        currentTerm: "First Term",
        academicSession: "2025/2026",
    });
    const [scheme, setScheme] = useState<GradingScheme>(DEFAULT_SCHEME);

    useEffect(() => {
        if (!schoolCode || !user?.id) return;
        fetchSchoolInfo();
        fetchResults();
        fetchScheme();
    }, [schoolCode, user?.id]);

    const fetchSchoolInfo = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}`, {
                credentials: "include",
            });
            if (!res.ok) return;
            const data = await res.json();
            setSchoolInfo({
                name: data.name || "School",
                logoUrl: data.logoUrl,
                currentTerm: data.currentTerm || "First Term",
                academicSession: data.currentAcademicSession || "2025/2026",
            });
        } catch (_) {}
    };

    const fetchScheme = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/grading-scheme`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (data) setScheme({ midTermTotal: data.midTermTotal ?? 20, classActivityTotal: data.classActivityTotal ?? 20, examTotal: data.examTotal ?? 60, gradeAMin: data.gradeAMin ?? 70, gradeBMin: data.gradeBMin ?? 60, gradeCMin: data.gradeCMin ?? 50, gradeDMin: data.gradeDMin ?? 40 });
        } catch (_) {}
    };

    const fetchResults = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${user.id}/subject-scores`,
                { credentials: "include" }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data)) return;
            setSubjects(data);
        } catch (_) {}
        finally {
            setIsLoading(false);
        }
    };

    const completedSubjects = subjects.filter(s => s.percentage !== null);
    const overallAvg = completedSubjects.length > 0
        ? completedSubjects.reduce((acc, s) => acc + (s.percentage || 0), 0) / completedSubjects.length
        : 0;
    const overallGrade = overallAvg >= scheme.gradeAMin ? 'A' : overallAvg >= scheme.gradeBMin ? 'B' : overallAvg >= scheme.gradeCMin ? 'C' : overallAvg >= scheme.gradeDMin ? 'D' : 'F';

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

    return (
        <DashboardLayout allowedRoles={["student"]}>
            <div className="mb-6">
                <button
                    onClick={() => setLocation("/student")}
                    className="inline-flex items-center text-sm text-primary hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold font-display">My Term Results</h1>
                <p className="text-muted-foreground text-sm">Your comprehensive academic results for this term</p>
            </div>

            <Card className="p-6 print:shadow-none">
                {/* School Header */}
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-border print:border-black">
                    <div className="flex items-center gap-3">
                        {schoolInfo.logoUrl ? (
                            <img src={schoolInfo.logoUrl} alt="School Logo" className="w-14 h-14 object-contain" />
                        ) : (
                            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                                <School className="w-7 h-7 text-primary" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold">{schoolInfo.name}</h2>
                            <p className="text-xs text-muted-foreground">
                                {schoolInfo.currentTerm} • {schoolInfo.academicSession}
                            </p>
                        </div>
                    </div>

                    {/* Student Info */}
                    <div className="text-right">
                        {user?.profilePicture ? (
                            <img
                                src={user.profilePicture ?? undefined}
                                alt={user.fullName ?? ""}
                                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-primary"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                <User className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                        <p className="font-semibold mt-1 text-sm">{user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user?.class}</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-16 text-muted-foreground">Loading your results…</div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold">No results available yet</p>
                        <p className="text-sm mt-1">Your teachers are still entering scores. Check back later.</p>
                    </div>
                ) : (
                    <>
                        {/* Results Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b-2 border-border print:border-black">
                                        <th className="px-2 py-2 font-semibold">Subject</th>
                                        <th className="px-2 py-2 font-semibold text-center">Mid-Term<br /><span className="font-normal text-xs">({scheme.midTermTotal})</span></th>
                                        <th className="px-2 py-2 font-semibold text-center">Class Activity<br /><span className="font-normal text-xs">({scheme.classActivityTotal})</span></th>
                                        <th className="px-2 py-2 font-semibold text-center">Exam<br /><span className="font-normal text-xs">({scheme.examTotal})</span></th>
                                        <th className="px-2 py-2 font-semibold text-center">Total<br /><span className="font-normal text-xs">(100)</span></th>
                                        <th className="px-2 py-2 font-semibold text-center">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map(subject => {
                                        const hasMidTerm = subject.midTermScore !== null;
                                        const hasActivity = subject.classActivityScore !== null;
                                        const hasExam = subject.examScore !== null;
                                        const isComplete = hasMidTerm && hasActivity && hasExam;

                                        return (
                                            <tr key={subject.subjectName} className="border-b border-border/50 print:border-black/20">
                                                <td className="px-2 py-2 font-medium">{subject.subjectName}</td>
                                                <td className="px-2 py-2 text-center">{hasMidTerm ? subject.midTermScore : "—"}</td>
                                                <td className="px-2 py-2 text-center">{hasActivity ? subject.classActivityScore : "—"}</td>
                                                <td className="px-2 py-2 text-center">{hasExam ? subject.examScore : "—"}</td>
                                                <td className="px-2 py-2 text-center font-bold">
                                                    {isComplete ? `${subject.totalScore}/100` : "—"}
                                                </td>
                                                <td className={`px-2 py-2 text-center ${getGradeColor(subject.grade)}`}>
                                                    {subject.grade || "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {completedSubjects.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-border print:border-black">
                                            <td colSpan={4} className="px-2 py-3 font-bold">Overall Average</td>
                                            <td className="px-2 py-3 text-center font-bold">{overallAvg.toFixed(1)}%</td>
                                            <td className={`px-2 py-3 text-center ${getGradeColor(overallGrade)}`}>{overallGrade}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {subjects.some(s => s.percentage === null) && (
                            <p className="text-xs text-muted-foreground mt-3 italic">
                                "—" means your teacher hasn't entered that score yet. Check back when all scores are complete.
                            </p>
                        )}

                        {/* Print */}
                        <div className="mt-6 flex justify-end print:hidden">
                            <Button variant="outline" onClick={() => window.print()}>
                                <Printer className="w-4 h-4 mr-2" /> Print Results
                            </Button>
                        </div>
                    </>
                )}
            </Card>

            <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none { position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 20px; }
          .print\\:hidden { display: none !important; }
          button { display: none !important; }
        }
      `}</style>
        </DashboardLayout>
    );
}
