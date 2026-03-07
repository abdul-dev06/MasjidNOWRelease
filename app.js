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
// LOCATION: try browser GPS first, fall back to IP lookup
let cachedLocation = null;      // { lat, lon }
let locationInFlight = null;    // Promise

function getBrowserLocation(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude);
        const lon = Number(pos?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return reject(new Error('Invalid GPS lat/lon'));
        resolve({ lat, lon });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 6 * 60 * 60 * 1000 }
    );
  });
}

async function getIpLocation() {
  if (cachedLocation) return cachedLocation;
  if (locationInFlight) return locationInFlight;

  locationInFlight = (async () => {
    // 1) Try browser location (best)
    try {
      const gps = await getBrowserLocation();
      cachedLocation = gps;
      return cachedLocation;
    } catch (_) {
      // ignore and fall back
    }

    // 2) Fall back to IP location (ipapi)
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
      if (weatherEl) weatherEl.textContent = `${temp}°C`;
    } catch (error) {
      console.error("Weather fetch error:", error);
      const weatherEl = document.getElementById('currentWeather');
      if (weatherEl) weatherEl.textContent = "⚠️";
      throw error;
    }
  }

  // -------------------------------------------
  // Wi-Fi Status
  function updateWifiStatus() {
    const wifiStatusLabel = document.getElementById('wifiStatus');
    if (!wifiStatusLabel) return;

    wifiStatusLabel.innerHTML = navigator.onLine ? 'Online' : 'Offline';
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
  // Sun Times (Sunrise + Sunset) + Maghrib derived from Sunset (+/- offset from CSV)
  let maghribOffsetMinutes = 5; // default if CSV not loaded / invalid
  let lastSunsetNorm = null;    // cached "h:mm am/pm" used to re-apply maghrib quickly

  function applyMaghribFromSunset() {
    if (!lastSunsetNorm) return;

    const maghribTime = adjustMinutesTo12HourTime(lastSunsetNorm, maghribOffsetMinutes);
    const maghribEl = document.getElementById('maghrib-iqamah');
    if (maghribEl) maghribEl.textContent = maghribTime;
  }

  // Uses ONE Open-Meteo call in local timezone (timezone=auto)
  // Picks the NEXT sunrise/sunset if today's already passed.
  async function updateSunTimesAndMaghrib() {
    try {
      const { lat, lon } = await getIpLocation();

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`Sun Times (Open-Meteo) HTTP ${res.status}`);

      const data = await res.json();
      const sunriseArr = data?.daily?.sunrise || [];
      const sunsetArr = data?.daily?.sunset || [];

      const now = new Date();

      const pickNextIso = (arr) => {
        for (const iso of arr) {
          const d = new Date(iso);
          if (Number.isFinite(d.getTime()) && d > now) return iso;
        }
        return arr[0] || null;
      };

      const sunriseIso = pickNextIso(sunriseArr);
      const sunsetIso = pickNextIso(sunsetArr);

      const sunriseEl = document.getElementById('sunriseTime');
      const sunsetEl = document.getElementById('sunsetTime');

      // Sunrise UI
      if (sunriseIso) {
        const sunriseLocal = new Date(sunriseIso).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        if (sunriseEl) sunriseEl.innerHTML = `Sunrise:<br>${sunriseLocal}`;
      } else {
        if (sunriseEl) sunriseEl.textContent = 'Sunrise: N/A';
      }

      // Sunset UI + cache + Maghrib apply
      if (sunsetIso) {
        const sunsetLocal = new Date(sunsetIso).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        if (sunsetEl) sunsetEl.innerHTML = `Sunset:<br>${sunsetLocal}`;

        lastSunsetNorm = normalize12HourTime(sunsetLocal);
        applyMaghribFromSunset();
      } else {
        if (sunsetEl) sunsetEl.textContent = 'Sunset: N/A';
        lastSunsetNorm = null;
        // If sunset missing, do NOT overwrite maghrib
      }
    } catch (error) {
      console.error('Error fetching sun times:', error);

      const sunriseEl = document.getElementById('sunriseTime');
      const sunsetEl = document.getElementById('sunsetTime');
      if (sunriseEl) sunriseEl.textContent = 'Sunrise: N/A';
      if (sunsetEl) sunsetEl.textContent = 'Sunset: N/A';

      lastSunsetNorm = null;

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
  // MEDIA PANEL: Remote playlist (Google Sheet CSV) + ImgBB HTML support + robust fallbacks
  // Sheet format (Row 1 headers ignored):
  //   A: ENABLED   B: IMAGE (direct URL/path OR ImgBB HTML snippet OR FALSE)
  //   C: TITLE     D: DURATION (seconds)
  // Row 2+ = slides
  //
  // Behavior:
  // - If IMAGE is FALSE/blank/invalid OR fails to load -> use DefaultEventImage for THAT slide
  // - If DefaultEventImage is missing too -> fall back to DEFAULT_MEDIA.imageUrl
  // - Parsing errors never freeze the app; they degrade gracefully

  const eventImg = document.getElementById('eventImage');
  const eventTitleLabel = document.getElementById('eventTitle');

  const MEDIA_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSy-pTImM9EJHVba6ZVBhGTr5AV988I6qW8ES_zAO3h3iXa5xTaxo8qWVJSecy9Z091pvS1y9Td9rjW/pub?gid=0&single=true&output=csv';

  const DEFAULT_MEDIA = {
    imageUrl: 'assets/DefaultEventImage.webp',
    title: 'Welcome to the Masjid',
    durationMs: 10000
  };

  // Used when a particular slide has FALSE/bad image
  const DefaultEventImage = 'assets/DefaultEventImage.webp';

  let mediaSlides = []; // [{ imageUrl, title, durationMs }]
  let mediaIndex = 0;
  let mediaRotationStarted = false;

  function showMediaPanel() {
    if (eventImg) eventImg.style.display = '';
    if (eventTitleLabel) eventTitleLabel.style.display = '';
  }

  // Accepts either:
  // - direct image URL (https://...jpg or assets/foo.webp)
  // - ImgBB HTML snippet: <a ...><img src="..."></a>
  // Returns a clean URL/path string or empty.
  function extractImageUrl(input) {
    const s = String(input ?? '').trim();
    if (!s) return '';

    // extract <img src="...">
    const m = s.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1]) return m[1].trim();

    return s;
  }

  function isMissingLike(val) {
    const s = String(val ?? '').trim().toLowerCase();
    return !s || s === 'false' || s === 'null' || s === 'undefined' || s === 'na' || s === 'n/a';
  }

  function parseEnabled(val) {
    const s = String(val ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'enabled' || s === 'on';
  }

  function parseDurationMs(val) {
    const n = Number(String(val ?? '').trim());
    const seconds = Number.isFinite(n) ? n : 10;
    const clamped = Math.min(Math.max(seconds, 3), 120);
    return Math.round(clamped * 1000);
  }

  // CSV parser that supports quoted fields (important for HTML that contains commas)
  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  // Preload image before swapping so you don't get broken icons mid-rotation
  function preloadImage(url) {
    return new Promise((resolve) => {
      const u = String(url ?? '').trim();
      if (!u) return resolve(false);

      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = u;
    });
  }

  // Resolve a slide's image with per-slide fallback logic
  async function resolveSlideImage(rawImageValue) {
    const extracted = extractImageUrl(rawImageValue);

    // If the sheet says FALSE/blank/etc -> default event image
    if (isMissingLike(extracted)) {
      const okDefaultEvent = await preloadImage(DefaultEventImage);
      if (okDefaultEvent) return DefaultEventImage;

      const okGlobalDefault = await preloadImage(DEFAULT_MEDIA.imageUrl);
      return okGlobalDefault ? DEFAULT_MEDIA.imageUrl : '';
    }

    // Otherwise try to load the provided URL/path
    const candidate = encodeURI(extracted); // handles spaces
    const ok = await preloadImage(candidate);
    if (ok) return candidate;

    // Provided URL failed -> DefaultEventImage
    const okDefaultEvent = await preloadImage(DefaultEventImage);
    if (okDefaultEvent) return DefaultEventImage;

    // Fallback of fallback
    const okGlobalDefault = await preloadImage(DEFAULT_MEDIA.imageUrl);
    return okGlobalDefault ? DEFAULT_MEDIA.imageUrl : '';
  }

  async function setMediaSlide(slide, instant = false) {
    if (!eventImg || !eventTitleLabel) return;

    showMediaPanel();

    const title = (slide?.title && String(slide.title).trim()) ? String(slide.title).trim() : DEFAULT_MEDIA.title;
    const durationMs = Number.isFinite(slide?.durationMs) ? slide.durationMs : DEFAULT_MEDIA.durationMs;

    // set title right away
    eventTitleLabel.textContent = title;

    // transitions
    eventImg.style.transition = 'opacity 350ms ease';
    eventTitleLabel.style.transition = 'opacity 350ms ease';

    const apply = async () => {
      const resolved = await resolveSlideImage(slide?.imageUrl);
      if (resolved) eventImg.src = resolved;
      // If even that failed, keep current src (do not blank it)
    };

    if (instant) {
      await apply();
      eventImg.style.opacity = '1';
      eventTitleLabel.style.opacity = '1';
      return durationMs;
    }

    eventImg.style.opacity = '0';
    eventTitleLabel.style.opacity = '0';

    await new Promise(r => setTimeout(r, 250));
    await apply();

    requestAnimationFrame(() => {
      eventImg.style.opacity = '1';
      eventTitleLabel.style.opacity = '1';
    });

    return durationMs;
  }

  function startMediaRotationIfNeeded() {
    if (mediaRotationStarted) return;
    mediaRotationStarted = true;

    const tick = async () => {
      const slides = (Array.isArray(mediaSlides) && mediaSlides.length) ? mediaSlides : [DEFAULT_MEDIA];
      if (mediaIndex >= slides.length) mediaIndex = 0;

      const slide = slides[mediaIndex];
      const delay = await setMediaSlide(slide);

      mediaIndex = (mediaIndex + 1) % slides.length;
      setTimeout(tick, Number.isFinite(delay) ? delay : DEFAULT_MEDIA.durationMs);
    };

    // show first immediately
    const slides = (Array.isArray(mediaSlides) && mediaSlides.length) ? mediaSlides : [DEFAULT_MEDIA];
    setMediaSlide(slides[0], true).then((delay) => {
      mediaIndex = slides.length > 1 ? 1 : 0;
      setTimeout(tick, Number.isFinite(delay) ? delay : DEFAULT_MEDIA.durationMs);
    });
  }

  async function refreshMediaPlaylist() {
    // If media elements aren't present, never throw
    if (!eventImg || !eventTitleLabel) return;

    let text = '';
    try {
      const url = `${MEDIA_CSV_URL}&_=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Media CSV HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      // Don't break rotation; just keep current slides
      console.warn('Media playlist fetch failed:', err);
      startMediaRotationIfNeeded();
      return;
    }

    // If Google returns HTML instead of CSV, don't blow up the app
    if (text.trim().startsWith('<')) {
      console.warn('Media CSV returned HTML (check Publish link + permissions)');
      startMediaRotationIfNeeded();
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      console.warn('Media CSV has no data rows');
      mediaSlides = [];
      startMediaRotationIfNeeded();
      return;
    }

    const slides = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) continue;

        const enabled = parseEnabled(cols[0]);
        if (!enabled) continue;

        const rawImage = cols[1];
        const title = String(cols[2] ?? '').trim();
        const durationMs = parseDurationMs(cols[3]);

        // Keep slide even if image is missing/bad; it will fall back to DefaultEventImage
        // But skip completely empty slides (no title + missing-like image)
        const extracted = extractImageUrl(rawImage);
        if (!title && isMissingLike(extracted)) continue;

        slides.push({
          imageUrl: rawImage, // store raw; resolver handles HTML + FALSE
          title,
          durationMs
        });
      } catch (rowErr) {
        console.warn('Skipping bad media row:', lines[i], rowErr);
        continue;
      }
    }

    mediaSlides = slides;
    if (mediaIndex >= mediaSlides.length) mediaIndex = 0;

    startMediaRotationIfNeeded();
  }

  // -------------------------------------------
  // Load Iqamah Times from CSV
  async function loadIqamahTimes() {
    try {
      const csvUrl = `${baseUrl}&_=${Date.now()}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Iqamah CSV HTTP ${response.status}`);

      const text = await response.text();
      const lines = text.trim().split('\n');

      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;

        const prayerNameRaw = parts[0];
        const timeValue = parts[1];

        let idName = prayerNameRaw.toLowerCase().replace(/[\s']/g, '');

        // Maghrib is offset minutes now (e.g. "+5", "-5")
        if (idName === 'maghrib') {
          const offset = parseInt(timeValue, 10);
          if (Number.isFinite(offset)) {
            maghribOffsetMinutes = offset;
            applyMaghribFromSunset(); // updates maghrib within ~10s when CSV changes
          }
          continue; // do NOT display "+5" in the Maghrib time slot
        }

        const labelId = `${idName}-iqamah`;
        const label = document.getElementById(labelId);
        if (label) label.textContent = timeValue;
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
      showMediaPanel();

      console.log("🚀 Startup launched (resilient retries enabled)");

      // Always-updating UI
      setInterval(updateLiveTime, 1000);
      setInterval(updateCurrentDate, 60000);
      setInterval(updateWifiStatus, 1000);
      setInterval(updateHighlightAndCountdown, 1000);

      // API / fetch-driven tasks:
      // retry until success when offline/failed, then refresh normally
      startResilientPoller(updateWeather, "Weather", 1800000);            // 30 min
      startResilientPoller(fetchHijriDate, "Hijri Date", 3600000);            // 1 hour
      startResilientPoller(updateSunTimesAndMaghrib, "Sun Times + Maghrib", 3600000); // 1 hour
      startResilientPoller(loadIqamahTimes, "Iqamah Times", IQAMAH_REFRESH_MS);  // 10 sec
      startResilientPoller(refreshMediaPlaylist, "Media Playlist", 60000); // refresh every 60s

      // Local asset fetches: also retry until they load once; then they keep running internally
      startResilientPoller(loadNotifications, "Notifications", 86400000); // effectively once/day
      startResilientPoller(loadHadithsAndScroll, "Hadiths", 86400000); // effectively once/day

    } catch (err) {
      console.error("🚨 Unexpected error in main():", err);
    }
  }

  main();
});