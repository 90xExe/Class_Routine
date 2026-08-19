"use strict";

const PREFERENCE_KEY = "vu-cse-routine-workspace-v3";
const DEPARTMENTS = {
  cse: {
    short: "CSE",
    name: "Computer Science and Engineering",
    program: "B. Sc. in CSE",
    routineUrl: "./routine.json",
    logoUrl: "./assets/cse-logo.png",
    suppliedFacultyUrl: "./assets/teachers.json?v=20260726-3",
    officialFacultyUrl: "./assets/official-faculty.json?v=20260726-2",
  },
  nfe: {
    short: "NFE",
    name: "Nutrition and Food Engineering",
    program: "B.Sc. in Nutrition and Food Engineering",
    routineUrl: "./routine-nfe.json",
    logoUrl: "./assets/nfe-logo.jpg",
    suppliedFacultyUrl: "",
    officialFacultyUrl: "./assets/official-faculty-nfe.json?v=20260726-1",
  },
};
const DAY_ORDER = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const OFF_DAY_TASKS = [
  {
    title: "Learn Python today",
    detail: "Complete one short lesson and write a small Python program.",
  },
  {
    title: "Research a useful app",
    detail: "Choose one productivity or learning app and note three useful features.",
  },
  {
    title: "Build a mini webpage",
    detail: "Create a simple responsive page using HTML and CSS.",
  },
  {
    title: "Solve two coding problems",
    detail: "Practise two beginner-friendly problems in your preferred language.",
  },
  {
    title: "Review a difficult topic",
    detail: "Spend 30 focused minutes revising one topic from this semester.",
  },
  {
    title: "Improve your GitHub profile",
    detail: "Update a README, organise a repository or publish a small project.",
  },
  {
    title: "Explore a technology",
    detail: "Research one new tool, framework or AI feature and write a short summary.",
  },
  {
    title: "Plan the next study week",
    detail: "List your three most important academic goals for the coming week.",
  },
];

const routines = {};
const teacherDirectories = {};
let routine = null;
let teacherDirectory = [];
let toastTimer = null;
let lastClassTrigger = null;

const state = {
  department: "cse",
  role: "student",
  view: "day",
  semesterId: 7,
  sectionId: 6,
  teacher: "",
  room: "",
  keyword: "",
  selectedDate: "",
};

const elements = {
  departmentSelect: document.getElementById("department-select"),
  brandLink: document.getElementById("brand-link"),
  brandLogo: document.getElementById("brand-logo"),
  brandDepartment: document.getElementById("brand-department"),
  favicon: document.getElementById("site-favicon"),
  appleTouchIcon: document.getElementById("apple-touch-icon"),
  footerDepartment: document.getElementById("footer-department"),
  theme: document.getElementById("theme-toggle"),
  print: document.getElementById("print-routine"),
  studentRole: document.getElementById("student-role"),
  teacherRole: document.getElementById("teacher-role"),
  studentControls: document.getElementById("student-controls"),
  teacherControls: document.getElementById("teacher-controls"),
  semester: document.getElementById("semester-select"),
  section: document.getElementById("section-select"),
  teacher: document.getElementById("teacher-select"),
  teacherMenu: document.getElementById("teacher-options"),
  teacherToggle: document.getElementById("teacher-toggle"),
  room: document.getElementById("room-search"),
  roomMenu: document.getElementById("room-options"),
  roomToggle: document.getElementById("room-toggle"),
  keyword: document.getElementById("keyword-search"),
  dayView: document.getElementById("day-view"),
  fullView: document.getElementById("full-view"),
  saveDefault: document.getElementById("save-default"),
  coverage: document.getElementById("coverage-banner"),
  dateNavigation: document.getElementById("date-navigation"),
  previousDay: document.getElementById("previous-day"),
  nextDay: document.getElementById("next-day"),
  goToday: document.getElementById("go-today"),
  datePicker: document.getElementById("date-picker"),
  selectedDateLabel: document.getElementById("selected-date-label"),
  selectedDayName: document.getElementById("selected-day-name"),
  selectedDateLong: document.getElementById("selected-date-long"),
  weekStrip: document.getElementById("week-strip"),
  resultSummary: document.getElementById("result-summary"),
  content: document.getElementById("schedule-content"),
  liveDay: document.getElementById("live-day"),
  liveTime: document.getElementById("live-time"),
  footerCoverage: document.getElementById("footer-coverage"),
  classDialog: document.getElementById("class-detail-dialog"),
  classDialogTitle: document.getElementById("class-detail-title"),
  classDialogContent: document.getElementById("class-detail-content"),
  classDialogClose: document.getElementById("class-detail-close"),
  toast: document.getElementById("toast"),
};

function departmentConfig() {
  return DEPARTMENTS[state.department] || DEPARTMENTS.cse;
}

function activateDepartmentData() {
  routine = routines[state.department] || routines.cse;
  teacherDirectory = teacherDirectories[state.department] || [];
}

function renderDepartment() {
  const config = departmentConfig();
  document.body.dataset.department = state.department;
  elements.departmentSelect.value = state.department;
  elements.brandLogo.src = config.logoUrl;
  elements.brandLogo.alt = `${config.name}, Varendra University`;
  elements.brandLink.setAttribute(
    "aria-label",
    `VU ${config.short} routine home`,
  );
  elements.brandDepartment.textContent =
    `${config.short} students, teachers & classrooms`;
  elements.footerDepartment.textContent = `VU ${config.short}`;
  elements.favicon.href = config.logoUrl;
  elements.appleTouchIcon.href = config.logoUrl;
  document.title = `VU ${config.short} | Routine Workspace`;
}

function unavailableRoutine(department) {
  const config = DEPARTMENTS[department];
  return {
    meta: {
      department,
      program: config.program,
      timezone: "Asia/Dhaka",
      updated: "Pending",
      lastSyncedAt: "",
      coverage: {
        loadedSchedules: 0,
        isComplete: false,
        scannedCombinations: 0,
        totalClasses: 0,
        note: `${config.short} routine data is waiting for its first official sync.`,
      },
    },
    catalog: { semesters: [], sections: [] },
    slots: routines.cse?.slots || [],
    schedules: [],
  };
}

async function loadJSON(url, required = false) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${url} request failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (required) throw error;
    console.warn(error);
    return null;
  }
}

async function loadFaculty(url) {
  if (!url) return [];
  const directory = await loadJSON(url);
  if (!directory) return [];
  if (Array.isArray(directory.teachers)) return directory.teachers;
  if (Array.isArray(directory.faculty)) return directory.faculty;
  return [];
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDhakaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: routine?.meta?.timezone || "Asia/Dhaka",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    weekday: parts.weekday,
    day: parts.day,
    month: parts.month,
    year: parts.year,
    time: `${parts.hour}:${parts.minute} ${String(parts.dayPeriod || "").toUpperCase()}`.trim(),
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function isoToDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function dateToISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(iso, amount) {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + amount);
  return dateToISO(date);
}

function weekdayForISO(iso) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    isoToDate(iso),
  );
}

function longDate(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(isoToDate(iso));
}

function shortMonth(iso) {
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
    isoToDate(iso),
  );
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function dhakaSeconds(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: routine?.meta?.timezone || "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return (
    Number(parts.hour) * 60 * 60 +
    Number(parts.minute) * 60 +
    Number(parts.second)
  );
}

function timeToSeconds(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 * 60 + minutes * 60;
}

function formatCountdown(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function intervalTimeStatus(start, end, scheduleDate = state.selectedDate) {
  const today = getDhakaParts().iso;
  if (scheduleDate < today) return { key: "ended", remaining: 0 };
  if (scheduleDate > today) return { key: "upcoming", remaining: 0 };

  const now = dhakaSeconds();
  const startSeconds = timeToSeconds(start);
  const endSeconds = timeToSeconds(end);
  if (now < startSeconds) return { key: "upcoming", remaining: startSeconds - now };
  if (now >= endSeconds) return { key: "ended", remaining: 0 };
  return { key: "running", remaining: endSeconds - now };
}

function classTimeStatus(start, end, scheduleDate = state.selectedDate) {
  const status = intervalTimeStatus(start, end, scheduleDate);
  return {
    ...status,
    label:
      status.key === "running"
        ? "Running"
        : status.key === "ended"
          ? "Ended"
          : "Upcoming",
  };
}

function formatDuration(start, end) {
  const total = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function offDayTask() {
  const key = `${state.selectedDate}-${state.semesterId}-${state.sectionId}`;
  const hash = [...key].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return OFF_DAY_TASKS[hash % OFF_DAY_TASKS.length];
}

function slotById(id) {
  return routine.slots.find((slot) => slot.id === id);
}

function freeEndForSlot(slot) {
  const index = routine.slots.findIndex((item) => item.id === slot.id);
  const nextSlot = routine.slots[index + 1];
  return nextSlot?.start || slot.end;
}

function scheduleForSelection() {
  return routine.schedules.find(
    (schedule) =>
      schedule.semesterId === state.semesterId &&
      schedule.sectionId === state.sectionId,
  );
}

function loadedSemesters() {
  const loadedIds = new Set(
    routine.schedules.map((schedule) => schedule.semesterId),
  );
  return routine.catalog.semesters.filter((semester) =>
    loadedIds.has(semester.id),
  );
}

function loadedSections(semesterId = state.semesterId) {
  const loadedIds = new Set(
    routine.schedules
      .filter((schedule) => schedule.semesterId === semesterId)
      .map((schedule) => schedule.sectionId),
  );
  return routine.catalog.sections.filter((section) => loadedIds.has(section.id));
}

function allInstances() {
  return routine.schedules.flatMap((schedule) =>
    schedule.days.flatMap((day) =>
      day.classes.map((course) => ({
        ...course,
        day: day.name,
        semesterId: schedule.semesterId,
        sectionId: schedule.sectionId,
        semester: schedule.semester,
        section: schedule.section,
      })),
    ),
  );
}

function allTeachers() {
  return [
    ...new Set([
      ...allInstances().flatMap((course) =>
        Array.isArray(course.teachers) ? course.teachers : [],
      ),
      ...teacherDirectory.map((teacher) => teacher.name).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b));
}

function allRooms() {
  return [
    ...new Set(
      allInstances()
        .map((course) => course.room.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function roomMatches(course) {
  const query = normalize(state.room);
  return query ? normalize(course.room).includes(query) : false;
}

function teacherMatches(course) {
  const query = normalize(state.teacher);
  return query
    ? (course.teachers || []).some((teacher) =>
        normalize(teacher).includes(query),
      )
    : false;
}

function keywordMatches(course) {
  const query = normalize(state.keyword);
  if (!query) return true;
  return normalize(
    [
      course.code,
      course.title,
      course.room,
      ...(course.teachers || []),
      course.semester,
      course.section,
    ].join(" "),
  ).includes(query);
}

function contextInstances(dayName = null, applyKeyword = true) {
  const instances = allInstances();

  if (state.room) {
    return instances.filter(
      (course) => roomMatches(course) && (!dayName || course.day === dayName),
    );
  }

  if (state.role === "teacher") {
    if (!state.teacher) return [];
    return instances.filter(
      (course) =>
        teacherMatches(course) &&
        (!dayName || course.day === dayName) &&
        (!applyKeyword || keywordMatches(course)),
    );
  }

  const schedule = scheduleForSelection();
  if (!schedule) return [];
  return schedule.days
    .filter((day) => !dayName || day.name === dayName)
    .flatMap((day) =>
      day.classes
        .map((course) => ({
          ...course,
          day: day.name,
          semesterId: schedule.semesterId,
          sectionId: schedule.sectionId,
          semester: schedule.semester,
          section: schedule.section,
        }))
        .filter((course) => !applyKeyword || keywordMatches(course)),
    );
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    if (Object.hasOwn(DEPARTMENTS, saved.department)) {
      state.department = saved.department;
    }
    if (["student", "teacher"].includes(saved.role)) state.role = saved.role;
    if (["day", "full"].includes(saved.view)) state.view = saved.view;
    if (Number.isInteger(saved.semesterId)) state.semesterId = saved.semesterId;
    if (Number.isInteger(saved.sectionId)) state.sectionId = saved.sectionId;
    if (typeof saved.teacher === "string") state.teacher = saved.teacher;
    if (typeof saved.room === "string") state.room = saved.room;
  } catch {
    localStorage.removeItem(PREFERENCE_KEY);
  }
}

function saveAsDefault() {
  localStorage.setItem(
    PREFERENCE_KEY,
    JSON.stringify({
      department: state.department,
      role: state.role,
      view: state.view,
      semesterId: state.semesterId,
      sectionId: state.sectionId,
      teacher: state.teacher,
      room: state.room,
    }),
  );
  const label =
    state.room
      ? `Room explorer for ${state.room}`
      : state.role === "teacher" && state.teacher
      ? `Teacher view for ${state.teacher}`
      : `Student view for ${semesterLabel(state.semesterId)}, Section ${sectionLabel(state.sectionId)}`;
  showToast(`${DEPARTMENTS[state.department].short}: ${label} saved as your default.`);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(
    () => elements.toast.classList.remove("show"),
    2600,
  );
}

function semesterLabel(id) {
  return (
    routine.catalog.semesters.find((semester) => semester.id === id)?.label ||
    `Semester ${id}`
  );
}

function sectionLabel(id) {
  return (
    routine.catalog.sections.find((section) => section.id === id)?.label ||
    String(id)
  );
}

function populateControls() {
  const semesters = loadedSemesters();
  if (!semesters.some((semester) => semester.id === state.semesterId)) {
    state.semesterId = semesters[0]?.id ?? state.semesterId;
  }

  elements.semester.innerHTML = semesters
    .map(
      (semester) =>
        `<option value="${semester.id}">${escapeHTML(semester.label)}</option>`,
    )
    .join("");
  elements.semester.value = String(state.semesterId);
  elements.semester.disabled = semesters.length === 0;

  renderSectionOptions();

  const teachers = allTeachers();
  if (
    state.teacher &&
    !teachers.some((teacher) =>
      normalize(teacher).includes(normalize(state.teacher)),
    )
  ) {
    state.teacher = "";
  }
  elements.teacher.value = state.teacher;

  elements.room.value = state.room;
}

function comboboxConfig(kind) {
  if (kind === "teacher") {
    return {
      input: elements.teacher,
      menu: elements.teacherMenu,
      toggle: elements.teacherToggle,
      values: allTeachers(),
      emptyLabel: "No matching teacher",
    };
  }
  return {
    input: elements.room,
    menu: elements.roomMenu,
    toggle: elements.roomToggle,
    values: allRooms(),
    emptyLabel: "No matching classroom",
  };
}

function closeCombobox(kind) {
  const { input, menu, toggle } = comboboxConfig(kind);
  menu.hidden = true;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  toggle.setAttribute("aria-expanded", "false");
}

function closeAllComboboxes() {
  closeCombobox("teacher");
  closeCombobox("room");
}

function openCombobox(kind) {
  closeCombobox(kind === "teacher" ? "room" : "teacher");
  const { input, menu, toggle, values, emptyLabel } = comboboxConfig(kind);
  const query = normalize(input.value);
  const matches = values.filter((value) => normalize(value).includes(query));
  menu.replaceChildren();

  if (!matches.length) {
    const empty = document.createElement("span");
    empty.className = "combobox-empty";
    empty.textContent = emptyLabel;
    menu.appendChild(empty);
  } else {
    matches.forEach((value, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "combobox-option";
      option.id = `${kind}-option-${index}`;
      option.dataset.value = value;
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        String(normalize(value) === normalize(input.value)),
      );
      option.tabIndex = -1;
      option.textContent = value;
      menu.appendChild(option);
    });
  }

  menu.hidden = false;
  input.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-expanded", "true");
}

function selectComboboxValue(kind, value) {
  const { input } = comboboxConfig(kind);
  input.value = value;
  if (kind === "teacher") {
    state.teacher = value;
  } else {
    state.room = value;
  }
  input.focus({ preventScroll: true });
  closeCombobox(kind);
  renderWorkspace();
}

function focusComboboxOption(kind, direction = 1) {
  const { input, menu } = comboboxConfig(kind);
  if (menu.hidden) openCombobox(kind);
  const options = [...menu.querySelectorAll(".combobox-option")];
  if (!options.length) return;
  const activeIndex = options.indexOf(document.activeElement);
  const nextIndex =
    activeIndex < 0
      ? direction > 0
        ? 0
        : options.length - 1
      : (activeIndex + direction + options.length) % options.length;
  const option = options[nextIndex];
  input.setAttribute("aria-activedescendant", option.id);
  option.focus();
}

function bindCombobox(kind) {
  const { input, menu, toggle } = comboboxConfig(kind);

  input.addEventListener("focus", () => openCombobox(kind));
  input.addEventListener("input", () => openCombobox(kind));
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    if (menu.hidden) {
      openCombobox(kind);
      input.focus({ preventScroll: true });
    } else {
      closeCombobox(kind);
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusComboboxOption(kind, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && !menu.hidden) {
      const first = menu.querySelector(".combobox-option");
      if (first) {
        event.preventDefault();
        selectComboboxValue(kind, first.dataset.value);
      }
    } else if (event.key === "Escape") {
      closeCombobox(kind);
    }
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest(".combobox-option");
    if (option) {
      event.preventDefault();
      selectComboboxValue(kind, option.dataset.value);
    }
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusComboboxOption(kind, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeCombobox(kind);
      input.focus({ preventScroll: true });
    }
  });
}

function renderSectionOptions() {
  const sections = loadedSections();
  if (!sections.some((section) => section.id === state.sectionId)) {
    state.sectionId = sections[0]?.id ?? state.sectionId;
  }

  elements.section.innerHTML = sections
    .map(
      (section) =>
        `<option value="${section.id}">${escapeHTML(section.label)}</option>`,
    )
    .join("");
  elements.section.value = String(state.sectionId);
  elements.section.disabled = sections.length === 0;
}

function renderRole() {
  const isStudent = state.role === "student";
  elements.studentRole.classList.toggle("active", isStudent);
  elements.studentRole.setAttribute("aria-selected", String(isStudent));
  elements.teacherRole.classList.toggle("active", !isStudent);
  elements.teacherRole.setAttribute("aria-selected", String(!isStudent));
  elements.studentControls.hidden = !isStudent;
  elements.teacherControls.hidden = isStudent;
}

function renderView() {
  const isDay = state.view === "day";
  elements.dayView.classList.toggle("active", isDay);
  elements.fullView.classList.toggle("active", !isDay);
  elements.dateNavigation.hidden = !isDay;
  elements.weekStrip.hidden = !isDay;
}

function renderCoverage() {
  const config = departmentConfig();
  const coverage = routine.meta.coverage;
  const loaded = routine.schedules.length;
  const rooms = allRooms().length;
  const teachers = allTeachers().length;
  const scanned = coverage.scannedCombinations || loaded;
  const lastSynced = routine.meta.lastSyncedAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: routine.meta.timezone || "Asia/Dhaka",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(routine.meta.lastSyncedAt))
    : routine.meta.updated;

  elements.footerCoverage.textContent = `${config.short}: ${loaded} published routines / ${teachers} teachers / ${rooms} rooms`;

  if (coverage.isComplete) {
    elements.coverage.className = "coverage-banner complete";
    elements.coverage.innerHTML = `
      <span aria-hidden="true">OK</span>
      <p><strong>Official ${config.short} routines synced: ${loaded} published schedules</strong><small>All ${scanned} combinations checked; room availability is fully cross-checked. Last data update: ${escapeHTML(lastSynced)}.</small></p>
    `;
  } else {
    elements.coverage.className = "coverage-banner warning";
    elements.coverage.innerHTML = `
      <span aria-hidden="true">Info</span>
      <p><strong>${config.short} data pending: ${loaded} published schedules</strong><small>${escapeHTML(coverage.note)} Room availability is labelled carefully until the full import is complete.</small></p>
    `;
  }
}

function updateLiveClock() {
  const now = getDhakaParts();
  elements.liveDay.textContent = now.weekday;
  elements.liveTime.textContent = now.time;
  updateVisibleClassStatuses();
}

function renderDateNavigation() {
  const today = getDhakaParts().iso;
  if (!state.selectedDate || state.selectedDate < today) {
    state.selectedDate = today;
  }
  const selected = isoToDate(state.selectedDate);
  const offset = Math.round(
    (selected - isoToDate(today)) / (24 * 60 * 60 * 1000),
  );
  elements.selectedDateLabel.textContent =
    offset === 0
      ? "Today"
      : offset === 1
        ? "Tomorrow"
        : "Upcoming date";
  elements.selectedDayName.textContent = weekdayForISO(state.selectedDate);
  elements.selectedDateLong.textContent = longDate(state.selectedDate);
  elements.datePicker.value = state.selectedDate;
  elements.datePicker.min = today;
  elements.previousDay.disabled = offset <= 0;
  elements.goToday.disabled = offset === 0;
}

function weekStartSaturday(iso) {
  const date = isoToDate(iso);
  const daysSinceSaturday = (date.getDay() - 6 + 7) % 7;
  date.setDate(date.getDate() - daysSinceSaturday);
  return dateToISO(date);
}

function sourceHasSchedule() {
  if (state.room) return true;
  if (state.role === "teacher") return Boolean(state.teacher);
  return Boolean(scheduleForSelection());
}

function countForDay(dayName) {
  return contextInstances(dayName).length;
}

function renderWeekStrip() {
  const start = weekStartSaturday(state.selectedDate);
  const today = getDhakaParts().iso;
  const hasSource = sourceHasSchedule();
  elements.weekStrip.replaceChildren();

  for (let index = 0; index < 7; index += 1) {
    const iso = addDays(start, index);
    if (iso < today) continue;
    const dayName = weekdayForISO(iso);
    const count = countForDay(dayName);
    const scheduledCount = contextInstances(dayName, false).length;
    const isOffDay =
      hasSource && !state.room && scheduledCount === 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "week-day";
    if (iso === state.selectedDate) button.classList.add("selected");
    if (iso === today) button.classList.add("today");
    if (isOffDay) button.classList.add("off-day");
    button.setAttribute(
      "aria-label",
      `${dayName}, ${longDate(iso)}, ${
        isOffDay ? "off day" : `${count} ${count === 1 ? "class" : "classes"}`
      }`,
    );
    button.innerHTML = `
      <span>${escapeHTML(dayName.slice(0, 3))}</span>
      <strong>${isoToDate(iso).getDate()}</strong>
      <small>${escapeHTML(shortMonth(iso))}</small>
      <i>${hasSource ? (isOffDay ? "OFF" : count) : "-"}</i>
    `;
    button.addEventListener("click", () => {
      state.selectedDate = iso;
      renderWorkspace();
    });
    elements.weekStrip.appendChild(button);
  }

  elements.weekStrip.style.setProperty(
    "--visible-days",
    String(elements.weekStrip.childElementCount || 1),
  );

  window.requestAnimationFrame(() => {
    const selected = elements.weekStrip.querySelector(".week-day.selected");
    if (
      selected &&
      elements.weekStrip.scrollWidth > elements.weekStrip.clientWidth
    ) {
      elements.weekStrip.scrollLeft =
        selected.offsetLeft -
        (elements.weekStrip.clientWidth - selected.offsetWidth) / 2;
    }
  });
}

function contextTitle() {
  if (state.room) return `Room "${state.room}" explorer`;
  if (state.role === "teacher") {
    return state.teacher ? `Teacher search: "${state.teacher}"` : "Search a teacher";
  }
  return `${semesterLabel(state.semesterId)} / Section ${sectionLabel(state.sectionId)}`;
}

function exactSelectedTeacher() {
  const query = normalize(state.teacher);
  if (!query) return "";
  return allTeachers().find((teacher) => normalize(teacher) === query) || "";
}

function compactTeacherContact(label, value, teacherName, email = false) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    return `
      <div class="compact-teacher-contact unavailable">
        <span>${escapeHTML(label)}</span>
        <strong>Not available</strong>
      </div>
    `;
  }

  const renderedValue = email
    ? `<a href="mailto:${escapeHTML(cleanValue)}">${escapeHTML(cleanValue)}</a>`
    : `<strong>${escapeHTML(cleanValue)}</strong>`;
  return `
    <div class="compact-teacher-contact">
      <span>${escapeHTML(label)}</span>
      <div>
        ${renderedValue}
        <button
          class="copy-detail-button compact"
          type="button"
          data-copy-value="${escapeHTML(cleanValue)}"
          data-copy-label="${escapeHTML(`${teacherName}'s ${label.toLowerCase()}`)}"
          aria-label="${escapeHTML(`Copy ${teacherName}'s ${label.toLowerCase()}`)}"
        >Copy</button>
      </div>
    </div>
  `;
}

function compactTeacherProfileMarkup(teacherName) {
  const directory = directoryTeacherByName(teacherName);
  const details = teacherRoutineDetails(teacherName);
  const displayedName = directory?.name || teacherName;
  return `
    <article class="teacher-search-profile" aria-label="${escapeHTML(`Profile for ${displayedName}`)}">
      ${teacherAvatarMarkup(displayedName, directory, "teacher-search-avatar")}
      <div class="teacher-search-identity">
        <span>Selected teacher</span>
        <h3>${escapeHTML(displayedName)}</h3>
        <p>${escapeHTML(directory?.designation || "Designation not available")}</p>
        ${
          directory?.profile
            ? `<a class="official-profile-link" href="${escapeHTML(directory.profile)}" target="_blank" rel="noopener noreferrer">Official profile</a>`
            : ""
        }
      </div>
      <div class="teacher-search-contacts">
        ${compactTeacherContact("Email", directory?.email, displayedName, true)}
        ${state.department === "cse" ? compactTeacherContact("Contact", directory?.contact, displayedName) : ""}
      </div>
      <div class="teacher-search-stats">
        <span><strong>${details.sessions}</strong> weekly ${details.sessions === 1 ? "session" : "sessions"}</span>
        <span><strong>${details.courses.length}</strong> ${details.courses.length === 1 ? "course" : "courses"}</span>
      </div>
    </article>
  `;
}

function renderResultSummary() {
  if (!routine.schedules.length) {
    const config = departmentConfig();
    elements.resultSummary.classList.remove("has-teacher-profile");
    elements.resultSummary.innerHTML = `
      <div>
        <span class="summary-kicker">${escapeHTML(config.short)} workspace</span>
        <h2>${escapeHTML(config.name)}</h2>
        <p>Waiting for the first official routine sync</p>
      </div>
      <div class="summary-metrics">
        <span><strong>0</strong><small>classes</small></span>
        <span><strong>0</strong><small>sections checked</small></span>
      </div>
    `;
    return;
  }

  const isRoom = Boolean(state.room);
  const selectedTeacher =
    state.role === "teacher" && !isRoom ? exactSelectedTeacher() : "";
  const subtitle =
    state.view === "full"
      ? "Complete weekly routine"
      : `${weekdayForISO(state.selectedDate)} / ${longDate(state.selectedDate)}`;
  const count =
    state.view === "full"
      ? contextInstances().length
      : contextInstances(weekdayForISO(state.selectedDate)).length;
  const context = isRoom
    ? "Cross-section room check"
    : state.role === "teacher"
      ? "Teacher schedule"
      : "Student schedule";

  elements.resultSummary.classList.toggle(
    "has-teacher-profile",
    Boolean(selectedTeacher),
  );
  elements.resultSummary.innerHTML = `
    <div>
      <span class="summary-kicker">${escapeHTML(context)}</span>
      <h2>${escapeHTML(contextTitle())}</h2>
      <p>${escapeHTML(subtitle)}</p>
    </div>
    <div class="summary-metrics">
      <span><strong>${count}</strong><small>${count === 1 ? "class" : "classes"}</small></span>
      <span><strong>${routine.schedules.length}</strong><small>sections checked</small></span>
    </div>
    ${selectedTeacher ? compactTeacherProfileMarkup(selectedTeacher) : ""}
  `;
}

function teacherRoutineDetails(teacherName) {
  const classes = allInstances().filter((course) =>
    (course.teachers || []).some(
      (teacher) => normalize(teacher) === normalize(teacherName),
    ),
  );
  const sessions = new Set(
    classes.map(
      (course) =>
        `${course.day}-${course.slot}-${course.semesterId}-${course.sectionId}-${course.code}`,
    ),
  );
  return {
    sessions: sessions.size,
    courses: [...new Set(classes.map((course) => course.code))].sort(),
    cohorts: [
      ...new Set(
        classes.map((course) => `${course.semester} / ${course.section}`),
      ),
    ].sort(),
    rooms: [...new Set(classes.map((course) => course.room).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true }),
    ),
  };
}

function normalizeTeacherName(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directoryTeacherByName(teacherName) {
  const query = normalizeTeacherName(teacherName);
  if (!query) return null;
  return (
    teacherDirectory.find((teacher) =>
      [teacher.name, ...(teacher.aliases || [])].some(
        (name) => normalizeTeacherName(name) === query,
      ),
    ) || null
  );
}

function mergeTeacherDirectories(directory, officialFaculty) {
  const usedOfficial = new Set();
  const merged = directory.map((teacher) => {
    const teacherNames = [teacher.name, ...(teacher.aliases || [])].map(
      normalizeTeacherName,
    );
    const teacherEmail = normalize(teacher.email);
    const officialIndex = officialFaculty.findIndex((official, index) => {
      if (usedOfficial.has(index)) return false;
      if (teacherEmail && normalize(official.email) === teacherEmail) return true;
      return teacherNames.includes(normalizeTeacherName(official.name));
    });
    if (officialIndex < 0) return teacher;

    usedOfficial.add(officialIndex);
    const official = officialFaculty[officialIndex];
    return {
      ...teacher,
      designation: official.designation || teacher.designation,
      email: official.email || teacher.email,
      image: official.image || "",
      profile: official.profile || "",
      officialName: official.name || teacher.name,
    };
  });

  officialFaculty.forEach((official, index) => {
    if (usedOfficial.has(index)) return;
    merged.push({
      name: official.name,
      designation: official.designation || "",
      email: official.email || "",
      contact: "",
      image: official.image || "",
      profile: official.profile || "",
      aliases: [],
    });
  });
  return merged;
}

function teacherInitials(name) {
  const parts = String(name || "")
    .replaceAll(".", "")
    .split(/\s+/)
    .filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "T").toUpperCase();
}

function teacherAvatarMarkup(name, directory, className) {
  return `
    <span class="${escapeHTML(className)}" aria-hidden="true">
      <span>${escapeHTML(teacherInitials(name))}</span>
      ${
        directory?.image
          ? `<img src="${escapeHTML(directory.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : ""
      }
    </span>
  `;
}

function closeClassDetails() {
  if (!elements.classDialog || !elements.classDialog.hasAttribute("open")) return;
  if (typeof elements.classDialog.close === "function") {
    elements.classDialog.close();
  } else {
    elements.classDialog.removeAttribute("open");
  }
}

function copyableTeacherFact(label, value, teacherName, href = "") {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    return `
      <div class="teacher-contact-item unavailable">
        <span>${escapeHTML(label)}</span>
        <div><strong>Not available</strong></div>
      </div>
    `;
  }

  const renderedValue = href
    ? `<a href="${escapeHTML(href)}">${escapeHTML(cleanValue)}</a>`
    : `<strong>${escapeHTML(cleanValue)}</strong>`;
  return `
    <div class="teacher-contact-item">
      <span>${escapeHTML(label)}</span>
      <div>
        ${renderedValue}
        <button
          class="copy-detail-button"
          type="button"
          data-copy-value="${escapeHTML(cleanValue)}"
          data-copy-label="${escapeHTML(`${teacherName}'s ${label.toLowerCase()}`)}"
          aria-label="${escapeHTML(`Copy ${teacherName}'s ${label.toLowerCase()}`)}"
        >Copy</button>
      </div>
    </div>
  `;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command was not available.");
}

async function handleCopyDetailClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest(".copy-detail-button");
  if (!button) return;
  try {
    await copyText(button.dataset.copyValue || "");
    const originalLabel = button.textContent;
    button.textContent = "Copied";
    showToast(`${button.dataset.copyLabel || "Teacher detail"} copied.`);
    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1600);
  } catch (error) {
    console.error(error);
    showToast("Could not copy this detail.");
  }
}

function openClassDetails(course) {
  if (
    !elements.classDialog ||
    !elements.classDialogTitle ||
    !elements.classDialogContent
  ) {
    return;
  }

  const slot = slotById(course.slot);
  const teachers = Array.isArray(course.teachers) ? course.teachers : [];
  const teacherMarkup = teachers.length
    ? teachers
        .map((teacher) => {
          const details = teacherRoutineDetails(teacher);
          const directory = directoryTeacherByName(teacher);
          const displayedName = directory?.name || teacher;
          const sessionLabel = details.sessions === 1 ? "session" : "sessions";
          return `
            <article class="teacher-profile">
              ${teacherAvatarMarkup(displayedName, directory, "teacher-initial")}
              <div class="teacher-profile-main">
                <span>${directory ? "Teacher directory" : "Routine profile"}</span>
                <h3>${escapeHTML(displayedName)}</h3>
                <p>${escapeHTML(directory?.designation || "Designation not available")} &middot; ${details.sessions} weekly ${sessionLabel}</p>
                ${
                  directory?.profile
                    ? `<a class="official-profile-link" href="${escapeHTML(directory.profile)}" target="_blank" rel="noopener noreferrer">Official profile</a>`
                    : ""
                }
              </div>
              <div class="teacher-contact-grid">
                ${copyableTeacherFact("Name", displayedName, displayedName)}
                ${copyableTeacherFact("Designation", directory?.designation, displayedName)}
                ${copyableTeacherFact(
                  "Email",
                  directory?.email,
                  displayedName,
                  directory?.email ? `mailto:${directory.email}` : "",
                )}
                ${state.department === "cse" ? copyableTeacherFact("Contact", directory?.contact, displayedName) : ""}
              </div>
              <dl class="teacher-routine-facts">
                <div><dt>Courses</dt><dd>${escapeHTML(details.courses.join(", ") || "Not listed")}</dd></div>
                <div><dt>Sections</dt><dd>${escapeHTML(details.cohorts.join(", ") || "Not listed")}</dd></div>
                <div><dt>Rooms</dt><dd>${escapeHTML(details.rooms.join(", ") || "Not listed")}</dd></div>
              </dl>
            </article>
          `;
        })
        .join("")
    : `
      <article class="teacher-profile empty">
        <div class="teacher-profile-main">
          <span>Routine profile</span>
          <h3>Teacher not listed</h3>
          <p>The official routine does not include a teacher name for this class.</p>
        </div>
      </article>
    `;

  elements.classDialogTitle.textContent = `${course.code} details`;
  elements.classDialogContent.innerHTML = `
    <div class="class-detail-course">
      <div>
        <span>${escapeHTML(course.code)}</span>
        <strong>${escapeHTML(course.type === "lab" ? "Lab class" : "Theory class")}</strong>
      </div>
      <h3>${escapeHTML(course.title)}</h3>
    </div>
    <div class="class-detail-facts">
      <div><span>Schedule</span><strong>${escapeHTML(course.day)}, ${escapeHTML(formatTime(slot.start))} – ${escapeHTML(formatTime(slot.end))}</strong></div>
      <div><span>Semester and section</span><strong>${escapeHTML(course.semester)} / ${escapeHTML(course.section)}</strong></div>
      <div><span>Classroom</span><strong>${escapeHTML(course.room || "Not listed")}</strong></div>
      <div><span>Slot</span><strong>Slot ${escapeHTML(slot.id)}</strong></div>
    </div>
    <section class="class-teachers" aria-label="Teacher details">
      <header>
        <span>Teaching team</span>
        <h3>${teachers.length} ${teachers.length === 1 ? "teacher" : "teachers"} assigned</h3>
      </header>
      <div class="teacher-profile-list">${teacherMarkup}</div>
    </section>
  `;

  lastClassTrigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (typeof elements.classDialog.showModal === "function") {
    elements.classDialog.showModal();
  } else {
    elements.classDialog.setAttribute("open", "");
  }
  elements.classDialogClose?.focus();
}

function makeClassInteractive(element, course) {
  element.classList.add("class-card-actionable");
  element.tabIndex = 0;
  element.setAttribute("role", "button");
  element.setAttribute("aria-haspopup", "dialog");
  element.setAttribute(
    "aria-label",
    `View class and teacher details for ${course.code}, ${course.title}`,
  );
  element.addEventListener("click", () => openClassDetails(course));
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openClassDetails(course);
  });
}

function classCard(course, options = {}) {
  const slot = slotById(course.slot);
  const scheduleDate = options.date || state.selectedDate;
  const status = classTimeStatus(slot.start, slot.end, scheduleDate);
  const article = document.createElement("article");
  article.className = `workspace-class-card ${course.type || "theory"}${
    options.compact ? " compact" : ""
  } status-${status.key}`;
  article.dataset.slotStart = slot.start;
  article.dataset.slotEnd = slot.end;
  article.dataset.scheduleDate = scheduleDate;
  article.innerHTML = `
    <div class="class-time">
      <strong>${formatTime(slot.start)}</strong>
      <span>${formatTime(slot.end)}</span>
      <i>Slot ${slot.id}</i>
    </div>
    <div class="class-main">
      <div class="class-labels">
        <span class="course-code">${escapeHTML(course.code)}</span>
        <span class="class-cohort">${escapeHTML(course.semester)} / ${escapeHTML(course.section)}</span>
        <span class="class-status ${status.key}" aria-label="Class status: ${status.label}">
          <i aria-hidden="true"></i><span class="class-status-label">${status.label}</span>
        </span>
        <span class="class-countdown" aria-live="off"${status.key === "running" ? "" : " hidden"}>${status.key === "running" ? `${formatCountdown(status.remaining)} left` : ""}</span>
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML((course.teachers || []).join(", "))}</p>
      <span class="class-detail-action" aria-hidden="true">View details</span>
    </div>
    <div class="class-room">
      <span>Room</span>
      <strong>${escapeHTML(course.room)}</strong>
    </div>
  `;
  makeClassInteractive(article, course);
  return article;
}

function updateVisibleClassStatuses() {
  if (!routine) return;
  document
    .querySelectorAll(".workspace-class-card[data-schedule-date]")
    .forEach((card) => {
      const status = classTimeStatus(
        card.dataset.slotStart,
        card.dataset.slotEnd,
        card.dataset.scheduleDate,
      );
      card.classList.remove(
        "status-running",
        "status-ended",
        "status-upcoming",
      );
      card.classList.add(`status-${status.key}`);

      const badge = card.querySelector(".class-status");
      if (badge) {
        badge.className = `class-status ${status.key}`;
        badge.setAttribute("aria-label", `Class status: ${status.label}`);
        const label = badge.querySelector(".class-status-label");
        if (label) label.textContent = status.label;
      }

      const countdown = card.querySelector(".class-countdown");
      if (countdown) {
        const isRunning = status.key === "running";
        countdown.hidden = !isRunning;
        countdown.textContent = isRunning
          ? `${formatCountdown(status.remaining)} left`
          : "";
      }
    });

  document
    .querySelectorAll(".schedule-break[data-schedule-date]")
    .forEach((card) => {
      const status = intervalTimeStatus(
        card.dataset.slotStart,
        card.dataset.slotEnd,
        card.dataset.scheduleDate,
      );
      card.classList.toggle("status-running", status.key === "running");
      card.classList.toggle("status-ended", status.key === "ended");
      card.classList.toggle("status-upcoming", status.key === "upcoming");

      const timer = card.querySelector(".break-countdown");
      if (!timer) return;
      if (status.key === "running") {
        timer.classList.add("running");
        timer.textContent = `${formatCountdown(status.remaining)} left`;
        timer.setAttribute("aria-label", `${formatCountdown(status.remaining)} remaining`);
      } else {
        timer.classList.remove("running");
        timer.textContent = card.dataset.duration || "";
        timer.removeAttribute("aria-label");
      }
    });
}

function breakCard(start, end, kind = "break", scheduleDate = state.selectedDate) {
  const card = document.createElement("div");
  const title = kind === "edge" ? "Free period" : "Break time";
  const status = intervalTimeStatus(start, end, scheduleDate);
  const duration = formatDuration(start, end);
  card.className = `schedule-break ${kind} status-${status.key}`;
  card.dataset.slotStart = start;
  card.dataset.slotEnd = end;
  card.dataset.scheduleDate = scheduleDate;
  card.dataset.duration = duration;
  card.setAttribute(
    "aria-label",
    `${title}, ${formatTime(start)} to ${formatTime(end)}, ${duration}`,
  );
  card.innerHTML = `
    <span>${title}</span>
    <strong>${formatTime(start)} &ndash; ${formatTime(end)}</strong>
    <small class="break-countdown${status.key === "running" ? " running" : ""}">${status.key === "running" ? `${formatCountdown(status.remaining)} left` : duration}</small>
  `;
  return card;
}

function renderUnavailableStudent() {
  const section = `${semesterLabel(state.semesterId)}, Section ${sectionLabel(state.sectionId)}`;
  elements.content.innerHTML = `
    <section class="workspace-empty unavailable">
      <span aria-hidden="true">!</span>
      <div>
        <p>No published routine</p>
        <h3>${escapeHTML(section)}</h3>
        <small>The official portal currently has no routine for this semester and section combination. Choose a section marked “loaded”.</small>
      </div>
    </section>
  `;
}

function renderTeacherPrompt() {
  elements.content.innerHTML = `
    <section class="workspace-empty">
      <span aria-hidden="true">T</span>
      <div>
        <p>Teacher workspace</p>
        <h3>Search a teacher</h3>
        <small>Type any part of a name, then see every matching course, room, section and class time.</small>
      </div>
    </section>
  `;
}

function renderOffDay(kind = "student") {
  const teacherCopy =
    kind === "teacher"
      ? "No teaching class is scheduled for this teacher on the selected day."
      : "No class is scheduled for this section on the selected day.";
  const task = kind === "student" ? offDayTask() : null;
  const taskMarkup = task
    ? `
      <aside class="off-day-task" aria-label="Suggested off-day task">
        <span>Off-day task</span>
        <strong>${escapeHTML(task.title)}</strong>
        <small>${escapeHTML(task.detail)}</small>
      </aside>
    `
    : "";
  elements.content.innerHTML = `
    <section class="workspace-empty off-day">
      <span aria-hidden="true">OFF</span>
      <div class="off-day-copy">
        <p>${escapeHTML(weekdayForISO(state.selectedDate))}</p>
        <h3>${kind === "teacher" ? "No teaching class" : "Off day"}</h3>
        <small>${teacherCopy}</small>
      </div>
      ${taskMarkup}
    </section>
  `;
}

function renderNoMatch() {
  elements.content.innerHTML = `
    <section class="workspace-empty">
      <span aria-hidden="true">NO</span>
      <div>
        <p>Search filter</p>
        <h3>No matching class</h3>
        <small>Classes exist on this day, but none match "${escapeHTML(state.keyword)}". Clear Quick search to show the complete day.</small>
      </div>
    </section>
  `;
}

function renderDayClasses() {
  if (state.role === "student" && !scheduleForSelection()) {
    renderUnavailableStudent();
    return;
  }
  if (state.role === "teacher" && !state.teacher) {
    renderTeacherPrompt();
    return;
  }

  const dayName = weekdayForISO(state.selectedDate);
  const classes = contextInstances(dayName).sort((a, b) => a.slot - b.slot);
  if (!classes.length) {
    if (state.keyword && contextInstances(dayName, false).length) {
      renderNoMatch();
      return;
    }
    renderOffDay(state.role);
    return;
  }

  const list = document.createElement("div");
  list.className = "workspace-class-list";

  if (state.keyword) {
    classes.forEach((course) => list.appendChild(classCard(course)));
  } else {
    const classesBySlot = new Map();
    classes.forEach((course) => {
      const group = classesBySlot.get(course.slot) || [];
      group.push(course);
      classesBySlot.set(course.slot, group);
    });

    const occupiedSlots = [...classesBySlot.keys()].sort((a, b) => a - b);
    let cursor = routine.slots[0].start;

    occupiedSlots.forEach((slotId, index) => {
      const slot = slotById(slotId);
      if (timeToMinutes(slot.start) > timeToMinutes(cursor)) {
        list.appendChild(
          breakCard(cursor, slot.start, index === 0 ? "edge" : "break"),
        );
      }
      classesBySlot
        .get(slotId)
        .forEach((course) => list.appendChild(classCard(course)));
      cursor = slot.end;
    });

    const dayEnd = routine.slots[routine.slots.length - 1].end;
    if (timeToMinutes(dayEnd) > timeToMinutes(cursor)) {
      list.appendChild(breakCard(cursor, dayEnd, "edge"));
    }
  }

  elements.content.replaceChildren(list);
}

function roomOccupancyFor(dayName, slotId) {
  return allInstances()
    .filter(
      (course) =>
        course.day === dayName &&
        course.slot === slotId &&
        roomMatches(course),
    )
    .sort((a, b) => {
      if (a.semesterId !== b.semesterId) return a.semesterId - b.semesterId;
      return a.sectionId - b.sectionId;
    });
}

function renderRoomDay() {
  const dayName = weekdayForISO(state.selectedDate);
  const timeline = document.createElement("div");
  timeline.className = "room-timeline";

  routine.slots.forEach((slot) => {
    const occupancy = roomOccupancyFor(dayName, slot.id);
    const row = document.createElement("article");
    row.className = `room-slot ${occupancy.length ? "occupied" : "available"}`;
    row.innerHTML = `
      <div class="room-slot-time">
        <span>Slot ${slot.id}</span>
        <strong>${formatTime(slot.start)}</strong>
        <small>${formatTime(slot.end)}</small>
      </div>
      <div class="room-slot-state">
        <span>${occupancy.length ? "Occupied" : routine.meta.coverage.isComplete ? "Available" : "Available in loaded data"}</span>
        <strong>${occupancy.length ? `${occupancy.length} ${occupancy.length === 1 ? "class" : "classes"}` : "No class found"}</strong>
        ${
          !routine.meta.coverage.isComplete && !occupancy.length
            ? "<small>Full cross-semester verification needs the remaining official routines.</small>"
            : ""
        }
      </div>
    `;
    if (occupancy.length) {
      const details = document.createElement("div");
      details.className = "room-occupancy-list";
      occupancy.forEach((course) => {
        const item = document.createElement("div");
        item.innerHTML = `
          <span>${escapeHTML(course.code)}</span>
          <p><strong>${escapeHTML(course.semester)} / ${escapeHTML(course.section)}</strong>${escapeHTML(course.title)}</p>
          <small>${escapeHTML(course.teachers.join(", "))}</small>
        `;
        makeClassInteractive(item, course);
        details.appendChild(item);
      });
      row.appendChild(details);
    }
    timeline.appendChild(row);
  });

  elements.content.replaceChildren(timeline);
}

function fullGridClasses(dayName, slotId) {
  if (state.room) return roomOccupancyFor(dayName, slotId);
  return contextInstances(dayName).filter((course) => course.slot === slotId);
}

function fullCellCard(course) {
  const article = document.createElement("article");
  article.className = `grid-course ${course.type || "theory"}`;
  article.innerHTML = `
      <div><strong>${escapeHTML(course.code)}</strong><span>${escapeHTML(course.room)}</span></div>
      <p>${escapeHTML(course.title)}</p>
      <small>${escapeHTML(course.semester)} / ${escapeHTML(course.section)}</small>
      <small>${escapeHTML(course.teachers.join(", "))}</small>
      <span class="grid-detail-action" aria-hidden="true">Details</span>
  `;
  makeClassInteractive(article, course);
  return article;
}

function renderFullRoutine() {
  if (state.role === "student" && !state.room && !scheduleForSelection()) {
    renderUnavailableStudent();
    return;
  }
  if (state.role === "teacher" && !state.room && !state.teacher) {
    renderTeacherPrompt();
    return;
  }

  const grid = document.createElement("div");
  grid.className = "full-routine-scroll";
  const swipeHint = document.createElement("p");
  swipeHint.className = "mobile-scroll-hint";
  swipeHint.textContent = "Swipe left or right to see every time slot.";
  const inner = document.createElement("div");
  inner.className = "full-routine-grid";
  inner.innerHTML = '<div class="full-corner">Day / time</div>';

  routine.slots.forEach((slot) => {
    inner.insertAdjacentHTML(
      "beforeend",
      `<div class="full-slot-head"><strong>Slot ${slot.id}</strong><span>${formatTime(slot.start)} - ${formatTime(slot.end)}</span></div>`,
    );
  });

  DAY_ORDER.forEach((dayName) => {
    const dayCount = contextInstances(dayName).length;
    inner.insertAdjacentHTML(
      "beforeend",
      `<div class="full-day-head"><strong>${dayName}</strong><span>${dayCount ? `${dayCount} classes` : "Off"}</span></div>`,
    );

    if (!dayCount && !state.room) {
      inner.insertAdjacentHTML(
        "beforeend",
        '<div class="full-off-day"><strong>Off day</strong><span>No class scheduled</span></div>',
      );
      return;
    }

    routine.slots.forEach((slot) => {
      const classes = fullGridClasses(dayName, slot.id);
      const cell = document.createElement("div");
      cell.className = `full-cell${classes.length ? "" : " empty"}`;
      if (classes.length) {
        cell.replaceChildren(...classes.map(fullCellCard));
      } else if (state.room) {
        cell.innerHTML = `<span class="free-cell">${routine.meta.coverage.isComplete ? "Free" : "Free*"}</span>`;
      } else {
        const freeEnd = freeEndForSlot(slot);
        cell.innerHTML = `
          <span class="grid-break">
            <strong>Break</strong>
            <small>${formatTime(slot.start)} &ndash; ${formatTime(freeEnd)}</small>
            <i>${formatDuration(slot.start, freeEnd)}</i>
          </span>
        `;
      }
      inner.appendChild(cell);
    });
  });

  grid.appendChild(swipeHint);
  grid.appendChild(inner);
  if (state.room && !routine.meta.coverage.isComplete) {
    const note = document.createElement("p");
    note.className = "room-grid-note";
    note.textContent =
      "* Free means no booking was found in the currently loaded official routines. Complete verification requires every semester and section.";
    grid.appendChild(note);
  }
  elements.content.replaceChildren(grid);
}

function renderDepartmentPending() {
  const config = departmentConfig();
  elements.content.innerHTML = `
    <section class="workspace-empty unavailable">
      <span aria-hidden="true">${escapeHTML(config.short)}</span>
      <div>
        <p>Official data is not loaded yet</p>
        <h3>${escapeHTML(config.short)} routine sync pending</h3>
        <small>Run <strong>Sync official routine</strong> once from GitHub Actions. This department will then update automatically every six hours.</small>
      </div>
    </section>
  `;
}

function renderContent() {
  if (!routine.schedules.length) {
    renderDepartmentPending();
  } else if (state.view === "full") {
    renderFullRoutine();
  } else if (state.room) {
    renderRoomDay();
  } else {
    renderDayClasses();
  }
}

function renderWorkspace() {
  renderDepartment();
  renderRole();
  renderView();
  renderDateNavigation();
  renderWeekStrip();
  renderResultSummary();
  renderContent();
}

function setDepartment(department) {
  if (!Object.hasOwn(DEPARTMENTS, department) || department === state.department) {
    return;
  }
  closeAllComboboxes();
  closeClassDetails();
  state.department = department;
  state.teacher = "";
  state.room = "";
  state.keyword = "";
  activateDepartmentData();
  elements.keyword.value = "";
  populateControls();
  renderCoverage();
  renderWorkspace();
  showToast(`${departmentConfig().short} department selected.`);
}

function setRole(role) {
  closeAllComboboxes();
  state.role = role;
  state.room = "";
  elements.room.value = "";
  renderWorkspace();
}

function setView(view) {
  state.view = view;
  renderWorkspace();
}

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  elements.theme.textContent = dark ? "Light" : "Dark";
  elements.theme.setAttribute(
    "aria-label",
    dark ? "Use light theme" : "Use dark theme",
  );
  localStorage.setItem("routine-theme", dark ? "dark" : "light");
}

function bindEvents() {
  elements.departmentSelect.addEventListener("change", (event) => {
    setDepartment(event.target.value);
  });
  elements.studentRole.addEventListener("click", () => setRole("student"));
  elements.teacherRole.addEventListener("click", () => setRole("teacher"));

  elements.semester.addEventListener("change", (event) => {
    state.semesterId = Number(event.target.value);
    renderSectionOptions();
    state.sectionId = Number(elements.section.value);
    renderWorkspace();
  });
  elements.section.addEventListener("change", (event) => {
    state.sectionId = Number(event.target.value);
    renderWorkspace();
  });
  elements.teacher.addEventListener("input", (event) => {
    state.teacher = event.target.value.trim();
    renderWorkspace();
  });
  elements.room.addEventListener("input", (event) => {
    state.room = event.target.value.trim();
    renderWorkspace();
  });
  elements.keyword.addEventListener("input", (event) => {
    state.keyword = event.target.value.trim();
    renderWorkspace();
  });

  elements.dayView.addEventListener("click", () => setView("day"));
  elements.fullView.addEventListener("click", () => setView("full"));
  elements.saveDefault.addEventListener("click", saveAsDefault);
  elements.print.addEventListener("click", () => window.print());

  elements.previousDay.addEventListener("click", () => {
    const today = getDhakaParts().iso;
    const previous = addDays(state.selectedDate, -1);
    state.selectedDate = previous < today ? today : previous;
    renderWorkspace();
  });
  elements.nextDay.addEventListener("click", () => {
    state.selectedDate = addDays(state.selectedDate, 1);
    renderWorkspace();
  });
  elements.goToday.addEventListener("click", () => {
    state.selectedDate = getDhakaParts().iso;
    renderWorkspace();
  });
  elements.datePicker.addEventListener("change", (event) => {
    if (!event.target.value) return;
    const today = getDhakaParts().iso;
    state.selectedDate =
      event.target.value < today ? today : event.target.value;
    renderWorkspace();
  });

  elements.theme.addEventListener("click", () =>
    setTheme(!document.body.classList.contains("dark")),
  );

  elements.classDialogClose?.addEventListener("click", closeClassDetails);
  elements.classDialog?.addEventListener("click", (event) => {
    if (event.target === elements.classDialog) closeClassDetails();
  });
  elements.classDialog?.addEventListener("close", () => {
    lastClassTrigger?.focus();
    lastClassTrigger = null;
  });
  document.addEventListener("click", handleCopyDetailClick);

  bindCombobox("teacher");
  bindCombobox("room");
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-combobox")) {
      closeAllComboboxes();
    }
  });
}

async function init() {
  try {
    const [cseRoutine, nfeRoutine, cseSupplied, cseOfficial, nfeOfficial] =
      await Promise.all([
        loadJSON(DEPARTMENTS.cse.routineUrl, true),
        loadJSON(DEPARTMENTS.nfe.routineUrl),
        loadFaculty(DEPARTMENTS.cse.suppliedFacultyUrl),
        loadFaculty(DEPARTMENTS.cse.officialFacultyUrl),
        loadFaculty(DEPARTMENTS.nfe.officialFacultyUrl),
      ]);

    routines.cse = cseRoutine;
    routines.nfe = nfeRoutine || unavailableRoutine("nfe");
    teacherDirectories.cse = mergeTeacherDirectories(cseSupplied, cseOfficial);
    teacherDirectories.nfe = mergeTeacherDirectories([], nfeOfficial);

    loadPreferences();
    if (!Object.hasOwn(DEPARTMENTS, state.department)) {
      state.department = "cse";
    }
    activateDepartmentData();
    state.selectedDate = getDhakaParts().iso;
    populateControls();
    bindEvents();
    setTheme(localStorage.getItem("routine-theme") === "dark");
    renderCoverage();
    renderWorkspace();
    updateLiveClock();
    window.setInterval(updateLiveClock, 1_000);
  } catch (error) {
    console.error(error);
    elements.content.innerHTML = `
      <section class="workspace-empty unavailable">
        <span aria-hidden="true">!</span>
        <div>
          <p>Routine could not be loaded</p>
          <h3>Start the local website</h3>
          <small>Run <code>python app.py</code> from the project folder and try again.</small>
        </div>
      </section>
    `;
  }
}
init();
