// =====================================================================
// IBMaster · data layer on Supabase (login, tables, files, live updates)
// =====================================================================
const sb = window.supabase.createClient(window.IBM_CONFIG.url, window.IBM_CONFIG.key, {auth:{persistSession:true,autoRefreshToken:true}});
const TABLE = {personal:"personal_tasks",deadlines:"deadlines",lessons:"lessons",summaries:"summaries",cards:"cards",slidetext:"slide_text",classes:"classes"};
const KEYCOL = {slide_text:"lesson_id"};
const snake = k => k.replace(/[A-Z]/g, m => "_" + m.toLowerCase());
const camel = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function toRow(table, obj){
  const r = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (k === "addedBy") continue;                     // set by the database (auth.uid())
    if (table === "lessons" && k === "slides") { if (v) { r.slides_path = v.id; r.slides_name = v.name || null; r.slides_type = v.type || null; } else { r.slides_path = null; r.slides_name = null; r.slides_type = null; } continue; }
    if (table === "summaries" && k === "file") { if (v) { r.file_path = v.id; r.file_name = v.name || null; } continue; }
    r[snake(k)] = v;
  }
  return r;
}
function fromRow(table, row){
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) continue;
    if (k === "created_by") { o.addedBy = v; continue; }
    o[camel(k)] = v;
  }
  if (table === "lessons" && row.slides_path) o.slides = {id: row.slides_path, name: row.slides_name, type: row.slides_type};
  if (table === "summaries" && row.file_path) o.file = {id: row.file_path, name: row.file_name};
  if (table === "deadlines" && row.date) o.date = String(row.date).slice(0, 10);
  if (table === "lessons" && row.date) o.date = String(row.date).slice(0, 10);
  return o;
}
async function q(p){ const {data, error} = await p; if (error) { const e = new Error(error.message); e.code = error.code || "db"; e.details = error; throw e; } return data; }
// small compatibility layer so the screens can keep using collection()/doc()
const DB = {
  collection(name){ const t = TABLE[name] || name; return {
    async add(obj){ const row = await q(sb.from(t).insert(toRow(t, obj)).select("id").single()); scheduleReload(name); return {id: row.id}; }
  }; },
  doc(path){ const [name, id] = path.split("/"); const t = TABLE[name] || name; const key = KEYCOL[t] || "id"; return {
    async get(){ const row = await q(sb.from(t).select("*").eq(key, id).maybeSingle()); return {exists: !!row, data: () => row ? (t === "slide_text" ? {slides: row.slides, source: row.source} : fromRow(t, row)) : undefined}; },
    async set(obj){ const r = toRow(t, obj); r[key] = id; if (t === "slide_text") { delete r.updated_at; r.updated_at = new Date().toISOString(); } await q(sb.from(t).upsert(r)); scheduleReload(name); },
    async update(obj){ await q(sb.from(t).update(toRow(t, obj)).eq(key, id)); scheduleReload(name); },
    async delete(){ await q(sb.from(t).delete().eq(key, id)); scheduleReload(name); }
  }; }
};
// files: private bucket, opened through short-lived links
const Files = {
  async upload(file, opts){ const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${S.uid}/${Date.now()}-${safe}`;
    await q(sb.storage.from("files").upload(path, file, {contentType: opts && opts.type || file.type || "application/octet-stream", upsert: false}));
    return {id: path, url: "", contentType: opts && opts.type || file.type}; },
  async delete(path){ try { await sb.storage.from("files").remove([path]); } catch (e) {} },
  async open(path){ const isPptx=/\.pptx$/i.test(path); const {data, error} = await sb.storage.from("files").createSignedUrl(path, 3600, isPptx ? {download: path.split("/").pop().replace(/^\d+-/, "")} : undefined); if (error || !data) { toast("Couldn't open the file"); return; } window.open(data.signedUrl, "_blank", "noopener"); }
};
// ---------- loading + live updates
const LOADERS = {
  deadlines: async () => (await q(sb.from("deadlines").select("*").order("date"))).map(r => fromRow("deadlines", r)),
  lessons:   async () => (await q(sb.from("lessons").select("*"))).map(r => fromRow("lessons", r)),
  summaries: async () => (await q(sb.from("summaries").select("*"))).map(r => fromRow("summaries", r)),
  cards:     async () => (await q(sb.from("cards").select("*").limit(10000))).map(r => fromRow("cards", r)),
  classes:   async () => (await q(sb.from("classes").select("*").order("starts_at").limit(5000))).map(classFromRow),
  players:   async () => (await q(sb.from("profiles").select("id,name,week_start,week_xp,xp,streak,last_study,hide_board"))).map(r => ({id: r.id, name: r.name, weekStart: r.week_start, weekXp: r.week_xp || 0, xp: r.xp || 0, streak: r.streak || 0, last: r.last_study || "", hidden: !!r.hide_board})),
  notes:     async () => (await q(sb.from("slide_notes").select("*"))).map(r => ({lessonId: r.lesson_id, userId: r.user_id, slides: r.slides || [], filePath: r.file_path || "", fileName: r.file_name || "", updatedAt: r.updated_at})),
  personal:  async () => (await q(sb.from("personal_tasks").select("*").order("date"))).map(r => ({id: r.id, date: String(r.date).slice(0, 10), title: r.title, course: r.course || "me", kind: "personal", personal: true, createdAt: r.created_at})),
  master:    async () => (await q(sb.from("master_notes").select("*"))).map(r => ({lessonId: r.lesson_id, slide: r.slide, text: r.text}))
};
const TABLE_TO_KEY = {deadlines:"deadlines",lessons:"lessons",summaries:"summaries",cards:"cards",classes:"classes",profiles:"players",slide_notes:"notes",master_notes:"master",personal_tasks:"personal"};
const pad2 = n => String(n).padStart(2, "0");
function localStamp(iso){ const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function classFromRow(r){ return {id: r.id, start: localStamp(r.starts_at), end: localStamp(r.ends_at), allDay: r.all_day, title: r.title, kind: r.kind || "", note: r.note || "", room: r.room || "", teacher: r.teacher || "", course: r.course || "", importedAt: r.imported_at}; }
const _timers = {};
function scheduleReload(name){ const key = TABLE_TO_KEY[TABLE[name] || name] || name; clearTimeout(_timers[key]); _timers[key] = setTimeout(() => reload(key), 250); }
async function reload(key){ try { S[key] = await LOADERS[key](); S.loaded[key] = true; if (!session || session.done) render(); } catch (e) { console.warn("load", key, e); } }
function startLive(){
  sb.channel("ibmaster-live").on("postgres_changes", {event: "*", schema: "public"}, payload => { const key = TABLE_TO_KEY[payload.table]; if (key) scheduleReload(key); }).subscribe();
}
// ---------- my own profile + private progress
async function loadMe(){
  const prof = await q(sb.from("profiles").select("*").eq("id", S.uid).maybeSingle());
  const prog = await q(sb.from("progress").select("data").eq("user_id", S.uid).maybeSingle());
  const d = (prog && prog.data) || {};
  if (prof) Object.assign(S.me, {name: prof.name, fr: prof.fr, third: prof.third, hideBoard: prof.hide_board, xp: prof.xp || 0, streak: prof.streak || 0, last: prof.last_study || "", week: {start: prof.week_start || "", xp: prof.week_xp || 0}});
  Object.assign(S.me, {done: d.done || [], boxes: d.boxes || {}, freezes: d.freezes || 0, goal: d.goal || 30, day: d.day || {date: "", xp: 0}});
  S.isAdmin = !!(await q(sb.from("admins").select("user_id").eq("user_id", S.uid).maybeSingle()));
  return !!prof;
}
let _meTimer = null;
function persistMe(){
  clearTimeout(_meTimer);
  _meTimer = setTimeout(async () => {
    try {
      const m = S.me;
      await q(sb.from("profiles").update({fr: m.fr, third: m.third, hide_board: !!m.hideBoard, xp: m.xp || 0, streak: m.streak || 0, last_study: m.last || null, week_start: m.week && m.week.start || null, week_xp: m.week && m.week.xp || 0}).eq("id", S.uid));
      await q(sb.from("progress").upsert({user_id: S.uid, data: {done: m.done || [], boxes: m.boxes || {}, freezes: m.freezes || 0, goal: m.goal || 30, day: m.day || {}}, updated_at: new Date().toISOString()}));
    } catch (e) { console.warn("save", e); toast("Your progress couldn't be saved. Check your connection."); }
  }, 400);
}
