"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/portal");

  return (
    <main style={{
      marginLeft: isPortal ? 0 : "220px",
      flex: 1,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {children}
    </main>
  );
}
