import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบเข้าออก | วิทยาลัยอาชีวศึกษาธนบุรี",
  description:
    "ระบบบันทึกเวลาเข้าออกครูและเจ้าหน้าที่ วิทยาลัยอาชีวศึกษาธนบุรี",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}