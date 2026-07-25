"use strict";

const PREFERENCE_KEY = "vu-cse-routine-workspace-v3";
const VISITOR_MARKER_KEY = "vu-cse-routine-visit-counted-v1";
const VISITOR_COUNTER_URL =
  "https://api.counterapi.dev/v1/90xexe-class-routine/website-visits";
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

let routine = null;
let toastTimer = null;

const state = {
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
  visitorCount: document.getElementById("visitor-count"),
  toast: document.getElementById("toast"),
};

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

async function updateVisitorCount() {
  if (!elements.visitorCount) return;

  let shouldIncrement = true;
  try {
    shouldIncrement = localStorage.getItem(VISITOR_MARKER_KEY) !== "yes";
  } catch {
    // The counter still works when storage is disabled; this visit may be recounted.
  }

  const endpoint = `${VISITOR_COUNTER_URL}${shouldIncrement ? "/up" : "/"}`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Visitor counter request failed: ${response.status}`);
    }

    const data = await response.json();
    const count = Number(data.count);
    if (!Number.isFinite(count)) {
      throw new Error("Visitor counter returned an invalid count");
    }

    elements.visitorCount.textContent = new Intl.NumberFormat("en-US").format(
      count,
    );

    if (shouldIncrement) {
      try {
        localStorage.setItem(VISITOR_MARKER_KEY, "yes");
      } catch {
        // A visible count is more important than persisting the device marker.
      }
    }
  } catch (error) {
    console.warn(error);
    elements.visitorCount.textContent = "Unavailable";
    elements.visitorCount.closest(".visitor-counter")?.classList.add("is-offline");
  }
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

function dhakaMinutes(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: routine?.meta?.timezone || "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function classTimeStatus(start, end, scheduleDate = state.selectedDate) {
  const today = getDhakaParts().iso;
  if (scheduleDate < today) return { key: "ended", label: "Ended" };
  if (scheduleDate > today) return { key: "upcoming", label: "Upcoming" };

  const now = dhakaMinutes();
  if (now < timeToMinutes(start)) return { key: "upcoming", label: "Upcoming" };
  if (now >= timeToMinutes(end)) return { key: "ended", label: "Ended" };
  return { key: "running", label: "Running" };
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
    ...new Set(
      allInstances().flatMap((course) =>
        Array.isArray(course.teachers) ? course.teachers : [],
      ),
    ),
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
  showToast(`${label} saved as your default.`);
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

  elements.footerCoverage.textContent = `${loaded} published routines / ${teachers} teachers / ${rooms} rooms`;

  if (coverage.isComplete) {
    elements.coverage.className = "coverage-banner complete";
    elements.coverage.innerHTML = `
      <span aria-hidden="true">&#10003;</span>
      <p><strong>Official routines synced: ${loaded} published schedules</strong><small>All ${scanned} combinations checked; room availability is fully cross-checked. Last data update: ${escapeHTML(lastSynced)}.</small></p>
    `;
  } else {
    elements.coverage.className = "coverage-banner warning";
    elements.coverage.innerHTML = `
      <span aria-hidden="true">!</span>
      <p><strong>Partial official data: ${loaded} section loaded</strong><small>${escapeHTML(coverage.note)} Room availability is labelled carefully until the full import is complete.</small></p>
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
  const selected = isoToDate(state.selectedDate);
  const offset = Math.round(
    (selected - isoToDate(today)) / (24 * 60 * 60 * 1000),
  );
  elements.selectedDateLabel.textContent =
    offset === 0
      ? "Today"
      : offset === 1
        ? "Tomorrow"
        : offset === -1
          ? "Yesterday"
          : "Selected date";
  elements.selectedDayName.textContent = weekdayForISO(state.selectedDate);
  elements.selectedDateLong.textContent = longDate(state.selectedDate);
  elements.datePicker.value = state.selectedDate;
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

function renderResultSummary() {
  const isRoom = Boolean(state.room);
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
  `;
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
          <i aria-hidden="true"></i>${status.label}
        </span>
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML((course.teachers || []).join(", "))}</p>
    </div>
    <div class="class-room">
      <span>Room</span>
      <strong>${escapeHTML(course.room)}</strong>
    </div>
  `;
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
      if (!badge) return;
      badge.className = `class-status ${status.key}`;
      badge.setAttribute("aria-label", `Class status: ${status.label}`);
      badge.innerHTML = `<i aria-hidden="true"></i>${status.label}`;
    });
}

function breakCard(start, end, kind = "break") {
  const card = document.createElement("div");
  const title = kind === "edge" ? "Free period" : "Break time";
  card.className = `schedule-break ${kind}`;
  card.setAttribute(
    "aria-label",
    `${title}, ${formatTime(start)} to ${formatTime(end)}, ${formatDuration(start, end)}`,
  );
  card.innerHTML = `
    <span>${title}</span>
    <strong>${formatTime(start)} &ndash; ${formatTime(end)}</strong>
    <small>${formatDuration(start, end)}</small>
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
      <span aria-hidden="true">&#9906;</span>
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
  return `
    <article class="grid-course ${escapeHTML(course.type || "theory")}">
      <div><strong>${escapeHTML(course.code)}</strong><span>${escapeHTML(course.room)}</span></div>
      <p>${escapeHTML(course.title)}</p>
      <small>${escapeHTML(course.semester)} / ${escapeHTML(course.section)}</small>
      <small>${escapeHTML(course.teachers.join(", "))}</small>
    </article>
  `;
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
        cell.innerHTML = classes.map(fullCellCard).join("");
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

function renderContent() {
  if (state.view === "full") {
    renderFullRoutine();
  } else if (state.room) {
    renderRoomDay();
  } else {
    renderDayClasses();
  }
}

function renderWorkspace() {
  renderRole();
  renderView();
  renderDateNavigation();
  renderWeekStrip();
  renderResultSummary();
  renderContent();
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
  elements.theme.innerHTML = `<span aria-hidden="true">${dark ? "&#9728;" : "&#9790;"}</span>`;
  elements.theme.setAttribute(
    "aria-label",
    dark ? "Use light theme" : "Use dark theme",
  );
  localStorage.setItem("routine-theme", dark ? "dark" : "light");
}

function bindEvents() {
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
    state.selectedDate = addDays(state.selectedDate, -1);
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
    state.selectedDate = event.target.value;
    renderWorkspace();
  });

  elements.theme.addEventListener("click", () =>
    setTheme(!document.body.classList.contains("dark")),
  );

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
    const response = await fetch("./routine.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Routine request failed: ${response.status}`);
    routine = await response.json();

    state.selectedDate = getDhakaParts().iso;
    loadPreferences();
    populateControls();
    bindEvents();
    setTheme(localStorage.getItem("routine-theme") === "dark");
    renderCoverage();
    renderWorkspace();
    updateLiveClock();
    updateVisitorCount();
    window.setInterval(updateLiveClock, 30_000);
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
