import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button, Badge, Input } from "@/components/ui-elements";
import { ArrowLeft, Download, Search, Save } from "lucide-react";

interface StudentResult {
    studentId: number;
    studentName: string;
    studentClass: string;
    cbtRawScore: number;
    cbtTotal: number;
    cbtPercentage: number;
    scaledCbtScore: number;
    theoryScore: number;
    classActivityScore: number;
    componentScore: number;
    maxScore: number;
    submittedAt: string;
}

interface ExamResultsData {
    exam: {
        id: number;
        title: string;
        subject: string;
        assessmentType: string;
    };
    gradingScheme: {
        componentTotal: number;
        componentCbt: number;
        componentTheory: number;
    };
    results: StudentResult[];
}

export default function ExamResults() {
    const { examId: rawExamId } = useParams();
    const examId = parseInt(rawExamId || "0");
    const { user } = useAuth();
    const schoolCode = user?.schoolCode || "";
    const [, setLocation] = useLocation();

    const [data, setData] = useState<ExamResultsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingScores, setEditingScores] = useState<{ [key: number]: { theory?: number; activity?: number } }>({});
    const [saving, setSaving] = useState<number | null>(null);

    useEffect(() => {
        fetchResults();
    }, [examId]);

    const handleExport = () => {
        if (!data) return;
        const { exam, results, gradingScheme } = data;
        const headers = ["Student Name", "Class", "CBT Score", "CBT Total", "CBT %", `Scaled CBT (/${gradingScheme.componentCbt})`, exam.assessmentType === 'class_activity' ? "Activity Score" : "Theory Score", `Total (/${gradingScheme.componentTotal})`];
        const rows = results.map(r => [
            r.studentName,
            r.studentClass,
            r.cbtRawScore,
            r.cbtTotal,
            r.cbtPercentage.toFixed(1) + "%",
            r.scaledCbtScore,
            exam.assessmentType === 'class_activity' ? r.classActivityScore : r.theoryScore,
            r.componentScore,
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exam.title.replace(/\s+/g, "_")}_results.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${examId}/results`,
                { credentials: "include" }
            );
            const data = await response.json();
            setData(data);
        } catch (err) {
            console.error("Failed to fetch results", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveScore = async (studentId: number) => {
        const scores = editingScores[studentId];
        if (!scores) return;

        setSaving(studentId);
        try {
            const body: any = { studentId };

            if (data?.exam.assessmentType === 'class_activity') {
                body.classActivityScore = scores.activity || 0;
            } else {
                body.theoryScore = scores.theory || 0;
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${examId}/scores`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    credentials: "include",
                }
            );

            if (response.ok) {
                await fetchResults();
                setEditingScores(prev => {
                    const newState = { ...prev };
                    delete newState[studentId];
                    return newState;
                });
            }
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setSaving(null);
        }
    };

    const filteredResults = data?.results.filter(r =>
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getAssessmentTypeLabel = (type: string) => {
        switch (type) {
            case 'mid_term': return 'Mid-Term Test';
            case 'exam': return 'Final Exam';
            case 'class_activity': return 'Class Activity';
            default: return type;
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
                <div className="flex justify-center items-center h-64">Loading results...</div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
                <div className="text-center py-12">No results found for this exam.</div>
            </DashboardLayout>
        );
    }

    const { exam, gradingScheme, results } = data;

    return (
        <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
            <div className="mb-6">
                <button
                    onClick={() => setLocation("/teacher")}
                    className="inline-flex items-center text-sm text-primary hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Exams
                </button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold font-display">{exam.title}</h1>
                        <p className="text-muted-foreground">
                            {exam.subject} • {getAssessmentTypeLabel(exam.assessmentType)}
                        </p>
                    </div>
                    <Badge variant="default" className="text-sm">
                        Total: {gradingScheme.componentTotal} marks
                    </Badge>
                </div>
            </div>

            {/* Grading Scheme Info */}
            <Card className="p-4 mb-6 bg-muted/30">
                <div className="text-sm">
                    {exam.assessmentType === 'class_activity' ? (
                        <p>Class Activity: Enter the score out of {gradingScheme.componentTotal} marks</p>
                    ) : (
                        <p>
                            CBT Score: {gradingScheme.componentCbt} marks •
                            Theory Score: {gradingScheme.componentTheory} marks •
                            Total: {gradingScheme.componentTotal} marks
                        </p>
                    )}
                </div>
            </Card>

            {/* Search */}
            <div className="mb-6 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
            </div>

            {/* Results Table */}
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                                <th className="px-4 py-3 font-semibold">Student</th>
                                <th className="px-4 py-3 font-semibold text-center">CBT Score</th>
                                {exam.assessmentType !== 'class_activity' && (
                                    <th className="px-4 py-3 font-semibold text-center">Theory Score (to enter)</th>
                                )}
                                {exam.assessmentType === 'class_activity' && (
                                    <th className="px-4 py-3 font-semibold text-center">Activity Score (to enter)</th>
                                )}
                                <th className="px-4 py-3 font-semibold text-center">Total (Current)</th>
                                <th className="px-4 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((result) => {
                                const isEditing = editingScores[result.studentId];
                                const isTheoryLocked = result.theoryScore !== null && result.theoryScore !== undefined;
                                const isActivityLocked = result.classActivityScore > 0 && result.classActivityScore !== null;

                                return (
                                    <tr key={result.studentId} className="border-b border-border/50 hover:bg-muted/20">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{result.studentName}</div>
                                            <div className="text-xs text-muted-foreground">{result.studentClass}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="font-semibold">{result.cbtRawScore}/{result.cbtTotal}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Scaled: {result.scaledCbtScore}/{gradingScheme.componentCbt}
                                            </div>
                                        </td>

                                        {exam.assessmentType !== 'class_activity' && (
                                            <td className="px-4 py-3 text-center">
                                                {isTheoryLocked ? (
                                                    <span className="text-secondary font-medium">✓ {result.theoryScore} entered</span>
                                                ) : isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={gradingScheme.componentTheory}
                                                        value={isEditing.theory || result.theoryScore}
                                                        onChange={(e) => setEditingScores(prev => ({
                                                            ...prev,
                                                            [result.studentId]: { ...prev[result.studentId], theory: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="w-24 text-center mx-auto"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-muted-foreground">
                                                        Not entered
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        {exam.assessmentType === 'class_activity' && (
                                            <td className="px-4 py-3 text-center">
                                                {isActivityLocked ? (
                                                    <span className="text-secondary font-medium">✓ {result.classActivityScore} entered</span>
                                                ) : isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={gradingScheme.componentTotal}
                                                        value={isEditing.activity || result.classActivityScore}
                                                        onChange={(e) => setEditingScores(prev => ({
                                                            ...prev,
                                                            [result.studentId]: { ...prev[result.studentId], activity: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="w-24 text-center mx-auto"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-muted-foreground">
                                                        Not entered
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        <td className="px-4 py-3 text-center font-bold">
                                            {result.componentScore}/{gradingScheme.componentTotal}
                                        </td>

                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveScore(result.studentId)}
                                                        isLoading={saving === result.studentId}
                                                    >
                                                        <Save className="w-3 h-3 mr-1" /> Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setEditingScores(prev => {
                                                                const newState = { ...prev };
                                                                delete newState[result.studentId];
                                                                return newState;
                                                            });
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditingScores(prev => ({
                                                            ...prev,
                                                            [result.studentId]: {
                                                                theory: result.theoryScore,
                                                                activity: result.classActivityScore,
                                                            }
                                                        }));
                                                    }}
                                                    disabled={exam.assessmentType !== 'class_activity' ? isTheoryLocked : isActivityLocked}
                                                >
                                                    {exam.assessmentType !== 'class_activity'
                                                        ? (isTheoryLocked ? "Score Locked" : "Enter Theory Score")
                                                        : (isActivityLocked ? "Score Locked" : "Enter Activity Score")}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                        No students found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="mt-4 text-xs text-muted-foreground text-center">
                {exam.assessmentType === 'class_activity'
                    ? "Enter class activity scores above. Final percentage will appear in the student's overall results when all components are complete."
                    : "CBT scores are auto-graded. Enter theory scores above. Final percentage will appear in the student's overall results when all components are complete."}
                <p className="mt-1 text-warning">✓ Scores that have been entered cannot be changed. Contact admin if correction is needed.</p>
            </div>
        </DashboardLayout>
    );
}