// Bottari — 한국 휴가 살 것·후보, 둘이 같이 쓰는 목록
// 배포할 때 VERSION과 sw.js의 CACHE를 같이 올릴 것
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const VERSION = "1.1";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const NAME = { MK: "민경", KM: "규문" };
const HOME = { MK: "민경네", KM: "규문네" };
const CATS = ["할 것", "먹을 것", "예약", "사람", "해지", "부모님"];
const NOPLACE = "미분류";

let me = null;            // household_members 행
let items = [];           // 지워지지 않은 bt_items
let trip = null;          // { name, date }
const recent = new Set(); // 이번에 그은 항목 — 다시 그릴 때도 제자리에 두어 실수로 그은 걸 바로 되돌릴 수 있게
const state = {
  tab: load("bt.tab", "buy"),
  open: { got: false, done: false },
  place: load("bt.place", { buy: "한국", cand: null }),
};

const $ = (id) => document.getElementById(id);
const I = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600);
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// 로컬 화면 확인용(localhost?demo): 로그인·DB 없이 가짜 데이터로 그림. 배포 주소에선 꺼짐
const DEMO = location.hostname === "localhost" && new URLSearchParams(location.search).has("demo");
const DEMO_ITEMS = () => {
  const t = (m) => new Date(Date.now() - m * 6e4).toISOString();
  const b = (text, o = {}) => ({ id: uuid(), kind: "buy", text, place: "한국", status: "todo", created_by: "MK", created_at: t(90), ...o });
  const c = (text, o = {}) => ({ id: uuid(), kind: "cand", text, status: "todo", created_by: "MK", created_at: t(90), ...o });
  return [
    b("메디큐브 에이지알 부스터프로", { qty: 2, status: "ord", ordered_by: "MK", ship_to: "MK", eta: "12/12" }),
    b("오르조 보리차", { status: "ord", ordered_by: "KM", ship_to: "KM", created_by: "KM" }),
    b("킬리안 플라워 오브 이모탈리티", { note: "텍스리펀" }),
    b("포켓와이파이", { note: "한국·일본" }),
    b("사골곰탕", { note: "꼭 고기 사진이 있어야 함, 식육" }),
    b("딸기 크림치즈", { qty: 2 }),
    b("샴푸", { created_by: "KM" }),
    b("후쿠오카 곤약젤리", { place: "일본" }),
    b("생리대", { status: "got", done_by: "KM" }),
    c("국립중앙박물관", { place: "서울", cat: "할 것" }),
    c("잠실 피부과?", { place: "서울", cat: "예약" }),
    c("카리나 눈썹문신", { cat: "예약", status: "done", done_by: "MK", scheduled: "12/20" }),
    c("과천 리프트", { place: "과천", cat: "할 것" }),
    c("수안보 유원제 온천호텔", { place: "충주", cat: "할 것", link: "https://blog.naver.com/xxo_chive/224305196137" }),
    c("종찬 집들이", { cat: "사람", created_by: "KM" }),
  ];
};
if (DEMO) {
  const ok = { error: null, data: null };
  const q = { update: () => q, insert: async () => ok, upsert: async () => ok, eq: async () => ok };
  sb.from = () => q;
}

// ───────────────────────────── 인증
async function boot() {
  if (DEMO) {
    me = { member_code: "MK", display_name: "민경" };
    items = DEMO_ITEMS(); trip = { name: "12월 한국", date: "2026-12-18" };
    $("screen-auth").hidden = true; $("app").hidden = false;
    $("pen-dot").className = "pen-dot MK";
    return render();
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showAuth();
  await enter(session);
}
function showAuth() { $("screen-auth").hidden = false; $("app").hidden = true; }
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("login-btn"); btn.disabled = true; $("login-err").hidden = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $("login-email").value.trim(), password: $("login-pw").value });
  btn.disabled = false;
  if (error) { $("login-err").textContent = "로그인하지 못했어요: " + error.message; $("login-err").hidden = false; return; }
  await enter(data.session);
});

async function enter(session) {
  const { data: m, error } = await sb.from("household_members").select("*").eq("email", session.user.email).maybeSingle();
  if (error || !m) {
    await sb.auth.signOut();
    $("login-err").textContent = "이 계정은 가족 구성원으로 등록돼 있지 않아요.";
    $("login-err").hidden = false;
    return showAuth();
  }
  me = m;
  $("screen-auth").hidden = true; $("app").hidden = false;
  $("pen-dot").className = "pen-dot " + me.member_code;
  await refresh();
  subscribe();
}

// ───────────────────────────── 데이터
async function refresh() {
  const [r1, r2] = await Promise.all([
    sb.from("bt_items").select("*").is("deleted_at", null).order("created_at"),
    sb.from("bt_settings").select("*").eq("key", "trip").maybeSingle(),
  ]);
  if (r1.error) {
    toast(r1.error.code === "42P01" ? "표가 아직 없어요. migrations/001_bottari.sql을 실행해 주세요." : "불러오지 못했어요: " + r1.error.message);
    items = [];
  } else items = r1.data;
  trip = r2.data?.value ?? null;
  render();
}
function subscribe() {
  sb.channel("bt-items")
    .on("postgres_changes", { event: "*", schema: "public", table: "bt_items" }, ({ eventType, new: row, old }) => {
      const id = row?.id ?? old?.id;
      const i = items.findIndex((x) => x.id === id);
      if (eventType === "DELETE" || row?.deleted_at) { if (i >= 0) items.splice(i, 1); }
      else if (i >= 0) items[i] = row;
      else items.push(row);
      render();
    })
    .subscribe();
  // 화면으로 돌아오면 한 번 더 맞춤 (실시간 연결이 끊겼을 때 대비)
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
async function patch(it, fields) {
  const before = { ...it };
  Object.assign(it, fields);
  render();
  const { error } = await sb.from("bt_items").update(fields).eq("id", it.id);
  if (error) { Object.assign(it, before); render(); toast("저장하지 못했어요: " + error.message); return false; }
  return true;
}

// ───────────────────────────── 그리기
const strikeSvg = (by) => `<svg class="strike by-${by || me?.member_code || "MK"}" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M1 6.5 C 18 3.5, 34 7.5, 52 5 S 84 3.8, 99 5.6"/></svg>`;
const isStruck = (it) => it.status === "got" || it.status === "done";

function host(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function itemHtml(it) {
  const meta = [];
  if (it.kind === "buy") {
    if (it.status === "ord" || (it.status === "got" && it.ship_to)) {
      const who = it.ordered_by ? NAME[it.ordered_by] + " 주문" : "주문함";
      meta.push(`<span>${I("package")}${esc([who, it.ship_to ? HOME[it.ship_to] + "로" : "", it.eta].filter(Boolean).join(" · "))}</span>`);
    }
    if (it.place && it.place !== "한국") meta.push(`<span class="tg">${esc(it.place)}</span>`);
  } else {
    if (it.cat) meta.push(`<span>${esc(it.cat)}</span>`);
    if (it.scheduled) meta.push(`<span>${I("cal")}${esc(it.scheduled)}</span>`);
  }
  if (it.note) meta.push(`<span>${esc(it.note)}</span>`);
  if (it.link) meta.push(`<a href="${esc(it.link)}" target="_blank" rel="noopener">${I("link")}${esc(host(it.link))}</a>`);
  return `<div class="it ${it.created_by}${isStruck(it) ? " struck" : ""}" data-id="${it.id}" role="button" tabindex="0">
    <div class="tx"><span class="nm">${esc(it.text)}${it.qty > 1 ? `<span class="qty">×${it.qty}</span>` : ""}${strikeSvg(it.done_by)}</span>
    ${meta.length ? `<div class="mt">${meta.join("")}</div>` : ""}</div>
    <button class="more" data-edit="${it.id}" aria-label="고치기">${I("more")}</button></div>`;
}
const sec = (label, list) => list.length ? `<div class="sec">${label} <small>${list.length}</small></div>${list.map(itemHtml).join("")}` : "";
const fold = (key, label, list) => !list.length ? "" :
  `<button class="fold press${state.open[key] ? " open" : ""}" data-fold="${key}">${label} ${list.length}${I("down")}</button>${state.open[key] ? list.map(itemHtml).join("") : ""}`;

function render() {
  if (!me) return;
  const tab = state.tab;
  $("title").textContent = tab === "buy" ? "살 것" : "후보";
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("trip-btn").innerHTML = tripLabel();
  const place = state.place[tab];
  $("add-place").innerHTML = `${I("pin")}${esc(place || NOPLACE)}`;
  $("add-text").placeholder = tab === "buy" ? "살 것 한 줄" : "하고 싶은 것 한 줄";

  const mine = items.filter((x) => x.kind === tab);
  const keep = (x) => !isStruck(x) || recent.has(x.id);
  let html = "";
  if (tab === "buy") {
    const ord = mine.filter((x) => x.status === "ord" || (recent.has(x.id) && x.status === "got" && x.ship_to));
    const todo = mine.filter((x) => keep(x) && !ord.includes(x));
    const got = mine.filter((x) => x.status === "got" && !recent.has(x.id));
    html = sec("주문함", ord) + sec("살 것", todo) + fold("got", "받음", got);
    if (!mine.length) html = `<p class="empty">살 게 생기면 아래에 한 줄 적어요. 상대 화면에도 바로 떠요.</p>`;
  } else {
    const live = mine.filter(keep);
    const groups = new Map();
    for (const x of live) { const k = x.place || NOPLACE; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const order = [...groups.keys()].filter((k) => k !== NOPLACE).sort((a, b) => groups.get(b).length - groups.get(a).length);
    if (groups.has(NOPLACE)) order.push(NOPLACE);
    html = order.map((k) => sec(k, groups.get(k))).join("") + fold("done", "잡았거나 한 것", mine.filter((x) => x.status === "done" && !recent.has(x.id)));
    if (!mine.length) html = `<p class="empty">하고 싶은 것·먹고 싶은 것·만날 사람이 생각나면 한 줄 적어요. 장소는 나중에 붙여도 돼요.</p>`;
  }
  $("list").innerHTML = html;
}
function tripLabel() {
  if (!trip?.date) return `${I("plane")}다음 출발 정하기`;
  const d = Math.ceil((new Date(trip.date + "T00:00:00") - new Date(new Date().toDateString())) / 864e5);
  const dd = d > 0 ? `D-${d}` : d === 0 ? "오늘 출발" : "다녀옴";
  return `${esc(trip.name || "다음 출발")} · ${dd}`;
}

// ───────────────────────────── 누르기: 긋기 / 고치기 / 접기
$("list").addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const ed = e.target.closest("[data-edit]");
  if (ed) return openEdit(items.find((x) => x.id === ed.dataset.edit));
  const f = e.target.closest("[data-fold]");
  if (f) { state.open[f.dataset.fold] = !state.open[f.dataset.fold]; return render(); }
  const row = e.target.closest(".it");
  if (row) toggle(items.find((x) => x.id === row.dataset.id), row);
});
$("list").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("it")) { e.preventDefault(); e.target.click(); }
});

async function toggle(it, row) {
  if (!it) return;
  const on = !isStruck(it);
  const next = on ? (it.kind === "buy" ? "got" : "done") : (it.kind === "buy" && it.ordered_by ? "ord" : "todo");
  recent.add(it.id);
  // 줄을 그 자리에서 먼저 긋고(0.22초), DB 반영 후 다시 그림
  const svg = row.querySelector(".strike");
  svg.setAttribute("class", "strike by-" + me.member_code);
  row.classList.toggle("struck", on);
  await new Promise((r) => setTimeout(r, 240));
  patch(it, { status: next, done_by: on ? me.member_code : null, done_at: on ? new Date().toISOString() : null });
}

$("trip-btn").addEventListener("click", openMenu);
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  state.tab = b.dataset.tab; save("bt.tab", state.tab); recent.clear();
  $("scr").scrollTop = 0; render();
});

// ───────────────────────────── 적기
function parseQty(s) {
  const m = s.match(/^(.*?)\s*(?:[x×X]\s*(\d{1,2})|(\d{1,2})\s*개)\s*$/);
  return m && m[1].trim() ? { text: m[1].trim(), qty: +(m[2] || m[3]) } : { text: s, qty: null };
}
$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("add-text").value.trim(); if (!raw) return;
  const { text, qty } = parseQty(raw);
  const row = { id: uuid(), kind: state.tab, text, qty: qty > 1 ? qty : null, place: state.place[state.tab] || null,
    status: "todo", created_by: me.member_code, created_at: new Date().toISOString() };
  items.push(row);
  $("add-text").value = "";
  render();
  $("scr").scrollTop = $("scr").scrollHeight;
  const { error } = await sb.from("bt_items").insert(row);
  if (error) { items = items.filter((x) => x.id !== row.id); render(); $("add-text").value = raw; toast("적지 못했어요: " + error.message); }
});
$("add-place").addEventListener("click", openPlacePicker);

function placesOf(kind) {
  const n = new Map();
  for (const x of items) if (x.kind === kind && x.place) n.set(x.place, (n.get(x.place) || 0) + 1);
  if (kind === "buy" && !n.has("한국")) n.set("한국", 0);
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a));
}
function openPlacePicker() {
  const tab = state.tab, cur = state.place[tab];
  const list = [...placesOf(tab), ...(tab === "cand" ? [NOPLACE] : [])];
  openSheet(`<div class="sh-title">어디서?</div>
    <div class="place-list seg">${list.map((p) => `<button class="press${(cur || NOPLACE) === p ? " on" : ""}" data-place="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <label class="fld">새 장소<input id="new-place" placeholder="예: 부산, 후쿠오카" enterkeyhint="done"></label>
    <div class="sh-actions"><button class="btn-primary press" id="place-ok">새 장소로 적기</button></div>`);
  const pick = (p) => { state.place[tab] = p === NOPLACE ? null : p; save("bt.place", state.place); closeSheet(); render(); $("add-text").focus(); };
  $("sheet").querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.place)));
  const ok = () => { const v = $("new-place").value.trim(); if (v) pick(v); };
  $("place-ok").addEventListener("click", ok);
  $("new-place").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } });
}

// ───────────────────────────── 고치기 시트
function openEdit(it) {
  if (!it) return;
  const d = { ...it };
  const buy = it.kind === "buy";
  const draw = () => {
    openSheet(`<div class="sh-title">${buy ? "살 것" : "후보"} 고치기</div>
      <label class="fld">이름<input class="big" id="e-text" value="${esc(d.text)}"></label>
      ${buy ? `
      <div class="fld">수량<div class="stepper"><button data-q="-1" aria-label="하나 빼기">−</button><span id="e-qty">${d.qty || 1}</span><button data-q="1" aria-label="하나 더">+</button></div></div>
      <div class="fld">상태<div class="seg" id="e-st">
        ${[["todo", "살 것"], ["ord", "주문함"], ["got", "받음"]].map(([v, l]) => `<button class="${d.status === v ? "on" : ""}" data-st="${v}">${l}</button>`).join("")}</div></div>
      ${d.status === "ord" || d.ship_to ? `
      <div class="fld">받는 곳<div class="seg" id="e-ship">
        ${["MK", "KM"].map((c) => `<button class="${c}${d.ship_to === c ? " on" : ""}" data-ship="${c}">${HOME[c]}</button>`).join("")}</div></div>
      <label class="fld">도착 예정<input id="e-eta" value="${esc(d.eta)}" placeholder="예: 12/12, 블프 배송"></label>` : ""}
      ` : `
      <div class="fld">종류<div class="seg" id="e-cat">
        ${CATS.map((c) => `<button class="${d.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div></div>
      <label class="fld">잡은 날<input id="e-sch" value="${esc(d.scheduled)}" placeholder="캘린더에 옮겼으면 날짜 (예: 12/20)"></label>
      `}
      <label class="fld">장소<input id="e-place" value="${esc(d.place)}" list="e-places" placeholder="${buy ? "한국" : "비우면 미분류"}"><datalist id="e-places">${placesOf(it.kind).map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
      <label class="fld">메모<textarea id="e-note" placeholder="예: 텍스리펀, 코트용">${esc(d.note)}</textarea></label>
      <label class="fld">링크<input id="e-link" type="url" inputmode="url" value="${esc(d.link)}" placeholder="https://"></label>
      <div class="sh-actions">
        <button class="btn-ghost danger press" id="e-del">지우기</button>
        <button class="btn-ghost press" id="e-move">${buy ? "후보로" : "살 것으로"}</button>
        <button class="btn-primary press" id="e-save">저장</button>
      </div>
      <p class="sh-meta">${NAME[it.created_by]}이 적음 · ${new Date(it.created_at).toLocaleDateString("ko-KR")}${it.done_by ? ` · ${NAME[it.done_by]}이 그음` : ""}</p>`);
    const sh = $("sheet");
    const grab = () => { // 다시 그리기 전에 입력값 보존
      d.text = $("e-text").value; d.note = $("e-note").value; d.link = $("e-link").value; d.place = $("e-place").value;
      if ($("e-eta")) d.eta = $("e-eta").value;
      if ($("e-sch")) d.scheduled = $("e-sch").value;
    };
    sh.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { d.qty = Math.max(1, (d.qty || 1) + +b.dataset.q); $("e-qty").textContent = d.qty; }));
    sh.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => {
      grab(); d.status = b.dataset.st;
      if (d.status === "ord" && !d.ordered_by) d.ordered_by = me.member_code;
      if (d.status === "ord" && !d.ship_to) d.ship_to = me.member_code;
      if (d.status === "todo") { d.ordered_by = null; d.ship_to = null; d.eta = null; }
      draw();
    }));
    sh.querySelectorAll("[data-ship]").forEach((b) => b.addEventListener("click", () => { grab(); d.ship_to = b.dataset.ship; draw(); }));
    sh.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { grab(); d.cat = d.cat === b.dataset.cat ? null : b.dataset.cat; draw(); }));
    $("e-save").addEventListener("click", async () => {
      grab();
      const text = d.text.trim(); if (!text) return toast("이름을 적어 주세요.");
      const wasStruck = isStruck(it), nowStruck = d.status === "got" || d.status === "done";
      const fields = {
        text, note: d.note.trim() || null, link: d.link.trim() || null, place: d.place.trim() || null,
        ...(buy ? { qty: d.qty > 1 ? d.qty : null, status: d.status, ordered_by: d.ordered_by || null, ship_to: d.ship_to || null, eta: d.eta?.trim() || null }
                : { cat: d.cat || null, scheduled: d.scheduled?.trim() || null }),
        ...(wasStruck !== nowStruck ? { done_by: nowStruck ? me.member_code : null, done_at: nowStruck ? new Date().toISOString() : null } : {}),
      };
      closeSheet();
      if (await patch(it, fields)) toast("저장했어요.");
    });
    $("e-move").addEventListener("click", async () => {
      closeSheet();
      const to = buy ? "cand" : "buy";
      if (await patch(it, { kind: to, status: "todo", ordered_by: null, ship_to: null, eta: null, done_by: null, done_at: null, place: to === "buy" ? "한국" : null }))
        toast(buy ? "후보로 옮겼어요." : "살 것으로 옮겼어요.");
    });
    const del = $("e-del");
    del.addEventListener("click", async () => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "한 번 더 누르면 지워요"; return; }
      closeSheet();
      items = items.filter((x) => x.id !== it.id); render();
      const { error } = await sb.from("bt_items").update({ deleted_at: new Date().toISOString() }).eq("id", it.id);
      if (error) { items.push(it); render(); toast("지우지 못했어요: " + error.message); } else toast("지웠어요.");
    });
  };
  draw();
}

// ───────────────────────────── 메뉴: 다음 출발 · 로그아웃
function openMenu() {
  openSheet(`<div class="sh-title">다음 출발</div>
    <div class="row2">
      <label class="fld">이름<input id="t-name" value="${esc(trip?.name)}" placeholder="12월 한국"></label>
      <label class="fld">출발일<input id="t-date" type="date" value="${esc(trip?.date)}"></label>
    </div>
    <div class="sh-actions"><button class="btn-ghost press" id="logout">로그아웃</button><button class="btn-primary press" id="t-save">저장</button></div>
    <p class="sh-meta">${NAME[me.member_code]}으로 로그인 · Bottari v${VERSION}</p>`);
  $("t-save").addEventListener("click", async () => {
    const value = { name: $("t-name").value.trim() || "다음 출발", date: $("t-date").value || null };
    closeSheet();
    const { error } = await sb.from("bt_settings").upsert({ key: "trip", value });
    if (error) return toast("저장하지 못했어요: " + error.message);
    trip = value; render(); toast("저장했어요.");
  });
  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
}

// ───────────────────────────── 시트 열고 닫기
function openSheet(html) {
  const sh = $("sheet"), bk = $("sheet-back");
  clearTimeout(closeSheet.t);
  const wasOpen = !sh.hidden && sh.classList.contains("in");
  sh.innerHTML = `<div class="grab"></div>` + html;
  if (wasOpen) return;
  sh.hidden = false; bk.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { sh.classList.add("in"); bk.classList.add("in"); }));
}
function closeSheet() {
  const sh = $("sheet"), bk = $("sheet-back");
  sh.classList.remove("in"); bk.classList.remove("in");
  closeSheet.t = setTimeout(() => { sh.hidden = true; bk.hidden = true; sh.innerHTML = ""; }, 260);
}
$("sheet-back").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
boot();
