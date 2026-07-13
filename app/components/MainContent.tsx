export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      marginLeft: "220px",
      flex: 1,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {children}
    </main>
  );
}
