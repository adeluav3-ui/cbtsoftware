import { useState } from "react";
import { Modal, Button, Label, Select, Textarea, Input, CustomTabs } from "@/components/ui-elements";
import { Upload, FileText, Download, UserPlus } from "lucide-react";

interface BulkUploadStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    schoolCode: string;
    onSuccess: () => void;
}

const CLASSES = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

export function BulkUploadStudentsModal({ isOpen, onClose, schoolCode, onSuccess }: BulkUploadStudentsModalProps) {
    const [uploadMethod, setUploadMethod] = useState<"paste" | "csv">("paste");
    const [studentData, setStudentData] = useState("");
    const [selectedClass, setSelectedClass] = useState("Pry 1");
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [createdStudents, setCreatedStudents] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);

    // Generate username from full name with uniqueness handling
    const generateUsername = (fullName: string, index: number, existingUsernames: Set<string>) => {
        let baseUsername = fullName.toLowerCase().replace(/\s+/g, '');
        let username = baseUsername;
        let counter = 1;

        // If username already exists, append a number
        while (existingUsernames.has(username)) {
            username = `${baseUsername}${counter}`;
            counter++;
        }

        existingUsernames.add(username);
        return username;
    };

    // Generate random 6-digit PIN
    const generatePin = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const processBulkUpload = async () => {
        if (!studentData.trim()) {
            setError("Please enter student data");
            return;
        }

        setIsUploading(true);
        setError("");
        setSuccess("");
        setCreatedStudents([]);

        // Parse student data - one per line
        const lines = studentData.trim().split('\n');
        const students = [];
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Format: "Full Name" or "Full Name,Class"
            let fullName = line;
            let studentClass = selectedClass;

            if (line.includes(',')) {
                const parts = line.split(',');
                fullName = parts[0].trim();
                if (parts[1] && parts[1].trim()) {
                    const raw = parts[1].trim();
                    const matched = CLASSES.find(c => c.toLowerCase() === raw.toLowerCase());
                    if (matched) {
                        studentClass = matched;
                    } else {
                        errors.push(`Line ${i + 1}: Unknown class "${raw}". Valid classes: ${CLASSES.join(', ')}`);
                        continue;
                    }
                }
            }

            if (!fullName) {
                errors.push(`Line ${i + 1}: Name is required`);
                continue;
            }

            students.push({
                fullName,
                class: studentClass,
                originalIndex: i,
            });
        }

        if (errors.length > 0) {
            setError(errors.join('\n'));
            setIsUploading(false);
            return;
        }

        if (students.length === 0) {
            setError("No valid student names found");
            setIsUploading(false);
            return;
        }

        // Create students one by one via API
        const created = [];
        const failed = [];
        const processedUsernames = new Set<string>();

        for (let idx = 0; idx < students.length; idx++) {
            const student = students[idx];
            const username = generateUsername(student.fullName, idx, processedUsernames);
            const password = generatePin();

            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        fullName: student.fullName,
                        class: student.class,
                    }),
                    credentials: "include",
                });

                const data = await response.json();

                if (response.ok) {
                    created.push({
                        fullName: student.fullName,
                        username: username,
                        password: password,
                        class: student.class,
                        id: data.id,
                    });
                } else {
                    console.error("Failed to create student:", data);
                    failed.push({
                        fullName: student.fullName,
                        error: data.error || "Unknown error",
                        class: student.class
                    });
                }
            } catch (err) {
                console.error("Network error:", err);
                failed.push({
                    fullName: student.fullName,
                    error: "Network error",
                    class: student.class
                });
            }
        }

        setCreatedStudents(created);

        if (created.length > 0) {
            setSuccess(`✅ Successfully created ${created.length} students.`);
            if (failed.length > 0) {
                setError(`❌ ${failed.length} students failed: ${failed.map(f => `${f.fullName} (${f.error})`).join(', ')}`);
            }
            setShowResults(true);
            onSuccess();
        } else if (failed.length > 0) {
            setError(`Failed to create ${failed.length} students: ${failed.map(f => `${f.fullName} (${f.error})`).join(', ')}`);
        }

        setIsUploading(false);
    };

    const downloadCSVTemplate = () => {
        const headers = ["Full Name", "Class (Optional)"];
        const rows = [
            ["John Doe", "JSS1"],
            ["Jane Smith", ""],
            ["Michael Johnson", "SSS2"],
        ];

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadCredentials = () => {
        const headers = ["Full Name", "Username", "Password", "Class"];
        const rows = createdStudents.map(s => [s.fullName, s.username, s.password, s.class]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_credentials.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Students" size="lg">
            <div className="space-y-4">
                {/* Method Selection */}
                <CustomTabs
                    tabs={["Paste Names", "Upload CSV"]}
                    activeTab={uploadMethod === "paste" ? "Paste Names" : "Upload CSV"}
                    onChange={t => setUploadMethod(t === "Paste Names" ? "paste" : "csv")}
                />

                {/* Class Selection */}
                <div>
                    <Label>Default Class</Label>
                    <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                        Students will be added to this class. You can also specify class per student using "Name, Class" format.
                    </p>
                </div>

                {/* Data Input Area */}
                {uploadMethod === "paste" ? (
                    <div>
                        <Label>Student Names (one per line)</Label>
                        <Textarea
                            value={studentData}
                            onChange={(e) => setStudentData(e.target.value)}
                            placeholder="John Doe&#10;Jane Smith&#10;Michael Johnson, SSS1"
                            className="min-h-[200px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Format: Full Name (or "Full Name, Class" to override default class)
                        </p>
                    </div>
                ) : (
                    <div>
                        <Label>Upload CSV File</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            setStudentData(event.target?.result as string);
                                        };
                                        reader.readAsText(file);
                                    }
                                }}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer">
                                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm">Click to upload CSV file</p>
                                <p className="text-xs text-muted-foreground mt-1">CSV should have "Full Name" column (optional "Class" column)</p>
                            </label>
                        </div>
                        <Button variant="outline" size="sm" onClick={downloadCSVTemplate} className="mt-2">
                            Download Template
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-success/10 text-success p-3 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* Results Table */}
                {showResults && createdStudents.length > 0 && (
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <Label>Created Students Credentials</Label>
                            <Button variant="outline" size="sm" onClick={downloadCredentials}>
                                <Download className="w-3 h-3 mr-1" /> Download CSV
                            </Button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted">
                                    <tr className="border-b border-border">
                                        <th className="px-3 py-2 text-left">Full Name</th>
                                        <th className="px-3 py-2 text-left">Username</th>
                                        <th className="px-3 py-2 text-left">Password</th>
                                        <th className="px-3 py-2 text-left">Class</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {createdStudents.map((student, idx) => (
                                        <tr key={idx} className="border-b border-border/50">
                                            <td className="px-3 py-2">{student.fullName}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{student.username}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{student.password}</td>
                                            <td className="px-3 py-2">{student.class}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={processBulkUpload} isLoading={isUploading} className="flex-1">
                        <UserPlus className="w-4 h-4 mr-1" /> Upload Students
                    </Button>
                </div>
            </div>
        </Modal>
    );
}