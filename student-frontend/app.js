// student-frontend/app.js
// ------------------------------------------------------------
// Student Frontend (single-file JS)
// Fixes:
// - Correct API_BASE (no double https)
// - Correct auth button logic (Login/Register vs Logout)
// - Sort courses Foundation -> Growth -> Excellence
// - Adds lesson Back/Next + Save & Complete
// - Adds progress bars (course + lesson)
// ------------------------------------------------------------

const API_BASE = "https://api.riseeritrea.com/api";

const COURSE_ORDER = ["foundation", "growth", "excellence"];
const COURSE_LABEL = {
  foundation: "Level 1: Foundation",
  growth: "Level 2: Growth",
  excellence: "Level 3: Excellence"
};

const appEl = document.getElementById("app");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

let state = {
  user: null,
  lang: "en",
  courses: [],
  lessonsByCourse: {},   // courseId -> lessons[]
  progressByCourse: {}   // courseId -> byLessonIndex map
};

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
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return data;
}

function setHash(h) { location.hash = h; }
function routeParts() { return (location.hash || "#/").replace("#/", "").split("/"); }

function updateAuthButtons() {
  const loggedIn = !!state.user;
  if (loginBtn) loginBtn.style.display = loggedIn ? "none" : "inline-block";
  if (registerBtn) registerBtn.style.display = loggedIn ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-block" : "none";
}

// ---------------- AUTH ----------------
async function loadMe() {
  const r = await api("/auth/me");
  state.user = r.user;
  updateAuthButtons();
}

if (loginBtn) loginBtn.onclick = () => setHash("#/login");
if (registerBtn) registerBtn.onclick = () => setHash("#/register");

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    state.user = null;
    updateAuthButtons();
    setHash("#/login");
    render();
  };
}

// ---------------- DATA LOADERS ----------------
function sortCourses(courses) {
  const rank = (id) => {
    const idx = COURSE_ORDER.indexOf(id);
    return idx === -1 ? 99 : idx;
  };
  return [...courses].sort((a, b) => rank(a.id) - rank(b.id));
}

async function loadCourses() {
  const r = await api(`/courses?lang=${state.lang}`);
  state.courses = sortCourses(r.courses || []);
}

async function loadLessons(courseId) {
  if (state.lessonsByCourse[courseId]) return;
  const r = await api(`/lessons/${courseId}?lang=${state.lang}`);
  state.lessonsByCourse[courseId] = r.lessons || [];
}

async function loadProgressCourse(courseId) {
  const r = await api(`/progress/course/${courseId}`);
  state.progressByCourse[courseId] = r.byLessonIndex || {};
}

async function loadProgressStatus() {
  // optional but nice for overall progress; ignore if not logged in
  try {
    const r = await api("/progress/status");
    // we can use it later if needed
    return r.status || [];
  } catch {
    return [];
  }
}

// ---------------- UI HELPERS ----------------
function progressPercent(courseId) {
  const lessons = state.lessonsByCourse[courseId] || [];
  const prog = state.progressByCourse[courseId] || {};
  if (!lessons.length) return 0;
  let done = 0;
  for (const l of lessons) {
    const p = prog[l.lessonIndex];
    if (p && p.completed) done++;
  }
  return Math.round((done / lessons.length) * 100);
}

function renderProgressBar(pct) {
  return `
    <div style="margin-top:10px">
      <div style="font-size:12px; opacity:.9; margin-bottom:6px">Progress: <b>${pct}%</b></div>
      <div style="background: rgba(255,255,255,.15); border-radius: 999px; overflow:hidden; height:12px;">
        <div style="height:12px; width:${pct}%; background: rgba(255,255,255,.65);"></div>
      </div>
    </div>
  `;
}

// ---------------- ROUTES ----------------
window.addEventListener("hashchange", render);

async function render() {
  // Always try to refresh session
  try { await loadMe(); } catch { state.user = null; updateAuthButtons(); }

  const [page, a, b] = routeParts();

  // Public pages
  if (page === "login") return renderLogin();
  if (page === "register") return renderRegister();

  // Everything else requires login
  if (!state.user) {
    setHash("#/login");
    return renderLogin();
  }

  if (page === "" || page === "dashboard") return renderDashboard();
  if (page === "course") return renderCourse(a);             // a = courseId
  if (page === "lesson") return renderLesson(a, Number(b));  // a=courseId, b=lessonIndex

  setHash("#/dashboard");
  return renderDashboard();
}

// ---------------- PAGES ----------------
function renderLogin() {
  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Login</div>

      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" />

      <label>Password</label>
      <input id="password" type="password" placeholder="••••••••" />

      <div style="height:12px"></div>
      <button class="btn primary" id="doLogin">Login</button>
      <div class="small" id="msg" style="margin-top:10px"></div>
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
      <input id="name" type="text" placeholder="Your name" />

      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" />

      <label>Password</label>
      <input id="password" type="password" placeholder="min 6 chars" />

      <div style="height:12px"></div>
      <button class="btn primary" id="doRegister">Create account</button>
      <div class="small" id="msg" style="margin-top:10px"></div>
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
      setHash("#/dashboard");
      render();
    } catch (e) {
      msg.textContent = "Register failed: " + e.message;
    }
  };
}

async function renderDashboard() {
  await loadCourses();

  // Render courses in correct order
  const cards = state.courses.map(c => `
    <div class="card" style="margin-bottom:14px;">
      <div class="h2">${escapeHtml(COURSE_LABEL[c.id] || c.title || c.id)}</div>
      <div class="p">${escapeHtml(c.description || "")}</div>
      <button class="btn ok" onclick="location.hash='#/course/${c.id}'">Open</button>
    </div>
  `).join("");

  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Your Levels</div>
      <div class="small">Welcome${state.user?.name ? ", " + escapeHtml(state.user.name) : ""}!</div>
    </div>
    ${cards || `<div class="card"><div class="small">No courses found.</div></div>`}
  `;
}

async function renderCourse(courseId) {
  if (!courseId) {
    setHash("#/dashboard");
    return renderDashboard();
  }

  await loadLessons(courseId);
  await loadProgressCourse(courseId);

  const lessons = state.lessonsByCourse[courseId] || [];
  const prog = state.progressByCourse[courseId] || {};
  const pct = progressPercent(courseId);

  const rows = lessons.map(l => {
    const p = prog[l.lessonIndex];
    const done = p && p.completed;
    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="row" style="justify-content:space-between; gap:10px;">
          <div>
            <div class="h2">${escapeHtml(l.title || `Lesson ${l.lessonIndex + 1}`)}</div>
            <div class="small">Lesson ${l.lessonIndex + 1} ${done ? "✅ Completed" : ""}</div>
          </div>
          <button class="btn primary" onclick="location.hash='#/lesson/${courseId}/${l.lessonIndex}'">Open</button>
        </div>
      </div>
    `;
  }).join("");

  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <div class="h1">${escapeHtml(COURSE_LABEL[courseId] || courseId)}</div>
          <div class="small">Course ID: ${escapeHtml(courseId)}</div>
          ${renderProgressBar(pct)}
        </div>
        <div>
          <button class="btn" onclick="location.hash='#/dashboard'">Back</button>
        </div>
      </div>
    </div>
    ${rows || `<div class="card"><div class="small">No lessons yet.</div></div>`}
  `;
}

async function renderLesson(courseId, lessonIndex) {
  if (!courseId || Number.isNaN(lessonIndex)) {
    setHash("#/dashboard");
    return renderDashboard();
  }

  await loadLessons(courseId);
  await loadProgressCourse(courseId);

  const lessons = state.lessonsByCourse[courseId] || [];
  const prog = state.progressByCourse[courseId] || {};
  const lesson = lessons.find(x => x.lessonIndex === lessonIndex);

  if (!lesson) {
    appEl.innerHTML = `
      <div class="card">
        <div class="h1">Lesson not found</div>
        <button class="btn" onclick="location.hash='#/course/${courseId}'">Back to lessons</button>
      </div>
    `;
    return;
  }

  const prevIndex = lessonIndex - 1;
  const nextIndex = lessonIndex + 1;
  const hasPrev = lessons.some(l => l.lessonIndex === prevIndex);
  const hasNext = lessons.some(l => l.lessonIndex === nextIndex);

  const current = prog[lessonIndex] || {};
  const reflectionText = current.reflectionText || "";

  const pct = progressPercent(courseId);

  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between; gap:10px;">
        <div>
          <div class="h1">${escapeHtml(lesson.title || "")}</div>
          <div class="small">${escapeHtml(COURSE_LABEL[courseId] || courseId)} • Lesson ${lessonIndex + 1}</div>
          ${renderProgressBar(pct)}
        </div>
        <div>
          <button class="btn" onclick="location.hash='#/course/${courseId}'">Back to list</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Learn</div>
      <div class="p">${escapeHtml(lesson.learnText || "")}</div>

      <div class="h2" style="margin-top:14px;">Task</div>
      <div class="p">${escapeHtml(lesson.task || "")}</div>

      <div class="h2" style="margin-top:14px;">Reflection</div>
      <textarea id="reflection" placeholder="Write your reflection here..." style="width:100%; min-height:110px;">${escapeHtml(reflectionText)}</textarea>

      <div class="row" style="gap:10px; margin-top:12px; justify-content:space-between; flex-wrap:wrap;">
        <div class="row" style="gap:10px;">
          <button class="btn" id="prevBtn" ${hasPrev ? "" : "disabled"}>⬅ Back</button>
          <button class="btn" id="nextBtn" ${hasNext ? "" : "disabled"}>Next ➡</button>
        </div>
        <button class="btn ok" id="saveBtn">Save & Complete ✅</button>
      </div>

      <div class="small" id="msg" style="margin-top:10px"></div>
    </div>
  `;

  document.getElementById("prevBtn").onclick = () => {
    if (!hasPrev) return;
    setHash(`#/lesson/${courseId}/${prevIndex}`);
  };

  document.getElementById("nextBtn").onclick = () => {
    if (!hasNext) return;
    setHash(`#/lesson/${courseId}/${nextIndex}`);
  };

  document.getElementById("saveBtn").onclick = async () => {
    const msg = document.getElementById("msg");
    msg.textContent = "Saving...";
    const reflection = document.getElementById("reflection").value || "";

    try {
      await api("/progress/update", {
        method: "POST",
        body: {
          courseId,
          lessonIndex,
          reflection,
          completed: true
        }
      });

      await loadProgressCourse(courseId); // refresh
      msg.textContent = "Saved ✅";

      // Auto-go next if exists
      if (hasNext) setHash(`#/lesson/${courseId}/${nextIndex}`);
      else setHash(`#/course/${courseId}`);
    } catch (e) {
      msg.textContent = "Save failed: " + e.message;
    }
  };
}

// ---------------- BOOT ----------------
(function boot() {
  if (!location.hash) setHash("#/dashboard");
  render();
})();
