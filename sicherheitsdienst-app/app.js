import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const CONFIG_URL = "https://otfupjhvxkcxoocowkoz.supabase.co/functions/v1/app-config";
let supabase;

const state = {
  session: null,
  user: null,
  access: null,
  profile: null,
  dashboard: null,
  shifts: [],
  vacations: [],
  incidents: [],
  deferredInstall: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function toast(message, isError=false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.className = "toast", 2800);
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function dateDE(v) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? v + "T12:00:00" : v);
  return new Intl.DateTimeFormat("de-DE", { day:"2-digit", month:"2-digit", year:"numeric" }).format(d);
}

function timeDE(v) {
  return new Date(v).toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
}

function hoursBetween(start, end, breakMinutes=0) {
  return Math.max(0, (new Date(end) - new Date(start)) / 3600000 - Number(breakMinutes) / 60);
}

function isoFrom(date, time) {
  return new Date(date + "T" + time + ":00").toISOString();
}

function hasAccess() {
  if (!state.access) return false;
  if (state.access.status === "active") {
    return !state.access.subscription_ends_at || new Date(state.access.subscription_ends_at) > new Date();
  }
  return state.access.status === "trialing" && new Date(state.access.trial_ends_at) > new Date();
}

function trialDays() {
  if (!state.access || !state.access.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(state.access.trial_ends_at) - new Date()) / 86400000));
}

async function createSupabaseClient() {
  const res = await fetch(CONFIG_URL, { cache:"no-store" });
  if (!res.ok) throw new Error("Supabase-Konfiguration konnte nicht geladen werden.");
  const cfg = await res.json();
  if (!cfg.url || !cfg.publishableKey) throw new Error("Supabase-Konfiguration ist unvollständig.");
  supabase = createClient(cfg.url, cfg.publishableKey);
}

async function init() {
  try {
    await createSupabaseClient();
    bindUI();

    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    state.user = data.session ? data.session.user : null;

    supabase.auth.onAuthStateChange(async (event, session) => {
      state.session = session;
      state.user = session ? session.user : null;

      if (event === "PASSWORD_RECOVERY") {
        const next = prompt("Neues Passwort eingeben, mindestens 8 Zeichen:");
        if (next && next.length >= 8) {
          const result = await supabase.auth.updateUser({ password:next });
          toast(result.error ? result.error.message : "Passwort geändert.", !!result.error);
        }
      }
      await routeAuth();
    });

    await routeAuth();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (e) {
    console.error(e);
    toast(e.message || "App konnte nicht gestartet werden.", true);
  }
}

function bindUI() {
  $$("[data-auth-tab]").forEach((btn) => btn.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach((x) => x.classList.toggle("active", x === btn));
    $("#loginForm").classList.toggle("hidden", btn.dataset.authTab !== "login");
    $("#registerForm").classList.toggle("hidden", btn.dataset.authTab !== "register");
  }));

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = await supabase.auth.signInWithPassword({
      email:$("#loginEmail").value.trim(),
      password:$("#loginPassword").value
    });
    toast(result.error ? result.error.message : "Angemeldet.", !!result.error);
  });

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = await supabase.auth.signUp({
      email:$("#regEmail").value.trim(),
      password:$("#regPassword").value,
      options:{
        emailRedirectTo:location.href.split("#")[0],
        data:{
          first_name:$("#regFirstName").value.trim(),
          last_name:$("#regLastName").value.trim()
        }
      }
    });
    if (result.error) return toast(result.error.message, true);
    toast(result.data.session ? "Konto erstellt. Deine Testphase läuft." : "Konto erstellt. Bitte bestätige deine E-Mail.");
  });

  $("#forgotPassword").addEventListener("click", async () => {
    const email = $("#loginEmail").value.trim();
    if (!email) return toast("Bitte zuerst deine E-Mail eintragen.", true);
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo:location.href.split("#")[0] });
    toast(result.error ? result.error.message : "E-Mail zum Zurücksetzen wurde versendet.", !!result.error);
  });

  $("#logoutBtn").addEventListener("click", () => supabase.auth.signOut());

  $$(".nav").forEach((btn) => btn.addEventListener("click", () => {
    $$(".nav").forEach((x) => x.classList.toggle("active", x === btn));
    $$(".page").forEach((x) => x.classList.remove("active"));
    $("#page-" + btn.dataset.page).classList.add("active");
  }));

  $("#shiftForm").addEventListener("submit", saveShift);
  $("#vacationForm").addEventListener("submit", saveVacation);
  $("#incidentForm").addEventListener("submit", saveIncident);
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#downloadTimesheet").addEventListener("click", () => buildTimesheet(false));
  $("#shareTimesheet").addEventListener("click", () => buildTimesheet(true));

  $("#subscribeBtn").addEventListener("click", () => {
    toast("Der Zahlungsanbieter ist noch nicht verbunden.", true);
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstall = e;
    $("#installBtn").classList.remove("hidden");
  });

  $("#installBtn").addEventListener("click", async () => {
    if (!state.deferredInstall) return;
    await state.deferredInstall.prompt();
    state.deferredInstall = null;
    $("#installBtn").classList.add("hidden");
  });
}

async function routeAuth() {
  if (!state.user) {
    $("#authView").classList.remove("hidden");
    $("#appView").classList.add("hidden");
    return;
  }
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#userEmail").textContent = state.user.email || "";
  await loadAll();
}

async function loadAll() {
  const uid = state.user.id;
  const results = await Promise.all([
    supabase.from("account_access").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("dashboard_summary").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("work_shifts").select("*").order("shift_date", { ascending:false }).limit(60),
    supabase.from("vacations").select("*").order("start_date", { ascending:false }).limit(60),
    supabase.from("incidents").select("*").order("occurred_at", { ascending:false }).limit(60)
  ]);

  state.access = results[0].data;
  state.profile = results[1].data;
  state.dashboard = results[2].data;
  state.shifts = results[3].data || [];
  state.vacations = results[4].data || [];
  state.incidents = results[5].data || [];

  renderAccess();
  renderDashboard();
  renderShifts();
  renderVacations();
  renderIncidents();
  fillProfile();
}

function renderAccess() {
  const badge = $("#trialBadge");
  const allowed = hasAccess();
  $("#expiredPanel").classList.toggle("hidden", allowed);

  if (!state.access) {
    badge.textContent = "Zugang wird eingerichtet";
    badge.className = "badge warn";
  } else if (state.access.status === "active") {
    badge.textContent = "Abo aktiv";
    badge.className = "badge";
  } else if (allowed) {
    const days = trialDays();
    badge.textContent = "Testphase: " + days + (days === 1 ? " Tag" : " Tage");
    badge.className = "badge warn";
  } else {
    badge.textContent = "Testphase beendet";
    badge.className = "badge danger";
  }
}

function renderDashboard() {
  const d = state.dashboard || {};
  const remaining = d.remaining_leave_days == null
    ? Number((state.profile && state.profile.annual_leave_days) || 0)
    : Number(d.remaining_leave_days || 0);

  const cards = [
    ["Stunden im Monat", Number(d.work_hours_this_month || 0).toFixed(2) + " h"],
    ["Arbeitstage", d.work_days_this_month || 0],
    ["Resturlaub", remaining.toFixed(1) + " Tage"],
    ["Nächster Urlaub", d.next_vacation_start ? dateDE(d.next_vacation_start) : "Keiner"]
  ];

  $("#dashboardCards").innerHTML = cards.map((c) =>
    '<div class="metric"><span>' + esc(c[0]) + '</span><strong>' + esc(c[1]) + '</strong></div>'
  ).join("");

  const future = state.shifts
    .filter((s) => new Date(s.start_time) >= new Date())
    .sort((a,b) => new Date(a.start_time) - new Date(b.start_time))[0];

  const items = [];
  if (future) items.push("Nächster Dienst: " + dateDE(future.shift_date) + " · " + timeDE(future.start_time) + " Uhr");
  if (d.next_vacation_start) items.push("Nächster Urlaub: " + dateDE(d.next_vacation_start));

  $("#nextItems").innerHTML = items.length
    ? items.map((x) => '<div class="list-item"><div class="meta"><strong>' + esc(x) + '</strong></div></div>').join("")
    : '<p class="muted">Keine kommenden Einträge.</p>';
}

function renderShifts() {
  const el = $("#shiftList");
  if (!state.shifts.length) {
    el.innerHTML = '<p class="muted">Noch keine Schichten gespeichert.</p>';
    return;
  }
  el.innerHTML = state.shifts.map((s) => {
    const hours = hoursBetween(s.start_time, s.end_time, s.break_minutes).toFixed(2);
    return '<div class="list-item"><div class="meta"><strong>' +
      esc(dateDE(s.shift_date) + " · " + timeDE(s.start_time) + "–" + timeDE(s.end_time)) +
      '</strong><span>' + esc(hours + " h · " + (s.site_name || "Ohne Objekt")) +
      '</span></div><div class="item-actions"><button class="icon-btn danger-btn" data-delete-shift="' +
      s.id + '">Löschen</button></div></div>';
  }).join("");

  $$("[data-delete-shift]").forEach((b) => {
    b.onclick = () => deleteRow("work_shifts", b.dataset.deleteShift);
  });
}

function renderVacations() {
  const labels = { planned:"Geplant", requested:"Beantragt", approved:"Genehmigt", rejected:"Abgelehnt", taken:"Genommen", canceled:"Storniert" };
  const el = $("#vacationList");
  if (!state.vacations.length) {
    el.innerHTML = '<p class="muted">Noch kein Urlaub gespeichert.</p>';
    return;
  }
  el.innerHTML = state.vacations.map((v) =>
    '<div class="list-item"><div class="meta"><strong>' +
    esc(dateDE(v.start_date) + " bis " + dateDE(v.end_date)) +
    '</strong><span>' + esc(v.days_count + " Tage · " + (labels[v.status] || v.status)) +
    '</span></div><div class="item-actions"><button class="icon-btn danger-btn" data-delete-vac="' +
    v.id + '">Löschen</button></div></div>'
  ).join("");

  $$("[data-delete-vac]").forEach((b) => {
    b.onclick = () => deleteRow("vacations", b.dataset.deleteVac);
  });
}

function renderIncidents() {
  const labels = {
    damage:"Schaden", burglary:"Einbruch", theft:"Diebstahl", fire:"Brand",
    medical:"Medizinischer Notfall", alarm:"Alarm", technical_fault:"Technische Störung",
    access_issue:"Zutritt", violence:"Gewalt", other:"Sonstiges"
  };
  const el = $("#incidentList");
  if (!state.incidents.length) {
    el.innerHTML = '<p class="muted">Noch keine Meldungen gespeichert.</p>';
    return;
  }

  el.innerHTML = state.incidents.map((i) =>
    '<div class="list-item"><div class="meta"><strong>' + esc(i.title) +
    '</strong><span>' + esc(dateDE(i.occurred_at) + " · " + (labels[i.category] || i.category) + " · " + i.severity) +
    '</span></div><div class="item-actions"><button class="icon-btn" data-file-inc="' + i.id +
    '">Datei</button><button class="icon-btn danger-btn" data-delete-inc="' + i.id +
    '">Löschen</button></div></div>'
  ).join("");

  $$("[data-delete-inc]").forEach((b) => {
    b.onclick = () => deleteRow("incidents", b.dataset.deleteInc);
  });
  $$("[data-file-inc]").forEach((b) => {
    b.onclick = () => openIncidentFile(b.dataset.fileInc);
  });
}

function fillProfile() {
  const p = state.profile || {};
  $("#profileFirst").value = p.first_name || "";
  $("#profileLast").value = p.last_name || "";
  $("#profilePersonnel").value = p.personnel_number || "";
  $("#profileState").value = p.federal_state || "";
  $("#profileEmployer").value = p.employer || "";
  $("#profileSite").value = p.site_name || "";
  $("#profileWage").value = p.hourly_wage || "";
  $("#profileAllowance").value = p.site_allowance || "";
  $("#profileLeave").value = p.annual_leave_days == null ? 30 : p.annual_leave_days;
}

async function saveShift(e) {
  e.preventDefault();
  if (!hasAccess()) return toast("Deine Testphase ist beendet.", true);

  const date = $("#shiftDate").value;
  let endDate = date;
  if ($("#shiftEnd").value <= $("#shiftStart").value) {
    const next = new Date(date + "T12:00:00");
    next.setDate(next.getDate() + 1);
    endDate = next.toISOString().slice(0,10);
  }

  const payload = {
    user_id:state.user.id,
    shift_date:date,
    start_time:isoFrom(date, $("#shiftStart").value),
    end_time:isoFrom(endDate, $("#shiftEnd").value),
    break_minutes:Number($("#shiftBreak").value || 0),
    site_name:$("#shiftSite").value.trim() || null,
    note:$("#shiftNote").value.trim() || null
  };

  const result = await supabase.from("work_shifts").insert(payload);
  if (result.error) return toast(result.error.message, true);
  e.target.reset();
  $("#shiftBreak").value = 0;
  toast("Schicht gespeichert.");
  await loadAll();
}

async function saveVacation(e) {
  e.preventDefault();
  if (!hasAccess()) return toast("Deine Testphase ist beendet.", true);

  const payload = {
    user_id:state.user.id,
    start_date:$("#vacStart").value,
    end_date:$("#vacEnd").value,
    days_count:Number($("#vacDays").value),
    status:$("#vacStatus").value,
    note:$("#vacNote").value.trim() || null
  };

  const result = await supabase.from("vacations").insert(payload);
  if (result.error) return toast(result.error.message, true);
  e.target.reset();
  toast("Urlaub gespeichert.");
  await loadAll();
}

async function saveIncident(e) {
  e.preventDefault();
  if (!hasAccess()) return toast("Deine Testphase ist beendet.", true);

  const payload = {
    user_id:state.user.id,
    category:$("#incidentCategory").value,
    title:$("#incidentTitle").value.trim(),
    description:$("#incidentDescription").value.trim(),
    location:$("#incidentLocation").value.trim() || null,
    severity:$("#incidentSeverity").value
  };

  const result = await supabase.from("incidents").insert(payload).select().single();
  if (result.error) return toast(result.error.message, true);

  const file = $("#incidentFile").files[0];
  if (file) {
    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = state.user.id + "/incidents/" + result.data.id + "/" + Date.now() + "-" + clean;
    const upload = await supabase.storage.from("user-files").upload(path, file, { upsert:false });
    if (upload.error) return toast("Meldung gespeichert, Datei fehlgeschlagen: " + upload.error.message, true);

    const meta = await supabase.from("attachments").insert({
      user_id:state.user.id,
      incident_id:result.data.id,
      file_path:path,
      original_name:file.name,
      mime_type:file.type || null,
      size_bytes:file.size
    });

    if (meta.error) return toast("Datei gespeichert, Zuordnung fehlgeschlagen: " + meta.error.message, true);
  }

  e.target.reset();
  toast("Meldung gespeichert.");
  await loadAll();
}

async function saveProfile(e) {
  e.preventDefault();

  const payload = {
    user_id:state.user.id,
    first_name:$("#profileFirst").value.trim() || null,
    last_name:$("#profileLast").value.trim() || null,
    personnel_number:$("#profilePersonnel").value.trim() || null,
    federal_state:$("#profileState").value.trim() || null,
    employer:$("#profileEmployer").value.trim() || null,
    site_name:$("#profileSite").value.trim() || null,
    hourly_wage:$("#profileWage").value ? Number($("#profileWage").value) : null,
    site_allowance:$("#profileAllowance").value ? Number($("#profileAllowance").value) : null,
    annual_leave_days:Number($("#profileLeave").value || 30)
  };

  const result = await supabase.from("profiles").upsert(payload);
  toast(result.error ? result.error.message : "Profil gespeichert.", !!result.error);
  if (!result.error) await loadAll();
}

async function deleteRow(table, id) {
  if (!confirm("Eintrag wirklich löschen?")) return;
  const result = await supabase.from(table).delete().eq("id", id);
  toast(result.error ? result.error.message : "Eintrag gelöscht.", !!result.error);
  if (!result.error) await loadAll();
}

async function openIncidentFile(incidentId) {
  const result = await supabase.from("attachments")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending:false })
    .limit(1);

  if (result.error || !result.data || !result.data.length) {
    return toast("Zu dieser Meldung ist keine Datei gespeichert.", true);
  }

  const signed = await supabase.storage.from("user-files").createSignedUrl(result.data[0].file_path, 3600);
  if (signed.error) return toast(signed.error.message, true);
  window.open(signed.data.signedUrl, "_blank", "noopener");
}

async function buildTimesheet(share) {
  if (!hasAccess()) return toast("Deine Testphase ist beendet.", true);

  const now = new Date();
  const rows = state.shifts.filter((s) => {
    const d = new Date(s.shift_date + "T12:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).sort((a,b) => a.shift_date.localeCompare(b.shift_date));

  if (!rows.length) return toast("Für diesen Monat sind keine Schichten gespeichert.", true);

  const jsPDF = window.jspdf.jsPDF;
  const pdf = new jsPDF();
  const p = state.profile || {};
  const monthTitle = new Intl.DateTimeFormat("de-DE", { month:"long", year:"numeric" }).format(now);
  const title = "Stundennachweis " + monthTitle;

  let y = 18;
  pdf.setFontSize(16);
  pdf.text(title, 14, y);
  y += 9;
  pdf.setFontSize(10);
  pdf.text("Name: " + [p.first_name, p.last_name].filter(Boolean).join(" "), 14, y);
  y += 6;
  pdf.text("Arbeitgeber: " + (p.employer || "—") + "   Objekt: " + (p.site_name || "—"), 14, y);
  y += 10;

  pdf.setFontSize(9);
  pdf.text("Datum", 14, y);
  pdf.text("Beginn", 44, y);
  pdf.text("Ende", 70, y);
  pdf.text("Pause", 95, y);
  pdf.text("Stunden", 122, y);
  pdf.text("Objekt", 150, y);
  y += 5;
  pdf.line(14, y, 196, y);
  y += 5;

  let total = 0;
  rows.forEach((s) => {
    if (y > 278) {
      pdf.addPage();
      y = 18;
    }
    const h = hoursBetween(s.start_time, s.end_time, s.break_minutes);
    total += h;
    pdf.text(dateDE(s.shift_date), 14, y);
    pdf.text(timeDE(s.start_time), 44, y);
    pdf.text(timeDE(s.end_time), 70, y);
    pdf.text(String(s.break_minutes || 0) + " min", 95, y);
    pdf.text(h.toFixed(2), 122, y);
    pdf.text(String(s.site_name || "—").slice(0,24), 150, y);
    y += 6;
  });

  y += 4;
  pdf.setFontSize(11);
  pdf.text("Gesamt: " + total.toFixed(2) + " Stunden", 14, y);

  const filename = "Stundennachweis-" + now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + ".pdf";

  if (!share) {
    pdf.save(filename);
    return;
  }

  const blob = pdf.output("blob");
  const file = new File([blob], filename, { type:"application/pdf" });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
    try {
      await navigator.share({ title, text:"Mein Stundennachweis", files:[file] });
    } catch (_) {}
  } else {
    pdf.save(filename);
    toast("Teilen wird hier nicht unterstützt. PDF wurde gespeichert.");
  }
}

init();