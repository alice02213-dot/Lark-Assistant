import { useEffect, useState } from "react";
import apiClient from "../api/client";
import type { LarkUser } from "../types";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";

const EMPLOYEE_TYPE: Record<number, string> = {
  1: "全職",
  2: "兼職",
  3: "顧問",
  4: "外包",
  5: "實習",
};

function statusBadge(status?: LarkUser["status"]) {
  if (!status) return null;
  if (status.is_resigned)
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">已離職</span>;
  if (status.is_frozen)
    return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">已凍結</span>;
  if (status.is_active)
    return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">在職</span>;
  return null;
}

export default function Users() {
  const [users, setUsers] = useState<LarkUser[]>([]);
  const [filtered, setFiltered] = useState<LarkUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fetched, setFetched] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get<{ users: LarkUser[]; total: number }>("/users")
      .then((r) => {
        setUsers(r.data.users);
        setFiltered(r.data.users);
        setFetched(true);
      })
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          (u.en_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.employee_no ?? "").toLowerCase().includes(q) ||
          (u.job_title ?? "").toLowerCase().includes(q)
      )
    );
  }, [search, users]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">組織成員</h1>
      <p className="text-gray-500 mb-6 text-sm">查看 Lark 組織中的所有用戶帳號</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!fetched ? (
        <div className="flex items-center gap-4">
          <Button onClick={fetchUsers} loading={loading}>
            載入成員列表
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-lark-blue"
              placeholder="搜尋姓名、郵箱、員工編號、職位…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-sm text-gray-400">
              共 {filtered.length} / {users.length} 人
            </span>
            <Button variant="ghost" onClick={fetchUsers} loading={loading}>
              重新整理
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">成員</th>
                    <th className="px-4 py-3">職位</th>
                    <th className="px-4 py-3">郵箱</th>
                    <th className="px-4 py-3">員工編號</th>
                    <th className="px-4 py-3">員工類型</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Open ID</th>
                    <th className="px-4 py-3">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        沒有符合條件的成員
                      </td>
                    </tr>
                  )}
                  {filtered.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.avatar?.avatar_72 ? (
                            <img
                              src={user.avatar.avatar_72}
                              alt={user.name ?? user.open_id}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-lark-blue text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {(user.name ?? user.open_id).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{user.name ?? <span className="text-gray-400 text-xs">{user.open_id}</span>}</div>
                            {user.en_name && (
                              <div className="text-xs text-gray-400">{user.en_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.job_title ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{user.email ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{user.employee_no ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {user.employee_type != null
                          ? (EMPLOYEE_TYPE[user.employee_type] ?? String(user.employee_type))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.user_id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.open_id}</td>
                      <td className="px-4 py-3">{statusBadge(user.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
