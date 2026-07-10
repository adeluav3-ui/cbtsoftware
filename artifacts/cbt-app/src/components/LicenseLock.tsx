import { useState, useEffect } from "react";
import { Calendar, Clock, Upload } from "lucide-react";
import { format } from "date-fns";

const API = import.meta.env.VITE_API_URL as string;
const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === "true";

interface Props {
  error: "CLOCK_TAMPER" | "LICENSE_EXPIRED";
  licenseValidUntil?: string | null;
}

export function LicenseLock({ error, licenseValidUntil }: Props) {
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [patchStatus, setPatchStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch school code from session — /auth/me has no license check, so this
  // works even while the license is expired.
  useEffect(() => {
    if (!IS_LOCAL || error !== "LICENSE_EXPIRED") return;
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(user => { if (user?.schoolCode) setSchoolCode(user.schoolCode); })
      .catch(() => {});
  }, [error]);

  const handlePatchFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolCode) return;
    setBusy(true);
    setPatchStatus(null);
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
      setPatchStatus("License updated! Reloading…");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setPatchStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center space-y-5">
        {error === "CLOCK_TAMPER" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Clock Tamper Detected</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              The server's system clock appears to have been set back. This
              protection prevents exam fraud. Please correct the system time and
              restart the server.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
              Contact your system administrator or CBT Software support to
              resolve this issue.
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">License Expired</h1>
            {licenseValidUntil && (
              <p className="text-gray-500 text-sm">
                Expired on{" "}
                <span className="font-semibold">
                  {format(new Date(licenseValidUntil), "MMMM d, yyyy")}
                </span>
              </p>
            )}
            <p className="text-gray-600 text-sm leading-relaxed">
              Your CBT Software license has expired. Contact your administrator
              to renew it, then upload the license patch file below to restore
              access without losing any data.
            </p>

            {/* License patch upload — only shown in local mode */}
            {IS_LOCAL && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Upload License Patch
                </p>
                <p className="text-xs text-orange-700 leading-relaxed">
                  Your administrator will send you a <span className="font-mono font-semibold">cbt-license-*.json</span> file. Upload it here to renew without losing exam data.
                </p>
                <label className="block cursor-pointer">
                  <span className={`inline-block px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${busy ? "opacity-50 cursor-not-allowed bg-white border-orange-300 text-orange-700" : "bg-white border-orange-300 text-orange-700 hover:bg-orange-50"}`}>
                    {busy ? "Applying…" : "Choose license patch file (.json)"}
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handlePatchFile}
                    disabled={busy || !schoolCode}
                  />
                </label>
                {!schoolCode && (
                  <p className="text-xs text-orange-600">Loading session…</p>
                )}
                {patchStatus && (
                  <p className={`text-xs font-semibold ${patchStatus.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                    {patchStatus}
                  </p>
                )}
              </div>
            )}

            {!IS_LOCAL && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700 font-medium">
                Contact CBT Software support to renew your license and restore
                access.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
