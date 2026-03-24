import { useState } from "react";
import { Modal, Button, Input, Label } from "@/components/ui-elements";

interface EnterScoresModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: number;
    examTitle: string;
    assessmentType: string;
    studentId: number;
    studentName: string;
    schoolCode: string;
    existingTheoryScore?: number;
    existingActivityScore?: number;
    onSuccess: () => void;
}

export function EnterScoresModal({
    isOpen,
    onClose,
    examId,
    examTitle,
    assessmentType, // Add this
    studentId,
    studentName,
    schoolCode,
    existingTheoryScore = 0,
    existingActivityScore = 0,
    onSuccess,
}: EnterScoresModalProps) {
    const [theoryScore, setTheoryScore] = useState(existingTheoryScore);
    const [activityScore, setActivityScore] = useState(existingActivityScore);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        setIsSaving(true);
        setError("");

        try {
            const body: any = { studentId };

            if (assessmentType !== 'class_activity') {
                body.theoryScore = theoryScore;
            }

            if (assessmentType === 'class_activity') {
                body.classActivityScore = activityScore;
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${examId}/scores`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    credentials: "include",
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Failed to save scores");
                return;
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Enter Scores: ${examTitle}`}>
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Student: <span className="font-semibold text-primary">{studentName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                    Type: <span className="font-semibold">
                        {assessmentType === "mid_term" && "Mid-Term Test"}
                        {assessmentType === "exam" && "Final Exam"}
                        {assessmentType === "class_activity" && "Class Activity"}
                    </span>
                </p>

                {assessmentType !== 'class_activity' && (
                    <div>
                        <Label>Theory Score</Label>
                        <Input
                            type="number"
                            min={0}
                            value={theoryScore}
                            onChange={(e) => setTheoryScore(parseInt(e.target.value) || 0)}
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Enter the theory/manual score for this student
                        </p>
                    </div>
                )}

                {assessmentType === 'class_activity' && (
                    <div>
                        <Label>Class Activity Score</Label>
                        <Input
                            type="number"
                            min={0}
                            value={activityScore}
                            onChange={(e) => setActivityScore(parseInt(e.target.value) || 0)}
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Enter the class activity score for this student
                        </p>
                    </div>
                )}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} isLoading={isSaving} className="flex-1">
                        Save Scores
                    </Button>
                </div>
            </div>
        </Modal>
    );
}