// ВАЖНО: ваш Apps Script Web App URL (именно /exec)
const API_BASE = "https://script.google.com/macros/s/AKfycbyLTvVXYNZ2UX4VpH9teQHWEG7wnxygFIyIznR3cTmXY-flzYetHF82Rrhffsquwu5erg/exec";
/* --- DOM --- */
const statusEl = document.getElementById("status");
const emailEl  = document.getElementById("email");
const claimBtn = document.getElementById("claimBtn");
const openBtn  = document.getElementById("openBtn");

/* если нет кнопки диагностики — добавим */
(function ensureDiagBtn(){
  let box = document.querySelector(".buttons") || document.body;
  const exists = document.getElementById("diagBtn");
  if (exists) return;
  const btn = document.createElement("button");
  btn.id = "diagBtn";
  btn.textContent = "Диагностика";
  btn.className = "btn btn-ghost";
  btn.style.marginLeft = "8px";
  btn.addEventListener("click", runDiagnostics);
  box.appendChild(btn);
})();

/* --- утилиты --- */
function setStatus(msg, type){
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (type ? " " + type : "");
  statusEl.style.display = msg ? "block" : "none";
}
function validEmail(v){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v||"").trim()); }

/* токен из ?token=..., #token=..., /t/<token> */
function getToken(){
  const qs = new URLSearchParams(location.search);
  if (qs.get("token")) return (qs.get("token")||"").trim();
  const hs = new URLSearchParams((location.hash||"").replace(/^#/,""));
  if (hs.get("token")) return (hs.get("token")||"").trim();
  const parts = location.pathname.split("/").filter(Boolean);
  const i = parts.findIndex(p => p.toLowerCase()==="t" || p.toLowerCase()==="token");
  if (i>=0 && parts[i+1]) return parts[i+1].trim();
  return "";
}
const TOKEN = getToken();

/* JSONP с подробной диагностикой */
function jsonp(params, onResult, label="main"){
  const cbName = "cb_" + Math.random().toString(36).slice(2);
  const url = API_BASE + "?" + new URLSearchParams({ ...params, callback: cbName, _t: Date.now() }).toString();

  // таймаут: ответ пришёл, но колбэк не вызвали (часто это HTML логина Google)
  const timeout = setTimeout(()=>{
    console.warn(`[${label}] JSONP timeout. Вероятно редирект на логин/страница не JSONP.`);
    setStatus("Ответ от API пришёл НЕ как JSONP (часто это страница логина Google). Проверь в Web App доступ: Who has access = \"Anyone\" и что URL оканчивается на /exec.", "err");
    delete window[cbName];
  }, 9000);

  window[cbName] = (data)=>{
    clearTimeout(timeout);
    try { onResult(data); }
    finally { delete window[cbName]; }
  };

  const s = document.createElement("script");
  s.src = url;
  s.onerror = ()=>{
    console.error(`[${label}] onerror для <script>: возможно блокировщик (ERR_BLOCKED_BY_CLIENT) или неверный URL.`, url);
    setStatus("Не удалось загрузить: " + url + "\nЭто почти всегда блокировщик (AdBlock/Brave/AdGuard) или неверный /exec.", "err");
  };
  console.log(`[${label}] JSONP ->`, url);
  document.body.appendChild(s);
}

/* основное действие */
function claim(){
  const email = (emailEl.value||"").trim();
  if (!TOKEN){ setStatus("Нет токена (?token=...).","err"); return; }
  if (!validEmail(email)){ setStatus("Введите корректный Google-email.","err"); emailEl.focus(); return; }
  claimBtn.disabled = true; setStatus("Обрабатываем…","");

  jsonp({ mode:"claim", token:TOKEN, email }, (res)=>{
    console.log("[claim] res:", res);
    if (res && res.ok){
      setStatus("Доступ выдан: " + res.email + ". Ссылка погашена.","ok");
      openBtn.style.display = "inline-block";
      openBtn.href = res.docUrl;
    } else {
      setStatus((res && res.error) || "Ошибка. Попробуйте ещё раз.","err");
      claimBtn.disabled = false;
    }
  }, "claim");
}

claimBtn?.addEventListener("click", claim);
emailEl?.addEventListener("keydown", e=>{ if (e.key==="Enter") claim(); });
if (!TOKEN){ claimBtn && (claimBtn.disabled = true); setStatus("Откройте ссылку с параметром ?token=...","err"); }

/* --- Диагностика --- */
function runDiagnostics(){
  // 0) быстрые оффлайн-проверки
  const hints = [];
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(API_BASE)){
    hints.push("API_BASE не похож на корректный /exec. Должно быть: https://script.google.com/macros/s/…/exec");
  }
  if (hints.length){
    setStatus("Проверка API_BASE: \n• " + hints.join("\n• "), "err");
  } else {
    setStatus("Пробую связаться с API…", "");
  }

  // 1) ping без действий — должен вернуть {ok:true, msg:"ok"} через JSONP
  jsonp({}, (res)=>{
    console.log("[diag] ping res:", res);
    if (res && res.ok){
      setStatus("Связь с API установлена (JSONP работает). Теперь можно пробовать выдачу доступа с реальным токеном.", "ok");
    } else {
      setStatus("API отвечает, но не ok: " + JSON.stringify(res), "err");
    }
  }, "diag-ping");

  // 2) выводим прямую ссылку для ручной проверки в новой вкладке
  const testUrl = API_BASE + "?mode=claim&token=TEST&email=test@gmail.com&callback=cb";
  console.log("[diag] manual check URL:", testUrl);
  try {
    let a = document.getElementById("manualCheckLink");
    if (!a){
      a = document.createElement("a");
      a.id = "manualCheckLink";
      a.className = "small";
      a.style.display = "block";
      a.style.marginTop = "8px";
      a.target = "_blank";
      a.rel = "noopener";
      document.querySelector(".card")?.appendChild(a);
    }
    a.textContent = "Открыть ручную проверку JSONP (должно быть cb({...}))";
    a.href = testUrl;
  } catch(_){}
}
