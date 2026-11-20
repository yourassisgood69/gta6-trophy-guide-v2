"use strict";

const STORE_KEY = "leonida-trophy-guide-v3";
const DATA_PATH = "data/trophies.json";

const state = {
  trophies: [],
  earned: new Set(),
  view: "checklist",
  gradeFilter: "all",
  kindFilter: "all",
  search: "",
  spoiler: false,
  earnedOnly: false,
  current: null
};

const cardList = document.getElementById("cardList");
const resultCount = document.getElementById("resultCount");
const emptyNote = document.getElementById("emptyNote");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const gradeCounts = document.getElementById("gradeCounts");
const searchBox = document.getElementById("searchBox");
const spoilerToggle = document.getElementById("spoilerToggle");
const earnedOnlyToggle = document.getElementById("earnedOnlyToggle");
const roadmapPanel = document.getElementById("roadmapPanel");
const missablePanel = document.getElementById("missablePanel");
const missableCount = document.getElementById("missableCount");
const dialog = document.getElementById("detailDialog");

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.earned)) {
      state.earned = new Set(saved.earned.filter(function (id) { return typeof id === "number"; }));
    }
    if (saved && saved.spoiler === true) {
      state.spoiler = true;
      spoilerToggle.checked = true;
    }
  } catch (err) {
    state.earned = new Set();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ earned: Array.from(state.earned).sort(function (a, b) { return a - b; }), spoiler: state.spoiler }));
  } catch (err) {
    // Storage may be unavailable; the tracker still works for this visit.
  }
}

function isStory(trophy) {
  return trophy.kind.indexOf("story") !== -1;
}

function isHiddenBySpoiler(trophy) {
  return state.spoiler && isStory(trophy) && !state.earned.has(trophy.id);
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function kindLabel(kind) {
  if (kind === "story") return "Story";
  if (kind === "missable") return "Missable";
  if (kind === "collectibles") return "Collectibles";
  if (kind === "activities") return "Activities";
  return "Completion";
}

function matchesSearch(trophy) {
  if (!state.search) return true;
  const hay = (trophy.name + " " + trophy.description + " " + trophy.guide).toLowerCase();
  return hay.indexOf(state.search) !== -1;
}

function visibleTrophies() {
  // The grade filter belongs to the checklist view only. When the view is
  // roadmap or missable, any stale grade filter is ignored here as well as
  // cleared by setView, so switching views can never hide the cards. The
  // missable view is itself a kind filter, so a stale kind filter is
  // ignored there too.
  const grade = state.view === "checklist" ? state.gradeFilter : "all";
  const kind = state.view === "missable" ? "all" : state.kindFilter;
  return state.trophies.filter(function (trophy) {
    if (state.view === "missable" && !trophy.missable) return false;
    if (grade !== "all" && trophy.grade !== grade) return false;
    if (kind !== "all") {
      if (kind === "missable") {
        if (!trophy.missable) return false;
      } else if (trophy.kind.indexOf(kind) === -1) {
        return false;
      }
    }
    if (state.earnedOnly && !state.earned.has(trophy.id)) return false;
    if (!matchesSearch(trophy)) return false;
    return true;
  });
}

function makeBadge(text, extraClass) {
  const badge = document.createElement("span");
  badge.className = "badge" + (extraClass ? " " + extraClass : "");
  badge.textContent = text;
  return badge;
}

function buildCard(trophy) {
  const card = document.createElement("article");
  card.className = "card" + (state.earned.has(trophy.id) ? " earned" : "");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", trophy.name + ", " + gradeLabel(trophy.grade) + " trophy. Press Enter to open its guide.");
  const hidden = isHiddenBySpoiler(trophy);

  const top = document.createElement("div");
  top.className = "card-top";
  const num = document.createElement("span");
  num.className = "grade";
  num.textContent = "#" + trophy.id;
  const grade = document.createElement("span");
  grade.className = "grade " + trophy.grade;
  grade.textContent = gradeLabel(trophy.grade);
  top.appendChild(num);
  top.appendChild(grade);
  card.appendChild(top);

  const title = document.createElement("h3");
  title.textContent = hidden ? "Story trophy — earn it to reveal" : trophy.name;
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "desc";
  desc.textContent = hidden ? "Hidden until earned. Turn off the spoiler setting to reveal story trophies." : trophy.description;
  card.appendChild(desc);

  const badges = document.createElement("p");
  if (trophy.missable) badges.appendChild(makeBadge("Missable"));
  if (trophy.guide.indexOf("Method unconfirmed") !== -1) badges.appendChild(makeBadge("Method unconfirmed", "unconfirmed"));
  if (trophy.count) {
    const countBadge = document.createElement("span");
    countBadge.className = "badge";
    countBadge.textContent = "Count: " + trophy.count;
    badges.appendChild(countBadge);
  }
  if (badges.childNodes.length > 0) card.appendChild(badges);

  const kinds = document.createElement("p");
  kinds.textContent = trophy.kind.map(kindLabel).join(" · ");
  card.appendChild(kinds);

  const earned = document.createElement("p");
  earned.className = "earned-label";
  earned.textContent = state.earned.has(trophy.id) ? "Earned ✓" : "Not earned yet — click the card for its guide";
  card.appendChild(earned);

  function open() { openDetail(trophy); }
  card.addEventListener("click", open);
  card.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function renderRoadmap() {
  const list = document.getElementById("roadmapList");
  list.textContent = "";
  const stages = [
    { title: "Stage 1 — The story, Chapters 1 to 4", ids: [2, 3, 4, 5, 6], note: "Play the chapters in order. Chapter trophies unlock when each chapter ends and cannot be missed." },
    { title: "Stage 2 — The named missions", ids: [8, 9, 10, 11, 12, 13], note: "Complete Breakfast Run, The Cartel Heist, Child's Play, Headliners, VCIA Takedown and Operation Savage Glory. These six are flagged missable: replay a mission if its trophy does not pop." },
    { title: "Stage 3 — Side strands and strangers", ids: [22, 23, 24, 25, 26, 27], note: "Finish the final mission for Andy, Kenton, Billy, Randy and Tyrone, and complete 8 stranger strands across Leonida." },
    { title: "Stage 4 — Activities and collectibles", ids: [15, 16, 17, 18, 19, 20, 21, 28, 30, 31, 32, 35, 40, 42, 43, 46, 52, 53, 54, 55], note: "250 stunts, 42 shooting range golds, 14 drone race locations, 20 race wins, 18 meditation spots, 3 card sets, 100 WAiNK It locations, 100 vehicles, 52 areas, 5 bank vaults, 9 gangs, 8 garages and 10 Scooter Bros registrations." },
    { title: "Stage 5 — The finish line", ids: [7, 14, 1], note: "Complete the final mission, reach 100% completion, and the platinum, Vice Got a Price!, pops last." }
  ];
  stages.forEach(function (stage) {
    const item = document.createElement("li");
    const head = document.createElement("strong");
    head.textContent = stage.title;
    item.appendChild(head);
    const note = document.createElement("p");
    note.textContent = stage.note;
    item.appendChild(note);
    const names = document.createElement("p");
    names.textContent = stage.ids.map(function (id) {
      const found = state.trophies.find(function (t) { return t.id === id; });
      return found ? found.name : "";
    }).join(" · ");
    item.appendChild(names);
    list.appendChild(item);
  });
}

function render() {
  const shown = visibleTrophies();
  cardList.textContent = "";
  shown.forEach(function (trophy) {
    cardList.appendChild(buildCard(trophy));
  });
  emptyNote.hidden = shown.length !== 0;
  const earnedCount = state.earned.size;
  const total = state.trophies.length;
  progressText.textContent = earnedCount + " of " + total + " earned";
  progressBar.setAttribute("aria-valuemax", String(total));
  progressBar.setAttribute("aria-valuenow", String(earnedCount));
  progressFill.style.width = total ? Math.round((earnedCount / total) * 100) + "%" : "0%";
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  state.trophies.forEach(function (trophy) {
    totals[trophy.grade] += 1;
    if (state.earned.has(trophy.id)) counts[trophy.grade] += 1;
  });
  gradeCounts.textContent = "Platinum " + counts.platinum + " of " + totals.platinum + " · Gold " + counts.gold + " of " + totals.gold + " · Silver " + counts.silver + " of " + totals.silver + " · Bronze " + counts.bronze + " of " + totals.bronze;
  if (state.view === "missable") {
    const missableTotal = state.trophies.filter(function (t) { return t.missable; }).length;
    missableCount.textContent = shown.length + " of " + missableTotal + " missable trophies shown";
  }
  resultCount.textContent = shown.length + " of " + total + " trophies shown";
  roadmapPanel.hidden = state.view !== "roadmap";
  missablePanel.hidden = state.view !== "missable";
  if (state.view === "roadmap") renderRoadmap();
}

function setView(view) {
  state.view = view;
  // Clear the stale grade filter on every view change: a grade view that
  // matched nothing must never carry over and hide the missable cards.
  state.gradeFilter = "all";
  document.querySelectorAll("#gradeFilters .chip").forEach(function (chip) {
    chip.classList.toggle("active", chip.getAttribute("data-grade") === "all");
  });
  if (view === "missable") {
    // The missable view is itself the kind filter: clear a stale kind
    // filter too, so e.g. a collectibles filter cannot hide the cards.
    state.kindFilter = "all";
    document.querySelectorAll("#kindFilters .chip").forEach(function (chip) {
      chip.classList.toggle("active", chip.getAttribute("data-kind") === "all");
    });
  }
  document.querySelectorAll(".view-btn").forEach(function (btn) {
    const active = btn.getAttribute("data-view") === view;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  render();
}

function openDetail(trophy) {
  state.current = trophy;
  const hidden = isHiddenBySpoiler(trophy);
  document.getElementById("dialogTitle").textContent = hidden ? "Story trophy" : trophy.name;
  document.getElementById("dialogMeta").textContent = "#" + trophy.id + " · " + gradeLabel(trophy.grade) + " · " + trophy.kind.map(kindLabel).join(", ");
  const badges = document.getElementById("dialogBadges");
  badges.textContent = "";
  if (trophy.missable) badges.appendChild(makeBadge("Missable"));
  if (trophy.guide.indexOf("Method unconfirmed") !== -1) badges.appendChild(makeBadge("Method unconfirmed", "unconfirmed"));
  document.getElementById("dialogDesc").textContent = hidden ? "Hidden until earned. Turn off the spoiler setting to reveal this story trophy." : trophy.description;
  document.getElementById("dialogGuide").textContent = hidden ? "Earn this trophy to reveal its guide." : trophy.guide;
  const marker = trophy.guide.indexOf("Sources:") !== -1 ? "Sources:" : "Source:";
  const sourceText = trophy.guide.split(marker).pop();
  document.getElementById("dialogSource").textContent = hidden ? "" : "Sources: " + sourceText.trim();
  const earnedBtn = document.getElementById("dialogEarnedBtn");
  earnedBtn.textContent = state.earned.has(trophy.id) ? "Mark not earned" : "Mark earned";
  dialog.showModal();
}

function toggleEarned(id) {
  if (state.earned.has(id)) {
    state.earned.delete(id);
  } else {
    state.earned.add(id);
  }
  saveProgress();
  render();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ game: "Grand Theft Auto VI", earned: Array.from(state.earned).sort(function (a, b) { return a - b; }) }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gta6-trophy-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const parsed = JSON.parse(String(reader.result));
      const ids = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(ids)) throw new Error("bad file");
      const valid = new Set(state.trophies.map(function (t) { return t.id; }));
      state.earned = new Set(ids.filter(function (id) { return valid.has(id); }));
      saveProgress();
      render();
    } catch (err) {
      resultCount.textContent = "That file could not be imported. Export a progress file first, then import that file.";
    }
  };
  reader.readAsText(file);
}

document.querySelectorAll(".view-btn").forEach(function (btn) {
  btn.addEventListener("click", function () { setView(btn.getAttribute("data-view")); });
});
document.querySelectorAll("#gradeFilters .chip").forEach(function (chip) {
  chip.addEventListener("click", function () {
    state.gradeFilter = chip.getAttribute("data-grade");
    document.querySelectorAll("#gradeFilters .chip").forEach(function (c) { c.classList.toggle("active", c === chip); });
    render();
  });
});
document.querySelectorAll("#kindFilters .chip").forEach(function (chip) {
  chip.addEventListener("click", function () {
    state.kindFilter = chip.getAttribute("data-kind");
    document.querySelectorAll("#kindFilters .chip").forEach(function (c) { c.classList.toggle("active", c === chip); });
    render();
  });
});
searchBox.addEventListener("input", function () {
  state.search = searchBox.value.trim().toLowerCase();
  render();
});
spoilerToggle.addEventListener("change", function () {
  state.spoiler = spoilerToggle.checked;
  saveProgress();
  render();
});
earnedOnlyToggle.addEventListener("change", function () {
  state.earnedOnly = earnedOnlyToggle.checked;
  render();
});
document.getElementById("exportBtn").addEventListener("click", exportProgress);
document.getElementById("importBtn").addEventListener("click", function () {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", function (event) {
  if (event.target.files.length > 0) importProgress(event.target.files[0]);
});
document.getElementById("resetBtn").addEventListener("click", function () {
  state.earned = new Set();
  saveProgress();
  render();
});
document.getElementById("dialogEarnedBtn").addEventListener("click", function () {
  if (state.current) {
    toggleEarned(state.current.id);
    document.getElementById("dialogEarnedBtn").textContent = state.earned.has(state.current.id) ? "Mark not earned" : "Mark earned";
  }
});

loadSaved();
fetch(DATA_PATH)
  .then(function (response) { return response.json(); })
  .then(function (data) {
    state.trophies = data.trophies.slice().sort(function (a, b) { return a.id - b.id; });
    render();
  })
  .catch(function () {
    resultCount.textContent = "The trophy data could not be loaded. Serve the app folder over a local server and reload.";
  });
