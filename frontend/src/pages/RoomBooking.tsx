import { useEffect, useState } from "react";
import apiClient from "../api/client";
import type { Room } from "../types";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

interface BookForm {
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string;
}

const defaultForm: BookForm = {
  calendarId: "primary",
  summary: "",
  description: "",
  startTime: "",
  endTime: "",
  attendeeEmails: "",
};

export default function RoomBooking() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [form, setForm] = useState<BookForm>(defaultForm);
  const [booking, setBooking] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ rooms: Room[] }>("/rooms")
      .then((r) => setRooms(r.data.rooms))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleBook = async () => {
    if (!selected) return;
    setBooking(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const emails = form.attendeeEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      await apiClient.post("/rooms/book", {
        ...form,
        roomId: selected.room_id,
        attendeeEmails: emails,
      });
      setSuccessMsg(`已成功預約「${selected.name}」！`);
      setSelected(null);
      setForm(defaultForm);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">預約會議室</h1>
      <p className="text-gray-500 mb-6 text-sm">選擇會議室並填寫預約資料</p>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.length === 0 && (
            <p className="text-gray-400 col-span-full text-center py-12">
              沒有可用的會議室
            </p>
          )}
          {rooms.map((room) => (
            <div
              key={room.room_id}
              onClick={() => {
                setSelected(room);
                setSuccessMsg(null);
                setError(null);
              }}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-shadow ${
                selected?.room_id === room.room_id
                  ? "border-lark-blue bg-lark-light shadow-md"
                  : "border-gray-200 bg-white hover:border-lark-blue hover:shadow-sm"
              }`}
            >
              <div className="text-base font-semibold text-gray-800">{room.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                {room.building_name} · {room.floor_name}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-lark-blue bg-lark-light rounded-full px-2 py-0.5">
                👥 容納 {room.capacity} 人
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            預約「{selected.name}」
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日曆 ID
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                value={form.calendarId}
                onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
                placeholder="primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                會議主題 *
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="例：週會"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="選填"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始時間 *
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  結束時間 *
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                參與者郵箱（逗號分隔）
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lark-blue"
                value={form.attendeeEmails}
                onChange={(e) => setForm({ ...form, attendeeEmails: e.target.value })}
                placeholder="a@example.com, b@example.com"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                loading={booking}
                onClick={handleBook}
                disabled={!form.summary || !form.startTime || !form.endTime}
              >
                確認預約
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
