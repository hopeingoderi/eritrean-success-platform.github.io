// student-frontend/app.js
// ============================================================
// Works with your CURRENT index.html:
//   <button onclick="go('login')">Login</button>
//   <button onclick="go('register')">Register</button>
//   <button onclick="logout()">Logout</button>
//
// Fixes:
// - Login/Register/Logout logic (hide/show correctly)
// - Prevent dashboard if not logged in
// - Courses not "undefined" (supports title/title_en/title_ti + description/description_en/description_ti)
// - Sort courses: foundation -> growth -> excellence (by order if provided)
// - Course page + lesson page (Back/Next/Save & Complete + progress bar)
// ============================================================

const API_BASE = "https://api.riseeritrea.com/api";

// ---------- DOM ----------
const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");

// Your nav buttons (by order in index.html)
const navButtons = navEl ? navEl.querySelectorAll("button") : [];
const btnLogin = navButtons[0] || null;
const btnRegister = navButtons[1] || null;
const btnLogout = navButtons[2] || null;

// ---------- STATE ----------
const state = {
  user: null,
  lang: "en",
  courses: [],
  lessonsByCourse: {},
  progressByCourse: {}
};

// ---------- HELPERS ----------
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
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
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data;
}

function setHash(h) {
  if (location.hash !== h) location.hash = h;
}

function routeParts() {
  return (location.hash || "#/dashboard").replace("#/", "").split("/");
}

function isLoggedIn() {
  return !!state.user;
}

// These 2 functions FIX your current index.html
window.go = function (page) {
  setHash(`#/${page}`);
  render();
};

window.logout = async function () {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  state.user = null;
  updateNav();
  setHash("#/login");
  render();
};

function updateNav() {
  if (!btnLogin || !btnRegister || !btnLogout) return;

  if (state.user) {
    btnLogin.style.display = "none";
    btnRegister.style.display = "none";
    btnLogout.style.display = "inline-block";
  } else {
    btnLogin.style.display = "inline-block";
    btnRegister.style.display = "inline-block";
    btnLogout.style.display = "none";
  }
}

// Robust field reading (prevents "undefined")
function getCourseTitle(c) {
  if (!c) return "";
  if (state.lang === "ti") return c.title_ti || c.title || c.title_en || "";
  return c.title_en || c.title || c.title_ti || "";
}

function getCourseDesc(c) {
  if (!c) return "";
  if (state.lang === "ti") return c.description_ti || c.description || c.description_en || "";
  return c.description_en || c.description || c.description_ti || "";
}

// ---------- LOADERS ----------
async function loadMe() {
  const r = await api("/auth/me");
  state.user = r.user || null;
  updateNav();
}

async function loadCourses() {
  const r = await api(`/courses?lang=${state.lang}`);
  state.courses = Array.isArray(r.courses) ? r.courses : [];

  // sort by order if exists, else fallback id order
  const fallbackOrder = { foundation: 1, growth: 2, excellence: 3 };
  state.courses.sort((a, b) => {
    const ao = (typeof a.order === "number" ? a.order : (fallbackOrder[a.id] || 999));
    const bo = (typeof b.order === "number" ? b.order : (fallbackOrder[b.id] || 999));
    return ao - bo;
  });
}

async function loadLessons(courseId) {
  const r = await api(`/lessons/${courseId}?lang=${state.lang}`);
  state.lessonsByCourse[courseId] = Array.isArray(r.lessons) ? r.lessons : [];
}

async function loadProgress(courseId) {
  const r = await api(`/progress/course/${courseId}`);
  state.progressByCourse[courseId] = r || {};
}

function getLessonProgress(courseId, lessonIndex) {
  const p = state.progressByCourse[courseId]?.byLessonIndex?.[lessonIndex];
  return p || { completed: false, reflectionText: "" };
}

// ---------- RENDER ----------
async function render() {
  // ALWAYS refresh auth state first
  try { await loadMe(); } catch { state.user = null; updateNav(); }

  const parts = routeParts();
  const page = parts[0] || "dashboard";

  if (page === "login") return renderLogin();
  if (page === "register") return renderRegister();

  // Protected pages
  if (!isLoggedIn()) {
    setHash("#/login");
    return renderLogin();
  }

  if (page === "dashboard") return renderDashboard();
  if (page === "course") return renderCourse(parts[1]);
  if (page === "lesson") return renderLesson(parts[1], parts[2]);

  setHash("#/dashboard");
  return renderDashboard();
}

// ---------- LOGIN ----------
function renderLogin() {
  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Login</div>

      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" />

      <label>Password</label>
      <input id="password" type="password" placeholder="••••••••" />

      <div style="height:12px"></div>
      <button class="btn primary" id="loginBtn">Login</button>
      <div class="small" id="msg" style="margin-top:10px"></div>
    </div>
  `;

  document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    msg.textContent = "";

    try {
      const r = await api("/auth/login", { method: "POST", body: { email, password } });
      state.user = r.user;
      updateNav();
      setHash("#/dashboard");
      render();
    } catch (e) {
      msg.textContent = "Login failed: " + e.message;
    }
  };
}

// ---------- REGISTER ----------
function renderRegister() {
  appEl.innerHTML = `
    <div class="card">
      <div class="h1">Register</div>

      <label>Name</label>
      <input id="name" type="text" placeholder="Your name" />

      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" />

      <label>Password</label>
      <input id="password" type="password" placeholder="min 6 characters" />

      <div style="height:12px"></div>
      <button class="btn primary" id="regBtn">Create account</button>
      <div class="small" id="msg" style="margin-top:10px"></div>
    </div>
  `;

  document.getElementById("regBtn").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    msg.textContent = "";

    try {
      const r = await api("/auth/register", { method: "POST", body: { name, email, password } });
      state.user = r.user;
      updateNav();
      setHash("#/dashboard");
      render();
    } catch (e) {
      msg.textContent = "Register failed: " + e.message;
    }
  };
}

// ---------- DASHBOARD ----------
async function renderDashboard() {
  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <div class="h1">Your Levels</div>
          <div class="small">Welcome, <b>${escapeHtml(state.user?.name || "")}</b></div>
        </div>
        <div class="row" style="gap:8px;">
          <button class="btn" id="langEn">English</button>
          <button class="btn" id="langTi">ትግርኛ</button>
        </div>
      </div>
    </div>
    <div id="coursesWrap"></div>
  `;

  document.getElementById("langEn").onclick = async () => {
    state.lang = "en";
    await loadCourses();
    renderDashboard();
  };
  document.getElementById("langTi").onclick = async () => {
    state.lang = "ti";
    await loadCourses();
    renderDashboard();
  };

  try {
    await loadCourses();
  } catch (e) {
    document.getElementById("coursesWrap").innerHTML =
      `<div class="card"><div class="small">Failed to load courses: ${escapeHtml(e.message)}</div></div>`;
    return;
  }

  const wrap = document.getElementById("coursesWrap");

  wrap.innerHTML = (state.courses.length ? state.courses : []).map(c => `
    <div class="card">
      <div class="h2">${escapeHtml(getCourseTitle(c))}</div>
      <div class="p">${escapeHtml(getCourseDesc(c))}</div>
      <button class="btn primary" data-open="${escapeHtml(c.id)}">Open</button>
    </div>
  `).join("") || `<div class="card"><div class="small">No courses found.</div></div>`;

  wrap.querySelectorAll("[data-open]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-open");
      setHash(`#/course/${id}`);
      render();
    };
  });
}

// ---------- COURSE ----------
async function renderCourse(courseId) {
  if (!courseId) { setHash("#/dashboard"); return render(); }

  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <div class="h1">Lessons</div>
          <div class="small">Course: <b>${escapeHtml(courseId)}</b></div>
        </div>
        <button class="btn" id="backDash">Back</button>
      </div>
      <div id="courseProgress" style="margin-top:10px;"></div>
    </div>

    <div id="lessonsWrap"></div>
  `;

  document.getElementById("backDash").onclick = () => {
    setHash("#/dashboard");
    render();
  };

  try {
    await loadLessons(courseId);
    await loadProgress(courseId);
  } catch (e) {
    document.getElementById("lessonsWrap").innerHTML =
      `<div class="card"><div class="small">Failed to load lessons: ${escapeHtml(e.message)}</div></div>`;
    return;
  }

  const lessons = state.lessonsByCourse[courseId] || [];
  const byLessonIndex = state.progressByCourse[courseId]?.byLessonIndex || {};

  const total = lessons.length;
  const completed = Object.values(byLessonIndex).filter(x => x?.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById("courseProgress").innerHTML = `
    <div class="small">Progress: <b>${completed}</b> / ${total} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:6px;"><div class="progressBar" style="width:${pct}%"></div></div>
  `;

  const wrap = document.getElementById("lessonsWrap");

  const html = lessons
    .slice()
    .sort((a, b) => (a.lessonIndex ?? 0) - (b.lessonIndex ?? 0))
    .map(l => {
      const idx = l.lessonIndex;
      const done = !!byLessonIndex[idx]?.completed;
      return `
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center;">
            <div>
              <div class="h2">${escapeHtml(l.title || "")}</div>
              <div class="small">Lesson ${Number(idx) + 1} ${done ? "✅" : ""}</div>
            </div>
            <button class="btn primary" data-open-lesson="${idx}">Open</button>
          </div>
        </div>
      `;
    }).join("");

  wrap.innerHTML = html || `<div class="card"><div class="small">No lessons found.</div></div>`;

  wrap.querySelectorAll("[data-open-lesson]").forEach(btn => {
    btn.onclick = () => {
      const idx = btn.getAttribute("data-open-lesson");
      setHash(`#/lesson/${courseId}/${idx}`);
      render();
    };
  });
}

// ---------- LESSON ----------
async function renderLesson(courseId, lessonIndexStr) {
  const lessonIndex = Number(lessonIndexStr);
  if (!courseId || !Number.isFinite(lessonIndex)) {
    setHash("#/dashboard");
    return render();
  }

  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <div class="h1">Lesson</div>
          <div class="small">Course: <b>${escapeHtml(courseId)}</b> • Lesson: <b>${lessonIndex + 1}</b></div>
        </div>
        <button class="btn" id="returnCourse">Return</button>
      </div>
      <div id="lessonProgress" style="margin-top:10px;"></div>
    </div>

    <div class="card" id="lessonCard"><div class="small">Loading...</div></div>
  `;

  document.getElementById("returnCourse").onclick = () => {
    setHash(`#/course/${courseId}`);
    render();
  };

  try {
    if (!state.lessonsByCourse[courseId]) await loadLessons(courseId);
    await loadProgress(courseId);
  } catch (e) {
    document.getElementById("lessonCard").innerHTML =
      `<div class="small">Failed to load lesson: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const lessons = state.lessonsByCourse[courseId] || [];
  const lesson = lessons.find(x => x.lessonIndex === lessonIndex);

  if (!lesson) {
    document.getElementById("lessonCard").innerHTML = `<div class="small">Lesson not found.</div>`;
    return;
  }

  const byLessonIndex = state.progressByCourse[courseId]?.byLessonIndex || {};
  const total = lessons.length;
  const completed = Object.values(byLessonIndex).filter(x => x?.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById("lessonProgress").innerHTML = `
    <div class="small">Course progress: <b>${completed}</b> / ${total} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:6px;"><div class="progressBar" style="width:${pct}%"></div></div>
  `;

  const p = getLessonProgress(courseId, lessonIndex);
  const hasPrev = lessons.some(x => x.lessonIndex === lessonIndex - 1);
  const hasNext = lessons.some(x => x.lessonIndex === lessonIndex + 1);

  document.getElementById("lessonCard").innerHTML = `
    <div class="h2">${escapeHtml(lesson.title || "")}</div>

    <hr/>
    <div class="h2">Learn</div>
    <div class="p">${escapeHtml(lesson.learnText || "")}</div>

    <div style="height:10px"></div>
    <div class="h2">Task</div>
    <div class="p">${escapeHtml(lesson.task || "")}</div>

    <hr/>
    <div class="h2">Reflection</div>
    <textarea id="reflection" placeholder="Write your reflection...">${escapeHtml(p.reflectionText || "")}</textarea>

    <div style="height:12px"></div>
    <div class="row" style="justify-content:flex-start;gap:8px;">
      <button class="btn" id="prevBtn" ${hasPrev ? "" : "disabled"}>Back</button>
      <button class="btn" id="nextBtn" ${hasNext ? "" : "disabled"}>Next</button>
      <button class="btn primary" id="saveBtn">Save & Complete</button>
    </div>

    <div class="small" id="saveMsg" style="margin-top:10px;"></div>
  `;

  document.getElementById("prevBtn").onclick = () => {
    if (!hasPrev) return;
    setHash(`#/lesson/${courseId}/${lessonIndex - 1}`);
    render();
  };

  document.getElementById("nextBtn").onclick = () => {
    if (!hasNext) return;
    setHash(`#/lesson/${courseId}/${lessonIndex + 1}`);
    render();
  };

  document.getElementById("saveBtn").onclick = async () => {
    const msg = document.getElementById("saveMsg");
    msg.textContent = "Saving...";

    const reflection = document.getElementById("reflection").value || "";

    try {
      await api("/progress/update", {
        method: "POST",
        body: { courseId, lessonIndex, reflection, completed: true }
      });
      msg.textContent = "Saved ✅";
      await loadProgress(courseId);
    } catch (e) {
      msg.textContent = "Save failed: " + e.message;
    }
  };
}

// ---------- ROUTER / BOOT ----------
window.addEventListener("hashchange", render);

(function boot() {
  // IMPORTANT: force correct nav state immediately
  updateNav();

  if (!location.hash) setHash("#/dashboard");
  render();
})();
