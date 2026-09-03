import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, Input } from "@/components/ui-elements";

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
    <Card className="w-full max-w-sm space-y-3">
      <h2 className="font-bold text-foreground">Import School Data</h2>
      <p className="text-sm text-muted-foreground">
        Upload the JSON file downloaded from the cloud school admin dashboard to populate this local server.
      </p>
      <label className="block cursor-pointer">
        <span className="inline-block px-4 py-2 rounded-xl border-2 border-border text-sm font-medium hover:bg-muted/60 transition-colors text-foreground">
          {busy ? "Importing…" : "Choose export file (.json)"}
        </span>
        <input type="file" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {status && (
        <p className={`text-sm font-medium ${status.startsWith("Error") ? "text-destructive" : "text-secondary"}`}>
          {status}
        </p>
      )}
    </Card>
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
    <Card className={`w-full max-w-sm space-y-2 border-2 ${isExpired ? "border-destructive/50" : isWarning ? "border-warning/50" : "border-border/50"}`}>
      <h2 className="font-bold text-foreground">License Status</h2>
      <p className="text-sm text-muted-foreground">
        Valid until:{" "}
        <span className="font-semibold text-foreground">{format(expires, "MMMM d, yyyy")}</span>
      </p>
      {isExpired ? (
        <p className="text-sm text-destructive font-semibold">License has expired. Contact support to renew.</p>
      ) : isWarning ? (
        <p className="text-sm text-warning font-semibold">
          Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"} — contact support to renew.
        </p>
      ) : (
        <p className="text-sm text-secondary font-medium">{daysLeft} days remaining</p>
      )}
    </Card>
  );
}

function ApplyLicensePatchSection({ schoolCode }: { schoolCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

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
      const maxMsg = data.maxDevices != null ? ` Device limit: ${data.maxDevices}.` : "";
      setStatus(`License updated — valid until ${expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.${maxMsg}`);
      queryClient.invalidateQueries({ queryKey: ["registered-devices"] });
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Card className="w-full max-w-sm space-y-3">
      <h2 className="font-bold text-foreground">Update License</h2>
      <p className="text-sm text-muted-foreground">
        Upload the license patch file sent by your CBT Software administrator to update your local license without losing any data.
      </p>
      <label className="block cursor-pointer">
        <span className="inline-block px-4 py-2 rounded-xl border-2 border-border text-sm font-medium hover:bg-muted/60 transition-colors text-foreground">
          {busy ? "Applying…" : "Choose license patch file (.json)"}
        </span>
        <input type="file" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {status && (
        <p className={`text-sm font-medium ${status.startsWith("Error") ? "text-destructive" : "text-secondary"}`}>
          {status}
        </p>
      )}
    </Card>
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
    <Card className="w-full max-w-sm space-y-3">
      <h2 className="font-bold text-foreground">Export Results</h2>
      <p className="text-sm text-muted-foreground">
        Download all exam results from this local server as a JSON file. Upload that file on the cloud dashboard to sync results.
      </p>
      <button
        onClick={handleExport}
        disabled={busy}
        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {busy ? "Downloading…" : "Download Results File"}
      </button>
    </Card>
  );
}

interface RegisteredDevice {
  deviceId: string;
  schoolCode: string;
  registeredAt: number;
  lastSeen: number;
  userId: number | null;
  username: string | null;
  fullName: string | null;
  role: string | null;
  ipAddress: string | null;
}

function RegisteredDevicesSection({ schoolCode }: { schoolCode: string }) {
  const queryClient = useQueryClient();
  const [deregistering, setDeregistering] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<{ devices: RegisteredDevice[]; count: number; max: number | null }>({
    queryKey: ["registered-devices", schoolCode],
    queryFn: async () => {
      const r = await fetch(`${API}/registered-devices`, { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${r.status}`);
      }
      return r.json();
    },
    enabled: !!schoolCode,
    refetchInterval: 30_000,
    retry: 1,
  });

  const handleDeregister = async (deviceId: string) => {
    setDeregistering(deviceId);
    try {
      const res = await fetch(`${API}/registered-devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["registered-devices", schoolCode] });
      }
    } finally {
      setDeregistering(null);
    }
  };

  const devices = data?.devices ?? [];
  const count = data?.count ?? 0;
  const max = data?.max ?? null;
  const atLimit = max !== null && count >= max;

  return (
    <Card className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-foreground">Registered Devices</h2>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${atLimit ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {count}{max !== null ? ` / ${max}` : ""} seats
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {max !== null
          ? `This school has a limit of ${max} device${max === 1 ? "" : "s"}. Each unique device that logs in claims a permanent seat. Remove a device below to free up a slot.`
          : "No device limit is set. Any number of devices can log in."}
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          Could not load device data: {(error as Error)?.message ?? "unknown error"}
        </p>
      )}

      {!isLoading && !isError && devices.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No devices registered yet. Devices appear here after their first login.</p>
      )}

      {!isError && devices.length > 0 && (
        <div className="space-y-2">
          {devices.map(d => {
            const minsAgo = Math.round((Date.now() - d.lastSeen) / 60_000);
            const lastSeenStr = minsAgo < 60
              ? `${minsAgo}m ago`
              : minsAgo < 1440
                ? `${Math.round(minsAgo / 60)}h ago`
                : `${Math.round(minsAgo / 1440)}d ago`;
            return (
              <div key={d.deviceId} className="flex items-center justify-between gap-2 p-3 border border-border rounded-xl">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {d.fullName ?? d.username ?? <span className="italic text-muted-foreground">Unknown</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.role ? <span className="capitalize">{d.role.replace("_", " ")}</span> : null}
                    {d.ipAddress ? ` · ${d.ipAddress}` : null}
                    {` · last seen ${lastSeenStr}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeregister(d.deviceId)}
                  disabled={deregistering === d.deviceId}
                  className="shrink-0 px-2 py-1 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/8 transition-colors disabled:opacity-50"
                >
                  {deregistering === d.deviceId ? "…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => refetch()}
        className="text-xs text-primary hover:underline"
      >
        Refresh
      </button>
    </Card>
  );
}

export default function LocalServerInfo() {
  const { data, isLoading, isError } = useQuery<JoinInfo>({
    queryKey: ["join-info"],
    queryFn: () => fetch(`${API}/join-info`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  const { user } = useAuth();
  const sessionSchoolCode = user?.schoolCode ?? "";

  const [schoolCode, setSchoolCode] = useState("");

  return (
    <DashboardLayout allowedRoles={["school_admin", "teacher"]}>
    <div className="flex flex-col items-center gap-6 py-6">
      {/* QR / connection card */}
      <Card className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Connect to CBT Server</h1>

        {isLoading && (
          <p className="text-muted-foreground text-sm">Loading server info…</p>
        )}

        {isError && (
          <p className="text-destructive text-sm">
            Could not reach the local server. Make sure you are on the same network.
          </p>
        )}

        {data && (
          <>
            <p className="text-sm text-muted-foreground">
              Scan the QR code or open the URL below on student devices connected to the same Wi‑Fi network.
            </p>

            <img
              src={data.qrDataUrl}
              alt="QR code to join CBT server"
              className="mx-auto w-56 h-56 rounded-xl border border-border"
            />

            <div className="bg-primary/8 border border-primary/20 rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Primary (recommended)</p>
              <a
                href={data.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-mono text-sm break-all hover:underline font-bold"
              >
                {data.joinUrl}
              </a>
            </div>

            <div className="bg-muted rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Fallback — if primary doesn't resolve</p>
              <a
                href={data.joinUrlFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-mono text-sm break-all hover:underline"
              >
                {data.joinUrlFallback}
              </a>
            </div>

            <div className="bg-warning/8 border border-warning/25 rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-warning-foreground leading-relaxed">
                <span className="font-semibold">If the network changes during an exam</span>, students already connected may need to reload their page. Exam data is always saved on this computer — only the connection needs refreshing. The .local address usually self-heals on reconnect, but tell students to reload if their page stops responding.
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Registered devices (seat management) */}
      {sessionSchoolCode && <RegisteredDevicesSection schoolCode={sessionSchoolCode} />}

      {/* School code input for sync operations */}
      <Card className="w-full max-w-sm space-y-3">
        <h2 className="font-bold text-foreground">Sync Setup</h2>
        <p className="text-sm text-muted-foreground">
          Enter your school code to enable import/export below.
        </p>
        <Input
          type="text"
          placeholder="e.g. NEW-1001"
          value={schoolCode}
          onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
          className="font-mono uppercase tracking-wide"
        />
      </Card>

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
