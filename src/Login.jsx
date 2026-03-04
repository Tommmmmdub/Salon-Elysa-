import { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const C = {
  primary: "#5A9E0F", primaryDark: "#3d7008", primaryLight: "#D4EDBA",
  bg: "#F4FAF0", cream: "#EEF7E8", white: "#FFFFFF",
  border: "#C8E6A8", muted: "#5A7A40", text: "#1A2E0A",
  danger: "#e05555",
};

const inputStyle = {
  width: "100%", padding: "13px 16px", borderRadius: 12,
  border: `1.5px solid ${C.border}`, fontSize: 16, fontFamily: "inherit",
  color: C.text, background: C.cream, boxSizing: "border-box", outline: "none",
};

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError("Email ou mot de passe incorrect.");
      } else if (e.code === "auth/email-already-in-use") {
        setError("Cet email est déjà utilisé. Connecte-toi.");
      } else if (e.code === "auth/weak-password") {
        setError("Mot de passe trop court (6 caractères minimum).");
      } else if (e.code === "auth/invalid-email") {
        setError("Adresse email invalide.");
      } else {
        setError("Une erreur est survenue. Réessaie.");
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✂️</div>
        <div style={{ fontSize: 26, fontWeight: "bold", color: C.primary }}>Salon d'Elysa</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Gestion des rendez-vous</div>
      </div>

      <div style={{ background: C.white, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: C.cream, borderRadius: 12, padding: 4 }}>
          {[["login", "Se connecter"], ["register", "Créer un compte"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: mode === m ? C.white : "transparent", color: mode === m ? C.primary : C.muted, fontWeight: mode === m ? "bold" : "normal", fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>{label}</button>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Email</div>
          <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Mot de passe</div>
          <input type="password" placeholder={mode === "register" ? "6 caractères minimum" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>

        {error && (
          <div style={{ background: "#fdecea", color: C.danger, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <button onClick={handleSubmit} disabled={loading || !email || !password} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: email && password ? C.primary : C.border, color: C.white, fontWeight: "bold", fontSize: 16, cursor: email && password ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {loading ? "⏳ Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>

      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: C.muted, textAlign: "center", maxWidth: 300 }}>
        Tes données sont sauvegardées en sécurité et accessibles depuis n'importe quel appareil 🔒
      </div>
    </div>
  );
}
