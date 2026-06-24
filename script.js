const SUPABASE_URL = "https://cqjfoneyzpaggctmewyk.supabase.co";

// ВАЖЛИВО: сюди потрібно вставити anon public key із Supabase.
// Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon public.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxamZvbmV5enBhZ2djdG1ld3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTIwMzUsImV4cCI6MjA5NjY4ODAzNX0.khlC7--yIgwozuI5GeqPomJin7TRv3ZW-jRwbmWSsfo";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const today = new Date();
const todayISO = toISODate(today);
const plus14ISO = toISODate(addDays(today, 14));

function toISODate(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(dateString));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(elementId, text, type = "") {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = text;
  element.className = `message-box ${type}`.trim();
  element.classList.remove("hidden");
}

function hideMessage(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.classList.add("hidden");
}

function setupMobileMenu() {
  const menuButton = document.getElementById("menuButton");
  const navLinks = document.getElementById("navLinks");

  if (!menuButton || !navLinks) return;

  menuButton.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

function checkSupabaseKey(messageId) {
  if (SUPABASE_ANON_KEY === "PASTE_YOUR_SUPABASE_ANON_KEY_HERE" || !SUPABASE_ANON_KEY.trim()) {
    showMessage(
      messageId,
      "Потрібно вставити anon public key у файл script.js. Без ключа Supabase не дозволить завантажувати дані.",
      "error"
    );
    return false;
  }

  return true;
}

async function getActiveObjects() {
  const { data, error } = await db
    .from("object_status")
    .select(`
      id,
      start_date,
      end_date,
      objects (
        id,
        object_name,
        object_type,
        address,
        seats,
        opening_date,
        owners (
          owner_type,
          company_name,
          director_name,
          phone
        )
      )
    `)
    .lte("start_date", todayISO)
    .or(`end_date.is.null,end_date.gte.${todayISO}`)
    .order("start_date", { ascending: false });

  if (error) throw error;

  const unique = new Map();

  for (const row of data || []) {
    const object = row.objects;
    if (object && !unique.has(object.id)) {
      unique.set(object.id, object);
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    String(a.object_type).localeCompare(String(b.object_type), "uk") ||
    String(a.object_name).localeCompare(String(b.object_name), "uk")
  );
}

async function getUpcomingEvents() {
  const { data, error } = await db
    .from("events")
    .select(`
      id,
      event_name,
      event_type,
      event_date,
      objects (
        object_name,
        object_type,
        address
      )
    `)
    .gte("event_date", todayISO)
    .lte("event_date", plus14ISO)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getObjectsByType(typeValue) {
  const searchValue = typeValue.trim();

  const { data, error } = await db
    .from("object_status")
    .select(`
      id,
      start_date,
      end_date,
      objects!inner (
        id,
        object_name,
        object_type,
        address,
        seats,
        owners (
          owner_type,
          company_name,
          director_name,
          phone
        )
      )
    `)
    .lte("start_date", todayISO)
    .or(`end_date.is.null,end_date.gte.${todayISO}`)
    .ilike("objects.object_type", `%${searchValue}%`)
    .order("start_date", { ascending: false });

  if (error) throw error;

  const unique = new Map();

  for (const row of data || []) {
    const object = row.objects;
    if (object && !unique.has(object.id)) {
      unique.set(object.id, object);
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    String(a.object_name).localeCompare(String(b.object_name), "uk")
  );
}

function renderObjectRows(objects) {
  const tableBody = document.getElementById("objectsTableBody");
  const countText = document.getElementById("objectsCount");
  if (!tableBody) return;

  if (countText) {
    countText.textContent = `Знайдено діючих об'єктів: ${objects.length}`;
  }

  if (!objects.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="loading-cell">Діючих об'єктів не знайдено.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = objects
    .map((object) => {
      const owner = object.owners;
      const ownerName = owner?.company_name || owner?.director_name || "—";
      const ownerPhone = owner?.phone || "—";

      return `
        <tr>
          <td><span class="badge">${escapeHTML(object.object_type)}</span></td>
          <td>${escapeHTML(object.object_name)}</td>
          <td>${escapeHTML(object.address)}</td>
          <td>${escapeHTML(object.seats)}</td>
          <td>
            <span class="owner-line">${escapeHTML(ownerName)}</span>
            <span class="phone-line">${escapeHTML(ownerPhone)}</span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderEvents(events) {
  const eventsGrid = document.getElementById("eventsGrid");
  const countText = document.getElementById("eventsCount");
  if (!eventsGrid) return;

  if (countText) {
    countText.textContent = `Знайдено заходів на найближчі 14 днів: ${events.length}`;
  }

  if (!events.length) {
    eventsGrid.innerHTML = `
      <article class="empty-card">
        <h3>Заходів не знайдено</h3>
        <p>У базі даних немає заходів на найближчі 14 днів.</p>
      </article>
    `;
    return;
  }

  eventsGrid.innerHTML = events
    .map((event) => `
      <article class="event-card">
        <span class="event-date">${formatDate(event.event_date)}</span>
        <h3>${escapeHTML(event.event_name)}</h3>
        <p class="event-type">${escapeHTML(event.event_type)}</p>
        <div class="event-meta">
          <span><b>Об'єкт:</b> ${escapeHTML(event.objects?.object_name || "—")}</span>
          <span><b>Адреса:</b> ${escapeHTML(event.objects?.address || "—")}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderSearchResults(objects, query) {
  const results = document.getElementById("searchResults");
  const countText = document.getElementById("searchCount");
  if (!results) return;

  if (countText) {
    countText.textContent = `Пошук: "${query}". Знайдено: ${objects.length}`;
  }

  if (!objects.length) {
    results.innerHTML = `
      <article class="empty-card">
        <h3>Нічого не знайдено</h3>
        <p>Спробуйте інший тип об'єкта, наприклад: клуб, кінотеатр, спортзал.</p>
      </article>
    `;
    return;
  }

  results.innerHTML = objects
    .map((object) => {
      const owner = object.owners;
      const ownerName = owner?.company_name || owner?.director_name || "—";

      return `
        <article class="object-result-card">
          <span class="badge">${escapeHTML(object.object_type)}</span>
          <h3>${escapeHTML(object.object_name)}</h3>
          <div class="object-meta">
            <span><b>Адреса:</b> ${escapeHTML(object.address)}</span>
            <span><b>Кількість місць:</b> ${escapeHTML(object.seats)}</span>
            <span><b>Власник:</b> ${escapeHTML(ownerName)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTypeChips(objects) {
  const chipsContainer = document.getElementById("typeChips");
  const input = document.getElementById("typeInput");
  const form = document.getElementById("searchForm");
  if (!chipsContainer || !input || !form) return;

  const types = [...new Set(objects.map((object) => object.object_type).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "uk"));

  chipsContainer.innerHTML = types
    .map((type) => `<button class="type-chip" type="button" data-type="${escapeHTML(type)}">${escapeHTML(type)}</button>`)
    .join("");

  chipsContainer.querySelectorAll(".type-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.type;
      form.dispatchEvent(new Event("submit"));
    });
  });
}

async function loadHomePage() {
  if (!checkSupabaseKey("homeMessage")) return;

  try {
    const [activeObjects, upcomingEvents] = await Promise.all([
      getActiveObjects(),
      getUpcomingEvents()
    ]);

    const typesCount = new Set(activeObjects.map((item) => item.object_type)).size;
    const stats = document.getElementById("homeStats");

    stats.innerHTML = `
      <article class="stat-card">
        <span class="stat-number">${activeObjects.length}</span>
        <span class="stat-label">Діючих об'єктів</span>
      </article>
      <article class="stat-card">
        <span class="stat-number">${upcomingEvents.length}</span>
        <span class="stat-label">Заходів на 14 днів</span>
      </article>
      <article class="stat-card">
        <span class="stat-number">${typesCount}</span>
        <span class="stat-label">Типів об'єктів</span>
      </article>
    `;

    hideMessage("homeMessage");
  } catch (error) {
    showMessage("homeMessage", `Помилка завантаження даних: ${error.message}`, "error");
  }
}

async function loadObjectsPage() {
  if (!checkSupabaseKey("objectsMessage")) return;

  const tableBody = document.getElementById("objectsTableBody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="5" class="loading-cell">Завантаження...</td></tr>`;
  }

  try {
    const objects = await getActiveObjects();
    renderObjectRows(objects);
    hideMessage("objectsMessage");
  } catch (error) {
    showMessage("objectsMessage", `Помилка завантаження об'єктів: ${error.message}`, "error");
  }
}

async function loadEventsPage() {
  if (!checkSupabaseKey("eventsMessage")) return;

  const eventsGrid = document.getElementById("eventsGrid");
  if (eventsGrid) {
    eventsGrid.innerHTML = `<article class="event-card loading-card"><p>Завантаження заходів...</p></article>`;
  }

  try {
    const events = await getUpcomingEvents();
    renderEvents(events);
    hideMessage("eventsMessage");
  } catch (error) {
    showMessage("eventsMessage", `Помилка завантаження заходів: ${error.message}`, "error");
  }
}

async function setupSearchPage() {
  if (!checkSupabaseKey("searchMessage")) return;

  const form = document.getElementById("searchForm");
  const input = document.getElementById("typeInput");

  try {
    const activeObjects = await getActiveObjects();
    renderTypeChips(activeObjects);
  } catch (error) {
    showMessage("searchMessage", `Помилка завантаження типів: ${error.message}`, "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage("searchMessage");

    const typeValue = input.value.trim();

    if (!typeValue) {
      showMessage("searchMessage", "Введіть тип об'єкта для пошуку.", "error");
      return;
    }

    const results = document.getElementById("searchResults");
    if (results) {
      results.innerHTML = `<article class="event-card loading-card"><p>Пошук...</p></article>`;
    }

    try {
      const objects = await getObjectsByType(typeValue);
      renderSearchResults(objects, typeValue);
    } catch (error) {
      showMessage("searchMessage", `Помилка пошуку: ${error.message}`, "error");
    }
  });
}

function setupRefreshButtons() {
  const refreshObjects = document.getElementById("refreshObjects");
  const refreshEvents = document.getElementById("refreshEvents");

  if (refreshObjects) {
    refreshObjects.addEventListener("click", loadObjectsPage);
  }

  if (refreshEvents) {
    refreshEvents.addEventListener("click", loadEventsPage);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  setupRefreshButtons();

  const page = document.body.dataset.page;

  if (page === "home") loadHomePage();
  if (page === "objects") loadObjectsPage();
  if (page === "events") loadEventsPage();
  if (page === "search") setupSearchPage();
});
