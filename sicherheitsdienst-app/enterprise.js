const CONFIG_URL = "https://otfupjhvxkcxoocowkoz.supabase.co/functions/v1/app-config";

let companyClient = null;
let companyContext = null;

const $e = (s) => document.querySelector(s);

function escCompany(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function roleLabel(role) {
  return ({ owner:"Inhaber", admin:"Admin", supervisor:"Objektleitung", employee:"Mitarbeiter" })[role] || role || "—";
}

function subLabel(sub) {
  if (!sub) return "Kein Firmenabo";
  if (sub.status === "trialing") return "Firmen-Testphase";
  if (sub.status === "active") return "Firmenabo aktiv";
  if (sub.status === "past_due") return "Zahlung offen";
  if (sub.status === "canceled") return "Gekündigt";
  return "Abgelaufen";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", { day:"2-digit", month:"2-digit", year:"numeric" }).format(new Date(value));
}

async function getCompanyClient() {
  if (companyClient) return companyClient;
  const cfgRes = await fetch(CONFIG_URL, { cache:"no-store" });
  if (!cfgRes.ok) throw new Error("Firmenzugang konnte nicht geladen werden.");
  const cfg = await cfgRes.json();
  const mod = await import("https://esm.sh/@supabase/supabase-js@2.58.0");
  companyClient = mod.createClient(cfg.url, cfg.publishableKey);
  return companyClient;
}

async function companyAction(action, payload = {}) {
  const client = await getCompanyClient();
  const { data, error } = await client.functions.invoke("company-admin", {
    body: { action, ...payload }
  });
  if (error) throw new Error(error.message || "Firmenaktion fehlgeschlagen.");
  if (data?.error) throw new Error(data.error);
  return data;
}

function notify(message, isError = false) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.className = "toast", 3000);
}

function setMainCompanyAccess(active, label) {
  if (window.DienstWache?.setCompanyAccess) {
    window.DienstWache.setCompanyAccess(active, label);
  } else {
    setTimeout(() => {
      if (window.DienstWache?.setCompanyAccess) {
        window.DienstWache.setCompanyAccess(active, label);
      }
    }, 500);
  }
}

async function loadCompany() {
  const page = $e("#companyContent");
  if (!page) return;

  try {
    const client = await getCompanyClient();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      page.innerHTML = '<p class="muted">Bitte zuerst anmelden.</p>';
      companyContext = null;
      setMainCompanyAccess(false);
      return;
    }

    companyContext = await companyAction("context");
    setMainCompanyAccess(
      !!companyContext.subscriptionActive,
      companyContext.subscriptionActive ? "Firmenzugang aktiv" : null
    );
    renderCompany();
  } catch (e) {
    page.innerHTML = '<div class="panel"><strong>Firmenbereich konnte nicht geladen werden.</strong><p class="muted">' +
      escCompany(e.message) + '</p></div>';
  }
}

function renderCompany() {
  const root = $e("#companyContent");
  if (!root) return;
  const ctx = companyContext || {};

  if (!ctx.membership) {
    if (ctx.pendingJoin) {
      root.innerHTML =
        '<div class="company-grid">' +
          '<div class="panel company-hero"><span class="company-kicker">Beitrittsanfrage</span><h3>' +
          escCompany(ctx.pendingJoin.company?.name || "Firma") +
          '</h3><p>Deine Anfrage wartet auf die Freigabe durch einen Firmen-Admin.</p>' +
          '<div class="status-chip warn">Ausstehend seit ' + escCompany(formatDate(ctx.pendingJoin.requested_at)) + '</div></div>' +
        '</div>';
      return;
    }

    root.innerHTML =
      '<div class="company-grid">' +
        '<form id="createCompanyForm" class="panel form-grid">' +
          '<span class="company-kicker">Für Firmen</span><h3>Firma anlegen</h3>' +
          '<p class="muted">Du wirst als Inhaber angelegt. Die Mitarbeiterzahl kann später geändert werden.</p>' +
          '<label>Firmenname<input id="companyName" maxlength="120" required placeholder="z. B. Muster Sicherheitsdienst GmbH"></label>' +
          '<label>Mitarbeiterplätze<input id="companySeats" type="number" min="1" max="5000" value="200" required></label>' +
          '<button class="primary" type="submit">Firma anlegen</button>' +
        '</form>' +
        '<form id="joinCompanyForm" class="panel form-grid">' +
          '<span class="company-kicker">Für Mitarbeiter</span><h3>Firma beitreten</h3>' +
          '<p class="muted">Firmencode eingeben. Ein Admin muss deinen Beitritt anschließend bestätigen.</p>' +
          '<label>Firmencode<input id="companyCode" minlength="8" maxlength="20" autocomplete="off" required placeholder="AB12CD34EF"></label>' +
          '<button class="secondary" type="submit">Beitritt anfragen</button>' +
        '</form>' +
      '</div>';

    $e("#createCompanyForm").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const data = await companyAction("create_company", {
          name: $e("#companyName").value,
          seat_limit: Number($e("#companySeats").value || 200)
        });
        companyContext = data.context;
        notify("Firma angelegt.");
        renderCompany();
        setMainCompanyAccess(!!companyContext.subscriptionActive, "Firmenzugang aktiv");
      } catch (e) { notify(e.message, true); }
    };

    $e("#joinCompanyForm").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const data = await companyAction("request_join", { code: $e("#companyCode").value });
        companyContext = data.context;
        notify("Beitrittsanfrage gesendet.");
        renderCompany();
      } catch (e) { notify(e.message, true); }
    };
    return;
  }

  const company = ctx.company || {};
  const sub = ctx.subscription || {};
  const manager = ["owner", "admin"].includes(ctx.membership.role);
  const activeCount = manager
    ? (ctx.members || []).filter((m) => m.status === "active").length
    : Number(ctx.members?.[0]?.count || 0);

  const trialText = sub.status === "trialing" && sub.trial_ends_at
    ? " bis " + formatDate(sub.trial_ends_at)
    : "";

  let html =
    '<div class="company-grid">' +
      '<div class="panel company-hero">' +
        '<span class="company-kicker">Firmenkonto</span><h3>' + escCompany(company.name) + '</h3>' +
        '<div class="company-facts">' +
          '<div><span>Deine Rolle</span><strong>' + escCompany(roleLabel(ctx.membership.role)) + '</strong></div>' +
          '<div><span>Mitarbeiter</span><strong>' + escCompany(activeCount + " / " + (company.seat_limit || "—")) + '</strong></div>' +
          '<div><span>Zugang</span><strong>' + escCompany(subLabel(sub) + trialText) + '</strong></div>' +
        '</div>' +
        '<div class="status-chip ' + (ctx.subscriptionActive ? "ok" : "danger") + '">' +
          (ctx.subscriptionActive ? "Firmenzugang freigeschaltet" : "Firmenzugang derzeit nicht aktiv") +
        '</div>' +
      '</div>';

  if (manager) {
    html +=
      '<div class="panel">' +
        '<span class="company-kicker">Mitarbeiter aufnehmen</span><h3>Firmencode</h3>' +
        '<p class="muted">Mitarbeiter geben diesen Code in ihrem Firmenbereich ein. Freigeschaltet werden sie erst nach deiner Bestätigung.</p>' +
        '<div class="join-code-row"><code id="joinCodeValue">' + escCompany(ctx.joinCode || "—") + '</code>' +
        '<button id="copyJoinCode" class="secondary" type="button">Kopieren</button>' +
        '<button id="rotateJoinCode" class="ghost" type="button">Neuen Code</button></div>' +
      '</div>';
  }

  html += '</div>';

  if (manager) {
    const requests = ctx.pendingRequests || [];
    html += '<div class="panel company-section"><h3>Offene Beitrittsanfragen</h3><div class="list">';
    html += requests.length ? requests.map((r) => {
      const p = r.profile || {};
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Neuer Mitarbeiter";
      return '<div class="list-item"><div class="meta"><strong>' + escCompany(name) + '</strong><span>' +
        escCompany(p.personnel_number ? "Personalnr. " + p.personnel_number : "Anfrage " + formatDate(r.requested_at)) +
        '</span></div><div class="item-actions">' +
        '<button class="icon-btn approve-company" data-request="' + escCompany(r.id) + '">Freigeben</button>' +
        '<button class="icon-btn danger-btn reject-company" data-request="' + escCompany(r.id) + '">Ablehnen</button>' +
        '</div></div>';
    }).join("") : '<p class="muted">Keine offenen Anfragen.</p>';
    html += '</div></div>';

    const members = ctx.members || [];
    html += '<div class="panel company-section"><h3>Mitarbeiter</h3><div class="company-table">';
    html += members.length ? members.map((m) => {
      const p = m.profile || {};
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Mitarbeiter";
      const isOwner = m.role === "owner";
      const roleControl = ctx.membership.role === "owner" && !isOwner
        ? '<select class="member-role" data-user="' + escCompany(m.user_id) + '">' +
            ["admin","supervisor","employee"].map((role) =>
              '<option value="' + role + '"' + (m.role === role ? ' selected' : '') + '>' + escCompany(roleLabel(role)) + '</option>'
            ).join("") +
          '</select>'
        : '<span class="status-chip">' + escCompany(roleLabel(m.role)) + '</span>';
      return '<div class="company-member"><div><strong>' + escCompany(name) + '</strong><span>' +
        escCompany([p.personnel_number, p.site_name].filter(Boolean).join(" · ") || m.status) +
        '</span></div><div class="company-member-actions">' + roleControl +
        (!isOwner ? '<button class="icon-btn danger-btn suspend-member" data-user="' + escCompany(m.user_id) + '">Sperren</button>' : '') +
        '</div></div>';
    }).join("") : '<p class="muted">Noch keine Mitarbeiter.</p>';
    html += '</div></div>';
  }

  root.innerHTML = html;

  if (manager) {
    $e("#copyJoinCode")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(ctx.joinCode || "");
        notify("Firmencode kopiert.");
      } catch { notify("Kopieren nicht möglich.", true); }
    });

    $e("#rotateJoinCode")?.addEventListener("click", async () => {
      if (!confirm("Alten Firmencode wirklich ungültig machen?")) return;
      try {
        const data = await companyAction("rotate_code", { company_id: company.id });
        companyContext = data.context;
        notify("Neuer Firmencode erstellt.");
        renderCompany();
      } catch (e) { notify(e.message, true); }
    });

    document.querySelectorAll(".approve-company").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const data = await companyAction("approve_request", { request_id: button.dataset.request });
          companyContext = data.context;
          notify("Mitarbeiter freigeschaltet.");
          renderCompany();
        } catch (e) { notify(e.message, true); }
      });
    });

    document.querySelectorAll(".reject-company").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const data = await companyAction("reject_request", { request_id: button.dataset.request });
          companyContext = data.context;
          notify("Anfrage abgelehnt.");
          renderCompany();
        } catch (e) { notify(e.message, true); }
      });
    });

    document.querySelectorAll(".member-role").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          const data = await companyAction("set_role", {
            company_id: company.id,
            user_id: select.dataset.user,
            role: select.value
          });
          companyContext = data.context;
          notify("Rolle geändert.");
          renderCompany();
        } catch (e) { notify(e.message, true); }
      });
    });

    document.querySelectorAll(".suspend-member").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Diesen Mitarbeiter für die Firma sperren?")) return;
        try {
          const data = await companyAction("suspend_member", {
            company_id: company.id,
            user_id: button.dataset.user
          });
          companyContext = data.context;
          notify("Mitarbeiter gesperrt.");
          renderCompany();
        } catch (e) { notify(e.message, true); }
      });
    });
  }
}

function setupUpdateFlow() {
  if (!("serviceWorker" in navigator)) return;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.ready.then((reg) => {
    const banner = $e("#updateBanner");
    const button = $e("#applyUpdate");

    const show = () => {
      if (reg.waiting && banner) banner.classList.remove("hidden");
    };

    show();
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller && banner) {
          banner.classList.remove("hidden");
        }
      });
    });

    button?.addEventListener("click", () => {
      if (reg.waiting) reg.waiting.postMessage({ type:"SKIP_WAITING" });
      else location.reload();
    });

    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    setInterval(check, 60 * 60 * 1000);
  });
}

function helperAnswer(question) {
  const q = String(question || "").toLowerCase();
  if (!q.trim()) return "Frag mich zum Beispiel nach Schichten, Urlaub, Firma, PDF oder Updates.";
  if (q.includes("update") || q.includes("aktual")) return "Updates kommen zentral. Wenn eine neue Version bereitsteht, erscheint oben ein Hinweis. Danach reicht ein Tipp auf „Aktualisieren“.";
  if (q.includes("firma") || q.includes("code") || q.includes("mitarbeiter")) return "Im Bereich „Firma“ kann ein Admin Mitarbeiter über den Firmencode aufnehmen. Jeder Beitritt muss bestätigt werden.";
  if (q.includes("nacht") || q.includes("sonntag") || q.includes("feiertag") || q.includes("zuschlag")) return "Trag die Schicht vollständig ein. Die hinterlegten Tarif- und Zuschlagsregeln gehören in die Arbeitsdaten; Sonderwerte können im Profil beziehungsweise Tarifbereich gepflegt werden.";
  if (q.includes("urlaub")) return "Unter „Urlaub“ kannst du Zeiträume eintragen und den Status festhalten. Resturlaub erscheint in der Übersicht.";
  if (q.includes("pdf") || q.includes("bericht") || q.includes("stundenzettel")) return "Unter „Berichte“ erzeugst du den Stundennachweis als PDF und kannst ihn auf dem Handy direkt teilen.";
  if (q.includes("pause")) return "Die Pause ist freiwillig erfassbar. Wenn du Minuten einträgst, werden sie von der Arbeitszeit abgezogen.";
  return "Dazu habe ich noch keine feste Kurzhilfe. Für die Bedienung nutze die Bereiche Übersicht, Dienstzeiten, Urlaub, Meldungen, Berichte und Firma.";
}

function setupHelper() {
  const button = $e("#helperButton");
  const panel = $e("#helperPanel");
  const form = $e("#helperForm");
  const close = $e("#helperClose");
  button?.addEventListener("click", () => panel?.classList.toggle("hidden"));
  close?.addEventListener("click", () => panel?.classList.add("hidden"));
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $e("#helperQuestion");
    const answer = $e("#helperAnswer");
    if (answer) answer.textContent = helperAnswer(input?.value);
  });
}

async function initEnterprise() {
  setupUpdateFlow();
  setupHelper();
  try {
    const client = await getCompanyClient();
    client.auth.onAuthStateChange(() => setTimeout(loadCompany, 0));
    await loadCompany();
  } catch (e) {
    console.error(e);
  }
}

initEnterprise();
