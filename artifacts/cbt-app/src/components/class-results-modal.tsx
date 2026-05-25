import { useState, useEffect, useCallback } from "react";
import { Modal, Button, Label, Select, Input, Badge } from "@/components/ui-elements";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

interface Student {
    id: number;
    fullName: string;
    username: string;
    class: string;
}

interface Subject {
    id: number;
    name: string;
    level: string;
}

interface ScoreRow {
    midterm: string;
    activity: string;
    exam: string;
    saved: boolean;
    saving: boolean;
}

interface ClassResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    schoolCode: string;
    defaultClass?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

const EARLY_YEARS_CLASSES = ["KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5"];

function classToLevel(cls: string): string {
    if (cls === 'KG1' || cls === 'KG2') return 'kg';
    if (cls === 'Nursery 1' || cls === 'Nursery 2') return 'nursery';
    if (cls.startsWith('Pry')) return 'primary';
    if (cls.startsWith('JSS')) return 'junior';
    return 'senior';
}

export function ClassResultsModal({ isOpen, onClose, schoolCode, defaultClass }: ClassResultsModalProps) {
    const [selectedClass, setSelectedClass] = useState(defaultClass || "KG1");
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [students, setStudents] = useState<Student[]>([]);
    const [scores, setScores] = useState<Record<number, ScoreRow>>({});
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [scheme, setScheme] = useState({ midTermTotal: 20, classActivityTotal: 20, examTotal: 60 });

    const fetchSubjects = useCallback(async (cls: string) => {
        setIsLoadingSubjects(true);
        setSubjects([]);
        setSelectedSubject("");
        try {
            const level = classToLevel(cls);
            const res = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/subjects?level=${level}`,
                { credentials: "include" }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) {
                setSubjects(data);
                if (data.length > 0) setSelectedSubject(data[0].name);
            }
        } catch (err) {
            console.error("Failed to fetch subjects", err);
        } finally {
            setIsLoadingSubjects(false);
        }
    }, [schoolCode]);

    const fetchStudents = useCallback(async (cls: string) => {
        setIsLoadingStudents(true);
        setStudents([]);
        setScores({});
        try {
            const res = await fetch(
                `${API_BASE_URL}/schools/${schoolCode}/students?class=${encodeURIComponent(cls)}`,
                { credentials: "include" }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) {
                setStudents(data);
                const initial: Record<number, ScoreRow> = {};
                data.forEach((s: Student) => {
                    initial[s.id] = { midterm: "", activity: "", exam: "", saved: false, saving: false };
                });
                setScores(initial);
            }
        } catch (err) {
            console.error("Failed to fetch students", err);
        } finally {
            setIsLoadingStudents(false);
        }
    }, [schoolCode]);

    // Load existing scores for the selected class + subject
    const loadExistingScores = useCallback(async (studentList: Student[], subject: string) => {
        const updated: Record<number, ScoreRow> = {};
        studentList.forEach(s => {
            updated[s.id] = { midterm: "", activity: "", exam: "", saved: false, saving: false };
        });

        await Promise.all(studentList.map(async (student) => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/schools/${schoolCode}/students/${student.id}/subject-scores`,
                    { credentials: "include" }
                );
                if (!res.ok) return;
                const data = await res.json();
                if (!Array.isArray(data)) return;
                const subjectData = data.find((s: any) => s.subjectName === subject);
                if (subjectData) {
                    updated[student.id] = {
                        midterm: subjectData.midTermScore !== null ? String(subjectData.midTermScore) : "",
                        activity: subjectData.classActivityScore !== null ? String(subjectData.classActivityScore) : "",
                        exam: subjectData.examScore !== null ? String(subjectData.examScore) : "",
                        saved: false,
                        saving: false,
                    };
                }
            } catch (_) {}
        }));

        setScores(updated);
    }, [schoolCode]);

    useEffect(() => {
        if (isOpen) {
            fetchSubjects(selectedClass);
            fetchStudents(selectedClass);
            fetch(`${API_BASE_URL}/schools/${schoolCode}/grading-scheme`, { credentials: "include" })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d) setScheme({ midTermTotal: d.midTermTotal ?? 20, classActivityTotal: d.classActivityTotal ?? 20, examTotal: d.examTotal ?? 60 }); })
                .catch(() => {});
        }
        if (!isOpen) {
            setSaveMessage("");
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchSubjects(selectedClass);
            fetchStudents(selectedClass);
            setSaveMessage("");
        }
    }, [selectedClass]);

    useEffect(() => {
        if (isOpen && selectedSubject && students.length > 0) {
            loadExistingScores(students, selectedSubject);
        }
    }, [selectedSubject, students.length]);

    const handleScoreChange = (studentId: number, field: 'midterm' | 'activity' | 'exam', value: string) => {
        const max = field === 'exam' ? scheme.examTotal : field === 'midterm' ? scheme.midTermTotal : scheme.classActivityTotal;
        const num = parseInt(value);
        const clamped = isNaN(num) ? "" : String(Math.min(max, Math.max(0, num)));
        setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value === "" ? "" : clamped, saved: false } }));
    };

    const saveStudentScore = async (studentId: number) => {
        if (!selectedSubject) return;
        const row = scores[studentId];
        if (!row) return;

        setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: true } }));

        const components: Array<{ component: string; score: number }> = [];
        if (row.midterm !== "") components.push({ component: 'midterm', score: parseInt(row.midterm) });
        if (row.activity !== "") components.push({ component: 'activity', score: parseInt(row.activity) });
        if (row.exam !== "") components.push({ component: 'exam', score: parseInt(row.exam) });

        let success = true;
        if (components.length === 0) {
            const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/init-subject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subjectName: selectedSubject }),
                credentials: "include",
            }).catch(() => null);
            if (!res || (!res.ok && res.status !== 409)) success = false;
        } else {
            for (const { component, score } of components) {
                const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subjectName: selectedSubject, component, score }),
                    credentials: "include",
                }).catch(() => null);
                if (!res || !res.ok) { success = false; break; }
            }
        }

        setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false, saved: success } }));
    };

    const handleSaveAll = async () => {
        setIsSavingAll(true);
        setSaveMessage("");
        await Promise.all(students.map(s => saveStudentScore(s.id)));
        setIsSavingAll(false);
        setSaveMessage("All scores saved successfully!");
        setTimeout(() => setSaveMessage(""), 4000);
    };

    const filledCount = Object.values(scores).filter(
        r => r.midterm !== "" || r.activity !== "" || r.exam !== ""
    ).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload Class Results" size="lg">
            <div className="space-y-4">
                {/* Class & Subject Selectors */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Class</Label>
                        <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            {EARLY_YEARS_CLASSES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label>Subject</Label>
                        {isLoadingSubjects ? (
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                            </div>
                        ) : subjects.length === 0 ? (
                            <p className="text-xs text-yellow-600 mt-2">
                                No subjects configured for this class. Ask the school admin to add subjects.
                            </p>
                        ) : (
                            <Select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </Select>
                        )}
                    </div>
                </div>

                {/* Score Guide */}
                <div className="flex gap-4 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                    <span>Mid-Term: <strong>/20</strong></span>
                    <span>Class Activity: <strong>/20</strong></span>
                    <span>Exam: <strong>/60</strong></span>
                    <span>Total: <strong>/100</strong></span>
                </div>

                {/* Students Table */}
                {isLoadingStudents ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : students.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        No students in {selectedClass} yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[50vh]">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="sticky top-0 bg-background z-10">
                                <tr className="border-b border-border">
                                    <th className="px-2 py-2 font-semibold">Student</th>
                                    <th className="px-2 py-2 font-semibold text-center">Mid-Term<br /><span className="font-normal text-xs text-muted-foreground">/20</span></th>
                                    <th className="px-2 py-2 font-semibold text-center">CA<br /><span className="font-normal text-xs text-muted-foreground">/20</span></th>
                                    <th className="px-2 py-2 font-semibold text-center">Exam<br /><span className="font-normal text-xs text-muted-foreground">/60</span></th>
                                    <th className="px-2 py-2 font-semibold text-center">Total<br /><span className="font-normal text-xs text-muted-foreground">/100</span></th>
                                    <th className="px-2 py-2 font-semibold text-center">Save</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => {
                                    const row = scores[student.id] || { midterm: "", activity: "", exam: "", saved: false, saving: false };
                                    const mt = parseInt(row.midterm) || 0;
                                    const ca = parseInt(row.activity) || 0;
                                    const ex = parseInt(row.exam) || 0;
                                    const hasAny = row.midterm !== "" || row.activity !== "" || row.exam !== "";
                                    const hasAll = row.midterm !== "" && row.activity !== "" && row.exam !== "";
                                    const total = hasAll ? mt + ca + ex : null;

                                    return (
                                        <tr key={student.id} className={`border-b border-border/50 transition-colors ${row.saved ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/20"}`}>
                                            <td className="px-2 py-2">
                                                <div className="font-medium text-sm">{student.fullName}</div>
                                                <div className="text-xs text-muted-foreground">{student.username}</div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    value={row.midterm}
                                                    onChange={e => handleScoreChange(student.id, 'midterm', e.target.value)}
                                                    className="w-14 text-center text-sm"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    value={row.activity}
                                                    onChange={e => handleScoreChange(student.id, 'activity', e.target.value)}
                                                    className="w-14 text-center text-sm"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={60}
                                                    value={row.exam}
                                                    onChange={e => handleScoreChange(student.id, 'exam', e.target.value)}
                                                    className="w-14 text-center text-sm"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {total !== null ? (
                                                    <span className={`font-bold text-sm ${total >= 70 ? "text-green-600" : total >= 50 ? "text-yellow-600" : "text-destructive"}`}>
                                                        {total}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {row.saved ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => saveStudentScore(student.id)}
                                                        isLoading={row.saving}
                                                        disabled={!hasAny || !selectedSubject}
                                                        className="px-2 py-1 text-xs"
                                                    >
                                                        <Save className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                {students.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                            {filledCount} of {students.length} students have scores entered
                        </div>
                        <div className="flex items-center gap-3">
                            {saveMessage && (
                                <span className="text-green-600 text-sm flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" /> {saveMessage}
                                </span>
                            )}
                            <Button
                                onClick={handleSaveAll}
                                isLoading={isSavingAll}
                                disabled={filledCount === 0 || !selectedSubject}
                                size="sm"
                            >
                                <Save className="w-4 h-4 mr-1" /> Save All
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
