import { useState, useRef } from "react";
import { Modal, Button, Badge, CustomTabs } from "@/components/ui-elements";
import { Upload, ClipboardList, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface Question {
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
}

interface ParseResult {
    questions: Question[];
    errors: string[];
}

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (questions: Question[]) => void;
    isPending: boolean;
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseCSVOrExcel(data: any[][]): ParseResult {
    const questions: Question[] = [];
    const errors: string[] = [];

    // Skip header row
    const rows = data.slice(1);

    rows.forEach((row, i) => {
        const rowNum = i + 2;
        const [text, optionA, optionB, optionC, optionD, correctOption] = row.map(
            (cell) => (cell !== undefined && cell !== null ? String(cell).trim() : "")
        );

        if (!text && !optionA && !optionB && !optionC && !optionD && !correctOption) {
            return; // skip empty rows
        }

        if (!text) { errors.push(`Row ${rowNum}: Question text is missing`); return; }
        if (!optionA) { errors.push(`Row ${rowNum}: Option A is missing`); return; }
        if (!optionB) { errors.push(`Row ${rowNum}: Option B is missing`); return; }
        if (!optionC) { errors.push(`Row ${rowNum}: Option C is missing`); return; }
        if (!optionD) { errors.push(`Row ${rowNum}: Option D is missing`); return; }

        const correct = correctOption.toUpperCase().replace(/[^ABCD]/g, "");
        if (!["A", "B", "C", "D"].includes(correct)) {
            errors.push(`Row ${rowNum}: correctOption must be A, B, C or D (got "${correctOption}")`);
            return;
        }

        questions.push({ text, optionA, optionB, optionC, optionD, correctOption: correct });
    });

    return { questions, errors };
}

function parsePasteText(text: string): ParseResult {
    const questions: Question[] = [];
    const errors: string[] = [];

    // Split by blank lines to get question blocks
    const blocks = text.trim().split(/\n\s*\n/);

    blocks.forEach((block, i) => {
        const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 6) {
            errors.push(`Block ${i + 1}: Too few lines (need question, 4 options, answer)`);
            return;
        }

        const questionText = lines[0];

        // Parse options — accept "A. text", "A) text", "A: text"
        const optionRegex = /^([ABCD])[.):\s]\s*(.+)/i;
        const options: Record<string, string> = {};

        for (let j = 1; j < lines.length; j++) {
            const match = lines[j].match(optionRegex);
            if (match) {
                options[match[1].toUpperCase()] = match[2].trim();
            }
        }

        if (!options["A"] || !options["B"] || !options["C"] || !options["D"]) {
            errors.push(`Block ${i + 1}: Missing one or more options (A, B, C, D required)`);
            return;
        }

        // Parse answer line — accept "Answer: B", "Ans: B", "ANS: B"
        const answerLine = lines.find((l) => /^(answer|ans)[.:)]/i.test(l));
        if (!answerLine) {
            errors.push(`Block ${i + 1}: No answer line found (e.g. "Answer: B")`);
            return;
        }

        const answerMatch = answerLine.match(/^(?:answer|ans)[.:)]\s*([ABCD])/i);
        if (!answerMatch) {
            errors.push(`Block ${i + 1}: Answer must be A, B, C or D`);
            return;
        }

        questions.push({
            text: questionText,
            optionA: options["A"],
            optionB: options["B"],
            optionC: options["C"],
            optionD: options["D"],
            correctOption: answerMatch[1].toUpperCase(),
        });
    });

    return { questions, errors };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BulkUploadModal({ isOpen, onClose, onUpload, isPending }: BulkUploadModalProps) {
    const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
    const [pasteText, setPasteText] = useState("");
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [fileName, setFileName] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setParseResult(null);
        setFileName("");
        setPasteText("");
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                setParseResult(parseCSVOrExcel(rows));
            } catch {
                setParseResult({ questions: [], errors: ["Failed to read file. Make sure it's a valid Excel or CSV file."] });
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleParsePaste = () => {
        if (!pasteText.trim()) return;
        setParseResult(parsePasteText(pasteText));
    };

    const handleUpload = () => {
        if (!parseResult || parseResult.questions.length === 0) return;
        onUpload(parseResult.questions);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Questions" size="lg">
            <div className="space-y-4">

                {/* Tab switcher */}
                <CustomTabs
                    tabs={["Excel / CSV", "Paste Text"]}
                    activeTab={activeTab === "file" ? "Excel / CSV" : "Paste Text"}
                    onChange={t => { setActiveTab(t === "Excel / CSV" ? "file" : "paste"); reset(); }}
                />

                {/* File upload tab */}
                {activeTab === "file" && !parseResult && (
                    <div className="space-y-4">
                        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="font-semibold mb-1">Upload Excel or CSV file</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                File must have columns: <span className="font-mono text-xs bg-muted px-1 rounded">question, optionA, optionB, optionC, optionD, correctOption</span>
                            </p>
                            <Button variant="outline" onClick={() => fileRef.current?.click()}>
                                Choose File
                            </Button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* Template download hint */}
                        <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">
                            <p className="font-semibold text-foreground mb-2">Expected format:</p>
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-muted">
                                        {["question", "optionA", "optionB", "optionC", "optionD", "correctOption"].map(h => (
                                            <th key={h} className="border border-border px-2 py-1 text-left font-mono">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-border px-2 py-1">What is 2+2?</td>
                                        <td className="border border-border px-2 py-1">3</td>
                                        <td className="border border-border px-2 py-1">4</td>
                                        <td className="border border-border px-2 py-1">5</td>
                                        <td className="border border-border px-2 py-1">6</td>
                                        <td className="border border-border px-2 py-1 font-bold">B</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Paste text tab */}
                {activeTab === "paste" && !parseResult && (
                    <div className="space-y-4">
                        <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">
                            <p className="font-semibold text-foreground mb-2">Format each question like this:</p>
                            <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed">{`What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
D. Ibadan
Answer: B

What is 2 + 2?
A. 3
B. 4
C. 5
D. 6
Answer: B`}</pre>
                            <p className="mt-2 text-xs">Separate questions with a blank line.</p>
                        </div>
                        <textarea
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder="Paste your questions here..."
                            className="w-full h-48 px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                        />
                        <Button
                            className="w-full"
                            onClick={handleParsePaste}
                            disabled={!pasteText.trim()}
                        >
                            Parse Questions
                        </Button>
                    </div>
                )}

                {/* Preview parsed results */}
                {parseResult && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="flex gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-green-800 text-sm">{parseResult.questions.length} questions parsed</span>
                            </div>
                            {parseResult.errors.length > 0 && (
                                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                                    <XCircle className="w-4 h-4 text-destructive" />
                                    <span className="font-semibold text-destructive text-sm">{parseResult.errors.length} errors</span>
                                </div>
                            )}
                        </div>

                        {/* Errors */}
                        {parseResult.errors.length > 0 && (
                            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-1 max-h-32 overflow-y-auto">
                                {parseResult.errors.map((err, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        {err}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Question preview */}
                        {parseResult.questions.length > 0 && (
                            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                                {parseResult.questions.map((q, i) => (
                                    <div key={i} className="rounded-xl border border-border p-4 bg-muted/20">
                                        <p className="font-semibold text-sm mb-2">
                                            <span className="text-primary mr-2">Q{i + 1}.</span>{q.text}
                                        </p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {(["A", "B", "C", "D"] as const).map((opt) => {
                                                const val = q[`option${opt}` as keyof Question];
                                                const isCorrect = q.correctOption === opt;
                                                return (
                                                    <div
                                                        key={opt}
                                                        className={`text-xs rounded-lg px-2.5 py-1.5 border ${isCorrect
                                                                ? "bg-green-100 border-green-400 font-bold text-green-800"
                                                                : "bg-background border-border/40 text-muted-foreground"
                                                            }`}
                                                    >
                                                        <span className="font-mono">{opt}.</span> {val}
                                                        {isCorrect && <span className="ml-1 text-green-700"> ✓</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={reset} className="flex-1">
                                ← Try Again
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleUpload}
                                disabled={parseResult.questions.length === 0}
                                isLoading={isPending}
                            >
                                Upload {parseResult.questions.length} Questions
                            </Button>
                        </div>
                    </div>
                )}

                {/* File name display */}
                {fileName && !parseResult && (
                    <p className="text-sm text-muted-foreground text-center">Selected: {fileName}</p>
                )}
            </div>
        </Modal>
    );
}