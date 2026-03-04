import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy
} from "firebase/firestore";

const C = {
  bg: "#F4FAF0", cream: "#EEF7E8", primary: "#5A9E0F", primaryDark: "#3d7008",
  primaryLight: "#D4EDBA", accent: "#8CC63F", accentLight: "#E0F2CC",
  text: "#1A2E0A", muted: "#5A7A40", white: "#FFFFFF", border: "#C8E6A8",
  greenBg: "#D4EDD9", greenText: "#2d6e3e", blueBg: "#D4E8F0", blueText: "#1a5c80",
  danger: "#e05555", debtBg: "#FFF0E0", debtText: "#B85C00", debtBorder: "#FFCF99",
};

const SERVICES = ["Coupe femme","Coupe homme","Coupe enfant","Couleur","Mèches / Balayage","Brushing","Permanente","Lissage","Soin","Autre"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_SHORT = ["L","M","M","J","V","S","D"];

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const dow = (first.getDay() + 6) % 7;
  for (let i = 0; i < dow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

function fmt(n) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}

function getStats(list) {
  const paid = list.filter(r => r.payment !== "dette");
  const total = paid.reduce((s, r) => s + (r.price || 0), 0);
  const esp = paid.filter(r => r.payment === "espèces").reduce((s, r) => s + r.price, 0);
  const vir = paid.filter(r => r.payment === "virement").reduce((s, r) => s + r.price, 0);
  const debt = list.filter(r => r.payment === "dette").reduce((s, r) => s + (r.price || 0), 0);
  const byService = {};
  paid.forEach(r => { byService[r.service] = (byService[r.service] || 0) + r.price; });
  return { total, esp, vir, debt, count: list.length, byService };
}

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function StatCard({ label, value, bg, color, sub, onClick, badge }) {
  return (
    <div onClick={onClick} style={{ background: bg, borderRadius: 12, padding: "12px 14px", flex: "1 1 140px", minWidth: 0, cursor: onClick ? "pointer" : "default", position: "relative", border: onClick ? `1.5px solid ${color}44` : "none" }}>
      {badge > 0 && <div style={{ position: "absolute", top: 8, right: 8, background: C.debtText, color: C.white, borderRadius: 10, fontSize: 10, fontWeight: "bold", padding: "1px 6px" }}>{badge}</div>}
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "bold", color, lineHeight: 1.2, wordBreak: "break-word" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: 11, color, marginTop: 4, opacity: 0.7 }}>Voir le détail →</div>}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,30,5,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "20px 18px 36px", boxShadow: "0 -8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ fontSize: 17, fontWeight: "bold", color: C.primary, marginBottom: 2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 16, fontFamily: "inherit", color: C.text, background: C.cream, boxSizing: "border-box", outline: "none" };

const PAYMENTS = [
  { key: "espèces", label: "💵 Espèces", activeBg: C.primaryLight, activeColor: "#5A9E0F", activeBorder: "#5A9E0F" },
  { key: "virement", label: "🏦 Virement", activeBg: "#D4E8F0", activeColor: "#1a5c80", activeBorder: "#1a5c80" },
  { key: "dette", label: "⏳ Dette", activeBg: "#FFF0E0", activeColor: "#B85C00", activeBorder: "#B85C00" },
];

function paymentStyle(payment) {
  if (payment === "espèces") return { bg: C.greenBg, color: C.greenText, label: "💵 Espèces" };
  if (payment === "virement") return { bg: C.blueBg, color: C.blueText, label: "🏦 Virement" };
  return { bg: C.debtBg, color: C.debtText, label: "⏳ Dette" };
}

export default function App({ user, onSignOut }) {
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar");
  const now = new Date();
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(now.getDate());
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [dashPeriod, setDashPeriod] = useState("month");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [debtToPay, setDebtToPay] = useState(null);
  const [payForm, setPayForm] = useState({ payment: "espèces", date: "" });
  const [showSignOut, setShowSignOut] = useState(false);

  // Écoute Firestore en temps réel
  useEffect(() => {
    const rdvsRef = collection(db, "users", user.uid, "rdvs");
    const q = query(rdvsRef, orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRdvs(data);
      setLoading(false);
    });
    return unsub;
  }, [user.uid]);

  const selKey = dateKey(curYear, curMonth, selDay);
  const dayRdvs = rdvs.filter(r => r.date === selKey).sort((a, b) => a.time.localeCompare(b.time));
  const monthPrefix = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
  const monthRdvs = rdvs.filter(r => r.date.startsWith(monthPrefix));
  const yearRdvs = rdvs.filter(r => r.date.startsWith(`${curYear}-`));
  const statsMonth = getStats(monthRdvs);
  const statsYear = getStats(yearRdvs);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const allDebts = rdvs.filter(r => r.payment === "dette");

  const rdvCountByDay = {};
  monthRdvs.forEach(r => {
    const d = parseInt(r.date.split("-")[2]);
    rdvCountByDay[d] = (rdvCountByDay[d] || 0) + 1;
  });

  const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
    const pfx = `${curYear}-${String(i + 1).padStart(2, "0")}`;
    return { month: MONTHS[i], ...getStats(rdvs.filter(r => r.date.startsWith(pfx))) };
  });
  const maxMonthCA = Math.max(...monthlyBreakdown.map(m => m.total), 1);

  async function openAdd() {
    setForm({ date: selKey, time: "09:00", client: "", service: SERVICES[0], price: "", payment: "espèces", note: "" });
    setModal("add");
  }
  function openEdit(rdv) { setForm({ ...rdv }); setModal("edit"); }

  async function saveRdv() {
    if (!form.client?.trim() || !form.price) return;
    const data = { ...form, price: parseFloat(form.price) };
    delete data.id;
    const rdvsRef = collection(db, "users", user.uid, "rdvs");
    if (modal === "add") {
      await addDoc(rdvsRef, data);
    } else {
      await updateDoc(doc(db, "users", user.uid, "rdvs", form.id), data);
    }
    setModal(null);
  }

  async function doDelete(id) {
    await deleteDoc(doc(db, "users", user.uid, "rdvs", id));
    setConfirmDelete(null);
  }

  function openPayDebt(rdv) {
    setDebtToPay(rdv);
    setPayForm({ payment: "espèces", date: "" });
    setModal("pay_debt");
  }

  async function savePayDebt() {
    if (!payForm.date) return;
    await updateDoc(doc(db, "users", user.uid, "rdvs", debtToPay.id), {
      payment: payForm.payment,
      paidDate: payForm.date,
    });
    setDebtToPay(null);
    setModal("debts");
  }

  function prevMonth() {
    if (curMonth === 0) { setCurMonth(11); setCurYear(y => y - 1); } else setCurMonth(m => m - 1);
  }
  function nextMonth() {
    if (curMonth === 11) { setCurMonth(0); setCurYear(y => y + 1); } else setCurMonth(m => m + 1);
  }

  const calDays = getMonthDays(curYear, curMonth);
  const NAV = [
    { id: "calendar", icon: "📅", label: "Calendrier" },
    { id: "day", icon: "🗓", label: "Journée" },
    { id: "dashboard", icon: "📊", label: "Bilan" },
  ];
  const canSave = form.client?.trim() && form.price;
  const canSavePayDebt = payForm.payment && payForm.date;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "system-ui" }}>
        <div style={{ fontSize: 40 }}>✂️</div>
        <div style={{ color: C.muted, fontSize: 15 }}>Chargement…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}>

      {/* HEADER */}
      <div style={{ background: C.primary, color: C.white, padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={() => setShowSignOut(s => !s)}>
          <span style={{ fontSize: 20 }}>✂️</span>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, lineHeight: 1 }}>Salon d'Elysa</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{MONTHS[curMonth]} {curYear}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {allDebts.length > 0 && (
            <button onClick={() => setModal("debts")} style={{ background: C.debtBg, color: C.debtText, border: `1.5px solid ${C.debtBorder}`, borderRadius: 18, padding: "5px 12px", fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
              ⏳ {allDebts.length} dette{allDebts.length > 1 ? "s" : ""}
            </button>
          )}
          {view === "day" && (
            <button onClick={openAdd} style={{ background: C.white, color: C.primary, border: "none", borderRadius: 18, padding: "6px 14px", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>+ RDV</button>
          )}
        </div>
      </div>

      {/* MENU DÉCONNEXION */}
      {showSignOut && (
        <div style={{ background: C.primaryDark, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.white, fontSize: 13, opacity: 0.8 }}>{user.email}</span>
          <button onClick={onSignOut} style={{ background: "rgba(255,255,255,0.15)", color: C.white, border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Se déconnecter
          </button>
        </div>
      )}

      {/* MONTH NAV */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
        <button onClick={prevMonth} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 18, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <span style={{ fontWeight: "bold", fontSize: 16, color: C.primary }}>{MONTHS[curMonth]} {curYear}</span>
        <button onClick={nextMonth} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 18, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      </div>

      <div style={{ padding: "12px 12px 80px" }}>

        {/* ══ CALENDRIER ══ */}
        {view === "calendar" && (
          <>
            <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: C.primaryLight }}>
                {DAYS_SHORT.map((d, i) => <div key={i} style={{ textAlign: "center", padding: "8px 0", fontSize: 12, fontWeight: "bold", color: C.muted }}>{d}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, padding: 6 }}>
                {calDays.map((d, i) => {
                  if (!d) return <div key={`e${i}`} style={{ minHeight: 50 }} />;
                  const isToday = d === now.getDate() && curMonth === now.getMonth() && curYear === now.getFullYear();
                  const isSel = d === selDay;
                  const cnt = rdvCountByDay[d] || 0;
                  const hasDebt = monthRdvs.some(r => r.date === dateKey(curYear, curMonth, d) && r.payment === "dette");
                  return (
                    <div key={d} onClick={() => { setSelDay(d); setView("day"); }} style={{ borderRadius: 10, minHeight: 50, border: `1.5px solid ${isSel ? C.primary : cnt > 0 ? C.accent : C.border}`, background: isSel ? C.primary : cnt > 0 ? C.accentLight : C.white, cursor: "pointer", padding: "5px 3px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                      {hasDebt && !isSel && <div style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: C.debtText }} />}
                      <div style={{ fontWeight: isToday || isSel ? "bold" : "normal", fontSize: 14, color: isSel ? C.white : isToday ? C.primary : C.text }}>{d}</div>
                      {cnt > 0 && <div style={{ fontSize: 10, fontWeight: "bold", color: isSel ? "rgba(255,255,255,0.9)" : C.primary, marginTop: 2 }}>{cnt}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatCard label="RDV ce mois" value={statsMonth.count} bg={C.primaryLight} color={C.primary} />
              <StatCard label="CA mensuel" value={fmt(statsMonth.total)} bg={C.accentLight} color={C.primaryDark} />
              <StatCard label="Espèces" value={fmt(statsMonth.esp)} bg={C.greenBg} color={C.greenText} />
              <StatCard label="Virement" value={fmt(statsMonth.vir)} bg={C.blueBg} color={C.blueText} />
              {statsMonth.debt > 0 && <StatCard label="Dettes ce mois" value={fmt(statsMonth.debt)} bg={C.debtBg} color={C.debtText} badge={monthRdvs.filter(r => r.payment === "dette").length} onClick={() => setModal("debts")} />}
            </div>
          </>
        )}

        {/* ══ JOURNÉE ══ */}
        {view === "day" && (
          <>
            <div style={{ overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
              <div style={{ display: "flex", gap: 5, width: "max-content" }}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                  const k = dateKey(curYear, curMonth, d);
                  const cnt = rdvs.filter(r => r.date === k).length;
                  const isSel = d === selDay;
                  const isToday = d === now.getDate() && curMonth === now.getMonth() && curYear === now.getFullYear();
                  return (
                    <button key={d} onClick={() => setSelDay(d)} style={{ border: `1.5px solid ${isSel ? C.primary : C.border}`, background: isSel ? C.primary : cnt > 0 ? C.accentLight : C.white, color: isSel ? C.white : isToday ? C.primary : C.text, borderRadius: 10, padding: "6px 0", cursor: "pointer", width: 42, fontFamily: "inherit", fontWeight: isSel || isToday ? "bold" : "normal", fontSize: 14, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span>{d}</span>
                      {cnt > 0 && <span style={{ fontSize: 9, color: isSel ? "rgba(255,255,255,0.85)" : C.primary }}>{cnt}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: "bold", fontSize: 17, color: C.primary }}>{selDay} {MONTHS[curMonth]} {curYear}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{dayRdvs.length} rendez-vous</div>
            </div>
            {dayRdvs.length === 0 ? (
              <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "36px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✂️</div>
                <div style={{ color: C.muted, marginBottom: 16 }}>Aucun rendez-vous ce jour</div>
                <button onClick={openAdd} style={{ background: C.primary, color: C.white, border: "none", borderRadius: 22, padding: "10px 24px", fontWeight: "bold", fontSize: 15, cursor: "pointer" }}>+ Ajouter un RDV</button>
              </div>
            ) : (
              <>
                {dayRdvs.map(rdv => {
                  const ps = paymentStyle(rdv.payment);
                  return (
                    <div key={rdv.id} style={{ background: C.white, borderRadius: 14, border: `1px solid ${rdv.payment === "dette" ? C.debtBorder : C.border}`, marginBottom: 10, overflow: "hidden" }}>
                      <div style={{ padding: "12px 12px 10px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ background: C.primary, color: C.white, borderRadius: 10, padding: "5px 10px", fontSize: 14, fontWeight: "bold", flexShrink: 0, textAlign: "center", minWidth: 54 }}>{rdv.time}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "bold", fontSize: 15, wordBreak: "break-word" }}>{rdv.client}</div>
                          <div style={{ fontSize: 13, color: C.muted }}>{rdv.service}</div>
                          {rdv.note && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 2 }}>{rdv.note}</div>}
                        </div>
                        <div style={{ fontWeight: "bold", fontSize: 16, color: rdv.payment === "dette" ? C.debtText : C.primaryDark, flexShrink: 0 }}>{fmt(rdv.price)}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${rdv.payment === "dette" ? C.debtBorder : C.border}`, background: rdv.payment === "dette" ? "#FFF8F0" : C.cream, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ background: ps.bg, color: ps.color, borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: "bold", flexShrink: 0 }}>{ps.label}</span>
                        {rdv.payment === "dette" && (
                          <button onClick={() => openPayDebt(rdv)} style={{ background: C.debtBg, border: `1px solid ${C.debtBorder}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: C.debtText, fontWeight: "bold", fontFamily: "inherit" }}>Régler</button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button onClick={() => openEdit(rdv)} style={{ background: C.accentLight, border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: C.primaryDark, fontWeight: "bold" }}>✏️</button>
                        <button onClick={() => setConfirmDelete(rdv)} style={{ background: "#fdecea", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: C.danger }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const s = getStats(dayRdvs);
                  return (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <StatCard label="Encaissé" value={fmt(s.total)} bg={C.accentLight} color={C.primaryDark} />
                      <StatCard label="Espèces" value={fmt(s.esp)} bg={C.greenBg} color={C.greenText} />
                      <StatCard label="Virement" value={fmt(s.vir)} bg={C.blueBg} color={C.blueText} />
                      {s.debt > 0 && <StatCard label="Dettes" value={fmt(s.debt)} bg={C.debtBg} color={C.debtText} onClick={() => setModal("debts")} />}
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* ══ BILAN ══ */}
        {view === "dashboard" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[["month", "Ce mois"], ["year", `Année ${curYear}`]].map(([id, label]) => (
                <button key={id} onClick={() => setDashPeriod(id)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${dashPeriod === id ? C.primary : C.border}`, background: dashPeriod === id ? C.primary : C.white, color: dashPeriod === id ? C.white : C.muted, fontWeight: "bold", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
              ))}
            </div>
            {dashPeriod === "month" ? (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <StatCard label="Rendez-vous" value={statsMonth.count} bg={C.primaryLight} color={C.primary} />
                  <StatCard label="CA du mois" value={fmt(statsMonth.total)} bg={C.accentLight} color={C.primaryDark} />
                  <StatCard label="Espèces" value={fmt(statsMonth.esp)} bg={C.greenBg} color={C.greenText} sub={statsMonth.total > 0 ? Math.round(statsMonth.esp / statsMonth.total * 100) + "%" : ""} />
                  <StatCard label="Virement" value={fmt(statsMonth.vir)} bg={C.blueBg} color={C.blueText} sub={statsMonth.total > 0 ? Math.round(statsMonth.vir / statsMonth.total * 100) + "%" : ""} />
                  {statsMonth.debt > 0 && <StatCard label="Dettes ce mois" value={fmt(statsMonth.debt)} bg={C.debtBg} color={C.debtText} badge={monthRdvs.filter(r => r.payment === "dette").length} onClick={() => setModal("debts")} />}
                </div>
                {Object.keys(statsMonth.byService).length > 0 && (
                  <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px", marginBottom: 12 }}>
                    <div style={{ fontWeight: "bold", fontSize: 15, color: C.primary, marginBottom: 12 }}>Prestations ce mois</div>
                    {Object.entries(statsMonth.byService).sort((a, b) => b[1] - a[1]).map(([svc, amt]) => (
                      <div key={svc} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span>{svc}</span><span style={{ fontWeight: "bold", color: C.primaryDark }}>{fmt(amt)}</span>
                        </div>
                        <div style={{ background: C.border, borderRadius: 6, height: 8 }}>
                          <div style={{ width: `${(amt / statsMonth.total * 100).toFixed(0)}%`, background: C.accent, height: "100%", borderRadius: 6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px", marginBottom: 12 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15, color: C.primary, marginBottom: 10 }}>Détail par jour</div>
                  {monthRdvs.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "16px 0" }}>Aucun RDV ce mois</div>}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                    .filter(d => rdvs.some(r => r.date === dateKey(curYear, curMonth, d)))
                    .map(d => {
                      const dayList = rdvs.filter(r => r.date === dateKey(curYear, curMonth, d));
                      const s = getStats(dayList);
                      return (
                        <div key={d} style={{ borderBottom: `1px solid ${C.border}`, padding: "9px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: "bold", color: C.primary, cursor: "pointer", minWidth: 90 }} onClick={() => { setSelDay(d); setView("day"); }}>{d} {MONTHS[curMonth].slice(0, 3)}. — {s.count} rdv</span>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {s.esp > 0 && <span style={{ color: C.greenText, fontSize: 13 }}>💵 {fmt(s.esp)}</span>}
                              {s.vir > 0 && <span style={{ color: C.blueText, fontSize: 13 }}>🏦 {fmt(s.vir)}</span>}
                              {s.debt > 0 && <span style={{ color: C.debtText, fontSize: 13 }}>⏳ {fmt(s.debt)}</span>}
                              <span style={{ fontWeight: "bold", color: C.primaryDark, fontSize: 13 }}>{fmt(s.total)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <StatCard label={`RDV ${curYear}`} value={statsYear.count} bg={C.primaryLight} color={C.primary} />
                  <StatCard label="CA annuel" value={fmt(statsYear.total)} bg={C.accentLight} color={C.primaryDark} />
                  <StatCard label="Espèces" value={fmt(statsYear.esp)} bg={C.greenBg} color={C.greenText} />
                  <StatCard label="Virement" value={fmt(statsYear.vir)} bg={C.blueBg} color={C.blueText} />
                  {statsYear.debt > 0 && <StatCard label="Dettes totales" value={fmt(statsYear.debt)} bg={C.debtBg} color={C.debtText} badge={yearRdvs.filter(r => r.payment === "dette").length} onClick={() => setModal("debts")} />}
                </div>
                <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px", marginBottom: 12 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15, color: C.primary, marginBottom: 14 }}>CA par mois — {curYear}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
                    {monthlyBreakdown.map((m, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => { setCurMonth(i); setDashPeriod("month"); }}>
                        <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: i === curMonth ? C.primary : C.accent, height: m.total > 0 ? `${Math.max(m.total / maxMonthCA * 72, 4)}px` : "0px", transition: "height 0.3s" }} />
                        <div style={{ fontSize: 8, color: C.muted, marginTop: 4 }}>{m.month.slice(0, 3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px", marginBottom: 12 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15, color: C.primary, marginBottom: 10 }}>Récap mensuel {curYear}</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          {["Mois","RDV","Espèces","Virement","Dettes","Total"].map(h => (
                            <th key={h} style={{ padding: "7px 6px", textAlign: h === "Mois" ? "left" : "right", color: C.muted, fontSize: 11, fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyBreakdown.map((m, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i === curMonth ? C.primaryLight : "transparent", cursor: "pointer" }} onClick={() => { setCurMonth(i); setDashPeriod("month"); }}>
                            <td style={{ padding: "8px 6px", fontWeight: i === curMonth ? "bold" : "normal", color: i === curMonth ? C.primary : C.text, whiteSpace: "nowrap" }}>{m.month}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", color: C.muted }}>{m.count || "—"}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", color: C.greenText, whiteSpace: "nowrap" }}>{m.esp > 0 ? fmt(m.esp) : "—"}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", color: C.blueText, whiteSpace: "nowrap" }}>{m.vir > 0 ? fmt(m.vir) : "—"}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", color: C.debtText, whiteSpace: "nowrap" }}>{m.debt > 0 ? fmt(m.debt) : "—"}</td>
                            <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: "bold", color: C.primaryDark, whiteSpace: "nowrap" }}>{m.total > 0 ? fmt(m.total) : "—"}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${C.border}`, background: C.accentLight }}>
                          <td style={{ padding: "9px 6px", fontWeight: "bold" }}>TOTAL</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: "bold" }}>{statsYear.count}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: "bold", color: C.greenText, whiteSpace: "nowrap" }}>{fmt(statsYear.esp)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: "bold", color: C.blueText, whiteSpace: "nowrap" }}>{fmt(statsYear.vir)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: "bold", color: C.debtText, whiteSpace: "nowrap" }}>{statsYear.debt > 0 ? fmt(statsYear.debt) : "—"}</td>
                          <td style={{ padding: "9px 6px", textAlign: "right", fontWeight: "bold", color: C.primaryDark, fontSize: 14, whiteSpace: "nowrap" }}>{fmt(statsYear.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* NAV BAS */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1.5px solid ${C.border}`, display: "flex", zIndex: 100, boxShadow: "0 -2px 10px rgba(0,0,0,0.08)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{ flex: 1, padding: "8px 4px 10px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{ fontSize: 11, fontWeight: view === n.id ? "bold" : "normal", color: view === n.id ? C.primary : C.muted }}>{n.label}</span>
            {view === n.id && <div style={{ width: 20, height: 3, background: C.primary, borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {/* MODAL ADD/EDIT */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "✂️ Nouveau rendez-vous" : "✏️ Modifier le RDV"} subtitle={`${selDay} ${MONTHS[curMonth]} ${curYear}`} onClose={() => setModal(null)}>
          <Field label="Heure"><input type="time" value={form.time || ""} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} /></Field>
          <Field label="Nom du client"><input type="text" placeholder="Prénom Nom" value={form.client || ""} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} style={inputStyle} /></Field>
          <Field label="Prestation">
            <select value={form.service || ""} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
              {SERVICES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Prix (€)"><input type="number" placeholder="0.00" step="0.5" min="0" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={inputStyle} /></Field>
          <Field label="Paiement">
            <div style={{ display: "flex", gap: 8 }}>
              {PAYMENTS.map(p => (
                <div key={p.key} onClick={() => setForm(f => ({ ...f, payment: p.key }))} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, textAlign: "center", border: `1.5px solid ${form.payment === p.key ? p.activeBorder : C.border}`, background: form.payment === p.key ? p.activeBg : C.white, cursor: "pointer", fontWeight: form.payment === p.key ? "bold" : "normal", color: form.payment === p.key ? p.activeColor : C.muted, fontSize: 13 }}>{p.label}</div>
              ))}
            </div>
          </Field>
          <Field label="Note (optionnel)"><input type="text" placeholder="Remarque…" value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setModal(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, fontWeight: "bold", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button onClick={saveRdv} disabled={!canSave} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: canSave ? C.primary : C.border, color: C.white, fontWeight: "bold", fontSize: 15, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{modal === "add" ? "Ajouter" : "Enregistrer"}</button>
          </div>
        </Modal>
      )}

      {/* MODAL DETTES */}
      {modal === "debts" && (
        <Modal title="⏳ Dettes en cours" subtitle={`${allDebts.length} paiement${allDebts.length > 1 ? "s" : ""} en attente — ${fmt(allDebts.reduce((s, r) => s + r.price, 0))} au total`} onClose={() => setModal(null)}>
          {allDebts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>Aucune dette en cours 🎉</div>
          ) : (
            allDebts.sort((a, b) => a.date.localeCompare(b.date)).map(rdv => (
              <div key={rdv.id} style={{ background: C.white, border: `1px solid ${C.debtBorder}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ padding: "11px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 15 }}>{rdv.client}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{rdv.service}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>📅 {fmtDate(rdv.date)} à {rdv.time}</div>
                      {rdv.note && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>{rdv.note}</div>}
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: 16, color: C.debtText, flexShrink: 0, marginLeft: 8 }}>{fmt(rdv.price)}</div>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${C.debtBorder}`, background: "#FFF8F0", padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => openPayDebt(rdv)} style={{ background: C.primary, color: C.white, border: "none", borderRadius: 8, padding: "7px 18px", cursor: "pointer", fontWeight: "bold", fontSize: 13, fontFamily: "inherit" }}>✅ Marquer comme payé</button>
                </div>
              </div>
            ))
          )}
        </Modal>
      )}

      {/* MODAL RÉGLER DETTE */}
      {modal === "pay_debt" && debtToPay && (
        <Modal title="✅ Régler la dette" subtitle={`${debtToPay.client} — ${fmt(debtToPay.price)}`} onClose={() => { setModal("debts"); setDebtToPay(null); }}>
          <div style={{ background: C.debtBg, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: C.debtText }}>
            {debtToPay.service} · {fmtDate(debtToPay.date)} à {debtToPay.time}
          </div>
          <Field label="Mode de paiement">
            <div style={{ display: "flex", gap: 8 }}>
              {PAYMENTS.filter(p => p.key !== "dette").map(p => (
                <div key={p.key} onClick={() => setPayForm(f => ({ ...f, payment: p.key }))} style={{ flex: 1, padding: "11px 6px", borderRadius: 10, textAlign: "center", border: `1.5px solid ${payForm.payment === p.key ? p.activeBorder : C.border}`, background: payForm.payment === p.key ? p.activeBg : C.white, cursor: "pointer", fontWeight: payForm.payment === p.key ? "bold" : "normal", color: payForm.payment === p.key ? p.activeColor : C.muted, fontSize: 14 }}>{p.label}</div>
              ))}
            </div>
          </Field>
          <Field label="Date du paiement"><input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => { setModal("debts"); setDebtToPay(null); }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, fontWeight: "bold", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button onClick={savePayDebt} disabled={!canSavePayDebt} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: canSavePayDebt ? C.primary : C.border, color: C.white, fontWeight: "bold", fontSize: 15, cursor: canSavePayDebt ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Confirmer le paiement</button>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <Modal title="Supprimer ce RDV ?" subtitle={`${confirmDelete.client} — ${confirmDelete.time}`} onClose={() => setConfirmDelete(null)}>
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>Cette action est irréversible.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, fontWeight: "bold", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button onClick={() => doDelete(confirmDelete.id)} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: C.danger, color: C.white, fontWeight: "bold", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
