// ВАЖНО: ваш Apps Script Web App URL (именно /exec)
const API_BASE = "https://script.google.com/macros/s/AKfycbyLTvVXYNZ2UX4VpH9teQHWEG7wnxygFIyIznR3cTmXY-flzYetHF82Rrhffsquwu5erg/exec";

// DOM
const statusEl = document.getElementById("status");
const emailEl  = document.getElementById("email");
const claimBtn = document.getElementById("claimBtn");
const openBtn  = document.getElementById("openBtn");

// Достаём токен из ?token=..., #token=..., /t/<token>
function getToken() {
  const qs = new URLSearchParams(location.search);
  if (qs.get("token")) return (qs.get("token")||"").trim();
  const hash = (location.hash||"").replace(/^#/,"");
  const hs = new URLSearchParams(hash);
  if (hs.get("token")) return (hs.get("token")||"").trim();
  const parts = location.pathname.split("/").filter(Boolean);
  const i = parts.findIndex(p => p.toLowerCase()==="t" || p.toLowerCase()==="token");
  if (i>=0 && parts[i+1]) return parts[i+1].trim();
  return "";
}
const TOKEN = getToken();

function setStatus(msg,type){ statusEl.textContent=msg||""; statusEl.className="status"+(type?" "+type:""); statusEl.style.display=msg?"block":"none"; }
function validEmail(v){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v||"").trim()); }

// JSONP: <script src="API_BASE?...&callback=cb">
function jsonp(params, onResult){
  const cbName = "cb_" + Math.random().toString(36).slice(2);
  window[cbName] = (data)=>{ try{ onResult(data); } finally { delete window[cbName]; } };
  const s = document.createElement("script");
  const url = API_BASE + "?" + new URLSearchParams({ ...params, callback: cbName, _t: Date.now() }).toString();
  s.src = url;
  s.onerror = ()=> setStatus("Сервер недоступен. Попробуйте позже.","err");
  document.body.appendChild(s);
}

function claim(){
  const email = (emailEl.value||"").trim();
  if (!TOKEN){ setStatus("Нет токена в ссылке (?token=...).","err"); return; }
  if (!validEmail(email)){ setStatus("Введите корректный Google-email.","err"); emailEl.focus(); return; }
  claimBtn.disabled = true; setStatus("Обрабатываем…","");

  jsonp({ mode:"claim", token:TOKEN, email }, (res)=>{
    if (res && res.ok){
      setStatus("Доступ выдан: "+res.email+". Ссылка погашена.","ok");
      openBtn.style.display = "inline-block";
      openBtn.href = res.docUrl;
    } else {
      setStatus((res && res.error) || "Ошибка. Попробуйте ещё раз.","err");
      claimBtn.disabled = false;
    }
  });
}

claimBtn.addEventListener("click", claim);
emailEl.addEventListener("keydown", e=>{ if (e.key==="Enter") claim(); });

if (!TOKEN){ claimBtn.disabled = true; setStatus("Откройте ссылку с параметром ?token=...","err"); }
