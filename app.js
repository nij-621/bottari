// Bottari — 한국 휴가 살 것·후보·선물, 둘이 같이 쓰는 목록
// 배포할 때 VERSION과 sw.js의 CACHE를 같이 올릴 것
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const VERSION = "2.1";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const NAME = { MK: "민경", KM: "규문" };
const HOME = { MK: "민경네", KM: "규문네" };
const CATS = ["할 것", "먹을 것", "예약", "사람", "해지", "부모님"];         // 후보 종류
const BUY_CATS = ["식품", "뷰티", "옷·신발", "생활", "기타"];                    // 살 것 분류
const NOCAT = "분류 안 함";
const NOPLACE = "미분류";
const ANYONE = "나눠 줄 것";   // 선물: 받는 사람을 안 정한 것 (친구·지인용 과자 등)
const KIND = { buy: "살 것", cand: "후보", gift: "선물", ref: "참고", bring: "받아 올 것" };
const TO = { buy: "살 것으로", cand: "후보로", gift: "선물로", ref: "참고로", bring: "받아 올 것으로" };
const HOME_PLACE = { buy: "한국", cand: null, gift: "오스트리아", ref: null, bring: "한국" }; // 장소 기본값 (이 값이면 태그 안 보임) · 참고는 장소 대신 주제(topic)
const NOTOPIC = "주제 없음";
const TOPIC_HINTS = ["쇼핑·텍스리펀", "외출·교통", "병원·예약", "행정·은행", "일본"]; // 참고 주제 예시 (자유롭게 더함)
// 탭마다 "누르면 무엇이 되는지" 한 줄 안내 — 닫으면 그 탭에선 다시 안 뜸 (누르는 동작이 탭마다 달라서)
const HINT = {
  buy: "누르면 산 것으로 줄이 그어져요. 꾹 눌러 끌면 다른 분류로 옮기거나 순서를 바꿔요. 자세한 건 ⋯",
  cand: "일정에 넣었거나 이미 한 후보를 누르면 줄이 그어져요. 꾹 눌러 끌면 다른 장소로 옮겨요. 종류·날짜는 ⋯",
  gift: "누를 때마다 살 것 → 샀음 → 줌. 꾹 눌러 끌면 다른 사람에게 옮겨요. 수량은 ⋯",
  ref: "누르면 링크가 열려요. 꾹 눌러 끌면 다른 주제로 옮겨요. 제목은 ⋯",
  trip: "여행을 누르면 같이 가는 사람과 준비 체크리스트가 나와요.",
};
const URL_RE =/(https?:\/\/\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*)/i;
// 새 여행의 준비 체크리스트 — 같은 장소의 지난 여행이 있으면 그걸 복사하고, 없으면 이 목록
const TEMPLATE = {
  "한국": ["항공권", "공항 가는 길", "한국 유심·로밍", "원화 현금", "선물 다 샀나", "집 비우기 (우편·화분·난방)", "짐 무게 확인 (갈 때·올 때)"],
  "일본": ["항공권", "숙소", "엔화 환전", "비짓재팬 웹 등록", "포켓와이파이·eSIM", "여행자 보험", "공항 ↔ 시내 교통"],
  "": ["항공권", "숙소", "환전", "유심·eSIM", "여행자 보험", "공항 ↔ 시내 교통"],
};

let me = null;            // household_members 행
let items = [];           // 지워지지 않은 bt_items
let trips = [];           // bt_trips (지워지지 않은 것)
let checks = [];          // bt_checks (지워지지 않은 것)
let trip = null;          // 예전 "다음 출발" 설정 — 여행이 하나도 없을 때만 머리말에 씀
const recent = new Set(); // 이번에 그은 항목 — 다시 그릴 때도 제자리에 두어 실수로 그은 걸 바로 되돌릴 수 있게
const prevSt = new Map(); // 선물: 이번에 한 단계 넘긴 항목의 이전 상태 — 다시 누르면 되돌림
const state = {
  tab: load("bt.tab", "buy"),
  open: { got: false, done: false, given: false, packed: false },
  place: { ...HOME_PLACE, ...load("bt.place", {}) },
  hintsSeen: load("bt.hints2", {}), // 2 = v1.8에서 끌기 안내가 생겨 한 번 더 보여 줌
  q: "",          // 찾기 글자 — 비어 있지 않으면 탭 대신 찾은 결과를 보여 줌
};

const $ = (id) => document.getElementById(id);
const I = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
// 안내 띠. action = { label, fn } 이면 버튼이 붙고(예: 되돌리기) 조금 더 오래 보임
function toast(msg, action) {
  const t = $("toast"), b = $("toast-act");
  $("toast-text").textContent = msg;
  b.hidden = !action; b.textContent = action?.label || "";
  b.onclick = action ? () => { t.classList.remove("on", "act"); action.fn(); } : null;
  t.classList.toggle("act", !!action);
  t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on", "act"), action ? 4500 : 2600);
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// 로컬 화면 확인용(localhost?demo): 로그인·DB 없이 가짜 데이터로 그림. 배포 주소에선 꺼짐
const DEMO = location.hostname === "localhost" && new URLSearchParams(location.search).has("demo");
const DEMO_ITEMS = () => {
  const t = (m) => new Date(Date.now() - m * 6e4).toISOString();
  const b = (text, o = {}) => ({ id: uuid(), kind: "buy", text, place: "한국", status: "todo", created_by: "MK", created_at: t(90), ...o });
  const c = (text, o = {}) => ({ id: uuid(), kind: "cand", text, status: "todo", created_by: "MK", created_at: t(90), ...o });
  return [
    b("메디큐브 에이지알 부스터프로", { cat: "뷰티", qty: 2, status: "ord", ordered_by: "MK", ship_to: "MK", eta: "12/12" }),
    b("오르조 보리차", { cat: "식품", status: "ord", ordered_by: "KM", ship_to: "KM", created_by: "KM" }),
    b("킬리안 플라워 오브 이모탈리티", { cat: "뷰티", note: "텍스리펀" }),
    b("포켓와이파이", { cat: "기타", note: "한국·일본" }),
    b("사골곰탕", { cat: "식품", note: "꼭 고기 사진이 있어야 함, 식육" }),
    b("딸기 크림치즈", { cat: "식품", qty: 2 }),
    b("샴푸", { cat: "뷰티", created_by: "KM" }),
    b("슬링백, 힐", { cat: "옷·신발" }),
    b("라면기 그릇", { created_by: "KM" }),
    b("후쿠오카 곤약젤리", { place: "일본", cat: "식품" }),
    b("생리대", { cat: "생활", status: "got", done_by: "KM" }),
    c("국립중앙박물관", { place: "서울", cat: "할 것" }),
    c("잠실 피부과?", { place: "서울", cat: "예약" }),
    c("카리나 눈썹문신", { cat: "예약", status: "done", done_by: "MK", scheduled: "12/20" }),
    c("과천 리프트", { place: "과천", cat: "할 것" }),
    c("수안보 유원제 온천호텔", { place: "충주", cat: "할 것", link: "https://blog.naver.com/xxo_chive/224305196137" }),
    c("종찬 집들이", { cat: "사람", created_by: "KM" }),
    ...[["엄마", "마너 초콜릿", { qty: 2 }], ["엄마", "핸드크림", { status: "got", ordered_by: "MK" }], ["아버님", "슈납스", { created_by: "KM" }],
      ["어머님", "율리어스 마이늘 커피", { created_by: "KM", status: "got", ordered_by: "KM" }], [null, "모차르트쿠겔", { qty: 6 }], [null, "마너 웨하스", { qty: 4, created_by: "KM" }]]
      .map(([r, text, o]) => ({ id: uuid(), kind: "gift", recipient: r, text, place: "오스트리아", status: "todo", created_by: "MK", created_at: t(80), ...o })),
    { id: uuid(), kind: "bring", text: "엄마 김치", ship_to: "MK", note: "작은 통 두 개로", status: "todo", created_by: "MK", created_at: t(72) },
    { id: uuid(), kind: "bring", text: "어머님 멸치볶음", ship_to: "KM", status: "todo", created_by: "KM", created_at: t(71) },
    { id: uuid(), kind: "ref", text: "서울 인파레이더", link: "http://gjdong.vercel.app/crowd", topic: "외출·교통", status: "todo", created_by: "MK", created_at: t(70) },
    { id: uuid(), kind: "ref", text: "텍스리펀 방법", note: "공항 키오스크 → 세관 도장 → 환급 창구", topic: "쇼핑·텍스리펀", status: "todo", created_by: "MK", created_at: t(69) },
  ];
};
const DEMO_TRIPS = () => {
  const kr = { id: uuid(), name: "겨울 한국", place: "한국", start_date: "2026-12-18", end_date: "2027-01-06", people: ["MK", "KM"], parent_id: null, created_by: "MK", created_at: new Date().toISOString() };
  const jp = { id: uuid(), name: "일본", place: "일본", start_date: "2026-12-21", end_date: "2026-12-23", people: [], parent_id: kr.id, created_by: "MK", created_at: new Date().toISOString() };
  const ck = (t, list, done = []) => list.map((text, i) => ({ id: uuid(), trip_id: t.id, text, sort: i + 1, done: done.includes(i), done_by: done.includes(i) ? "KM" : null, created_by: "MK", created_at: new Date().toISOString() }));
  return { trips: [kr, jp], checks: [...ck(kr, TEMPLATE["한국"], [0]), ...ck(jp, TEMPLATE["일본"])] };
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
    items = DEMO_ITEMS(); ({ trips, checks } = DEMO_TRIPS());
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
  const [r1, r2, r3, r4] = await Promise.all([
    sb.from("bt_items").select("*").is("deleted_at", null).order("created_at"),
    sb.from("bt_settings").select("*").eq("key", "trip").maybeSingle(),
    sb.from("bt_trips").select("*").is("deleted_at", null).order("start_date"),
    sb.from("bt_checks").select("*").is("deleted_at", null).order("sort").order("created_at"),
  ]);
  if (r1.error) {
    toast(r1.error.code === "42P01" ? "표가 아직 없어요. migrations/001_bottari.sql을 실행해 주세요." : "불러오지 못했어요: " + r1.error.message);
    items = [];
  } else items = r1.data;
  trip = r2.data?.value ?? null;
  trips = r3.error ? [] : r3.data;   // 004_trips.sql 실행 전이면 빈 채로
  checks = r4.error ? [] : r4.data;
  render();
}
// 실시간: 표마다 받은 행을 해당 배열에 반영
const LIVE = { bt_items: () => items, bt_trips: () => trips, bt_checks: () => checks };
function applyLive(table, { eventType, new: row, old }) {
  const arr = LIVE[table]();
  const id = row?.id ?? old?.id;
  const i = arr.findIndex((x) => x.id === id);
  if (eventType === "DELETE" || row?.deleted_at) { if (i >= 0) arr.splice(i, 1); }
  else if (i >= 0) arr[i] = row;
  else arr.push(row);
  render();
  if (openTripId && table !== "bt_items") openTrip(openTripId, true);
}
function subscribe() {
  let ch = sb.channel("bt-live");
  for (const table of Object.keys(LIVE)) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, (p) => applyLive(table, p));
  ch.subscribe();
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
// 줄이 그어지는 상태: 살 것 = 받음, 후보 = 일정에 넣음, 선물 = 줌 (선물의 "샀음"은 아직 줄 안 그음)
const isStruck = (it) => it.kind === "ref" ? false : it.kind === "gift" ? it.status === "done" : (it.status === "got" || it.status === "done");

function host(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function itemHtml(it) {
  const meta = [];
  if (it.kind === "buy") {
    if (it.status === "ord" || (it.status === "got" && it.ship_to)) {
      const who = it.ordered_by ? NAME[it.ordered_by] + " 주문" : "주문함";
      meta.push(`<span>${I("package")}${esc([who, it.ship_to ? HOME[it.ship_to] + "로" : "", it.eta].filter(Boolean).join(" · "))}</span>`);
    }
    // 살 것 목록은 분류·장소로 묶이니, 묶이지 않는 주문함·받음에서만 장소를 붙임
    if (it.status !== "todo" && it.place && it.place !== "한국") meta.push(`<span class="tg">${esc(it.place)}</span>`);
  } else if (it.kind === "bring") {
    if (it.ship_to) meta.push(`<span>${I("home")}${HOME[it.ship_to]}에서</span>`);
  } else if (it.kind === "gift") {
    if (it.status === "got" || it.status === "done") meta.push(`<span class="bought">${I("check")}${it.ordered_by ? NAME[it.ordered_by] + "이 삼" : "샀음"}</span>`);
    if (it.place && it.place !== HOME_PLACE.gift) meta.push(`<span class="tg">${esc(it.place)}</span>`);
  } else if (it.kind === "cand") {
    if (it.cat) meta.push(`<span>${esc(it.cat)}</span>`);
    if (it.scheduled) meta.push(`<span>${I("cal")}${esc(it.scheduled)}</span>`);
  }
  // 찾기 결과에선 원래 묶음(받는 사람·주제·장소·분류)이 안 보이니 태그로 붙여 줌
  if (state.q.trim()) {
    const ctx = it.kind === "gift" ? (it.recipient || ANYONE) : it.kind === "ref" ? it.topic : it.kind === "buy" ? (it.place && it.place !== "한국" ? it.place : it.cat) : it.kind === "cand" ? it.place : null;
    if (ctx) meta.unshift(`<span class="tg">${esc(ctx)}</span>`);
    if (isStruck(it)) meta.unshift(`<span class="tg">${{ buy: "받음", cand: "일정에 넣음", gift: "줌", bring: "챙김" }[it.kind]}</span>`);
  }
  if (it.note) meta.push(`<span>${esc(it.note)}</span>`);
  if (it.link) meta.push(`<a href="${esc(it.link)}" target="_blank" rel="noopener">${I("link")}${esc(host(it.link))}</a>`);
  return `<div class="it ${it.created_by}${isStruck(it) ? " struck" : ""}${it.kind === "ref" ? " ref" : ""}${it.id === state.dragId ? " ghost" : ""}" data-id="${it.id}" role="button" tabindex="0">
    <div class="tx"><span class="nm">${esc(it.text)}${it.qty > 1 ? `<span class="qty">×${it.qty}</span>` : ""}${strikeSvg(it.done_by)}</span>
    ${meta.length ? `<div class="mt">${meta.join("")}</div>` : ""}</div>
    <button class="more" data-edit="${it.id}" aria-label="고치기">${I("more")}</button></div>`;
}
// 묶음 안 순서: sort(끌어서 정한 순서)가 있으면 그 순서, 없으면 적은 순서
const bySort = (list) => [...list].sort((a, b) => (a.sort ?? 1e15) - (b.sort ?? 1e15) || String(a.created_at).localeCompare(String(b.created_at)));
// 묶음 하나. g = 끌어 놓기 정보 { kind, k: 묶음 열쇠, set: 이 묶음으로 옮기면 바뀌는 칸 (null이면 안에서 순서만) }
// showEmpty = 끄는 중에는 빈 분류도 놓을 자리로 보여 줌
const sec = (label, list, g, showEmpty) => (list.length || showEmpty)
  ? `<div class="grp"${g ? ` data-g="${esc(JSON.stringify(g))}"` : ""}><div class="sec">${label} <small>${list.length || ""}</small></div>${list.length ? bySort(list).map(itemHtml).join("") : `<p class="drop-here">여기로 끌어 놓기</p>`}</div>`
  : "";
const fold = (key, label, list) => !list.length ? "" :
  `<button class="fold press${state.open[key] ? " open" : ""}" data-fold="${key}">${label} ${list.length}${I("down")}</button>${state.open[key] ? list.map(itemHtml).join("") : ""}`;

function render() {
  if (!me) return;
  const tab = state.tab;
  $("title").textContent = tab === "trip" ? "여행" : KIND[tab];
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("trip-btn").innerHTML = tripLabel();
  const searching = !!state.q.trim();
  $("add").hidden = tab === "trip" || searching;
  document.querySelector(".key").hidden = tab === "trip";
  $("hint").hidden = searching || !!state.hintsSeen[tab];
  $("hint-text").textContent = HINT[tab] || "";
  if (searching) { $("list").innerHTML = searchHtml(); return; }
  if (tab === "trip") { $("list").innerHTML = tripsHtml(); return; }
  const place = state.place[tab];
  $("add-place").innerHTML = tab === "ref" ? `${I("bookmark")}${esc(place || NOTOPIC)}` : `${I("pin")}${esc(place || NOPLACE)}`;
  $("add-text").placeholder = { buy: "살 것 한 줄", cand: "하고 싶은 것 한 줄", gift: "엄마: 마너 초콜릿", ref: "제목 + 링크 붙여넣기" }[tab];

  const mine = items.filter((x) => x.kind === tab);
  const keep = (x) => !isStruck(x) || recent.has(x.id);
  let html = "";
  if (tab === "buy") {
    const ord = mine.filter((x) => x.status === "ord" || (recent.has(x.id) && x.status === "got" && x.ship_to));
    const todo = mine.filter((x) => keep(x) && !ord.includes(x));
    const got = mine.filter((x) => x.status === "got" && !recent.has(x.id));
    // 한국에서 살 것은 분류별(식품·뷰티·…, 분류 안 한 건 맨 아래), 다른 곳(일본 등)은 장소별로 따로 — 목록이 섞이지 않게
    const here = todo.filter((x) => !x.place || x.place === "한국");
    const cats = [...BUY_CATS, NOCAT].map((c) => [c, here.filter((x) => (BUY_CATS.includes(x.cat) ? x.cat : NOCAT) === c)]);
    const away = new Map();
    for (const x of todo) if (x.place && x.place !== "한국") { if (!away.has(x.place)) away.set(x.place, []); away.get(x.place).push(x); }
    const dragBuy = items.find((x) => x.id === state.dragId)?.kind === "buy";
    html = !mine.length ? `<p class="empty">살 게 생기면 아래에 한 줄 적어요. 상대 화면에도 바로 떠요.</p>`
      : sec("주문함", ord, { kind: "buy", k: "ord", set: null })
      + cats.map(([c, l]) => sec(c, l, { kind: "buy", k: "c:" + c, set: { cat: c === NOCAT ? null : c, place: "한국" } }, dragBuy && c !== NOCAT)).join("")
      + [...away].map(([p, l]) => sec(`${esc(p)}에서`, l, { kind: "buy", k: "p:" + p, set: { place: p } })).join("") + fold("got", "받음", got);
    // 받아 올 것(어머님 반찬 등) — 사는 게 아니라 받아서 들고 오는 것. 귀국 전날 여기만 훑으면 됨
    const bring = items.filter((x) => x.kind === "bring");
    const bLive = bring.filter((x) => !isStruck(x) || recent.has(x.id));
    html += `<div class="grp" data-g="${esc(JSON.stringify({ kind: "bring", k: "bring", set: null }))}"><div class="sec">받아 올 것 <small>${bLive.length || ""}</small><button class="sec-add press" id="bring-add">+ 더하기</button></div>`
      + bySort(bLive).map(itemHtml).join("")
      + (bring.length ? "" : `<p class="empty sm">어머님 반찬처럼 받아서 들고 올 것을 적어요. 어느 집에서 받는지 남겨 두면 귀국 전날 여기만 보면 돼요.</p>`) + `</div>`
      + fold("packed", "챙긴 것", bring.filter((x) => x.status === "got" && !recent.has(x.id)));
  } else if (tab === "gift") {
    // 받는 사람별로 묶음(처음 적은 순서), 받는 사람 없는 건 맨 아래 "나눠 줄 것"
    const live = mine.filter(keep);
    const groups = new Map();
    for (const x of live) { const k = x.recipient || ANYONE; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const order = [...groups.keys()].filter((k) => k !== ANYONE);
    if (groups.has(ANYONE)) order.push(ANYONE);
    const notYet = mine.filter((x) => x.status === "todo").length, packed = mine.filter((x) => x.status === "got").length;
    html = (mine.length ? `<p class="summary">아직 안 산 것 <b>${notYet}</b> · 캐리어에 <b>${packed}</b></p>` : "")
      + order.map((k) => sec(esc(k), groups.get(k), { kind: "gift", k: "r:" + k, set: { recipient: k === ANYONE ? null : k } })).join("") + fold("given", "준 것", mine.filter((x) => x.status === "done" && !recent.has(x.id)));
    if (!mine.length) html = `<p class="empty">한국에 들고 갈 선물을 적어요. <b>엄마: 마너 초콜릿</b>처럼 앞에 받는 사람을 쓰면 사람별로 묶여요. 받는 사람 없이 쓰면 "나눠 줄 것"에 모여요.</p>`;
  } else if (tab === "ref") {
    // 주제별로 묶음(많은 주제 먼저), 주제 없는 건 맨 아래
    const groups = new Map();
    for (const x of mine) { const k = x.topic || NOTOPIC; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const order = [...groups.keys()].filter((k) => k !== NOTOPIC).sort((a, b) => groups.get(b).length - groups.get(a).length);
    if (groups.has(NOTOPIC)) order.push(NOTOPIC);
    html = order.map((k) => sec(esc(k), groups.get(k), { kind: "ref", k: "t:" + k, set: { topic: k === NOTOPIC ? null : k } })).join("");
    if (!mine.length) html = `<p class="empty">휴가 때마다 다시 여는 것을 모아 둬요. 텍스리펀 방법, 서울 인파레이더처럼요. 링크를 붙여넣거나 <b>제목 https://…</b>처럼 쓰면 제목과 링크가 나뉘어 들어가요. 줄은 안 그어지고 계속 남아요.</p>`;
  } else {
    const live = mine.filter(keep);
    const groups = new Map();
    for (const x of live) { const k = x.place || NOPLACE; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const order = [...groups.keys()].filter((k) => k !== NOPLACE).sort((a, b) => groups.get(b).length - groups.get(a).length);
    if (groups.has(NOPLACE)) order.push(NOPLACE);
    html = order.map((k) => sec(esc(k), groups.get(k), { kind: "cand", k: "p:" + k, set: { place: k === NOPLACE ? null : k } })).join("") + fold("done", "일정에 넣은 것", mine.filter((x) => x.status === "done" && !recent.has(x.id)));
    if (!mine.length) html = `<p class="empty">하고 싶은 것·먹고 싶은 것·만날 사람이 생각나면 한 줄 적어요. 장소는 나중에 붙여도 돼요.</p>`;
  }
  $("list").innerHTML = html;
}
// ───────────────────────────── 찾기: 살 것·받아 올 것·후보·선물·참고를 한꺼번에
// 띄어쓰기·대소문자 무시. 입력창은 다시 그리지 않고 목록만 다시 그림 (한글 조합이 끊기지 않게 — Mealcat에서 겪은 문제)
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "");
function searchHtml() {
  const q = norm(state.q);
  const hit = (x) => [x.text, x.note, x.recipient, x.topic, x.place, x.cat, x.link, x.ship_to && HOME[x.ship_to]].some((f) => norm(f).includes(q));
  const found = items.filter(hit);
  if (!found.length) return `<p class="empty">"${esc(state.q.trim())}"와 맞는 게 없어요. 다른 낱말로 찾아보거나, 없으면 아래 탭에서 바로 적어요.</p>`;
  return ["buy", "bring", "cand", "gift", "ref"].map((k) => sec(KIND[k], found.filter((x) => x.kind === k))).join("");
}
function openSearch() {
  $("search").hidden = false;
  $("q").focus();
}
function closeSearch() {
  state.q = ""; $("q").value = ""; $("search").hidden = true; render();
}
$("search-btn").addEventListener("click", () => ($("search").hidden ? openSearch() : closeSearch()));
$("q-close").addEventListener("click", closeSearch);
$("q").addEventListener("input", () => { state.q = $("q").value; $("scr").scrollTop = 0; render(); });
$("q").addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); if (e.key === "Enter" && !e.isComposing) $("q").blur(); });

// ───────────────────────────── 날짜
const today = () => new Date(new Date().toDateString());
const day = (s) => new Date(s + "T00:00:00");
const dayDiff = (a, b) => Math.round((a - b) / 864e5);
const md = (s) => { const d = day(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const span = (t) => `${md(t.start_date)} – ${md(t.end_date)} · ${dayDiff(day(t.end_date), day(t.start_date)) + 1}일`;

// 머리말: 지금 하고 있는 큰 여행(N일째) → 다음 큰 여행(D-n) → 예전 "다음 출발" 설정
function tripLabel() {
  const top = trips.filter((t) => !t.parent_id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const now = today();
  const cur = top.find((t) => day(t.start_date) <= now && now <= day(t.end_date));
  if (cur) return `${esc(cur.name)} · ${dayDiff(now, day(cur.start_date)) + 1}일째`;
  const next = top.find((t) => day(t.start_date) > now);
  if (next) return `${esc(next.name)} · D-${dayDiff(day(next.start_date), now)}`;
  if (trip?.date && day(trip.date) >= now) return `${esc(trip.name || "다음 출발")} · D-${dayDiff(day(trip.date), now)}`;
  return `${I("plane")}여행 정하기`;
}

// ───────────────────────────── 누르기: 긋기 / 고치기 / 접기
$("list").addEventListener("click", (e) => {
  if (performance.now() - dragEndedAt < 500) { e.preventDefault(); return; } // 끌기를 마친 손가락이 "누르기"로 읽히지 않게
  if (e.target.closest("a")) return;
  const tc = e.target.closest("[data-trip]");
  if (tc) return openTrip(tc.dataset.trip);
  if (e.target.closest("#trip-new")) return openTripForm(null);
  if (e.target.closest("#bring-add")) return openBringForm();
  if (e.target.closest("#logout")) return sb.auth.signOut().then(() => location.reload());
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

// ───────────────────────────── 꾹 눌러 끌기: 다른 묶음에 놓으면 분류·장소·받는 사람·주제가 바뀌고, 같은 묶음이면 순서만
// 그냥 누르기(줄 긋기)·쓸어 올리기(스크롤)와 겹치지 않게 0.4초 꾹 눌러야 들림. 그 전에 8px 넘게 움직이면 스크롤로 봄
const LONG_PRESS = 400;
let press = null, drag = null, dragEndedAt = 0;
const gOf = (el) => { try { return JSON.parse(el.closest(".grp")?.dataset.g || "null"); } catch { return null; } };
$("list").addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const row = e.target.closest(".it");
  if (!row || e.target.closest(".more, a") || !gOf(row) || state.q.trim()) return;
  press = { id: row.dataset.id, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", timer: setTimeout(startDrag, LONG_PRESS) };
});
$("list").addEventListener("contextmenu", (e) => { if (press || drag) e.preventDefault(); }); // 길게 누르기 메뉴 막기
const follow = (x, y) => {
  if (drag) { drag.x = x; drag.y = y; return moveDrag(); }
  if (press && Math.hypot(x - press.x, y - press.y) > 8) cancelPress();
  else if (press) { press.x = x; press.y = y; }
};
// 마우스(PC)는 포인터 신호로
document.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") follow(e.clientX, e.clientY); });
document.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") return; if (drag) endDrag(true); else cancelPress(); });
// 손가락(아이폰)은 터치 신호로 — iOS는 끄는 중 포인터 신호를 중간에 끊어(pointercancel) 버리는 일이 있어서 터치 신호가 더 믿을 만함.
// 끄는 동안엔 화면이 따라 스크롤되지 않게 막음 (iOS는 passive: false여야 막힘)
document.addEventListener("touchmove", (e) => {
  const t = e.touches[0]; if (!t) return;
  if (drag) e.preventDefault();
  follow(t.clientX, t.clientY);
}, { passive: false });
document.addEventListener("touchend", () => { if (drag) endDrag(true); else cancelPress(); });
document.addEventListener("touchcancel", () => { if (drag) endDrag(false); else cancelPress(); });
document.addEventListener("pointercancel", (e) => { if (e.pointerType === "mouse") { if (drag) endDrag(false); else cancelPress(); } else if (!drag) cancelPress(); });
document.addEventListener("keydown", (e) => { if (drag && e.key === "Escape") endDrag(false); });
function cancelPress() { if (press) { clearTimeout(press.timer); press = null; } }
// 받침 따라 "로/으로" (받침 없음·ㄹ받침 → 로): 서울로, 식품으로, 엄마로
function ro(w) {
  const c = String(w).trim().slice(-1).charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return "로";
  const jong = c % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

function startDrag() {
  const it = items.find((x) => x.id === press?.id);
  if (!it) return cancelPress();
  const old = $("list").querySelector(`.it[data-id="${it.id}"]`);
  const r = old.getBoundingClientRect();
  drag = { it, src: gOf(old), x: press.x, y: press.y, offY: press.y - r.top, target: null };
  press = null;
  const clone = old.cloneNode(true);
  state.dragId = it.id; render(); // 살 것은 빈 분류도 놓을 자리로 보임
  // 손가락 아래 있던 원래 항목을 새로 그린 자리에 다시 끼워 넣음 — 이걸 버리면 아이폰은 이후 터치 신호를
  // 문서에서 떨어져 나간 옛 항목에만 보내서 끌기가 따라오지 않음 (v1.8에서 실제로 겪은 문제)
  $("list").querySelector(`.it[data-id="${it.id}"]`)?.replaceWith(old);
  old.classList.add("ghost");
  clone.classList.remove("ghost"); clone.classList.add("drag-clone");
  clone.style.left = r.left + "px"; clone.style.width = r.width + "px";
  document.body.append(clone);
  const line = document.createElement("div"); line.className = "drop-line"; line.hidden = true;
  document.body.append(line);
  Object.assign(drag, { clone, line });
  document.body.classList.add("dragging");
  moveDrag();
  (function scrollLoop() { // 손가락이 화면 위·아래 끝에 가면 저절로 스크롤
    if (!drag) return;
    const s = $("scr"), sr = s.getBoundingClientRect(), edge = 70;
    const v = drag.y < sr.top + edge ? -(sr.top + edge - drag.y) / 4 : drag.y > sr.bottom - edge ? (drag.y - (sr.bottom - edge)) / 4 : 0;
    if (v) { s.scrollTop += v; moveDrag(); }
    requestAnimationFrame(scrollLoop);
  })();
}
function moveDrag() {
  const { clone, line, y, it, src } = drag;
  clone.style.top = (y - drag.offY) + "px";
  // 손가락 아래 묶음 찾기 (끄는 사본은 pointer-events: none)
  const under = document.elementFromPoint(Math.min(Math.max(drag.x, 30), innerWidth - 30), y);
  const grpEl = under?.closest("#list .grp[data-g]");
  document.querySelectorAll("#list .grp.over, #list .grp.nope").forEach((g) => g.classList.remove("over", "nope"));
  if (!grpEl) { line.hidden = true; drag.target = null; return; }
  const g = gOf(grpEl);
  const ok = g.kind === it.kind && (g.k === src.k || g.set);
  grpEl.classList.add(ok ? "over" : "nope");
  if (!ok) { line.hidden = true; drag.target = null; return; }
  const rows = [...grpEl.querySelectorAll(".it:not(.ghost)")];
  let idx = rows.findIndex((rw) => { const b = rw.getBoundingClientRect(); return y < b.top + b.height / 2; });
  if (idx < 0) idx = rows.length;
  const ref = rows[idx]?.getBoundingClientRect() ?? (rows.length ? rows[rows.length - 1].getBoundingClientRect() : grpEl.querySelector(".sec").getBoundingClientRect());
  const ly = rows[idx] ? ref.top : ref.bottom;
  const gr = grpEl.getBoundingClientRect();
  Object.assign(line.style, { top: ly - 1 + "px", left: gr.left + "px", width: gr.width + "px" });
  line.hidden = false;
  drag.target = { g, ids: rows.map((rw) => rw.dataset.id), idx };
}
async function endDrag(commit) {
  if (!drag) return; // 터치·포인터 신호가 둘 다 올 수 있어서 한 번만 끝냄
  const d = drag; drag = null; dragEndedAt = performance.now();
  d.clone.remove(); d.line.remove();
  document.body.classList.remove("dragging");
  state.dragId = null;
  const t = d.target;
  if (!commit || !t) return render();
  const it = d.it, moved = t.g.k !== d.src.k;
  const ids = [...t.ids]; ids.splice(t.idx, 0, it.id);
  const before = { sort: it.sort ?? null, ...(moved ? Object.fromEntries(Object.keys(t.g.set).map((k) => [k, it[k] ?? null])) : {}) };
  // 놓은 묶음 안 순서를 10, 20, 30…으로 다시 매김 — 바뀐 것만 저장
  const changes = [];
  ids.forEach((id, i) => {
    const x = items.find((y) => y.id === id); if (!x) return;
    const f = {};
    if (x.sort !== (i + 1) * 10) f.sort = (i + 1) * 10;
    if (x === it && moved) Object.assign(f, t.g.set);
    if (Object.keys(f).length) { Object.assign(x, f); changes.push([x, f]); }
  });
  render();
  if (moved) {
    const label = t.g.k.slice(t.g.k.indexOf(":") + 1);
    toast(`${label}${ro(label)} 옮겼어요`, undo(it, before));
  }
  const results = await Promise.all(changes.map(([x, f]) => sb.from("bt_items").update(f).eq("id", x.id)));
  const err = results.find((r) => r.error)?.error;
  if (err) { toast(err.message.includes("sort") ? "007_sort.sql을 먼저 실행해 주세요." : "옮기지 못했어요: " + err.message); refresh(); }
}

async function toggle(it, row) {
  if (!it) return;
  // 참고: 누르면 링크를 엶 (링크 없으면 고치기)
  if (it.kind === "ref") return it.link ? window.open(/^https?:/i.test(it.link) ? it.link : "https://" + it.link, "_blank", "noopener") : openEdit(it);
  if (it.kind === "gift") return giftStep(it, row);
  const on = !isStruck(it);
  const next = on ? (it.kind === "cand" ? "done" : "got") : (it.kind === "buy" && it.ordered_by ? "ord" : "todo");
  const before = { status: it.status, done_by: it.done_by ?? null, done_at: it.done_at ?? null };
  recent.add(it.id);
  // 줄을 그 자리에서 먼저 긋고(0.22초), DB 반영 후 다시 그림
  const svg = row.querySelector(".strike");
  svg.setAttribute("class", "strike by-" + me.member_code);
  row.classList.toggle("struck", on);
  await new Promise((r) => setTimeout(r, 240));
  if (await patch(it, { status: next, done_by: on ? me.member_code : null, done_at: on ? new Date().toISOString() : null }))
    toast(on ? `${{ buy: "샀음", cand: "일정에 넣음", bring: "챙김" }[it.kind]} — ${it.text}` : "되돌렸어요", undo(it, before));
}
// 방금 바꾼 걸 원래대로 — 안내 띠의 "되돌리기" 버튼 (탭을 옮기거나 접힌 뒤에도 바로 되돌릴 수 있게)
const undo = (it, before) => ({ label: "되돌리기", fn: () => { recent.add(it.id); prevSt.delete(it.id); patch(it, before); } });

// 선물: 누를 때마다 한 단계 — 살 것 → 샀음(캐리어) → 줌(줄 그음). 이번에 넘긴 걸 다시 누르면 되돌림
async function giftStep(it, row) {
  let next;
  const before = { status: it.status, ordered_by: it.ordered_by ?? null, done_by: it.done_by ?? null, done_at: it.done_at ?? null };
  if (prevSt.has(it.id)) { next = prevSt.get(it.id); prevSt.delete(it.id); }
  else { next = it.status === "todo" ? "got" : it.status === "got" ? "done" : "got"; prevSt.set(it.id, it.status); }
  recent.add(it.id);
  const fields = { status: next };
  if (next === "got" && !it.ordered_by) fields.ordered_by = me.member_code;
  if (next === "todo") fields.ordered_by = null;
  fields.done_by = next === "done" ? me.member_code : null;
  fields.done_at = next === "done" ? new Date().toISOString() : null;
  if (next === "done" || it.status === "done") {
    row.querySelector(".strike").setAttribute("class", "strike by-" + me.member_code);
    row.classList.toggle("struck", next === "done");
    await new Promise((r) => setTimeout(r, 240));
  }
  const forward = (before.status === "todo" && next === "got") || (before.status === "got" && next === "done");
  if (await patch(it, fields))
    toast(forward ? `${next === "got" ? "샀음" : "줌"} — ${it.text}` : `${{ todo: "살 것", got: "샀음", done: "줌" }[next]}으로 되돌렸어요`, forward ? undo(it, before) : null);
}

function goTab(t) {
  state.tab = t; save("bt.tab", t); recent.clear(); prevSt.clear(); $("scr").scrollTop = 0;
  if (state.q || !$("search").hidden) { state.q = ""; $("q").value = ""; $("search").hidden = true; } // 탭을 누르면 찾기는 닫음
  render();
}
$("hint-x").addEventListener("click", () => { state.hintsSeen[state.tab] = true; save("bt.hints2", state.hintsSeen); render(); });

// ───────────────────────────── 옆으로 쓸어 탭 넘기기 (살 것 ↔ 후보 ↔ 선물 ↔ 참고 ↔ 여행)
// 옆으로 확실히(세로보다 1.4배 넘게) 움직일 때만. 위아래 스크롤·꾹 눌러 끌기·시트·찾기 중엔 안 함.
// 화면 가장자리 24px에서 시작한 쓸기는 사파리 "뒤로 가기" 몫이라 무시
const TAB_ORDER = ["buy", "cand", "gift", "ref", "trip"];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let sw = null;
function swipeReset(animate) {
  const l = $("list");
  l.style.transition = animate && !reduceMotion.matches ? "transform 200ms var(--ease), opacity 200ms ease" : "none";
  l.style.transform = ""; l.style.opacity = "";
}
$("scr").addEventListener("touchstart", (e) => {
  sw = null;
  if (e.touches.length !== 1 || !$("sheet").hidden || state.q.trim()) return;
  const t = e.touches[0];
  if (t.clientX < 24 || t.clientX > innerWidth - 24) return;
  sw = { x: t.clientX, y: t.clientY, t: performance.now(), dir: null, dx: 0 };
}, { passive: true });
$("scr").addEventListener("touchmove", (e) => {
  if (!sw) return;
  if (drag) { sw = null; return swipeReset(false); }
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.dir) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    sw.dir = Math.abs(dx) > Math.abs(dy) * 1.4 ? "h" : "v";
    if (sw.dir === "h") cancelPress(); // 옆으로 쓰는 중엔 꾹 누르기로 안 봄
  }
  if (sw.dir !== "h") return;
  e.preventDefault(); // 쓰는 동안 위아래로 흔들리지 않게
  const i = TAB_ORDER.indexOf(state.tab);
  sw.edge = (dx > 0 && i === 0) || (dx < 0 && i === TAB_ORDER.length - 1);
  sw.dx = dx;
  const l = $("list");
  l.style.transition = "none";
  l.style.transform = `translateX(${sw.edge ? dx / 5 : dx * 0.5}px)`; // 맨 끝 탭에선 살짝만 끌려옴
  l.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.35));
}, { passive: false });
$("scr").addEventListener("touchend", () => {
  const s = sw; sw = null;
  if (!s || s.dir !== "h") return;
  const v = Math.abs(s.dx) / Math.max(1, performance.now() - s.t);
  const go = !s.edge && (Math.abs(s.dx) > 70 || (Math.abs(s.dx) > 30 && v > 0.4));
  if (!go) return swipeReset(true);
  const dir = s.dx < 0 ? 1 : -1; // 왼쪽으로 쓸면 다음 탭
  const next = TAB_ORDER[TAB_ORDER.indexOf(state.tab) + dir];
  dragEndedAt = performance.now(); // 손을 뗀 자리의 항목이 "누르기"로 읽히지 않게
  const l = $("list");
  if (reduceMotion.matches) { goTab(next); return swipeReset(false); }
  l.style.transition = "transform 140ms ease-in, opacity 140ms ease-in";
  l.style.transform = `translateX(${-dir * 40}%)`; l.style.opacity = "0";
  setTimeout(() => {
    goTab(next);
    l.style.transition = "none";
    l.style.transform = `translateX(${dir * 30}%)`; l.style.opacity = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => swipeReset(true)));
  }, 140);
});
$("scr").addEventListener("touchcancel", () => { if (sw?.dir === "h") swipeReset(true); sw = null; });
$("trip-btn").addEventListener("click", () => goTab("trip"));
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]"); if (b) goTab(b.dataset.tab);
});

// ───────────────────────────── 적기
function parseQty(s) {
  const m = s.match(/^(.*?)\s*(?:[x×X]\s*(\d{1,2})|(\d{1,2})\s*개)\s*$/);
  return m && m[1].trim() ? { text: m[1].trim(), qty: +(m[2] || m[3]) } : { text: s, qty: null };
}
$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("add-text").value.trim(); if (!raw) return;
  // 선물은 "받는 사람: 선물" 형식이면 받는 사람을 떼어 냄
  let recipient = null, body = raw;
  const rm = state.tab === "gift" && raw.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
  if (rm) { recipient = rm[1].trim(); body = rm[2].trim(); }
  let row;
  if (state.tab === "ref") {
    // 참고: 글 안의 링크를 떼어 냄. 제목이 없으면 주소(도메인)를 제목으로
    const um = raw.match(URL_RE);
    const link = um ? um[1] : null;
    const title = (link ? raw.replace(link, "") : raw).trim().replace(/[\s:–—-]+$/, "");
    row = { id: uuid(), kind: "ref", text: title || host(/^https?:/i.test(link) ? link : "https://" + link), link, topic: state.place.ref || null,
      status: "todo", created_by: me.member_code, created_at: new Date().toISOString() };
  } else {
    const { text, qty } = parseQty(body);
    row = { id: uuid(), kind: state.tab, text, qty: qty > 1 ? qty : null, place: state.place[state.tab] || null,
      status: "todo", created_by: me.member_code, created_at: new Date().toISOString(), ...(state.tab === "gift" ? { recipient } : {}) };
  }
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
  const key = kind === "ref" ? "topic" : "place"; // 참고는 장소 대신 주제
  for (const x of items) if (x.kind === kind && x[key]) n.set(x[key], (n.get(x[key]) || 0) + 1);
  if (kind === "ref") for (const h of TOPIC_HINTS) if (!n.has(h)) n.set(h, 0);
  if (HOME_PLACE[kind] && !n.has(HOME_PLACE[kind])) n.set(HOME_PLACE[kind], 0);
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a));
}
function openPlacePicker() {
  const tab = state.tab, cur = state.place[tab];
  const ref = tab === "ref", none = ref ? NOTOPIC : NOPLACE;
  const list = [...placesOf(tab), ...(tab === "cand" || ref ? [none] : [])];
  openSheet(`<div class="sh-title">${ref ? "어떤 주제?" : "어디서?"}</div>
    <div class="place-list seg">${list.map((p) => `<button class="press${(cur || none) === p ? " on" : ""}" data-place="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <label class="fld">${ref ? "새 주제" : "새 장소"}<input id="new-place" placeholder="${ref ? "예: 공항, 통신" : "예: 부산, 후쿠오카"}" enterkeyhint="done"></label>
    <div class="sh-actions"><button class="btn-primary press" id="place-ok">${ref ? "새 주제로 적기" : "새 장소로 적기"}</button></div>`);
  const pick = (p) => { state.place[tab] = p === none ? null : p; save("bt.place", state.place); closeSheet(); render(); $("add-text").focus(); };
  $("sheet").querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.place)));
  const ok = () => { const v = $("new-place").value.trim(); if (v) pick(v); };
  $("place-ok").addEventListener("click", ok);
  $("new-place").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } });
}

// ───────────────────────────── 받아 올 것 더하기 (살 것 탭 맨 아래 "+ 더하기")
function openBringForm() {
  let from = load("bt.bringFrom", me.member_code); // 마지막에 고른 집을 기억 — 한 집에서 여러 개 받을 때 덜 누르게
  const draw = () => openSheet(`<div class="sh-title">받아 올 것</div>
    <label class="fld">무엇을<input class="big" id="b-text" placeholder="예: 엄마 김치, 어머님 멸치볶음" enterkeyhint="done"></label>
    <div class="fld">어느 집에서<div class="seg">${["MK", "KM"].map((c) => `<button class="${c}${from === c ? " on" : ""}" data-from="${c}">${HOME[c]}</button>`).join("")}</div></div>
    <label class="fld">메모<input id="b-note" placeholder="예: 작은 통 두 개로, 냉동"></label>
    <div class="sh-actions"><button class="btn-primary press" id="b-save">적기</button></div>
    <p class="sh-meta">귀국 전날 살 것 탭 맨 아래 "받아 올 것"만 훑으면 돼요. 챙긴 건 눌러서 줄을 그어요.</p>`);
  draw();
  const wire = () => {
    $("sheet").querySelectorAll("[data-from]").forEach((b) => b.addEventListener("click", () => {
      from = b.dataset.from; save("bt.bringFrom", from);
      $("sheet").querySelectorAll("[data-from]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    const go = async () => {
      const raw = $("b-text").value.trim(); if (!raw) return toast("무엇을 받아 올지 적어 주세요.");
      const { text, qty } = parseQty(raw);
      const row = { id: uuid(), kind: "bring", text, qty: qty > 1 ? qty : null, ship_to: from, note: $("b-note").value.trim() || null, place: "한국",
        status: "todo", created_by: me.member_code, created_at: new Date().toISOString() };
      items.push(row); render();
      $("b-text").value = ""; $("b-note").value = ""; $("b-text").focus(); // 이어서 하나 더 적을 수 있게 시트는 열어 둠
      toast(`적었어요 — ${text}`);
      const { error } = await sb.from("bt_items").insert(row);
      if (error) { items = items.filter((x) => x.id !== row.id); render(); toast(error.message.includes("kind_check") ? "006_bring.sql을 먼저 실행해 주세요." : "적지 못했어요: " + error.message); }
    };
    $("b-save").addEventListener("click", go);
    $("b-text").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); go(); } });
  };
  wire();
  setTimeout(() => $("b-text")?.focus(), 320);
}

// ───────────────────────────── 고치기 시트
function openEdit(it) {
  if (!it) return;
  const d = { ...it };
  const kind = it.kind, buy = kind === "buy", gift = kind === "gift", ref = kind === "ref", bring = kind === "bring";
  const stepper = () => `<div class="fld">수량<div class="stepper"><button data-q="-1" aria-label="하나 빼기">−</button><span id="e-qty">${d.qty || 1}</span><button data-q="1" aria-label="하나 더">+</button></div></div>`;
  const stSeg = (opts) => `<div class="fld">상태<div class="seg" id="e-st">
        ${opts.map(([v, l]) => `<button class="${d.status === v ? "on" : ""}" data-st="${v}">${l}</button>`).join("")}</div></div>`;
  const recipients = () => [...new Set(items.filter((x) => x.kind === "gift" && x.recipient).map((x) => x.recipient))];
  const draw = () => {
    openSheet(`<div class="sh-title">${KIND[kind]} 고치기</div>
      ${gift ? `<label class="fld">받는 사람<input id="e-rcp" value="${esc(d.recipient)}" list="e-rcps" placeholder="비우면 나눠 줄 것"><datalist id="e-rcps">${recipients().map((r) => `<option value="${esc(r)}">`).join("")}</datalist></label>` : ""}
      <label class="fld">${gift ? "선물" : ref ? "제목" : "이름"}<input class="big" id="e-text" value="${esc(d.text)}"></label>
      ${buy ? `
      <div class="fld">분류<div class="seg" id="e-cat">
        ${BUY_CATS.map((c) => `<button class="${d.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div></div>
      ${stepper()}
      ${stSeg([["todo", "살 것"], ["ord", "주문함"], ["got", "받음"]])}
      ${d.status === "ord" || d.ship_to ? `
      <div class="fld">받는 곳<div class="seg" id="e-ship">
        ${["MK", "KM"].map((c) => `<button class="${c}${d.ship_to === c ? " on" : ""}" data-ship="${c}">${HOME[c]}</button>`).join("")}</div></div>
      <label class="fld">도착 예정<input id="e-eta" value="${esc(d.eta)}" placeholder="예: 12/12, 블프 배송"></label>` : ""}
      ` : gift ? `
      ${stepper()}
      ${stSeg([["todo", "살 것"], ["got", "샀음 · 캐리어"], ["done", "줌"]])}
      ` : bring ? `
      <div class="fld">어느 집에서<div class="seg" id="e-ship">
        ${["MK", "KM"].map((c) => `<button class="${c}${d.ship_to === c ? " on" : ""}" data-ship="${c}">${HOME[c]}</button>`).join("")}</div></div>
      ${stepper()}
      ${stSeg([["todo", "받을 것"], ["got", "챙김"]])}
      ` : kind === "cand" ? `
      <div class="fld">종류<div class="seg" id="e-cat">
        ${CATS.map((c) => `<button class="${d.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div></div>
      <label class="fld">일정 날짜<input id="e-sch" value="${esc(d.scheduled)}" placeholder="캘린더에 옮겼으면 날짜 (예: 12/20)"></label>
      ` : ""}
      ${ref ? `<label class="fld">주제<input id="e-place" value="${esc(d.topic)}" list="e-places" placeholder="비우면 주제 없음"><datalist id="e-places">${placesOf(kind).map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>`
        : bring ? `<input type="hidden" id="e-place" value="${esc(d.place)}">`
        : `<label class="fld">${gift ? "사는 곳" : "장소"}<input id="e-place" value="${esc(d.place)}" list="e-places" placeholder="${HOME_PLACE[kind] || "비우면 미분류"}"><datalist id="e-places">${placesOf(kind).map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>`}
      <label class="fld">메모<textarea id="e-note" placeholder="${gift ? "예: 빌라 매장, 공항 면세점" : bring ? "예: 작은 통 두 개로, 냉동" : "예: 텍스리펀, 코트용"}">${esc(d.note)}</textarea></label>
      <label class="fld">링크<input id="e-link" type="url" inputmode="url" value="${esc(d.link)}" placeholder="https://"></label>
      <div class="fld">옮기기<div class="seg">${Object.keys(KIND).filter((k) => k !== kind).map((k) => `<button class="press" data-move="${k}">${TO[k]}</button>`).join("")}</div></div>
      <div class="sh-actions">
        <button class="btn-ghost danger press" id="e-del">지우기</button>
        <button class="btn-primary press" id="e-save">저장</button>
      </div>
      <p class="sh-meta">${NAME[it.created_by]}이 적음 · ${new Date(it.created_at).toLocaleDateString("ko-KR")}${it.done_by ? ` · ${NAME[it.done_by]}이 그음` : ""}</p>`);
    const sh = $("sheet");
    const grab = () => { // 다시 그리기 전에 입력값 보존
      d.text = $("e-text").value; d.note = $("e-note").value; d.link = $("e-link").value;
      if (ref) d.topic = $("e-place").value; else d.place = $("e-place").value;
      if ($("e-eta")) d.eta = $("e-eta").value;
      if ($("e-sch")) d.scheduled = $("e-sch").value;
      if ($("e-rcp")) d.recipient = $("e-rcp").value;
    };
    sh.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { d.qty = Math.max(1, (d.qty || 1) + +b.dataset.q); $("e-qty").textContent = d.qty; }));
    sh.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => {
      grab(); d.status = b.dataset.st;
      if (buy) {
        if (d.status === "ord" && !d.ordered_by) d.ordered_by = me.member_code;
        if (d.status === "ord" && !d.ship_to) d.ship_to = me.member_code;
        if (d.status === "todo") { d.ordered_by = null; d.ship_to = null; d.eta = null; }
      } else {
        if (d.status !== "todo" && !d.ordered_by) d.ordered_by = me.member_code;
        if (d.status === "todo") d.ordered_by = null;
      }
      draw();
    }));
    sh.querySelectorAll("[data-ship]").forEach((b) => b.addEventListener("click", () => { grab(); d.ship_to = b.dataset.ship; draw(); }));
    sh.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { grab(); d.cat = d.cat === b.dataset.cat ? null : b.dataset.cat; draw(); }));
    $("e-save").addEventListener("click", async () => {
      grab();
      const text = d.text.trim(); if (!text) return toast(gift ? "선물을 적어 주세요." : "이름을 적어 주세요.");
      const wasStruck = isStruck(it), nowStruck = isStruck({ ...it, status: d.status });
      const fields = {
        text, note: d.note.trim() || null, link: d.link.trim() || null,
        ...(ref ? { topic: d.topic?.trim() || null } : { place: d.place?.trim() || null }),
        ...(buy ? { cat: d.cat || null, qty: d.qty > 1 ? d.qty : null, status: d.status, ordered_by: d.ordered_by || null, ship_to: d.ship_to || null, eta: d.eta?.trim() || null }
          : gift ? { qty: d.qty > 1 ? d.qty : null, status: d.status, ordered_by: d.ordered_by || null, recipient: d.recipient?.trim() || null }
          : bring ? { qty: d.qty > 1 ? d.qty : null, status: d.status, ship_to: d.ship_to || null }
          : ref ? {}
          : { cat: d.cat || null, scheduled: d.scheduled?.trim() || null }),
        ...(wasStruck !== nowStruck ? { done_by: nowStruck ? me.member_code : null, done_at: nowStruck ? new Date().toISOString() : null } : {}),
      };
      closeSheet();
      if (await patch(it, fields)) toast("저장했어요.");
    });
    sh.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", async () => {
      closeSheet();
      const to = b.dataset.move;
      // 분류 목록이 탭마다 달라서(후보 종류 ≠ 살 것 분류) 옮길 때 비움
      if (await patch(it, { kind: to, status: "todo", cat: null, topic: null, ordered_by: null, ship_to: null, eta: null, done_by: null, done_at: null, place: HOME_PLACE[to] }))
        toast(`${TO[to]} 옮겼어요.`);
    }));
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

// ───────────────────────────── 여행 탭: 여행 목록 → 여행 시트(사람 · 준비 체크리스트 · 이 장소 항목)
const peopleHtml = (ppl) => ppl?.length
  ? ppl.map((p) => NAME[p] ? `<span class="pp ${p}">${NAME[p]}</span>` : `<span class="pp">${esc(p)}</span>`).join(" · ")
  : `<span class="pp none">같이 갈 사람 정하기</span>`;
const checksOf = (id) => checks.filter((c) => c.trip_id === id).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
// 여행 장소와 같은 장소로 적은 살 것·후보 (한국 여행이면 장소 없는 후보도 포함)
function linked(t) {
  const same = (x) => x.place === t.place || (t.place === "한국" && x.kind === "cand" && !x.place);
  return {
    buy: items.filter((x) => x.kind === "buy" && x.status !== "got" && same(x)).length,
    cand: items.filter((x) => x.kind === "cand" && x.status !== "done" && same(x)).length,
  };
}
function tripCard(t, child) {
  const cs = checksOf(t.id), done = cs.filter((c) => c.done).length;
  const now = today(), s = day(t.start_date), e = day(t.end_date);
  const when = now < s ? `D-${dayDiff(s, now)}` : now <= e ? `${dayDiff(now, s) + 1}일째` : "다녀옴";
  return `<button class="trip-card press${child ? " child" : ""}" data-trip="${t.id}">
    <span class="tc-top"><span class="tc-name">${esc(t.name)}</span><span class="tc-when">${when}</span></span>
    <span class="tc-meta">${span(t)}${t.place ? ` · ${esc(t.place)}` : ""}</span>
    <span class="tc-meta">${peopleHtml(t.people)}</span>
    ${cs.length ? `<span class="tc-bar"><i style="width:${Math.round((done / cs.length) * 100)}%"></i></span><span class="tc-meta">준비 ${done}/${cs.length}</span>` : ""}
  </button>`;
}
function tripsHtml() {
  const now = today();
  const top = trips.filter((t) => !t.parent_id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const kids = (p) => trips.filter((t) => t.parent_id === p.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const block = (t) => tripCard(t, false) + kids(t).map((k) => tripCard(k, true)).join("");
  const live = top.filter((t) => day(t.end_date) >= now), past = top.filter((t) => day(t.end_date) < now).reverse();
  return (trips.length ? live.map(block).join("") : `<p class="empty">여행을 만들면 날짜·같이 가는 사람·준비 체크리스트를 한곳에서 봐요. 한국 휴가 안의 일본 여행처럼 큰 여행 안에 넣을 수도 있어요.</p>`)
    + `<button class="trip-add press" id="trip-new">${I("plane")}새 여행</button>`
    + (past.length ? `<div class="sec">지난 여행 <small>${past.length}</small></div>${past.map(block).join("")}` : "")
    + `<p class="sh-meta foot">${NAME[me.member_code]}으로 로그인 · Bottari v${VERSION} · <button class="linkish" id="logout">로그아웃</button></p>`;
}

let openTripId = null;
function openTrip(id, refreshOnly = false) {
  const t = trips.find((x) => x.id === id);
  if (!t) { if (openTripId === id) { openTripId = null; closeSheet(); } return; }
  if (refreshOnly && openTripId !== id) return;
  openTripId = id;
  const typed = $("ck-new")?.value || "";
  const cs = checksOf(id), parent = trips.find((x) => x.id === t.parent_id), n = linked(t);
  const others = (t.people || []).filter((p) => !NAME[p]);
  openSheet(`<div class="sh-title">${esc(t.name)}</div>
    <p class="trip-sub">${span(t)}${t.place ? ` · ${esc(t.place)}` : ""}${parent ? ` · ${esc(parent.name)} 안` : ""}</p>
    ${t.note ? `<p class="trip-note">${esc(t.note)}</p>` : ""}
    <div class="fld">같이 가는 사람<div class="seg" id="t-ppl">
      ${["MK", "KM"].map((c) => `<button class="${c}${t.people?.includes(c) ? " on" : ""}" data-pp="${c}">${NAME[c]}</button>`).join("")}
      ${others.map((p) => `<button class="on" data-pp="${esc(p)}" aria-label="${esc(p)} 빼기">${esc(p)} ×</button>`).join("")}
      <button data-pp-add>+ 다른 사람</button></div></div>
    <div class="fld"><span>준비 <span class="ck-count">${cs.filter((c) => c.done).length}/${cs.length}</span></span></div>
    <div class="ck-list">${cs.map((c) => `<div class="ck-row${c.done ? " struck" : ""}" data-ck="${c.id}" role="button" tabindex="0">
        <span class="nm">${esc(c.text)}${strikeSvg(c.done_by)}</span>
        <button class="ck-x" data-ck-del="${c.id}" aria-label="빼기">${I("x")}</button></div>`).join("")}</div>
    ${cs.length ? "" : `<button class="btn-ghost press" id="ck-fill">${prevTripWithChecks(t) ? `지난 ${esc(prevTripWithChecks(t).name)} 목록 가져오기` : "기본 준비 목록 넣기"}</button>`}
    <form class="ck-add" id="ck-form" autocomplete="off"><input id="ck-new" placeholder="준비할 것 더하기" enterkeyhint="done" value="${esc(typed)}"><button class="press" aria-label="더하기">${I("pen")}</button></form>
    ${t.place ? `<div class="fld">${esc(t.place)}에서<div class="seg">
      <button class="press" data-go="buy">살 것 ${n.buy}</button><button class="press" data-go="cand">후보 ${n.cand}</button></div></div>` : ""}
    <div class="sh-actions">
      <button class="btn-ghost danger press" id="t-del">여행 지우기</button>
      <button class="btn-primary press" id="t-edit">날짜·이름 고치기</button>
    </div>`);
  const sh = $("sheet");
  sh.querySelectorAll("[data-pp]").forEach((b) => b.addEventListener("click", () => {
    const p = b.dataset.pp, ppl = new Set(t.people || []);
    ppl.has(p) ? ppl.delete(p) : ppl.add(p);
    saveTrip(t, { people: [...ppl] });
  }));
  sh.querySelector("[data-pp-add]").addEventListener("click", () => {
    const p = (prompt("같이 가는 사람 이름") || "").trim();
    if (p && !(t.people || []).includes(p)) saveTrip(t, { people: [...(t.people || []), p] });
  });
  sh.querySelectorAll("[data-ck]").forEach((row) => row.addEventListener("click", async (e) => {
    if (e.target.closest("[data-ck-del]")) return;
    const c = checks.find((x) => x.id === row.dataset.ck); if (!c) return;
    const on = !c.done;
    row.querySelector(".strike").setAttribute("class", "strike by-" + me.member_code);
    row.classList.toggle("struck", on);
    await new Promise((r) => setTimeout(r, 240));
    saveCheck(c, { done: on, done_by: on ? me.member_code : null, done_at: on ? new Date().toISOString() : null });
  }));
  sh.querySelectorAll("[data-ck-del]").forEach((b) => b.addEventListener("click", () => {
    const c = checks.find((x) => x.id === b.dataset.ckDel); if (c) saveCheck(c, { deleted_at: new Date().toISOString() });
  }));
  $("ck-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("ck-new").value.trim(); if (!text) return;
    $("ck-new").value = "";
    addChecks(t, [text]).then(() => $("ck-new")?.focus());
  });
  $("ck-fill")?.addEventListener("click", () => {
    const prev = prevTripWithChecks(t);
    addChecks(t, prev ? checksOf(prev.id).map((c) => c.text) : (TEMPLATE[t.place] || TEMPLATE[""]));
  });
  sh.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { openTripId = null; closeSheet(); goTab(b.dataset.go); }));
  $("t-edit").addEventListener("click", () => openTripForm(t));
  const del = $("t-del");
  del.addEventListener("click", async () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "한 번 더 누르면 지워요"; return; }
    openTripId = null; closeSheet();
    const gone = [t, ...trips.filter((x) => x.parent_id === t.id)];
    for (const x of gone) await saveTrip(x, { deleted_at: new Date().toISOString() });
    toast("여행을 지웠어요.");
  });
}
// 같은 장소의 가장 최근 지난 여행(체크리스트가 있는 것) — 새 여행 체크리스트를 복사해 올 곳
function prevTripWithChecks(t) {
  return trips.filter((x) => x.id !== t.id && x.place === t.place && x.start_date < t.start_date && checksOf(x.id).length)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}
async function addChecks(t, texts) {
  const base = Math.max(0, ...checksOf(t.id).map((c) => c.sort));
  const rows = texts.map((text, i) => ({ id: uuid(), trip_id: t.id, text, sort: base + i + 1, done: false, created_by: me.member_code, created_at: new Date().toISOString() }));
  checks.push(...rows); openTrip(t.id, true); render();
  const { error } = await sb.from("bt_checks").insert(rows);
  if (error) { checks = checks.filter((c) => !rows.includes(c)); openTrip(t.id, true); toast("더하지 못했어요: " + error.message); }
}
async function saveTrip(t, fields) {
  const before = { ...t };
  Object.assign(t, fields);
  if (fields.deleted_at) trips = trips.filter((x) => x !== t);
  render(); if (openTripId === t.id && !fields.deleted_at) openTrip(t.id, true);
  const { error } = await sb.from("bt_trips").update(fields).eq("id", t.id);
  if (error) { Object.assign(t, before); if (!trips.includes(t)) trips.push(t); render(); toast("저장하지 못했어요: " + error.message); return false; }
  return true;
}
async function saveCheck(c, fields) {
  const before = { ...c };
  Object.assign(c, fields);
  if (fields.deleted_at) checks = checks.filter((x) => x !== c);
  render(); if (openTripId) openTrip(openTripId, true);
  const { error } = await sb.from("bt_checks").update(fields).eq("id", c.id);
  if (error) { Object.assign(c, before); if (!checks.includes(c)) checks.push(c); render(); if (openTripId) openTrip(openTripId, true); toast("저장하지 못했어요: " + error.message); }
}

// 새 여행 / 고치기
function openTripForm(t) {
  const isNew = !t;
  openTripId = null; // 폼을 쓰는 동안 실시간 갱신이 여행 시트로 덮어쓰지 않게
  const tops = trips.filter((x) => !x.parent_id && x.id !== t?.id);
  openSheet(`<div class="sh-title">${isNew ? "새 여행" : "여행 고치기"}</div>
    <label class="fld">이름<input class="big" id="f-name" value="${esc(t?.name)}" placeholder="예: 일본, 부산 1박"></label>
    <label class="fld">장소<input id="f-place" value="${esc(t?.place)}" list="f-places" placeholder="예: 일본, 후쿠오카"><datalist id="f-places">${[...new Set(["한국", "일본", ...trips.map((x) => x.place).filter(Boolean)])].map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
    <div class="row2">
      <label class="fld">시작<input id="f-start" type="date" value="${esc(t?.start_date)}"></label>
      <label class="fld">끝<input id="f-end" type="date" value="${esc(t?.end_date)}"></label>
    </div>
    <div class="fld">어느 여행 안에?<div class="seg" id="f-parent">
      <button class="${!t?.parent_id ? "on" : ""}" data-parent="">따로 떠나는 여행</button>
      ${tops.map((x) => `<button class="${t?.parent_id === x.id ? "on" : ""}" data-parent="${x.id}">${esc(x.name)} 안</button>`).join("")}</div></div>
    <label class="fld">메모<textarea id="f-note" placeholder="예: 후쿠오카 · 남편은 부산에서 합류">${esc(t?.note)}</textarea></label>
    <div class="sh-actions">${isNew ? "" : `<button class="btn-ghost press" id="f-back">돌아가기</button>`}<button class="btn-primary press" id="f-save">${isNew ? "만들기" : "저장"}</button></div>
    ${isNew ? `<p class="sh-meta">만들면 준비 체크리스트가 같이 들어가요 — 같은 장소의 지난 여행이 있으면 그 목록, 없으면 기본 목록.</p>` : ""}`);
  let parent = t?.parent_id || "";
  $("sheet").querySelectorAll("[data-parent]").forEach((b) => b.addEventListener("click", () => {
    parent = b.dataset.parent;
    $("sheet").querySelectorAll("[data-parent]").forEach((x) => x.classList.toggle("on", x === b));
    const p = trips.find((x) => x.id === parent);
    if (p && !$("f-start").value) { $("f-start").value = p.start_date; $("f-end").value = p.start_date; }
  }));
  $("f-back")?.addEventListener("click", () => openTrip(t.id));
  $("f-save").addEventListener("click", async () => {
    const f = { name: $("f-name").value.trim(), place: $("f-place").value.trim() || null, start_date: $("f-start").value, end_date: $("f-end").value || $("f-start").value,
      parent_id: parent || null, note: $("f-note").value.trim() || null };
    if (!f.name) return toast("이름을 적어 주세요.");
    if (!f.start_date) return toast("시작 날짜를 골라 주세요.");
    if (f.end_date < f.start_date) return toast("끝 날짜가 시작보다 앞이에요.");
    if (!isNew) { await saveTrip(t, f); return openTrip(t.id); }
    const row = { id: uuid(), ...f, people: parent ? [] : [me.member_code], created_by: me.member_code, created_at: new Date().toISOString() };
    trips.push(row); render();
    const { error } = await sb.from("bt_trips").insert(row);
    if (error) { trips = trips.filter((x) => x !== row); render(); closeSheet(); return toast(error.code === "42P01" ? "여행 표가 아직 없어요. migrations/004_trips.sql을 실행해 주세요." : "만들지 못했어요: " + error.message); }
    const prev = prevTripWithChecks(row);
    await addChecks(row, prev ? checksOf(prev.id).map((c) => c.text) : (TEMPLATE[row.place] || TEMPLATE[""]));
    openTrip(row.id);
  });
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
$("sheet-back").addEventListener("click", () => { openTripId = null; closeSheet(); });

// 손잡이(시트 맨 위 띠)를 끌어내려 닫기 — 120px 넘게 내리거나 빠르게 튕기면 닫히고, 아니면 제자리로
(() => {
  const sh = $("sheet");
  let y0 = 0, t0 = 0, dy = 0, dragging = false;
  sh.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".grab")) return;
    dragging = true; y0 = e.clientY; t0 = performance.now(); dy = 0;
    sh.classList.add("dragging"); sh.setPointerCapture(e.pointerId);
  });
  sh.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dy = e.clientY - y0;
    // 위로 끌면 살짝만 따라옴(벽에 부딪히는 대신 저항)
    sh.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; sh.classList.remove("dragging"); sh.style.transform = "";
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 120 || (dy > 20 && v > 0.5)) { openTripId = null; closeSheet(); }
  };
  sh.addEventListener("pointerup", end);
  sh.addEventListener("pointercancel", end);
})();
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) { openTripId = null; closeSheet(); } });

// 시작 화면 (목업 .grill/bottari-splash-mockup.html A안 "묶기"): 보자기 → 두 귀 묶기 → 매듭 → 글자. 약 1.3초, 누르면 끝
async function splash() {
  const sp = $("splash"); if (!sp) return;
  let done = false;
  const out = () => { if (done) return; done = true; sp.classList.add("out"); setTimeout(() => sp.remove(), 260); };
  sp.addEventListener("click", out);
  if (reduceMotion.matches) return sp.remove();
  // 글씨체가 0.5초 안에 안 오면 기다리지 않고 바로 앱으로
  const ok = await Promise.race([document.fonts.load('52px "Poor Story"', "Bottari").then(() => true), new Promise((r) => setTimeout(() => r(false), 500))]);
  if (!ok) return out();
  const at = (ms, fn) => setTimeout(() => { if (!done) fn(); }, ms);
  const q = (s) => sp.querySelector(s);
  at(0, () => q(".s-body").classList.add("in"));
  at(200, () => { q(".s-earl").classList.add("in"); q(".s-earr").classList.add("in"); });
  at(440, () => q(".s-knot").classList.add("in"));
  sp.querySelectorAll(".s-word span").forEach((c, i) => at(520 + i * 60, () => c.classList.add("in")));
  at(980, () => q(".s-tag").classList.add("in"));
  at(1300, out);
}

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
splash();
boot();
