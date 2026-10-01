
const COURSES = {
  mkt:{name:"Marketing", short:"MK", who:"Karin Bruyr", group:"box"},
  fin:{name:"Finance", short:"FI", who:"Charlotte Casteele", group:"box"},
  hrm:{name:"HRM", short:"HR", who:"Marjolein Feys", group:"box"},
  scm:{name:"Supply Chain Management", short:"SC", who:"Albert Glor", group:"box"},
  law:{name:"Law", short:"LA", who:"Wendy Habsch", group:"box"},
  pie:{name:"International Entrepreneurship Program", short:"PIE", who:"Elsie Vestraets", group:"prog"},
  en:{name:"English", short:"EN", who:"Cem Dhondt", group:"lang"},
  frb:{name:"French · Basic", short:"FR", who:"Katrien Ermens", group:"lang", color:"fr"},
  fra:{name:"French · Advanced", short:"FR+", who:"Foucher · Université de Poitiers", group:"lang", color:"fr"},
  es:{name:"Spanish", short:"ES", who:"Johan Trypsteen", group:"lang"},
  de:{name:"German", short:"DE", who:"", group:"lang"},
  is:{name:"Integration Sessions", short:"IS", who:"Elsie Vestraets", group:"admin"},
  ibp:{name:"Integrated Business Projects", short:"IBP", who:"Marjolein Feys", group:"admin"},
  int:{name:"Internship", short:"ST", who:"Elsie Vestraets", group:"admin"},
  gen:{name:"Trips & other", short:"✈", who:"", group:"admin"},
  fr:{name:"French (Basic + Advanced)", short:"FR", who:"", group:"hidden"}
};
const GROUPS = {box:"Box of Knowledge", prog:"Programs", lang:"Languages", admin:"Agenda only"};
const NOLEARN = ["is","ibp","int","gen","fr"];
const KIND = {deadline:"Deadline",test:"Test",session:"Session",trip:"Trip"};
const SUMKIND = {student:"Student notes", ai:"AI summary", merged:"Master summary"};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const INTERVALS = [0,1,3,7,14,30]; // Leitner box -> days until next review
const ICON_TRASH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_FILE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v15H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 2v5h5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

const S = {deadlines:[],lessons:[],summaries:[],cards:[],classes:[],loaded:{},db:null,assets:null,user:null,sample:null,uid:null,canWrite:null,names:{},
  me:{done:[],xp:0,streak:0,last:"",freezes:0,third:"es",fr:"advanced",goal:30,day:{date:"",xp:0},week:{start:"",xp:0},boxes:{},name:"",hideBoard:false},players:[],roster:[],notes:[],master:[],isAdmin:false,meLoaded:false};
let view={name:"home"}, session=null;

// ---------- helpers
const pd=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const n0=new Date(); const TODAY=new Date(n0.getFullYear(),n0.getMonth(),n0.getDate()); const T=iso(TODAY);
const addDays=(d,n)=>iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+n));
const WEEK=iso(new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()-((TODAY.getDay()+6)%7)));
const daysUntil=s=>Math.round((pd(s)-TODAY)/864e5);
const cc=c=>`--cc:var(--c-${COURSES[c]?(COURSES[c].color||c):"gen"})`;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function visible(c){ if(c==="es"||c==="de") return c===S.me.third; if(c==="frb") return S.me.fr==="basic"; if(c==="fra") return S.me.fr==="advanced"; return true; }
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const myEvents=()=>S.deadlines.filter(e=>e.date&&visible(e.course));
const eventsFor=c=>myEvents().filter(e=>e.course===c||((c==="frb"||c==="fra")&&e.course==="fr"));
const canAdd=()=>!!S.uid;
const learnCourses=()=>Object.keys(COURSES).filter(c=>!NOLEARN.includes(c)&&visible(c));
const lessonsOf=c=>S.lessons.filter(l=>l.course===c).sort((a,b)=>(a.number||0)-(b.number||0));
const box=id=>(S.me.boxes&&S.me.boxes[id])?S.me.boxes[id][0]:0;
const isDue=id=>{const b=S.me.boxes&&S.me.boxes[id]; return !!b && b[1]<=T};
const mastery=cards=>cards.length?Math.round(cards.reduce((s,k)=>s+box(k.id),0)/(cards.length*5)*100):0;
const myCards=()=>S.cards.filter(k=>visible(k.course));
function inline(s){return s.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")}
function md(t){
  const lines=esc(t).split(/\r?\n/); let out="",ul=false;
  for(const l of lines){
    const b=l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if(b){ if(!ul){out+="<ul>";ul=true} out+="<li>"+inline(b[1])+"</li>"; continue; }
    if(ul){out+="</ul>";ul=false}
    const h=l.match(/^#{1,4}\s+(.*)/); if(h){out+="<h4>"+inline(h[1])+"</h4>";continue}
    if(l.trim()) out+="<p>"+inline(l)+"</p>";
  }
  return out+(ul?"</ul>":"");
}
function dueLabel(s){const n=daysUntil(s); if(n<0)return{t:Math.abs(n)+"d ago",soon:false}; if(n===0)return{t:"Today",soon:true}; if(n===1)return{t:"Tomorrow",soon:true}; return{t:"in "+n+" days",soon:n<=7};}
function toast(t){const el=document.getElementById("toast");el.textContent=t;el.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove("show"),1900);}
function notice(t){const n=document.getElementById("notice");n.hidden=!t;document.getElementById("notice-t").textContent=t||"";}
const delBtn=(col,id,label)=>canAdd()?`<button class="del" data-del="${col}:${id}" aria-label="Remove ${esc(label)}" title="Remove">${ICON_TRASH}</button>`:"";
function ringSVG(frac,r=13){const c=2*Math.PI*r;return `<svg class="ring" viewBox="0 0 ${2*r+6} ${2*r+6}" aria-hidden="true"><circle class="bg" cx="${r+3}" cy="${r+3}" r="${r}"/><circle class="fg" cx="${r+3}" cy="${r+3}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-Math.min(1,frac))}"/></svg>`;}
function norm(s){return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();}
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n];}

// ---------- personal state
let meQueue=Promise.resolve();
function saveMe(patch){ S.me={...S.me,...patch}; render(); if(S.uid) persistMe(); }
function syncPlayer(){ if(S.uid) persistMe(); }
function streakNow(){
  const y=addDays(TODAY,-1), y2=addDays(TODAY,-2);
  if(S.me.last===T||S.me.last===y) return S.me.streak||0;
  if(S.me.last===y2&&(S.me.freezes||0)>0) return S.me.streak||0;
  return 0;
}
function studiedPatch(xpGain, boxes){
  const p={xp:(S.me.xp||0)+xpGain, boxes};
  const day=S.me.day&&S.me.day.date===T?S.me.day:{date:T,xp:0}; p.day={date:T,xp:day.xp+xpGain};
  const wk=S.me.week&&S.me.week.start===WEEK?S.me.week:{start:WEEK,xp:0}; p.week={start:WEEK,xp:wk.xp+xpGain};
  if(S.me.last!==T){
    const y=addDays(TODAY,-1), y2=addDays(TODAY,-2); let fr=S.me.freezes||0, st;
    if(S.me.last===y) st=(S.me.streak||0)+1;
    else if(S.me.last===y2&&fr>0){st=(S.me.streak||0)+1;fr--;p.usedFreeze=true}
    else st=1;
    if(st%7===0) fr=Math.min(2,fr+1);
    p.streak=st; p.freezes=fr; p.last=T;
  }
  return p;
}

// ---------- render
function render(){
  const st=streakNow();
  document.getElementById("streak").textContent=st;
  document.getElementById("streak-wrap").classList.toggle("off",S.me.last!==T);
  document.getElementById("freezes").textContent=S.me.freezes||0;
  document.getElementById("xp").textContent=S.me.xp||0;
  const dxp=S.me.day&&S.me.day.date===T?S.me.day.xp:0;
  document.getElementById("goal-mini").innerHTML=`${ringSVG(dxp/(S.me.goal||30))}<span class="num" style="font-size:13px">${dxp}/${S.me.goal||30}</span>`;
  document.getElementById("add-top").hidden=!canAdd();
  document.getElementById("tabnav").innerHTML=navHTML(); document.getElementById("tabnav").hidden=!!(session&&!session.done);
  const av=document.getElementById("avatar"); av.hidden=!S.uid; av.textContent=(S.me.name||"?").charAt(0).toUpperCase();
  const m=document.getElementById("main");
  if(session) m.innerHTML=sessionHTML();
  else{m.innerHTML={home:homeHTML,agenda:agendaTabHTML,courses:coursesTabHTML,learn:learnTabHTML,upload:uploadTabHTML,class:classTabHTML}[curTab](); const a=document.getElementById("third"),b=document.getElementById("frlvl"),g=document.getElementById("goalsel"); if(a)a.value=S.me.third; if(b)b.value=S.me.fr; if(g)g.value=String(S.me.goal||30);}
  if(session&&session.cur&&session.cur.q==="type"&&!session.answered){const i=document.getElementById("type-in"); if(i){i.focus();}}
  refreshNames();
}
function refreshNames(){}

function evRow(e,showCourse=true){
  const d=pd(e.date),due=dueLabel(e.date),isDone=(S.me.done||[]).includes(e.id),checkable=e.kind==="deadline"||e.kind==="test";
  return `<div class="ev ${isDone?"done":""}" style="${cc(e.course)}">
    <div class="datebox"><div class="d num">${d.getDate()}</div><div class="m">${MONTHS[d.getMonth()]}</div></div>
    <div style="min-width:0"><div class="ev-t">${esc(e.title)}</div>
      <div class="ev-s">${showCourse?`<span class="chip">${esc(COURSES[e.course]?.name||"Other")}</span>`:""}<span class="kind ${esc(e.kind)}">${KIND[e.kind]||"Item"}</span><span class="due ${due.soon&&!isDone?"soon":""}">${due.t}</span></div></div>
    <div class="ev-act">${delBtn("deadlines",e.id,e.title)}${checkable?`<button class="check" data-done="${e.id}" aria-label="${isDone?"Mark as not done":"Mark as done"}: ${esc(e.title)}"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:""}</div></div>`;
}

let calMonth=new Date(TODAY.getFullYear(),TODAY.getMonth(),1), selDay=T, showAll=false, agendaMode="deadlines";
const mondayOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));
let weekStart=mondayOf(TODAY);
const hm=s=>s?s.slice(11,16):"";
function classRow(k){
  return `<div class="ev" style="${cc(k.course||"gen")}"><div class="datebox">${k.allDay?`<div class="m" style="padding:6px 0">All day</div>`:`<div class="d num" style="font-size:15px">${hm(k.start)}</div><div class="m">${hm(k.end)}</div>`}</div>
    <div style="min-width:0"><div class="ev-t">${esc(k.title)}</div><div class="ev-s">${k.note?`<span class="kind trip">${esc(k.note)}</span>`:""}${k.kind&&k.kind!=="Activerend hoorcollege"?`<span class="kind">${esc(k.kind)}</span>`:""}${k.room?`<span>${esc(k.room)}</span>`:""}${k.teacher?`<span>${esc(k.teacher)}</span>`:""}</div></div>
    <div class="ev-act">${(()=>{const lc=k.course==="fr"?(S.me.fr==="basic"?"frb":"fra"):k.course; return canAdd()&&lc&&!NOLEARN.includes(lc)?`<button class="btn sm" data-add="lesson" data-c="${lc}" data-date="${k.start.slice(0,10)}" title="Add this class as a lesson">+ Lesson</button>`:"";})()}</div></div>`;
}
function classesHTML(){
  const days=[...Array(7)].map((_,i)=>addDays(weekStart,i));
  const wk=S.classes.filter(k=>k.start>=days[0]&&k.start<addDays(weekStart,7)+"T"&&(!k.course||visible(k.course))).sort((a,b)=>a.start.localeCompare(b.start));
  const last=S.classes.reduce((m,k)=>k.importedAt&&k.importedAt>m?k.importedAt:m,"");
  const list=days.map(d=>{const ks=wk.filter(k=>k.start.slice(0,10)===d); if(!ks.length) return ""; const dd=pd(d);
    return `<div class="group-label" style="margin-top:6px">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]}${d===T?" · today":""}</div>${ks.map(classRow).join("")}`}).join("");
  const we=pd(days[6]);
  return `${agendaHeader()}
    <div class="row" style="justify-content:space-between;margin-bottom:6px"><div class="cal-nav"><button class="btn" data-week="-1" aria-label="Previous week">‹</button><span class="cal-month" style="font-size:16px">${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]}</span><button class="btn" data-week="1" aria-label="Next week">›</button></div>
    ${canAdd()?`<button class="btn sm" data-import>Import from TimeEdit</button>`:""}</div>
    <div class="next-list">${list||`<p class="empty">${S.classes.length?"No classes this week.":"No class schedule yet. Import your TimeEdit calendar file (.ics) to see your lessons here."}</p>`}</div>
    ${last?`<p class="hint" style="margin:10px 0 0">Last imported ${new Date(last).getDate()} ${MONTHS[new Date(last).getMonth()]}.</p>`:""}`;
}
function agendaHeader(){
  return `<div class="panel-h"><h2>Agenda</h2><div class="tabs" role="tablist" style="margin:0"><button class="tab" role="tab" aria-selected="${agendaMode==="deadlines"}" data-agenda="deadlines">Deadlines</button><button class="tab" role="tab" aria-selected="${agendaMode==="classes"}" data-agenda="classes">Classes</button></div></div>`;
}
function agendaHTML(){return agendaMode==="classes"?classesHTML():calendarHTML();}

// TimeEdit / iCal import
function guessCourse(t){
  const s=norm(t);
  const rules=[["mkt",/marketing/],["fin",/financ/],["hrm",/\bhrm\b|human resource/],["scm",/supply|logistic/],["law",/\blaw\b|recht/],["pie",/entrepreneur|\bpie\b/],
    ["en",/english|engels/],["fra",/poitiers|avance|advanced/],["fr",/french|frans|francais/],["es",/spanish|spaans|espanol/],["de",/german|duits|deutsch/],
    ["is",/integration/],["ibp",/integrated business|\bibp\b/],["int",/internship|stage/]];
  for(const [c,r] of rules) if(r.test(s)) return c==="fr"?(S.me.fr==="basic"?"frb":"fra"):c;
  return "";
}
function courseFromName(n,teachers){
  const s=norm(n+" "+teachers.join(" "));
  if(/french|francais|frans/.test(s)) return /poitiers|foucher|advanced|avance/.test(s)?"fra":"fr"; // TimeEdit slot is shared by Basic and Advanced
  return guessCourse(n);
}
// TimeEdit packs "course\, course\, Werkvorm: X\, NOTE\, Teacher\, Teacher" into SUMMARY
function tidyTimeEdit(rawSummary,rawLoc){
  const parts=rawSummary.split(/\\,\s*/).map(p=>p.replace(/\\([;\\])/g,"$1").replace(/\\n/gi," ").replace(/\s+/g," ").trim()).filter(Boolean);
  const courses=[],teachers=[],notes=[]; let kind="",room="";
  for(const p of parts){
    if(/^BNB-[A-Z]+\//.test(p)){courses.push(p.replace(/^BNB-[A-Z]+\//,"").replace(/Partim International Box of Knowledge:\s*/i,"").replace(/International language program:\s*/i,"").replace(/International skills:\s*/i,"").replace(/\(IB\)/,"").trim());continue;}
    const w=p.match(/^Werkvorm:\s*(.*)/i); if(w){kind=w[1];continue;}
    const l=p.match(/^Lokaal:\s*(.*)/i); if(l){room=l[1];continue;}
    if(/^[A-Z]+\d|^\w+\.\d+\.\d+/.test(p)){room=room||p;continue;}
    if(/[a-z]/.test(p)&&!/\b(Day|Dag|Business|Projects?|Sessions?|Workshop)\b/.test(p)&&/^[A-Z][a-zé]+(?:\s(?:van|de|der|den|le|la|du|von))*(?:\s[A-Z][\w'-]+)+$/.test(p)){teachers.push(p);continue;}
    notes.push(p===p.toUpperCase()?p.toLowerCase().replace(/\b\p{L}/gu,m=>m.toUpperCase()):p);
  }
  let loc=(rawLoc||"").replace(/\\([,;\\])/g,"$1").trim();
  if(/^Externe locatie/i.test(loc)) loc="External location"; else if(/^Locatie naar keuze/i.test(loc)) loc="Location of choice"; else loc=loc.replace(/\.\s*Campus:\s*\*?$/,"").replace(/\.\s*Campus:\s*/," · ");
  const title=courses.length?courses.map(c=>c.charAt(0).toUpperCase()+c.slice(1)).join(" + "):(notes.shift()||kind||"Event");
  if(!courses.length&&kind&&!title.includes(kind)) notes.unshift(kind);
  return {title,kind:courses.length?kind:"",note:notes.join(" · "),room:loc||room,teacher:teachers.slice(0,2).join(", ")+(teachers.length>2?` +${teachers.length-2}`:""),course:courses.length?courseFromName(courses[0],teachers):""};
}
function parseICS(txt){
  const lines=txt.replace(/\r\n?/g,"\n").replace(/\n[ \t]/g,"").split("\n"); const out=[]; let cur=null;
  const un=v=>v.replace(/\\n/gi," · ").replace(/\\([,;\\])/g,"$1").trim();
  const dt=(key,val)=>{ // returns local "YYYY-MM-DDTHH:MM"
    const m=val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if(!m) return "";
    let d; if(m[7]) d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0))); else d=new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));
    return iso(d)+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  };
  for(const line of lines){
    if(line==="BEGIN:VEVENT"){cur={};continue}
    if(line==="END:VEVENT"){ if(cur&&cur.start) out.push(cur); cur=null; continue; }
    if(!cur) continue;
    const i=line.indexOf(":"); if(i<0) continue; const key=line.slice(0,i).split(";")[0].toUpperCase(), val=line.slice(i+1);
    if(key==="DTSTART"){cur.start=dt(key,val); if(!/T/.test(val)) cur.allDay=true;} else if(key==="DTEND") cur.end=dt(key,val);
    else if(key==="SUMMARY") cur.rawS=val; else if(key==="LOCATION") cur.rawL=val;
  }
  return out.map(e=>{const t=tidyTimeEdit(e.rawS||"",e.rawL||"");
    return {title:t.title.slice(0,160),kind:t.kind.slice(0,60),note:t.note.slice(0,120),room:t.room.slice(0,100),teacher:t.teacher.slice(0,100),course:t.course,start:e.start,end:e.end||e.start,...(e.allDay?{allDay:true}:{})};});
}
function importClasses(){
  let parsed=[];
  const f=openModal("Import from TimeEdit",`<ol class="hint" style="margin:0;padding-left:1.2em;display:grid;gap:4px">
      <li>Open your schedule in TimeEdit.</li><li>Choose <b>Subscribe</b> or <b>Download</b> and save the <b>.ics</b> file.</li><li>Pick that file below.</li></ol>
    <div class="field"><label class="cap" for="f-ics">Calendar file (.ics)</label><input id="f-ics" type="file" accept=".ics,text/calendar"></div>
    <div id="ics-out" class="hint"></div><p class="hint" style="margin:0">Importing again replaces the weeks in the file, so re-import whenever TimeEdit changes.</p>`,
  async ()=>{ if(!parsed.length) fail("Pick a .ics file with classes in it.");
    const toIso=s=>new Date(s).toISOString(), sorted=parsed.map(e=>e.start).sort(), from=toIso(sorted[0]), to=new Date(new Date(sorted[sorted.length-1]).getTime()+864e5).toISOString();
    await q(sb.from("classes").delete().gte("starts_at",from).lt("starts_at",to));
    const rows=parsed.map(e=>({starts_at:toIso(e.start),ends_at:toIso(e.end),all_day:!!e.allDay,title:e.title,kind:e.kind||null,note:e.note||null,room:e.room||null,teacher:e.teacher||null,course:e.course||null}));
    for(let i=0;i<rows.length;i+=200) await q(sb.from("classes").insert(rows.slice(i,i+200)));
    scheduleReload("classes");
    agendaMode="classes"; return `${parsed.length} classes imported`; },"Import");
  document.getElementById("msave").disabled=true;
  f.querySelector("#f-ics").addEventListener("change",async ev=>{
    const file=ev.target.files[0]; const out=document.getElementById("ics-out"); parsed=[];
    if(file){ try{ parsed=parseICS(await file.text()); }catch(e){} }
    const known=parsed.filter(p=>p.course).length;
    out.innerHTML=parsed.length?`Found <b>${parsed.length}</b> classes from ${parsed.map(p=>p.start).sort()[0].slice(0,10)} to ${parsed.map(p=>p.start).sort().slice(-1)[0].slice(0,10)}. ${known} matched to a course.`:(file?`<span class="err">No classes found in this file.</span>`:"");
    document.getElementById("msave").disabled=!parsed.length;
  });
}
function calendarHTML(){
  const y=calMonth.getFullYear(),m=calMonth.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,first=new Date(y,m,1-offset),evs=myEvents();let cells="";
  for(let i=0;i<42;i++){
    const d=new Date(first.getFullYear(),first.getMonth(),first.getDate()+i),k=iso(d); if(i>=35&&d.getMonth()!==m)break;
    const de=evs.filter(e=>e.date===k);
    cells+=`<button class="day ${d.getMonth()!==m?"out":""} ${k===T?"today":""} ${k===selDay?"sel":""}" data-day="${k}" aria-label="${d.getDate()} ${MONTHS_L[d.getMonth()]}, ${de.length} items"><span class="n num">${d.getDate()}</span>
      ${de.slice(0,2).map(e=>`<span class="pill" style="${cc(e.course)}">${esc(e.title)}</span>`).join("")}${de.length>2?`<span class="hint" style="font-size:10px">+${de.length-2}</span>`:""}
      <span class="dots">${de.map(e=>`<i style="${cc(e.course)}"></i>`).join("")}</span></button>`;
  }
  const sel=evs.filter(e=>e.date===selDay),sd=pd(selDay);
  return `${agendaHeader()}<div class="cal-nav" style="margin-bottom:10px;justify-content:center"><button class="btn" data-cal="-1" aria-label="Previous month">‹</button><span class="cal-month">${MONTHS_L[m]} ${y}</span><button class="btn" data-cal="1" aria-label="Next month">›</button></div>
    <div class="cal">${["MO","TU","WE","TH","FR","SA","SU"].map(x=>`<div class="dow">${x}</div>`).join("")}${cells}</div>
    <div class="day-detail"><div class="row" style="justify-content:space-between"><span class="hint">${sd.getDate()} ${MONTHS_L[sd.getMonth()]}</span>${canAdd()?`<button class="btn sm add" data-add="deadline" data-date="${selDay}">Add on this day</button>`:""}</div>
    ${sel.length?sel.map(e=>evRow(e)).join(""):`<div class="empty">Nothing planned this day.</div>`}</div>`;
}

function todayHTML(inLearn){
  const cards=myCards(), due=cards.filter(k=>isDue(k.id)), fresh=cards.filter(k=>!box(k.id));
  const dxp=S.me.day&&S.me.day.date===T?S.me.day.xp:0, goal=S.me.goal||30;
  const tests=myEvents().filter(e=>e.kind==="test"&&daysUntil(e.date)>=0&&daysUntil(e.date)<=35).sort((a,b)=>a.date.localeCompare(b.date));
  let cta;
  if(due.length) cta=`<button class="btn primary big-cta" data-learn="due">Review ${due.length} card${due.length===1?"":"s"} due today</button>`;
  else if(fresh.length) cta=`<button class="btn primary big-cta" data-learn="new">Learn ${Math.min(10,fresh.length)} new card${fresh.length===1?"":"s"}</button>`;
  else if(cards.length) cta=`<p class="empty">All caught up. Your next reviews come back on their own.</p>`;
  else cta=`<p class="empty">No flashcards yet. Add a lesson with your summary, then make flashcards from it to start learning.</p>${canAdd()?`<button class="btn primary add" data-add="menu">Add something</button>`:""}`;
  const radar=tests.map(e=>{
    const cs=["frb","fra"].includes(e.course)||e.course==="fr"?(S.me.fr==="basic"?"frb":"fra"):e.course;
    const ck=cards.filter(k=>k.course===cs);
    return `<div class="radar-row" style="${cc(e.course)}"><div style="min-width:0"><b>${esc(e.title)}</b><div class="hint">${esc(COURSES[e.course]?.name||"")} · ${dueLabel(e.date).t} · ${ck.length?`${mastery(ck)}% mastered`:"no cards yet"}</div></div>
      ${ck.length?`<button class="btn sm primary" data-learn="course" data-c="${cs}">Practice</button>`:`<button class="btn sm" data-course="${cs}">Open</button>`}</div>`;
  }).join("");
  return `<section class="panel"><div class="panel-h"><h2>Today</h2><span class="track"><label for="goalsel">Daily goal</label><select id="goalsel"><option value="10">10 XP</option><option value="30">30 XP</option><option value="50">50 XP</option></select></span></div>
    <div class="today"><div class="goal">${ringSVG(dxp/goal,24)}<div><div class="goal-t num">${dxp} / ${goal} XP</div><div class="hint">${dxp>=goal?"Goal reached. Nice!":"Short sessions every day beat cramming."}</div></div></div>
    ${cta}
    ${(()=>{const tc=S.classes.filter(k=>k.start.slice(0,10)===T&&(!k.course||visible(k.course))).sort((a,b)=>a.start.localeCompare(b.start));
      return tc.length?`<div><div class="group-label" style="margin-top:4px">Classes today</div><div class="next-list">${tc.map(classRow).join("")}</div></div>`:"";})()}
    ${tests.length?`<div><div class="group-label" style="margin-top:4px">Test radar · next 5 weeks</div><div class="radar">${radar}</div></div>`:""}</div></section>`;
}

function courseCard(c){
  const C=COURSES[c],done=new Set(S.me.done||[]),evs=eventsFor(c).filter(e=>e.kind==="deadline"||e.kind==="test");
  const nxt=evs.filter(e=>daysUntil(e.date)>=0&&!done.has(e.id)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const learn=!NOLEARN.includes(c), ck=S.cards.filter(k=>k.course===c), nl=lessonsOf(c).length;
  const pct=learn?mastery(ck):(evs.length?Math.round(evs.filter(e=>done.has(e.id)).length/evs.length*100):0);
  return `<button class="course" data-course="${c}" style="${cc(c)}">
    <div class="course-top"><div class="badge">${C.short}</div><div style="min-width:0"><h3>${esc(C.name)}</h3><div class="who">${esc(C.who||"Lecturer TBA")}</div></div></div>
    <div class="ring-row"><span>${learn?`${nl} lesson${nl===1?"":"s"} · ${ck.length} cards · ${pct}% mastered`:`${evs.filter(e=>done.has(e.id)).length}/${evs.length} done`}</span>${nxt?`<span class="due ${dueLabel(nxt.date).soon?"soon":""}">${dueLabel(nxt.date).t}</span>`:""}</div>
    <div class="bar-track"><span style="width:${pct}%"></span></div></button>`;
}

// ---------- tabs
let curTab="home";
const TAB_LIST=[
  ["home","Home",'<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'],
  ["agenda","Agenda",'<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2"/>'],
  ["courses","Courses",'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/>'],
  ["learn","Learn",'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'],
  ["upload","Upload",'<path d="M12 3 6 9h4v6h4V9h4zM5 18h14v3H5z"/>'],
  ["class","Leaderboard",'<path d="M7 4h10v4a5 5 0 0 1-10 0zM4 5h3v3a3 3 0 0 1-3-3zM20 5h-3v3a3 3 0 0 0 3-3zM10 14h4v3h3v3H7v-3h3z"/>']
];
function navHTML(){return TAB_LIST.map(([k,l,ic])=>`<button class="tabbtn" data-tabgo="${k}" ${curTab===k?'aria-current="page"':""}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ic}</svg><span>${l}</span></button>`).join("");}
const nameOf=id=>{const p=S.players.find(x=>x.id===id);return (p&&p.name)||S.names[id]||(id===S.uid?(S.me.name||"You"):"Classmate");};
const pageHead=(title,sub)=>`<div class="page-h"><h1>${title}</h1>${sub?`<p class="hint">${sub}</p>`:""}</div>`;

function upNextHTML(limit){
  const up=myEvents().filter(e=>daysUntil(e.date)>=0&&e.kind!=="session").sort((a,b)=>a.date.localeCompare(b.date)), list=(showAll||!limit)?up:up.slice(0,limit);
  const emptyUp=!S.loaded.deadlines?"Loading your planning…":(S.deadlines.length?"All clear. Nothing coming up.":"No deadlines yet. Add the first one.");
  return `<section class="panel"><div class="panel-h"><h2>Up next</h2>${canAdd()?`<button class="btn sm add" data-add="deadline">Add deadline</button>`:""}</div>
    <div class="next-list">${list.map(e=>evRow(e)).join("")||`<div class="empty">${emptyUp}</div>`}</div>
    ${limit&&up.length>limit?`<button class="btn" style="margin-top:10px" data-tabgo="agenda">See all ${up.length} in Agenda</button>`:""}</section>`;
}
function homeHTML(){
  return `${pageHead(`Hi${S.me.name?" "+esc(S.me.name):""}!`,`${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][TODAY.getDay()]} ${TODAY.getDate()} ${MONTHS_L[TODAY.getMonth()]}`)}
    <div class="home"><div class="col">${todayHTML()}</div><div class="col">${upNextHTML(4)}<div id="board">${boardHTML()}</div></div></div>`;
}
function agendaTabHTML(){
  return `${pageHead("Agenda","Deadlines from the planning and your classes from TimeEdit.")}
    <div class="home"><div class="col"><section class="panel" id="cal-panel">${agendaHTML()}</section></div><div class="col">${upNextHTML(0)}</div></div>`;
}
function coursesTabHTML(){
  if(view.name==="course") return courseHTML(view.course);
  if(view.name==="lesson") return lessonHTML();
  const groups=["box","prog","lang","admin"].map(g=>{const cs=Object.keys(COURSES).filter(c=>COURSES[c].group===g&&visible(c));return `<div class="group-label">${GROUPS[g]}</div><div class="courses">${cs.map(courseCard).join("")}</div>`}).join("");
  return `${pageHead("Courses","Open a course for its lessons, slides, summaries and deadlines.")}
    <section class="panel"><div class="panel-h"><h2>Your courses</h2><div class="track"><label for="third">3rd language</label><select id="third"><option value="es">Spanish</option><option value="de">German</option></select>
      <label for="frlvl">French</label><select id="frlvl"><option value="basic">Basic</option><option value="advanced">Advanced</option></select></div></div>${groups}</section>`;
}
function learnTabHTML(){
  const rows=learnCourses().map(c=>{const ck=S.cards.filter(k=>k.course===c); const due=ck.filter(k=>isDue(k.id)).length; const nl=lessonsOf(c).filter(l=>S.cards.some(k=>k.lessonId===l.id));
    return `<div class="learn-row" style="${cc(c)}"><div class="badge">${COURSES[c].short}</div><div style="min-width:0"><b>${esc(COURSES[c].name)}</b>
      <div class="ring-row"><span>${ck.length?`${ck.length} cards · ${mastery(ck)}% mastered${due?` · <b style="color:var(--danger)">${due} due</b>`:""}`:"No flashcards yet"}</span></div>
      <div class="bar-track" style="margin-top:4px"><span style="width:${mastery(ck)}%"></span></div>
      ${nl.length?`<div class="lesson-chips">${nl.map(l=>`<button class="chipbtn" data-lesson="${l.id}">${l.number}. ${esc(l.title)}</button>`).join("")}</div>`:""}</div>
      ${ck.length?`<button class="btn primary sm" data-learn="course" data-c="${c}">Practice</button>`:(canAdd()?`<button class="btn sm" data-add="card" data-c="${c}">Add cards</button>`:"<span></span>")}</div>`}).join("");
  return `${pageHead("Learn","Short daily sessions work best. Cards you miss come back sooner.")}
    <div class="home"><div class="col">${todayHTML(true)}</div>
    <div class="col"><section class="panel"><div class="panel-h"><h2>Practice by course</h2></div><div class="learn-list">${rows}</div></section></div></div>`;
}
function uploadTabHTML(){
  if(!canAdd()) return `${pageHead("Upload","")}<div class="panel"><p class="empty">Uploading needs access to this dashboard. Ask Loïc to invite you.</p></div>`;
  const tiles=[
    ["lesson","Slides","Upload the PowerPoint or PDF from class. AI turns it into flashcards.",'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2"/>'],
    ["summary","Summary or notes","Your notes for a lesson. Paste text or upload a PDF.",'<path d="M6 2h9l5 5v15H6z"/><path d="M9 12h8M9 16h8M9 8h4" stroke="var(--surface)" stroke-width="2"/>'],
    ["card","Flashcards","A term and its meaning, to learn and quiz.",'<rect x="3" y="6" width="14" height="12" rx="2"/><rect x="7" y="3" width="14" height="12" rx="2" opacity=".55"/>'],
    ["deadline","Deadline","Assignment, test, trip or session.",'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2" stroke="var(--surface)" stroke-width="2" fill="none"/>'],
    ["import","Class schedule","Import the .ics file from TimeEdit.",'<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16" stroke="var(--surface)" stroke-width="2"/>']
  ].map(([k,t,d,ic])=>`<button class="up-tile" ${k==="import"?"data-import":`data-add="${k}"`}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ic}</svg><b>${t}</b><span>${d}</span></button>`).join("");
  const recent=[...S.lessons.map(x=>({...x,_t:"Slides",_l:x.id,_n:x.title})),...S.summaries.map(x=>({...x,_t:SUMKIND[x.kind||"student"],_l:x.lessonId})),...S.cards.map(x=>({...x,_t:"Flashcard",_l:x.lessonId,_n:x.term}))]
    .filter(x=>x.createdAt).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12);
  const lname=id=>{const l=S.lessons.find(x=>x.id===id);return l?`${COURSES[l.course]?.name||""} · ${l.number}. ${l.title}`:""};
  return `${pageHead("Upload","Everything you add is shared with the class right away.")}
    <div class="up-grid">${tiles}</div>
    <p class="hint" style="margin:12px 2px 0">Slides: upload the .pptx (it includes your notes under the slides) and the PDF if you want to view them here. Summaries: pasted text works best, so it can be compared, merged and turned into flashcards.</p>
    <section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Recently added</h2></div>
      <div class="next-list">${recent.map(x=>`<button class="recent" data-lesson="${x._l}" style="${cc(x.course)}"><span class="chip">${esc(x._t)}</span><span style="min-width:0"><b>${esc(x._n||lname(x._l))}</b><span class="hint" style="display:block">${x._n?esc(lname(x._l))+" · ":""}${esc(nameOf(x.addedBy))}</span></span></button>`).join("")||`<p class="empty">Nothing yet. Be the first to add a lesson.</p>`}</div></section>`;
}
function classTabHTML(){
  const counts={};[...S.summaries,...S.cards,...S.lessons].forEach(x=>{if(x.addedBy)counts[x.addedBy]=(counts[x.addedBy]||0)+1});
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  return `${pageHead("Leaderboard","Who learned the most this week, the class goal and who shares the most.")}
    <div class="home"><div class="col"><div id="board">${boardHTML()}</div></div>
    <div class="col"><section class="panel"><div class="panel-h"><h2>Class library</h2><span class="hint">Shared by everyone</span></div>
      <div class="lib"><div><b class="num">${S.lessons.length}</b><span class="hint">lessons</span></div><div><b class="num">${S.summaries.length}</b><span class="hint">summaries</span></div><div><b class="num">${S.cards.length}</b><span class="hint">flashcards</span></div></div>
      ${top.length?`<div class="group-label">Top sharers</div><div class="sharers">${top.map(([id,n])=>`<span class="sharer">${esc(nameOf(id))} · ${n}</span>`).join("")}</div>`:`<p class="hint" style="margin:10px 0 0">Every summary or flashcard someone adds helps the whole class.</p>`}</section></div></div>`;
}

const CLASS_GOAL=1000;
function boardHTML(){
  const rows=S.players.filter(p=>p.weekStart===WEEK);
  const total=rows.reduce((t,p)=>t+(p.weekXp||0),0);
  // every classmate from the roster, plus anyone who joined with another name
  const byName={}; S.players.forEach(p=>{if(p.name)byName[p.name]=p;});
  const names=[...new Set([...S.roster,...S.players.filter(p=>p.name).map(p=>p.name)])];
  const list=names.map(n=>{const p=byName[n]; const xp=p&&p.weekStart===WEEK?(p.weekXp||0):0; return {name:n,p,xp,hidden:!!(p&&p.hidden),me:!!(p&&p.id===S.uid)};})
    .sort((a,b)=>(a.hidden-b.hidden)||(b.xp-a.xp)||a.name.localeCompare(b.name));
  let rank=0,prev=-1,shown=0;
  const medal=r=>r===1?"var(--xp)":r===2?"var(--muted)":r===3?"var(--c-scm)":"var(--line)";
  const rowsHTML=list.map(x=>{
    if(!x.hidden){shown++; if(x.xp!==prev){rank=shown;prev=x.xp;}}
    const r=x.hidden?"–":rank, live=x.p&&(x.p.streak||0)>1&&(x.p.last===T||x.p.last===addDays(TODAY,-1));
    return `<div class="lb-row ${x.me?"me":""} ${x.p?"":"idle"}"><span class="lb-rank num" style="--mc:${x.hidden||!x.xp?"var(--line)":medal(rank)}">${r}</span><span class="lb-name">${esc(x.name)}${x.me?" (you)":""}</span><span class="hint">${x.hidden?"hidden":live?x.p.streak+"-day streak":x.p?"":"not joined yet"}</span><b class="num">${x.hidden?"":x.xp+" XP"}</b></div>`;
  }).join("");
  return `<section class="panel"><div class="panel-h"><h2>Class leaderboard</h2><span class="hint">This week · resets every Monday</span></div>
    <div class="goal" style="margin-bottom:14px">${ringSVG(total/CLASS_GOAL,24)}<div><div class="goal-t num">${total} / ${CLASS_GOAL} XP</div><div class="hint">${total>=CLASS_GOAL?"Class goal reached this week!":"Class goal: reach it together by Sunday."}</div></div></div>
    ${list.length?`<div class="lb">${rowsHTML}</div>`:`<p class="empty">Loading the class…</p>`}
    ${S.me.name?`<p class="hint" style="margin:10px 0 0">${S.me.hideBoard?"Your score is hidden. Your XP still counts for the class goal.":"You appear as “"+esc(S.me.name)+"”."} <button class="linkbtn" data-profile>Change</button></p>`:(S.uid?`<p class="hint" style="margin:10px 0 0"><button class="linkbtn" data-profile>Choose your name</button> to join the leaderboard.</p>`:"")}</section>`;
}
function openProfile(first){
  openModal(first?"Welcome to IBMaster":"Your profile",`${first?`<p class="hint" style="margin:0">Set this up once. You can change it any time.</p>`:""}
    ${(()=>{ if(!S.roster.length) return `<div class="field"><label class="cap" for="p-name">Nickname</label><input id="p-name" maxlength="30" value="${esc(S.me.name||"")}" placeholder="How classmates see you"></div>`;
      const taken=new Set(S.players.filter(p=>p.id!==S.uid&&p.name).map(p=>p.name));
      const inList=S.roster.includes(S.me.name);
      return `<div class="field"><label class="cap" for="p-pick">Who are you?</label><select id="p-pick"><option value="">Choose your name…</option>${S.roster.map(n=>`<option value="${esc(n)}" ${n===S.me.name?"selected":""} ${taken.has(n)?"disabled":""}>${esc(n)}${taken.has(n)?" (taken)":""}</option>`).join("")}<option value="__other" ${S.me.name&&!inList?"selected":""}>Someone else…</option></select></div>
        <div class="field" id="p-otherwrap" ${S.me.name&&!inList?"":"hidden"}><label class="cap" for="p-name">Your first name</label><input id="p-name" maxlength="30" value="${esc(inList?"":S.me.name||"")}"></div>`;})()}
    <div class="two"><div class="field"><label class="cap" for="p-fr">French group</label><select id="p-fr"><option value="basic" ${S.me.fr==="basic"?"selected":""}>Basic · Katrien Ermens</option><option value="advanced" ${S.me.fr==="advanced"?"selected":""}>Advanced · Poitiers</option></select></div>
    <div class="field"><label class="cap" for="p-third">3rd language</label><select id="p-third"><option value="es" ${S.me.third==="es"?"selected":""}>Spanish</option><option value="de" ${S.me.third==="de"?"selected":""}>German</option></select></div></div>
    <label class="row hint"><input type="checkbox" id="p-hide" ${S.me.hideBoard?"checked":""} style="width:auto"> Hide my score on the class leaderboard</label>`,
  async f=>{const pk=f.querySelector("#p-pick"); const name=(pk&&pk.value&&pk.value!=="__other")?pk.value:(f.querySelector("#p-name")?.value||"").trim(); if(!name) fail(pk?"Choose your name.":"Pick a nickname.");
    if(S.players.some(p=>p.id!==S.uid&&p.name===name)) fail("Someone already picked that name. Choose another, or ask Loïc.");
    saveMe({name,fr:f.querySelector("#p-fr").value,third:f.querySelector("#p-third").value,hideBoard:f.querySelector("#p-hide").checked}); syncPlayer(); return "Profile saved";},"Save");
}
function courseHTML(c){
  const C=COURSES[c],evs=eventsFor(c).sort((a,b)=>a.date.localeCompare(b.date)),learn=!NOLEARN.includes(c),ls=lessonsOf(c),offs=[0,46,70,46,0,-46,-70,-46];
  const ck=S.cards.filter(k=>k.course===c);
  const nodes=ls.map((l,i)=>{const lc=S.cards.filter(k=>k.lessonId===l.id),ns=S.summaries.filter(s=>s.lessonId===l.id).length;
    return `<div class="node-wrap" style="transform:translateX(${offs[i%8]}px)"><button class="node" style="--m:${mastery(lc)}" data-lesson="${l.id}" aria-label="Open lesson ${l.number}: ${esc(l.title)}"><span>${l.number}</span></button>
      <div class="node-t">${esc(l.title)}</div><div class="node-m">${l.slides?"Slides · ":""}${ns} summar${ns===1?"y":"ies"} · ${lc.length} cards</div></div>`}).join("");
  const addNode=canAdd()?`<div class="node-wrap" style="transform:translateX(${offs[ls.length%8]}px)"><button class="node new" data-add="lesson" data-c="${c}" aria-label="Add a lesson"><span>+</span></button><div class="node-t">Add lesson</div></div>`:"";
  const steps=`<div class="steps">
    <div class="step"><span class="n">1</span><div><b>Add the lesson + slides</b><span class="hint">Upload the PPT as PDF.</span></div>${canAdd()?`<button class="btn sm" data-add="lesson" data-c="${c}">Add</button>`:""}</div>
    <div class="step"><span class="n">2</span><div><b>Add summaries</b><span class="hint">Yours and classmates'. Compare with the AI version and merge.</span></div>${canAdd()?`<button class="btn sm" data-add="summary" data-c="${c}">Add</button>`:""}</div>
    <div class="step"><span class="n">3</span><div><b>Learn with flashcards</b><span class="hint">Make them from a summary in one click, or type your own.</span></div>${canAdd()?`<button class="btn sm" data-add="card" data-c="${c}">Add</button>`:""}</div></div>`;
  return `<div class="crumbs"><button class="btn sm" data-go="courses">‹ All courses</button></div>
    <div class="c-hero" style="${cc(c)}"><div class="badge">${C.short}</div><div><h1>${esc(C.name)}</h1><div class="who">${esc(C.who||"Lecturer TBA")}</div></div>
      ${learn?`<div class="grow"><div class="ring-row"><span>${mastery(ck)}% mastered · ${ck.length} cards</span></div><div class="bar-track"><span style="width:${mastery(ck)}%"></span></div></div>
      <button class="btn primary" data-learn="course" data-c="${c}" ${ck.length?"":"disabled"}>Practice course</button>`:""}</div>
    <div class="c-grid">
      <section class="panel"><div class="panel-h"><h2>Deadlines & dates</h2>${canAdd()?`<button class="btn sm add" data-add="deadline" data-c="${c}">Add deadline</button>`:""}</div>
        <div class="next-list">${evs.map(e=>evRow(e,false)).join("")||`<div class="empty">No dates for this course yet.</div>`}</div></section>
      <section class="panel" style="${cc(c)}"><div class="panel-h"><h2>${learn?"Lesson path":"About"}</h2></div>
        ${learn?`<div class="path">${nodes}${addNode}</div>${ls.length?"":steps}`:`<p class="empty">This one is mostly deadlines, so it lives in the agenda without flashcards.</p>`}</section></div>`;
}

function summaryBlock(s){
  const k=s.kind||"student";
  const who=k==="ai"?"AI summary":k==="merged"?"Master summary":(s.author||nameOf(s.addedBy));
  const d=s.createdAt?new Date(s.createdAt):null;
  return `<article class="sum ${k}"><div class="sum-h"><span class="sum-who">${esc(who)}</span><span class="row"><span class="hint">${d?d.getDate()+" "+MONTHS[d.getMonth()]:""}</span>
    ${s.text&&canAdd()?`<button class="btn sm ai" data-gen-cards="${s.id}">Make flashcards</button>`:""}${delBtn("summaries",s.id,who)}</span></div>
    ${s.file?`<button class="file-link" data-open="${esc(s.file.id)}">${ICON_FILE}<span>${esc(s.file.name||"Summary file")}</span></button>`:""}
    ${s.text?`<div class="sum-body">${md(s.text)}</div>`:""}</article>`;
}

function lessonHTML(){
  const l=S.lessons.find(x=>x.id===view.lessonId);
  if(!l) return `<div class="crumbs"><button class="btn sm" data-go="courses">‹ All courses</button></div><div class="panel"><p class="empty">${S.loaded.lessons?"This lesson was removed.":"Loading…"}</p></div>`;
  const c=l.course,tab=view.tab||"student";
  const sums=S.summaries.filter(s=>s.lessonId===l.id).sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));
  const of=k=>sums.filter(s=>(s.kind||"student")===k);
  const cards=S.cards.filter(k=>k.lessonId===l.id);
  const texts=sums.filter(s=>s.text&&(s.kind||"student")!=="merged");
  let body;
  if(tab==="slides"){ body=notesTabHTML(l); }
  else if(tab==="compare"){
    body=`<div class="compare"><div><h3>Student notes</h3>${of("student").map(summaryBlock).join("")||`<p class="empty">None yet.</p>`}</div><div><h3>AI summary</h3>${of("ai").map(summaryBlock).join("")||`<p class="empty">None yet. Ask Claude in chat to write one from the slides.</p>`}</div></div>`;
  } else {
    const shown=of(tab);
    body=shown.map(summaryBlock).join("")||`<p class="empty">${tab==="student"?"No student notes yet. Add yours, and classmates can add theirs.":tab==="ai"?"No AI summary yet. Ask Claude in chat to write one from the slides, or paste one here.":"No master summary yet. It merges every student summary and the AI summary into one complete version."}</p>`;
  }
  const mergeBtn=canAdd()&&texts.length>=1?`<button class="btn sm ai" data-merge="${l.id}">Merge into master</button>`:"";
  const slides=l.slides;
  return `<div class="crumbs"><button class="btn sm" data-go="courses">‹ All courses</button><button class="btn sm" data-course="${c}">‹ ${esc(COURSES[c]?.name||"Course")}</button></div>
    <div class="c-hero" style="${cc(c)}"><div class="badge">${l.number}</div><div style="min-width:0"><h1>${esc(l.title)}</h1><div class="who">${esc(COURSES[c]?.name||"")}${l.date?" · "+pd(l.date).getDate()+" "+MONTHS_L[pd(l.date).getMonth()]:""}</div></div>
      <div class="row" style="margin-left:auto">${delBtn("lessons",l.id,"lesson "+l.title)}</div></div>
    <div class="l-grid">
      <section class="panel"><div class="panel-h"><h2>Summaries</h2><div class="row">${mergeBtn}${canAdd()?`<button class="btn sm add primary" data-add="summary" data-lesson="${l.id}" data-kind="${tab==="compare"||tab==="slides"?"student":tab}">Add summary</button>`:""}</div></div>
        <div class="tabs" role="tablist">${Object.entries(SUMKIND).map(([k,v])=>`<button class="tab" role="tab" aria-selected="${k===tab}" data-tab="${k}">${v}<span class="ct">${of(k).length}</span></button>`).join("")}<button class="tab" role="tab" aria-selected="${tab==="compare"}" data-tab="compare">Compare</button><button class="tab" role="tab" aria-selected="${tab==="slides"}" data-tab="slides">Notes per slide<span class="ct">${S.notes.filter(n=>n.lessonId===l.id).length}</span></button></div>
        ${body}</section>
      <div class="col">
        <section class="panel" style="${cc(c)}"><div class="panel-h"><h2>Learn</h2>${canAdd()?`<button class="btn sm add" data-add="card" data-lesson="${l.id}">Add flashcard</button>`:""}</div>
          <div class="learn-btns"><button class="btn primary" data-learn="lesson" ${cards.length?"":"disabled"}>Learn</button><button class="btn" data-learn="flash" ${cards.length?"":"disabled"}>Flashcards</button></div>
          <p class="hint" style="margin:8px 0 0">${cards.length?`${cards.length} cards · ${mastery(cards)}% mastered. Learn mixes multiple choice and typing, and repeats what you miss.`:"No cards yet. Upload the slides and let AI make them, use “Make flashcards” on a summary, or add your own."}</p>
          ${cards.length?`<div class="cards-list">${cards.map(k=>`<div class="card-row"><span class="lvl l${box(k.id)}" title="Level ${box(k.id)} of 5"></span><b>${esc(k.term)}</b><span>${esc(k.def)}${k.easy?`<span class="hint" style="display:block">In plain words: ${esc(k.easy)}</span>`:""}${k.example?`<span class="hint" style="display:block">Example: ${esc(k.example)}</span>`:""}</span>${delBtn("cards",k.id,k.term)}</div>`).join("")}</div>`:""}</section>
        <section class="panel"><div class="panel-h"><h2>Slides</h2>${canAdd()?`<button class="btn sm add" data-add="slides" data-lesson="${l.id}">${slides||l.hasText?"Replace":"Upload slides"}</button>`:""}</div>
          ${slides?`<button class="file-link" data-open="${esc(slides.id)}">${ICON_FILE}<span>${esc(slides.name||"Slides")}</span></button>`:l.pptxName?`<p class="hint" style="margin:0">PowerPoint “${esc(l.pptxName)}” was read. Upload the PDF version to view the slides here.</p>`:`<p class="empty">No slides yet. Upload the PowerPoint or PDF.</p>`}
          ${l.hasText?`<div class="row" style="margin-top:10px"><button class="btn sm" data-slidetext="${l.id}">Slide text${l.slideCount?` (${l.slideCount})`:""}</button>${canAdd()?`<button class="btn sm ai" data-genslides="${l.id}">Make flashcards from slides</button>`:""}</div>`:""}</section>
      </div></div>`;
}

// ---------- learning engine
function pickCards(mode,arg){
  const cards=myCards();
  if(mode==="due") return cards.filter(k=>isDue(k.id)).sort((a,b)=>box(a.id)-box(b.id)).slice(0,12);
  if(mode==="new") return shuffle(cards.filter(k=>!box(k.id))).slice(0,10);
  const set=mode==="course"?cards.filter(k=>k.course===arg):cards.filter(k=>k.lessonId===arg);
  const due=set.filter(k=>isDue(k.id)), fresh=set.filter(k=>!box(k.id)), rest=set.filter(k=>box(k.id)&&!isDue(k.id)).sort((a,b)=>box(a.id)-box(b.id));
  return [...shuffle(due),...shuffle(fresh),...rest].slice(0,10);
}
function makeQ(k,forceEasy){
  const pool=S.cards.filter(o=>o.course===k.course&&o.id!==k.id); const all=pool.length>=3?pool:S.cards.filter(o=>o.id!==k.id);
  const b=box(k.id); let q=forceEasy?"mc":b<=1?"mc":b===2?"mcr":"type";
  if((q==="mc"||q==="mcr")&&all.length<1) q="self";
  if(q==="mc"){const o=shuffle(all.filter(x=>x.def!==k.def)).slice(0,3).map(x=>x.def);return{k,q,prompt:k.term,answer:k.def,options:shuffle([k.def,...o])}}
  if(q==="mcr"){const o=shuffle(all.filter(x=>x.term!==k.term)).slice(0,3).map(x=>x.term);return{k,q,prompt:k.def,answer:k.term,options:shuffle([k.term,...o])}}
  if(q==="type") return{k,q,prompt:k.def,answer:k.term};
  return{k,q:"self",prompt:k.term,answer:k.def};
}
function startLearn(mode,arg,title){
  const cards=pickCards(mode,arg); if(!cards.length){toast("No cards to practice here yet");return;}
  let qs=cards.map(k=>makeQ(k)); const order={mc:0,self:0,mcr:1,type:2}; qs.sort((a,b)=>order[a.q]-order[b.q]);
  const easyIdx=qs.findIndex(x=>x.q==="mc"); if(easyIdx>-1&&qs.length>2){const [e]=qs.splice(easyIdx,1);qs.push(e)} // end on a win
  session={kind:"learn",title,queue:qs,i:0,cur:qs[0],answered:false,right:false,picked:null,typed:"",correct:0,total:qs.length,xp:0,combo:0,best:0,boxes:{...(S.me.boxes||{})},missed:new Set(),done:false,ret:{...view},retTab:curTab};
  render(); window.scrollTo({top:0});
}
function startFlash(lessonId){
  const cards=shuffle(S.cards.filter(k=>k.lessonId===lessonId)); if(!cards.length)return;
  session={kind:"flash",queue:cards.map(k=>({k})),i:0,cur:{k:cards[0]},flipped:false,correct:0,total:cards.length,xp:0,boxes:{...(S.me.boxes||{})},done:false,ret:{...view},retTab:curTab};
  render(); window.scrollTo({top:0});
}
function grade(right){
  const s=session,k=s.cur.k,first=!s.cur.retry;
  if(first){const b=s.boxes[k.id]?s.boxes[k.id][0]:0; if(right){const nb=Math.min(5,b+1); s.boxes[k.id]=[nb,addDays(TODAY,INTERVALS[nb])];} else {s.boxes[k.id]=[1,T]; s.missed.add(k.id);} }
  if(right){ s.correct+=first?1:0; s.combo++; s.best=Math.max(s.best,s.combo); const gain=(s.cur.q==="type"?15:10)+(s.combo%5===0?5:0); s.xp+=first?gain:5; if(s.combo%5===0) toast(`${s.combo} in a row! +5 bonus`); }
  else { s.combo=0; if(first&&s.kind==="learn") s.queue.push({...makeQ(k,true),retry:true}); }
}
function nextQ(){
  const s=session; s.i++; s.answered=false;s.right=false;s.picked=null;s.typed="";s.flipped=false;
  if(s.i>=s.queue.length){ finishSession(); return; }
  s.cur=s.queue[s.i]; render();
}
function finishSession(){
  const s=session; s.done=true; s.i=s.queue.length;
  const p=studiedPatch(s.xp,s.boxes); const used=p.usedFreeze; delete p.usedFreeze; saveMe(p); syncPlayer();
  if(used) toast("A streak freeze saved your streak");
}
function quitSession(){
  const s=session; if(s&&!s.done&&s.i>0){ const p=studiedPatch(s.xp,s.boxes); delete p.usedFreeze; saveMe(p); syncPlayer();}
  if(s){view=s.ret;curTab=s.retTab||curTab;} session=null; render();
}
function sessionHTML(){
  const s=session,n=s.queue.length;
  const top=`<div class="sess-top"><button class="x" data-quit aria-label="Stop and go back">×</button><div class="prog"><span style="width:${Math.round((s.done?n:s.i+(s.answered?1:0))/n*100)}%"></span></div><span class="combo">${s.combo>=2&&!s.done?s.combo+" in a row":""}</span></div>`;
  if(s.done){
    return `<div class="sess">${top}<div class="result"><div class="big num">+${s.xp} XP</div><h2>${s.kind==="flash"?`You knew ${s.correct} of ${s.total} cards`:`${s.correct} of ${s.total} right first time`}</h2>
      <p class="hint">${s.missed&&s.missed.size?`${s.missed.size} card${s.missed.size===1?"":"s"} will come back tomorrow. `:""}Streak: ${S.me.streak||1} day${(S.me.streak||1)===1?"":"s"}${s.best>=3?` · best run ${s.best}`:""}</p>
      <div class="row"><button class="btn primary" data-quit>Continue</button></div></div></div>`;
  }
  const it=s.cur;
  if(s.kind==="flash"){
    return `<div class="sess">${top}<button class="flip" data-flip aria-label="Flip card">${s.flipped?`<span><span class="lbl">Definition</span><span class="def">${esc(it.k.def)}</span>${it.k.easy?`<span class="lbl" style="margin-top:14px">In plain words</span><span style="display:block;font-size:16px">${esc(it.k.easy)}</span>`:""}${it.k.example?`<span class="lbl" style="margin-top:14px">Example</span><span style="display:block;font-size:15px">${esc(it.k.example)}</span>`:""}</span>`:`<span><span class="lbl">Term · tap to flip</span><span class="big">${esc(it.k.term)}</span></span>`}</button>
      <div class="learn-btns"><button class="btn bad" data-know="0">Still learning</button><button class="btn ok" data-know="1">I know it</button></div></div>`;
  }
  const xtra=s.answered&&(it.k.easy||it.k.example)?`<br><span class="ans">${it.k.easy?`<b>${esc(it.k.term)}</b>: ${esc(it.k.easy)}`:""}${it.k.example?`<br>Example: ${esc(it.k.example)}`:""}</span>`:"";
  const fb=s.answered?`<div class="feedback ${s.right?"good":"badf"}"><span>${s.right?(s.close?"Almost! Watch the spelling.":"Correct!"):`Not quite.<br><span class="ans">Answer: ${esc(it.answer)}</span>`}${xtra}</span>
    <span class="row">${!s.right&&it.q==="type"?`<button class="btn sm" data-override>I was right</button>`:""}<button class="btn ${s.right?"ok":"bad"}" data-next>${s.right?"Continue":"Got it"}</button></span></div>`:"";
  if(it.q==="type"){
    return `<div class="sess">${top}<div><div class="q-sub">Type the term</div><div class="q-prompt">${esc(it.prompt)}</div></div>
      <form id="type-form" class="row"><input id="type-in" class="type-in" autocomplete="off" value="${esc(s.typed)}" ${s.answered?"disabled":""} placeholder="Your answer"><button class="btn primary" ${s.answered?"disabled":""}>Check</button></form>${fb}</div>`;
  }
  if(it.q==="self"){
    return `<div class="sess">${top}<div><div class="q-sub">Do you know what this means?</div><div class="q-prompt">${esc(it.prompt)}</div></div>
      ${s.flipped?`<div class="sum"><div class="sum-body">${esc(it.answer)}</div></div><div class="learn-btns"><button class="btn bad" data-self="0">I didn't know</button><button class="btn ok" data-self="1">I knew it</button></div>`:`<button class="btn primary big-cta" data-flip>Show answer</button>`}${fb}</div>`;
  }
  return `<div class="sess">${top}<div><div class="q-sub">${it.q==="mcr"?"Which term fits?":"What does this mean?"}</div><div class="q-prompt">${esc(it.prompt)}</div></div>
    <div class="opts">${it.options.map((o,i)=>`<button class="opt ${s.answered&&o===it.answer?"right":""} ${s.answered&&i===s.picked&&!s.right?"wrong":""}" data-pick="${i}" ${s.answered?"disabled":""}>${esc(o)}</button>`).join("")}</div>${fb}</div>`;
}

// ---------- modals & writes
function closeModal(){document.getElementById("modal-root").innerHTML="";if(genCtl){genCtl.abort();genCtl=null}}
function openModal(title,body,onSubmit,saveLabel="Save"){
  const root=document.getElementById("modal-root");
  root.innerHTML=`<div class="scrim" data-scrim><form class="modal" id="mform" novalidate><h2>${title}</h2>${body}<div class="err" id="merr" hidden></div>
    ${onSubmit?`<div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" id="msave">${saveLabel}</button></div>`:`<div class="modal-foot"><button type="button" class="btn" data-close>Close</button></div>`}</form></div>`;
  const f=document.getElementById("mform");
  f.addEventListener("submit",async ev=>{ev.preventDefault(); if(!onSubmit)return; const err=document.getElementById("merr"),btn=document.getElementById("msave");
    err.hidden=true;btn.disabled=true;btn.textContent="Saving…";
    try{const msg=await onSubmit(f);closeModal();if(msg)toast(msg);render();}
    catch(e){err.textContent=e.userMsg||friendlyErr(e);err.hidden=false;btn.disabled=false;btn.textContent=saveLabel;}});
  const first=f.querySelector("input:not([type=checkbox]),select,textarea"); if(first) first.focus();
  return f;
}
function friendlyErr(e){const c=e&&e.code;
  if(c==="42501")return "You can only change or remove things you added yourself.";
  if(c==="23505")return "That already exists.";
  if(c==="invalid_argument")return "You can view this dashboard but not add to it. Ask the owner for access.";
  if(c==="quota_exceeded"||c==="quota_or_state")return "Storage is full. Remove some old items and try again.";
  if(c==="too_large")return "That file is too big. The limit is 20 MB.";
  if(c==="rate_limited"||c==="resource_exhausted")return "Too many requests at once. Wait a moment and try again.";
  if(c==="not_granted")return "AI help was not allowed in this view.";
  if(c==="invalid_json")return "The AI answer came back in the wrong shape. Try again.";
  return "That didn't work. Check your connection and try again.";}
const fail=m=>{const e=new Error(m);e.userMsg=m;throw e};
const courseOpts=(sel,list)=>list.map(c=>`<option value="${c}" ${c===sel?"selected":""}>${esc(COURSES[c].name)}</option>`).join("");
function fileType(file){const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(["ppt","pptx","key","odp"].includes(ext))fail("Upload slides as a PDF. In PowerPoint: File › Save As › PDF.");
  if(["doc","docx","odt","pages"].includes(ext))fail("Save your summary as a PDF first, or paste the text instead.");
  const map={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",md:"text/markdown",txt:"text/plain"};
  if(!map[ext])fail("This file type isn't supported. Use PDF, an image, or a .txt/.md file."); return map[ext];}
async function uploadFile(file){ const type=fileType(file); const r=await Files.upload(file,{type}); return{id:r.id,name:file.name,type:r.contentType}; }
const stamp=()=>({createdAt:new Date().toISOString(),...(S.uid?{addedBy:S.uid}:{})});
const nextNum=c=>lessonsOf(c).reduce((m,l)=>Math.max(m,l.number||0),0)+1;

function lessonPicker(course,lessonId){
  const l=lessonId&&S.lessons.find(x=>x.id===lessonId); course=l?l.course:(course&&!NOLEARN.includes(course)?course:learnCourses()[0]);
  return `<div class="two"><div class="field"><label class="cap" for="f-course">Course</label><select id="f-course" data-lp>${courseOpts(course,learnCourses())}</select></div>
    <div class="field"><label class="cap" for="f-lesson">Lesson</label><select id="f-lesson">${lessonOpts(course,lessonId)}</select></div></div>
    <div class="field" id="f-newwrap" ${lessonOptsNew(course,lessonId)?"":"hidden"}><label class="cap" for="f-newtitle">New lesson topic</label><input id="f-newtitle" maxlength="120" placeholder="e.g. Market segmentation"></div>`;
}
const lessonOptsNew=(c,id)=>!id&&!lessonsOf(c).length;
function lessonOpts(c,sel){const ls=lessonsOf(c);return ls.map(l=>`<option value="${l.id}" ${l.id===sel?"selected":""}>${l.number}. ${esc(l.title)}</option>`).join("")+`<option value="__new" ${!sel&&!ls.length?"selected":""}>+ New lesson…</option>`;}
async function resolveLesson(f){
  const c=f.querySelector("#f-course").value, v=f.querySelector("#f-lesson").value;
  if(v!=="__new") return {id:v,course:c};
  const title=f.querySelector("#f-newtitle").value.trim(); if(!title) fail("Give the new lesson a topic.");
  const ref=await DB.collection("lessons").add({course:c,title,number:nextNum(c),date:T,...stamp()});
  return {id:ref.id,course:c};
}

function addMenu(){
  openModal("What do you want to add?",`<div class="menu">
    <button type="button" data-add="lesson"><b>Lesson + slides</b><span>Upload the PowerPoint or PDF from class</span></button>
    <button type="button" data-add="summary"><b>Summary</b><span>Your notes, a classmate's, or an AI version</span></button>
    <button type="button" data-add="card"><b>Flashcards</b><span>Terms and meanings to learn</span></button>
    <button type="button" data-add="deadline"><b>Deadline</b><span>Assignment, test or session</span></button></div>`,null);
}
function addDeadline(p={}){
  const list=Object.keys(COURSES).filter(c=>visible(c));
  openModal("Add deadline",`<div class="field"><label class="cap" for="f-title">What</label><input id="f-title" maxlength="120" placeholder="e.g. Trends paper"></div>
    <div class="two"><div class="field"><label class="cap" for="f-dc">Course</label><select id="f-dc">${courseOpts(p.course||"pie",list)}</select></div>
    <div class="field"><label class="cap" for="f-date">Date</label><input id="f-date" type="date" value="${p.date||T}"></div></div>
    <div class="field"><label class="cap" for="f-kind">Type</label><select id="f-kind">${Object.entries(KIND).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></div>`,
  async f=>{const title=f.querySelector("#f-title").value.trim(),date=f.querySelector("#f-date").value; if(!title)fail("Give the deadline a name."); if(!date)fail("Pick a date.");
    await DB.collection("deadlines").add({title,date,course:f.querySelector("#f-dc").value,kind:f.querySelector("#f-kind").value,...stamp()});
    calMonth=new Date(pd(date).getFullYear(),pd(date).getMonth(),1); selDay=date; return "Deadline added";});
}
function addSummary(p={}){
  openModal("Add summary",`${lessonPicker(p.course,p.lesson)}
    <div class="two"><div class="field"><label class="cap" for="f-kind">Type</label><select id="f-kind">${Object.entries(SUMKIND).map(([k,v])=>`<option value="${k}" ${k===(p.kind||"student")?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="field"><label class="cap" for="f-author">Written by (optional)</label><input id="f-author" maxlength="60" placeholder="Your name"></div></div>
    <div class="field"><label class="cap" for="f-text">Paste the text</label><textarea id="f-text" placeholder="Paste your notes here. Lines starting with - become bullets, # makes a heading."></textarea></div>
    <div class="field"><label class="cap" for="f-file">…or upload a file (PDF, .txt, .md)</label><input id="f-file" type="file" accept=".pdf,.txt,.md,.docx,.doc"></div>
    <p class="hint" style="margin:0">Tip: pasted text works best. It can be compared, merged and turned into flashcards.</p>`,
  async f=>{let text=f.querySelector("#f-text").value.trim(); const file=f.querySelector("#f-file").files[0]; let fileRef=null;
    if(file){const t=fileType(file); if(/^text\//.test(t)) text=(text?text+"\n\n":"")+(await file.text()).trim(); else if(t==="application/pdf") fileRef=await uploadFile(file); else fail("Use a PDF, .txt or .md file for summaries.");}
    if(!text&&!fileRef)fail("Paste some text or choose a file."); if(text.length>200000)fail("That text is too long. Split it into two summaries.");
    const L=await resolveLesson(f); const k=f.querySelector("#f-kind").value, author=f.querySelector("#f-author").value.trim();
    await DB.collection("summaries").add({lessonId:L.id,course:L.course,kind:k,...(author?{author}:{}),...(text?{text}:{}),...(fileRef?{file:fileRef}:{}),...stamp()});
    curTab="courses";view={name:"lesson",lessonId:L.id,tab:k}; session=null; return "Summary added";});
}
// ---------- AI helpers (sample)
let genCtl=null;
// ---------- slide reading (PDF via pdf.js, PowerPoint via JSZip; loaded only when needed)
const LIBS={pdf:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",pdfw:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",zip:"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"};
const _loaded={};
function loadScript(src){return _loaded[src]||(_loaded[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=()=>res();s.onerror=()=>{delete _loaded[src];rej(new Error("load"))};document.head.appendChild(s);}));}
const xmlDecode=t=>t.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,"&");
function xmlParas(xml){return xml.split(/<\/a:p>/).map(p=>[...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map(m=>xmlDecode(m[1])).join("").trim()).filter(Boolean);}
const slideNum=f=>Number((f.match(/(\d+)\.xml$/)||[0,0])[1]);
async function pptxSlides(buf){
  await loadScript(LIBS.zip); const zip=await window.JSZip.loadAsync(buf);
  const files=Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a,b)=>slideNum(a)-slideNum(b));
  const out=[];
  for(const f of files){
    const n=slideNum(f), text=xmlParas(await zip.file(f).async("string")).join("\n");
    let notes=""; const rel=zip.file(`ppt/slides/_rels/slide${n}.xml.rels`);
    if(rel){const m=(await rel.async("string")).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/); const nf=m&&zip.file("ppt/notesSlides/"+m[1]); if(nf) notes=xmlParas(await nf.async("string")).filter(p=>!/^\d+$/.test(p)).join("\n");}
    out.push({n:out.length+1,text:text.slice(0,4000),...(notes?{notes:notes.slice(0,3000)}:{})});
  }
  return out;
}
async function pdfSlides(buf){
  await loadScript(LIBS.pdf); await loadScript(LIBS.pdfw); // the worker script runs on the page, no separate worker needed
  const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true}).promise; const out=[];
  for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i); const tc=await pg.getTextContent(); let t=""; for(const it of tc.items) t+=(it.str||"")+(it.hasEOL?"\n":" ");
    out.push({n:i,text:t.replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim().slice(0,4000)});}
  return out;
}
function slideKind(file){const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(ext==="pptx") return "pptx"; if(ext==="pdf") return "pdf"; if(["png","jpg","jpeg","webp","gif"].includes(ext)) return "image";
  if(["ppt","key","odp"].includes(ext)) fail("Save it as .pptx or PDF first (File › Save As)."); fail("Use a PowerPoint (.pptx), PDF or image.");}
// returns {slides (asset ref or null), text ([] or slide list)}
async function handleSlideFile(file,status){
  const kind=slideKind(file); let asset=null, text=[];
  if(kind!=="pptx"){ status("Uploading…"); asset=await uploadFile(file); }
  if(kind!=="image"){ status("Reading the slides…"); try{ text=kind==="pdf"?await pdfSlides(await file.arrayBuffer()):await pptxSlides(await file.arrayBuffer()); }catch(e){ text=[]; } }
  if(kind==="pptx"&&!text.length) fail("This PowerPoint couldn't be read. Try saving it as PDF.");
  return {asset,text,kind};
}
async function saveSlideText(lessonId,text,kind){
  const has=text.filter(s=>s.text||s.notes); if(!has.length) return 0;
  let slides=text, size=JSON.stringify(slides).length; while(size>240000&&slides.length){slides=slides.map(s=>({...s,text:s.text.slice(0,Math.floor(s.text.length*.8)),...(s.notes?{notes:s.notes.slice(0,Math.floor(s.notes.length*.8))}:{})}));size=JSON.stringify(slides).length;}
  const mine=slides; slides=slides.map(({notes,...r})=>r);
  await DB.doc("slidetext/"+lessonId).set({lessonId,source:kind,slides,updatedAt:new Date().toISOString()}); delete S.slideCache[lessonId];
  if(mine.some(x=>x.notes)) await saveMyNotes(lessonId,mine);
  await DB.doc("lessons/"+lessonId).update({slideCount:text.length,hasText:true});
  return has.length;
}
const slideHint=`<p class="hint" style="margin:0">PowerPoint (.pptx) or PDF. The dashboard reads the slide text${""} and your notes under the slides, so flashcards can be made from them. To view the slides here, upload the PDF version.</p>`;
const aiBox=()=>true?`<label class="row hint"><input type="checkbox" id="f-ai" checked style="width:auto"> Make flashcards from the slides with an AI chat after saving (every course term, with an easy explanation and example)</label>`:"";

function addLesson(course,date){
  const c0=course&&!NOLEARN.includes(course)?course:learnCourses()[0];
  openModal("Add lesson",`<div class="two"><div class="field"><label class="cap" for="f-lc">Course</label><select id="f-lc">${courseOpts(c0,learnCourses())}</select></div>
    <div class="field"><label class="cap" for="f-date">Class date</label><input id="f-date" type="date" value="${date||T}"></div></div>
    <div class="field"><label class="cap" for="f-title">Topic</label><input id="f-title" maxlength="120" placeholder="e.g. Market segmentation"></div>
    ${true?`<div class="field"><label class="cap" for="f-file">Slides</label><input id="f-file" type="file" accept=".pptx,.pdf,.png,.jpg,.jpeg,.webp"></div>${slideHint}${aiBox()}`:`<p class="hint">Uploading slides needs Editor access. You can still add the lesson.</p>`}`,
  async f=>{const title=f.querySelector("#f-title").value.trim(); if(!title)fail("Give the lesson a topic."); const c=f.querySelector("#f-lc").value;
    const btn=document.getElementById("msave"), st=t=>{btn.textContent=t};
    const file=f.querySelector("#f-file")?.files[0]; let r={asset:null,text:[],kind:""}; if(file) r=await handleSlideFile(file,st);
    st("Saving…"); const ref=await DB.collection("lessons").add({course:c,title,number:nextNum(c),date:f.querySelector("#f-date").value||"",...(r.asset?{slides:r.asset}:{}),...(r.kind==="pptx"?{pptxName:file.name}:{}),...stamp()});
    const n=r.text.length?await saveSlideText(ref.id,r.text,r.kind):0;
    curTab="courses";view={name:"lesson",lessonId:ref.id,tab:"student"};
    if(n&&f.querySelector("#f-ai")?.checked) setTimeout(()=>genFromSlides(ref.id),0);
    return file&&r.kind!=="image"&&!n?"Lesson added, but no text was found in the slides":"Lesson added";});
}
function addSlides(lessonId){
  const l=S.lessons.find(x=>x.id===lessonId);
  openModal(l&&(l.slides||l.hasText)?"Replace slides":"Upload slides",`<div class="field"><label class="cap" for="f-file">Slides</label><input id="f-file" type="file" accept=".pptx,.pdf,.png,.jpg,.jpeg,.webp"></div>${slideHint}${aiBox()}`,
  async f=>{const file=f.querySelector("#f-file").files[0]; if(!file)fail("Choose a file."); const btn=document.getElementById("msave");
    const r=await handleSlideFile(file,t=>{btn.textContent=t}); const patch={};
    if(r.asset){patch.slides=r.asset;} if(r.kind==="pptx") patch.pptxName=file.name;
    const old=l?.slides; if(Object.keys(patch).length) await DB.doc("lessons/"+lessonId).update(patch);
    if(r.asset&&old&&old.id&&true) Files.delete(old.id).catch(()=>{});
    const n=r.text.length?await saveSlideText(lessonId,r.text,r.kind):0;
    if(n&&f.querySelector("#f-ai")?.checked) setTimeout(()=>genFromSlides(lessonId),0);
    return r.kind!=="image"&&!n?"Slides saved, but no text was found in them":"Slides saved";});
}
function addCard(p={}){
  openModal("Add flashcard",`${lessonPicker(p.course,p.lesson)}
    <div class="field"><label class="cap" for="f-term">Term</label><input id="f-term" maxlength="200" placeholder="e.g. Unique selling proposition (USP)"></div>
    <div class="field"><label class="cap" for="f-def">Definition</label><textarea id="f-def" style="min-height:90px" maxlength="1000" placeholder="The precise definition from the course"></textarea></div>
    <div class="field"><label class="cap" for="f-easy">In plain words (optional)</label><textarea id="f-easy" style="min-height:70px" maxlength="500" placeholder="How you'd explain it to a friend"></textarea></div>
    <div class="field"><label class="cap" for="f-ex">Example (optional)</label><input id="f-ex" maxlength="300" placeholder="A concrete business example"></div>
    <label class="row hint"><input type="checkbox" id="f-more" checked style="width:auto"> Add another after saving</label>`,
  async f=>{const term=f.querySelector("#f-term").value.trim(),def=f.querySelector("#f-def").value.trim(),easy=f.querySelector("#f-easy").value.trim(),example=f.querySelector("#f-ex").value.trim(); if(!term||!def)fail("Fill in at least the term and its definition.");
    const L=await resolveLesson(f); await DB.collection("cards").add({lessonId:L.id,course:L.course,term,def,...(easy?{easy}:{}),...(example?{example}:{}),...stamp()});
    if(f.querySelector("#f-more").checked) setTimeout(()=>addCard({lesson:L.id}),0); else {curTab="courses";view={name:"lesson",lessonId:L.id,tab:view.tab||"student"};} return "Card added";});
}

// ---------- AI flashcards
// ---------- AI help without a subscription: copy the instructions into any AI chat, paste the answer back
const CARD_PROMPT=`You make exam flashcards for students of the Belgian "banaba" International Business Management program at HOGENT.
Below is lecture material for one lesson. Extract EVERY course-specific term: concepts, models, frameworks, theories, methods, abbreviations, named ratios or laws, and key figures a lecturer could ask about on the exam. Skip everyday words, slide titles that are not concepts, people's names unless they name a theory, and logistics (dates, rooms, assignments, grading).
For each term give:
- "term": as written in the material, in its language; add the abbreviation in brackets when there is one, e.g. "Key Performance Indicator (KPI)"
- "def": the precise course definition, faithful to the material, 1 or 2 sentences, at most 300 characters
- "easy": the same idea in plain everyday words, as you would explain it to a friend, at most 200 characters
- "example": one short concrete business example when it helps understanding, otherwise ""; at most 200 characters
- "slide": the slide number where it is explained, or null
Write def, easy and example in the same language as the material. Never contradict the material; if it only names a term, define it the standard textbook way.
Reply with ONLY a JSON array (no other text), for example [{"term":"Unique Selling Proposition (USP)","def":"...","easy":"...","example":"...","slide":4}].`;
const cleanCard=k=>({term:String(k.term||"").trim().slice(0,200),def:String(k.def||"").trim().slice(0,1000),easy:String(k.easy||"").trim().slice(0,500),example:String(k.example||"").trim().slice(0,300),slide:Number.isFinite(+k.slide)&&k.slide!==null&&k.slide!==""?+k.slide:null});
function dedupe(cards,existing){const seen=new Set(existing.map(norm)); return cards.filter(k=>{const n=norm(k.term); if(!n||seen.has(n)) return false; seen.add(n); return true;});}
function parseJSONLoose(t){
  t=String(t||"").trim(); const fence=t.match(/```(?:json)?\s*([\s\S]*?)```/); if(fence) t=fence[1].trim();
  const a=t.indexOf("["), b=t.lastIndexOf("]"); if(a<0||b<a) fail("I couldn't find the list in that answer. Copy the AI's whole answer, including the [ and ].");
  try{ return JSON.parse(t.slice(a,b+1)); }catch(e){ fail("The answer was cut off or isn't a clean list. Ask the AI to “continue” or try again, then paste the full answer."); }
}
let _ai=null;
function aiPasteModal(o){
  _ai={prompt:o.prompt,read:o.read,result:null};
  openModal(o.title,`<p class="hint" style="margin:0">${o.intro}</p>
    <div class="ai-steps">
      <div class="ai-step"><span class="ai-n">1</span><div><b>Copy the instructions</b><span class="hint">They already contain the lesson material (${Math.max(1,Math.round(o.prompt.length/1000))}k characters).</span>
        <div class="row" style="margin-top:8px"><button type="button" class="btn sm primary" data-copyprompt>Copy instructions</button><a class="btn sm" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a><a class="btn sm" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a></div>
        <textarea id="ai-prompt" readonly hidden></textarea></div></div>
      <div class="ai-step"><span class="ai-n">2</span><div><b>Paste them in a new AI chat and send</b><span class="hint">Any AI chat works. Wait until the answer is complete.</span></div></div>
      <div class="ai-step"><span class="ai-n">3</span><div style="min-width:0;flex:1"><b>Copy the whole answer and paste it here</b>
        <textarea id="ai-answer" placeholder="Paste the AI's answer here" style="width:100%;min-height:110px;margin-top:8px"></textarea>
        <button type="button" class="btn sm" data-readanswer style="margin-top:8px">Read answer</button></div></div>
    </div><div id="ai-result"></div>`,
  async f=>{ if(!_ai||!_ai.result) fail("Paste the answer and press “Read answer” first."); return await o.save(_ai.result,f); }, o.saveLabel||"Save");
  document.getElementById("msave").disabled=true;
}
function copyPrompt(){
  const t=_ai&&_ai.prompt; if(!t) return;
  const fallback=()=>{const ta=document.getElementById("ai-prompt"); ta.hidden=false; ta.value=t; ta.style.width="100%"; ta.style.minHeight="90px"; ta.focus(); ta.select(); toast("Select all and copy (Ctrl+C / long-press)");};
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(()=>toast("Instructions copied. Paste them in the AI chat.")).catch(fallback); else fallback();
}
function readAnswer(){
  const out=document.getElementById("ai-result"), txt=document.getElementById("ai-answer").value;
  try{ const r=_ai.read(txt); _ai.result=r.value; out.innerHTML=r.html; document.getElementById("msave").disabled=!r.ok; }
  catch(e){ _ai.result=null; out.innerHTML=`<p class="err">${esc(e.userMsg||"That answer couldn't be read.")}</p>`; document.getElementById("msave").disabled=true; }
}
function cardsPicker(cards){
  return `<div class="row" style="justify-content:space-between;margin:10px 0 8px"><b>${cards.length} new terms found</b><button type="button" class="linkbtn" data-toggleall>Untick all</button></div>
    <div class="gen-list">${cards.map((k,i)=>`<label><input type="checkbox" data-gi="${i}" checked><span><b>${esc(k.term)}</b>${k.slide!=null?` <span class="hint">· slide ${k.slide}</span>`:""}<br>${esc(k.def)}${k.easy?`<br><span class="hint">In plain words: ${esc(k.easy)}</span>`:""}${k.example?`<br><span class="hint">Example: ${esc(k.example)}</span>`:""}</span></label>`).join("")}</div>`;
}
function cardsFlow(lessonId,title,intro,material){
  const l=S.lessons.find(x=>x.id===lessonId); const existing=S.cards.filter(k=>k.lessonId===lessonId).map(k=>k.term);
  const prompt=`${CARD_PROMPT}\n\nCourse: ${COURSES[l?.course]?.name||""}\nLesson: ${l?.title||""}\nThese terms already have cards, skip them: ${existing.length?existing.join("; "):"(none)"}\n\n${material}`;
  aiPasteModal({title,intro,prompt,saveLabel:"Save cards",
    read:txt=>{const arr=parseJSONLoose(txt); const cards=dedupe((Array.isArray(arr)?arr:[]).filter(x=>x&&x.term&&x.def).map(cleanCard),existing);
      return {ok:cards.length>0,value:cards,html:cards.length?cardsPicker(cards):`<p class="empty">No new terms in that answer.</p>`};},
    save:async(cards,f)=>{const picks=[...f.querySelectorAll("[data-gi]:checked")].map(x=>cards[Number(x.dataset.gi)]); if(!picks.length) fail("Tick at least one card.");
      const rows=picks.map(k=>({lesson_id:lessonId,course:l?.course||"",term:k.term,def:k.def,easy:k.easy||null,example:k.example||null,slide:k.slide,source:"ai"}));
      document.getElementById("msave").textContent="Saving…"; for(let i=0;i<rows.length;i+=100) await q(sb.from("cards").insert(rows.slice(i,i+100)));
      scheduleReload("cards"); return `${picks.length} flashcards added`;}});
}
async function genFromSlides(lessonId){
  let slides=[]; try{const snap=await DB.doc("slidetext/"+lessonId).get(); slides=(snap.exists&&snap.data().slides)||[];}catch(e){}
  if(!slides.length){toast("No slide text for this lesson yet. Upload the PowerPoint or PDF first.");return;}
  const master=S.master.filter(m=>m.lessonId===lessonId);
  const material=slides.map(s=>{const m=master.find(x=>x.slide===s.n); return `[Slide ${s.n}]\n${s.text||""}${m?`\nClass notes for this slide: ${m.text}`:""}`;}).join("\n\n");
  cardsFlow(lessonId,"Flashcards from the slides","Let an AI chat pick out every course term from the slides, with a precise definition, an easy explanation and an example. Untick any you don't want before saving.",material);
}
function genCards(sumId){
  const s=S.summaries.find(x=>x.id===sumId); if(!s||!s.text) return;
  cardsFlow(s.lessonId,"Flashcards from this summary","Let an AI chat pick out the course terms from this summary. Untick any you don't want before saving.","Lesson notes:\n"+s.text.slice(0,120000));
}
function genMerge(lessonId){
  const l=S.lessons.find(x=>x.id===lessonId); const srcs=S.summaries.filter(s=>s.lessonId===lessonId&&s.text&&(s.kind||"student")!=="merged");
  if(!srcs.length){toast("Add at least one summary as text first.");return;}
  const label=s=>(s.kind==="ai"?"AI summary":(s.author||nameOf(s.addedBy)));
  const prompt=`Merge these summaries of the same lesson into one complete master summary for exam study.
Keep every correct point from every source, remove duplicates (also when worded differently), and order it logically. When sources disagree, say so in one short line starting with ⚠.
After a point that only one source mentions, add "(only in: <source name>)".
Use Markdown: "# " headings, "- " bullets, **bold** for key terms. Write in the same language as the sources. Reply with only the summary.

Course: ${COURSES[l.course]?.name||""}
Lesson: ${l.title}

${srcs.map((s,i)=>`--- Source ${i+1}: ${label(s)} ---\n${s.text}`).join("\n\n").slice(0,180000)}`;
  aiPasteModal({title:"Merge into master summary",intro:`Combine ${srcs.length} summar${srcs.length===1?"y":"ies"} into one complete version with an AI chat. Points only one source mentions are marked.`,prompt,saveLabel:"Save master summary",
    read:txt=>{const t=String(txt||"").trim().replace(/^```(?:markdown|md)?\s*/,"").replace(/```\s*$/,""); if(t.length<40) fail("That answer looks too short. Paste the whole summary.");
      return {ok:true,value:t,html:`<div class="preview sum-body" style="margin-top:10px">${md(t)}</div>`};},
    save:async t=>{await DB.collection("summaries").add({lessonId,course:l.course,kind:"merged",text:t,...stamp()}); view.tab="merged"; return "Master summary saved";}});
}
// ---------- notes per slide (from each student's PowerPoint)
S.slideCache={};
async function loadSlideCache(id){ if(S.slideCache[id]!==undefined) return; S.slideCache[id]=null;
  try{const snap=await DB.doc("slidetext/"+id).get(); S.slideCache[id]=(snap.exists&&snap.data().slides)||[];}catch(e){S.slideCache[id]=[];} if(!session) render(); }
function alignNotes(base,student){
  const map={};
  for(const s of student||[]){ let n=s.n; if(s.head){const hit=base.find(b=>(b.text||"").slice(0,80)===s.head); if(hit) n=hit.n;} if(s.notes) (map[n]=map[n]||[]).push(s.notes); }
  return map;
}
function notesTabHTML(l){
  const base=S.slideCache[l.id];
  if(base===undefined||base===null){ if(base===undefined) setTimeout(()=>loadSlideCache(l.id),0); return `<p class="empty">Loading the slides…</p>`; }
  const notes=S.notes.filter(n=>n.lessonId===l.id), master=S.master.filter(m=>m.lessonId===l.id);
  const head=`<div class="row" style="margin-bottom:12px">${canAdd()?`<button class="btn sm add" data-mynotes="${l.id}">${notes.some(n=>n.userId===S.uid)?"Update my notes":"Add my notes"}</button>`:""}${S.isAdmin&&notes.length?`<button class="btn sm ai" data-mergenotes="${l.id}">Merge notes with AI</button>`:""}<span class="hint">${notes.length} student${notes.length===1?"":"s"} shared notes</span></div>`;
  if(!base.length&&!notes.length) return head+`<p class="empty">Upload your PowerPoint with your notes under the slides. Everyone's notes then appear here per slide, and they can be merged into one complete set.</p>`;
  const per=notes.map(n=>({who:nameOf(n.userId),me:n.userId===S.uid,map:alignNotes(base,n.slides)}));
  const nums=[...new Set([...base.map(b=>b.n),...per.flatMap(p=>Object.keys(p.map).map(Number))])].sort((a,b)=>a-b);
  return head+nums.map(n=>{const b=base.find(x=>x.n===n), m=master.find(x=>x.slide===n), ns=per.filter(p=>p.map[n]);
    if(!ns.length&&!m&&!(b&&b.text)) return "";
    return `<article class="slide-card"><div class="q-sub">Slide ${n}</div>${b&&b.text?`<div class="slide-txt">${esc(b.text.slice(0,400))}${b.text.length>400?"…":""}</div>`:""}
      ${m?`<div class="master-note"><b>Master note</b><div class="sum-body">${md(m.text)}</div></div>`:""}
      ${ns.length?`<details ${m?"":"open"}><summary class="hint">${ns.length} student note${ns.length===1?"":"s"}</summary>${ns.map(p=>`<div class="st-notes"><b>${esc(p.who)}${p.me?" (you)":""}:</b> <span style="white-space:pre-wrap">${esc(p.map[n].join("\n"))}</span></div>`).join("")}</details>`:""}</article>`;}).join("");
}
function addMyNotes(lessonId){
  openModal("Add my notes",`<div class="field"><label class="cap" for="f-file">Your PowerPoint (.pptx) with notes under the slides</label><input id="f-file" type="file" accept=".pptx"></div>
    <p class="hint" style="margin:0">Only the text of your notes is shared, per slide. Uploading again replaces your previous notes.</p>`,
  async f=>{const file=f.querySelector("#f-file").files[0]; if(!file) fail("Choose your .pptx file."); if(slideKind(file)!=="pptx") fail("Notes can only be read from a PowerPoint (.pptx).");
    document.getElementById("msave").textContent="Reading…"; const text=await pptxSlides(await file.arrayBuffer());
    const n=await saveMyNotes(lessonId,text); if(!n) fail("No notes found under the slides of this PowerPoint.");
    if(!S.lessons.find(x=>x.id===lessonId)?.hasText) await saveSlideText(lessonId,text,"pptx");
    view.tab="slides"; return `Your notes for ${n} slide${n===1?"":"s"} are shared`;},"Share my notes");
}
async function saveMyNotes(lessonId,text){
  const slides=text.filter(s=>s.notes).map(s=>({n:s.n,head:(s.text||"").slice(0,80),notes:s.notes}));
  if(!slides.length) return 0;
  await q(sb.from("slide_notes").upsert({lesson_id:lessonId,user_id:S.uid,slides,updated_at:new Date().toISOString()},{onConflict:"lesson_id,user_id"}));
  scheduleReload("slide_notes"); return slides.length;
}
function genMergeNotes(lessonId){
  const l=S.lessons.find(x=>x.id===lessonId), base=S.slideCache[lessonId]||[], notes=S.notes.filter(n=>n.lessonId===lessonId);
  const per=notes.map(n=>({who:nameOf(n.userId),map:alignNotes(base,n.slides)}));
  const nums=[...new Set(per.flatMap(p=>Object.keys(p.map).map(Number)))].sort((a,b)=>a-b);
  if(!nums.length){toast("No student notes to merge yet.");return;}
  const material=nums.map(n=>{const b=base.find(x=>x.n===n); return `[Slide ${n}]\nOn the slide: ${(b&&b.text||"(no text)").slice(0,1500)}\nStudent notes:\n${per.filter(p=>p.map[n]).map(p=>`- ${p.who}: ${p.map[n].join(" / ")}`).join("\n")}`;}).join("\n\n");
  const prompt=`You merge students' class notes into ONE complete master note per slide, for exam study.
Rules:
- Keep every distinct point from every student. Points that mean the same thing are kept once, even when worded differently: no duplicates.
- Only use what the students wrote. Do not add new information. You may fix spelling and make it clearer.
- Do not repeat what is already literally on the slide, unless the note adds something to it.
- If students contradict each other, keep both and start that line with ⚠.
- Write short bullet points starting with "- ", in the same language as the notes.
Reply with ONLY a JSON array (no other text) with one item per slide below, for example [{"slide":3,"note":"- first point\\n- second point"}].

Course: ${COURSES[l.course]?.name||""}
Lesson: ${l.title}

${material}`.slice(0,190000);
  aiPasteModal({title:"Merge notes per slide",intro:`Combine the notes of ${notes.length} student${notes.length===1?"":"s"} into one master note per slide, without duplicates.`,prompt,saveLabel:"Save master notes",
    read:txt=>{const arr=parseJSONLoose(txt); const items=(Array.isArray(arr)?arr:[]).filter(x=>x&&Number.isFinite(+x.slide)&&x.note).map(x=>({slide:+x.slide,note:String(x.note).trim().slice(0,4000)}));
      return {ok:items.length>0,value:items,html:items.length?`<div class="preview" style="margin-top:10px">${items.map(x=>`<div class="st-slide"><div class="q-sub">Slide ${x.slide}</div><div class="sum-body">${md(x.note)}</div></div>`).join("")}</div>`:`<p class="empty">No slide notes in that answer.</p>`};},
    save:async items=>{await q(sb.from("master_notes").upsert(items.map(x=>({lesson_id:lessonId,slide:x.slide,text:x.note,updated_at:new Date().toISOString()})))); scheduleReload("master_notes"); view.tab="slides"; return `Master notes saved for ${items.length} slides`;}});
}
async function showSlideText(lessonId){
  const l=S.lessons.find(x=>x.id===lessonId);
  openModal(`Slide text · ${esc(l?.title||"")}`,`<div class="preview" id="st-out"><p class="empty">Loading…</p></div>`,null);
  try{const snap=await DB.doc("slidetext/"+lessonId).get(); const slides=(snap.exists&&snap.data().slides)||[]; const o=document.getElementById("st-out"); if(!o) return;
    o.innerHTML=slides.length?slides.map(s=>`<div class="st-slide"><div class="q-sub">Slide ${s.n}</div><div style="white-space:pre-wrap">${esc(s.text||"(no text)")}</div></div>`).join(""):`<p class="empty">No slide text saved.</p>`;}
  catch(e){const o=document.getElementById("st-out"); if(o) o.innerHTML=`<p class="err">${esc(friendlyErr(e))}</p>`;}
}

async function removeItem(col,id){
  try{
    if(col==="lessons"){const l=S.lessons.find(x=>x.id===id);await DB.doc("lessons/"+id).delete();if(l?.slides?.id&&true)Files.delete(l.slides.id).catch(()=>{});view={name:"course",course:l?.course||"mkt"};}
    else if(col==="summaries"){const s=S.summaries.find(x=>x.id===id);await DB.doc("summaries/"+id).delete();if(s?.file?.id&&true)Files.delete(s.file.id).catch(()=>{});}
    else await DB.doc(col+"/"+id).delete();
    toast("Removed"); render();
  }catch(e){toast(friendlyErr(e));}
}

// ---------- events
document.addEventListener("click",ev=>{
  if(ev.target.closest("[data-jump]")){ if(session){quitSession();} curTab="class"; render(); window.scrollTo({top:0}); return; }
  const t=ev.target.closest("button,[data-scrim]"); if(!t) return;
  if(t.matches("[data-scrim]")){if(ev.target===t)closeModal();return;}
  const d=t.dataset;
  if(d.close!==undefined){closeModal();return;}
  if(d.add){ const c=d.c||(view.name==="course"?view.course:view.name==="lesson"?S.lessons.find(l=>l.id===view.lessonId)?.course:undefined);
    if(document.getElementById("modal-root").innerHTML&&d.add!=="menu") closeModal();
    if(d.add==="menu")addMenu(); else if(d.add==="deadline")addDeadline({course:c,date:d.date}); else if(d.add==="lesson")addLesson(c,d.date);
    else if(d.add==="slides")addSlides(d.lesson); else if(d.add==="summary")addSummary({course:c,lesson:d.lesson||(view.name==="lesson"?view.lessonId:undefined),kind:d.kind});
    else if(d.add==="card")addCard({course:c,lesson:d.lesson||(view.name==="lesson"?view.lessonId:undefined)}); return; }
  if(d.done){const set=new Set(S.me.done||[]); if(set.has(d.done))set.delete(d.done); else {set.add(d.done);toast("Done. One less thing to worry about.")} saveMe({done:[...set]}); return;}
  if(d.del){ if(!t.classList.contains("armed")){t.classList.add("armed");t.innerHTML="Remove?";setTimeout(()=>{if(t.isConnected){t.classList.remove("armed");t.innerHTML=ICON_TRASH}},3000);return;} const [col,id]=d.del.split(":");removeItem(col,id);return;}
  if(d.profile!==undefined){closeModal();openProfile(false);return;}
  if(d.genCards){genCards(d.genCards);return;}
  if(d.genslides){genFromSlides(d.genslides);return;}
  if(d.slidetext){showSlideText(d.slidetext);return;}
  if(d.toggleall!==undefined){const bs=[...document.querySelectorAll("[data-gi]")]; const on=bs.some(b=>!b.checked); bs.forEach(b=>b.checked=on); t.textContent=on?"Untick all":"Tick all"; return;}
  if(d.merge){genMerge(d.merge);return;}
  if(d.learn){ if(d.learn==="flash")startFlash(view.lessonId); else if(d.learn==="lesson"){const l=S.lessons.find(x=>x.id===view.lessonId);startLearn("lesson",view.lessonId,l?.title);} else if(d.learn==="course")startLearn("course",d.c,COURSES[d.c]?.name); else startLearn(d.learn); return;}
  if(d.lesson){curTab="courses";view={name:"lesson",lessonId:d.lesson,tab:"student"};session=null;render();window.scrollTo({top:0});return;}
  if(d.tabgo){curTab=d.tabgo;session=null;if(d.tabgo==="courses")view={name:"home"};render();window.scrollTo({top:0});return;}
  if(d.course){curTab="courses";view={name:"course",course:d.course};session=null;render();window.scrollTo({top:0});return;}
  if(d.go){curTab=d.go;view={name:"home"};session=null;render();window.scrollTo({top:0});return;}
  if(d.tab){view.tab=d.tab;render();return;}
  if(d.cal){calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+Number(d.cal),1);document.getElementById("cal-panel").innerHTML=agendaHTML();return;}
  if(d.day){selDay=d.day;document.getElementById("cal-panel").innerHTML=agendaHTML();return;}
  if(d.agenda){agendaMode=d.agenda;document.getElementById("cal-panel").innerHTML=agendaHTML();return;}
  if(d.week){weekStart=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+7*Number(d.week));document.getElementById("cal-panel").innerHTML=agendaHTML();return;}
  if(d.import!==undefined){importClasses();return;}
  if(d.toggleAll!==undefined){showAll=!showAll;render();return;}
  if(!session) return;
  const s=session;
  if(d.quit!==undefined){quitSession();return;}
  if(d.flip!==undefined){s.flipped=!s.flipped;render();return;}
  if(d.know!==undefined){const k=s.cur.k,b=s.boxes[k.id]?s.boxes[k.id][0]:0; if(d.know==="1"){const nb=Math.min(5,b+1);s.boxes[k.id]=[nb,addDays(TODAY,INTERVALS[nb])];s.correct++;s.xp+=2;} else s.boxes[k.id]=[1,T]; nextQ(); return;}
  if(d.self!==undefined){s.answered=true;s.right=d.self==="1";grade(s.right);render();return;}
  if(d.pick!==undefined&&!s.answered){s.picked=Number(d.pick);s.answered=true;s.right=s.cur.options[s.picked]===s.cur.answer;grade(s.right);render();return;}
  if(d.override!==undefined){ // undo the miss
    const k=s.cur.k; if(!s.cur.retry){const prev=(S.me.boxes||{})[k.id]; const b=prev?prev[0]:0, nb=Math.min(5,b+1); s.boxes[k.id]=[nb,addDays(TODAY,INTERVALS[nb])]; s.missed.delete(k.id); s.queue=s.queue.filter((q,i)=>i<=s.i||!(q.retry&&q.k.id===k.id)); s.correct++; s.xp+=15;}
    s.right=true; s.combo=1; render(); return; }
  if(d.next!==undefined){nextQ();return;}
});
document.addEventListener("submit",ev=>{
  if(ev.target.id!=="type-form") return; ev.preventDefault(); const s=session; if(!s||s.answered) return;
  const val=document.getElementById("type-in").value; if(!val.trim()) return;
  s.typed=val; const a=norm(val), b=norm(s.cur.answer); const dist=lev(a,b);
  s.right=a===b||dist<=Math.max(1,Math.floor(b.length*0.15)); s.close=s.right&&a!==b; s.answered=true; grade(s.right); render();
});
document.addEventListener("keydown",ev=>{
  if(ev.key==="Escape"&&document.getElementById("modal-root").innerHTML){closeModal();return;}
  if(ev.key==="Enter"&&session&&session.answered&&!document.getElementById("modal-root").innerHTML){ev.preventDefault();nextQ();}
});
document.addEventListener("change",ev=>{
  const id=ev.target.id;
  if(id==="third")saveMe({third:ev.target.value});
  if(id==="frlvl")saveMe({fr:ev.target.value});
  if(id==="goalsel")saveMe({goal:Number(ev.target.value)});
  if(id==="f-course"&&ev.target.dataset.lp!==undefined){const c=ev.target.value,ls=document.getElementById("f-lesson");ls.innerHTML=lessonOpts(c,null);document.getElementById("f-newwrap").hidden=ls.value!=="__new";}
  if(id==="p-pick"){document.getElementById("p-otherwrap").hidden=ev.target.value!=="__other";}
  if(id==="f-lesson"){document.getElementById("f-newwrap").hidden=ev.target.value!=="__new";}
});

// ---------- login (pick your name + your own password; no email needed)
const slugName=n=>String(n).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const emailFor=n=>`${slugName(n)}@ibmaster.app`;
let login={pick:null,taken:new Set(),err:"",busy:false,ready:false};
function loginHTML(){
  if(!login.ready) return `<div class="login"><p class="empty">Loading…</p></div>`;
  if(!login.pick) return `<div class="login"><div class="login-hero"><div class="brand-big">IB<span>Master</span></div><p class="hint">I Become a Master · the study app of the banaba IBM class</p></div>
    <section class="panel"><h2 style="margin-bottom:12px">Who are you?</h2><div class="name-grid">${S.roster.map(n=>`<button class="name-btn" data-pickname="${esc(n)}"><span class="name-av">${esc(n.charAt(0))}</span><span>${esc(n)}</span>${login.taken.has(n)?`<span class="hint">log in</span>`:`<span class="hint">new</span>`}</button>`).join("")}</div>
    <p class="hint" style="margin:14px 0 0">Your name isn't in the list? Ask Loïc to add it.</p></section></div>`;
  const n=login.pick, isNew=!login.taken.has(n);
  return `<div class="login"><div class="login-hero"><div class="brand-big">IB<span>Master</span></div></div>
    <form class="panel login-form" id="login-form" novalidate><div class="row" style="justify-content:space-between"><h2>${isNew?`Welcome, ${esc(n)}!`:`Hi ${esc(n)}, welcome back`}</h2><button type="button" class="linkbtn" data-pickname="">Not you?</button></div>
      ${isNew?`<p class="hint" style="margin:0">Choose a password for your account. You'll use it to log in on any device.</p>`:""}
      <div class="field"><label class="cap" for="l-pw">Password</label><input id="l-pw" type="password" autocomplete="${isNew?"new-password":"current-password"}" minlength="6" required></div>
      ${isNew?`<div class="field"><label class="cap" for="l-pw2">Repeat password</label><input id="l-pw2" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="two"><div class="field"><label class="cap" for="l-fr">French group</label><select id="l-fr"><option value="basic">Basic · Katrien Ermens</option><option value="advanced">Advanced · Poitiers</option></select></div>
      <div class="field"><label class="cap" for="l-third">3rd language</label><select id="l-third"><option value="es">Spanish</option><option value="de">German</option></select></div></div>`:""}
      ${login.err?`<p class="err" style="margin:0">${esc(login.err)}</p>`:""}
      <button class="btn primary big-cta" ${login.busy?"disabled":""}>${login.busy?"One moment…":isNew?"Create my account":"Log in"}</button>
      ${isNew?"":`<p class="hint" style="margin:0">Forgot your password? Ask Loïc to reset your account.</p>`}</form></div>`;
}
async function doLogin(f){
  const n=login.pick, isNew=!login.taken.has(n), pw=f.querySelector("#l-pw").value;
  login.err=""; if(pw.length<6){login.err="Use at least 6 characters.";return render();}
  if(isNew&&pw!==f.querySelector("#l-pw2").value){login.err="The two passwords don't match.";return render();}
  login.busy=true; render();
  try{
    if(isNew){
      const fr=f.querySelector("#l-fr").value, third=f.querySelector("#l-third").value;
      const {data,error}=await sb.auth.signUp({email:emailFor(n),password:pw});
      if(error) throw new Error(/registered|exists/i.test(error.message)?"This name already has an account. Log in instead, or ask Loïc.":error.message);
      if(!data.session) throw new Error("Account made, but email confirmation is still on in Supabase. Ask Loïc to turn it off.");
      const {error:e2}=await sb.from("profiles").insert({id:data.user.id,name:n,fr,third});
      if(e2){await sb.auth.signOut(); throw new Error(e2.code==="23505"?"Someone just claimed this name. Ask Loïc.":e2.message);}
      await enter(data.user.id,true);
    } else {
      const {data,error}=await sb.auth.signInWithPassword({email:emailFor(n),password:pw});
      if(error) throw new Error(/invalid/i.test(error.message)?"Wrong password. Try again.":error.message);
      await enter(data.user.id,false);
    }
  }catch(e){ login.err=e.message||"That didn't work. Try again."; }
  login.busy=false; render();
}
async function showLogin(){
  S.uid=null; login.ready=false; render();
  try{ const [r,t]=await Promise.all([q(sb.from("roster").select("name")),q(sb.rpc("taken_names"))]);
    S.roster=r.map(x=>x.name).sort((a,b)=>a.localeCompare(b)); login.taken=new Set((t||[]).map(x=>typeof x==="string"?x:x.taken_names||Object.values(x)[0])); }
  catch(e){ login.err="Can't reach the server. Check your internet connection and reload."; }
  login.ready=true; render();
}
async function enter(uid,isNew){
  S.uid=uid;
  const has=await loadMe();
  if(!has){ await sb.auth.signOut(); S.uid=null; return showLogin(); }
  try{ S.roster=(await q(sb.from("roster").select("name"))).map(x=>x.name).sort((a,b)=>a.localeCompare(b)); }catch(e){}
  await Promise.all(Object.keys(LOADERS).map(reload));
  startLive(); curTab="home"; render();
  if(isNew) toast(`Welcome to IBMaster, ${S.me.name}!`);
}
function openProfile(){
  openModal("Your profile",`<p style="margin:0"><b>${esc(S.me.name||"")}</b>${S.isAdmin?` <span class="chip" style="--cc:var(--accent)">admin</span>`:""}</p>
    <div class="two"><div class="field"><label class="cap" for="p-fr">French group</label><select id="p-fr"><option value="basic" ${S.me.fr==="basic"?"selected":""}>Basic · Katrien Ermens</option><option value="advanced" ${S.me.fr==="advanced"?"selected":""}>Advanced · Poitiers</option></select></div>
    <div class="field"><label class="cap" for="p-third">3rd language</label><select id="p-third"><option value="es" ${S.me.third==="es"?"selected":""}>Spanish</option><option value="de" ${S.me.third==="de"?"selected":""}>German</option></select></div></div>
    <label class="row hint"><input type="checkbox" id="p-hide" ${S.me.hideBoard?"checked":""} style="width:auto"> Hide my score on the class leaderboard</label>
    <button type="button" class="btn" data-logout style="justify-self:start">Log out</button>`,
  async f=>{saveMe({fr:f.querySelector("#p-fr").value,third:f.querySelector("#p-third").value,hideBoard:f.querySelector("#p-hide").checked}); return "Profile saved";},"Save");
}
// wrap render: logged-out screen + hide app chrome
const _renderApp=render;
render=function(){
  const out=!S.uid;
  document.querySelector(".stats").hidden=out; document.getElementById("tabnav").hidden=out;
  if(out){ document.getElementById("main").innerHTML=loginHTML(); return; }
  _renderApp();
};
document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-pickname],[data-open],[data-copyprompt],[data-readanswer],[data-mynotes],[data-mergenotes],[data-logout]"); if(!t) return;
  const d=t.dataset;
  if(d.pickname!==undefined){ login.pick=d.pickname||null; login.err=""; render(); setTimeout(()=>document.getElementById("l-pw")?.focus(),30); return; }
  if(d.open){ Files.open(d.open); return; }
  if(d.copyprompt!==undefined){ copyPrompt(); return; }
  if(d.readanswer!==undefined){ readAnswer(); return; }
  if(d.mynotes){ closeModal(); addMyNotes(d.mynotes); return; }
  if(d.mergenotes){ genMergeNotes(d.mergenotes); return; }
  if(d.logout!==undefined){ sb.auth.signOut().finally(()=>location.reload()); return; }
},true);
document.addEventListener("submit",ev=>{ if(ev.target.id==="login-form"){ ev.preventDefault(); doLogin(ev.target); } });
(async()=>{
  render();
  const {data}=await sb.auth.getSession();
  if(data&&data.session){ try{ await enter(data.session.user.id,false); }catch(e){ showLogin(); } }
  else showLogin();
})();
