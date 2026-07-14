import os from "node:os";
import QRCode from "qrcode";

interface JoinInfo {
  ip: string;
  port: number;
  localHostname: string;    // e.g. "laptop-abc.local"
  joinUrl: string;          // primary: http://hostname.local:port
  joinUrlFallback: string;  // fallback: http://ip:port
  qrDataUrl: string;        // QR encodes joinUrl (.local address)
}

let _joinInfo: JoinInfo | null = null;
let _port: number = 8080;
let _bonjourInstance: any = null;
let _bonjourService: any = null;

export function getJoinInfo(): JoinInfo | null {
  return _joinInfo;
}

// Virtual/loopback adapter name fragments to skip — these are never the
// real LAN interface and confuse IP detection on machines running VMware,
// VirtualBox, Hyper-V, WSL, or similar tools.
const VIRTUAL_ADAPTER_PATTERNS = [
  /vmware/i, /virtualbox/i, /vethernet/i, /hyper.?v/i,
  /wsl/i, /loopback/i, /pseudo/i, /tap/i, /tunnel/i,
  /bluetooth/i, /teredo/i, /isatap/i, /6to4/i,
];

function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  const candidates: Array<{ name: string; address: string }> = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (VIRTUAL_ADAPTER_PATTERNS.some(p => p.test(name))) continue;
    for (const iface of (addrs ?? [])) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Prefer Wi-Fi / Wireless adapters
  const wifi = candidates.find(c => /wi.?fi|wireless|wlan/i.test(c.name));
  if (wifi) return wifi.address;

  // Prefer Ethernet next
  const eth = candidates.find(c => /ethernet|local area connection/i.test(c.name));
  if (eth) return eth.address;

  // Fall back to whatever's left
  return candidates[0].address;
}

// Re-detect LAN IP and (if it changed) re-register mDNS. Call this
// from the /join-info/refresh endpoint or on a periodic timer.
export async function refreshJoinInfo(): Promise<JoinInfo | null> {
  if (!_joinInfo) return null;
  const ip = getLanIp() ?? "localhost";
  const ipChanged = ip !== _joinInfo.ip;

  _joinInfo = {
    ..._joinInfo,
    ip,
    joinUrlFallback: `http://${ip}:${_port}`,
  };

  if (ipChanged && _bonjourInstance) {
    if (_bonjourService) {
      try { _bonjourService.stop(); } catch {}
      _bonjourService = null;
    }
    try {
      _bonjourService = _bonjourInstance.publish({ name: "CBT Server", type: "http", port: _port });
    } catch {}
  }

  return _joinInfo;
}

export async function localStartup(port: number): Promise<void> {
  _port = port;
  const ip = getLanIp() ?? "localhost";
  const rawHostname = os.hostname().toLowerCase();
  const localHostname = `${rawHostname}.local`;
  const joinUrl = `http://${localHostname}:${port}`;
  const joinUrlFallback = `http://${ip}:${port}`;

  // QR encodes the .local address (primary). Even if the underlying IP
  // changes, a browser tab opened from this URL can re-resolve via mDNS.
  const [terminalQr, qrDataUrl] = await Promise.all([
    QRCode.toString(joinUrl, { type: "terminal", small: true }),
    QRCode.toDataURL(joinUrl, { width: 300, margin: 2 }),
  ]);

  _joinInfo = { ip, port, localHostname, joinUrl, joinUrlFallback, qrDataUrl };

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║        CBT LOCAL SERVER READY         ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`\n  Primary : ${joinUrl}`);
  console.log(`  Fallback: ${joinUrlFallback}`);
  console.log("  Share the primary URL or QR code with students.\n");
  console.log(terminalQr);

  try {
    const { Bonjour } = await import("bonjour-service");
    _bonjourInstance = new Bonjour();
    _bonjourService = _bonjourInstance.publish({ name: "CBT Server", type: "http", port });
    console.log(`  mDNS: ${joinUrl}\n`);
  } catch {
    // mDNS is optional — some Windows machines block multicast
  }
}
