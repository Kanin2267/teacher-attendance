"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const ADMIN_PASSWORD = "hrtvc147";

type Personnel = {
  id: string;
  full_name: string;
  category: "teacher" | "staff";
  unit_name: string;
  is_active: boolean;
};

type AttendanceLog = {
  id: string;
  personnel_id: string;
  full_name_snapshot: string;
  category_snapshot: "teacher" | "staff";
  unit_name_snapshot: string;
  check_in_at: string | null;
  check_out_at: string | null;
  login_email: string | null;
  check_out_email: string | null;
  login_user_id: string | null;
  check_out_user_id: string | null;
  created_at: string;
};

type TabType = "dashboard" | "teacher" | "staff" | "report";

export default function AdminPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState<TabType>("dashboard");

  const [people, setPeople] = useState<Personnel[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  const [fullName, setFullName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [activeCheckDate, setActiveCheckDate] = useState("");
  const [reportDate, setReportDate] = useState("");

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsLogin(true);
      setLoginError("");
    } else {
      setLoginError("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const getTodayBangkok = () => {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const loadSetting = async () => {
    const { data, error } = await supabase
      .from("attendance_settings")
      .select("active_check_date")
      .eq("id", 1)
      .single();

    if (error) {
      const today = getTodayBangkok();
      setActiveCheckDate(today);
      setReportDate(today);
      return;
    }

    setActiveCheckDate(data.active_check_date);
    setReportDate((current) => current || data.active_check_date);
  };

  const saveActiveDate = async () => {
    if (!activeCheckDate) {
      alert("กรุณาเลือกวันที่");
      return;
    }

    const { error } = await supabase
      .from("attendance_settings")
      .update({
        active_check_date: activeCheckDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      alert("บันทึกวันที่ไม่สำเร็จ: " + error.message);
      return;
    }

    alert("บันทึกวันที่เปิดให้เช็คชื่อเรียบร้อยแล้ว");
    setReportDate(activeCheckDate);
    loadLogs(activeCheckDate);
  };

  const loadPeople = async () => {
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("full_name", { ascending: true });

    if (error) {
      alert("โหลดรายชื่อไม่สำเร็จ: " + error.message);
      return;
    }

    setPeople(data || []);
  };

  const loadLogs = async (dateValue?: string) => {
    const selectedDate = dateValue || reportDate || activeCheckDate;

    if (!selectedDate) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("check_date", selectedDate)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert("โหลดรายงานไม่สำเร็จ: " + error.message);
      return;
    }

    setLogs(data || []);
  };

  const loadAll = async () => {
    setLoading(true);

    await loadSetting();
    await loadPeople();

    const dateToLoad = reportDate || activeCheckDate || getTodayBangkok();
    await loadLogs(dateToLoad);

    setLoading(false);
  };

  useEffect(() => {
    if (isLogin) {
      loadAll();
    }
  }, [isLogin]);

  useEffect(() => {
    if (isLogin && reportDate) {
      loadLogs(reportDate);
    }
  }, [reportDate, isLogin]);

  const currentCategory = tab === "teacher" ? "teacher" : "staff";

  const filteredPeople = useMemo(() => {
    if (tab !== "teacher" && tab !== "staff") return [];
    return people.filter((person) => person.category === currentCategory);
  }, [people, currentCategory, tab]);

  const resetForm = () => {
    setFullName("");
    setUnitName("");
    setEditingId(null);
  };

  const openTab = (newTab: TabType) => {
    setTab(newTab);
    resetForm();

    if (newTab === "dashboard" || newTab === "report") {
      loadPeople();
      loadLogs(reportDate);
    }
  };

  const savePersonnel = async () => {
    if (!fullName.trim() || !unitName.trim()) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const category = tab === "teacher" ? "teacher" : "staff";

    if (editingId) {
      const { error } = await supabase
        .from("personnel")
        .update({
          full_name: fullName.trim(),
          unit_name: unitName.trim(),
        })
        .eq("id", editingId);

      if (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
        return;
      }

      alert("แก้ไขข้อมูลเรียบร้อยแล้ว");
    } else {
      const { error } = await supabase.from("personnel").insert({
        full_name: fullName.trim(),
        category,
        unit_name: unitName.trim(),
      });

      if (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
        return;
      }

      alert("เพิ่มข้อมูลเรียบร้อยแล้ว");
    }

    resetForm();
    loadPeople();
  };

  const editPersonnel = (person: Personnel) => {
    setEditingId(person.id);
    setFullName(person.full_name);
    setUnitName(person.unit_name);
  };

  const deletePersonnel = async (id: string) => {
    const confirmDelete = confirm("ต้องการลบรายชื่อนี้ใช่หรือไม่");

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("personnel")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    alert("ลบรายชื่อเรียบร้อยแล้ว");
    loadPeople();
  };

  const formatTime = (value: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDateThai = (dateValue: string) => {
    if (!dateValue) return "-";

    return new Date(dateValue + "T00:00:00").toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getWorkStatus = (checkInAt: string | null) => {
    if (!checkInAt) {
      return {
        text: "ยังไม่เช็คชื่อเข้า",
        className: "rounded-full bg-slate-100 px-3 py-1 text-slate-600",
      };
    }

    const timeText = new Date(checkInAt).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const [hour, minute] = timeText.split(":").map(Number);

    if (hour > 8 || (hour === 8 && minute > 0)) {
      return {
        text: "สาย",
        className: "rounded-full bg-red-100 px-3 py-1 font-bold text-red-700",
      };
    }

    return {
      text: "มาทำงานเวลาปกติ",
      className:
        "rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700",
    };
  };

  const summary = useMemo(() => {
    const totalPeople = people.length;
    const teachers = people.filter((p) => p.category === "teacher").length;
    const staff = people.filter((p) => p.category === "staff").length;

    const checkedIn = logs.length;
    const checkedOut = logs.filter((log) => log.check_out_at).length;
    const notCheckedOut = logs.filter((log) => !log.check_out_at).length;
    const late = logs.filter(
      (log) => getWorkStatus(log.check_in_at).text === "สาย"
    ).length;
    const normal = logs.filter(
      (log) => getWorkStatus(log.check_in_at).text === "มาทำงานเวลาปกติ"
    ).length;

    return {
      totalPeople,
      teachers,
      staff,
      checkedIn,
      checkedOut,
      notCheckedOut,
      late,
      normal,
    };
  }, [people, logs]);

  const peoplePieData = [
    { name: "ครู", value: summary.teachers },
    { name: "เจ้าหน้าที่", value: summary.staff },
  ];

  const statusPieData = [
    { name: "มาปกติ", value: summary.normal },
    { name: "มาสาย", value: summary.late },
  ];

  const checkoutPieData = [
    { name: "เช็คออกแล้ว", value: summary.checkedOut },
    { name: "ยังไม่เช็คออก", value: summary.notCheckedOut },
  ];

  const COLORS = ["#1d4ed8", "#059669", "#dc2626", "#f59e0b"];

  const exportExcel = () => {
    if (!reportDate) {
      alert("กรุณาเลือกวันที่รายงาน");
      return;
    }

    const rows = logs.map((log, index) => ({
      ลำดับ: index + 1,
      วันที่รายงาน: formatDateThai(reportDate),
      "ชื่อ-สกุล": log.full_name_snapshot,
      ประเภท: log.category_snapshot === "teacher" ? "ครู" : "เจ้าหน้าที่",
      "แผนกวิชา/งาน": log.unit_name_snapshot,
      "อีเมลเช็คเข้า": log.login_email || "-",
      "อีเมลเช็คออก": log.check_out_email || "-",
      "เวลาเช็คชื่อเข้า": formatTime(log.check_in_at),
      "เวลาเช็คชื่อออก": formatTime(log.check_out_at),
      "วันเวลาเช็คชื่อเข้า": formatDateTime(log.check_in_at),
      "วันเวลาเช็คชื่อออก": formatDateTime(log.check_out_at),
      "สถานะการมาทำงาน": getWorkStatus(log.check_in_at).text,
      "สถานะเช็คออก": log.check_out_at
        ? "เช็คเข้า-ออกครบแล้ว"
        : "ยังไม่เช็คชื่อออก",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 30 },
      { wch: 18 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายงานเช็คชื่อ");

    XLSX.writeFile(
      workbook,
      `รายงานเช็คชื่อ_${reportDate}_วิทยาลัยอาชีวศึกษาธนบุรี.xlsx`
    );
  };

  if (!isLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <div className="text-center">
            <p className="text-sm tracking-widest text-slate-500">
              ADMIN LOGIN
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-800">
              เข้าสู่ระบบผู้ดูแล
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              ระบบรายงานการเช็คชื่อครูและเจ้าหน้าที่
            </p>
          </div>

          <div className="mt-6">
            <label className="mb-2 block font-semibold text-slate-700">
              รหัสผ่านผู้ดูแล
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-700"
              placeholder="กรอกรหัสผ่าน"
            />

            {loginError && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-center text-sm font-medium text-red-700">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="mt-5 w-full cursor-pointer rounded-xl bg-slate-800 p-3 font-bold text-white shadow hover:bg-slate-900"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm tracking-widest text-slate-300">
                ADMIN DASHBOARD
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                ระบบจัดการข้อมูลบุคลากรและรายงานเช็คชื่อ
              </h1>
              <p className="mt-1 text-slate-300">
                วิทยาลัยอาชีวศึกษาธนบุรี
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={loadAll}
                className="cursor-pointer rounded-xl bg-white px-5 py-3 font-bold text-slate-800 shadow hover:bg-slate-100"
              >
                รีเฟรชข้อมูล
              </button>

              <button
                onClick={exportExcel}
                className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white shadow hover:bg-emerald-700"
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-lg font-bold text-slate-800">
              กำหนดวันที่เปิดให้เช็คชื่อ
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              วันที่ปัจจุบันที่เปิดให้เช็คชื่อ:{" "}
              <b>{formatDateThai(activeCheckDate)}</b>
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="date"
                value={activeCheckDate}
                onChange={(e) => setActiveCheckDate(e.target.value)}
                className="rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-700"
              />

              <button
                onClick={saveActiveDate}
                className="cursor-pointer rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900"
              >
                บันทึกวันที่เช็คชื่อ
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-lg font-bold text-slate-800">
              เลือกวันที่รายงาน
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              รายงานที่แสดง: <b>{formatDateThai(reportDate)}</b>
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-700"
              />

              <button
                onClick={() => loadLogs(reportDate)}
                className="cursor-pointer rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800"
              >
                ดูรายงานวันที่เลือก
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <TabButton
            active={tab === "dashboard"}
            label="Dashboard"
            onClick={() => openTab("dashboard")}
          />
          <TabButton
            active={tab === "teacher"}
            label="จัดการรายชื่อครู"
            onClick={() => openTab("teacher")}
          />
          <TabButton
            active={tab === "staff"}
            label="จัดการรายชื่อเจ้าหน้าที่"
            onClick={() => openTab("staff")}
          />
          <TabButton
            active={tab === "report"}
            label="รายงานเช็คชื่อ"
            onClick={() => openTab("report")}
          />
        </div>

        {tab === "dashboard" && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard title="บุคลากรทั้งหมด" value={summary.totalPeople} />
              <SummaryCard title="ครู" value={summary.teachers} />
              <SummaryCard title="เจ้าหน้าที่" value={summary.staff} />
              <SummaryCard title="เช็คชื่อเข้าแล้ว" value={summary.checkedIn} />
              <SummaryCard title="มาทำงานปกติ" value={summary.normal} />
              <SummaryCard title="มาสาย" value={summary.late} />
              <SummaryCard title="เช็คออกแล้ว" value={summary.checkedOut} />
              <SummaryCard
                title="ยังไม่เช็คออก"
                value={summary.notCheckedOut}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <PieCard
                title="สัดส่วนบุคลากร"
                data={peoplePieData}
                colors={COLORS}
              />
              <PieCard
                title="สถานะการมาทำงาน"
                data={statusPieData}
                colors={COLORS}
              />
              <PieCard
                title="สถานะการเช็คชื่อออก"
                data={checkoutPieData}
                colors={COLORS}
              />
            </div>
          </>
        )}

        {(tab === "teacher" || tab === "staff") && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? "แก้ไขรายชื่อ" : "เพิ่มรายชื่อ"}
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block font-semibold text-slate-700">
                    ชื่อ-สกุล
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-700"
                    placeholder="กรอกชื่อ-สกุล"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-700">
                    {tab === "teacher" ? "แผนกวิชา" : "งาน"}
                  </label>
                  <input
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-700"
                    placeholder={
                      tab === "teacher"
                        ? "เช่น เทคโนโลยีสารสนเทศ"
                        : "เช่น งานทะเบียน"
                    }
                  />
                </div>

                <button
                  onClick={savePersonnel}
                  className="w-full cursor-pointer rounded-xl bg-emerald-600 p-3 font-bold text-white hover:bg-emerald-700"
                >
                  {editingId ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
                </button>

                {editingId && (
                  <button
                    onClick={resetForm}
                    className="w-full cursor-pointer rounded-xl bg-slate-200 p-3 font-bold text-slate-700 hover:bg-slate-300"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow lg:col-span-2">
              <h2 className="text-xl font-bold text-slate-800">
                {tab === "teacher" ? "รายชื่อครู" : "รายชื่อเจ้าหน้าที่"}
              </h2>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="border p-3">ลำดับ</th>
                      <th className="border p-3">ชื่อ-สกุล</th>
                      <th className="border p-3">
                        {tab === "teacher" ? "แผนกวิชา" : "งาน"}
                      </th>
                      <th className="border p-3">จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPeople.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="border p-6 text-center">
                          ยังไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      filteredPeople.map((person, index) => (
                        <tr key={person.id} className="hover:bg-slate-50">
                          <td className="border p-3 text-center">
                            {index + 1}
                          </td>
                          <td className="border p-3 font-medium">
                            {person.full_name}
                          </td>
                          <td className="border p-3">{person.unit_name}</td>
                          <td className="border p-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => editPersonnel(person)}
                                className="cursor-pointer rounded-lg bg-amber-500 px-3 py-2 font-bold text-white hover:bg-amber-600"
                              >
                                แก้ไข
                              </button>
                              <button
                                onClick={() => deletePersonnel(person.id)}
                                className="cursor-pointer rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700"
                              >
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "report" && (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  รายงานการเช็คชื่อ
                </h2>
                <p className="text-sm text-slate-500">
                  วันที่รายงาน: {formatDateThai(reportDate)}
                </p>
              </div>

              <button
                onClick={() => loadLogs(reportDate)}
                className="cursor-pointer rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900"
              >
                รีเฟรชรายงาน
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="border p-3">ลำดับ</th>
                    <th className="border p-3">ชื่อ-สกุล</th>
                    <th className="border p-3">ประเภท</th>
                    <th className="border p-3">แผนกวิชา/งาน</th>
                    <th className="border p-3">อีเมลเช็คเข้า</th>
                    <th className="border p-3">อีเมลเช็คออก</th>
                    <th className="border p-3">เวลาเข้า</th>
                    <th className="border p-3">เวลาออก</th>
                    <th className="border p-3">วันเวลาเข้า</th>
                    <th className="border p-3">วันเวลาออก</th>
                    <th className="border p-3">สถานะการมาทำงาน</th>
                    <th className="border p-3">สถานะเช็คออก</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="border p-6 text-center">
                        กำลังโหลดข้อมูล...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="border p-6 text-center">
                        ยังไม่มีข้อมูลเช็คชื่อในวันที่เลือก
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => {
                      const status = getWorkStatus(log.check_in_at);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="border p-3 text-center">
                            {index + 1}
                          </td>

                          <td className="border p-3 font-medium">
                            {log.full_name_snapshot}
                          </td>

                          <td className="border p-3 text-center">
                            {log.category_snapshot === "teacher"
                              ? "ครู"
                              : "เจ้าหน้าที่"}
                          </td>

                          <td className="border p-3">
                            {log.unit_name_snapshot}
                          </td>

                          <td className="border p-3">
                            {log.login_email || "-"}
                          </td>

                          <td className="border p-3">
                            {log.check_out_email || "-"}
                          </td>

                          <td className="border p-3 text-center">
                            {formatTime(log.check_in_at)}
                          </td>

                          <td className="border p-3 text-center">
                            {formatTime(log.check_out_at)}
                          </td>

                          <td className="border p-3 text-center">
                            {formatDateTime(log.check_in_at)}
                          </td>

                          <td className="border p-3 text-center">
                            {formatDateTime(log.check_out_at)}
                          </td>

                          <td className="border p-3 text-center">
                            <span className={status.className}>
                              {status.text}
                            </span>
                          </td>

                          <td className="border p-3 text-center">
                            {log.check_out_at ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                                เช็คครบแล้ว
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                                ยังไม่เช็คออก
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">
            ผู้พัฒนา: ครูคณิน สัจจารักษ์
          </p>
          <p>แผนกวิชาเทคโนโลยีสารสนเทศ</p>
        </div>
      </div>
    </main>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-xl px-5 py-3 font-bold shadow ${
        active ? "bg-slate-800 text-white" : "bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function PieCard({
  title,
  data,
  colors,
}: {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
              {data.map((entry, index) => (
                <Cell
                  key={`${title}-${entry.name}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}