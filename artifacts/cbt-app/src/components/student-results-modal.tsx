import { useState, useEffect } from "react";
import { Modal, Badge } from "@/components/ui-elements";
import { Loader2 } from "lucide-react";

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
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

export function StudentResultsModal({
    isOpen,
    onClose,
    studentId,
    studentName,
    studentClass,
    schoolCode,
}: StudentResultsModalProps) {
    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [overallAverage, setOverallAverage] = useState(0);

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
            setSubjects(data);

            // Calculate overall average (only from subjects with all components)
            const completedSubjects = data.filter((s: SubjectResult) => s.percentage !== null);
            if (completedSubjects.length > 0) {
                const total = completedSubjects.reduce((acc: number, s: SubjectResult) => acc + (s.percentage || 0), 0);
                setOverallAverage(total / completedSubjects.length);
            }
        } catch (err) {
            console.error("Failed to fetch results", err);
        } finally {
            setIsLoading(false);
        }
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

    const getScoreDisplay = (score: number | null) => {
        if (score === null) return <span className="text-muted-foreground">—</span>;
        return <span className="font-medium">{score}</span>;
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
                        <p className={`text-2xl font-bold ${overallAverage >= 70 ? "text-green-600" : "text-destructive"}`}>
                            {overallAverage.toFixed(1)}%
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
                                    <th className="px-4 py-3 font-semibold text-center">Mid-Term (20%)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Class Activity (20%)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Exam (60%)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Total (100%)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((subject) => (
                                    <tr key={subject.subjectName} className="border-b border-border/50 hover:bg-muted/20">
                                        <td className="px-4 py-3 font-medium">{subject.subjectName}</td>
                                        <td className="px-4 py-3 text-center">{getScoreDisplay(subject.midTermScore)}</td>
                                        <td className="px-4 py-3 text-center">{getScoreDisplay(subject.classActivityScore)}</td>
                                        <td className="px-4 py-3 text-center">{getScoreDisplay(subject.examScore)}</td>
                                        <td className="px-4 py-3 text-center font-bold">
                                            {subject.totalScore !== null ? `${subject.totalScore}/100` : "—"}
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="pt-4 text-xs text-muted-foreground text-center border-t border-border">
                    Scores are automatically calculated when all components are entered
                </div>
            </div>
        </Modal>
    );
}