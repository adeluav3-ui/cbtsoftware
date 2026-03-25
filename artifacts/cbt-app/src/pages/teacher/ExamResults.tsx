import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button, Badge, Input } from "@/components/ui-elements";
import { ArrowLeft, Download, Search } from "lucide-react";

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
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string;
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
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${examId}/scores`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId,
                        theoryScore: scores.theory || 0,
                        classActivityScore: scores.activity || 0,
                    }),
                    credentials: "include",
                }
            );

            if (response.ok) {
                await fetchResults(); // Refresh data
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

    const getGradeColor = (grade: string) => {
        switch (grade) {
            case 'A': return 'bg-green-600 text-white';
            case 'B': return 'bg-blue-600 text-white';
            case 'C': return 'bg-yellow-600 text-white';
            case 'D': return 'bg-orange-600 text-white';
            default: return 'bg-red-600 text-white';
        }
    };

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
                <Link href="/teacher" className="inline-flex items-center text-sm text-primary hover:underline mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Exams
                </Link>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">CBT Portion:</span>
                        <span className="ml-2 font-semibold">{gradingScheme.componentCbt} marks</span>
                    </div>
                    {exam.assessmentType !== 'class_activity' && (
                        <div>
                            <span className="text-muted-foreground">Theory Portion:</span>
                            <span className="ml-2 font-semibold">{gradingScheme.componentTheory} marks</span>
                        </div>
                    )}
                    <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-2 font-semibold">{gradingScheme.componentTotal} marks</span>
                    </div>
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
                <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" /> Export
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
                                    <th className="px-4 py-3 font-semibold text-center">Theory Score</th>
                                )}
                                {exam.assessmentType === 'class_activity' && (
                                    <th className="px-4 py-3 font-semibold text-center">Activity Score</th>
                                )}
                                <th className="px-4 py-3 font-semibold text-center">Total</th>
                                <th className="px-4 py-3 font-semibold text-center">%</th>
                                <th className="px-4 py-3 font-semibold text-center">Grade</th>
                                <th className="px-4 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((result) => {
                                const isEditing = editingScores[result.studentId];
                                const currentTheory = isEditing?.theory ?? result.theoryScore;
                                const currentActivity = isEditing?.activity ?? result.classActivityScore;

                                return (
                                    <tr key={result.studentId} className="border-b border-border/50 hover:bg-muted/20">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{result.studentName}</div>
                                            <div className="text-xs text-muted-foreground">{result.studentClass}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="font-semibold">{result.cbtRawScore}/{result.cbtTotal}</div>
                                            <div className="text-xs text-muted-foreground">({result.cbtPercentage.toFixed(0)}% → {result.scaledCbtScore} pts)</div>
                                        </td>

                                        {exam.assessmentType !== 'class_activity' && (
                                            <td className="px-4 py-3 text-center">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={gradingScheme.componentTheory}
                                                        value={currentTheory}
                                                        onChange={(e) => setEditingScores(prev => ({
                                                            ...prev,
                                                            [result.studentId]: { ...prev[result.studentId], theory: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="w-20 text-center mx-auto"
                                                    />
                                                ) : (
                                                    <span className="font-medium">{result.theoryScore}</span>
                                                )}
                                            </td>
                                        )}

                                        {exam.assessmentType === 'class_activity' && (
                                            <td className="px-4 py-3 text-center">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={gradingScheme.componentTotal}
                                                        value={currentActivity}
                                                        onChange={(e) => setEditingScores(prev => ({
                                                            ...prev,
                                                            [result.studentId]: { ...prev[result.studentId], activity: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="w-20 text-center mx-auto"
                                                    />
                                                ) : (
                                                    <span className="font-medium">{result.classActivityScore}</span>
                                                )}
                                            </td>
                                        )}

                                        <td className="px-4 py-3 text-center font-bold">
                                            {result.totalScore}/{result.maxScore}
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold">
                                            {result.percentage}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge className={getGradeColor(result.grade)}>
                                                {result.grade}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveScore(result.studentId)}
                                                        isLoading={saving === result.studentId}
                                                    >
                                                        Save
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
                                                >
                                                    Enter Scores
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        No students found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </DashboardLayout>
    );
}