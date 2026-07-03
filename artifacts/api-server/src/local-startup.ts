import os from "node:os";
import QRCode from "qrcode";

interface JoinInfo {
  ip: string;
  port: number;
  joinUrl: string;
  qrDataUrl: string;
}

let _joinInfo: JoinInfo | null = null;

export function getJoinInfo(): JoinInfo | null {
  return _joinInfo;
}

function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of (ifaces[name] ?? [])) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

export async function localStartup(port: number): Promise<void> {
  const ip = getLanIp() ?? "localhost";
  const joinUrl = `http://${ip}:${port}`;

  const [terminalQr, qrDataUrl] = await Promise.all([
    QRCode.toString(joinUrl, { type: "terminal", small: true }),
    QRCode.toDataURL(joinUrl, { width: 300, margin: 2 }),
  ]);

  _joinInfo = { ip, port, joinUrl, qrDataUrl };

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║        CBT LOCAL SERVER READY         ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`\n  URL: ${joinUrl}`);
  console.log("  Share this URL or QR code with students.\n");
  console.log(terminalQr);

  // Register on the LAN via mDNS so students can reach cbt-server.local
  try {
    const { Bonjour } = await import("bonjour-service");
    const bonjour = new Bonjour();
    bonjour.publish({ name: "CBT Server", type: "http", port });
    console.log(`  mDNS: http://cbt-server.local:${port}\n`);
  } catch {
    // mDNS is optional — some Windows machines block multicast
  }
}
