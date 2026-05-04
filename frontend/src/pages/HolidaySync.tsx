import { useState } from "react";
import apiClient from "../api/client";
import type { SyncResult } from "../types";
import Button from "../components/ui/Button";

export default function HolidaySync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiClient.post<SyncResult>("/holidays/sync");
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">香港國定假日同步</h1>
      <p className="text-gray-500 mb-2 text-sm">
        從政府1823 iCal 擷取香港公眾假期並建立至 Lark 日曆。
      </p>
      <p className="text-xs text-gray-400 mb-6">
        資料來源：
        <a
          href="https://www.1823.gov.hk/common/ical/gc/tc.ic"
          target="_blank"
          rel="noreferrer"
          className="text-lark-blue underline"
        >
          1823.gov.hk
        </a>
      </p>

      <Button loading={syncing} onClick={handleSync}>
        {syncing ? "同步中…" : "立即同步香港假期"}
      </Button>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "總計假期", value: result.total, color: "text-gray-700" },
              { label: "已建立", value: result.created, color: "text-green-600" },
              { label: "失敗", value: result.failed, color: "text-red-500" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 text-sm font-medium text-red-700 border-b border-red-100">
                失敗項目
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b">
                    <th className="text-left px-4 py-2">假期名稱</th>
                    <th className="text-left px-4 py-2">錯誤原因</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2 text-gray-700">{e.event}</td>
                      <td className="px-4 py-2 text-red-600 font-mono text-xs">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.failed === 0 && (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
              ✅ 所有假期已成功同步至 Lark 日曆！
            </div>
          )}
        </div>
      )}
    </div>
  );
}
