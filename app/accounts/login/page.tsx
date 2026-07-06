"use client";

export default function LoginPage() {
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    alert("Login functionality coming soon");
  }

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
      <form
        onSubmit={handleLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "320px",
          marginTop: "1rem",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          required
          style={{
            fontSize: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            outline: "none",
direction: "ltr",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        />
        <input
          type="password"
          placeholder="Password"
          required
          style={{
            fontSize: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            outline: "none",
direction: "ltr",
textAlign: "left",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            marginTop: "0.25rem",
          }}
        >
          Log in
        </button>
      </form>

      
      <a        
href="#"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        Forgot password?
      </a>
    </main>
  );
}
