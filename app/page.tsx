export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>Ritmo</h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7, margin: 0 }}>
        منصة ريتمو — أكاديمية، ألعاب، وحسابات
      </p>
    </main>
  );
}
