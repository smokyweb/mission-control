import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import MainContent from "./components/MainContent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bat Cave | OpenClaw",
  description: "OpenClaw Agent Bat Cave Dashboard",
  icons: {
    icon: [{ url: '/favicon.ico?v=3', sizes: 'any' }, { url: '/favicon.png?v=3', type: 'image/png', sizes: '32x32' }],
    shortcut: '/favicon.ico?v=3',
    apple: '/favicon.png?v=3',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#000", color: "#e5e5e5", display: "flex", minHeight: "100vh" }}
      >
        <NavBar />
        <MainContent>
          {children}
        </MainContent>
      </body>
    </html>
  );
}
