import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button, Textarea } from "@/components/ui-elements";
import { getGradeColor } from "@/lib/grade";
import { ArrowLeft, Download, Printer, Save, User, School, ChevronDown, ChevronUp } from "lucide-react";

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
    nextTermBegins: string | null;
}

interface TraitRating {
    traitCategory: 'cognitive' | 'affective' | 'psychomotor';
    traitName: string;
    rating: number | null;
}

const DEFAULT_TRAITS: TraitRating[] = [
    // Cognitive domain
    { traitCategory: 'cognitive', traitName: 'Verbal Reasoning', rating: null },
    { traitCategory: 'cognitive', traitName: 'Numerical Ability', rating: null },
    { traitCategory: 'cognitive', traitName: 'Memory & Recall', rating: null },
    { traitCategory: 'cognitive', traitName: 'Problem Solving', rating: null },
    { traitCategory: 'cognitive', traitName: 'Creativity', rating: null },
    // Affective domain
    { traitCategory: 'affective', traitName: 'Punctuality', rating: null },
    { traitCategory: 'affective', traitName: 'Neatness', rating: null },
    { traitCategory: 'affective', traitName: 'Politeness', rating: null },
    { traitCategory: 'affective', traitName: 'Honesty', rating: null },
    { traitCategory: 'affective', traitName: 'Obedience', rating: null },
    { traitCategory: 'affective', traitName: 'Perseverance', rating: null },
    // Psychomotor domain
    { traitCategory: 'psychomotor', traitName: 'Handwriting', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Drawing', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Sports', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Music', rating: null },
    { traitCategory: 'psychomotor', traitName: 'Spoken English', rating: null },
];

const RATING_LABELS: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };

const AUTO_COMMENTS = [
    "An excellent student with commendable academic performance. Keep it up!",
    "A very good student. With more dedication, you can reach the top.",
    "Good performance this term. Work harder for even better results next term.",
    "A satisfactory performance. More effort is needed in the next term.",
    "Your performance needs significant improvement. Please work harder.",
    "This student is intelligent but needs to be more serious with studies.",
    "A hardworking student who is making steady progress. Well done!",
    "You have the potential to do better. Apply yourself more diligently.",
    "An improvement in performance is observed. Keep working hard.",
    "Outstanding academic performance! A role model for others.",
    "Needs more focus and dedication. Please study harder next term.",
    "A brilliant student who must work harder to maintain this standard.",
    "Good conduct and academic performance. Sustain this effort.",
    "Your results show you can do better. Do not relent in your studies.",
    "A promising student. With consistency and hard work, you will excel.",
];

const CLASSES = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];


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
    const [showAutoComments, setShowAutoComments] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: "", logoUrl: null, currentTerm: "First Term", academicSession: "2025/2026", nextTermBegins: null
    });
    const [nextTermBeginsEdit, setNextTermBeginsEdit] = useState("");
    const [isSavingNextTerm, setIsSavingNextTerm] = useState(false);
    const [selectedClass, setSelectedClass] = useState("KG1");
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [scheme, setScheme] = useState({ midTermTotal: 20, classActivityTotal: 20, examTotal: 60, gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 });

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
        fetchTraits();
        fetchAttendance();
    }, [selectedStudent]);

    const fetchSchoolInfo = async () => {
        try {
            const res = await fetch(`${API}/schools/${schoolCode}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            const info: SchoolInfo = {
                name: data.name || "School",
                logoUrl: data.logoUrl,
                currentTerm: data.currentTerm || "First Term",
                academicSession: data.currentAcademicSession || "2025/2026",
                nextTermBegins: data.nextTermBegins || null,
            };
            setSchoolInfo(info);
            setNextTermBeginsEdit(info.nextTermBegins || "");
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

    const handleSaveNextTermBegins = async () => {
        setIsSavingNextTerm(true);
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/next-term-begins`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nextTermBegins: nextTermBeginsEdit || null }),
                credentials: "include",
            });
            if (!res.ok) throw new Error();
            setSchoolInfo(prev => ({ ...prev, nextTermBegins: nextTermBeginsEdit || null }));
        } catch {
            alert("Failed to save next term date");
        } finally {
            setIsSavingNextTerm(false);
        }
    };

    const gradeStyle = (grade?: string | null): React.CSSProperties =>
        grade ? { color: getGradeColor(grade) } : {};

    const overallAvg = (() => {
        const done = subjects.filter(s => s.percentage !== null);
        if (!done.length) return 0;
        return done.reduce((a, s) => a + (s.percentage || 0), 0) / done.length;
    })();
    const overallGrade = overallAvg >= scheme.gradeAMin ? 'A' : overallAvg >= scheme.gradeBMin ? 'B' : overallAvg >= scheme.gradeCMin ? 'C' : overallAvg >= scheme.gradeDMin ? 'D' : 'F';

    const canEdit = user?.role === "teacher" || user?.role === "school_admin";
    const cognitiveTraits = traits.filter(t => t.traitCategory === 'cognitive');
    const affectiveTraits = traits.filter(t => t.traitCategory === 'affective');
    const psychomotorTraits = traits.filter(t => t.traitCategory === 'psychomotor');
    const attendancePct = attendance.timesSchoolOpened > 0
        ? Math.round((attendance.timesPresent / attendance.timesSchoolOpened) * 100) : 0;

    const updateTrait = (traitName: string, category: string, rating: number | null) => {
        setTraits(prev => prev.map(t => t.traitName === traitName && t.traitCategory === category ? { ...t, rating } : t));
    };

    const TraitTable = ({ list, label }: { list: TraitRating[]; label: string }) => (
        <div>
            <h4 className="font-semibold text-xs mb-1.5 uppercase tracking-wide text-muted-foreground border-b border-border pb-1">{label}</h4>
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="border-b border-border/50">
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
                                    <span className={`font-semibold ${trait.rating >= 4 ? 'text-secondary' : trait.rating >= 3 ? 'text-warning' : 'text-destructive'}`}>
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

    const handlePrintReportCard = () => {
        if (!selectedStudent) return;

        const gc = (g?: string | null) => {
            if (g === 'A') return '#16a34a'; if (g === 'B') return '#2563eb';
            if (g === 'C') return '#ca8a04'; if (g === 'D') return '#ea580c';
            if (g === 'F') return '#dc2626'; return '#6b7280';
        };
        const rc = (r: number | null) =>
            r && r >= 4 ? '#16a34a' : r && r >= 3 ? '#ca8a04' : r ? '#dc2626' : '#6b7280';

        const subjectRows = subjects.map(s => {
            const ok = s.midTermScore !== null && s.classActivityScore !== null && s.examScore !== null;
            return `<tr>
              <td>${s.subjectName}</td>
              <td class="c">${s.midTermScore ?? '—'}</td>
              <td class="c">${s.classActivityScore ?? '—'}</td>
              <td class="c">${s.examScore ?? '—'}</td>
              <td class="c b">${ok ? `${s.totalScore}%` : '—'}</td>
              <td class="c b" style="color:${gc(s.grade)}">${s.grade || '—'}</td>
            </tr>`;
        }).join('');

        const traitBlock = (list: TraitRating[], label: string) => `
          <div style="flex:1">
            <div style="font-size:0.86em;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #d1d5db;padding-bottom:0.2em;margin-bottom:0.38em">${label}</div>
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#f3f4f6">
                <th style="padding:0.2em 0.38em;text-align:left;font-size:0.86em;border-bottom:1px solid #e5e7eb">Trait</th>
                <th style="padding:0.2em 0.38em;text-align:center;font-size:0.86em;border-bottom:1px solid #e5e7eb">Rating</th>
              </tr></thead>
              <tbody>${list.map(t => `<tr>
                <td style="padding:0.2em 0.38em;border-bottom:1px solid #f3f4f6">${t.traitName}</td>
                <td style="padding:0.2em 0.38em;text-align:center;font-weight:600;color:${rc(t.rating)};border-bottom:1px solid #f3f4f6">
                  ${t.rating ? `${t.rating} – ${RATING_LABELS[t.rating]}` : '—'}
                </td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`;

        const nextTermStr = (() => {
            if (!schoolInfo.nextTermBegins) return 'Not yet set';
            try {
                const d = new Date(schoolInfo.nextTermBegins);
                return isNaN(d.getTime()) ? schoolInfo.nextTermBegins
                    : d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            } catch { return schoolInfo.nextTermBegins || 'Not yet set'; }
        })();

        const logoHtml = schoolInfo.logoUrl
            ? `<img src="${schoolInfo.logoUrl}" alt="logo" style="width:4.19em;height:4.19em;object-fit:contain;flex-shrink:0">` : '';
        const photoHtml = selectedStudent.profilePicture
            ? `<img src="${selectedStudent.profilePicture}" alt="photo" style="width:4.95em;height:4.95em;border-radius:50%;object-fit:cover;border:2px solid #7c3aed;display:block;margin-left:auto">`
            : `<div style="width:4.95em;height:4.95em;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.71em;color:#9ca3af;margin-left:auto">👤</div>`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
          <title>Report Card – ${selectedStudent.fullName}</title>
          <style>
            @page { size: A4 portrait; margin: 0.9cm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; }
            body { font-family: Arial, sans-serif; font-size: 10.5px; color: #111; width: 725px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 0.28em 0.47em; border-bottom: 1px solid #e5e7eb; }
            thead tr { background: #f3f4f6; }
            th { font-weight: 700; }
            tfoot tr { background: #f3f4f6; border-top: 2px solid #d1d5db; }
            .c { text-align: center; }
            .b { font-weight: 700; }
            .sec { margin-top: 0.76em; }
            .sec-title { font-size:0.86em; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; margin:0 0 0.38em; }
          </style>
        </head><body>

        <!-- HEADER -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:0.67em;margin-bottom:0.76em">
          <div style="display:flex;align-items:center;gap:0.76em">
            ${logoHtml}
            <div>
              <div style="font-weight:700;font-size:1.33em">${schoolInfo.name}</div>
              <div style="font-size:0.9em;color:#6b7280;margin-top:0.1em">${schoolInfo.currentTerm} &nbsp;·&nbsp; ${schoolInfo.academicSession}</div>
              <div style="font-size:0.81em;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-top:0.19em">Student Report Card</div>
            </div>
          </div>
          <div style="text-align:right">
            ${photoHtml}
            <div style="font-weight:700;font-size:1.14em;margin-top:0.38em">${selectedStudent.fullName}</div>
            <div style="font-size:0.9em;color:#6b7280">${selectedStudent.class}</div>
          </div>
        </div>

        <!-- ATTENDANCE -->
        <div style="background:#f9fafb;border-radius:3px;padding:0.38em 0.76em;margin-bottom:0.76em;display:flex;gap:1.33em;align-items:center">
          <span style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;font-size:0.86em">Attendance</span>
          <span>Days opened: <strong>${attendance.timesSchoolOpened}</strong></span>
          <span>Times present: <strong>${attendance.timesPresent}</strong></span>
          <span>Rate: <strong>${attendancePct}%</strong></span>
        </div>

        <!-- ACADEMIC RESULTS -->
        <div class="sec-title">Academic Performance</div>
        <table>
          <thead><tr>
            <th>Subject</th>
            <th class="c">Mid-Term<br><span style="font-weight:400">/${scheme.midTermTotal}</span></th>
            <th class="c">CA<br><span style="font-weight:400">/${scheme.classActivityTotal}</span></th>
            <th class="c">Exam<br><span style="font-weight:400">/${scheme.examTotal}</span></th>
            <th class="c">Total %</th>
            <th class="c">Grade</th>
          </tr></thead>
          <tbody>${subjectRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="b">Overall Average</td>
              <td class="c b">${overallAvg.toFixed(1)}%</td>
              <td class="c b" style="color:${gc(overallGrade)}">${overallGrade}</td>
            </tr>
            <tr>
              <td colspan="6" style="padding:0.38em 0.47em">
                <span style="font-size:0.86em;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280">Promotion Status: </span>
                <span style="font-weight:700;font-size:0.95em;color:${overallAvg >= 50 ? '#16a34a' : '#dc2626'};background:${overallAvg >= 50 ? '#dcfce7' : '#fee2e2'};padding:0.1em 0.67em;border-radius:4px">
                  ${overallAvg >= 50 ? 'PROMOTED' : 'REPEAT'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- TRAITS -->
        <div class="sec">
          <div class="sec-title">Cognitive, Affective &amp; Psychomotor Assessment</div>
          <div style="display:flex;gap:0.95em">
            ${traitBlock(cognitiveTraits, 'Cognitive Domain')}
            ${traitBlock(affectiveTraits, 'Affective Domain')}
            ${traitBlock(psychomotorTraits, 'Psychomotor Domain')}
          </div>
        </div>

        <!-- NEXT TERM + COMMENT -->
        <div style="display:flex;gap:0.95em;margin-top:0.76em;align-items:flex-start">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;padding:0.47em 0.76em;white-space:nowrap">
            <span style="font-weight:700;color:#6b7280;font-size:0.9em">Next Term Begins:</span>
            <span style="font-weight:600;margin-left:0.38em;font-size:0.9em">${nextTermStr}</span>
          </div>
          <div style="flex:1;border:1px solid #d1d5db;border-radius:3px;padding:0.47em 0.76em;font-style:italic;color:#555;min-height:2.8em">
            <span style="font-weight:700;font-style:normal;color:#6b7280;font-size:0.81em;text-transform:uppercase">Teacher's Comment: </span>
            ${comment || 'No comment added yet.'}
          </div>
        </div>

        <script>
        (function(){
          var b = document.body;
          var TARGET = 1030;
          for(var i = 0; i < 14; i++){
            var h = b.scrollHeight;
            if(!h) break;
            var cur = parseFloat(b.style.fontSize) || 10.5;
            var nxt = Math.min(16, Math.max(7, cur * TARGET / h));
            b.style.fontSize = nxt + 'px';
            if(Math.abs(nxt - cur) < 0.02) break;
          }
        })();
        </script>
        </body></html>`;

        const win = window.open('', '_blank', 'width=800,height=1150');
        if (!win) { alert('Allow popups for this site to print the report card.'); return; }
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 600);
    };

    // Format the "next term begins" date for display
    const formatNextTermDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr; // return raw if invalid
            return d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

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

                        {/* Next Term Begins — school-wide setting, editable by school admin only */}
                        <div className="mt-4 pt-4 border-t border-border print:hidden">
                            <h3 className="font-semibold mb-2 text-sm">Next Term Begins</h3>
                            {user?.role === "school_admin" ? (
                                <>
                                    <input
                                        type="date"
                                        value={nextTermBeginsEdit}
                                        onChange={e => setNextTermBeginsEdit(e.target.value)}
                                        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:border-primary"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full mt-2 text-xs"
                                        onClick={handleSaveNextTermBegins}
                                        isLoading={isSavingNextTerm}
                                        disabled={nextTermBeginsEdit === (schoolInfo.nextTermBegins || "")}
                                    >
                                        <Save className="w-3 h-3 mr-1" /> Save Date
                                    </Button>
                                    {schoolInfo.nextTermBegins && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Current: {formatNextTermDate(schoolInfo.nextTermBegins)}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm font-medium">
                                    {schoolInfo.nextTermBegins
                                        ? formatNextTermDate(schoolInfo.nextTermBegins)
                                        : <span className="text-muted-foreground italic text-xs">Not yet set by admin</span>
                                    }
                                </p>
                            )}
                        </div>
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
                                                    <th className="px-2 py-2 font-semibold text-center">Total %</th>
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
                                                            <td className="px-2 py-1.5 text-center font-bold">{isComplete ? `${subject.totalScore}%` : "—"}</td>
                                                            <td className="px-2 py-1.5 text-center font-bold" style={gradeStyle(subject.grade)}>{subject.grade || "—"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="border-t-2 border-border bg-muted/20">
                                                <tr>
                                                    <td colSpan={4} className="px-2 py-2 font-bold">Overall Average</td>
                                                    <td className="px-2 py-2 text-center font-bold">{overallAvg.toFixed(1)}%</td>
                                                    <td className="px-2 py-2 text-center font-bold" style={gradeStyle(overallGrade)}>{overallGrade}</td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={6} className="px-2 py-2">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Promotion Status: </span>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${overallAvg >= 50 ? 'bg-secondary/15 text-secondary' : 'bg-destructive/15 text-destructive'}`}>
                                                            {overallAvg >= 50 ? 'PROMOTED' : 'REPEAT'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Cognitive, Affective & Psychomotor Domains */}
                                    <div className="mb-4">
                                        <h3 className="font-semibold text-sm mb-3 uppercase tracking-wide text-muted-foreground">
                                            Cognitive, Affective &amp; Psychomotor Assessment
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <TraitTable list={cognitiveTraits} label="Cognitive Domain" />
                                            <TraitTable list={affectiveTraits} label="Affective Domain" />
                                            <TraitTable list={psychomotorTraits} label="Psychomotor Domain" />
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <div className="flex justify-end mb-4 print:hidden">
                                            <Button size="sm" variant="outline" onClick={handleSaveTraits} isLoading={isSavingTraits}>
                                                <Save className="w-3 h-3 mr-1" /> Save Traits
                                            </Button>
                                        </div>
                                    )}

                                    {/* Next Term Begins */}
                                    <div className="mb-4 p-3 bg-muted/20 rounded-lg flex flex-wrap items-center gap-2 text-sm border border-border/40">
                                        <span className="font-semibold text-muted-foreground">Next Term Begins:</span>
                                        <span className="font-semibold text-foreground">
                                            {schoolInfo.nextTermBegins
                                                ? formatNextTermDate(schoolInfo.nextTermBegins)
                                                : <span className="text-muted-foreground italic">Not yet set — use the sidebar to add a date</span>
                                            }
                                        </span>
                                    </div>

                                    {/* Teacher's / Principal's Comment */}
                                    <div className="pt-4 border-t border-border">
                                        <h3 className="font-semibold text-sm mb-2">Teacher's / Principal's Comment</h3>
                                        {canEdit && (
                                            <div className="print:hidden space-y-2 mb-3">
                                                {/* Auto-comment suggestions toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAutoComments(prev => !prev)}
                                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                >
                                                    {showAutoComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    {showAutoComments ? "Hide suggestions" : "Choose from suggested comments"}
                                                </button>

                                                {showAutoComments && (
                                                    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                                                        <div className="bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                                                            Click any comment to use it (you can edit it after)
                                                        </div>
                                                        <div className="max-h-44 overflow-y-auto divide-y divide-border/30">
                                                            {AUTO_COMMENTS.map((c, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => { setComment(c); setShowAutoComments(false); }}
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                                                                >
                                                                    {c}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <Textarea
                                                        value={comment}
                                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                                                        placeholder="Type a comment or pick one from the list above…"
                                                        className="flex-1 text-sm"
                                                        rows={2}
                                                    />
                                                    <Button onClick={handleSaveComment} isLoading={isSavingComment} size="sm">
                                                        <Save className="w-4 h-4 mr-1" /> Save
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-sm italic text-muted-foreground border border-border/40 rounded px-3 py-2 min-h-8">
                                            {comment || "No comment added yet."}
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-5 flex justify-end gap-3 print:hidden">
                                        <Button variant="outline" onClick={handlePrintReportCard}>
                                            <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
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
          @page { size: A4 portrait; margin: 1.2cm; }

          /* Unblock overflow so content flows across print pages */
          html, body { overflow: visible !important; height: auto !important; }
          body > div { overflow: visible !important; height: auto !important; }

          /* Hide app chrome */
          aside { display: none !important; }

          /* Free the main content area */
          main {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            position: static !important;
            flex: none !important;
            width: 100% !important;
          }
          main > div { padding: 0 !important; max-width: 100% !important; }
          main footer { display: none !important; }

          /* Collapse the grid so the report card takes full width */
          .grid { display: block !important; }

          /* Hide non-print elements (sidebar, buttons, back link, etc.) */
          .print\\:hidden { display: none !important; }

          /* Report card */
          #printable-report {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 12px !important;
          }

          /* Prevent unwanted breaks inside tables */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }

          /* Hide interactive inputs */
          select, input[type="date"] { display: none !important; }
          input[type="number"] { border: none !important; background: transparent !important; }

          /* Ensure colours print */
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      `}</style>
        </DashboardLayout>
    );
}
