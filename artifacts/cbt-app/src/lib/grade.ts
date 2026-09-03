export function getGradeColor(grade: string): string {
  switch (grade?.toUpperCase()) {
    case "A": return "var(--grade-a)";
    case "B": return "var(--grade-b)";
    case "C": return "var(--grade-c)";
    case "D": return "var(--grade-d)";
    default:  return "var(--grade-f)";
  }
}
