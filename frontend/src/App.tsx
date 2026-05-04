import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RoomBooking from "./pages/RoomBooking";
import HolidaySync from "./pages/HolidaySync";
import BirthdayWishes from "./pages/BirthdayWishes";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/rooms" replace />} />
        <Route path="/rooms" element={<RoomBooking />} />
        <Route path="/holidays" element={<HolidaySync />} />
        <Route path="/birthdays" element={<BirthdayWishes />} />
      </Route>
    </Routes>
  );
}
