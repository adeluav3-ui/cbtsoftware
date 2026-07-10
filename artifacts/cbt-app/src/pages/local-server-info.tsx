import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout";

const API = import.meta.env.VITE_API_URL as string;

interface JoinInfo {
  ip: string;
  port: number;
  localHostname: string;
  joinUrl: string;
  joinUrlFallback: string;
  qrDataUrl: string;
}

function ImportSchoolSection({ schoolCode }: { schoolCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload = JSON.parse(await file.text());
      const r = await fetch(`${API}/schools/${schoolCode}/sync/import-school`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Import failed");
      setStatus(
        `Imported: ${data.imported.users} users, ${data.imported.exams} exams, ${data.imported.questions} questions.`
      );
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
      <h2 className="font-bold text-gray-800">Import School Data</h2>
      <p className="text-sm text-gray-500">
        Upload the JSON file downloaded from the cloud school admin dashboard to populate this local server.
      </p>
      <label className="block cursor-pointer">
        <span className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors">
          {busy ? "Importing…" : "Choose export file (.json)"}
        </span>
        <input type="file" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {status && (
        <p className={`text-sm ${status.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>
          {status}
        </p>
      )}
    </div>
  );
}

function LicenseStatusSection({ schoolCode }: { schoolCode: string }) {
  const { data, isLoading } = useQuery<{ licenseValidUntil: string | null } | null>({
    queryKey: ["license", schoolCode],
    queryFn: () =>
      fetch(`${API}/schools/${schoolCode}/license`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null),
    enabled: !!schoolCode,
    refetchInterval: 60_000,
  });

  if (isLoading || !data?.licenseValidUntil) return null;

  const expires = new Date(data.licenseValidUntil);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isWarning = daysLeft > 0 && daysLeft <= 14;

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-2 border-2 ${isExpired ? "border-red-400" : isWarning ? "border-orange-400" : "border-transparent"}`}>
      <h2 className="font-bold text-gray-800">License Status</h2>
      <p className="text-sm text-gray-600">
        Valid until:{" "}
        <span className="font-semibold">{format(expires, "MMMM d, yyyy")}</span>
      </p>
      {isExpired ? (
        <p className="text-sm text-red-600 font-semibold">License has expired. Contact support to renew.</p>
      ) : isWarning ? (
        <p className="text-sm text-orange-600 font-semibold">
          Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"} — contact support to renew.
        </p>
      ) : (
        <p className="text-sm text-green-600 font-medium">{daysLeft} days remaining</p>
      )}
    </div>
  );
}

function ApplyLicensePatchSection({ schoolCode }: { schoolCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload = JSON.parse(await file.text());
      const r = await fetch(`${API}/schools/${schoolCode}/sync/apply-license-patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to apply patch");
      const expires = new Date(data.licenseValidUntil);
      setStatus(`License updated — valid until ${expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
      <h2 className="font-bold text-gray-800">Update License</h2>
      <p className="text-sm text-gray-500">
        Upload the license patch file sent by your CBT Software administrator to update your local license without losing any data.
      </p>
      <label className="block cursor-pointer">
        <span className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors">
          {busy ? "Applying…" : "Choose license patch file (.json)"}
        </span>
        <input type="file" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {status && (
        <p className={`text-sm ${status.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>
          {status}
        </p>
      )}
    </div>
  );
}

function ExportResultsSection({ schoolCode }: { schoolCode: string }) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/schools/${schoolCode}/sync/results-export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cbt-results-${schoolCode}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — user will see nothing happened and can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
      <h2 className="font-bold text-gray-800">Export Results</h2>
      <p className="text-sm text-gray-500">
        Download all exam results from this local server as a JSON file. Upload that file on the cloud dashboard to sync results.
      </p>
      <button
        onClick={handleExport}
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {busy ? "Downloading…" : "Download Results File"}
      </button>
    </div>
  );
}

export default function LocalServerInfo() {
  const { data, isLoading, isError } = useQuery<JoinInfo>({
    queryKey: ["join-info"],
    queryFn: () => fetch(`${API}/join-info`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  const [schoolCode, setSchoolCode] = useState("");

  return (
    <DashboardLayout allowedRoles={["school_admin", "teacher"]}>
    <div className="flex flex-col items-center gap-6 py-6">
      {/* QR / connection card */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Connect to CBT Server</h1>

        {isLoading && (
          <p className="text-gray-500 text-sm">Loading server info…</p>
        )}

        {isError && (
          <p className="text-red-500 text-sm">
            Could not reach the local server. Make sure you are on the same network.
          </p>
        )}

        {data && (
          <>
            <p className="text-sm text-gray-500">
              Scan the QR code or open the URL below on student devices connected to the same Wi‑Fi network.
            </p>

            <img
              src={data.qrDataUrl}
              alt="QR code to join CBT server"
              className="mx-auto w-56 h-56 rounded-lg border border-gray-200"
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-left">
              <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Primary (recommended)</p>
              <a
                href={data.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-mono text-sm break-all hover:underline font-bold"
              >
                {data.joinUrl}
              </a>
            </div>

            <div className="bg-gray-100 rounded-lg px-4 py-3 text-left">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Fallback — if primary doesn't resolve</p>
              <a
                href={data.joinUrlFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 font-mono text-sm break-all hover:underline"
              >
                {data.joinUrlFallback}
              </a>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">If the network changes during an exam</span>, students already connected may need to reload their page. Exam data is always saved on this computer — only the connection needs refreshing. The .local address usually self-heals on reconnect, but tell students to reload if their page stops responding.
              </p>
            </div>
          </>
        )}
      </div>

      {/* School code input for sync operations */}
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
        <h2 className="font-bold text-gray-800">Sync Setup</h2>
        <p className="text-sm text-gray-500">
          Enter your school code to enable import/export below.
        </p>
        <input
          type="text"
          placeholder="e.g. NEW-1001"
          value={schoolCode}
          onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-wide"
        />
      </div>

      {schoolCode.length >= 3 && (
        <>
          <LicenseStatusSection schoolCode={schoolCode} />
          <ApplyLicensePatchSection schoolCode={schoolCode} />
          <ImportSchoolSection schoolCode={schoolCode} />
          <ExportResultsSection schoolCode={schoolCode} />
        </>
      )}
    </div>
    </DashboardLayout>
  );
}
