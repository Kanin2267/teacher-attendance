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

type RpcResult = {
  status: string;
  message: string;
  server_time: string;
};

type ClockBase = {
  serverMs: number;
  performanceMs: number;
};

export default function Home() {
  const [people, setPeople] = useState<Personnel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockBase, setClockBase] = useState<ClockBase | null>(null);
  const [activeCheckDate, setActiveCheckDate] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const isAllowedEmail = (email?: string | null) => {
    if (!email) return false;
    return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
  };

  const loadServerClock = async () => {
    const { data, error } = await supabase.rpc("get_server_time");

    if (error || !data) {
      setMessage("โหลดเวลา Server ไม่สำเร็จ");
      return;
    }

    const serverDate = new Date(data as string);

    setClockBase({
      serverMs: serverDate.getTime(),
      performanceMs: performance.now(),
    });

    setCurrentTime(serverDate);
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
    loadServerClock();
    loadPeople();
    loadActiveDate();
  }, []);

  useEffect(() => {
    if (!clockBase) return;

    const timer = setInterval(() => {
      const elapsedMs = performance.now() - clockBase.performanceMs;
      setCurrentTime(new Date(clockBase.serverMs + elapsedMs));
    }, 1000);

    return () => clearInterval(timer);
  }, [clockBase]);

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

  const getBangkokTimeText = (dateValue: string | Date) => {
    const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;

    return date.toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
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
        timeZone: "Asia/Bangkok",
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

    const { data, error } = await supabase.rpc("check_in_attendance", {
      p_personnel_id: selectedPerson.id,
      p_check_date: activeCheckDate,
      p_login_email: user.email,
      p_login_user_id: user.id,
    });

    setLoading(false);

    if (error) {
      setMessage("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    const result = data as RpcResult;

    if (result.status === "success") {
      const serverTimeText = getBangkokTimeText(result.server_time);

      alert(
        `เช็คชื่อออนไลน์\nคุณได้ลงเวลาทำงานเวลา ${serverTimeText} เรียบร้อยแล้ว`
      );

      setMessage(
        `บันทึกเวลาเข้า ${serverTimeText} เรียบร้อย: ${selectedPerson.full_name}`
      );
      setSearch("");
      setSelectedPerson(null);
      loadServerClock();
      return;
    }

    if (result.status === "duplicate_in") {
      alert("เช็คชื่อออนไลน์\nมีข้อมูลบันทึกเข้าอยู่แล้ว");
      setMessage("มีข้อมูลบันทึกเข้าอยู่แล้ว");
      return;
    }

    alert(`เช็คชื่อออนไลน์\n${result.message}`);
    setMessage(result.message);
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

    setLoading(true);

    const { data, error } = await supabase.rpc("check_out_attendance", {
      p_personnel_id: selectedPerson.id,
      p_check_date: activeCheckDate,
      p_check_out_email: user.email,
      p_check_out_user_id: user.id,
    });

    setLoading(false);

    if (error) {
      setMessage("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    const result = data as RpcResult;

    if (result.status === "success") {
      const outTimeText = getBangkokTimeText(result.server_time);

      alert(`เช็คชื่อออนไลน์\nคุณลงชื่อออกเวลา ${outTimeText} เรียบร้อยแล้ว`);

      setMessage(`บันทึกเวลาออก ${outTimeText} เรียบร้อยแล้ว`);
      setSearch("");
      setSelectedPerson(null);
      loadServerClock();
      return;
    }

    if (result.status === "too_early") {
      alert(
        "เช็คชื่อออนไลน์\nยังไม่ถึงเวลาเช็คชื่อออก กรุณาเช็คชื่อออกหลังเวลา 16.00 น."
      );
      setMessage("ยังไม่ถึงเวลาเช็คชื่อออก กรุณาเช็คชื่อออกหลังเวลา 16.00 น.");
      return;
    }

    if (result.status === "too_late") {
      alert("เช็คชื่อออนไลน์\nเกินเวลาเช็คชื่อออกแล้ว ไม่สามารถเช็คชื่อออกได้");
      setMessage("เกินเวลาเช็คชื่อออกแล้ว ไม่สามารถเช็คชื่อออกได้");
      return;
    }

    if (result.status === "duplicate_out") {
      alert("เช็คชื่อออนไลน์\nมีข้อมูลบันทึกออกอยู่แล้ว");
      setMessage("มีข้อมูลบันทึกออกอยู่แล้ว");
      return;
    }

    if (result.status === "no_check_in") {
      alert("เช็คชื่อออนไลน์\nยังไม่มีข้อมูลบันทึกเข้า ไม่สามารถบันทึกออกได้");
      setMessage("ยังไม่มีข้อมูลบันทึกเข้า ไม่สามารถบันทึกออกได้");
      return;
    }

    alert(`เช็คชื่อออนไลน์\n${result.message}`);
    setMessage(result.message);
  };

  if (authLoading) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center px-4"
        style={{
          backgroundImage: "url('/checkin-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-purple-950/70" />
        <div className="relative animate-soft-zoom rounded-3xl border border-white/30 bg-white/90 px-8 py-6 text-center shadow-2xl backdrop-blur-md">
          <p className="text-lg font-semibold text-purple-950">
            กำลังตรวจสอบการเข้าสู่ระบบ...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center px-4 py-10"
        style={{
          backgroundImage: "url('/checkin-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-purple-950/70" />

        <div className="relative z-10 w-full max-w-md animate-soft-fade-up overflow-hidden rounded-[34px] border border-white/25 bg-white/95 shadow-2xl backdrop-blur-md">
          <div className="bg-tvc-purple-dark px-8 py-8 text-center text-white">
            <div className="mx-auto mb-4 flex justify-center">
              <div className="animate-slow-float rounded-full bg-white p-2 shadow-xl">
                <Image
                  src="/logo.jpg"
                  alt="โลโก้วิทยาลัยอาชีวศึกษาธนบุรี"
                  width={112}
                  height={112}
                  className="rounded-full object-cover"
                />
              </div>
            </div>

            <p className="text-xs tracking-[0.28em] text-purple-100">
              THONBURI VOCATIONAL COLLEGE
            </p>

            <h1 className="mt-3 text-2xl font-bold">
              ระบบเข้าออกออนไลน์
            </h1>

            <p className="mt-2 text-sm text-purple-100">
              วิทยาลัยอาชีวศึกษาธนบุรี
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="mb-5 rounded-2xl border border-purple-100 bg-purple-50 p-4 text-center">
              <p className="text-sm text-purple-800">
                กรุณาเข้าสู่ระบบด้วยบัญชี Google ของวิทยาลัย
              </p>
              <p className="mt-1 font-bold text-purple-950">
                ใช้อีเมล @thonburi.ac.th เท่านั้น
              </p>
            </div>

            <button
              onClick={loginWithGoogle}
              className="animate-glow-pulse w-full cursor-pointer rounded-2xl bg-purple-800 px-5 py-4 text-base font-bold text-white shadow-lg transition hover:bg-purple-950"
            >
              เข้าสู่ระบบด้วย Gmail
            </button>

            {message && (
              <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
                {message}
              </div>
            )}

            <div className="mt-6 border-t border-purple-100 pt-5 text-center text-sm text-slate-500">
              <p className="font-semibold text-purple-950">
                ผู้พัฒนา: ครูคณิน สัจจารักษ์
              </p>
              <p>แผนกวิชาเทคโนโลยีสารสนเทศ</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen px-4 py-6 md:px-6 md:py-10"
      style={{
        backgroundImage: "url('/checkin-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-purple-950/75" />

      <div className="relative z-10 mx-auto max-w-7xl animate-soft-fade-up">
        <div className="mb-6 overflow-hidden rounded-[34px] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
          <div className="bg-tvc-purple-dark px-6 py-8 text-white md:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="mx-auto rounded-full bg-white p-2 shadow-xl sm:mx-0">
                  <Image
                    src="/logo.jpg"
                    alt="โลโก้วิทยาลัยอาชีวศึกษาธนบุรี"
                    width={100}
                    height={100}
                    className="rounded-full object-cover"
                  />
                </div>

                <div className="text-center sm:text-left">
                  <p className="text-xs tracking-[0.3em] text-purple-100">
                    THONBURI VOCATIONAL COLLEGE
                  </p>
                  <h1 className="mt-2 text-2xl font-bold md:text-3xl">
                    ระบบเข้าออกครูและเจ้าหน้าที่ออนไลน์
                  </h1>
                  <p className="mt-2 text-sm text-purple-100 md:text-base">
                    วิทยาลัยอาชีวศึกษาธนบุรี
                  </p>
                  <p className="mt-1 text-sm text-purple-100">
                    วันที่เปิดให้เช็คชื่อ: {activeDateText}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[380px]">
                <InfoBox label="เวลา Server ปัจจุบัน" value={currentTimeText} />
                <InfoBox label="วันที่ปัจจุบัน" value={currentDateText} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="overflow-hidden rounded-[34px] border border-white/25 bg-white/95 shadow-2xl lg:col-span-2">
            <div className="border-b border-purple-100 bg-purple-50 px-6 py-5 md:px-8">
              <h2 className="text-xl font-bold text-purple-950">
                บันทึกเวลาเข้า - ออก
              </h2>
              <p className="mt-1 text-sm text-purple-700">
                กรุณาค้นหารายชื่อของท่าน และยืนยันการลงเวลาโดยใช้บัญชีอีเมลของวิทยาลัย
              </p>
            </div>

            <div className="px-6 py-6 md:px-8 md:py-8">
              <div className="mb-6 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      ผู้ใช้งานที่เข้าสู่ระบบ
                    </p>
                    <p className="mt-1 font-semibold text-purple-950">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={logout}
                    className="cursor-pointer rounded-xl bg-red-100 px-4 py-3 font-bold text-red-700 transition hover:bg-red-200"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5">
                <label className="mb-2 block text-sm font-semibold text-purple-950">
                  ค้นหารายชื่อบุคลากร
                </label>

                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedPerson(null);
                    setMessage("");
                  }}
                  className="w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-purple-800 focus:ring-2 focus:ring-purple-200"
                  placeholder="พิมพ์ชื่อ-สกุล / แผนกวิชา / งาน"
                />

                {search && !selectedPerson && (
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-purple-100 bg-white shadow-sm">
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
                          className="block w-full cursor-pointer border-b border-purple-50 px-4 py-4 text-left transition hover:bg-purple-50"
                        >
                          <div className="font-bold text-purple-950">
                            {person.full_name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {person.category === "teacher" ? "ครู" : "เจ้าหน้าที่"}{" "}
                            |{" "}
                            {person.category === "teacher"
                              ? `แผนกวิชา ${person.unit_name}`
                              : `งาน ${person.unit_name}`}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedPerson && (
                  <div className="mt-4 animate-soft-zoom rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-sm text-emerald-700">รายชื่อที่เลือก</p>
                    <p className="mt-1 text-lg font-bold text-emerald-900">
                      {selectedPerson.full_name}
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {selectedPerson.category === "teacher"
                        ? "ประเภท: ครู"
                        : "ประเภท: เจ้าหน้าที่"}{" "}
                      |{" "}
                      {selectedPerson.category === "teacher"
                        ? `แผนกวิชา ${selectedPerson.unit_name}`
                        : `งาน ${selectedPerson.unit_name}`}
                    </p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    onClick={checkIn}
                    disabled={loading}
                    className="cursor-pointer rounded-2xl bg-emerald-600 px-5 py-4 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ยืนยันเช็คชื่อเข้า
                  </button>

                  <button
                    onClick={checkOut}
                    disabled={loading}
                    className="cursor-pointer rounded-2xl bg-purple-800 px-5 py-4 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-purple-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ยืนยันเช็คชื่อออก
                  </button>
                </div>

                {message && (
                  <div className="mt-5 animate-soft-zoom rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-center text-sm font-medium text-amber-800">
                    {message}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="overflow-hidden rounded-[34px] border border-white/25 bg-white/95 shadow-2xl">
              <div className="border-b border-purple-100 bg-purple-50 px-6 py-5">
                <h3 className="text-lg font-bold text-purple-950">
                  ข้อมูลการใช้งาน
                </h3>
              </div>

              <div className="space-y-4 px-6 py-6">
                <SideInfoCard
                  title="เงื่อนไขเช็คชื่อเข้า"
                  detail="ระบบบันทึกเวลาจาก Server เพื่อป้องกันการแก้ไขเวลาในเครื่องผู้ใช้งาน"
                />
                <SideInfoCard
                  title="เงื่อนไขเช็คชื่อออก"
                  detail="เช็คชื่อออกได้เฉพาะช่วงเวลา 16.00–20.30 น. ตามเวลา Server เท่านั้น"
                />
                <SideInfoCard
                  title="บัญชีที่ใช้งานได้"
                  detail="อนุญาตเฉพาะบัญชีอีเมล @thonburi.ac.th เพื่อป้องกันการใช้งานโดยบุคคลภายนอก"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[34px] border border-white/25 bg-white/95 shadow-2xl">
              <div className="border-b border-purple-100 bg-purple-50 px-6 py-5">
                <h3 className="text-lg font-bold text-purple-950">
                  คำแนะนำการใช้งาน
                </h3>
              </div>

              <div className="px-6 py-6">
                <ol className="space-y-3 text-sm leading-6 text-slate-700">
                  <li>1. เข้าสู่ระบบด้วยบัญชี Google ของวิทยาลัย</li>
                  <li>2. ค้นหารายชื่อของตนเองให้ถูกต้อง</li>
                  <li>3. ตรวจสอบชื่อ แผนกวิชา หรือหน่วยงานก่อนกดยืนยัน</li>
                  <li>4. กดปุ่มเช็คชื่อเข้าเมื่อเริ่มปฏิบัติงาน</li>
                  <li>5. กดปุ่มเช็คชื่อออกเมื่อสิ้นสุดเวลาปฏิบัติงาน</li>
                </ol>

                <div className="mt-6 rounded-2xl bg-tvc-purple-dark px-4 py-4 text-center text-white">
                  <p className="text-sm text-purple-100">ผู้พัฒนา</p>
                  <p className="mt-1 font-bold">ครูคณิน สัจจารักษ์</p>
                  <p className="text-sm text-purple-100">
                    แผนกวิชาเทคโนโลยีสารสนเทศ
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-white backdrop-blur-sm">
      <p className="text-xs text-purple-100">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function SideInfoCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="font-semibold text-purple-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}