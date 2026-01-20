// student-frontend/app.js
// ============================================================
// Student Frontend (SPA)
// Fixes:
// - Correct API_BASE
// - Courses not "undefined" (maps title_en/title_ti + description_en/description_ti)
// - Sort courses by order: foundation -> growth -> excellence
// - Proper Login/Register/Logout visibility
// - Lesson page: Back/Next/Return + Save & Complete
// - Progress bar from /progress/course/:courseId
// ============================================================
// ================= CONFIG =================
// student-frontend/app.js
// Simple stable version: fixes auth buttons + course sorting + lessons + back/next/save

const API_BASE = "https://api.riseeritrea.com/api";

const appEl = document.getElementById("app");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");

const state = {
  user: null,
  lang: "en",
  courses: [],
  lessonsByCourse: {},
  progressByCourse: {}
};

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

function updateAuthButtons() {
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

async function loadMe() {
  const r = await api("/auth/me");
  state.user = r.user;
  updateAuthButtons();
}

async function loadCourses() {
  const r = await api(`/courses?lang=${state.lang}`);
  state.courses = Array.isArray(r.courses) ? r.courses : [];

  // sort by order (1,2,3)
  state.courses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

async function loadLessons(courseId) {
  const r = await api(`/lessons/${courseId}?lang=${state.lang}`);
  state.lessonsByCourse[courseId] = Array.isArray(r.lessons) ? r.lessons : [];
}

async function loadProgress(courseId) {
  const r = await api(`/progress/course/${courseId}`);
  state.progressByCourse[courseId] = r;
}

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

  document.getElementById("langEn").onclick = async () => { state.lang = "en"; renderDashboard(); };
  document.getElementById("langTi").onclick = async () => { state.lang = "ti"; renderDashboard(); };

  const wrap = document.getElementById("coursesWrap");
  wrap.innerHTML = state.courses.map(c => {
    const title = state.lang === "ti" ? (c.title_ti || c.title_en) : (c.title_en || c.title_ti);
    const desc  = state.lang === "ti" ? (c.description_ti || c.description_en) : (c.description_en || c.description_ti);
    return `
      <div class="card">
        <div class="h2">${escapeHtml(title || "")}</div>
        <div class="p">${escapeHtml(desc || "")}</div>
        <button class="btn primary" data-open-course="${c.id}">Open</button>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-open-course]").forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute("data-open-course");
      setHash(`#/course/${id}`);
      render();
    };
  });
}

async function renderCourse(courseId) {
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

  document.getElementById("backDash").onclick = () => { setHash("#/dashboard"); render(); };

  await loadLessons(courseId);
  await loadProgress(courseId);

  const lessons = state.lessonsByCourse[courseId] || [];
  const pmap = state.progressByCourse[courseId]?.byLessonIndex || {};

  const total = lessons.length;
  const completed = Object.values(pmap).filter(x => x?.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById("courseProgress").innerHTML = `
    <div class="small">Progress: <b>${completed}</b> / ${total} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:8px;">
      <div class="progressBar" style="width:${pct}%"></div>
    </div>
  `;

  const wrap = document.getElementById("lessonsWrap");
  wrap.innerHTML = lessons
    .sort((a, b) => a.lessonIndex - b.lessonIndex)
    .map(l => {
      const done = !!pmap[l.lessonIndex]?.completed;
      return `
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center;">
            <div>
              <div class="h2">${escapeHtml(l.title || "")}</div>
              <div class="small">Lesson ${l.lessonIndex + 1} ${done ? "✅" : ""}</div>
            </div>
            <button class="btn primary" data-open-lesson="${l.lessonIndex}">Open</button>
          </div>
        </div>
      `;
    }).join("");

  wrap.querySelectorAll("[data-open-lesson]").forEach(b => {
    b.onclick = () => {
      const idx = b.getAttribute("data-open-lesson");
      setHash(`#/lesson/${courseId}/${idx}`);
      render();
    };
  });
}

async function renderLesson(courseId, lessonIndexStr) {
  const lessonIndex = Number(lessonIndexStr);

  appEl.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <div class="h1">Lesson</div>
          <div class="small">Course: <b>${escapeHtml(courseId)}</b> • Lesson: <b>${lessonIndex + 1}</b></div>
        </div>
        <button class="btn" id="returnCourse">Return</button>
      </div>
      <div id="lessonTopInfo" style="margin-top:10px;"></div>
    </div>

    <div class="card" id="lessonCard">
      <div class="small">Loading...</div>
    </div>
  `;

  document.getElementById("returnCourse").onclick = () => { setHash(`#/course/${courseId}`); render(); };

  if (!state.lessonsByCourse[courseId]) await loadLessons(courseId);
  await loadProgress(courseId);

  const lessons = state.lessonsByCourse[courseId] || [];
  const lesson = lessons.find(x => Number(x.lessonIndex) === lessonIndex);

  if (!lesson) {
    document.getElementById("lessonCard").innerHTML = `<div class="small">Lesson not found.</div>`;
    return;
  }

  const pmap = state.progressByCourse[courseId]?.byLessonIndex || {};
  const doneCount = Object.values(pmap).filter(x => x?.completed).length;
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

  document.getElementById("lessonTopInfo").innerHTML = `
    <div class="small">Course progress: <b>${doneCount}</b> / ${lessons.length} (${pct}%)</div>
    <div class="progressWrap" style="margin-top:8px;">
      <div class="progressBar" style="width:${pct}%"></div>
    </div>
  `;

  const prevExists = lessons.some(x => Number(x.lessonIndex) === lessonIndex - 1);
  const nextExists = lessons.some(x => Number(x.lessonIndex) === lessonIndex + 1);

  const currentProg = pmap[lessonIndex] || {};
  const reflectionText = (currentProg.reflectionText || "").toString();

  document.getElementById("lessonCard").innerHTML = `
    <div class="h2">${escapeHtml(lesson.title || "")}</div>

    <hr/>

    <div class="h2">Learn</div>
    <div class="p">${escapeHtml(lesson.learnText || "")}</div>

    <div class="h2">Task</div>
    <div class="p">${escapeHtml(lesson.task || "")}</div>

    <div class="h2">Reflection</div>
    <textarea id="reflection" placeholder="Write your reflection...">${escapeHtml(reflectionText)}</textarea>

    <div style="height:10px"></div>
    <div class="row" style="gap:8px;justify-content:flex-start;">
      <button class="btn" id="prevBtn" ${prevExists ? "" : "disabled"}>Back</button>
      <button class="btn" id="nextBtn" ${nextExists ? "" : "disabled"}>Next</button>
      <button class="btn primary" id="saveBtn">Save & Complete</button>
    </div>

    <div class="small" id="saveMsg" style="margin-top:10px;"></div>
  `;

  document.getElementById("prevBtn").onclick = () => {
    if (!prevExists) return;
    setHash(`#/lesson/${courseId}/${lessonIndex - 1}`);
    render();
  };

  document.getElementById("nextBtn").onclick = () => {
    if (!nextExists) return;
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

async function render() {
  try { await loadMe(); } catch { state.user = null; updateAuthButtons(); }

  const parts = routeParts();
  const page = parts[0] || "dashboard";

  if (page === "login") return renderLogin();
  if (page === "register") return renderRegister();

  if (!state.user) {
    setHash("#/login");
    return renderLogin();
  }

  if (page === "dashboard") return renderDashboard();
  if (page === "course") return renderCourse(parts[1]);
  if (page === "lesson") return renderLesson(parts[1], parts[2]);

  setHash("#/dashboard");
  return renderDashboard();
}

// header buttons
if (btnLogin) btnLogin.onclick = () => { setHash("#/login"); render(); };
if (btnRegister) btnRegister.onclick = () => { setHash("#/register"); render(); };
if (btnLogout) btnLogout.onclick = async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  state.user = null;
  updateAuthButtons();
  setHash("#/login");
  render();
};

window.addEventListener("hashchange", render);

(function boot() {
  if (!location.hash) setHash("#/dashboard");
  render();
})();
