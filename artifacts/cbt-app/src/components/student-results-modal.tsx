import { useState, useEffect } from "react";
import { Modal, Badge, Button, Input } from "@/components/ui-elements";
import { Loader2, Save } from "lucide-react";

interface SubjectResult {
    subjectName: string;
    midTermScore: number | null;
    classActivityScore: number | null;
    examScore: number | null;
    totalScore: number | null;
    percentage: number | null;
    grade: string | null;
}

interface StudentResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: number;
    studentName: string;
    studentClass: string;
    schoolCode: string;
    onScoresUpdated?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

export function StudentResultsModal({
    isOpen,
    onClose,
    studentId,
    studentName,
    studentClass,
    schoolCode,
    onScoresUpdated,
}: StudentResultsModalProps) {
    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [overallAverage, setOverallAverage] = useState(0);
    const [completedSubjectsCount, setCompletedSubjectsCount] = useState(0);
    const [editingScores, setEditingScores] = useState<{ [key: string]: { type: string; value: number } }>({});
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && studentId) {
            fetchResults();
        }
    }, [isOpen, studentId]);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`,
                { credentials: "include" }
            );
            const data = await response.json();

            const processedSubjects = data.map((subject: any) => {
                const hasMidTerm = subject.midTermScore !== null && subject.midTermScore !== undefined;
                const hasActivity = subject.classActivityScore !== null && subject.classActivityScore !== undefined;
                const hasExam = subject.examScore !== null && subject.examScore !== undefined;
                const allComponentsEntered = hasMidTerm && hasActivity && hasExam;

                let totalScore = null;
                let percentage = null;
                let grade = null;

                if (allComponentsEntered) {
                    totalScore = (subject.midTermScore || 0) + (subject.classActivityScore || 0) + (subject.examScore || 0);
                    percentage = totalScore;

                    if (percentage >= 70) grade = 'A';
                    else if (percentage >= 60) grade = 'B';
                    else if (percentage >= 50) grade = 'C';
                    else if (percentage >= 40) grade = 'D';
                    else grade = 'F';
                }

                return {
                    subjectName: subject.subjectName,
                    midTermScore: subject.midTermScore,
                    classActivityScore: subject.classActivityScore,
                    examScore: subject.examScore,
                    totalScore: totalScore,
                    percentage: percentage,
                    grade: grade,
                };
            });

            setSubjects(processedSubjects);

            const completedSubjects = processedSubjects.filter((s: SubjectResult) => s.percentage !== null);
            setCompletedSubjectsCount(completedSubjects.length);

            if (completedSubjects.length > 0) {
                const total = completedSubjects.reduce((acc: number, s: SubjectResult) => acc + (s.percentage || 0), 0);
                setOverallAverage(total / completedSubjects.length);
            } else {
                setOverallAverage(0);
            }
        } catch (err) {
            console.error("Failed to fetch results", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveScore = async (subjectName: string, component: string, score: number) => {
        setSaving(`${subjectName}-${component}`);
        try {
            const response = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        subjectName,
                        component,
                        score,
                    }),
                    credentials: "include",
                }
            );

            if (response.ok) {
                await fetchResults();
                onScoresUpdated?.();
                setEditingScores(prev => {
                    const newState = { ...prev };
                    delete newState[`${subjectName}-${component}`];
                    return newState;
                });
            }
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setSaving(null);
        }
    };

    const getScoreDisplay = (score: number | null) => {
        if (score === null) return <span className="text-muted-foreground">—</span>;
        return <span className="font-medium">{score}</span>;
    };

    const getGradeColor = (grade?: string | null) => {
        if (!grade) return "bg-muted text-muted-foreground";
        switch (grade) {
            case 'A': return 'bg-green-600 text-white';
            case 'B': return 'bg-blue-600 text-white';
            case 'C': return 'bg-yellow-600 text-white';
            case 'D': return 'bg-orange-600 text-white';
            default: return 'bg-red-600 text-white';
        }
    };

    const ScoreInput = ({
        subjectName,
        component,
        currentScore,
        maxScore,
        label
    }: {
        subjectName: string;
        component: string;
        currentScore: number | null;
        maxScore: number;
        label: string;
    }) => {
        const isEditing = editingScores[`${subjectName}-${component}`];
        const [tempValue, setTempValue] = useState(currentScore || 0);

        if (currentScore !== null) {
            return (
                <div className="text-center">
                    <span className="font-medium">{currentScore}/{maxScore}</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-1">
                {isEditing ? (
                    <div className="flex gap-1">
                        <Input
                            type="number"
                            min={0}
                            max={maxScore}
                            value={tempValue}
                            onChange={(e) => setTempValue(parseInt(e.target.value) || 0)}
                            className="w-16 text-center text-sm"
                        />
                        <Button
                            size="sm"
                            onClick={() => handleSaveScore(subjectName, component, tempValue)}
                            isLoading={saving === `${subjectName}-${component}`}
                            className="px-2"
                        >
                            <Save className="w-3 h-3" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setEditingScores(prev => ({
                                ...prev,
                                [`${subjectName}-${component}`]: { type: component, value: 0 }
                            }));
                            setTempValue(0);
                        }}
                    >
                        Enter {label}
                    </Button>
                )}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Results: ${studentName}`} size="lg">
            <div className="space-y-4">
                {/* Student Info */}
                <div className="bg-muted/20 p-4 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-semibold text-lg">{studentClass}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Overall Average</p>
                        {completedSubjectsCount > 0 ? (
                            <p className={`text-2xl font-bold ${overallAverage >= 70 ? "text-green-600" : "text-destructive"}`}>
                                {overallAverage.toFixed(1)}%
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">No complete results</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            {completedSubjectsCount} subject{completedSubjectsCount !== 1 ? 's' : ''} completed
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        No results available for this student yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[60vh]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-background">
                                <tr className="border-b border-border">
                                    <th className="px-4 py-3 font-semibold">Subject</th>
                                    <th className="px-4 py-3 font-semibold text-center">Mid-Term (20 marks)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Class Activity (20 marks)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Exam (60 marks)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Total (100 marks)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Grade</th>
                                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((subject) => {
                                    const hasMidTerm = subject.midTermScore !== null;
                                    const hasActivity = subject.classActivityScore !== null;
                                    const hasExam = subject.examScore !== null;
                                    const isComplete = hasMidTerm && hasActivity && hasExam;

                                    return (
                                        <tr key={subject.subjectName} className="border-b border-border/50 hover:bg-muted/20">
                                            <td className="px-4 py-3 font-medium">{subject.subjectName}</td>
                                            <td className="px-4 py-3">
                                                {hasMidTerm ? (
                                                    <div className="text-center font-medium">{subject.midTermScore}/20</div>
                                                ) : (
                                                    <ScoreInput
                                                        subjectName={subject.subjectName}
                                                        component="midterm"
                                                        currentScore={subject.midTermScore}
                                                        maxScore={20}
                                                        label="Mid-Term"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {hasActivity ? (
                                                    <div className="text-center font-medium">{subject.classActivityScore}/20</div>
                                                ) : (
                                                    <ScoreInput
                                                        subjectName={subject.subjectName}
                                                        component="activity"
                                                        currentScore={subject.classActivityScore}
                                                        maxScore={20}
                                                        label="Activity"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {hasExam ? (
                                                    <div className="text-center font-medium">{subject.examScore}/60</div>
                                                ) : (
                                                    <ScoreInput
                                                        subjectName={subject.subjectName}
                                                        component="exam"
                                                        currentScore={subject.examScore}
                                                        maxScore={60}
                                                        label="Exam"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold">
                                                {isComplete ? `${subject.totalScore}/100` : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {subject.grade ? (
                                                    <Badge className={getGradeColor(subject.grade)}>
                                                        {subject.grade}
                                                    </Badge>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isComplete ? (
                                                    <Badge variant="success">Complete</Badge>
                                                ) : (
                                                    <Badge variant="default">In Progress</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="pt-4 text-xs text-muted-foreground text-center border-t border-border">
                    Click "Enter" to add missing scores. Final percentage and grade appear when all three components are entered.
                </div>
            </div>
        </Modal>
    );
}