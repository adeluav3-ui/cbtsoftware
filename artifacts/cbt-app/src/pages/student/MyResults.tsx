import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Button } from "@/components/ui-elements";
import { getGradeColor } from "@/lib/grade";
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
    teacherComment: string | null;
}

interface SchoolInfo {
    name: string;
    logoUrl: string | null;
    currentTerm: string;
    academicSession: string;
    nextTermBegins: string | null;
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

interface TraitRating {
    traitCategory: 'cognitive' | 'affective' | 'psychomotor';
    traitName: string;
    rating: number | null;
}

const DEFAULT_SCHEME: GradingScheme = { midTermTotal: 20, classActivityTotal: 20, examTotal: 60, gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 };

const RATING_LABELS: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };

export default function MyResults() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const API = import.meta.env.VITE_API_URL;
    const schoolCode = user?.schoolCode || "";

    const [subjects, setSubjects] = useState<SubjectResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: "", logoUrl: null, currentTerm: "First Term", academicSession: "2025/2026", nextTermBegins: null,
    });
    const [scheme, setScheme] = useState<GradingScheme>(DEFAULT_SCHEME);
    const [traits, setTraits] = useState<TraitRating[]>([]);
    const [attendance, setAttendance] = useState({ timesSchoolOpened: 0, timesPresent: 0 });
    const [teacherComment, setTeacherComment] = useState("");

    useEffect(() => {
        if (!schoolCode || !user?.id) return;
        fetchSchoolInfo();
        fetchResults();
        fetchScheme();
        fetchTraits();
        fetchAttendance();
    }, [schoolCode, user?.id]);

    const fetchSchoolInfo = async () => {
        try {
            const res = await fetch(`${API}/schools/${schoolCode}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setSchoolInfo({
                name: data.name || "School",
                logoUrl: data.logoUrl,
                currentTerm: data.currentTerm || "First Term",
                academicSession: data.currentAcademicSession || "2025/2026",
                nextTermBegins: data.nextTermBegins || null,
            });
        } catch (_) {}
    };

    const fetchScheme = async () => {
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/grading-scheme`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (data) setScheme({ midTermTotal: data.midTermTotal ?? 20, classActivityTotal: data.classActivityTotal ?? 20, examTotal: data.examTotal ?? 60, gradeAMin: data.gradeAMin ?? 70, gradeBMin: data.gradeBMin ?? 60, gradeCMin: data.gradeCMin ?? 50, gradeDMin: data.gradeDMin ?? 40 });
        } catch (_) {}
    };

    const fetchResults = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${user.id}/subject-scores`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data)) return;
            setSubjects(data);
            setTeacherComment(data.find((s: SubjectResult) => s.teacherComment)?.teacherComment || "");
        } catch (_) {}
        finally { setIsLoading(false); }
    };

    const fetchTraits = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${user.id}/traits`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) setTraits(data);
        } catch (_) {}
    };

    const fetchAttendance = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API}/schools/${schoolCode}/students/${user.id}/attendance`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setAttendance({ timesSchoolOpened: data.timesSchoolOpened || 0, timesPresent: data.timesPresent || 0 });
        } catch (_) {}
    };

    const completedSubjects = subjects.filter(s => s.percentage !== null);
    const overallAvg = completedSubjects.length > 0
        ? completedSubjects.reduce((acc, s) => acc + (s.percentage || 0), 0) / completedSubjects.length
        : 0;
    const overallGrade = overallAvg >= scheme.gradeAMin ? 'A' : overallAvg >= scheme.gradeBMin ? 'B' : overallAvg >= scheme.gradeCMin ? 'C' : overallAvg >= scheme.gradeDMin ? 'D' : 'F';
    const attendancePct = attendance.timesSchoolOpened > 0 ? Math.round((attendance.timesPresent / attendance.timesSchoolOpened) * 100) : 0;

    const cognitiveTraits = traits.filter(t => t.traitCategory === 'cognitive');
    const affectiveTraits = traits.filter(t => t.traitCategory === 'affective');
    const psychomotorTraits = traits.filter(t => t.traitCategory === 'psychomotor');

    const gradeStyle = (grade?: string | null): React.CSSProperties =>
        grade ? { color: getGradeColor(grade) } : {};

    const getRatingColor = (rating: number | null) =>
        rating && rating >= 4 ? 'text-secondary' : rating && rating >= 3 ? 'text-warning' : rating ? 'text-destructive' : 'text-muted-foreground';

    const formatNextTermDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch { return dateStr; }
    };

    const TraitTable = ({ list, label }: { list: TraitRating[]; label: string }) => (
        <div>
            <h4 className="font-semibold text-xs mb-1.5 uppercase tracking-wide text-muted-foreground border-b border-border pb-1">{label}</h4>
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="border-b border-border/50">
                        <th className="text-left py-1 font-semibold">Trait</th>
                        <th className="text-center py-1 font-semibold">Rating</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map(trait => (
                        <tr key={trait.traitName} className="border-b border-border/30">
                            <td className="py-1">{trait.traitName}</td>
                            <td className={`text-center py-1 font-semibold ${getRatingColor(trait.rating)}`}>
                                {trait.rating ? `${trait.rating} – ${RATING_LABELS[trait.rating]}` : "—"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const handlePrint = () => {
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
        const photoHtml = user?.profilePicture
            ? `<img src="${user.profilePicture}" alt="photo" style="width:4.95em;height:4.95em;border-radius:50%;object-fit:cover;border:2px solid #7c3aed;display:block;margin-left:auto">`
            : `<div style="width:4.95em;height:4.95em;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.71em;color:#9ca3af;margin-left:auto">👤</div>`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
          <title>Report Card – ${user?.fullName}</title>
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
            <div style="font-weight:700;font-size:1.14em;margin-top:0.38em">${user?.fullName}</div>
            <div style="font-size:0.9em;color:#6b7280">${user?.class}</div>
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
            ${teacherComment || 'No comment added yet.'}
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
        if (!win) { alert('Allow popups for this site to print your report card.'); return; }
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 600);
    };

    return (
        <DashboardLayout allowedRoles={["student"]}>
            <div className="mb-6">
                <button onClick={() => setLocation("/student")} className="inline-flex items-center text-sm text-primary hover:underline mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold font-display">My Term Results</h1>
                <p className="text-muted-foreground text-sm">Your comprehensive academic results for this term</p>
            </div>

            <Card className="p-6">
                {/* School Header */}
                <div className="flex justify-between items-start mb-4 pb-4 border-b-2 border-border">
                    <div className="flex items-center gap-3">
                        {schoolInfo.logoUrl ? (
                            <img src={schoolInfo.logoUrl} alt="School Logo" className="w-14 h-14 object-contain" />
                        ) : (
                            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                                <School className="w-7 h-7 text-primary" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold">{schoolInfo.name}</h2>
                            <p className="text-xs text-muted-foreground">{schoolInfo.currentTerm} • {schoolInfo.academicSession}</p>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Student Report Card</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        {user?.profilePicture ? (
                            <img src={user.profilePicture ?? undefined} alt={user.fullName ?? ""} className="w-16 h-16 rounded-full object-cover border-2 border-primary ml-auto" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center ml-auto">
                                <User className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                        <p className="font-semibold mt-1 text-sm">{user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user?.class}</p>
                    </div>
                </div>

                {/* Attendance */}
                <div className="mb-4 p-2.5 bg-muted/30 rounded-lg flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">Attendance:</span>
                    <span>Days opened: <strong>{attendance.timesSchoolOpened}</strong></span>
                    <span>Times present: <strong>{attendance.timesPresent}</strong></span>
                    <span>Rate: <strong>{attendancePct}%</strong></span>
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
                        {/* Academic Results Table */}
                        <div className="overflow-x-auto mb-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Academic Performance</p>
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
                                {completedSubjects.length > 0 && (
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
                                )}
                            </table>
                        </div>

                        {subjects.some(s => s.percentage === null) && (
                            <p className="text-xs text-muted-foreground mb-4 italic">
                                "—" means your teacher hasn't entered that score yet.
                            </p>
                        )}

                        {/* Traits */}
                        {traits.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm mb-3 uppercase tracking-wide text-muted-foreground">
                                    Cognitive, Affective &amp; Psychomotor Assessment
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {cognitiveTraits.length > 0 && <TraitTable list={cognitiveTraits} label="Cognitive Domain" />}
                                    {affectiveTraits.length > 0 && <TraitTable list={affectiveTraits} label="Affective Domain" />}
                                    {psychomotorTraits.length > 0 && <TraitTable list={psychomotorTraits} label="Psychomotor Domain" />}
                                </div>
                            </div>
                        )}

                        {/* Next Term Begins */}
                        <div className="mb-4 p-3 bg-muted/20 rounded-lg flex flex-wrap items-center gap-2 text-sm border border-border/40">
                            <span className="font-semibold text-muted-foreground">Next Term Begins:</span>
                            <span className="font-semibold text-foreground">
                                {schoolInfo.nextTermBegins
                                    ? formatNextTermDate(schoolInfo.nextTermBegins)
                                    : <span className="text-muted-foreground italic">Date not yet announced</span>
                                }
                            </span>
                        </div>

                        {/* Teacher's Comment */}
                        <div className="pt-4 border-t border-border">
                            <h3 className="font-semibold text-sm mb-2">Teacher's / Principal's Comment</h3>
                            <p className="text-sm italic text-muted-foreground border border-border/40 rounded px-3 py-2 min-h-8">
                                {teacherComment || "No comment added yet."}
                            </p>
                        </div>

                        {/* Print Button */}
                        <div className="mt-5 flex justify-end">
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
                            </Button>
                        </div>
                    </>
                )}
            </Card>
        </DashboardLayout>
    );
}
