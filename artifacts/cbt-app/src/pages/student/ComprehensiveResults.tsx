import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button, Textarea } from "@/components/ui-elements";
import { ArrowLeft, Download, Printer, Save, User, School } from "lucide-react";

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

interface TraitRating {
    traitCategory: 'affective' | 'psychomotor';
    traitName: string;
    rating: number | null;
}

const DEFAULT_TRAITS: TraitRating[] = [
    { traitCategory: 'affective', traitName: 'Punctuality', rating: null },
    { traitCategory: 'affective', traitName: 'Neatness', rating: null },
    { traitCategory: 'affective', traitName: 'Politeness', rating: null },
    { traitCategory: 'affective', traitName: 'Honesty', rating: null },
    { traitCategory: 'affective', traitName: 'Obedience', rating: null },
    { traitCategory: 'affective', traitName: 'Perseverance', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Handwriting', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Drawing', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Sports', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Music', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Spoken English', rating: null },
];

const RATING_LABELS: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };

const CLASSES = ["KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

function getOrdinalSuffix(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ComprehensiveResults() {
    const { user } = useAuth();
    const schoolCode = user?.schoolCode || "";
    const API = import.meta.env.VITE_API_URL;
    const [, setLocation] = useLocation();

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [comment, setComment] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: "", logoUrl: null, currentTerm: "First Term", academicSession: "2025/2026"
    });
    const [selectedClass, setSelectedClass] = useState("KG1");
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [scheme, setScheme] = useState({ midTermTotal: 20, classActivityTotal: 20, examTotal: 60, gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 });

    const [position, setPosition] = useState<{ positionInClass: number; totalInClass: number } | null>(null);
    const [traits, setTraits] = useState<TraitRating[]>(DEFAULT_TRAITS.map(t => ({ ...t })));
    const [isSavingTraits, setIsSavingTraits] = useState(false);
    const [attendance, setAttendance] = useState({ timesSchoolOpened: 0, timesPresent: 0 });
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);

    useEffect(() => {
        fetchSchoolInfo();
        fetch(`${API}/schools/${schoolCode}/grading-scheme`, { credentials: "include" })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setScheme({ midTermTotal: d.midTermTotal ?? 20, classActivityTotal: d.classActivityTotal ?? 20, examTotal: d.examTotal ?? 60, gradeAMin: d.gradeAMin ?? 70, gradeBMin: d.gradeBMin ?? 60, gradeCMin: d.gradeCMin ?? 50, gradeDMin: d.gradeDMin ?? 40 }); })
            .catch(() => {});
    }, [schoolCode]);

    useEffect(() => {
        setSelectedStudent(null);
        fetchStudents(selectedClass);
    }, [selectedClass, schoolCode]);

    useEffect(() => {
        if (!selectedStudent) return;
        fetchStudentResults();
        fetchClassPosition();
        fetchTraits();
        fetchAttendance();
    }, [selectedStudent]);

    const fetchSchoolInfo = async () => {
        try {
            const res = await fetch(`${API}/schools/${schoolCode}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setSchoolInfo({ name: data.name || "School", logoUrl: data.logoUrl, currentTerm: data.currentTerm || "First Term", academicSession: data.currentAcademicSession || "2025/2026" });
        } catch {}
    };

    const fetchStudents = async (cls: string) => {
        setIsLoadingStudents(true);
        setStudents([]);
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students?class=${encodeURIComponent(cls)}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) setStudents(data);
        } catch {} finally {
            setIsLoadingStudents(false);
        }
    };

    const fetchStudentResults = async () => {
        if (!selectedStudent) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/subject-scores`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data)) return;
            setSubjects(data);
            setComment(data.find((s: any) => s.teacherComment)?.teacherComment || "");
        } catch {} finally {
            setIsLoading(false);
        }
    };

    const fetchClassPosition = async () => {
        if (!selectedStudent) return;
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/class-position`, { credentials: "include" });
            if (!res.ok) return;
            setPosition(await res.json());
        } catch {}
    };

    const fetchTraits = async () => {
        if (!selectedStudent) return;
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/traits`, { credentials: "include" });
            const data = res.ok ? await res.json() : [];
            setTraits(DEFAULT_TRAITS.map(dt => {
                const found = Array.isArray(data) ? data.find((t: any) => t.traitName === dt.traitName) : null;
                return found ? { ...dt, rating: found.rating } : { ...dt };
            }));
        } catch {
            setTraits(DEFAULT_TRAITS.map(t => ({ ...t })));
        }
    };

    const fetchAttendance = async () => {
        if (!selectedStudent) return;
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/attendance`, { credentials: "include" });
            if (!res.ok) { setAttendance({ timesSchoolOpened: 0, timesPresent: 0 }); return; }
            const data = await res.json();
            setAttendance({ timesSchoolOpened: data.timesSchoolOpened || 0, timesPresent: data.timesPresent || 0 });
        } catch {
            setAttendance({ timesSchoolOpened: 0, timesPresent: 0 });
        }
    };

    const handleSaveComment = async () => {
        if (!selectedStudent) return;
        setIsSavingComment(true);
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/general-comment`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment }), credentials: "include",
            });
            if (!res.ok) throw new Error();
            alert("Comment saved!");
        } catch {
            alert("Failed to save comment");
        } finally {
            setIsSavingComment(false);
        }
    };

    const handleSaveTraits = async () => {
        if (!selectedStudent) return;
        const ratedTraits = traits.filter(t => t.rating !== null);
        if (ratedTraits.length === 0) return;
        setIsSavingTraits(true);
        try {
            await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/traits`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ traits: ratedTraits }),
                credentials: "include",
            });
        } catch {} finally {
            setIsSavingTraits(false);
        }
    };

    const handleSaveAttendance = async () => {
        if (!selectedStudent) return;
        setIsSavingAttendance(true);
        try {
            await fetch(`${API}/schools/${schoolCode}/students/${selectedStudent.id}/attendance`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(attendance), credentials: "include",
            });
        } catch {} finally {
            setIsSavingAttendance(false);
        }
    };

    const getGradeColor = (grade?: string | null) => {
        switch (grade) {
            case 'A': return "text-green-600 font-bold";
            case 'B': return "text-blue-600 font-bold";
            case 'C': return "text-yellow-600 font-bold";
            case 'D': return "text-orange-600 font-bold";
            case 'F': return "text-red-600 font-bold";
            default: return "text-muted-foreground";
        }
    };

    const overallAvg = (() => {
        const done = subjects.filter(s => s.percentage !== null);
        if (!done.length) return 0;
        return done.reduce((a, s) => a + (s.percentage || 0), 0) / done.length;
    })();
    const overallGrade = overallAvg >= scheme.gradeAMin ? 'A' : overallAvg >= scheme.gradeBMin ? 'B' : overallAvg >= scheme.gradeCMin ? 'C' : overallAvg >= scheme.gradeDMin ? 'D' : 'F';

    const canEdit = user?.role === "teacher" || user?.role === "school_admin";
    const affectiveTraits = traits.filter(t => t.traitCategory === 'affective');
    const psychomotorTraits = traits.filter(t => t.traitCategory === 'psychomotor');
    const attendancePct = attendance.timesSchoolOpened > 0
        ? Math.round((attendance.timesPresent / attendance.timesSchoolOpened) * 100) : 0;

    const updateTrait = (traitName: string, category: string, rating: number | null) => {
        setTraits(prev => prev.map(t => t.traitName === traitName && t.traitCategory === category ? { ...t, rating } : t));
    };

    const TraitTable = ({ list, label }: { list: TraitRating[]; label: string }) => (
        <div>
            <h4 className="font-semibold text-xs mb-1 uppercase tracking-wide text-muted-foreground">{label}</h4>
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="border-b border-border">
                        <th className="text-left py-1 font-semibold">Trait</th>
                        <th className="text-center py-1 font-semibold">Rating</th>
                        {canEdit && <th className="py-1 w-28"></th>}
                    </tr>
                </thead>
                <tbody>
                    {list.map(trait => (
                        <tr key={trait.traitName} className="border-b border-border/30">
                            <td className="py-1">{trait.traitName}</td>
                            <td className="text-center py-1">
                                {trait.rating ? (
                                    <span className={`font-semibold ${trait.rating >= 4 ? 'text-green-600' : trait.rating >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {trait.rating} – {RATING_LABELS[trait.rating]}
                                    </span>
                                ) : "—"}
                            </td>
                            {canEdit && (
                                <td className="py-1 text-right print:hidden">
                                    <select
                                        value={trait.rating ?? ""}
                                        onChange={e => updateTrait(trait.traitName, trait.traitCategory, e.target.value === "" ? null : parseInt(e.target.value))}
                                        className="border border-border rounded px-1 py-0.5 text-xs w-24 bg-background"
                                    >
                                        <option value="">—</option>
                                        {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v} – {RATING_LABELS[v]}</option>)}
                                    </select>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
            <div className="mb-6 print:hidden">
                <button onClick={() => setLocation("/teacher")} className="inline-flex items-center text-sm text-primary hover:underline mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold font-display">Comprehensive Results</h1>
                <p className="text-muted-foreground text-sm">View and print student report cards</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="md:col-span-1 print:hidden">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-3 text-sm">Select Class</h3>
                        <div className="space-y-0.5 mb-4 max-h-60 overflow-y-auto">
                            {CLASSES.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => setSelectedClass(cls)}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedClass === cls ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                >
                                    {cls}
                                </button>
                            ))}
                        </div>

                        <h3 className="font-semibold mb-2 text-sm">Students</h3>
                        {isLoadingStudents ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                        ) : students.length === 0 ? (
                            <div className="text-center py-4 text-xs text-muted-foreground">No students in {selectedClass}</div>
                        ) : (
                            <div className="space-y-1 max-h-80 overflow-y-auto">
                                {students.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedStudent?.id === student.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                                    >
                                        {student.profilePicture ? (
                                            <img src={student.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="truncate">{student.fullName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Report Card */}
                <div className="md:col-span-3">
                    {selectedStudent ? (
                        <Card className="p-6" id="printable-report">
                            {/* School Header */}
                            <div className="flex justify-between items-start mb-4 pb-4 border-b-2 border-border">
                                <div className="flex items-center gap-3">
                                    {schoolInfo.logoUrl ? (
                                        <img src={schoolInfo.logoUrl} alt="School Logo" className="w-14 h-14 object-contain" />
                                    ) : (
                                        <School className="w-14 h-14 text-muted-foreground" />
                                    )}
                                    <div>
                                        <h2 className="text-lg font-bold">{schoolInfo.name}</h2>
                                        <p className="text-xs text-muted-foreground">{schoolInfo.currentTerm} • {schoolInfo.academicSession}</p>
                                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Student Report Card</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {selectedStudent.profilePicture ? (
                                        <img src={selectedStudent.profilePicture} alt={selectedStudent.fullName} className="w-16 h-16 rounded-full object-cover border-2 border-primary ml-auto" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center ml-auto">
                                            <User className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                    )}
                                    <p className="font-semibold mt-1 text-sm">{selectedStudent.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{selectedStudent.class}</p>
                                    {position && (
                                        <p className="text-xs font-bold text-primary mt-0.5">
                                            Position: {getOrdinalSuffix(position.positionInClass)} / {position.totalInClass}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Attendance */}
                            <div className="mb-4 p-2.5 bg-muted/30 rounded-lg flex flex-wrap items-center gap-3 text-xs">
                                <span className="font-semibold uppercase tracking-wide text-muted-foreground">Attendance:</span>
                                {canEdit ? (
                                    <>
                                        <label className="flex items-center gap-1">
                                            Days school opened:
                                            <input type="number" min={0} value={attendance.timesSchoolOpened}
                                                onChange={e => setAttendance(a => ({ ...a, timesSchoolOpened: parseInt(e.target.value) || 0 }))}
                                                className="w-14 border border-border rounded px-1 py-0.5 text-center bg-background ml-1"
                                            />
                                        </label>
                                        <label className="flex items-center gap-1">
                                            Times present:
                                            <input type="number" min={0} value={attendance.timesPresent}
                                                onChange={e => setAttendance(a => ({ ...a, timesPresent: parseInt(e.target.value) || 0 }))}
                                                className="w-14 border border-border rounded px-1 py-0.5 text-center bg-background ml-1"
                                            />
                                        </label>
                                        <span className="text-muted-foreground">({attendancePct}%)</span>
                                        <Button size="sm" variant="outline" onClick={handleSaveAttendance} isLoading={isSavingAttendance} className="h-6 px-2 text-xs print:hidden">
                                            <Save className="w-3 h-3 mr-1" /> Save
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span>Opened: <strong>{attendance.timesSchoolOpened}</strong></span>
                                        <span>Present: <strong>{attendance.timesPresent}</strong></span>
                                        <span>Rate: <strong>{attendancePct}%</strong></span>
                                    </>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="text-center py-12 text-muted-foreground">Loading results...</div>
                            ) : subjects.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">No results available for this student.</div>
                            ) : (
                                <>
                                    {/* Academic Results Table */}
                                    <div className="overflow-x-auto mb-5">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-muted/40 border-b border-border">
                                                    <th className="px-2 py-2 font-semibold">Subject</th>
                                                    <th className="px-2 py-2 font-semibold text-center">Mid-Term<br /><span className="font-normal text-xs">/{scheme.midTermTotal}</span></th>
                                                    <th className="px-2 py-2 font-semibold text-center">CA<br /><span className="font-normal text-xs">/{scheme.classActivityTotal}</span></th>
                                                    <th className="px-2 py-2 font-semibold text-center">Exam<br /><span className="font-normal text-xs">/{scheme.examTotal}</span></th>
                                                    <th className="px-2 py-2 font-semibold text-center">Total<br /><span className="font-normal text-xs">/100</span></th>
                                                    <th className="px-2 py-2 font-semibold text-center">Grade</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map(subject => {
                                                    const isComplete = subject.midTermScore !== null && subject.classActivityScore !== null && subject.examScore !== null;
                                                    return (
                                                        <tr key={subject.subjectName} className="border-b border-border/40 hover:bg-muted/10">
                                                            <td className="px-2 py-1.5 font-medium">{subject.subjectName}</td>
                                                            <td className="px-2 py-1.5 text-center">{subject.midTermScore ?? "—"}</td>
                                                            <td className="px-2 py-1.5 text-center">{subject.classActivityScore ?? "—"}</td>
                                                            <td className="px-2 py-1.5 text-center">{subject.examScore ?? "—"}</td>
                                                            <td className="px-2 py-1.5 text-center font-bold">{isComplete ? `${subject.totalScore}/100` : "—"}</td>
                                                            <td className={`px-2 py-1.5 text-center ${getGradeColor(subject.grade)}`}>{subject.grade || "—"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="border-t-2 border-border bg-muted/20">
                                                <tr>
                                                    <td colSpan={4} className="px-2 py-2 font-bold">Overall Average</td>
                                                    <td className="px-2 py-2 text-center font-bold">{overallAvg.toFixed(1)}%</td>
                                                    <td className={`px-2 py-2 text-center ${getGradeColor(overallGrade)}`}>{overallGrade}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Affective & Psychomotor Domains */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <TraitTable list={affectiveTraits} label="Affective Domain" />
                                        <TraitTable list={psychomotorTraits} label="Psychomotor Domain" />
                                    </div>
                                    {canEdit && (
                                        <div className="flex justify-end mb-4 print:hidden">
                                            <Button size="sm" variant="outline" onClick={handleSaveTraits} isLoading={isSavingTraits}>
                                                <Save className="w-3 h-3 mr-1" /> Save Traits
                                            </Button>
                                        </div>
                                    )}

                                    {/* Teacher's Comment */}
                                    <div className="pt-4 border-t border-border">
                                        <h3 className="font-semibold text-sm mb-2">Teacher's Comment</h3>
                                        {canEdit && (
                                            <div className="flex gap-2 mb-2 print:hidden">
                                                <Textarea
                                                    value={comment}
                                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                                                    placeholder="Add a comment or remark for this student..."
                                                    className="flex-1 text-sm"
                                                    rows={2}
                                                />
                                                <Button onClick={handleSaveComment} isLoading={isSavingComment} size="sm">
                                                    <Save className="w-4 h-4 mr-1" /> Save
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-sm italic text-muted-foreground border border-border/40 rounded px-3 py-2 min-h-8">
                                            {comment || "No comment added yet."}
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-5 flex justify-end gap-3 print:hidden">
                                        <Button variant="outline" onClick={() => window.print()}>
                                            <Printer className="w-4 h-4 mr-2" /> Print
                                        </Button>
                                        <Button variant="outline" onClick={() => window.print()}>
                                            <Download className="w-4 h-4 mr-2" /> Save as PDF
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Card>
                    ) : (
                        <Card className="p-12 text-center text-muted-foreground">
                            <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Select a student to view their report card</p>
                        </Card>
                    )}
                </div>
            </div>

            <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border: none !important;
          }
          .print\\:hidden { display: none !important; }
          select { display: none !important; }
          input[type="number"] { border: none; background: transparent; }
        }
      `}</style>
        </DashboardLayout>
    );
}
