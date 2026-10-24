/* ==========================================================================
   Pawnest frontend (app.js)
   Order of sections:
   1. Original page: data, helpers, views, click and submit handlers
   2. Features: landing page, pet detail, wizard, tracker, charts, visits, log
   3. Accounts: register and login through the Flask API
   4. Part 2: pets, applications, visits, notifications loaded from MySQL
   5. Part 3: preferences, saved animals and donations stored in MySQL
   ========================================================================== */
"use strict";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    ),
  SZ = ["Small", "Medium", "Large"],
  EN = ["Low", "Medium", "High"];
// Demo accounts only. Real deployments must verify credentials on a server (hashed passwords, sessions).
const USERS = {
  admin: { pw: "Admin@123", role: "admin", name: "Asha" },
  staff: { pw: "Staff@123", role: "staff", name: "Sam", sh: 1 },
  aarav: { pw: "Adopt@123", role: "adopter", name: "Aarav" },
};
const SH = { 1: "Happy Paws", 2: "Safe Tails" },
  CAP = { 1: { Dog: 8, Cat: 4 }, 2: { Dog: 3, Cat: 4 } };
let nid = 14;
const P = [
  [1, "Bruno", "Dog", "Labrador", "Large", "Medium", 1, 1, 40, "Available", 1, 1, 1, 0],
  [2, "Coco", "Dog", "Beagle", "Medium", "High", 1, 1, 25, "Available", 1, 1, 1, 0],
  [3, "Max", "Dog", "Labrador", "Large", "High", 1, 0, 160, "Available", 1, 1, 1, 0],
  [4, "Rocky", "Dog", "Pug", "Small", "Low", 1, 1, 120, "Available", 1, 1, 1, 0],
  [5, "Simba", "Dog", "Indie", "Medium", "Medium", 1, 1, 15, "Available", 1, 1, 1, 0],
  [6, "Zoe", "Dog", "Spitz", "Small", "High", 0, 1, 5, "Available", 1, 0, 1, 0],
  [7, "Tiger", "Dog", "German Shepherd", "Large", "High", 0, 0, 3, "Quarantine", 1, 0, 0, 0],
  [8, "Misty", "Cat", "Persian", "Small", "Low", 1, 1, 95, "Available", 1, 1, 1, 0],
  [9, "Luna", "Cat", "Indie", "Small", "Medium", 1, 1, 10, "Available", 1, 1, 0, 0],
  [10, "Daisy", "Dog", "Golden Retriever", "Large", "Medium", 1, 1, 50, "Available", 2, 1, 1, 0],
  [11, "Buddy", "Dog", "Boxer", "Large", "High", 1, 0, 45, "Available", 2, 1, 1, 1],
  [12, "Sheru", "Dog", "Indie", "Medium", "Low", 1, 1, 200, "Available", 2, 1, 1, 0],
  [13, "Kitty", "Cat", "Indie", "Small", "High", 1, 1, 18, "Available", 2, 1, 1, 0],
  [14, "Whiskers", "Cat", "Siamese", "Small", "Low", 0, 0, 70, "Available", 2, 1, 1, 0],
].map(([id, n, sp, br, sz, en, kids, pets, days, st, sh, vac, beh, tr]) => ({
  id,
  n,
  sp,
  br,
  sz,
  en,
  kids,
  pets,
  days,
  st,
  sh,
  vac,
  beh,
  tr,
}));
const A = [
  { id: 1, pet: 1, who: "Aarav", st: "Submitted", s: 90 },
  { id: 2, pet: 1, who: "Vikram", st: "Submitted", s: 75 },
  { id: 3, pet: 8, who: "Priya", st: "Submitted", s: 100 },
];
const S = {
  q: "",
  fav: [],
  sv: 0,
  user: null,
  view: "",
  role: "adopter",
  f: "All",
  fails: 0,
  lock: 0,
  pref: {
    sp: "Dog",
    sz: "Large",
    en: "High",
    home: "House",
    exp: "Experienced",
    yard: 1,
    kids: 1,
    op: 0,
  },
};
const NAV = {
    admin: ["dash", "pets", "apps"],
    staff: ["dash", "pets", "apps"],
    adopter: ["pets", "match", "apps"],
  },
  LBL = { dash: "Dashboard", pets: "Animals", apps: "Applications", match: "My matches" };
const can = (...r) => S.user && r.includes(S.user.role);
const rd = (p) =>
  p.st === "Quarantine"
    ? "Quarantine"
    : p.tr
      ? "Under treatment"
      : !p.vac
        ? "Needs vaccination"
        : !p.beh
          ? "Needs behavior check"
          : "Ready";
const live = () => P.filter((p) => p.st !== "Adopted");
const avg = (sp) => {
  const a = P.filter((p) => p.sp === sp && p.st === "Available");
  return a.reduce((s, p) => s + p.days, 0) / (a.length || 1);
};
const long = (p) => p.st === "Available" && (p.days > 90 || p.days > 1.5 * avg(p.sp));
const caps = () => {
  const o = [];
  for (const h in CAP)
    for (const sp in CAP[h]) {
      const c = live().filter((p) => p.sh == h && p.sp === sp).length,
        m = CAP[h][sp],
        pc = Math.round((c / m) * 100);
      o.push({ h, sp, c, m, pc, k: pc >= 90 ? "bad" : pc >= 70 ? "warn" : "ok" });
    }
  return o;
};
function match(a) {
  return P.filter(
    (p) =>
      p.st === "Available" &&
      rd(p) === "Ready" &&
      (a.sp === "Any" || a.sp === p.sp) &&
      (!a.kids || p.kids) &&
      (!a.op || p.pets),
  )
    .map((p) => {
      let s = 0;
      const r = [],
        t = (c, w, y, n) => {
          if (c) {
            s += w;
            r.push("✓ " + y);
          } else r.push("△ " + n);
        };
      t(a.sz === "Any" || a.sz === p.sz, 25, "Size fits", "Different size");
      t(a.en === "Any" || a.en === p.en, 25, "Energy fits", "Different energy");
      t(
        !(a.home === "Apartment" && p.sz === "Large"),
        20,
        "Suits your home",
        "Large for an apartment",
      );
      t(
        !(a.exp === "First-time" && p.en === "High"),
        15,
        "Suits your experience",
        "High energy for a first-timer",
      );
      t(a.yard || p.en !== "High", 15, "Room to play", "Needs a yard");
      return { p, s, r };
    })
    .sort((x, y) => y.s - x.s);
}
const BRD = {
    Labrador: { c: "#e3b668", e: "#c99a4c", m: "#f1d8a0", t: "drop" },
    Beagle: { c: "#f6f1e8", e: "#8a5530", m: "#fff", t: "drop", cap: "#b8763f" },
    Pug: { c: "#e8cfa4", e: "#2e2a2a", m: "#2e2a2a", t: "fold", mask: 1 },
    Indie: { c: "#c98f55", e: "#a8713d", m: "#ecd2a8", t: "prick" },
    Spitz: { c: "#fdfdfd", e: "#efe4d4", m: "#fff", t: "prick", ruff: 1 },
    "German Shepherd": { c: "#c88a45", e: "#3a2c22", m: "#3a2c22", t: "tall", mask: 1 },
    "Golden Retriever": { c: "#e0a14e", e: "#c9863a", m: "#f2cc8a", t: "drop" },
    Boxer: { c: "#b9753a", e: "#8a5428", m: "#2b2321", t: "fold", mask: 1 },
  },
  BCT = {
    Persian: { c: "#f3e6d3", e: "#e8d4b8", eye: "#e0892b", flat: 1 },
    Siamese: { c: "#f1e3cc", e: "#6b4a3a", eye: "#5aa8e0", mask: "#6b4a3a" },
    Indie: { c: "#d98c3f", e: "#b86f28", eye: "#7fb04a", str: 1 },
  };
const SPECIES = ["Dog", "Cat", "Rabbit", "Bird", "Guinea Pig", "Hamster", "Turtle"];
const PIC2 = {};
const SMALLFEE = { Rabbit: 700, Bird: 600, "Guinea Pig": 500, Hamster: 300, Turtle: 400 };
const pic = (p, s) => {
  if (PIC2[p.sp] && !p.img) return PIC2[p.sp](p, s);
  if (p.img)
    return `<img class="ic bi" src="${esc(p.img)}" alt="${esc(p.n)}" style="object-fit:cover;border-radius:50%${s ? `;width:${s}px;height:${s}px` : ""}">`;
  const D = "#2a2323",
    cat = p.sp === "Cat",
    b = cat
      ? BCT[p.br] || { c: "#bdb7ad", e: "#a19a8f", eye: "#c9a227" }
      : BRD[p.br] || { c: "#c9a56a", e: "#a8854a", m: "#ecd9b3", t: "drop" };
  let g = "";
  if (cat) {
    g = `<path d="M18 44L22 12 44 28Z" fill="${b.e}"/><path d="M82 44L78 12 56 28Z" fill="${b.e}"/><path d="M24 36L26 20 38 29ZM76 36L74 20 62 29Z" fill="#f4b6c0"/><ellipse cx="50" cy="56" rx="${b.flat ? 33 : 30}" ry="${b.flat ? 27 : 26}" fill="${b.c}"/>${b.mask ? `<ellipse cx="50" cy="62" rx="15" ry="14" fill="${b.mask}" opacity=".85"/>` : ""}${b.str ? '<path d="M50 32v10M40 34l3 8M60 34l-3 8" stroke="#8f4f17" stroke-width="3" stroke-linecap="round" fill="none"/>' : ""}<ellipse cx="38" cy="52" rx="5" ry="${b.flat ? 5 : 6}" fill="${b.eye}"/><ellipse cx="62" cy="52" rx="5" ry="${b.flat ? 5 : 6}" fill="${b.eye}"/><ellipse cx="38" cy="52" rx="1.6" ry="4.5" fill="${D}"/><ellipse cx="62" cy="52" rx="1.6" ry="4.5" fill="${D}"/><path d="M46 61h8l-4 4z" fill="#e58b9a"/><path d="M50 65v3M50 68q-4 4-8 1M50 68q4 4 8 1M14 60l16 3M14 68l16-2M86 60l-16 3M86 68l-16-2" stroke="${D}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else {
    const ear = {
        drop: `<ellipse cx="22" cy="48" rx="10" ry="21" transform="rotate(12 22 48)" fill="${b.e}"/><ellipse cx="78" cy="48" rx="10" ry="21" transform="rotate(-12 78 48)" fill="${b.e}"/>`,
        fold: `<path d="M20 28q-8 12 0 24 10-4 14-18zM80 28q8 12 0 24-10-4-14-18z" fill="${b.e}"/>`,
        prick: `<path d="M18 44L22 10 44 28zM82 44L78 10 56 28z" fill="${b.e}"/>`,
        tall: `<path d="M16 46L20 4 46 26zM84 46L80 4 54 26z" fill="${b.e}"/>`,
      }[b.t],
      er = b.t === "fold" ? 4.2 : 3.2;
    g = `${b.ruff ? `<circle cx="50" cy="56" r="40" fill="${b.c}" stroke="#e5ddd0" stroke-width="2"/>` : ""}${ear}<ellipse cx="50" cy="52" rx="28" ry="26" fill="${b.c}"/>${b.cap ? `<path d="M26 40q24-26 48 0-24 6-48 0z" fill="${b.cap}"/><ellipse cx="50" cy="52" rx="5" ry="16" fill="#fff"/>` : ""}<ellipse cx="50" cy="65" rx="${b.mask ? 17 : 15}" ry="${b.mask ? 14 : 11}" fill="${b.m}"/><circle cx="38" cy="47" r="${er}" fill="${D}"/><circle cx="62" cy="47" r="${er}" fill="${D}"/><circle cx="39" cy="46" r="1.1" fill="#fff"/><circle cx="63" cy="46" r="1.1" fill="#fff"/><ellipse cx="50" cy="74" rx="4" ry="3" fill="#f08a96"/><ellipse cx="50" cy="59" rx="5.5" ry="4" fill="${b.mask ? "#4a4040" : D}"/><path d="M50 63v5M50 68q-5 5-9 1M50 68q5 5 9 1" stroke="${b.mask ? "#fff" : D}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  return `<svg class="ic bi" viewBox="0 0 100 100" role="img" aria-label="${esc(p.br)} ${p.sp.toLowerCase()}"${s ? ` style="width:${s}px;height:${s}px"` : ""}>${g}</svg>`;
};
const ico = (p) => `<div class="av t${p.id % 5}">${pic(p)}</div>`;
const sel = (n, o, v) =>
  `<select name="${n}">${o.map((x) => `<option${x === v ? " selected" : ""}>${x}</option>`).join("")}</select>`;
const card = (
  p,
  st,
) => `<div class="card pet">${ico(p)}${st ? "" : heart(p)}<h3>${esc(p.n)}</h3><p class="mut">${esc(p.br)}</p><p class="mut">${p.sz} size, ${p.en.toLowerCase()} energy</p><p class="mut">${esc(SH[p.sh])}, ${p.days} days here</p>
${
  st
    ? `<div class="bar sm" title="Health checklist"><i style="width:${prog(p)}%"></i></div><p class="mut">Health checklist ${prog(p)}% done</p><span class="chip ${rd(p) === "Ready" ? "ok" : "warn"}">${rd(p)}</span>${long(p) ? '<span class="chip bad">Long stay</span>' : ""}<div>${!p.vac && p.st !== "Quarantine" ? `<button class="btn sm alt" data-act="fix" data-f="vac" data-id="${p.id}">Mark vaccinated</button>` : ""}${!p.beh && p.st !== "Quarantine" ? `<button class="btn sm alt" data-act="fix" data-f="beh" data-id="${p.id}">Behavior checked</button>` : ""}${p.tr ? `<button class="btn sm alt" data-act="fix" data-f="tr" data-id="${p.id}">Treatment done</button>` : ""}</div>`
    : `${p.kids ? '<span class="chip ok">Good with kids</span>' : ""}${p.pets ? '<span class="chip ok">Good with pets</span>' : ""}<div><button class="btn sm" data-act="apply" data-id="${p.id}">Apply to adopt</button></div>`
}</div>`;
const heart = (p) =>
  `<button class="hrt${S.fav.includes(p.id) ? " on" : ""}" data-act="fav" data-id="${p.id}" aria-pressed="${S.fav.includes(p.id)}" aria-label="Save ${esc(p.n)}">&hearts;</button>`;
const prog = (p) => Math.round((((p.vac ? 1 : 0) + (p.beh ? 1 : 0) + (p.tr ? 0 : 1)) / 3) * 100);
const petList = (st) => {
  let l = st
    ? live()
    : P.filter(
        (p) =>
          p.st === "Available" &&
          rd(p) === "Ready" &&
          !A.some((a) => a.pet === p.id && a.who === S.user.name && a.st === "Submitted"),
      );
  if (S.f !== "All") l = l.filter((p) => p.sp === S.f);
  if (S.q) l = l.filter((p) => (p.n + " " + p.br).toLowerCase().includes(S.q));
  if (S.sv && !st) l = l.filter((p) => S.fav.includes(p.id));
  return (
    l.map((p) => card(p, st)).join("") ||
    '<p class="mut">No animals match yet. Try a different search.</p>'
  );
};
const party = () => {
  const c = ["#1d7f86", "#ffd95e", "#ffb3c1", "#9fd4ff", "#9be8b8"];
  for (let i = 0; i < 36; i++) {
    const e = document.createElement("i");
    e.className = "cf";
    e.style.cssText = `left:${Math.random() * 100}vw;background:${c[i % 5]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.4 + Math.random()}s`;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 2600);
  }
};
const V = {
  dash() {
    const c = caps(),
      R = {};
    live().forEach((p) => (R[rd(p)] = (R[rd(p)] || 0) + 1));
    const L = live().filter(long),
      n = live().length;
    return `<h2>Shelter dashboard</h2><div class="stats"><div class="card stat"><b>${n}</b>animals in care</div><div class="card stat"><b>${R.Ready || 0}</b>ready to adopt</div><div class="card stat"><b>${L.length}</b>long-stay animals</div><div class="card stat"><b>${A.filter((a) => a.st === "Submitted").length}</b>open applications</div></div>
<div class="card"><h3>Shelter capacity <span class="mut" style="font-size:.8rem">(busiest first)</span></h3>${c.filter((x) => x.c > 0).sort((a, b) => b.pc - a.pc).slice(0, 14).map((x) => `<div class="row"><span>${esc(SH[x.h])}, ${x.sp}s: ${x.c} of ${x.m}</span><span class="chip ${x.k}">${x.pc}%</span></div><div class="bar"><i class="${x.k}" style="width:${Math.min(x.pc, 100)}%"></i></div>`).join("")}</div>
<div class="card"><h3>Happy tails</h3>${(() => {
      const a = P.filter((p) => p.st === "Adopted");
      return a.length
        ? a.map((p) => `<span class="chip ok">${esc(p.n)} found a home</span>`).join("")
        : '<p class="mut">No adoptions yet. Approved adoptions will appear here.</p>';
    })()}</div>
<div class="card"><h3>Adoption readiness</h3>${Object.entries(R)
      .map(
        ([k, v]) =>
          `<div class="row"><span>${k}</span><b>${v}</b></div><div class="bar"><i style="width:${(v / n) * 100}%"></i></div>`,
      )
      .join("")}</div>
<div class="card"><h3>Animals waiting longer than usual</h3>${L.length ? L.map((p) => `<div class="row"><span><b>${esc(p.n)}</b>, ${p.days} days (${p.sp} average ${Math.round(avg(p.sp))})</span><span class="mut">Feature on the home page or offer a reduced fee</span></div>`).join("") : '<p class="mut">No long-stay animals right now.</p>'}</div>`;
  },
  pets() {
    const st = can("admin", "staff", "vet");
    return `<h2>${st ? "Animals in our shelters" : "Find your new best friend"}</h2>
${st ? `<details class="card"><summary>Add a new animal</summary><form data-form="pet" class="fg"><label>Name<input name="n" maxlength="30" required></label><label>Breed<input name="br" maxlength="30" required></label><label>Species${sel("sp", SPECIES)}</label><label>Size${sel("sz", SZ)}</label><label>Energy${sel("en", EN)}</label>${S.user.role === "admin" ? `<label>Shelter<select name="sh"><option value="1">${SH[1]}</option><option value="2">${SH[2]}</option></select></label>` : ""}<button class="btn">Add animal</button></form></details>` : ""}
<div class="tools"><label>Search<input data-act="srch" type="search" maxlength="30" placeholder="Name or breed" value="${esc(S.q)}"></label><label>Show<select data-act="filt">${["All", ...SPECIES].map((x) => `<option${x === S.f ? " selected" : ""}>${x}</option>`).join("")}</select></label>${st ? "" : `<button class="btn alt tg${S.sv ? " on" : ""}" data-act="sv">&hearts; Saved (${S.fav.length})</button>`}</div>
<div class="grid" id="pg">${petList(st)}</div>`;
  },
  match() {
    const a = S.pref,
      m = match(a);
    return `<h2>Animals that suit you</h2><form class="card fg" data-form="pref"><label>Looking for${sel("sp", ["Any", ...SPECIES], a.sp)}</label><label>Size${sel("sz", ["Any", ...SZ], a.sz)}</label><label>Energy${sel("en", ["Any", ...EN], a.en)}</label><label>Home${sel("home", ["House", "Apartment"], a.home)}</label><label>Experience${sel("exp", ["First-time", "Some", "Experienced"], a.exp)}</label>
<label><input type="checkbox" name="yard" style="width:auto"${a.yard ? " checked" : ""}> I have a yard</label><label><input type="checkbox" name="kids" style="width:auto"${a.kids ? " checked" : ""}> Children at home</label><label><input type="checkbox" name="op" style="width:auto"${a.op ? " checked" : ""}> Other pets at home</label><button class="btn">Update my matches</button></form>
<div class="grid">${m.map(({ p, s, r }) => `<div class="card pet">${ico(p)}${heart(p)}<h3>${esc(p.n)} <span class="chip ok">${s}% match</span></h3><p class="mut">${esc(p.br)}, ${esc(SH[p.sh])}</p>${r.map((x) => `<p class="mut">${x}</p>`).join("")}<button class="btn sm" data-act="apply" data-id="${p.id}">Apply to adopt</button></div>`).join("") || '<p class="mut">No ready animals fit these needs yet. Try loosening size or energy.</p>'}</div>`;
  },
  apps() {
    const st = can("admin", "staff", "vet"),
      l = st ? A : A.filter((a) => a.who === S.user.name);
    return `<h2>${st ? "Adoption applications" : "My applications"}</h2><div class="card tw"><table><tr><th>Animal</th><th>Applicant</th><th>Match</th><th>Status</th>${st ? "<th></th>" : ""}</tr>${
      l
        .map((a) => {
          const p = P.find((x) => x.id === a.pet);
          return `<tr><td>${esc(p.n)}</td><td>${esc(a.who)}</td><td>${a.s}%</td><td><span class="chip ${a.st === "Approved" ? "ok" : a.st === "Rejected" ? "bad" : ""}">${a.st}</span></td>${st ? `<td>${a.st === "Submitted" ? `<button class="btn sm" data-act="ok" data-id="${a.id}">Approve</button><button class="btn sm no" data-act="no" data-id="${a.id}">Decline</button>` : ""}</td>` : ""}</tr>`;
        })
        .join("") ||
      '<tr><td colspan="5" class="mut">Nothing here yet. Browse the animals to apply.</td></tr>'
    }</table></div>`;
  },
};
function render() {
  const u = S.user;
  $("#app").innerHTML = u
    ? `<header class="top"><div class="brand"><svg class="ic"><use href="#paw"/></svg> Pawnest</div><nav>${NAV[u.role].map((v) => `<button class="nb${v === S.view ? " on" : ""}" data-act="go" data-v="${v}">${LBL[v]}</button>`).join("")}</nav><div class="who">${esc(u.name)} <span class="chip">${u.role}</span><button class="nb" data-act="out">Log out</button></div></header><main class="wrap"><section class="banner"><div><h1>Hi ${esc(u.name)}!</h1><p>${u.role === "adopter" ? "Your next best friend is waiting." : "Here is how the shelters are doing today."}</p></div><div class="trio"><div class="av t0"><svg class="ic"><use href="#dog"/></svg></div><div class="av t2"><svg class="ic"><use href="#cat"/></svg></div><div class="av t3"><svg class="ic"><use href="#dog"/></svg></div></div></section>${V[S.view]()}</main>`
    : `<main class="login"><section class="hero"><div class="trio"><div class="av t0"><svg class="ic"><use href="#dog"/></svg></div><div class="av t1"><svg class="ic"><use href="#cat"/></svg></div><div class="av t3"><svg class="ic"><use href="#dog"/></svg></div></div><h1>Pawnest</h1><p>A calm place where shelters care for animals and families find the right one.</p></section>
<section class="card"><h2>Welcome back</h2><div class="tabs">${["admin", "vet", "adopter"].map((r) => `<button type="button" class="nb${S.role === r ? " on" : ""}" data-act="role" data-v="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join("")}</div>
<form data-form="login"><label>Username<input name="u" autocomplete="username" maxlength="30" required></label><label>Password<input name="p" type="password" autocomplete="current-password" maxlength="64" required></label><p id="err" role="alert"></p><button class="btn" style="width:100%">Sign in as ${S.role}</button></form>
</section></main>`;
}
const go = (v) => {
  if (!S.user) return;
  S.view = NAV[S.user.role].includes(v) ? v : NAV[S.user.role][0];
  render();
  scrollTo(0, 0);
};
let idle;
const bump = () => {
  clearTimeout(idle);
  if (S.user)
    idle = setTimeout(() => {
      out();
      msg("Signed out after 10 minutes of inactivity.");
    }, 6e5);
};
const out = () => {
  S.user = null;
  S.view = "";
  clearTimeout(idle);
  render();
};
let tm;
const msg = (t) => {
  const e = $("#toast");
  e.textContent = t;
  e.classList.add("on");
  clearTimeout(tm);
  tm = setTimeout(() => e.classList.remove("on"), 2800);
};
const H = {
  login(d) {
    const e = $("#err");
    if (Date.now() < S.lock) {
      e.textContent = "Too many attempts. Please wait a few seconds.";
      return;
    }
    const u = String(d.u || "")
        .trim()
        .toLowerCase(),
      a = Object.hasOwn(USERS, u) ? USERS[u] : null;
    if (!a || a.role !== S.role || a.pw !== d.p) {
      if (++S.fails >= 5) {
        S.lock = Date.now() + 3e4;
        S.fails = 0;
      }
      e.textContent = "Those details do not match this role.";
      return;
    }
    S.fails = 0;
    S.user = { name: a.name, role: a.role, sh: a.sh };
    go(NAV[a.role][0]);
    bump();
  },
  pet(d) {
    if (!can("admin", "staff", "vet")) return;
    const n = String(d.n).trim(),
      br = String(d.br).trim(),
      re = /^[A-Za-z][A-Za-z .'-]{0,29}$/;
    if (!re.test(n) || !re.test(br)) return msg("Use letters only for name and breed.");
    if (!SPECIES.includes(d.sp) || !SZ.includes(d.sz) || !EN.includes(d.en))
      return msg("Please pick from the lists.");
    const sh = S.user.role === "staff" ? S.user.sh : +d.sh;
    if (!SH[sh]) return;
    if (live().filter((p) => p.sh === sh && p.sp === d.sp).length >= CAP[sh][d.sp])
      return msg(SH[sh] + " is full for " + d.sp.toLowerCase() + "s.");
    P.push({
      id: ++nid,
      n,
      sp: d.sp,
      br,
      sz: d.sz,
      en: d.en,
      kids: 1,
      pets: 1,
      days: 0,
      st: "Available",
      sh,
      vac: 0,
      beh: 0,
      tr: 0,
    });
    msg(n + " added.");
    render();
  },
  pref(d, f) {
    if (!can("adopter")) return;
    const g = (k) => (f.elements[k].checked ? 1 : 0);
    S.pref = {
      sp: ["Any", ...SPECIES].includes(d.sp) ? d.sp : "Any",
      sz: ["Any", ...SZ].includes(d.sz) ? d.sz : "Any",
      en: ["Any", ...EN].includes(d.en) ? d.en : "Any",
      home: d.home === "Apartment" ? "Apartment" : "House",
      exp: ["First-time", "Some", "Experienced"].includes(d.exp) ? d.exp : "Some",
      yard: g("yard"),
      kids: g("kids"),
      op: g("op"),
    };
    render();
  },
};
document.addEventListener("submit", (e) => {
  const f = e.target.dataset.form;
  if (!f || !Object.hasOwn(H, f)) return;
  e.preventDefault();
  H[f](Object.fromEntries(new FormData(e.target)), e.target);
  bump();
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.act === "srch") {
    bump();
    S.q = e.target.value.trim().toLowerCase().slice(0, 30);
    const g = $("#pg");
    if (g) {
      g.classList.add("nopop");
      g.innerHTML = petList(can("admin", "staff", "vet"));
    }
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.act === "filt" && ["All", ...SPECIES].includes(e.target.value)) {
    S.f = e.target.value;
    render();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  bump();
  const a = b.dataset.act,
    id = +b.dataset.id,
    p = P.find((x) => x.id === id),
    ap = A.find((x) => x.id === id);
  if (a === "role" && ["admin", "vet", "staff", "adopter"].includes(b.dataset.v)) {
    S.role = b.dataset.v;
    render();
  } else if (a === "go") go(b.dataset.v);
  else if (a === "out") out();
  else if (a === "fav" && can("adopter") && p) {
    const i = S.fav.indexOf(id);
    if (i < 0) S.fav.push(id);
    else S.fav.splice(i, 1);
    b.classList.toggle("on", i < 0);
    b.setAttribute("aria-pressed", i < 0);
    msg(i < 0 ? "Saved " + p.n + "." : "Removed " + p.n + " from saved.");
  } else if (a === "sv") {
    S.sv = S.sv ? 0 : 1;
    render();
  } else if (a === "apply" && can("adopter") && p && p.st === "Available" && rd(p) === "Ready") {
    if (A.some((x) => x.pet === id && x.who === S.user.name && x.st === "Submitted"))
      return msg("You already applied for " + p.n + ".");
    A.push({
      id: A.length + 1,
      pet: id,
      who: S.user.name,
      st: "Submitted",
      s: (match(S.pref).find((m) => m.p.id === id) || { s: 60 }).s,
    });
    msg("Application sent for " + p.n + ".");
    render();
  } else if (
    a === "fix" &&
    can("admin", "staff", "vet") &&
    p &&
    ["vac", "beh", "tr"].includes(b.dataset.f)
  ) {
    p[b.dataset.f] = b.dataset.f === "tr" ? 0 : 1;
    render();
  } else if ((a === "ok" || a === "no") && can("admin", "staff", "vet") && ap && ap.st === "Submitted") {
    if (a === "no") ap.st = "Rejected";
    else {
      ap.st = "Approved";
      A.forEach((x) => {
        if (x.pet === ap.pet && x !== ap && x.st === "Submitted") x.st = "Rejected";
      });
      P.find((x) => x.id === ap.pet).st = "Adopted";
    }
    msg(a === "ok" ? "Adoption approved." : "Application declined.");
    if (a === "ok") party();
    render();
  }
});
render();
("use strict");
const dt = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10),
  SLOTS = ["10:00", "11:30", "14:00", "15:30", "17:00"],
  TS = ["Submitted", "Under review", "Home check", "Meet & greet", "Approved"],
  LOG = [],
  NT = [],
  VIS = [{ id: 1, pet: 1, who: "Vikram", date: dt(3), slot: "11:30" }];
let vid = 1;
Object.assign(S, {
  cmp: [],
  feat: [],
  disc: [],
  don: 18500,
  login: 0,
  w: null,
  bell: 0,
  pd: 0,
  dark: 0,
});
[1, 0, 2].forEach((s, i) => (A[i].stage = s));
NAV.admin.push("visits", "log");
NAV.staff.push("visits", "log");
NAV.adopter.push("visits");
LBL.visits = "Visits";
LBL.log = "Activity log";
const lg = (a, w) =>
    LOG.unshift({
      t: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      w: w || (S.user ? S.user.name : "Public"),
      a,
    }),
  nt = (to, t) => NT.unshift({ to, t, r: 0 }),
  mine = (n) => S.user && (n.to === S.user.name || (n.to === "staff" && can("admin", "staff", "vet"))),
  FEE = (p) => {
    const f = SMALLFEE[p.sp] || { Small: 1500, Medium: 2000, Large: 2500 }[p.sz] - (p.sp === "Cat" ? 300 : 0);
    return S.disc.includes(p.id) ? Math.round(f * 0.8) : f;
  },
  pred = (p) =>
    Math.max(
      7,
      Math.round(
        avg(p.sp) * 0.5 +
          { Small: 5, Medium: 12, Large: 25 }[p.sz] +
          { Low: 0, Medium: 5, High: 12 }[p.en] +
          (p.kids ? 0 : 10) +
          (p.pets ? 0 : 8) -
          (S.feat.includes(p.id) ? 15 : 0) -
          (S.disc.includes(p.id) ? 10 : 0),
      ),
    ),
  bio = (p) =>
    `${p.n} is a ${p.sz.toLowerCase()} ${p.br} with ${p.en.toLowerCase()} energy${p.kids ? ", gentle with children" : ""}${p.pets ? " and friendly with other pets" : ""}. ${p.en === "High" ? "Loves long walks and games." : p.en === "Low" ? "A calm companion who enjoys lazy afternoons." : "Enjoys play but is happy to relax at home."}`,
  spark = (a) => {
    const m = Math.max(...a),
      n = Math.min(...a),
      q = a.map((v, i) => `${10 + i * 60},${45 - ((v - n) / (m - n || 1)) * 35}`).join(" ");
    return `<svg viewBox="0 0 200 50" style="width:100%;max-width:240px" role="img" aria-label="Weight trend"><polyline points="${q}" fill="none" stroke-width="3" stroke-linecap="round" style="stroke:var(--br)"/></svg>`;
  },
  bars = (d, l) => {
    const m = Math.max(...d, 1);
    return `<svg viewBox="0 0 300 130" role="img" aria-label="Chart" style="width:100%">${d
      .map((v, i) => {
        const h = (v / m) * 80;
        return `<rect x="${12 + i * 48}" y="${100 - h}" width="32" height="${h}" rx="6" style="fill:var(--bf)"/><text x="${28 + i * 48}" y="${94 - h}" text-anchor="middle" font-size="11" style="fill:var(--ink)">${v}</text><text x="${28 + i * 48}" y="118" text-anchor="middle" font-size="11" style="fill:var(--mut)">${l[i]}</text>`;
      })
      .join("")}</svg>`;
  },
  donut = (a, b) => {
    const x = (a / (a + b || 1)) * 100;
    return `<svg viewBox="0 0 42 42" style="width:120px" role="img" aria-label="Species split"><circle cx="21" cy="21" r="15.9" fill="none" stroke-width="7" style="stroke:var(--a1)"/><circle cx="21" cy="21" r="15.9" fill="none" stroke-width="7" stroke-dasharray="${x} ${100 - x}" transform="rotate(-90 21 21)" style="stroke:var(--br)"/><text x="21" y="23" text-anchor="middle" font-size="7" style="fill:var(--ink)">${a + b}</text></svg>`;
  },
  rows = (l, mx) =>
    l
      .map(
        ([k, v]) =>
          `<div class="row"><span>${k}</span><b>${v}</b></div><div class="bar"><i style="width:${Math.min((v / (mx || 1)) * 100, 100)}%"></i></div>`,
      )
      .join("");

/* landing */
function landing() {
  const ad = P.filter((p) => p.st === "Adopted").length + 212,
    ids = [
      ...new Set([
        ...S.feat,
        ...P.filter((p) => p.st === "Available" && long(p)).map((p) => p.id),
        ...P.filter((p) => p.st === "Available" && rd(p) === "Ready").map((p) => p.id),
      ]),
    ]
      .slice(0, 4)
      .map((i) => P.find((x) => x.id === i));
  $("#app").innerHTML =
    `<header class="top"><div class="brand"><svg class="ic"><use href="#paw"/></svg> Pawnest</div><nav><a class="nb" href="#how">How it works</a><a class="nb" href="#stories">Stories</a><a class="nb" href="#help">Help</a><a class="nb" href="#faq">FAQ</a></nav><div class="who"><button class="nb" data-act="theme" aria-label="Toggle dark mode">◐</button><button class="btn sm alt" style="margin:0 .4rem 0 0" data-act="reg">Register</button><button class="btn sm" style="margin:0" data-act="signin">Sign in</button></div></header>
<main class="wrap"><section class="lh"><div class="trio"><div class="av t0"><svg class="ic"><use href="#dog"/></svg></div><div class="av t1"><svg class="ic"><use href="#cat"/></svg></div><div class="av t3"><svg class="ic"><use href="#dog"/></svg></div></div><h1>Find the pet who fits your life</h1><p>Pawnest connects two city shelters with families. Every animal is health-checked, and our matching explains why a pet suits you.</p><button class="btn" data-act="signin">Meet the animals</button> <a class="btn alt" style="text-decoration:none;display:inline-block" href="#how">How it works</a></section>
<div class="stats"><div class="card stat"><b>${ad}</b>happy adoptions</div><div class="card stat"><b>${live().length}</b>animals in our care</div><div class="card stat"><b>${live().filter((p) => rd(p) === "Ready").length}</b>ready to go home</div><div class="card stat"><b>2</b>partner shelters</div></div>
<h2>Meet some of our animals</h2><div class="grid">${ids.map((p) => `<div class="card pet">${ico(p)}<h3>${esc(p.n)}</h3><p class="mut">${esc(p.br)}, ${p.sz.toLowerCase()}, ${p.en.toLowerCase()} energy</p><p class="mut">${esc(SH[p.sh])}</p>${S.feat.includes(p.id) ? '<span class="chip warn">Featured</span>' : ""}<div><button class="btn sm" data-act="signin">Sign in to meet ${esc(p.n)}</button></div></div>`).join("")}</div>
<h2 id="how" style="margin-top:2.4rem">How adoption works</h2><div class="steps">${["Browse and match", "Apply online", "Home check and visit", "Take them home"].map((s, i) => `<div class="card"><b>${i + 1}</b><h3>${s}</h3><p class="mut">${["Filter by size and energy, or let our matcher rank animals for you.", "A short four-step form. Track every stage afterwards.", "We confirm your home suits the pet, then book a meet and greet.", "Sign the papers and start your life together."][i]}</p></div>`).join("")}</div>
<h2 id="stories" style="margin-top:2.4rem">Happy tails <span class="mut" style="font-size:.9rem">(sample stories)</span></h2><div class="steps">${[
      ["Tiger", '"He settled in on day one and now owns the sofa."', "Neha, Pune"],
      ["Luna", '"The compatibility score was spot on for our flat."', "Rohan, Pune"],
      ["Oreo", '"Staff walked us through every health record."', "Ishita, Pimpri"],
    ]
      .map(([n, q, w]) => `<div class="card"><h3>${n}</h3><p>${q}</p><p class="mut">${w}</p></div>`)
      .join("")}</div>
<h2 id="help" style="margin-top:2.4rem">Help us help them</h2><div class="sg"><div class="card"><h3>Donate</h3><div class="bar"><i id="dbar" style="width:${S.don / 500}%"></i></div><p class="mut" id="dtxt">₹${S.don.toLocaleString("en-IN")} raised of ₹50,000 goal</p>${[500, 1000, 2500].map((v) => `<button class="btn sm alt" data-act="don" data-v="${v}">₹${v}</button>`).join("")}<p class="mut">Demo checkout, no payment is taken.</p></div>
<form class="card" data-form="stray"><h3>Report a stray</h3><label>Location<input name="l" maxlength="80" required></label><label>What did you see?<input name="x" maxlength="120"></label><button class="btn">Send to rescue team</button></form></div>
<h2 id="faq" style="margin-top:2.4rem">Questions</h2>${[
      [
        "What does adopting cost?",
        "Fees start at ₹1,200 and cover vaccination, sterilisation and a health card.",
      ],
      [
        "How long does approval take?",
        "Usually 3 to 5 days, including the home check and meet and greet.",
      ],
      ["Can I return a pet?", "Yes. We take animals back and help find a better match."],
    ]
      .map(
        ([q, a]) =>
          `<details class="card"><summary>${q}</summary><p class="mut">${a}</p></details>`,
      )
      .join("")}
<footer class="ft" id="contact"><div><b>Happy Paws</b><br>Baner Road, Pune<br>Open daily 10:00 to 18:00</div><div><b>Safe Tails</b><br>Kothrud, Pune<br>Open Mon to Sat 10:00 to 17:00</div><div><b>Contact</b><br>hello@pawnest.example<br>Privacy · Terms · © 2026 Pawnest</div></footer></main>`;
}

/* render wrapper */
const R0 = render;
render = function () {
  const o = $("#bp");
  o && o.remove();
  if (S.user) S.wasIn = 1;
  else if (S.wasIn) {
    S.wasIn = 0;
    S.login = 0;
  }
  if (!S.user && S.reg) return regPage();
  if (!S.user && !S.login) return landing();
  R0();
  if (S.user) {
    const w = $(".who"),
      un = S.bell ? 0 : NT.filter((n) => mine(n) && !n.r).length;
    w &&
      w.insertAdjacentHTML(
        "afterbegin",
        `<button class="nb" data-act="theme" aria-label="Toggle dark mode">◐</button><button class="nb" data-act="bell" aria-label="Notifications">🔔${un ? `<span class="bdg">${un}</span>` : ""}</button>`,
      );
    if (S.bell) {
      const l = NT.filter(mine);
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="bp" class="card"><h3>Notifications</h3>${l.map((n) => `<p class="mut">${esc(n.t)}</p>`).join("") || '<p class="mut">Nothing new.</p>'}</div>`,
      );
      l.forEach((n) => (n.r = 1));
    }
  } else {
    const m = $(".login");
    m &&
      m.insertAdjacentHTML(
        "afterbegin",
        '<button class="btn sm no" data-act="home" style="justify-self:start">← Back to home</button>',
      );
    m &&
      m.insertAdjacentHTML(
        "beforeend",
        '<p class="mut" style="text-align:center">New here? <button class="btn sm alt" data-act="reg">Create an account</button></p>',
      );
  }
};
const open = (id) => {
  S.pd = id;
  S.view = "detail";
  render();
  scrollTo(0, 0);
};

/* pet detail with medical record, cost, similar pets */
V.detail = () => {
  const p = P.find((x) => x.id === S.pd);
  if (!p) return V.pets();
  const st = can("admin", "staff", "vet"),
    ok = p.st === "Available" && rd(p) === "Ready",
    sim = P.filter((x) => x !== p && x.sp === p.sp && x.st === "Available").slice(0, 3),
    k = { Small: 1, Medium: 1.4, Large: 1.9 }[p.sz] * ({ Cat: 0.8, Rabbit: 0.5, Bird: 0.4, "Guinea Pig": 0.4, Hamster: 0.25, Turtle: 0.3 }[p.sp] || 1),
    cost = [
      ["Food", 1200],
      ["Vet and vaccines", 700],
      ["Grooming", 500],
      ["Supplies", 400],
    ].map(([n, v]) => [n, Math.round((v * k) / 50) * 50]),
    tot = cost.reduce((s, c) => s + c[1], 0),
    w = [6, 7.2, 7.9, 8.5].map(
      (v) => +(v * { Small: 0.6, Medium: 1.6, Large: 3.2 }[p.sz] + (p.id % 3)).toFixed(1),
    );
  const hl =
    [
      [["Dog", "Cat"].includes(p.sp) ? "Rabies vaccine" : "Health screening", p.vac, "vac"],
      [{ Dog: "DHPP vaccine", Cat: "FVRCP vaccine" }[p.sp] || "Parasite check", p.vac, "vac"],
      ["Behavior assessment", p.beh, "beh"],
    ]
      .map(
        ([n, d, f]) =>
          `<div class="row"><span>${n}</span><span><span class="chip ${d ? "ok" : p.days > 30 ? "bad" : "warn"}">${d ? "Done" : p.days > 30 ? "Overdue" : "Due " + dt((p.id % 5) + 2)}</span>${st && !d ? `<button class="btn sm alt" style="margin:0" data-act="fix" data-f="${f}" data-id="${p.id}">Mark done</button>` : ""}</span></div>`,
      )
      .join("") +
    `<div class="row"><span>Medical treatment</span><span><span class="chip ${p.tr ? "warn" : "ok"}">${p.tr ? "In progress" : "None needed"}</span>${st && p.tr ? `<button class="btn sm alt" style="margin:0" data-act="fix" data-f="tr" data-id="${p.id}">Mark complete</button>` : ""}</span></div>`;
  return `<button class="btn sm no" data-act="go" data-v="pets">← Back to animals</button><div class="dt"><div>${ico(p)}</div><div><h2>${esc(p.n)}</h2><span class="chip ${rd(p) === "Ready" ? "ok" : "warn"}">${rd(p)}</span>${long(p) ? '<span class="chip bad">Long stay</span>' : ""}${S.feat.includes(p.id) ? '<span class="chip warn">Featured</span>' : ""}${S.disc.includes(p.id) ? '<span class="chip ok">20% fee reduction</span>' : ""}<p>${esc(bio(p))}</p><div class="tr"><div><b>Breed</b>${esc(p.br)}</div><div><b>Size</b>${p.sz}</div><div><b>Energy</b>${p.en}</div><div><b>Shelter</b>${esc(SH[p.sh])}</div><div><b>With kids</b>${p.kids ? "Yes" : "Not tested"}</div><div><b>With pets</b>${p.pets ? "Yes" : "Not tested"}</div><div><b>Days here</b>${p.days}</div><div><b>Adoption fee</b>₹${FEE(p)}</div></div>
<p>${can("adopter") && ok ? `<button class="btn" data-act="apply" data-id="${p.id}">Apply to adopt</button> ` : ""}<button class="btn alt" data-act="cmp" data-id="${p.id}">${S.cmp.includes(p.id) ? "Remove from compare" : "Add to compare"}</button></p></div></div>
<div class="sg"><div class="card"><h3>${st ? "Medical record" : "Health checklist"}</h3>${hl}${st ? `<p class="mut">Weight log (kg): ${w.join(" → ")}</p>${spark(w)}<p class="mut">Predicted time to adoption: about ${pred(p)} days</p>` : ""}</div>
<div class="card"><h3>Monthly cost estimate</h3>${rows(
    cost.map((c) => [c[0], "₹" + c[1]]).map((c, i) => [c[0], cost[i][1]]),
    Math.max(...cost.map((c) => c[1])),
  )}<div class="row"><b>Total per month</b><b>₹${tot}</b></div></div></div>
${sim.length ? `<h3 style="margin-top:1.4rem">Similar animals</h3>${sim.map((x) => `<button class="btn sm alt" data-act="det" data-id="${x.id}">${esc(x.n)}, ${esc(x.br)}</button>`).join("")}` : ""}`;
};

/* compare */
const p0 = V.pets;
V.pets = () => {
  const h = p0();
  if (S.cmp.length < 2) return h;
  const l = S.cmp.map((i) => P.find((x) => x.id === i)),
    r = [
      ["Species", (p) => p.sp],
      ["Size", (p) => p.sz],
      ["Energy", (p) => p.en],
      ["Good with kids", (p) => (p.kids ? "Yes" : "No")],
      ["Good with pets", (p) => (p.pets ? "Yes" : "No")],
      ["Status", (p) => rd(p)],
      ["Fee", (p) => "₹" + FEE(p)],
      ["Likely wait", (p) => "~" + pred(p) + " days"],
    ];
  return h.replace(
    '<div class="tools">',
    `<div class="card tw"><h3>Compare</h3><table><tr><th></th>${l.map((p) => `<th>${esc(p.n)}</th>`).join("")}</tr>${r.map(([k, f]) => `<tr><td>${k}</td>${l.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`).join("")}</table><button class="btn sm no" data-act="cx">Clear comparison</button></div><div class="tools">`,
  );
};

/* application wizard */
const STEPS = ["About you", "Your home", "Experience", "Review"];
function wz() {
  let m = $("#wz");
  if (!S.w) {
    m && m.remove();
    return;
  }
  if (!m) {
    m = document.createElement("div");
    m.id = "wz";
    document.body.appendChild(m);
  }
  const { id, step, d } = S.w,
    p = P.find((x) => x.id === id),
    inp = (n, l, v, x = "") =>
      `<label>${l}<input name="${n}" maxlength="40" value="${esc(v || "")}" ${x} required></label>`,
    f = [
      inp("ph", "Phone (10 digits)", d.ph, 'inputmode="numeric"') + inp("ct", "City", d.ct),
      `<label>Home type${sel("ht", ["House", "Apartment"], d.ht || S.pref.home)}</label><label>Ownership${sel("ow", ["Own", "Rent"], d.ow)}</label><label>Yard${sel("yd", ["Yes", "No"], d.yd || (S.pref.yard ? "Yes" : "No"))}</label>`,
      `<label>Pets owned before${sel("pp", ["None", "Some", "Many"], d.pp)}</label><label>Hours alone per day${sel("hr", ["Under 4", "4 to 8", "Over 8"], d.hr)}</label>` +
        inp("rf", "Reference name", d.rf),
      `<div class="card" style="box-shadow:none"><p class="mut">${esc(d.ct)} · ${esc(d.ht)} (${esc(d.ow)}) · yard: ${esc(d.yd)}</p><p class="mut">${esc(d.pp)} prior pets · ${esc(d.hr)} hrs alone · ref: ${esc(d.rf)}</p></div><label><input type="checkbox" name="ok" style="width:auto"> I confirm these details are true</label>`,
    ];
  m.innerHTML = `<div class="mod" role="dialog" aria-modal="true" aria-label="Adoption application"><div class="stp">${STEPS.map((s, i) => `<span class="${i <= step ? "on" : ""}">${i + 1}. ${s}</span>`).join("")}</div><h3>Apply to adopt ${esc(p.n)}</h3><form data-form="wz">${f[step]}<p id="werr" style="color:var(--er);min-height:1.2em"></p><div class="wb"><button type="button" class="btn no" data-act="${step ? "wback" : "wclose"}">${step ? "Back" : "Cancel"}</button><button class="btn">${step === 3 ? "Submit application" : "Next"}</button></div></form></div>`;
}
H.wz = (data) => {
  const w = S.w,
    e = $("#werr");
  if (!w) return;
  Object.assign(w.d, data);
  const er = (t) => {
    e.textContent = t;
  };
  if (w.step === 0 && !/^\d{10}$/.test(data.ph)) return er("Enter a 10 digit phone number.");
  if (w.step === 0 && !/^[A-Za-z .'-]{2,40}$/.test(data.ct))
    return er("City should use letters only.");
  if (w.step === 2 && !/^[A-Za-z .'-]{2,30}$/.test(data.rf)) return er("Enter a reference name.");
  if (w.step === 3) {
    if (!data.ok) return er("Please confirm the details.");
    const p = P.find((x) => x.id === w.id),
      s = (match(S.pref).find((m) => m.p.id === w.id) || { s: 60 }).s;
    A.push({ id: A.length + 1, pet: w.id, who: S.user.name, st: "Submitted", s, stage: 0, d: w.d });
    lg("Submitted application for " + p.n);
    nt("staff", "New application for " + p.n + " from " + S.user.name);
    S.w = null;
    wz();
    msg("Application sent for " + p.n + ".");
    S.view = "apps";
    return render();
  }
  w.step++;
  wz();
};

/* tracker on applications page */
const a0 = V.apps;
V.apps = () => {
  const st = can("admin", "staff", "vet"),
    l = st ? A : A.filter((a) => a.who === S.user.name);
  return (
    a0() +
    `<h3 style="margin-top:1.4rem">Application tracker</h3>` +
    (l
      .map((a) => {
        const p = P.find((x) => x.id === a.pet),
          sg = a.st === "Approved" ? 4 : a.stage || 0,
          bad = a.st === "Rejected";
        return `<div class="card"><div class="row"><b>${esc(p.n)}${st ? " · " + esc(a.who) : ""}</b><span class="chip ${bad ? "bad" : a.st === "Approved" ? "ok" : ""}">${bad ? "Declined" : a.st}</span></div><ol class="tl">${TS.map((s, i) => `<li class="${bad ? "" : i < sg ? "dn" : i === sg ? "cu" : ""}">${s}</li>`).join("")}</ol>${a.d ? `<p class="mut">${esc(a.d.ct)} · ${esc(a.d.ht)} · ${esc(a.d.pp)} prior pets · ${esc(a.d.hr)} hrs alone${st ? " · " + esc(a.d.ph) : ""}</p>` : ""}${st && a.st === "Submitted" && sg < 3 ? `<button class="btn sm alt" data-act="adv" data-id="${a.id}">Advance to ${TS[sg + 1]}</button>` : ""}</div>`;
      })
      .join("") || '<p class="mut">No applications yet.</p>')
  );
};

/* dashboard analytics */
const d0 = V.dash;
V.dash = () => {
  const mo = [...Array(6)].map((_, i) =>
      new Date(Date.now() - (5 - i) * 2.6e9).toLocaleString("en", { month: "short" }),
    ),
    ad = [9, 12, 8, 15, 14, 11];
  ad[5] += P.filter((p) => p.st === "Adopted").length;
  const L = live(),
    dg = L.filter((p) => p.sp === "Dog").length,
    tot = A.length || 1,
    fn = [
      ["Submitted", A.length],
      ["Under review", A.filter((a) => (a.stage || 0) >= 1 || a.st === "Approved").length],
      ["Home check", A.filter((a) => (a.stage || 0) >= 2 || a.st === "Approved").length],
      ["Meet and greet", A.filter((a) => (a.stage || 0) >= 3 || a.st === "Approved").length],
      ["Approved", A.filter((a) => a.st === "Approved").length],
    ],
    c = caps();
  return (
    d0() +
    `<div class="sg"><div class="card"><h3>Adoptions per month</h3>${bars(ad, mo)}</div><div class="card"><h3>Species in care</h3>${rows(SPECIES.map((x) => [x + "s", L.filter((p) => p.sp === x).length]), Math.max(1, ...SPECIES.map((x) => L.filter((p) => p.sp === x).length)))}</div>
<div class="card"><h3>Adoption funnel</h3>${rows(fn, tot)}</div><div class="card"><h3>Average days waiting</h3>${rows(
      SPECIES.map((x) => [x + "s", Math.round(avg(x))]),
      Math.max(1, ...SPECIES.map((x) => avg(x))),
    )}</div>
<div class="card"><h3>Capacity forecast</h3>${c
      .filter((x) => x.pc >= 70)
      .sort((a, b) => b.pc - a.pc)
      .slice(0, 12)
      .map((x) => {
        const o = c.find((y) => y.h !== x.h && y.sp === x.sp);
        return `<div class="row"><span>${esc(SH[x.h])}, ${x.sp}s</span><span class="chip ${x.k}">${x.m - x.c > 0 ? "Full in about " + Math.round((x.m - x.c) / 0.35) + " days" : "Full now"}</span></div>${x.pc >= 90 && o && o.pc < 70 ? `<p class="mut">Suggestion: transfer one ${x.sp.toLowerCase()} to ${esc(SH[o.h])}.</p>` : ""}`;
      })
      .join("")}</div>
<div class="card"><h3>Long-stay actions</h3>${
      L.filter(long)
        .map(
          (p) =>
            `<p><b>${esc(p.n)}</b> <span class="mut">${p.days} days, predicted ${pred(p)} more</span><br><button class="btn sm alt" data-act="feat" data-id="${p.id}">${S.feat.includes(p.id) ? "Unfeature" : "Feature on home page"}</button><button class="btn sm alt" data-act="disc" data-id="${p.id}">${S.disc.includes(p.id) ? "Remove discount" : "Reduce fee 20%"}</button></p>`,
        )
        .join("") || '<p class="mut">No long-stay animals.</p>'
    }</div></div>`
  );
};

/* visits and activity log */
V.visits = () => {
  const st = can("admin", "staff", "vet"),
    l = st ? VIS : VIS.filter((v) => v.who === S.user.name),
    o = P.filter((p) => p.st === "Available" && rd(p) === "Ready");
  return `<h2>Meet and greet visits</h2>${st ? "" : `<form class="card fg" data-form="visit"><label>Animal<select name="pet">${o.map((p) => `<option value="${p.id}">${esc(p.n)} (${esc(SH[p.sh])})</option>`).join("")}</select></label><label>Date<input type="date" name="date" min="${dt(1)}" max="${dt(30)}" value="${dt(1)}" required></label><label>Time${sel("slot", SLOTS)}</label><button class="btn">Book visit</button></form>`}<div class="card tw"><table><tr><th>Animal</th><th>Shelter</th>${st ? "<th>Visitor</th>" : ""}<th>Date</th><th>Time</th><th></th></tr>${
    l
      .map((v) => {
        const p = P.find((x) => x.id === v.pet);
        return `<tr><td>${esc(p.n)}</td><td>${esc(SH[p.sh])}</td>${st ? `<td>${esc(v.who)}</td>` : ""}<td>${v.date}</td><td>${v.slot}</td><td><button class="btn sm no" data-act="vcx" data-id="${v.id}">Cancel</button></td></tr>`;
      })
      .join("") || '<tr><td colspan="6" class="mut">No visits booked.</td></tr>'
  }</table></div>`;
};
H.visit = (d) => {
  if (!can("adopter")) return;
  const pet = +d.pet,
    p = P.find((x) => x.id === pet);
  if (!p || p.st !== "Available") return;
  if (!/^\d{4}-\d\d-\d\d$/.test(d.date) || d.date < dt(1) || d.date > dt(30))
    return msg("Pick a date within the next 30 days.");
  if (!SLOTS.includes(d.slot)) return;
  if (VIS.some((v) => v.pet === pet && v.date === d.date && v.slot === d.slot))
    return msg("That slot is taken. Pick another time.");
  VIS.push({ id: ++vid, pet, who: S.user.name, date: d.date, slot: d.slot });
  lg("Booked visit with " + p.n + " on " + d.date + " " + d.slot);
  nt("staff", S.user.name + " booked a visit with " + p.n + " on " + d.date);
  nt(S.user.name, "Visit confirmed: " + p.n + ", " + d.date + " at " + d.slot);
  msg("Visit booked.");
  render();
};
V.log = () =>
  `<h2>Activity log</h2><div class="card tw"><table><tr><th>When</th><th>Who</th><th>Action</th></tr>${
    LOG.slice(0, 60)
      .map((x) => `<tr><td>${x.t}</td><td>${esc(x.w)}</td><td>${esc(x.a)}</td></tr>`)
      .join("") || '<tr><td colspan="3" class="mut">No activity yet.</td></tr>'
  }</table></div>`;
H.stray = (d, f) => {
  const l = String(d.l || "")
    .trim()
    .slice(0, 80);
  if (l.length < 3) return msg("Please add a location.");
  lg("Stray report: " + l + (d.x ? " (" + String(d.x).slice(0, 120) + ")" : ""), "Public");
  nt("staff", "Stray report at " + l);
  msg("Report sent. Our rescue team will respond shortly.");
  f.reset();
};
const hp = H.pet;
H.pet = (d, f) => {
  const n = P.length;
  hp(d, f);
  if (P.length > n) {
    lg("Added animal " + P[P.length - 1].n);
    nt("staff", "New animal added: " + P[P.length - 1].n);
  }
};
lg("Demo data loaded", "System");
nt("Aarav", "Welcome to Pawnest! Update your match profile for better suggestions.");

/* events */
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("[data-act=apply]");
    if (!b) return;
    e.stopImmediatePropagation();
    if (!can("adopter")) return;
    const id = +b.dataset.id,
      p = P.find((x) => x.id === id);
    if (!p || p.st !== "Available" || rd(p) !== "Ready") return;
    if (A.some((x) => x.pet === id && x.who === S.user.name && x.st === "Submitted"))
      return msg("You already applied for " + p.n + ".");
    S.w = { id, step: 0, d: {} };
    wz();
  },
  true,
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const a = b.dataset.act,
    id = +b.dataset.id,
    st = can("admin", "staff", "vet"),
    ap = A.find((x) => x.id === id),
    p = P.find((x) => x.id === id);
  if (a === "signin") {
    S.login = 1;
    S.reg = 0;
    render();
  } else if (a === "home") {
    S.login = 0;
    S.reg = 0;
    render();
  } else if (a === "theme") {
    S.dark = !S.dark;
    document.documentElement.dataset.theme = S.dark ? "dark" : "light";
  } else if (a === "bell") {
    S.bell = !S.bell;
    render();
  } else if (a === "don") {
    S.don += +b.dataset.v;
    $("#dbar").style.width = Math.min(S.don / 500, 100) + "%";
    $("#dtxt").textContent = "₹" + S.don.toLocaleString("en-IN") + " raised of ₹50,000 goal";
    msg("Thank you for your kindness!");
    lg("Demo donation of ₹" + b.dataset.v, "Public");
  } else if (a === "det" && S.user && p) open(id);
  else if (a === "cmp" && p) {
    const i = S.cmp.indexOf(id);
    if (i >= 0) S.cmp.splice(i, 1);
    else if (S.cmp.length >= 3) return msg("Compare up to 3 animals.");
    else S.cmp.push(id);
    render();
  } else if (a === "cx") {
    S.cmp = [];
    render();
  } else if (a === "wback" && S.w) {
    S.w.step--;
    wz();
  } else if (a === "wclose") {
    S.w = null;
    wz();
  } else if (a === "adv" && st && ap && ap.st === "Submitted" && (ap.stage || 0) < 3) {
    ap.stage = (ap.stage || 0) + 1;
    const n = P.find((x) => x.id === ap.pet).n;
    lg("Moved " + ap.who + "'s application for " + n + " to " + TS[ap.stage]);
    nt(ap.who, "Your application for " + n + " is now: " + TS[ap.stage]);
    render();
  } else if ((a === "feat" || a === "disc") && st && p) {
    const k = a === "feat" ? S.feat : S.disc,
      i = k.indexOf(id);
    i < 0 ? k.push(id) : k.splice(i, 1);
    lg(
      (i < 0 ? "Applied " : "Removed ") +
        (a === "feat" ? "featured status for " : "fee reduction for ") +
        p.n,
    );
    msg("Updated " + p.n + ".");
    render();
  } else if (a === "vcx") {
    const i = VIS.findIndex((v) => v.id === id);
    if (i >= 0 && (st || VIS[i].who === S.user.name)) {
      lg("Cancelled visit #" + id);
      VIS.splice(i, 1);
      render();
    }
  } else if ((a === "ok" || a === "no") && st && ap && ap.st !== "Submitted" && !ap.lg) {
    ap.lg = 1;
    if (a === "ok") ap.stage = 4;
    const n = P.find((x) => x.id === ap.pet).n;
    lg((a === "ok" ? "Approved" : "Declined") + " application for " + n + " by " + ap.who);
    nt(
      ap.who,
      a === "ok"
        ? "Congratulations! Your application for " + n + " was approved."
        : "Your application for " + n + " was declined.",
    );
  } else if (a === "fix" && st && p)
    lg("Updated health record for " + p.n + " (" + b.dataset.f + ")");
});
new MutationObserver(() =>
  document.querySelectorAll(".card.pet").forEach((c) => {
    if (c.querySelector(".dtb") || !S.user) return;
    const h = c.querySelector("h3"),
      p = h && P.find((x) => x.n === h.firstChild.textContent.trim());
    if (p)
      c.insertAdjacentHTML(
        "beforeend",
        `<div><button class="btn sm alt dtb" data-act="det" data-id="${p.id}">Details</button></div>`,
      );
  }),
).observe(document.body, { childList: true, subtree: true });
/* accounts via the Flask API (passwords are hashed and the admin code is checked on the server) */
Object.assign(S, { reg: 0, rr: "adopter", codeOk: 0, acode: "" });
const api = (u, m, b) =>
    fetch(u, {
      method: m || "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: b ? JSON.stringify(b) : undefined,
    })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .catch(() => ({ ok: false, d: { error: "Cannot reach the server. Is Flask running?" } })),
  setErr = (t) => {
    const e = $("#err");
    if (e) e.textContent = t;
  };
H.login = async (d) => {
  const r = await api("/api/login", "POST", { username: d.u, password: d.p, role: S.role });
  if (!r.ok) return setErr(r.d.error || "Login failed.");
  S.user = { name: r.d.user.name, role: r.d.user.role };
  go(NAV[r.d.user.role][0]);
  bump();
};
H.regcode = async (d) => {
  const r = await api("/api/admin-code", "POST", { code: String(d.c), role: S.rr });
  if (!r.ok) return setErr(r.d.error || "That code is not valid.");
  S.codeOk = 1;
  S.acode = String(d.c);
  render();
};
H.register = async (d) => {
  if (S.rr !== "adopter" && !S.codeOk) return;
  const n = String(d.n || "").trim(),
    u = String(d.u || "")
      .trim()
      .toLowerCase(),
    p = String(d.p || "");
  if (!/^[A-Za-z][A-Za-z .'-]{1,29}$/.test(n)) return setErr("Name should use letters only.");
  if (!/^[a-z0-9_]{3,20}$/.test(u))
    return setErr("Username: 3 to 20 letters, numbers or underscores.");
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p))
    return setErr("Password needs 8+ characters with a letter and a number.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.e || "").trim())) return setErr("Enter a valid email address.");
  if (d.ph && !/^\d{10}$/.test(d.ph)) return setErr("Phone should be 10 digits.");
  if (p !== d.p2) return setErr("Passwords do not match.");
  const r = await api("/api/register", "POST", {
    name: n,
    username: u,
    password: p,
    role: S.rr,
    admin_code: S.acode,
    email: String(d.e || "").trim(),
    phone: String(d.ph || "").trim(),
  });
  if (!r.ok) return setErr(r.d.error || "Could not register.");
  S.reg = 0;
  S.login = 1;
  S.role = S.rr;
  S.codeOk = 0;
  S.acode = "";
  render();
  msg("Account created. Sign in with your new details.");
};
function regPage() {
  const r = S.rr || "adopter",
    gate = r !== "adopter" && !S.codeOk;
  $("#app").innerHTML =
    `<main class="login"><button class="btn sm no" data-act="home" style="justify-self:start">← Back to home</button><section class="card"><h2>Create your account</h2><div class="tabs">${["adopter", "vet", "admin"].map((x) => `<button type="button" class="nb${r === x ? " on" : ""}" data-act="rrole" data-v="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div>` +
    (gate
      ? `<form data-form="regcode"><p class="mut">${r === "vet" ? "Vet" : "Admin"} accounts need the shelter's special code first.</p><label>Access code<input name="c" type="password" inputmode="numeric" maxlength="12" autocomplete="off" required></label><p id="err" role="alert"></p><button class="btn" style="width:100%">Verify code</button></form>`
      : `<form data-form="register">${r !== "adopter" ? `<p class="mut">Code verified. Now create your ${r} account.</p>` : ""}<label>Full name<input name="n" maxlength="30" required></label><label>Username<input name="u" maxlength="20" autocomplete="username" required></label><label>Email<input name="e" type="email" maxlength="80" autocomplete="email" required></label><label>Phone for WhatsApp alerts (optional)<input name="ph" inputmode="numeric" maxlength="10"></label><label>Password<input name="p" type="password" maxlength="64" autocomplete="new-password" required></label><label>Confirm password<input name="p2" type="password" maxlength="64" autocomplete="new-password" required></label><p id="err" role="alert"></p><button class="btn" style="width:100%">Register as ${r}</button></form>`) +
    `<p class="mut" style="text-align:center">Already registered? <button class="btn sm alt" data-act="tologin">Sign in</button></p></section></main>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || S.user) return;
  const a = b.dataset.act;
  if (a === "reg") {
    S.reg = 1;
    S.rr = "adopter";
    S.codeOk = 0;
    render();
  } else if (a === "rrole" && ["adopter", "vet", "admin"].includes(b.dataset.v)) {
    S.rr = b.dataset.v;
    S.codeOk = 0;
    render();
  } else if (a === "tologin") {
    S.reg = 0;
    S.login = 1;
    render();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-act=out]")) api("/api/logout", "POST");
});
api("/api/me").then((r) => {
  if (r.ok && r.d.user && !S.user) {
    S.user = r.d.user;
    go(NAV[S.user.role][0]);
    bump();
  }
});
/* part 2: pets, applications, visits, notifications and the activity log now come from MySQL */
[P, A, VIS, LOG, NT].forEach((a) => (a.length = 0));
const SL = (a, b) => {
    a.length = 0;
    a.push(...b);
  },
  mapP = (r) => ({
    id: r.id,
    n: r.name,
    sp: r.species,
    br: r.breed,
    sz: r.size,
    en: r.energy,
    kids: +r.good_with_kids,
    pets: +r.good_with_pets,
    days: r.days,
    st: r.status,
    sh: r.shelter_id,
    vac: +r.vaccinated,
    beh: +r.behavior_checked,
    tr: +r.under_treatment,
    img: r.photo_url || "",
    ft: +r.featured,
    dc: +r.fee_discount,
  });
async function sync() {
  const g = (u) => api(u).then((r) => (r.ok ? r.d : null)),
    pr = await g("/api/pets");
  if (pr) {
    SL(P, pr.pets.map(mapP));
    S.feat = P.filter((p) => p.ft).map((p) => p.id);
    S.disc = P.filter((p) => p.dc).map((p) => p.id);
  }
  if (S.user) {
    const [a, v, n] = await Promise.all([
      g("/api/applications"),
      g("/api/visits"),
      g("/api/notifications"),
    ]);
    a &&
      SL(
        A,
        a.applications.map((x) => ({
          id: x.id,
          pet: x.pet_id,
          who: x.who,
          st: x.status,
          s: x.match_score,
          stage: x.stage,
          d: x.details,
        })),
      );
    v &&
      SL(
        VIS,
        v.visits.map((x) => ({ id: x.id, pet: x.pet_id, who: x.who, date: x.date, slot: x.slot })),
      );
    n &&
      SL(
        NT,
        n.notes.map((x) => ({ id: x.id, to: S.user.name, t: x.message, r: x.is_read })),
      );
    if (S.user.role === "admin") {
      const l = await g("/api/log");
      l && SL(LOG, l.log);
    }
  }
  render();
}
const act = async (u, m) => {
  const r = await api(u, m || "POST", {});
  if (!r.ok) msg(r.d.error || "Something went wrong.");
  await sync();
  return r;
};
const l0 = H.login;
H.login = async (d) => {
  await l0(d);
  if (S.user) await sync();
};
H.pet = async (d) => {
  const r = await api("/api/pets", "POST", {
    name: d.n,
    breed: d.br,
    species: d.sp,
    size: d.sz,
    energy: d.en,
    shelter_id: +d.sh || 1,
  });
  if (!r.ok) return msg(r.d.error || "Could not add the animal.");
  msg(d.n + " added.");
  await sync();
};
H.visit = async (d) => {
  const r = await api("/api/visits", "POST", { pet_id: +d.pet, date: d.date, slot: d.slot });
  if (!r.ok) return msg(r.d.error || "Could not book.");
  msg("Visit booked.");
  await sync();
};
H.stray = async (d, f) => {
  const r = await api("/api/stray", "POST", { location: d.l, note: d.x || "" });
  if (!r.ok) return msg(r.d.error || "Please add a location.");
  msg("Report sent. Our rescue team will respond shortly.");
  f.reset();
};
const wz0 = H.wz;
H.wz = async (d) => {
  const w = S.w;
  if (!w || w.step !== 3) return wz0(d);
  const e = $("#werr");
  if (!d.ok) {
    e.textContent = "Please confirm the details.";
    return;
  }
  Object.assign(w.d, d);
  const sc = (match(S.pref).find((m) => m.p.id === w.id) || { s: 60 }).s,
    r = await api("/api/applications", "POST", { pet_id: w.id, score: sc, details: w.d });
  if (!r.ok) {
    e.textContent = r.d.error || "Could not submit.";
    return;
  }
  S.w = null;
  wz();
  S.view = "apps";
  msg("Application sent.");
  await sync();
};
async function upload(id) {
  const f = $("#pf");
  if (!f || !f.files[0]) return msg("Choose a photo first.");
  const fd = new FormData();
  fd.append("photo", f.files[0]);
  let r;
  try {
    r = await fetch("/api/pets/" + id + "/photo", {
      method: "POST",
      body: fd,
      headers: { "X-Requested-With": "pawnest" },
      credentials: "same-origin",
    });
  } catch (e) {
    return msg("Cannot reach the server.");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return msg(d.error || "Upload failed.");
  msg("Photo uploaded.");
  await sync();
}
const dv = V.detail;
V.detail = () => {
  const h = dv(),
    p = P.find((x) => x.id === S.pd);
  return p && can("admin")
    ? h.replace(
        '<div class="sg">',
        `<div class="card"><h3>Photo</h3><input type="file" id="pf" accept="image/png,image/jpeg,image/webp"> <button class="btn sm" data-act="up" data-id="${p.id}">Upload photo</button><p class="mut">JPG, PNG or WebP, up to 5 MB.</p></div><div class="sg">`,
      )
    : h;
};
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !S.user) return;
    const a = b.dataset.act,
      id = +b.dataset.id,
      K = () => e.stopImmediatePropagation();
    if (a === "ok" || a === "no" || a === "adv") {
      K();
      act(
        "/api/applications/" + id + "/" + { ok: "approve", no: "decline", adv: "advance" }[a],
      ).then((r) => {
        if (r.ok && a === "ok") {
          msg("Adoption approved.");
          party();
        } else if (r.ok && a === "no") msg("Application declined.");
      });
    } else if (a === "fix") {
      K();
      api("/api/pets/" + id + "/health", "POST", { field: b.dataset.f }).then(sync);
    } else if (a === "feat" || a === "disc") {
      K();
      act("/api/pets/" + id + "/" + (a === "feat" ? "feature" : "discount"));
    } else if (a === "vcx") {
      K();
      act("/api/visits/" + id, "DELETE");
    } else if (a === "up") {
      K();
      upload(id);
    }
  },
  true,
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "bell" && S.bell) api("/api/notifications/read", "POST", {});
  if (b.dataset.act === "out") {
    [A, VIS, LOG, NT].forEach((a) => (a.length = 0));
    setTimeout(sync, 300);
  }
});
(async () => {
  const r = await api("/api/me");
  if (r.ok && r.d.user && !S.user) {
    S.user = r.d.user;
    go(NAV[S.user.role][0]);
  }
  await sync();
})();
/* part 3: preferences, saved animals and donations are stored in MySQL */
const PREF0 = {
    sp: "Dog",
    sz: "Large",
    en: "High",
    home: "House",
    exp: "Experienced",
    yard: 1,
    kids: 1,
    op: 0,
  },
  sync0 = sync;
sync = async () => {
  const g = (u) => api(u).then((r) => (r.ok ? r.d : null)),
    dn = await g("/api/donations");
  if (dn) S.don = dn.total;
  if (S.user && S.user.role === "adopter") {
    const [pf, fv] = await Promise.all([g("/api/preferences"), g("/api/favorites")]);
    S.pref = (pf && pf.pref) || { ...PREF0 };
    S.fav = fv ? fv.ids : [];
  }
  await sync0();
};
H.pref = async (d, f) => {
  if (!can("adopter")) return;
  const g = (k) => (f.elements[k].checked ? 1 : 0),
    r = await api("/api/preferences", "POST", {
      sp: d.sp,
      sz: d.sz,
      en: d.en,
      home: d.home,
      exp: d.exp,
      yard: g("yard"),
      kids: g("kids"),
      op: g("op"),
    });
  if (!r.ok) return msg(r.d.error || "Could not save your preferences.");
  S.pref = r.d.pref;
  msg("Preferences saved.");
  render();
};
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("[data-act=don]");
    if (!b) return;
    e.stopImmediatePropagation();
    api("/api/donations", "POST", { amount: +b.dataset.v }).then((r) => {
      if (!r.ok) return msg(r.d.error || "Could not record the donation.");
      S.don = r.d.total;
      const bar = $("#dbar"),
        t = $("#dtxt");
      bar && (bar.style.width = Math.min(S.don / 500, 100) + "%");
      t && (t.textContent = "₹" + S.don.toLocaleString("en-IN") + " raised of ₹50,000 goal");
      msg("Thank you for your kindness!");
    });
  },
  true,
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const a = b.dataset.act;
  if (a === "fav" && can("adopter")) {
    const id = +b.dataset.id;
    api("/api/favorites/" + id, "PUT", { saved: S.fav.includes(id) });
  } else if (a === "out") {
    S.pref = { ...PREF0 };
    S.fav = [];
  }
});
/* Part 4: more breed portraits, shelters loaded from MySQL, and Dogs / Cats category tabs */
Object.assign(BRD, {
  "Siberian Husky": { c: "#e6e8ea", e: "#5b5f66", m: "#ffffff", t: "prick", cap: "#6d7279" },
  Pomeranian: { c: "#e8a55b", e: "#d98f3e", m: "#f5d09b", t: "prick", ruff: 1 },
  Dachshund: { c: "#7a4a2a", e: "#5a3219", m: "#a3744d", t: "drop" },
});
Object.assign(BCT, {
  "Maine Coon": { c: "#a98462", e: "#8a6a4d", eye: "#c9a227", str: 1 },
  "British Shorthair": { c: "#a3a8b0", e: "#8f949c", eye: "#e0892b", flat: 1 },
  Bengal: { c: "#d6a15c", e: "#b9803a", eye: "#6fa84a", str: 1 },
});

// Shelter names and capacities now come from the shelters table
const sync2 = sync;
sync = async () => {
  const r = await api("/api/shelters");
  if (r.ok) {
    Object.keys(SH).forEach((k) => delete SH[k]);
    Object.keys(CAP).forEach((k) => delete CAP[k]);
    S.shl = r.d.shelters;
    r.d.shelters.forEach((s) => {
      SH[s.id] = s.name;
      CAP[s.id] = s.caps || {};
    });
  }
  await sync2();
};

// Dogs / Cats tabs above the animal list (they drive the same filter as the Show box)
const pv = V.pets;
V.pets = () => {
  let h = pv();
  if (!can("admin")) h = h.replace(/<details class="card"><summary>Add a new animal[\s\S]*?<\/details>/, "");
  const n = (sp) => live().filter((p) => sp === "All" || p.sp === sp).length,
    tabs = `<div class="tabs" style="margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:.3rem;border-radius:18px">${[["All", "All animals"], ...SPECIES.map((x) => [x, x + "s"])]
      .map(([v, l]) => `<button type="button" class="nb${S.f === v ? " on" : ""}" data-act="cat" data-v="${v}">${l} (${n(v)})</button>`)
      .join("")}</div>`;
  h = h.replace('<div class="tools">', tabs + '<div class="tools">');
  // the add-animal form lists every shelter from the database
  return h.replace(/<select name="sh">[\s\S]*?<\/select>/, `<select name="sh">${Object.entries(SH).map(([id, nm]) => `<option value="${id}">${esc(nm)}</option>`).join("")}</select>`);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act=cat]");
  if (b && ["All", ...SPECIES].includes(b.dataset.v)) {
    S.f = b.dataset.v;
    render();
  }
});

/* Part 5: reports, shelter locator, waitlist, medical history, follow-ups, certificates */
Object.assign(S, { wl: {}, fu: [], sm: [], rep: null, shl: [], area: "", me: null, rec: null });
NAV.admin.push("reports", "follow", "shelters");
NAV.adopter.push("follow", "shelters");
Object.assign(LBL, { reports: "Reports", follow: "Follow-ups", shelters: "Shelters" });

const sync5 = sync;
sync = async () => {
  const g = (u) => api(u).then((r) => (r.ok ? r.d : null));
  if (S.user && S.user.role === "adopter") {
    const [w, f, m] = await Promise.all([g("/api/waitlist"), g("/api/followups"), g("/api/matches")]);
    S.wl = {};
    ((w && w.waitlist) || []).forEach((x) => (S.wl[x.pet_id] = x.pos));
    S.fu = f ? f.followups : [];
    S.sm = m ? m.matches : [];
  } else if (S.user && S.user.role === "vet") {
    S.vq = await g("/api/vet/queue");
  } else if (S.user) {
    const [f, r] = await Promise.all([g("/api/followups"), g("/api/reports")]);
    S.fu = f ? f.followups : [];
    S.rep = r;
  }
  await sync5();
};

// Reports (admin): every block is the result of one SQL query
V.reports = () => {
  const r = S.rep;
  if (!r) return '<p class="mut">Loading reports...</p>';
  const bar = (v, m) => `<div class="bar"><i style="width:${Math.min((v / (m || 1)) * 100, 100)}%"></i></div>`,
    maxApps = Math.max(1, ...r.breeds.map((b) => b.apps));
  return `<h2>Reports</h2><p class="mut">Each card is one SQL query: GROUP BY, HAVING and a RANK window function.</p><div class="sg">
  <div class="card"><h3>Adoption rate by shelter</h3>${r.shelters.map((x) => `<div class="row"><span>${esc(x.name)}</span><b>${x.adopted} of ${x.total} (${x.rate}%)</b></div>${bar(x.rate, 100)}`).join("")}</div>
  <div class="card"><h3>Most requested breeds</h3>${r.breeds.map((x) => `<div class="row"><span>${esc(x.breed)}</span><b>${x.apps}</b></div>${bar(x.apps, maxApps)}`).join("") || '<p class="mut">No applications yet.</p>'}</div>
  <div class="card"><h3>Longest waiting, top 3 per species</h3>${r.longest.map((x) => `<div class="row"><span>${x.species}: ${esc(x.name)}</span><b>${x.days} days</b></div>`).join("")}</div>
  <div class="card"><h3>Application funnel</h3>${r.funnel.map((x) => `<div class="row"><span>${x.status}</span><b>${x.n}</b></div>`).join("") || '<p class="mut">No applications yet.</p>'}</div>
  <div class="card"><h3>Follow-up satisfaction</h3><p>${r.rating.avg_rating ? `Average rating <b>${r.rating.avg_rating} / 5</b> from ${r.rating.answered} check-ins.` : "No check-ins answered yet."}</p></div></div>`;
};

// Shelter locator: a simple coordinate map (no map tiles), distance sorting and live capacity
const AREAS = { Baner: [18.559, 73.7868], Kothrud: [18.5074, 73.8077], Hadapsar: [18.5089, 73.926], Wakad: [18.5975, 73.7898], Shivajinagar: [18.5308, 73.8475], "Viman Nagar": [18.5679, 73.9143] },
  km = (a, b) => {
    const r = (x) => (x * Math.PI) / 180,
      h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
V.shelters = () => {
  const L = (S.shl || []).filter((s) => s.lat != null);
  if (!L.length) return '<p class="mut">Loading shelters...</p>';
  const me = S.me || AREAS[S.area] || null,
    pts = L.map((s) => [s.lat, s.lng]).concat(me ? [me] : []),
    la = pts.map((p) => p[0]), ln = pts.map((p) => p[1]),
    [y0, y1, x0, x1] = [Math.min(...la), Math.max(...la), Math.min(...ln), Math.max(...ln)],
    X = (v) => 40 + ((v - x0) / (x1 - x0 || 1)) * 320, Y = (v) => 190 - ((v - y0) / (y1 - y0 || 1)) * 160,
    rows = L.map((s) => ({ ...s, d: me ? km(me, [s.lat, s.lng]) : null })).sort((a, b) => (me ? a.d - b.d : a.id - b.id)),
    cap = (id) => caps().filter((x) => x.h == id).map((x) => `${x.sp}s ${x.c}/${x.m}`).join(", ");
  return `<h2>Our shelters</h2><div class="card"><label>Find the nearest one
    <select data-act="area"><option value="">Pick your area</option>${Object.keys(AREAS).map((a) => `<option${a === S.area ? " selected" : ""}>${a}</option>`).join("")}</select></label>
    <button class="btn sm alt" data-act="geo">Use my location</button>
    <svg viewBox="0 0 400 220" role="img" aria-label="Shelter map" style="width:100%;max-width:520px;background:var(--br2);border-radius:16px;margin-top:.6rem">
    ${rows.map((s, i) => `<circle cx="${X(s.lng)}" cy="${Y(s.lat)}" r="11" style="fill:var(--br)"/><text x="${X(s.lng)}" y="${Y(s.lat) + 4}" text-anchor="middle" font-size="11" fill="#fff">${s.id}</text><text x="${X(s.lng)}" y="${Y(s.lat) - 16}" text-anchor="middle" font-size="10" style="fill:var(--ink)">${esc(s.name)}</text>`).join("")}
    ${me ? `<circle cx="${X(me[1])}" cy="${Y(me[0])}" r="7" style="fill:var(--df)"/><text x="${X(me[1])}" y="${Y(me[0]) + 20}" text-anchor="middle" font-size="10" style="fill:var(--df)">You</text>` : ""}</svg></div>
    ${rows.map((s) => `<div class="card"><div class="row"><b>${s.id}. ${esc(s.name)}</b>${s.d != null ? `<span class="chip ok">${s.d.toFixed(1)} km away</span>` : ""}</div><p class="mut">${esc(s.address || "")}</p><p class="mut">${cap(s.id)}</p></div>`).join("")}`;
};

// Waitlist, quarantine release and medical history on the animal detail page
const recCard = (p) => {
  if (!S.rec || S.rec.pid !== p.id) {
    if (!S.recL) {
      S.recL = 1;
      api("/api/pets/" + p.id + "/records").then((r) => {
        S.recL = 0;
        S.rec = { pid: p.id, rows: r.ok ? r.d.records : [] };
        render();
      });
    }
    return '<div class="card"><h3>Medical history</h3><p class="mut">Loading...</p></div>';
  }
  return `<div class="card tw"><h3>Medical history</h3><table><tr><th>Date</th><th>Type</th><th>Notes</th><th>Next due</th></tr>${S.rec.rows.map((x) => `<tr><td>${x.date}</td><td>${x.type}</td><td>${esc(x.notes)}</td><td>${x.next_due || ""}</td></tr>`).join("") || '<tr><td colspan="4" class="mut">No records yet.</td></tr>'}</table>
  ${can("admin", "vet") ? `<form class="fg" data-form="rec"><label>Type${sel("type", ["Vaccination", "Checkup", "Treatment", "Surgery"])}</label><label>Notes<input name="notes" maxlength="200" required></label><label>Next due (optional)<input type="date" name="next_due"></label><button class="btn sm">Add record</button></form>` : ""}</div>`;
};
const dv5 = V.detail;
V.detail = () => {
  const h = dv5(), p = P.find((x) => x.id === S.pd);
  if (!p) return h;
  let x = "";
  if (can("adopter") && p.st === "Quarantine") {
    const pos = S.wl[p.id];
    x += `<div class="card"><h3>Not available yet</h3><p class="mut">${pos ? `You are number ${pos} on the waitlist. We will notify you when ${esc(p.n)} is available.` : `Join the waitlist and we will notify you when ${esc(p.n)} is available.`}</p><button class="btn sm" data-act="wl" data-id="${p.id}">${pos ? "Leave waitlist" : "Join waitlist"}</button></div>`;
  }
  if (can("admin") && p.st === "Quarantine")
    x += `<div class="card"><h3>In quarantine</h3><button class="btn sm" data-act="rel" data-id="${p.id}">Release to Available</button><p class="mut">A database trigger notifies the first person on the waitlist.</p></div>`;
  return h.replace('<div class="sg">', x + recCard(p) + '<div class="sg">');
};
H.rec = async (d) => {
  const r = await api("/api/pets/" + S.pd + "/records", "POST", { type: d.type, notes: d.notes, next_due: d.next_due || "" });
  if (!r.ok) return msg(r.d.error || "Could not add the record.");
  msg("Record added.");
  S.rec = null;
  await sync();
};

// Follow-ups and certificates
V.follow = () => {
  const adm = can("admin");
  return `<h2>Post-adoption follow-ups</h2><p class="mut">Check-ins are scheduled automatically 7, 30 and 90 days after an adoption is approved.</p>` +
    (S.fu.map((f) => `<div class="card"><div class="row"><b>${esc(f.pet)}${adm ? " · " + esc(f.who) : ""}</b><span class="chip ${f.status === "Done" ? "ok" : "warn"}">${f.days_after}-day check-in · ${f.status === "Done" ? "done" : "due " + f.due_date}</span></div>
    ${f.status === "Done" ? `<p class="mut">Rating ${f.rating}/5 ${esc(f.notes || "")}</p>` : adm ? "" : `<form class="fg" data-form="fu"><input type="hidden" name="id" value="${f.id}"><label>How is ${esc(f.pet)} settling in?${sel("rating", ["5", "4", "3", "2", "1"])}</label><label>Notes<input name="notes" maxlength="150"></label><button class="btn sm">Submit check-in</button></form>`}</div>`).join("") ||
      '<p class="mut">No follow-ups yet. They appear after an adoption is approved.</p>');
};
H.fu = async (d) => {
  const r = await api("/api/followups/" + d.id, "POST", { rating: +d.rating, notes: d.notes || "" });
  if (!r.ok) return msg(r.d.error || "Could not send the check-in.");
  msg("Thank you for the update!");
  await sync();
};
const ap5 = V.apps;
V.apps = () => {
  const l = A.filter((a) => a.st === "Approved" && (can("admin") || a.who === S.user.name));
  return ap5() + (l.length ? `<h3 style="margin-top:1.4rem">Adoption certificates</h3>` + l.map((a) => `<div class="card row"><span>${esc((P.find((p) => p.id === a.pet) || { n: "" }).n)}${can("admin") ? " · " + esc(a.who) : ""}</span><a class="btn sm" style="text-decoration:none" href="/api/applications/${a.id}/certificate" download>Download PDF</a></div>`).join("") : "");
};
const m5 = V.match;
V.match = () => m5() + (S.sm.length ? `<div class="card"><h3>Top picks from the database</h3><p class="mut">Ranked by the stored procedure <code>sp_match_pets</code> in MySQL.</p>${S.sm.slice(0, 5).map((x) => `<div class="row"><span>${esc(x.name)} (${esc(x.breed)})</span><b>${x.score}%</b></div>`).join("")}</div>` : "");

document.addEventListener("change", (e) => {
  if (e.target.dataset.act === "area") {
    S.area = e.target.value;
    S.me = null;
    render();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || !S.user) return;
  const a = b.dataset.act, id = +b.dataset.id;
  if (a === "wl") api("/api/waitlist/" + id, "POST", { on: !S.wl[id] }).then((r) => (r.ok ? sync() : msg(r.d.error)));
  else if (a === "rel") act("/api/pets/" + id + "/release");
  else if (a === "geo") navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => { S.me = [p.coords.latitude, p.coords.longitude]; S.area = ""; render(); }, () => msg("Location was not shared.")) : msg("Location is not available.");
  else if (a === "out") Object.assign(S, { wl: {}, fu: [], sm: [], rep: null, rec: null });
});

/* Part 7: vet role, Chart.js charts on the reports page, Hindi / Marathi language toggle */
NAV.vet = ["pets", "vet", "shelters"];
LBL.vet = "Medical queue";
V.vet = () => {
  const q = S.vq;
  if (!q) return '<p class="mut">Loading...</p>';
  return `<h2>Medical queue</h2><div class="sg"><div class="card"><h3>Animals needing attention</h3>${
    q.attention.map((x) => `<div class="row"><span>${esc(x.name)} <span class="mut">${esc(x.breed)}</span></span><span>${x.vac ? "" : '<span class="chip bad">Needs vaccination</span> '}${x.beh ? "" : '<span class="chip warn">Needs behavior check</span> '}${x.tr ? '<span class="chip warn">Under treatment</span> ' : ""}<button class="btn sm alt" data-act="det" data-id="${x.id}">Open record</button></span></div>`).join("") || '<p class="mut">Everyone is up to date.</p>'
  }</div><div class="card"><h3>Follow-up care due within 30 days</h3>${
    q.due.map((x) => `<div class="row"><span>${esc(x.pet)}: ${esc(x.type)}</span><b>${x.next_due}</b></div>`).join("") || '<p class="mut">Nothing due soon.</p>'
  }</div></div>`;
};

// Charts (Chart.js is loaded from /static/js/chart.umd.js)
function drawCharts() {
  if (typeof Chart === "undefined" || !S.rep || S.view !== "reports") return;
  const r = S.rep, cs = getComputedStyle(document.documentElement),
    c1 = cs.getPropertyValue("--br").trim() || "#1f7f86", c2 = cs.getPropertyValue("--a1").trim() || "#e0892b",
    mk = (id, cfg) => { const el = document.getElementById(id); if (el) try { new Chart(el, cfg); } catch (e) {} };
  mk("ch1", { type: "bar", data: { labels: r.shelters.map((x) => x.name), datasets: [{ label: "Adoption rate %", data: r.shelters.map((x) => x.rate), backgroundColor: c1 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
  mk("ch2", { type: "doughnut", data: { labels: r.species.map((x) => x.species + "s"), datasets: [{ data: r.species.map((x) => x.n), backgroundColor: [c1, c2, "#7fb04a", "#5aa8e0", "#b07fd0", "#e06f6f", "#c9a227"] }] } });
  mk("ch3", { type: "line", data: { labels: r.monthly.map((x) => x.mo + "/" + x.y), datasets: [{ label: "Applications", data: r.monthly.map((x) => x.n), borderColor: c1, tension: 0.3 }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
}
const rp0 = V.reports;
V.reports = () => {
  const h = rp0();
  if (!S.rep) return h;
  setTimeout(drawCharts, 0);
  return h.replace('<div class="sg">', '<div class="sg"><div class="card"><h3>Adoption rate by shelter</h3><canvas id="ch1" height="200"></canvas></div><div class="card"><h3>Animals in care</h3><canvas id="ch2" height="200"></canvas></div><div class="card"><h3>Applications per month</h3><canvas id="ch3" height="200"></canvas></div>');
};

// Language toggle: English, Hindi, Marathi (covers the main screens; anything missing stays in English)
const T = [
  ["Dashboard", "डैशबोर्ड", "डॅशबोर्ड"], ["Animals", "जानवर", "प्राणी"], ["Applications", "आवेदन", "अर्ज"], ["My matches", "मेरे मैच", "माझ्या जुळण्या"],
  ["Visits", "मुलाक़ातें", "भेटी"], ["Activity log", "गतिविधि लॉग", "हालचाल नोंद"], ["Reports", "रिपोर्ट", "अहवाल"], ["Follow-ups", "फ़ॉलो-अप", "पाठपुरावा"],
  ["Shelters", "आश्रय", "निवारे"], ["Medical queue", "चिकित्सा सूची", "वैद्यकीय यादी"], ["Log out", "लॉग आउट", "लॉग आउट"], ["Sign in", "साइन इन", "साइन इन"],
  ["Register", "रजिस्टर करें", "नोंदणी करा"], ["Welcome back", "वापसी पर स्वागत है", "पुन्हा स्वागत आहे"], ["Username", "उपयोगकर्ता नाम", "वापरकर्ता नाव"],
  ["Password", "पासवर्ड", "पासवर्ड"], ["Create your account", "अपना खाता बनाएं", "तुमचे खाते तयार करा"], ["Full name", "पूरा नाम", "पूर्ण नाव"],
  ["Confirm password", "पासवर्ड की पुष्टि करें", "पासवर्डची पुष्टी करा"], ["Email", "ईमेल", "ईमेल"], ["← Back to home", "← होम पर वापस", "← मुख्यपृष्ठावर परत"],
  ["Already registered?", "पहले से पंजीकृत?", "आधीच नोंदणी केली आहे?"], ["New here?", "नए हैं?", "नवीन आहात?"], ["Create an account", "खाता बनाएं", "खाते तयार करा"],
  ["Adopter", "गोद लेने वाला", "दत्तक घेणारा"], ["Admin", "एडमिन", "प्रशासक"], ["Vet", "पशु चिकित्सक", "पशुवैद्य"], ["Verify code", "कोड सत्यापित करें", "कोड तपासा"],
  ["How it works", "कैसे काम करता है", "हे कसे चालते"], ["Stories", "कहानियाँ", "कथा"], ["Help", "मदद", "मदत"], ["FAQ", "अक्सर पूछे जाने वाले प्रश्न", "वारंवार विचारले जाणारे प्रश्न"],
  ["Find the pet who fits your life", "अपनी ज़िंदगी में फिट बैठने वाला पालतू खोजें", "तुमच्या आयुष्याला साजेसा पाळीव प्राणी शोधा"], ["Meet the animals", "जानवरों से मिलें", "प्राण्यांना भेटा"],
  ["happy adoptions", "सफल गोद", "यशस्वी दत्तक"], ["animals in our care", "हमारी देखभाल में जानवर", "आमच्या देखभालीतील प्राणी"], ["ready to go home", "घर जाने को तैयार", "घरी जाण्यास तयार"],
  ["partner shelters", "साझेदार आश्रय", "भागीदार निवारे"], ["Meet some of our animals", "हमारे कुछ जानवरों से मिलें", "आमच्या काही प्राण्यांना भेटा"], ["Featured", "विशेष", "निवडक"],
  ["How adoption works", "गोद लेना कैसे काम करता है", "दत्तक प्रक्रिया कशी चालते"], ["Help us help them", "उनकी मदद में हमारी मदद करें", "त्यांना मदत करण्यात आम्हाला मदत करा"],
  ["Donate", "दान करें", "देणगी द्या"], ["Report a stray", "आवारा जानवर की सूचना दें", "भटक्या प्राण्याची माहिती द्या"], ["Location", "स्थान", "ठिकाण"],
  ["Send to rescue team", "बचाव दल को भेजें", "बचाव पथकाला पाठवा"], ["Questions", "प्रश्न", "प्रश्न"], ["Contact", "संपर्क", "संपर्क"],
  ["Apply to adopt", "गोद लेने के लिए आवेदन करें", "दत्तक घेण्यासाठी अर्ज करा"], ["Details", "विवरण", "तपशील"], ["← Back to animals", "← जानवरों पर वापस", "← प्राण्यांकडे परत"],
  ["Search", "खोजें", "शोधा"], ["Show", "दिखाएँ", "दाखवा"], ["Animals that suit you", "आपके अनुकूल जानवर", "तुम्हाला साजेसे प्राणी"], ["Update my matches", "मेरे मैच अपडेट करें", "माझ्या जुळण्या अपडेट करा"],
  ["Add a new animal", "नया जानवर जोड़ें", "नवीन प्राणी जोडा"], ["Add animal", "जानवर जोड़ें", "प्राणी जोडा"], ["Name", "नाम", "नाव"], ["Breed", "नस्ल", "जात"], ["Shelter", "आश्रय", "निवारा"],
  ["Size", "आकार", "आकार"], ["Energy", "ऊर्जा", "ऊर्जा"], ["Days here", "यहाँ दिन", "येथे दिवस"], ["Adoption fee", "गोद लेने का शुल्क", "दत्तक शुल्क"], ["Similar animals", "मिलते-जुलते जानवर", "तत्सम प्राणी"],
  ["Medical history", "चिकित्सा इतिहास", "वैद्यकीय इतिहास"], ["Health checklist", "स्वास्थ्य सूची", "आरोग्य यादी"], ["Monthly cost estimate", "मासिक खर्च का अनुमान", "मासिक खर्चाचा अंदाज"],
  ["Total per month", "प्रति माह कुल", "दरमहा एकूण"], ["Join waitlist", "प्रतीक्षा सूची में जुड़ें", "प्रतीक्षा यादीत सामील व्हा"], ["Leave waitlist", "प्रतीक्षा सूची छोड़ें", "प्रतीक्षा यादी सोडा"],
  ["Not available yet", "अभी उपलब्ध नहीं", "अजून उपलब्ध नाही"], ["Release to Available", "उपलब्ध करें", "उपलब्ध करा"], ["Add to compare", "तुलना में जोड़ें", "तुलनेत जोडा"], ["Compare", "तुलना", "तुलना"],
  ["Ready", "तैयार", "तयार"], ["Available", "उपलब्ध", "उपलब्ध"], ["Adopted", "गोद लिया गया", "दत्तक घेतले"], ["Quarantine", "क्वारंटीन", "क्वारंटाईन"], ["Long stay", "लंबे समय से", "दीर्घ मुक्काम"],
  ["Small", "छोटा", "लहान"], ["Medium", "मध्यम", "मध्यम"], ["Large", "बड़ा", "मोठा"], ["Low", "कम", "कमी"], ["High", "अधिक", "जास्त"],
  ["Needs vaccination", "टीकाकरण आवश्यक", "लसीकरण आवश्यक"], ["Needs behavior check", "व्यवहार जाँच आवश्यक", "वर्तन तपासणी आवश्यक"], ["Under treatment", "उपचार जारी", "उपचार सुरू"],
  ["Application tracker", "आवेदन ट्रैकर", "अर्ज ट्रॅकर"], ["Approved", "स्वीकृत", "मंजूर"], ["Rejected", "अस्वीकृत", "नाकारले"], ["Submitted", "जमा किया गया", "सादर केले"], ["Under review", "समीक्षा में", "तपासणीत"],
  ["Home check", "घर की जाँच", "घर तपासणी"], ["Meet & greet", "मुलाक़ात", "भेट"], ["Meet and greet", "मुलाक़ात", "भेट"], ["Approve", "स्वीकृत करें", "मंजूर करा"], ["Decline", "अस्वीकार करें", "नाकारा"],
  ["No applications yet.", "अभी कोई आवेदन नहीं।", "अजून एकही अर्ज नाही."], ["Adoption certificates", "गोद लेने के प्रमाणपत्र", "दत्तक प्रमाणपत्रे"], ["Download PDF", "PDF डाउनलोड करें", "PDF डाउनलोड करा"],
  ["Post-adoption follow-ups", "गोद लेने के बाद फ़ॉलो-अप", "दत्तक नंतरचा पाठपुरावा"], ["Submit check-in", "चेक-इन भेजें", "चेक-इन सादर करा"], ["Meet and greet visits", "मुलाक़ात का समय", "भेटीच्या वेळा"],
  ["Book visit", "मुलाक़ात बुक करें", "भेट बुक करा"], ["Date", "तारीख", "तारीख"], ["Time", "समय", "वेळ"], ["Cancel", "रद्द करें", "रद्द करा"], ["No visits booked.", "कोई मुलाक़ात बुक नहीं।", "कोणतीही भेट बुक नाही."],
  ["Shelter dashboard", "आश्रय डैशबोर्ड", "निवारा डॅशबोर्ड"], ["animals in care", "देखभाल में जानवर", "देखभालीतील प्राणी"], ["ready to adopt", "गोद लेने को तैयार", "दत्तकासाठी तयार"],
  ["long-stay animals", "लंबे समय से रुके जानवर", "दीर्घ मुक्कामाचे प्राणी"], ["open applications", "खुले आवेदन", "खुले अर्ज"], ["Shelter capacity", "आश्रय क्षमता", "निवारा क्षमता"],
  ["Adoption funnel", "गोद लेने की फ़नल", "दत्तक फनेल"], ["Capacity forecast", "क्षमता पूर्वानुमान", "क्षमता अंदाज"], ["Long-stay actions", "लंबे प्रवास की कार्रवाई", "दीर्घ मुक्काम कृती"],
  ["Adoptions per month", "प्रति माह गोद", "दरमहा दत्तक"], ["Species in care", "देखभाल में प्रजातियाँ", "देखभालीतील प्रजाती"], ["Average days waiting", "औसत प्रतीक्षा दिन", "सरासरी प्रतीक्षा दिवस"],
  ["Adoption rate by shelter", "आश्रय के अनुसार गोद दर", "निवाऱ्यानुसार दत्तक दर"], ["Most requested breeds", "सबसे अधिक माँगी गई नस्लें", "सर्वाधिक मागणीच्या जाती"], ["Animals in care", "देखभाल में जानवर", "देखभालीतील प्राणी"],
  ["Applications per month", "प्रति माह आवेदन", "दरमहा अर्ज"], ["Application funnel", "आवेदन फ़नल", "अर्ज फनेल"], ["Follow-up satisfaction", "फ़ॉलो-अप संतुष्टि", "पाठपुरावा समाधान"],
  ["Our shelters", "हमारे आश्रय", "आमचे निवारे"], ["Find the nearest one", "निकटतम खोजें", "जवळचे शोधा"], ["Pick your area", "अपना क्षेत्र चुनें", "तुमचा परिसर निवडा"], ["Use my location", "मेरा स्थान उपयोग करें", "माझे स्थान वापरा"],
  ["Notifications", "सूचनाएँ", "सूचना"], ["Nothing new.", "कुछ नया नहीं।", "काही नवीन नाही."], ["Photo", "फोटो", "फोटो"], ["Upload photo", "फोटो अपलोड करें", "फोटो अपलोड करा"],
  ["When", "कब", "केव्हा"], ["Who", "कौन", "कोण"], ["Action", "कार्रवाई", "कृती"], ["Notes", "टिप्पणी", "टिपा"], ["Type", "प्रकार", "प्रकार"], ["Add record", "रिकॉर्ड जोड़ें", "नोंद जोडा"],
  ["All animals", "सभी जानवर", "सर्व प्राणी"], ["Dogs", "कुत्ते", "कुत्रे"], ["Cats", "बिल्लियाँ", "मांजरे"], ["Animals needing attention", "ध्यान चाहने वाले जानवर", "लक्ष हवे असलेले प्राणी"],
  ["Open record", "रिकॉर्ड खोलें", "नोंद उघडा"], ["Everyone is up to date.", "सब अद्यतन हैं।", "सर्व अद्ययावत आहेत."],
];
const TR = { hi: {}, mr: {} };
T.forEach(([e, h, m]) => { TR.hi[e] = h; TR.mr[e] = m; });
S.lang = (() => { try { return localStorage.getItem("pn_lang") || "en"; } catch (e) { return "en"; } })();
function translate() {
  const d = TR[S.lang];
  if (!d) return;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const p = n.parentNode && n.parentNode.nodeName;
    if (p === "SCRIPT" || p === "STYLE" || p === "OPTION" || p === "TEXTAREA") continue; // option text doubles as the form value
    const t = n.nodeValue.trim();
    if (!t) continue;
    let r = d[t];
    if (!r) {
      const m = t.match(/^(.+?) \((\d+)\)$/);
      if (m && d[m[1]]) r = d[m[1]] + " (" + m[2] + ")";
    }
    if (r) n.nodeValue = n.nodeValue.replace(t, r);
  }
}
new MutationObserver(() => { if (S.lang !== "en") { clearTimeout(S.tt); S.tt = setTimeout(translate, 30); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
const R7 = render;
render = function () {
  R7();
  const w = document.querySelector(".who");
  if (w && !w.querySelector("[data-act=lang]"))
    w.insertAdjacentHTML("afterbegin", `<select data-act="lang" aria-label="Language">${[["en", "EN"], ["hi", "हिंदी"], ["mr", "मराठी"]].map(([v, l]) => `<option value="${v}"${S.lang === v ? " selected" : ""}>${l}</option>`).join("")}</select>`);
  document.documentElement.lang = S.lang;
  translate();
};
document.addEventListener("change", (e) => {
  if (e.target.dataset.act === "lang") {
    S.lang = e.target.value;
    try { localStorage.setItem("pn_lang", S.lang); } catch (_) {}
    render();
  }
});

/* Part 8: portraits for rabbits, birds, guinea pigs, hamsters and turtles, and the redesigned shelter map */
const svgw = (p, s, g) => `<svg class="ic bi" viewBox="0 0 100 100" role="img" aria-label="${esc(p.br)} ${p.sp.toLowerCase()}"${s ? ` style="width:${s}px;height:${s}px"` : ""}>${g}</svg>`,
  eyes = (x1, x2, y, r = 3.2) => `<circle cx="${x1}" cy="${y}" r="${r}" fill="#2a2323"/><circle cx="${x2}" cy="${y}" r="${r}" fill="#2a2323"/><circle cx="${x1 + 1}" cy="${y - 1}" r="1.1" fill="#fff"/><circle cx="${x2 + 1}" cy="${y - 1}" r="1.1" fill="#fff"/>`,
  RAB = { "Holland Lop": { c: "#c8a27a", e: "#b08358", lop: 1 }, "Netherland Dwarf": { c: "#f4f1ec", e: "#e3ddd3" }, Lionhead: { c: "#d9b38a", e: "#c49a6c", fluff: 1 }, "Mini Rex": { c: "#9c6b46", e: "#85583a" }, Angora: { c: "#fbfaf8", e: "#ece7df", fluff: 1 } },
  BIRD = { Budgerigar: { b: "#7bd05a", h: "#f7e45c", w: "#3b7a2a", k: "#e8a33a", ch: "#5a7de0" }, Cockatiel: { b: "#b9bec6", h: "#f4ecaa", w: "#9aa0a8", k: "#8c8c8c", ch: "#f08a3a", crest: "#f7e45c" }, Lovebird: { b: "#5fbf4a", h: "#e0503a", w: "#2f8a2f", k: "#e8a33a" }, "African Grey": { b: "#8f959d", h: "#a3a9b1", w: "#6f757d", k: "#2a2a2a", tail: "#d83a3a" }, "Indian Ringneck": { b: "#6ccf3a", h: "#7ad94a", w: "#3b8a1f", k: "#e04040", ring: "#e07a9a" } },
  GP = { American: { c: "#c9915b", m: "#ffffff" }, Abyssinian: { c: "#8b5a36", m: "#e8c9a0" }, Peruvian: { c: "#f2e6d0", m: "#d6b98c", long: 1 } },
  HM = { Syrian: { c: "#e0a45a", b: "#fff3d9" }, Dwarf: { c: "#a8a8a8", b: "#ffffff" }, Roborovski: { c: "#e8c58a", b: "#ffffff", brow: 1 } },
  TL = { "Red-eared Slider": { s: "#4f9a3f", h: "#6dbf5a", m: "#d83a3a" }, "Painted Turtle": { s: "#3d7a3a", h: "#2f6a4a", m: "#f0c83a" }, "Box Turtle": { s: "#8a6a3a", h: "#c9a96a", m: "#e0a03a" } };
Object.assign(PIC2, {
  Rabbit: (p, s) => {
    const b = RAB[p.br] || { c: "#d8c3a5", e: "#c1a883" },
      ears = b.lop
        ? `<ellipse cx="22" cy="54" rx="9" ry="21" transform="rotate(14 22 54)" fill="${b.e}"/><ellipse cx="78" cy="54" rx="9" ry="21" transform="rotate(-14 78 54)" fill="${b.e}"/>`
        : `<ellipse cx="36" cy="22" rx="9" ry="22" fill="${b.e}"/><ellipse cx="64" cy="22" rx="9" ry="22" fill="${b.e}"/><ellipse cx="36" cy="24" rx="4.5" ry="15" fill="#f4b6c0"/><ellipse cx="64" cy="24" rx="4.5" ry="15" fill="#f4b6c0"/>`;
    return svgw(p, s, `${b.fluff ? `<circle cx="50" cy="60" r="36" fill="${b.c}" stroke="#00000012" stroke-width="2"/>` : ""}${ears}<ellipse cx="50" cy="60" rx="28" ry="25" fill="${b.c}"/><ellipse cx="50" cy="70" rx="14" ry="10" fill="#ffffff55"/>${eyes(39, 61, 55)}<ellipse cx="50" cy="63" rx="4" ry="3" fill="#e58b9a"/><path d="M50 66v4M50 70q-4 4-8 1M50 70q4 4 8 1" stroke="#2a2323" stroke-width="1.4" fill="none" stroke-linecap="round"/><rect x="47" y="71" width="6" height="6" rx="1.5" fill="#fff" stroke="#00000022"/><path d="M26 66l12 2M26 72l12-3M74 66l-12 2M74 72l-12-3" stroke="#2a2323" stroke-width="1" fill="none"/>`);
  },
  Bird: (p, s) => {
    const b = BIRD[p.br] || { b: "#6cb4e0", h: "#9ad0f0", w: "#3b7aa8", k: "#e8a33a" };
    return svgw(p, s, `<path d="M42 90L50 100 58 90Z" fill="${b.tail || b.w}"/><ellipse cx="50" cy="68" rx="25" ry="27" fill="${b.b}"/><ellipse cx="30" cy="70" rx="8" ry="19" transform="rotate(8 30 70)" fill="${b.w}"/><ellipse cx="70" cy="70" rx="8" ry="19" transform="rotate(-8 70 70)" fill="${b.w}"/>${b.crest ? `<path d="M40 20Q50 0 60 20Z" fill="${b.crest}"/>` : ""}<circle cx="50" cy="36" r="21" fill="${b.h}"/>${b.ch ? `<circle cx="38" cy="42" r="5" fill="${b.ch}"/><circle cx="62" cy="42" r="5" fill="${b.ch}"/>` : ""}${b.ring ? `<path d="M32 52Q50 60 68 52" stroke="${b.ring}" stroke-width="4" fill="none"/>` : ""}${eyes(42, 58, 32, 3.4)}<path d="M44 42L56 42 50 54Z" fill="${b.k}"/>`);
  },
  "Guinea Pig": (p, s) => {
    const b = GP[p.br] || { c: "#c9a56a", m: "#fff" };
    return svgw(p, s, `${b.long ? `<ellipse cx="50" cy="62" rx="42" ry="34" fill="${b.m}"/>` : ""}<circle cx="24" cy="38" r="10" fill="${b.c}"/><circle cx="76" cy="38" r="10" fill="${b.c}"/><circle cx="24" cy="38" r="5" fill="#f4b6c0"/><circle cx="76" cy="38" r="5" fill="#f4b6c0"/><ellipse cx="50" cy="58" rx="31" ry="28" fill="${b.c}"/><ellipse cx="50" cy="52" rx="8" ry="19" fill="${b.m}" opacity=".9"/>${eyes(37, 63, 53, 3.6)}<ellipse cx="50" cy="68" rx="5" ry="3.5" fill="#e58b9a"/><path d="M50 71v3M50 74q-4 4-8 1M50 74q4 4 8 1" stroke="#2a2323" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  },
  Hamster: (p, s) => {
    const b = HM[p.br] || { c: "#d9b27a", b: "#fff" };
    return svgw(p, s, `<circle cx="28" cy="30" r="10" fill="${b.c}"/><circle cx="72" cy="30" r="10" fill="${b.c}"/><circle cx="28" cy="30" r="5" fill="#f4b6c0"/><circle cx="72" cy="30" r="5" fill="#f4b6c0"/><circle cx="50" cy="56" r="31" fill="${b.c}"/><circle cx="31" cy="66" r="11" fill="${b.b}"/><circle cx="69" cy="66" r="11" fill="${b.b}"/><ellipse cx="50" cy="66" rx="14" ry="12" fill="${b.b}"/>${b.brow ? '<path d="M34 42q5-3 10 0M56 42q5-3 10 0" stroke="#fff" stroke-width="3" fill="none"/>' : ""}${eyes(39, 61, 50, 3.6)}<ellipse cx="50" cy="60" rx="3.5" ry="2.6" fill="#e58b9a"/><path d="M50 63v3M50 66q-3 3-6 1M50 66q3 3 6 1" stroke="#2a2323" stroke-width="1.2" fill="none" stroke-linecap="round"/><rect x="48" y="67" width="4" height="4" rx="1" fill="#fff" stroke="#00000022"/>`);
  },
  Turtle: (p, s) => {
    const b = TL[p.br] || { s: "#5a9a4a", h: "#7fbf6a", m: "#e0a03a" };
    return svgw(p, s, `<ellipse cx="22" cy="74" rx="10" ry="8" fill="${b.h}"/><ellipse cx="78" cy="74" rx="10" ry="8" fill="${b.h}"/><circle cx="50" cy="26" r="14" fill="${b.h}"/>${eyes(44, 56, 24, 2.8)}${p.br !== "Box Turtle" ? `<ellipse cx="64" cy="29" rx="4" ry="2.4" fill="${b.m}"/>` : ""}<path d="M46 32q4 3 8 0" stroke="#2a2323" stroke-width="1.4" fill="none"/><ellipse cx="50" cy="64" rx="36" ry="26" fill="${b.s}"/><path d="M30 64h40M40 44l-8 20M60 44l8 20M42 64l-6 18M58 64l6 18M40 44h20" stroke="#00000030" stroke-width="2.4" fill="none"/>`);
  },
});
[["Rabbits", "खरगोश", "ससे"], ["Birds", "पक्षी", "पक्षी"], ["Guinea Pigs", "गिनी पिग", "गिनी पिग"], ["Hamsters", "हैम्स्टर", "हॅम्स्टर"], ["Turtles", "कछुए", "कासवे"], ["Directions", "दिशा-निर्देश", "मार्गदर्शन"], ["full", "भरा", "भरलेले"]].forEach(([e, h, m]) => { TR.hi[e] = h; TR.mr[e] = m; });

// Shelter map: stylised Pune map with a river, parks, area names, colour-coded pins and a route line to the nearest shelter
Object.assign(AREAS, { Aundh: [18.558, 73.8077], Kharadi: [18.5515, 73.9395], Hinjewadi: [18.5912, 73.739], Katraj: [18.4575, 73.8677], "Pimpri-Chinchwad": [18.6279, 73.8009] });
V.shelters = () => {
  const L = (S.shl || []).filter((s) => s.lat != null);
  if (!L.length) return '<p class="mut">Loading shelters...</p>';
  const me = S.me || AREAS[S.area] || null, W = 640, H = 420, pad = 62,
    pts = L.map((s) => [s.lat, s.lng]).concat(me ? [me] : []),
    la = pts.map((p) => p[0]), ln = pts.map((p) => p[1]),
    [y0, y1, x0, x1] = [Math.min(...la), Math.max(...la), Math.min(...ln), Math.max(...ln)],
    X = (v) => pad + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * pad), Y = (v) => H - pad - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * pad - 14),
    cp = caps(),
    use = (id) => { const r = cp.filter((x) => x.h == id), c = r.reduce((a, x) => a + x.c, 0), m = r.reduce((a, x) => a + x.m, 0); return m ? Math.round((c / m) * 100) : 0; },
    col = (u) => (u >= 90 ? "#d9534f" : u >= 70 ? "#e0a030" : "#3aa76d"),
    cls = (u) => (u >= 90 ? "bad" : u >= 70 ? "warn" : "ok"),
    rows = L.map((s) => ({ ...s, d: me ? km(me, [s.lat, s.lng]) : null, u: use(s.id) })).sort((a, b) => (me ? a.d - b.d : a.id - b.id)),
    near = me ? rows[0] : null,
    river = [[18.575, 73.795], [18.552, 73.82], [18.532, 73.848], [18.52, 73.89], [18.506, 73.935]].map(([a, b], i) => `${i ? "L" : "M"}${X(b).toFixed(0)},${Y(a).toFixed(0)}`).join(" ");
  const pin = (s) => {
    const x = X(s.lng), y = Y(s.lat), sel = s.id === S.sel, k = sel ? 1.3 : 1;
    return `<g data-act="selsh" data-id="${s.id}" transform="translate(${x.toFixed(0)},${y.toFixed(0)}) scale(${k})" style="cursor:pointer"><title>${esc(s.name)}: ${s.u}% full</title>
      <ellipse cy="2" rx="9" ry="3" fill="#00000030"/><path d="M0 0C-15-17-15-37 0-37S15-17 0 0Z" fill="${col(s.u)}" stroke="#fff" stroke-width="2.5"/><circle cy="-25" r="8" fill="#fff"/><text y="-21.5" text-anchor="middle" font-size="11" font-weight="700" fill="${col(s.u)}">${s.id}</text>
      <rect x="-${s.name.length * 3.2 + 8}" y="6" width="${s.name.length * 6.4 + 16}" height="17" rx="8.5" fill="#fff" stroke="${sel ? col(s.u) : "#d5e3e3"}" stroke-width="${sel ? 2 : 1}"/><text y="18" text-anchor="middle" font-size="10.5" fill="#1d2b2b" font-weight="600">${esc(s.name)}</text></g>`;
  };
  return `<h2>Our shelters</h2><div class="card"><div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end"><label style="flex:1;min-width:200px">Find the nearest one
    <select data-act="area"><option value="">Pick your area</option>${Object.keys(AREAS).map((a) => `<option${a === S.area ? " selected" : ""}>${a}</option>`).join("")}</select></label>
    <button class="btn sm alt" data-act="geo" style="margin-bottom:.4rem">Use my location</button></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of our shelters" style="width:100%;border-radius:18px;margin-top:.8rem;background:linear-gradient(160deg,#eef6f3,#e4efe9)">
    <defs><pattern id="gr" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#00000010"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#gr)"/>
    <ellipse cx="${W * 0.18}" cy="${H * 0.72}" rx="64" ry="34" fill="#cfe6c6" opacity=".7"/><ellipse cx="${W * 0.78}" cy="${H * 0.3}" rx="52" ry="28" fill="#cfe6c6" opacity=".7"/><ellipse cx="${W * 0.55}" cy="${H * 0.82}" rx="46" ry="22" fill="#cfe6c6" opacity=".6"/>
    <path d="${river}" fill="none" stroke="#9fcbe8" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><text x="${X(73.9)}" y="${Y(18.503) + 26}" font-size="10" fill="#5f9bc4" font-style="italic">Mula-Mutha river</text>
    ${Object.entries(AREAS).map(([n, [a, b]]) => `<text x="${X(b)}" y="${Y(a) + 4}" text-anchor="middle" font-size="9.5" fill="#6a8a8a" opacity=".75">${n}</text>`).join("")}
    ${near ? `<line x1="${X(me[1])}" y1="${Y(me[0])}" x2="${X(near.lng)}" y2="${Y(near.lat)}" stroke="#d9534f" stroke-width="2.5" stroke-dasharray="6 5"/><text x="${(X(me[1]) + X(near.lng)) / 2}" y="${(Y(me[0]) + Y(near.lat)) / 2 - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#d9534f">${near.d.toFixed(1)} km</text>` : ""}
    ${rows.map(pin).join("")}
    ${me ? `<g transform="translate(${X(me[1])},${Y(me[0])})"><circle r="8" fill="#2f6fe0" opacity=".35"><animate attributeName="r" values="8;22;8" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".4;0;.4" dur="2.2s" repeatCount="indefinite"/></circle><circle r="7" fill="#2f6fe0" stroke="#fff" stroke-width="2.5"/><text y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#2f6fe0">You</text></g>` : ""}
    <g transform="translate(14,${H - 22})" font-size="10" fill="#4a5f5f"><circle cx="5" cy="-3" r="5" fill="#3aa76d"/><text x="14" y="0">under 70% full</text><circle cx="108" cy="-3" r="5" fill="#e0a030"/><text x="117" y="0">70 to 89%</text><circle cx="186" cy="-3" r="5" fill="#d9534f"/><text x="195" y="0">90%+ full</text></g></svg></div>
    ${rows.map((s) => `<div class="card" style="${s.id === S.sel ? "outline:2px solid " + col(s.u) : ""}"><div class="row"><b>${s.id}. ${esc(s.name)}</b>${s.d != null ? `<span class="chip ok">${s.d.toFixed(1)} km away</span>` : `<span class="chip ${cls(s.u)}">${s.u}% full</span>`}</div><p class="mut">${esc(s.address || "")}</p>
    <div class="bar"><i class="${cls(s.u)}" style="width:${Math.min(s.u, 100)}%"></i></div><p>${cp.filter((x) => x.h == s.id).map((x) => `<span class="chip ${x.k}">${x.sp}s ${x.c}/${x.m}</span>`).join(" ")}</p>
    <a class="btn sm alt" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}">Directions</a></div>`).join("")}`;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act=selsh]");
  if (b) { S.sel = +b.dataset.id; render(); }
});

render();
