import { useEffect, useState } from "react";
import apiClient from "../api/client";
import type { Birthday } from "../types";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

interface NewBirthday {
  name: string;
  receiveId: string;
  receiveIdType: string;
  month: string;
  day: string;
  message: string;
}

const defaultNew: NewBirthday = {
  name: "",
  receiveId: "",
  receiveIdType: "open_id",
  month: "",
  day: "",
  message: "",
};

export default function BirthdayWishes() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewBirthday>(defaultNew);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBirthdays = () =>
    apiClient
      .get<{ birthdays: Birthday[] }>("/birthdays")
      .then((r) => setBirthdays(r.data.birthdays))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/birthdays", {
        ...form,
        month: parseInt(form.month),
        day: parseInt(form.day),
      });
      setShowModal(false);
      setForm(defaultNew);
      fetchBirthdays();
      showToast("已新增生日記錄！");
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiClient.delete(`/birthdays/${id}`);
      setBirthdays((prev) => prev.filter((b) => b.id !== id));
      showToast("已刪除生日記錄");
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError(null);
    try {
      await apiClient.post(`/birthdays/${id}/test`);
      showToast("測試祝福已發送！");
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setTestingId(null);
    }
  };

  const monthDay = (b: Birthday) =>
    `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">生日快樂祝福</h1>
          <p className="text-gray-500 text-sm">每天 09:00（香港時間）自動發送祝福訊息</p>
        </div>
        <Button onClick={() => { setShowModal(true); setError(null); }}>
          + 新增生日
        </Button>
      </div>

      {toast && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : birthdays.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            尚無生日記錄，按「新增生日」開始
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b">
                <th className="text-left px-5 py-3">姓名</th>
                <th className="text-left px-5 py-3">Lark ID</th>
                <th className="text-left px-5 py-3">ID 類型</th>
                <th className="text-left px-5 py-3">生日（月-日）</th>
                <th className="text-left px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {birthdays.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{b.name}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{b.receiveId}</td>
                  <td className="px-5 py-3 text-gray-500">{b.receiveIdType}</td>
                  <td className="px-5 py-3 text-gray-700">{monthDay(b)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        loading={testingId === b.id}
                        onClick={() => handleTest(b.id)}
                      >
                        測試發送
                      </Button>
                      <Button
                        variant="danger"
                        loading={deletingId === b.id}
                        onClick={() => handleDelete(b.id)}
                      >
                        刪除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">新增生日記錄</h2>
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：陳大文"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lark ID *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.receiveId}
                  onChange={(e) => setForm({ ...form, receiveId: e.target.value })}
                  placeholder="ou_xxxxxxxxxx 或 user_id"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID 類型</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.receiveIdType}
                  onChange={(e) => setForm({ ...form, receiveIdType: e.target.value })}
                >
                  <option value="open_id">open_id</option>
                  <option value="user_id">user_id</option>
                  <option value="union_id">union_id</option>
                  <option value="email">email</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">月份 *</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                    placeholder="1-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: e.target.value })}
                    placeholder="1-31"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自訂祝福語（留空使用預設）
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  placeholder="🎂 生日快樂，{name}！祝你身體健康，萬事如意！"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  loading={saving}
                  onClick={handleAdd}
                  disabled={!form.name || !form.receiveId || !form.month || !form.day}
                >
                  新增
                </Button>
                <Button variant="ghost" onClick={() => { setShowModal(false); setError(null); }}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
