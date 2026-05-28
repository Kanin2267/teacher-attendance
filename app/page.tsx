"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const ALLOWED_EMAIL_DOMAIN = "@thonburi.ac.th";

type Personnel = {
  id: string;
  full_name: string;
  category: "teacher" | "staff";
  unit_name: string;
};

export default function Home() {
  const [people, setPeople] = useState<Personnel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeCheckDate, setActiveCheckDate] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const isAllowedEmail = (email?: string | null) => {
    if (!email) return false;
    return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
  };

  const loadPeople = async () => {
    const { data, error } = await supabase
      .from("personnel")
      .select("id, full_name, category, unit_name")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("full_name", { ascending: true });

    if (error) {
      setMessage("โหลดรายชื่อไม่สำเร็จ: " + error.message);
      return;
    }

    setPeople(data || []);
  };

  const loadActiveDate = async () => {
    const { data, error } = await supabase
      .from("attendance_settings")
      .select("active_check_date")
      .eq("id", 1)
      .single();

    if (error) {
      setMessage("โหลดวันที่เช็คชื่อไม่สำเร็จ: " + error.message);
      return;
    }

    setActiveCheckDate(data.active_check_date);
  };

  useEffect(() => {
    loadPeople();
    loadActiveDate();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !isAllowedEmail(user.email)) {
        await supabase.auth.signOut();
        setUser(null);
        setMessage("อนุญาตเฉพาะอีเมล @thonburi.ac.th เท่านั้น");
      } else {
        setUser(user);
      }

      setAuthLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      if (currentUser && !isAllowedEmail(currentUser.email)) {
        await supabase.auth.signOut();
        setUser(null);
        setMessage("อนุญาตเฉพาะอีเมล @thonburi.ac.th เท่านั้น");
        return;
      }

      setUser(currentUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const filteredPeople = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword || selectedPerson) return [];

    return people.filter((person) => {
      return (
        person.full_name.toLowerCase().includes(keyword) ||
        person.unit_name.toLowerCase().includes(keyword)
      );
    });
  }, [search, people, selectedPerson]);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage("เข้าสู่ระบบด้วย Google ไม่สำเร็จ: " + error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSelectedPerson(null);
    setSearch("");
    setMessage("");
  };

  const getBangkokTimeText = (date: Date) => {
    return date.toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getBangkokHourMinute = (date: Date) => {
    const timeText = date.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const [hour, minute] = timeText.split(":").map(Number);
    return { hour, minute };
  };

  const currentDateText = currentTime.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const currentTimeText = currentTime.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const activeDateText = activeCheckDate
    ? new Date(activeCheckDate + "T00:00:00").toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const checkIn = async () => {
    setMessage("");

    if (!user?.email) {
      setMessage("กรุณาเข้าสู่ระบบด้วย Google ก่อนเช็คชื่อ");
      return;
    }

    if (!isAllowedEmail(user.email)) {
      await supabase.auth.signOut();
      setUser(null);
      setMessage("อนุญาตเฉพาะอีเมล @thonburi.ac.th เท่านั้น");
      return;
    }

    if (!activeCheckDate) {
      setMessage("ยังไม่ได้กำหนดวันที่เช็คชื่อ");
      return;
    }

    if (!selectedPerson) {
      setMessage("กรุณาค้นหาและเลือกรายชื่อก่อนเช็คชื่อเข้า");
      return;
    }

    setLoading(true);

    const { data: existingData, error: existingError } = await supabase
      .from("attendance_logs")
      .select("id, check_in_at")
      .eq("personnel_id", selectedPerson.id)
      .eq("check_date", activeCheckDate)
      .maybeSingle();

    if (existingError) {
      setLoading(false);
      setMessage("เกิดข้อผิดพลาด: " + existingError.message);
      return;
    }

    if (existingData?.check_in_at) {
      setLoading(false);
      alert("เช็คชื่อออนไลน์\nมีข้อมูลบันทึกเข้าอยู่แล้ว");
      setMessage("มีข้อมูลบันทึกเข้าอยู่แล้ว");
      return;
    }

    const now = new Date();

    const { error } = await supabase.from("attendance_logs").insert({
      personnel_id: selectedPerson.id,
      full_name_snapshot: selectedPerson.full_name,
      category_snapshot: selectedPerson.category,
      unit_name_snapshot: selectedPerson.unit_name,
      check_date: activeCheckDate,
      check_in_at: now.toISOString(),
      login_email: user.email,
      login_user_id: user.id,
    });

    setLoading(false);

    if (error) {
      setMessage("เกิดข้อผิดพลาด: " + error.message);
    } else {
      alert("เช็คชื่อออนไลน์\nคุณได้ลงเวลาทำงานเรียบร้อยแล้ว");
      setMessage(`บันทึกเวลาเข้าเรียบร้อย: ${selectedPerson.full_name}`);
      setSearch("");
      setSelectedPerson(null);
    }
  };

  const checkOut = async () => {
    setMessage("");

    if (!user?.email) {
      setMessage("กรุณาเข้าสู่ระบบด้วย Google ก่อนเช็คชื่อ");
      return;
    }

    if (!isAllowedEmail(user.email)) {
      await supabase.auth.signOut();
      setUser(null);
      setMessage("อนุญาตเฉพาะอีเมล @thonburi.ac.th เท่านั้น");
      return;
    }

    if (!activeCheckDate) {
      setMessage("ยังไม่ได้กำหนดวันที่เช็คชื่อ");
      return;
    }

    if (!selectedPerson) {
      setMessage("กรุณาค้นหาและเลือกรายชื่อก่อนเช็คชื่อออก");
      return;
    }

    const now = new Date();
    const { hour, minute } = getBangkokHourMinute(now);

    if (hour < 16) {
      alert(
        "เช็คชื่อออนไลน์\nยังไม่ถึงเวลาเช็คชื่อออก กรุณาเช็คชื่อออกหลังเวลา 16.00 น."
      );
      setMessage("ยังไม่ถึงเวลาเช็คชื่อออก กรุณาเช็คชื่อออกหลังเวลา 16.00 น.");
      return;
    }

    if (hour > 20 || (hour === 20 && minute > 30)) {
      alert("เช็คชื่อออนไลน์\nเกินเวลาเช็คชื่อออกแล้ว ไม่สามารถเช็คชื่อออกได้");
      setMessage("เกินเวลาเช็คชื่อออกแล้ว ไม่สามารถเช็คชื่อออกได้");
      return;
    }

    setLoading(true);

    const { data, error: findError } = await supabase
      .from("attendance_logs")
      .select("id, check_in_at, check_out_at")
      .eq("personnel_id", selectedPerson.id)
      .eq("check_date", activeCheckDate)
      .maybeSingle();

    if (findError) {
      setLoading(false);
      setMessage("เกิดข้อผิดพลาด: " + findError.message);
      return;
    }

    if (!data || !data.check_in_at) {
      setLoading(false);
      alert("เช็คชื่อออนไลน์\nยังไม่มีข้อมูลบันทึกเข้า ไม่สามารถบันทึกออกได้");
      setMessage("ยังไม่มีข้อมูลบันทึกเข้า ไม่สามารถบันทึกออกได้");
      return;
    }

    if (data.check_out_at) {
      setLoading(false);
      alert("เช็คชื่อออนไลน์\nมีข้อมูลบันทึกออกอยู่แล้ว");
      setMessage("มีข้อมูลบันทึกออกอยู่แล้ว");
      return;
    }

    const outTimeText = getBangkokTimeText(now);

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        check_out_at: now.toISOString(),
        check_out_email: user.email,
        check_out_user_id: user.id,
      })
      .eq("id", data.id);

    setLoading(false);

    if (error) {
      setMessage("เกิดข้อผิดพลาด: " + error.message);
    } else {
      alert(`เช็คชื่อออนไลน์\nคุณลงชื่อออกเวลา ${outTimeText} เรียบร้อยแล้ว`);
      setMessage(`บันทึกเวลาออก ${outTimeText} เรียบร้อยแล้ว`);
      setSearch("");
      setSelectedPerson(null);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="font-semibold text-slate-700">
            กำลังตรวจสอบการเข้าสู่ระบบ...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center px-4"
        style={{
          backgroundImage: "url('/login-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" />

        <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/90 p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <div className="rounded-full bg-white p-2 shadow">
                <Image
                  src="/logo.jpg"
                  alt="โลโก้วิทยาลัยอาชีวศึกษาธนบุรี"
                  width={110}
                  height={110}
                  className="rounded-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-800">
              ระบบเข้าออกออนไลน์
            </h1>

            <p className="mt-2 text-slate-600">วิทยาลัยอาชีวศึกษาธนบุรี</p>

            <p className="mt-4 text-sm text-slate-600">
              กรุณาเข้าสู่ระบบด้วยบัญชี Google ของวิทยาลัยเท่านั้น
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              ใช้อีเมล @thonburi.ac.th
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            className="mt-6 w-full cursor-pointer rounded-xl bg-slate-800 p-3 font-bold text-white shadow hover:bg-slate-900"
          >
            เข้าสู่ระบบด้วย Google
          </button>

          {message && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center font-medium text-amber-800">
              {message}
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700">
              ผู้พัฒนา: ครูคณิน สัจจารักษ์
            </p>
            <p>แผนกวิชาเทคโนโลยีสารสนเทศ</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-slate-800 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="rounded-full bg-white p-2 shadow-lg">
              <Image
                src="/logo.jpg"
                alt="โลโก้วิทยาลัยอาชีวศึกษาธนบุรี"
                width={120}
                height={120}
                className="rounded-full object-cover"
              />
            </div>
          </div>

          <p className="text-sm tracking-widest text-slate-300">
            วิทยาลัยอาชีวศึกษาธนบุรี
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            ระบบเข้าออกครูและเจ้าหน้าที่ออนไลน์
          </h1>

          <p className="mt-2 text-slate-300">
            วันที่เปิดให้เช็คชื่อ: {activeDateText}
          </p>

          <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-slate-600 bg-slate-900/40 px-5 py-4">
            <p className="text-sm text-slate-300">เวลาปัจจุบัน</p>
            <p className="mt-1 text-4xl font-bold tracking-wider text-white">
              {currentTimeText}
            </p>
            <p className="mt-1 text-sm text-slate-300">{currentDateText}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                เข้าสู่ระบบด้วย: <b>{user.email}</b>
              </span>

              <button
                onClick={logout}
                className="cursor-pointer rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700 hover:bg-red-200"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <label className="mb-2 block font-semibold text-slate-700">
              ค้นหารายชื่อ
            </label>

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedPerson(null);
                setMessage("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-slate-700"
              placeholder="พิมพ์ชื่อ-สกุล / แผนกวิชา / งาน"
            />

            {search && !selectedPerson && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border bg-white">
                {filteredPeople.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    ไม่พบรายชื่อ
                  </div>
                ) : (
                  filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        setSelectedPerson(person);
                        setSearch(person.full_name);
                        setMessage("");
                      }}
                      className="block w-full cursor-pointer border-b p-4 text-left hover:bg-slate-50"
                    >
                      <div className="font-bold text-slate-800">
                        {person.full_name}
                      </div>

                      <div className="text-sm text-slate-500">
                        {person.category === "teacher" ? "ครู" : "เจ้าหน้าที่"} |{" "}
                        {person.category === "teacher" ? "แผนกวิชา" : "งาน"}{" "}
                        {person.unit_name}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedPerson && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-bold text-emerald-800">
                  รายชื่อที่เลือก: {selectedPerson.full_name}
                </p>

                <p className="text-sm text-emerald-700">
                  {selectedPerson.category === "teacher" ? "ครู" : "เจ้าหน้าที่"} |{" "}
                  {selectedPerson.category === "teacher" ? "แผนกวิชา" : "งาน"}{" "}
                  {selectedPerson.unit_name}
                </p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={checkIn}
                disabled={loading}
                className="cursor-pointer rounded-xl bg-emerald-600 p-3 font-bold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ยืนยันเช็คชื่อเข้า
              </button>

              <button
                onClick={checkOut}
                disabled={loading}
                className="cursor-pointer rounded-xl bg-blue-700 p-3 font-bold text-white shadow hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ยืนยันเช็คชื่อออก
              </button>
            </div>

            {message && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center font-medium text-amber-800">
                {message}
              </div>
            )}
          </div>

          <div className="mt-5 text-center text-sm text-slate-500">
            <p>เช็คชื่อออกได้เฉพาะเวลา 16.00–20.30 น.</p>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="font-semibold text-slate-700">
                ผู้พัฒนา: ครูคณิน สัจจารักษ์
              </p>
              <p>แผนกวิชาเทคโนโลยีสารสนเทศ</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}