import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { RefreshCw, X, WifiOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL as string;
const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === "true";

interface JoinInfo {
  ip: string;
  port: number;
  localHostname: string;
  joinUrl: string;
  joinUrlFallback: string;
  qrDataUrl: string;
}

// Outer guard: renders nothing in cloud builds or for students.
// Must be inside <QueryClientProvider> and <AuthProvider>.
export function LocalStatusBar() {
  if (!IS_LOCAL) return null;
  return <StatusBarInner />;
}

function StatusBarInner() {
  const { user } = useAuth();
  const [qrOpen, setQrOpen] = useState(false);
  const queryClient = useQueryClient();

  const isAllowed = !!user && (user.role === "school_admin" || user.role === "teacher");

  // All hooks must be called unconditionally — conditional return comes after
  const { data, isError } = useQuery<JoinInfo>({
    queryKey: ["join-info"],
    queryFn: () =>
      fetch(`${API}/join-info`).then((r) => {
        if (!r.ok) throw new Error("unreachable");
        return r.json();
      }),
    // Auto re-check every 30 s — detects IP change without manual refresh
    refetchInterval: 30_000,
    retry: false,
    enabled: isAllowed,
  });

  const { mutate: doRefresh, isPending: refreshing } = useMutation({
    mutationFn: () =>
      fetch(`${API}/join-info/refresh`, { method: "POST", credentials: "include" }).then((r) =>
        r.json()
      ),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["join-info"], fresh);
    },
  });

  if (!isAllowed) return null;

  const online = !isError && !!data;

  return (
    <>
      {/* ── Persistent status strip ─────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 px-4 bg-foreground text-primary-foreground border-b border-border/20 shadow-lg select-none"
        style={{ height: "44px" }}
      >
        {/* Connection indicator */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${online ? "bg-secondary" : "bg-destructive"}`}
          title={online ? "Server running" : "Server unreachable"}
        />

        {/* Address info */}
        <div className="flex-1 min-w-0 flex items-baseline gap-3 overflow-hidden">
          {online ? (
            <>
              <span
                className="font-mono font-bold text-secondary text-sm whitespace-nowrap tracking-tight"
                title="Primary address — share this with students"
              >
                {data.localHostname}:{data.port}
              </span>
              <span className="text-primary-foreground/40 text-[10px] whitespace-nowrap hidden sm:inline">
                if that doesn&apos;t work:{" "}
                <span className="font-mono text-primary-foreground/60">
                  {data.ip}:{data.port}
                </span>
              </span>
            </>
          ) : (
            <span className="text-destructive text-xs font-semibold flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              Network unreachable
            </span>
          )}
        </div>

        {/* Mini QR — click to expand */}
        {online && data.qrDataUrl && (
          <button
            onClick={() => setQrOpen(true)}
            title="Expand QR code for students to scan"
            className="shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
          >
            <img src={data.qrDataUrl} alt="QR" className="w-8 h-8 rounded bg-card p-0.5" />
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={() => doRefresh()}
          disabled={refreshing}
          title="Re-detect network address and refresh mDNS registration"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 active:bg-primary-foreground/30 transition-colors disabled:opacity-40 text-[11px] font-medium"
        >
          <RefreshCw className={`w-3 h-3 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshing ? "…" : "Refresh"}</span>
        </button>
      </div>

      {/* ── QR expand modal ─────────────────────────────────────────── */}
      {qrOpen && online && (
        <div
          className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border/50 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div>
              <h2 className="font-bold text-foreground text-lg">Connect Students</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Scan the QR code or open the URL in any browser on the same Wi‑Fi network.
              </p>
            </div>

            <img
              src={data.qrDataUrl}
              alt="QR code for student connection"
              className="mx-auto w-56 h-56 rounded-xl border border-border"
            />

            <div className="text-left space-y-2">
              <div className="bg-primary/8 border border-primary/20 rounded-xl px-3 py-2">
                <p className="text-[10px] text-primary font-semibold uppercase tracking-wide mb-0.5">
                  Primary (recommended)
                </p>
                <p className="font-mono text-sm text-primary font-bold break-all">
                  {data.joinUrl}
                </p>
              </div>
              <div className="bg-muted border border-border rounded-xl px-3 py-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">
                  Fallback — if primary doesn&apos;t resolve
                </p>
                <p className="font-mono text-sm text-foreground break-all">
                  {data.joinUrlFallback}
                </p>
              </div>
            </div>

            {/* Honest network stability note */}
            <div className="bg-warning/8 border border-warning/25 rounded-xl px-3 py-3 text-left">
              <p className="text-[11px] text-warning-foreground leading-relaxed">
                <span className="font-semibold">If the network changes during an exam</span>,
                students already connected may need to reload their page. Exam data is always
                saved on this computer — only the connection needs refreshing. The .local address
                usually self-heals when a device reconnects to Wi‑Fi, but tell students to reload
                if their page stops responding.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
