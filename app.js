// app.js
document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------
  // CONFIG
  const IQAMAH_REFRESH_MS = 10000; // keep your existing interval
  const RETRY_MS = 5000;           // retry until success (offline/errors)

  // Uses your existing published CSV (same as your current code)
  const baseUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU7_LYYKYZHhM3QxN_DOXXhBk39ygSNDSnQO90nuQdRVmPOssCl6b0blmQD99wmG_MoZe6qsxDebbS/pub?gid=0&single=true&output=csv';

  // -------------------------------------------
  // ONE IP LOOKUP (shared for all location-based tasks)
  // Uses ipapi.co once, then caches lat/lon for the session.
  let cachedLocation = null;      // { lat, lon }
  let locationInFlight = null;    // Promise

  async function getIpLocation() {
    if (cachedLocation) return cachedLocation;
    if (locationInFlight) return locationInFlight;

    locationInFlight = (async () => {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      if (!res.ok) throw new Error(`IP lookup failed: HTTP ${res.status}`);

      const data = await res.json();
      const lat = Number(data?.latitude);
      const lon = Number(data?.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('IP lookup returned invalid lat/lon');
      }

      cachedLocation = { lat, lon };
      return cachedLocation;
    })();

    try {
      return await locationInFlight;
    } finally {
      locationInFlight = null;
    }
  }

  // -------------------------------------------
  // Mosque Name
  function setMosqueName() {
    const mosqueNameLabel = document.getElementById('mosqueName');
    if (mosqueNameLabel) mosqueNameLabel.innerHTML = "LMA";
  }

  // -------------------------------------------
  // Live Time
  function updateLiveTime() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;

    const el = document.getElementById('currentTime');
    if (!el) return;

    el.textContent = `${hh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  // -------------------------------------------
  // Gregorian Date
  function updateCurrentDate() {
    const now = new Date();
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const day = now.toLocaleDateString(undefined, { day: 'numeric' });
    const year = now.toLocaleDateString(undefined, { year: 'numeric' });

    const dateLabel = document.getElementById('currentDate');
    if (dateLabel) dateLabel.innerHTML = `${month} ${day}<br>${year}`;
  }

  // -------------------------------------------
  // Weather (uses ONE shared IP lookup)
  async function updateWeather() {
    try {
      const { lat, lon } = await getIpLocation();

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`,
        { cache: 'no-store' }
      );
      if (!weatherRes.ok) throw new Error(`Weather HTTP ${weatherRes.status}`);

      const weatherData = await weatherRes.json();
      const temp = Math.round(weatherData.current_weather.temperature);

      const weatherEl = document.getElementById('currentWeather');
      if (weatherEl) weatherEl.innerHTML = `🌡<br>${temp}°C`;
    } catch (error) {
      console.error("Weather fetch error:", error);
      const weatherEl = document.getElementById('currentWeather');
      if (weatherEl) weatherEl.textContent = "⚠️";
      throw error; // IMPORTANT: let retry logic handle it
    }
  }

  // -------------------------------------------
  // Wi-Fi Status
  function updateWifiStatus() {
    const wifiStatusLabel = document.getElementById('wifiStatus');
    if (!wifiStatusLabel) return;

    wifiStatusLabel.innerHTML = navigator.onLine ? '🛜<br>Online' : '❌<br>Offline';
  }

  // -------------------------------------------
  // Hijri Date (AlAdhan: Gregorian -> Hijri)
  async function fetchHijriDate() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    const apiUrl = `https://api.aladhan.com/v1/gToH?date=${day}-${month}-${year}`;

    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Hijri HTTP ${res.status}`);

      const json = await res.json();

      const hijriLabel = document.getElementById('hijriDate');
      if (!hijriLabel) return;

      const hijri = json?.data?.hijri;

      if (hijri && hijri.day && hijri.year && hijri.month?.en) {
        hijriLabel.innerHTML = `${hijri.month.en} ${hijri.day}<br>${hijri.year}`;
      } else {
        hijriLabel.innerHTML = `📅<br>Hijri date unavailable`;
      }
    } catch (err) {
      console.error("Hijri fetch error:", err);
      const hijriLabel = document.getElementById('hijriDate');
      if (hijriLabel) hijriLabel.innerHTML = `<br>Error fetching date`;
      throw err; // IMPORTANT: let retry logic handle it
    }
  }

  // -------------------------------------------
// Sunrise Time (ONLY) — FIXED: use Open-Meteo sunrise in local timezone
async function updateSunriseTime() {
  try {
    const { lat, lon } = await getIpLocation();

    // Open-Meteo sunrise (timezone=auto gives local time for the lat/lon)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise&timezone=auto`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`Sunrise (Open-Meteo) HTTP ${res.status}`);

    const data = await res.json();
    const sunriseIso = data?.daily?.sunrise?.[0]; // e.g. "2026-01-29T08:12"
    const sunriseEl = document.getElementById('sunriseTime');

    if (!sunriseIso) {
      if (sunriseEl) sunriseEl.textContent = 'Sunrise: N/A';
      return;
    }

    const d = new Date(sunriseIso);
    const sunriseLocal = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (sunriseEl) sunriseEl.innerHTML = `Sunrise:<br>${sunriseLocal}`;
  } catch (error) {
    console.error('Error fetching sunrise time:', error);
    const sunriseEl = document.getElementById('sunriseTime');
    if (sunriseEl) sunriseEl.textContent = 'Sunrise: N/A';
    throw error; // keep your retry-until-success behavior
  }
}


  // -------------------------------------------
  // Helper: Normalize times like "6:00PM" or "6:00 PM" -> "6:00 pm"
  function normalize12HourTime(timeStr) {
    if (!timeStr) return "";
    const s = timeStr.trim().toLowerCase().replace(/\s+/g, "");
    const m = s.match(/^(\d{1,2}:\d{2})(am|pm)$/);
    if (m) return `${m[1]} ${m[2]}`;
    return timeStr.trim().toLowerCase();
  }

  // -------------------------------------------
  // Time adjust: "6:00 pm" +/- minutes => "5:55 pm"
  function adjustMinutesTo12HourTime(timeStr, minutesToAdd) {
    if (!timeStr) return "";
    const parts = timeStr.toLowerCase().split(" ");
    if (parts.length !== 2) return timeStr;

    const [time, modifier] = parts;
    const [hoursStr, minutesStr] = time.split(":");
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeStr;

    if (modifier === "pm" && hours !== 12) hours += 12;
    if (modifier === "am" && hours === 12) hours = 0;

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes + minutesToAdd);

    let hh = date.getHours();
    const mm = date.getMinutes().toString().padStart(2, "0");
    const ampm = hh >= 12 ? "pm" : "am";
    hh = hh % 12 || 12;

    return `${hh}:${mm} ${ampm}`;
  }

  // -------------------------------------------
  // MEDIA PANEL: QR ONLY (YouTube removed)
  const qrImg = document.getElementById('qr-code');
  const donationLabel = document.getElementById('donation-prompt');

  function showQR() {
    if (qrImg) qrImg.style.display = '';
    if (donationLabel) donationLabel.style.display = '';
  }

  // -------------------------------------------
  // Load Iqamah Times from CSV
  // 2-column format:
  //   PrayerName, TimeValue
  async function loadIqamahTimes() {
    try {
      const csvUrl = `${baseUrl}&_=${Date.now()}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Iqamah CSV HTTP ${response.status}`);

      const text = await response.text();
      const lines = text.trim().split('\n');

      let maghribTimeFromCsv = null;

      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;

        const prayerNameRaw = parts[0];
        const timeValue = parts[1];

        let idName = prayerNameRaw.toLowerCase().replace(/[\s']/g, '');
        const labelId = `${idName}-iqamah`;

        const label = document.getElementById(labelId);
        if (label) label.textContent = timeValue;

        if (idName === 'maghrib') {
          maghribTimeFromCsv = timeValue;
        }
      }

      // Sunset = Maghrib - 5 minutes
      if (maghribTimeFromCsv) {
        const sunsetEl = document.getElementById('sunsetTime');
        const normalized = normalize12HourTime(maghribTimeFromCsv);
        const sunsetTime = adjustMinutesTo12HourTime(normalized, -5);
        if (sunsetEl) sunsetEl.innerHTML = `Sunset:<br>${sunsetTime}`;
      }
    } catch (error) {
      console.error('Error fetching Iqamah times:', error);
      throw error; // IMPORTANT: let retry logic handle it
    }
  }

  // -------------------------------------------
  // Rotate Announcements (unchanged)
  let announcements = [];
  let currentAnnouncementIndex = 0;
  let notificationsStarted = false;

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function rotateAnnouncement() {
    const textElement = document.getElementById('notificationText');
    if (!textElement) return;

    textElement.style.opacity = '0';
    setTimeout(() => {
      if (announcements.length > 0) {
        textElement.textContent = announcements[currentAnnouncementIndex];
        currentAnnouncementIndex = (currentAnnouncementIndex + 1) % announcements.length;
      }
      textElement.style.opacity = '1';
    }, 500);
  }

  async function loadNotifications() {
    if (notificationsStarted) return;

    const response = await fetch('assets/notifications.txt', { cache: 'no-store' });
    const data = await response.text();
    announcements = data.split('\n').map(a => a.trim()).filter(a => a !== '');

    shuffle(announcements);
    rotateAnnouncement();
    setInterval(rotateAnnouncement, 8000);

    notificationsStarted = true;
  }

  // -------------------------------------------
  // Highlight Upcoming Prayer + Countdown (unchanged)
  const prayerIds = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumua1', 'jumua2'];
  const iqamahElements = {};
  prayerIds.forEach(id => {
    iqamahElements[id] = document.getElementById(id + '-iqamah');
  });

  const prayerRows = {};
  const prayerNameElements = {};

  prayerIds.forEach(id => {
    prayerRows[id] = document.getElementById(id + 'row');
    prayerNameElements[id] = document.getElementById(id + '-name');
  });

  const upcomingNameElem = document.getElementById('upcoming-prayer-name');
  const upcomingTimeElem = document.getElementById('upcoming-prayer-time');

  function parse12HourTimeToDate(timeStr) {
    if (!timeStr) return null;
    const now = new Date();

    const s = normalize12HourTime(timeStr);
    const [time, modifier] = s.split(' ');
    if (!time || !modifier) return null;

    const [hourStr, minuteStr] = time.split(':');
    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    if (modifier === 'pm' && hours !== 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;

    let result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (result < now) result.setDate(result.getDate() + 1);

    return result;
  }

  function findNextPrayer() {
    const now = new Date();
    const isFriday = now.getDay() === 5;

    let nextPrayerId = null;
    let nextIqamahDate = null;

    for (const id of prayerIds) {
      if (!isFriday && (id === 'jumua1' || id === 'jumua2')) continue;
      if (isFriday && id === 'dhuhr') continue;

      const timeStr = iqamahElements[id]?.textContent?.trim();
      const dateObj = parse12HourTimeToDate(timeStr);

      if (!dateObj) continue;

      if (dateObj >= now && (!nextIqamahDate || dateObj < nextIqamahDate)) {
        nextPrayerId = id;
        nextIqamahDate = dateObj;
      }
    }

    return { nextPrayerId, nextIqamahDate };
  }

  function updateHighlightAndCountdown() {
    const now = new Date();

    prayerIds.forEach(id => {
      prayerRows[id]?.classList.remove('highlight');
    });

    const { nextPrayerId, nextIqamahDate } = findNextPrayer();

    if (nextPrayerId && nextIqamahDate && upcomingNameElem && upcomingTimeElem) {
      prayerRows[nextPrayerId]?.classList.add('highlight');

      const displayName = prayerNameElements[nextPrayerId]?.textContent || nextPrayerId;
      upcomingNameElem.textContent = displayName;

      let totalSeconds = Math.floor((nextIqamahDate - now) / 1000);
      if (totalSeconds < 0) totalSeconds = 0;

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      upcomingTimeElem.textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      if (upcomingNameElem) upcomingNameElem.textContent = 'No upcoming prayer';
      if (upcomingTimeElem) upcomingTimeElem.textContent = '--:--:--';
    }
  }

  // -------------------------------------------
  // Hadith Scrolling (unchanged)
  let hadithStarted = false;

  async function loadHadithsAndScroll() {
    if (hadithStarted) return;

    const scrollContainer = document.getElementById('scrolling-bar');
    const scrollTextLabel = document.getElementById('scrolling-text');
    if (!scrollContainer || !scrollTextLabel) return;

    const response = await fetch('assets/hadith.txt', { cache: 'no-store' });
    const text = await response.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) return;

    let lastLine = '';

    function getRandomLine() {
      let newLine;
      do {
        newLine = lines[Math.floor(Math.random() * lines.length)];
      } while (lines.length > 1 && newLine === lastLine);
      lastLine = newLine;
      return newLine;
    }

    function scrollLine() {
      const line = getRandomLine();
      scrollTextLabel.textContent = line;

      scrollTextLabel.style.whiteSpace = 'nowrap';
      scrollTextLabel.style.position = 'absolute';
      scrollTextLabel.style.left = `${scrollContainer.offsetWidth}px`;

      requestAnimationFrame(() => {
        const containerWidth = scrollContainer.offsetWidth;
        const textWidth = scrollTextLabel.offsetWidth;
        let leftPos = containerWidth;

        const speed = 1.2;

        function step() {
          leftPos -= speed;
          scrollTextLabel.style.left = `${leftPos}px`;

          if (leftPos + textWidth > 0) {
            requestAnimationFrame(step);
          } else {
            setTimeout(scrollLine, 500);
          }
        }

        requestAnimationFrame(step);
      });
    }

    scrollLine();
    hadithStarted = true;
  }

  // -------------------------------------------
  // Resilient poller:
  // If offline or fn throws -> retry until success (every retryMs)
  // Once success -> refresh regularly (every intervalMs)
  function startResilientPoller(fn, label, intervalMs, retryMs = RETRY_MS) {
    let stopped = false;
    let running = false;

    const run = async () => {
      if (stopped || running) return;
      running = true;

      // If offline, wait until online then retry immediately
      if (!navigator.onLine) {
        console.warn(`📡 Offline: "${label}" waiting for connection...`);
        await new Promise(resolve => window.addEventListener('online', resolve, { once: true }));
        console.log(`🌐 Back online: retrying "${label}"...`);
        if (stopped) { running = false; return; }
      }

      try {
        await fn();
        console.log(`✅ ${label} success`);
        running = false;
        if (!stopped) setTimeout(run, intervalMs);
      } catch (err) {
        console.warn(`🔁 ${label} failed, retrying in ${retryMs / 1000}s...`, err);
        running = false;
        if (!stopped) setTimeout(run, retryMs);
      }
    };

    run();

    return {
      stop() { stopped = true; }
    };
  }

  // -------------------------------------------
  // MAIN FUNCTION
  async function main() {
    try {
      // Sync setup
      setMosqueName();
      updateLiveTime();
      updateCurrentDate();
      updateWifiStatus();
      updateHighlightAndCountdown();

      // Media panel: always QR
      showQR();

      console.log("🚀 Startup launched (resilient retries enabled)");

      // Always-updating UI
      setInterval(updateLiveTime, 1000);
      setInterval(updateCurrentDate, 60000);
      setInterval(updateWifiStatus, 1000);
      setInterval(updateHighlightAndCountdown, 1000);

      // API / fetch-driven tasks:
      // retry until success when offline/failed, then refresh normally
      startResilientPoller(updateWeather,     "Weather",      1800000);            // 30 min
      startResilientPoller(fetchHijriDate,    "Hijri Date",   3600000);            // 1 hour
      startResilientPoller(updateSunriseTime, "Sunrise Time", 3600000);            // 1 hour
      startResilientPoller(loadIqamahTimes,   "Iqamah Times", IQAMAH_REFRESH_MS);  // 10 sec

      // Local asset fetches: also retry until they load once; then they keep running internally
      startResilientPoller(loadNotifications,     "Notifications", 86400000); // effectively once/day
      startResilientPoller(loadHadithsAndScroll,  "Hadiths",        86400000); // effectively once/day

    } catch (err) {
      console.error("🚨 Unexpected error in main():", err);
    }
  }

  main();
});