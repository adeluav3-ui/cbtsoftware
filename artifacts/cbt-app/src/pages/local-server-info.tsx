import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL as string;

interface JoinInfo {
  ip: string;
  port: number;
  joinUrl: string;
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

function ExportResultsSection({ schoolCode }: { schoolCode: string }) {
  const handleExport = () => {
    window.open(`${API}/schools/${schoolCode}/sync/results-export`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
      <h2 className="font-bold text-gray-800">Export Results</h2>
      <p className="text-sm text-gray-500">
        Download all exam results from this local server as a JSON file. Upload that file on the cloud dashboard to sync results.
      </p>
      <button
        onClick={handleExport}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Download Results File
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

  // School code comes from session — parse from join info or fall back to empty
  // In local mode the admin is logged in and knows their school code
  const [schoolCode, setSchoolCode] = useState("");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center gap-6 p-6 py-12">
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
              Scan the QR code or open the URL below on student devices connected to the same Wi-Fi network.
            </p>

            <img
              src={data.qrDataUrl}
              alt="QR code to join CBT server"
              className="mx-auto w-56 h-56 rounded-lg border border-gray-200"
            />

            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Server URL</p>
              <a
                href={data.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-mono text-sm break-all hover:underline"
              >
                {data.joinUrl}
              </a>
            </div>

            <p className="text-xs text-gray-400">
              IP: {data.ip} &nbsp;|&nbsp; Port: {data.port}
            </p>
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
          <ImportSchoolSection schoolCode={schoolCode} />
          <ExportResultsSection schoolCode={schoolCode} />
        </>
      )}
    </div>
  );
}
