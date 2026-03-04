import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login.jsx";
import App from "./App.jsx";

export default function Root() {
  const [user, setUser] = useState(undefined); // undefined = chargement

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4FAF0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ fontSize: 40 }}>✂️</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return <App user={user} onSignOut={() => signOut(auth)} />;
}
