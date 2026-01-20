// student-frontend/app.js
// ============================================================
// Student Frontend SPA
// - Sorted courses (foundation -> growth -> excellence)
// - Proper auth button visibility (login/register hidden after login)
// - Lesson navigation: Back / Next / Save & Complete / Return
// - Progress bar (dashboard + per-course)
// - Uses cookie session (credentials: "include")
// ============================================================

const API_BASE = "https://api.riseeritrea.com/api"; // ✅ IMPORTANT: no double https

const appEl = document.getElementById("app");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");

// ---------- helpers ----------
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : "Request failed";
    throw new Error(msg);
  }
  return data;
}

function setHash(h) { location.hash = h; }
function getHashParts() {
  return (location.hash || "#/dashboard").replace("#/", "").split("/");
}

function normalizeQuiz(quiz) {
  if (quiz && typeof quiz === "object" && Array.isArray(quiz.questions)) return quiz;
  return { questions: [] };
}

// ---------- course order ----------
const COURSE_ORDER = ["foundation", "growth", "excellence"];
function courseSort(a, b) {
  return COURSE_ORDER.indexOf(a.id) - COURSE_ORDER.indexOf(b.id);
}

// ---------- state ----------
const state = {
  user: null,
  lang: "en", // "en" | "ti"
  courses: [],
  statusByCourse: {}, // from /progress/status
  lessonsByCourse: {}, // courseId -> lessons[]
  progressByCourse: {}, // courseId -> byLessonIndex
};

// ---------- auth button logic ----------
function updateAuthButtons() {
  const loggedIn = !!state.user;
  if (btnLogin) btnLogin.style.display = loggedIn ? "none" : "inline-block";
  if (btnRegister) btnRegister.style.display = loggedIn ? "none" : "inline-block";
  if (btnLogout) btnLogout.style.display = loggedIn ? "inline-block" : "none";
}

async function loadMe() {
  const r = await api("/auth/me");
  state.user = r.user;
  updateAuthButtons();
}

// ---------- boot nav buttons ----------
if (btnLogin) btnLogin.addEventListener("click", () => setHash("#/login"));
if (btnRegister) btnRegister.addEventListener("click", () => setHash("#/register"));
if (btnLogout) btnLogout.addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  state.user = null;
  updateAuthButtons();
  setHash("#/login");
  render();
});

window.addEventListener("hashchange", render);

// ---------- data loaders ----------
async function loadCourses() {
  const r = await api("/courses");
  state.courses = (r.courses || []).slice().sort(courseSort);
}

async function loadProgressStatus() {
  if (!state.user) return;
  const r = await api("/progress/status");
  state.statusByCourse = {};
  for (const s of (r.status || [])) {
    state.statusByCourse[s.courseId] = s;
  }
}

async function loadLessons(courseId) {
  const r = await api(`/lessons/${courseId}?lang=${state.lang}`);
  state.lessonsByCourse[courseId] = r.lessons || [];
}

async function loadCourseProgress(courseId) {
  if (!state.user) return;
  const r = await api(`/progress/course/${courseId}`);
  state.progressByCourse[courseId] = r.byLessonIndex || {};
}

// ---------- UI helpers ----------
function progressPercent(courseId) {
  const s = state.statusByCourse[courseId];
  if (!s || !s.totalLessons) return 0;
  return Math.round((s.completedLessons / s.totalLessons) * 100);
}

function renderTopBarLangToggle() {
  // optional: simple language toggle, safe even if you later remove it
  return `
    <div class="row" style="justify-content:flex-end; gap:8px; margin-bottom:10px;">
      <button class="btn" id="langEn" ${state.lang === "en" ? "disabled" : ""}>EN</button>
      <button class="btn" id="langTi" ${state.lang === "ti" ? "disabled" : ""}>TI</button>
    </div>
  `;
}

function wireLangToggle(afterChange) {
  const en = document.getElementById("langEn");
  const ti = document.getElementById("langTi");
  if (en) en.onclick = async () => {
    state.lang = "en";
    await afterChange();
  };
  if (ti) ti.onclick = async () => {
    state.lang = "ti";
    await afterChange();
  };
}

// ---------- pages ----------
function renderLogin() {
  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Login</div>

      <label>Email</label>
      <input id="email" type="email" autocomplete="email" />

      <label>Password</label>
      <input id="password" type="password" autocomplete="current-password" />

      <div style="height:10px"></div>
      <button class="btn primary" id="doLogin">Login</button>

      <div class="small" id="msg" style="margin-top:10px;"></div>
    </div>
  `;

  document.getElementById("doLogin").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    msg.textContent = "";

    try {
      const r = await api("/auth/login", { method: "POST", body: { email, password } });
      state.user = r.user;
      updateAuthButtons();
      await loadProgressStatus();
      setHash("#/dashboard");
      render();
    } catch (e) {
      msg.textContent = "Login failed: " + e.message;
    }
  };
}

function renderRegister() {
  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Register</div>

      <label>Name</label>
      <input id="name" type="text" autocomplete="name" />

      <label>Email</label>
      <input id="email" type="email" autocomplete="email" />

      <label>Password</label>
      <input id="password" type="password" autocomplete="new-password" />

      <div style="height:10px"></div>
      <button class="btn primary" id="doRegister">Register</button>

      <div class="small" id="msg" style="margin-top:10px;"></div>
    </div>
  `;

  document.getElementById("doRegister").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    msg.textContent = "";

    try {
      const r = await api("/auth/register", { method: "POST", body: { name, email, password } });
      state.user = r.user;
      updateAuthButtons();
      await loadProgressStatus();
      setHash("#/dashboard");
      render();
    } catch (e) {
      msg.textContent = "Register failed: " + e.message;
    }
  };
}

async function renderDashboard() {
  // Ensure base data
  await loadCourses();
  if (state.user) await loadProgressStatus();

  const cards = state.courses.map(c => {
    const p = progressPercent(c.id);
    const title = state.lang === "ti" ? c.title_ti : c.title_en;
    const desc = state.lang === "ti" ? c.description_ti : c.description_en;

    return `
      <div class="card" style="margin-bottom:14px;">
        <div class="h2">${escapeHtml(title || c.id)}</div>
        <div class="p">${escapeHtml(desc || "")}</div>

        <div style="margin:10px 0;">
          <div class="small">Progress: <b>${p}%</b></div>
          <div style="background:rgba(255,255,255,0.12); border-radius:10px; height:12px; overflow:hidden;">
            <div style="height:12px; width:${p}%; background:rgba(255,255,255,0.55);"></div>
          </div>
        </div>

        <button class="btn primary" onclick="location.hash='#/course/${c.id}'">Open</button>
      </div>
    `;
  }).join("");

  appEl.innerHTML = `
    ${renderTopBarLangToggle()}
    <div class="card">
      <div class="h1">Your Levels</div>
      <div class="small">${state.user ? `Logged in as <b>${escapeHtml(state.user.name)}</b>` : `Please login to save progress.`}</div>
    </div>
    ${cards || `<div class="card"><div class="small">No courses found.</div></div>`}
  `;

  wireLangToggle(async () => { await renderDashboard(); });
}

async function renderCourse(courseId) {
  // load lessons + progress
  await loadLessons(courseId);
  if (state.user) await loadCourseProgress(courseId);

  const lessons = state.lessonsByCourse[courseId] || [];
  const prog = state.progressByCourse[courseId] || {};

  const course = state.courses.find(x => x.id === courseId);
  const title = course ? (state.lang === "ti" ? course.title_ti : course.title_en) : courseId;

  const rows = lessons.map((l) => {
    const done = prog[l.lessonIndex]?.completed;
    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="row" style="justify-content:space-between; gap:10px;">
          <div>
            <div class="h2">Lesson ${l.lessonIndex + 1}: ${escapeHtml(l.title || "")}</div>
            <div class="small">${done ? "✅ Completed" : "Not completed yet"}</div>
          </div>
          <button class="btn" onclick="location.hash='#/lesson/${courseId}/${l.lessonIndex}'">Open</button>
        </div>
      </div>
    `;
  }).join("");

  appEl.innerHTML = `
    ${renderTopBarLangToggle()}
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <div class="h1">${escapeHtml(title)}</div>
          <div class="small">Lessons: ${lessons.length}</div>
        </div>
        <button class="btn" onclick="location.hash='#/dashboard'">Return</button>
      </div>
    </div>
    ${rows || `<div class="card"><div class="small">No lessons found.</div></div>`}
  `;

  wireLangToggle(async () => { await renderCourse(courseId); });
}

async function renderLesson(courseId, lessonIndexStr) {
  const lessonIndex = Number(lessonIndexStr);

  // Ensure lessons loaded
  await loadLessons(courseId);
  const lessons = state.lessonsByCourse[courseId] || [];
  const lesson = lessons.find(x => x.lessonIndex === lessonIndex);

  if (!lesson) {
    appEl.innerHTML = `
      <div class="card">
        <div class="h1">Lesson not found</div>
        <button class="btn" onclick="location.hash='#/course/${courseId}'">Return</button>
      </div>
    `;
    return;
  }

  // Load progress for reflection/completed state
  if (state.user) await loadCourseProgress(courseId);
  const prog = (state.progressByCourse[courseId] || {})[lessonIndex] || {};
  const reflectionText = prog.reflectionText || "";

  const total = lessons.length;
  const currentPos = lessonIndex + 1;

  const canBack = lessonIndex > 0;
  const canNext = lessonIndex < total - 1;

  appEl.innerHTML = `
    ${renderTopBarLangToggle()}
    <div class="card">
      <div class="row" style="justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div>
          <div class="h1">${escapeHtml(lesson.title || "")}</div>
          <div class="small">Lesson ${currentPos} of ${total}</div>
        </div>
        <button class="btn" onclick="location.hash='#/course/${courseId}'">Return</button>
      </div>

      <div style="margin-top:10px;">
        <div style="background:rgba(255,255,255,0.12); border-radius:10px; height:12px; overflow:hidden;">
          <div style="height:12px; width:${Math.round((currentPos / total) * 100)}%; background:rgba(255,255,255,0.55);"></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Learn</div>
      <div class="p">${escapeHtml(lesson.learnText || "")}</div>

      <div style="height:10px;"></div>
      <div class="h2">Task</div>
      <div class="p">${escapeHtml(lesson.task || "")}</div>

      <div style="height:12px;"></div>
      <div class="h2">Reflection</div>
      <textarea id="reflection" placeholder="Write here..." style="width:100%; min-height:120px;">${escapeHtml(reflectionText)}</textarea>

      <div style="height:12px;"></div>

      <div class="row" style="justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <button class="btn" id="backBtn" ${canBack ? "" : "disabled"}>Back</button>
        <button class="btn ok" id="saveBtn">${state.user ? "Save & Complete" : "Login to save"}</button>
        <button class="btn" id="nextBtn" ${canNext ? "" : "disabled"}>Next</button>
      </div>

      <div class="small" id="msg" style="margin-top:10px;"></div>
    </div>
  `;

  wireLangToggle(async () => { await renderLesson(courseId, lessonIndexStr); });

  // Wire buttons
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const saveBtn = document.getElementById("saveBtn");
  const msg = document.getElementById("msg");

  if (backBtn) backBtn.onclick = () => {
    if (!canBack) return;
    setHash(`#/lesson/${courseId}/${lessonIndex - 1}`);
  };

  if (nextBtn) nextBtn.onclick = () => {
    if (!canNext) return;
    setHash(`#/lesson/${courseId}/${lessonIndex + 1}`);
  };

  if (saveBtn) saveBtn.onclick = async () => {
    msg.textContent = "";
    if (!state.user) {
      msg.textContent = "Please login to save your progress.";
      setHash("#/login");
      return;
    }

    const reflection = document.getElementById("reflection").value;

    try {
      await api("/progress/update", {
        method: "POST",
        body: {
          courseId,
          lessonIndex,
          completed: true,
          reflection
        }
      });

      msg.textContent = "Saved ✅";
      // refresh progress
      await loadProgressStatus();
      await loadCourseProgress(courseId);
    } catch (e) {
      msg.textContent = "Save failed: " + e.message;
    }
  };
}

// ---------- router ----------
async function render() {
  // keep buttons correct
  try { await loadMe(); } catch { state.user = null; updateAuthButtons(); }

  const [page, a, b] = getHashParts();

  if (!page || page === "dashboard") return renderDashboard();
  if (page === "login") return renderLogin();
  if (page === "register") return renderRegister();
  if (page === "course") return renderCourse(a);
  if (page === "lesson") return renderLesson(a, b);

  return renderDashboard();
}

// ---------- boot ----------
(function boot() {
  if (!location.hash) setHash("#/dashboard");
  render();
})();
