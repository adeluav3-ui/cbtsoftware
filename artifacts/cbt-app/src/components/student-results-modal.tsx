import { useState, useEffect } from "react";
import { Modal, Badge, Button, Input } from "@/components/ui-elements";
import { Loader2, Save, Pencil, X, Plus } from "lucide-react";

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

// ScoreInput defined outside parent to avoid hook identity issues on re-render
interface ScoreInputProps {
    subjectName: string;
    component: string;
    currentScore: number | null;
    maxScore: number;
    label: string;
    editingScores: Record<string, number>;
    saving: string | null;
    onEdit: (key: string, value: number) => void;
    onCancelEdit: (key: string) => void;
    onSave: (subjectName: string, component: string, value: number) => void;
}

function ScoreInput({ subjectName, component, currentScore, maxScore, label, editingScores, saving, onEdit, onCancelEdit, onSave }: ScoreInputProps) {
    const key = `${subjectName}-${component}`;
    const isEditing = key in editingScores;
    const tempValue = isEditing ? editingScores[key] : (currentScore ?? 0);

    if (isEditing) {
        return (
            <div className="flex gap-1 justify-center items-center">
                <Input
                    type="number"
                    min={0}
                    max={maxScore}
                    value={tempValue}
                    onChange={(e) => onEdit(key, Math.min(maxScore, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-16 text-center text-sm"
                />
                <Button size="sm" onClick={() => onSave(subjectName, component, tempValue)} isLoading={saving === key} className="px-2">
                    <Save className="w-3 h-3" />
                </Button>
                <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => onCancelEdit(key)}>
                    <X className="w-3 h-3" />
                </button>
            </div>
        );
    }

    if (currentScore !== null) {
        return (
            <div className="flex items-center justify-center gap-1">
                <span className="font-medium">{currentScore}/{maxScore}</span>
                <button
                    className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                    title="Edit score"
                    onClick={() => onEdit(key, currentScore)}
                >
                    <Pencil className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <Button variant="outline" size="sm" onClick={() => onEdit(key, 0)} className="text-xs">
            Enter {label}
        </Button>
    );
}

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
    const [scheme, setScheme] = useState({ midTermTotal: 20, classActivityTotal: 20, examTotal: 60, gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 });
    // key = "subjectName-component", value = current input value while editing
    const [editingScores, setEditingScores] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState<string | null>(null);

    // Add subject state
    const [showAddSubject, setShowAddSubject] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState("");
    const [isAddingSubject, setIsAddingSubject] = useState(false);
    const [addSubjectError, setAddSubjectError] = useState("");

    useEffect(() => {
        if (isOpen && studentId) {
            fetchResults();
            fetch(`${API_BASE_URL}/schools/${schoolCode}/grading-scheme`, { credentials: "include" })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d) setScheme({ midTermTotal: d.midTermTotal ?? 20, classActivityTotal: d.classActivityTotal ?? 20, examTotal: d.examTotal ?? 60, gradeAMin: d.gradeAMin ?? 70, gradeBMin: d.gradeBMin ?? 60, gradeCMin: d.gradeCMin ?? 50, gradeDMin: d.gradeDMin ?? 40 }); })
                .catch(() => {});
        }
        if (!isOpen) {
            setEditingScores({});
            setShowAddSubject(false);
            setNewSubjectName("");
            setAddSubjectError("");
        }
    }, [isOpen, studentId]);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`,
                { credentials: "include" }
            );
            if (!response.ok) return;
            const data = await response.json();
            if (!Array.isArray(data)) return;

            // Use server-computed totalScore, percentage, and grade directly
            const processedSubjects: SubjectResult[] = data.map((subject: any) => ({
                subjectName: subject.subjectName,
                midTermScore: subject.midTermScore ?? null,
                classActivityScore: subject.classActivityScore ?? null,
                examScore: subject.examScore ?? null,
                totalScore: subject.totalScore ?? null,
                percentage: subject.percentage ?? null,
                grade: subject.grade ?? null,
            }));

            setSubjects(processedSubjects);
            setEditingScores({});

            const completedSubjects = processedSubjects.filter((s) => s.percentage !== null);
            setCompletedSubjectsCount(completedSubjects.length);

            if (completedSubjects.length > 0) {
                const total = completedSubjects.reduce((acc, s) => acc + (s.percentage || 0), 0);
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
        const key = `${subjectName}-${component}`;
        setSaving(key);
        try {
            const response = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subjectName, component, score }),
                    credentials: "include",
                }
            );

            if (response.ok) {
                await fetchResults();
                onScoresUpdated?.();
            }
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setSaving(null);
        }
    };

    const handleAddSubject = async () => {
        const name = newSubjectName.trim();
        if (!name) return;
        setAddSubjectError("");
        setIsAddingSubject(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/init-subject`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subjectName: name }),
                    credentials: "include",
                }
            );

            if (response.ok) {
                setNewSubjectName("");
                setShowAddSubject(false);
                await fetchResults();
                onScoresUpdated?.();
            } else {
                const data = await response.json();
                setAddSubjectError(data.error || "Failed to add subject");
            }
        } catch (err) {
            setAddSubjectError("Network error. Please try again.");
        } finally {
            setIsAddingSubject(false);
        }
    };

    const handleEditScore = (key: string, value: number) => {
        setEditingScores(prev => ({ ...prev, [key]: value }));
    };

    const handleCancelEdit = (key: string) => {
        setEditingScores(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
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
                ) : (
                    <>
                        {subjects.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="mb-3">No subjects added yet for this student.</p>
                                <p className="text-xs">Click "Add Subject" below to start entering scores.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-h-[55vh]">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b border-border">
                                            <th className="px-3 py-3 font-semibold">Subject</th>
                                            <th className="px-3 py-3 font-semibold text-center">Mid-Term<br /><span className="font-normal text-xs text-muted-foreground">/{scheme.midTermTotal}</span></th>
                                            <th className="px-3 py-3 font-semibold text-center">Activity<br /><span className="font-normal text-xs text-muted-foreground">/{scheme.classActivityTotal}</span></th>
                                            <th className="px-3 py-3 font-semibold text-center">Exam<br /><span className="font-normal text-xs text-muted-foreground">/{scheme.examTotal}</span></th>
                                            <th className="px-3 py-3 font-semibold text-center">Total<br /><span className="font-normal text-xs text-muted-foreground">/100</span></th>
                                            <th className="px-3 py-3 font-semibold text-center">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((subject) => {
                                            const isComplete = subject.midTermScore !== null && subject.classActivityScore !== null && subject.examScore !== null;

                                            return (
                                                <tr key={subject.subjectName} className="border-b border-border/50 hover:bg-muted/20">
                                                    <td className="px-3 py-2 font-medium">{subject.subjectName}</td>
                                                    <td className="px-3 py-2">
                                                        <ScoreInput
                                                            subjectName={subject.subjectName}
                                                            component="midterm"
                                                            currentScore={subject.midTermScore}
                                                            maxScore={scheme.midTermTotal}
                                                            label="Mid-Term"
                                                            editingScores={editingScores}
                                                            saving={saving}
                                                            onEdit={handleEditScore}
                                                            onCancelEdit={handleCancelEdit}
                                                            onSave={handleSaveScore}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <ScoreInput
                                                            subjectName={subject.subjectName}
                                                            component="activity"
                                                            currentScore={subject.classActivityScore}
                                                            maxScore={scheme.classActivityTotal}
                                                            label="Activity"
                                                            editingScores={editingScores}
                                                            saving={saving}
                                                            onEdit={handleEditScore}
                                                            onCancelEdit={handleCancelEdit}
                                                            onSave={handleSaveScore}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <ScoreInput
                                                            subjectName={subject.subjectName}
                                                            component="exam"
                                                            currentScore={subject.examScore}
                                                            maxScore={scheme.examTotal}
                                                            label="Exam"
                                                            editingScores={editingScores}
                                                            saving={saving}
                                                            onEdit={handleEditScore}
                                                            onCancelEdit={handleCancelEdit}
                                                            onSave={handleSaveScore}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-bold">
                                                        {isComplete ? `${subject.totalScore}/100` : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {subject.grade ? (
                                                            <Badge className={getGradeColor(subject.grade)}>
                                                                {subject.grade}
                                                            </Badge>
                                                        ) : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Add Subject Row */}
                        {showAddSubject ? (
                            <div className="flex gap-2 items-center pt-1">
                                <Input
                                    value={newSubjectName}
                                    onChange={e => { setNewSubjectName(e.target.value); setAddSubjectError(""); }}
                                    placeholder="Subject name (e.g. Mathematics)"
                                    className="flex-1 text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(); if (e.key === 'Escape') { setShowAddSubject(false); setNewSubjectName(""); } }}
                                    autoFocus
                                />
                                <Button size="sm" onClick={handleAddSubject} isLoading={isAddingSubject} disabled={!newSubjectName.trim()}>
                                    Add
                                </Button>
                                <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => { setShowAddSubject(false); setNewSubjectName(""); setAddSubjectError(""); }}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                                onClick={() => setShowAddSubject(true)}
                            >
                                <Plus className="w-4 h-4" /> Add Subject
                            </button>
                        )}
                        {addSubjectError && (
                            <p className="text-destructive text-xs">{addSubjectError}</p>
                        )}

                        <div className="pt-3 text-xs text-muted-foreground text-center border-t border-border">
                            Click the pencil icon to edit a saved score. Grade appears when all 3 components are entered.
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
