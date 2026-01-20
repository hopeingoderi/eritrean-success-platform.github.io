// student-frontend/app.js
// ============================================================
// Student Frontend (SPA)
// Matches your student-frontend/index.html nav:
//   <button onclick="go('login')">Login</button>
//   <button onclick="go('register')">Register</button>
//   <button onclick="logout()">Logout</button>
//
// Fixes:
// - Correct API_BASE
// - Courses not "undefined" (maps title_en/title_ti + description_en/description_ti)
// - Sort courses by order: foundation -> growth -> excellence
// - Proper Login/Register/Logout visibility
// - Course page: progress bar + lesson list
// - Lesson page: Back/Next/Return + Save & Complete
// ============================================================

const API_BASE = "https://api.riseeritrea.com/api";

// ---------------- DOM ----------------
const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");

// ---------------- STATE ----------------
const state = {
  user: null,
  lang: "en", // "en" | "ti"
  courses: [],
  lessonsByCourse: {},   // courseId -> lessons[]
  progressByCourse: {},  // courseId -> progress object from backend
};

// ---------------- HELPERS ----------------
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return data;
}

// Your site uses hashes like "#dashboard" in screenshots.
// We'll support BOTH "#dashboard" and "#/dashboard".
function getRouteParts() {
  const raw = location.hash || "#dashboard";
  const h = raw.startsWith("#/") ? raw.slice(2) : raw.slice(1);
  const parts = h.split("/").filter(Boolean);
  return parts.length ? parts : ["dashboard"];
}

function setRoute(route) {
  // keep style "#dashboard"
  location.hash = "#" + route.replace(/^#?\/?/, "");
}

// nav buttons are in index.html but have no IDs; match by text
function getNavButtons() {
  const btns = Array.from(navEl?.querySelectorAll("button") || []);
  const find = (txt) =>
    btns.find((b) => (b.textContent || "").trim().toLowerCase() === txt);
  return {
    login: find("login"),
    register: find("register"),
    logout: find("logout"),
  };
}

function updateNav() {
  const { login, register, logout: lo } = getNavButtons();
  if (!login || !register || !lo) return;

  if (state.user) {
    login.style.display = "none";
    register.style.display = "none";
    lo.style.display = "inline-block";
  } else {
    login.style.display = "inline-block";
    register.style.display = "inline-block";
    lo.style.display = "none";
  }
}

function courseTitle(c) {
  if (state.lang === "ti") return c.title_ti || c.title_en || c.title || c.id;
  return c.title_en || c.title_ti || c.title || c.id;
}

function courseDesc(c) {
  if (state.lang === "ti") return c.description_ti || c.description_en || c.description || "";
  return c.description_en || c.description_ti || c.description || "";
}

function progressFor(courseId, lessonIndex) {
  return state.progressByCourse[courseId]?.byLessonIndex?.[lessonIndex] || {
    completed: false,
    reflectionText: "",
  };
}

// ---------------- LOADERS ----------------
async function loadMe() {
  const r = await api("/auth/me");
  state.user = r.user;
  updateNav();
}

async function loadCourses() {
  const r = await api(`/courses?lang=${state.lang}`);
  state.courses = Array.isArray(r.courses) ? r.courses : [];

  // Sort by 'order' if present, else fallback by known IDs
  const fallback = { foundation: 1, growth: 2, excellence: 3 };
  state.courses.sort((a, b) => {
    const ao = (typeof a.order === "number") ? a.order : (fallback[a.id] || 999);
    const bo = (typeof b.order === "number") ? b.order : (fallback[b.id] || 999);
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

// ---------------- RENDER ----------------
async function render() {
  // Always try load /me first
  try {
    await loadMe();
  } catch {
    state.user = null;
    updateNav();
  }

  const parts = getRouteParts();
  const page = parts[0];

  if (page === "login") return renderLogin();
  if (page === "register") return renderRegister();

  // Protected pages
  if (!state.user) {
    setRoute("login");
    return renderLogin();
  }

  if (page === "dashboard") return renderDashboard();
  if (page === "course") return renderCourse(parts[1]);
  if (page === "lesson") return renderLesson(parts[1], parts[2]);

  setRoute("dashboard");
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
      const r = await api("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      state.user = r.user;
      updateNav();
      setRoute("dashboard");
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
      const r = await api("/auth/register", {
        method: "POST",
        body: { name, email, password },
      });
      state.user = r.user;
      updateNav();
      setRoute("dashboard");
      render();
    } catch (e) {
      msg.textContent = "Register failed: " + e.message;
    }
  };
}

async function renderDashboard() {
  appEl.innerHTML = `
    <div class="card">
      <div class="row">
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

  const wrap = document.getElementById("coursesWrap");
  try {
    await loadCourses();
  } catch (e) {
    wrap.innerHTML = `<div class="card"><div class="small">Failed to load courses: ${escapeHtml(e.message)}</div></div>`;
    return;
  }

  wrap.innerHTML = state.courses.map(c => `
    <div class="card">
      <div class="h2">${escapeHtml(courseTitle(c))}</div>
      <div class="p">${escapeHtml(courseDesc(c))}</div>
      <button class="btn primary" data-open="${escapeHtml(c.id)}">Open</button>
    </div>
  `).join("") || `<div class="card"><div class="small">No courses found.</div></div>`;

  wrap.querySelectorAll("[data-open]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-open");
      setRoute(`course/${id}`);
      render();
    };
  });
}

async function renderCourse(courseId) {
  if (!courseId) {
    setRoute("dashboard");
    return render();
  }

  appEl.innerHTML = `
    <div class="card">
      <div class="row">
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
    setRoute("dashboard");
    render();
  };

  try {
    await loadLessons(courseId);
    await loadProgress(courseId);
  } catch (e) {
    document.getElementById("lessonsWrap").innerHTML =
      `<div class="card"><div class="small">Failed to load lessons/progress: ${escapeHtml(e.message)}</div></div>`;
    return;
  }

  const lessons = state.lessonsByCourse[courseId] || [];
  const pmap = state.progressByCourse[courseId]?.byLessonIndex || {};

  const total = lessons.length;
  const completed = Object.values(pmap).filter(x => x && x.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById("courseProgress").innerHTML = `
    <div class="small">Progress: <b>${completed}</b> / ${total} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:6px;">
      <div class="progressBar" style="width:${pct}%"></div>
    </div>
  `;

  const wrap = document.getElementById("lessonsWrap");
  wrap.innerHTML = lessons
    .slice()
    .sort((a, b) => a.lessonIndex - b.lessonIndex)
    .map(l => {
      const done = !!pmap[l.lessonIndex]?.completed;
      return `
        <div class="card">
          <div class="row">
            <div>
              <div class="h2">${escapeHtml(l.title || "")}</div>
              <div class="small">Lesson ${l.lessonIndex + 1} ${done ? "✅" : ""}</div>
            </div>
            <button class="btn primary" data-lesson="${l.lessonIndex}">Open</button>
          </div>
        </div>
      `;
    }).join("") || `<div class="card"><div class="small">No lessons found.</div></div>`;

  wrap.querySelectorAll("[data-lesson]").forEach(btn => {
    btn.onclick = () => {
      const idx = btn.getAttribute("data-lesson");
      setRoute(`lesson/${courseId}/${idx}`);
      render();
    };
  });
}

async function renderLesson(courseId, lessonIndexStr) {
  const lessonIndex = Number(lessonIndexStr);
  if (!courseId || !Number.isFinite(lessonIndex)) {
    setRoute(`course/${courseId || ""}`);
    return render();
  }

  appEl.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div class="h1">Lesson</div>
          <div class="small">Course: <b>${escapeHtml(courseId)}</b> • Lesson: <b>${lessonIndex + 1}</b></div>
        </div>
        <button class="btn" id="returnCourse">Return</button>
      </div>
      <div id="lessonProgressBar" style="margin-top:10px;"></div>
    </div>

    <div class="card" id="lessonCard"><div class="small">Loading...</div></div>
  `;

  document.getElementById("returnCourse").onclick = () => {
    setRoute(`course/${courseId}`);
    render();
  };

  try {
    if (!state.lessonsByCourse[courseId]) await loadLessons(courseId);
    await loadProgress(courseId);
  } catch (e) {
    document.getElementById("lessonCard").innerHTML =
      `<div class="small">Failed to load: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const lessons = state.lessonsByCourse[courseId] || [];
  const lesson = lessons.find(x => x.lessonIndex === lessonIndex);

  if (!lesson) {
    document.getElementById("lessonCard").innerHTML = `<div class="small">Lesson not found.</div>`;
    return;
  }

  const pmap = state.progressByCourse[courseId]?.byLessonIndex || {};
  const total = lessons.length;
  const doneCount = Object.values(pmap).filter(x => x && x.completed).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  document.getElementById("lessonProgressBar").innerHTML = `
    <div class="small">Course progress: <b>${doneCount}</b> / ${total} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:6px;">
      <div class="progressBar" style="width:${pct}%"></div>
    </div>
  `;

  const prevExists = lessons.some(x => x.lessonIndex === lessonIndex - 1);
  const nextExists = lessons.some(x => x.lessonIndex === lessonIndex + 1);
  const p = progressFor(courseId, lessonIndex);

  document.getElementById("lessonCard").innerHTML = `
    <div class="h2">${escapeHtml(lesson.title || "")}</div>
    <hr/>

    <div class="h2">Learn</div>
    <div class="p">${escapeHtml(lesson.learnText || "")}</div>

    <div class="h2">Task</div>
    <div class="p">${escapeHtml(lesson.task || "")}</div>

    <div class="h2">Reflection</div>
    <textarea id="reflection" placeholder="Write your reflection...">${escapeHtml(p.reflectionText || "")}</textarea>

    <div style="height:12px"></div>

    <div class="row" style="justify-content:flex-start; gap:10px;">
      <button class="btn" id="prevBtn" ${prevExists ? "" : "disabled"}>Back</button>
      <button class="btn" id="nextBtn" ${nextExists ? "" : "disabled"}>Next</button>
      <button class="btn primary" id="saveBtn">Save & Complete</button>
      <span class="small" id="saveMsg"></span>
    </div>
  `;

  document.getElementById("prevBtn").onclick = () => {
    if (!prevExists) return;
    setRoute(`lesson/${courseId}/${lessonIndex - 1}`);
    render();
  };

  document.getElementById("nextBtn").onclick = () => {
    if (!nextExists) return;
    setRoute(`lesson/${courseId}/${lessonIndex + 1}`);
    render();
  };

  document.getElementById("saveBtn").onclick = async () => {
    const msg = document.getElementById("saveMsg");
    msg.textContent = "Saving...";

    try {
      await api("/progress/update", {
        method: "POST",
        body: {
          courseId,
          lessonIndex,
          reflection: document.getElementById("reflection").value || "",
          completed: true,
        },
      });

      msg.textContent = "Saved ✅";
      await loadProgress(courseId);
    } catch (e) {
      msg.textContent = "Save failed: " + e.message;
    }
  };
}

// ---------------- GLOBAL FUNCTIONS (required by index.html) ----------------
window.go = function (page) {
  setRoute(page);
  render();
};

window.logout = async function () {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  state.user = null;
  updateNav();
  setRoute("login");
  render();
};

// ---------------- ROUTER ----------------
window.addEventListener("hashchange", render);

// ---------------- BOOT ----------------
(function boot() {
  updateNav();
  if (!location.hash) setRoute("dashboard");
  render();
})();
