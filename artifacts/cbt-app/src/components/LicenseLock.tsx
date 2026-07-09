import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface Props {
  error: "CLOCK_TAMPER" | "LICENSE_EXPIRED";
  licenseValidUntil?: string | null;
}

export function LicenseLock({ error, licenseValidUntil }: Props) {
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
              Your CBT Software license has expired. Please contact your
              administrator to renew it so exams can continue.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700 font-medium">
              Contact CBT Software support to renew your license and restore
              access.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
