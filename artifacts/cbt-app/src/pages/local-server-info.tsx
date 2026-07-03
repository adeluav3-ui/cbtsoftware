import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL as string;

interface JoinInfo {
  ip: string;
  port: number;
  joinUrl: string;
  qrDataUrl: string;
}

export default function LocalServerInfo() {
  const { data, isLoading, isError } = useQuery<JoinInfo>({
    queryKey: ["join-info"],
    queryFn: () => fetch(`${API}/join-info`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Connect to CBT Server</h1>

        {isLoading && (
          <p className="text-gray-500 text-sm">Loading server info...</p>
        )}

        {isError && (
          <p className="text-red-500 text-sm">
            Could not reach server. Make sure you are on the local network.
          </p>
        )}

        {data && (
          <>
            <p className="text-sm text-gray-500">
              Scan the QR code or open the URL below on student devices connected
              to the same Wi-Fi network.
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
              Server IP: {data.ip} &nbsp;|&nbsp; Port: {data.port}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
