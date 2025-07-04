// Wait until all elements finished loading
document.addEventListener('DOMContentLoaded', () => {

  // Mosque Name
  function setMosqueName() {
    const mosqueNameLabel = document.getElementById('mosqueName');
    if (mosqueNameLabel) mosqueNameLabel.innerHTML = "LMA";
  }

  //-------------------------------------------
  // Live Time
  function updateLiveTime() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    document.getElementById('currentTime').textContent =
      `${hh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  //-------------------------------------------
  // Gregorian Date
  function updateCurrentDate() {
    const now = new Date();
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const day = now.toLocaleDateString(undefined, { day: 'numeric' });
    const year = now.toLocaleDateString(undefined, { year: 'numeric' });

    const dateLabel = document.getElementById('currentDate');
    if (dateLabel) {
      dateLabel.innerHTML = `${month} ${day}<br>${year}`;
    }
  }

  //-------------------------------------------
  // Weather
  async function updateWeather() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();

    const lat = data.latitude;
    const lon = data.longitude;

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    const weatherData = await weatherRes.json();

    const temp = Math.round(weatherData.current_weather.temperature);
    document.getElementById('currentWeather').innerHTML = `🌡<br>${temp}°C`;
  } catch (error) {
    console.error("Weather fetch error:", error);
    document.getElementById('currentWeather').textContent = "⚠️";
  }
}

  //-------------------------------------------
  // Wi-Fi Status
  function updateWifiStatus() {
    const wifiStatusLabel = document.getElementById('wifiStatus');
    if (navigator.onLine) {
      wifiStatusLabel.innerHTML = '🛜<br>Online';
    } else {
      wifiStatusLabel.innerHTML = '❌<br>Offline';
    }
  }

  //-------------------------------------------
  // Hijri Date
  async function fetchHijriDate() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const apiUrl = `https://www.islamicfinder.us/index.php/api/calendar?day=${day}&month=${month}&year=${year}&convert_to=0`;

    const hijriMonths = [
      "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
      "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
      "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
    ];

    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      const hijriRaw = data?.to;
      const hijriLabel = document.getElementById('hijriDate');

      if (hijriRaw) {
        const [hYear, hMonth, hDay] = hijriRaw.split("-").map(Number);
        const hijriMonthName = hijriMonths[hMonth - 1];
        hijriLabel.innerHTML = `${hijriMonthName} ${hDay}<br>${hYear}`;
      } else {
        hijriLabel.innerHTML = `📅<br>Hijri date unavailable`;
      }
    } catch (err) {
      console.error("Hijri fetch error:", err);
      document.getElementById('hijriDate').innerHTML = `<br>Error fetching date`;
    }
  }

  //-------------------------------------------
  // Sunrise Time
  async function updateSunriseTime() {
    try {
      const ipResponse = await fetch('https://ip-api.com/json/');
      const ipData = await ipResponse.json();
      const { lat, lon } = ipData;

      const sunResponse = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
      const sunData = await sunResponse.json();

      if (sunData.status === "OK") {
        const sunriseUTC = new Date(sunData.results.sunrise);
        const sunriseLocal = sunriseUTC.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('sunriseTime').innerHTML = `Sunrise:<br>${sunriseLocal}`;
      } else {
        document.getElementById('sunriseTime').textContent = 'Sunrise: N/A';
      }
    } catch (error) {
      console.error('Error fetching sunrise time:', error);
      document.getElementById('sunriseTime').textContent = 'Sunrise: N/A';
    }
  }

  //-------------------------------------------
  // Rotate Announcements
  let announcements = [];
  let currentAnnouncementIndex = 0;

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
    try {
      const response = await fetch('assets/notifications.txt');
      const data = await response.text();
      announcements = data.split('\n').map(a => a.trim()).filter(a => a !== '');
      shuffle(announcements);
      rotateAnnouncement();
      setInterval(rotateAnnouncement, 8000);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      const textElement = document.getElementById('notificationText');
      if (textElement) textElement.textContent = "⚠️ Could not load announcements.";
    }
  }

  //-------------------------------------------
  // Load Iqamah Times from CSV
  async function loadIqamahTimes() {
    const baseUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU7_LYYKYZHhM3QxN_DOXXhBk39ygSNDSnQO90nuQdRVmPOssCl6b0blmQD99wmG_MoZe6qsxDebbS/pub?gid=0&single=true&output=csv';
    try {
      const csvUrl = `${baseUrl}&_=${Date.now()}`;
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.trim().split('\n');

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 2) continue;

        const prayerNameRaw = parts[0].trim();
        const timeValue = parts[1].trim();
        let idName = prayerNameRaw.toLowerCase().replace(/[\s']/g, '');
        idName = idName.replace('jumua1', 'jumua1').replace('jumua2', 'jumua2');
        const labelId = `${idName}-iqamah`;
        const label = document.getElementById(labelId);
        if (label) label.textContent = timeValue;
      }
    } catch (error) {
      console.error('Error fetching Iqamah times:', error);
    }
  }

  //-------------------------------------------
  // Update Prayer Times
  async function updatePrayerTimes() {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIp = ipData.ip || 'N/A';

      const country = 'CA';
      const zipcode = 'T1H 3Y3';
      const method = '2';
      const juristic = '1';
      const apiUrl = `https://www.islamicfinder.us/index.php/api/prayer_times?user_ip=${userIp}&country=${country}&zipcode=${zipcode}&method=${method}&juristic=${juristic}`;

      const prayerResponse = await fetch(apiUrl);
      const data = await prayerResponse.json();

      if (data.success) {
        const times = data.results;
        const cleanTime = (str) => str.replace(/%am%/gi, 'am').replace(/%pm%/gi, 'pm').trim();

        document.getElementById('fajr-start').textContent = cleanTime(times.Fajr);
        document.getElementById('dhuhr-start').textContent = cleanTime(times.Dhuhr);
        document.getElementById('asr-start').textContent = cleanTime(times.Asr);
        document.getElementById('maghrib-start').textContent = cleanTime(times.Maghrib);
        const adjustedMaghribIqamahTime = adjustMinutesTo12HourTime(cleanTime(times.Maghrib), 5);
        document.getElementById('maghrib-iqamah').innerHTML = adjustedMaghribIqamahTime;
        document.getElementById('isha-start').textContent = cleanTime(times.Isha);
        document.getElementById('sunsetTime').innerHTML = cleanTime(`Sunset:<br>${times.Maghrib}`);

        const adjustedJumua1StartTime = adjustMinutesTo12HourTime(document.getElementById('jumua1-iqamah').textContent.trim(), -30);
        const adjustedJumua2StartTime = adjustMinutesTo12HourTime(document.getElementById('jumua2-iqamah').textContent.trim(), -30);
        document.getElementById('jumua1-start').innerHTML = adjustedJumua1StartTime;
        document.getElementById('jumua2-start').innerHTML = adjustedJumua2StartTime;
      }
    } catch (error) {
      console.error('Error fetching prayer times:', error);
    }
  }
  //-------------------------------------------

  // Function to make time adjustments
  function adjustMinutesTo12HourTime(timeStr, minutesToAdd) {
    if (!timeStr) return "";
    const parts = timeStr.toLowerCase().split(" ");
    if (parts.length !== 2) return timeStr;
    const [time, modifier] = parts;
    const [hoursStr, minutesStr] = time.split(":");
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);
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
  //-------------------------------------------

  // Highlight Upcoming Prayer + Countdown
  const prayerIds = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumua1', 'jumua2'];
  const prayerRows = {};
  const iqamahElements = {};
  const prayerNameElements = {};
  prayerIds.forEach(id => {
    prayerRows[id] = document.getElementById(id + 'row');
    iqamahElements[id] = document.getElementById(id + '-iqamah');
    prayerNameElements[id] = document.getElementById(id + '-name');
  });

  const upcomingNameElem = document.getElementById('upcoming-prayer-name');
  const upcomingTimeElem = document.getElementById('upcoming-prayer-time');

  function parse12HourTimeToDate(timeStr) {
    if (!timeStr) return null;
    const now = new Date();
    const parts = timeStr.trim().toLowerCase().split(' ');
    const [time, modifier] = parts;
    const [hoursStr, minutesStr] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (modifier === 'pm' && hours !== 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;
    let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (date < now) date = new Date(date.getTime() + 86400000);
    return date;
  }

  function findNextPrayer() {
    const now = new Date();
    const isFriday = now.getDay() === 5; // 5 means Friday in JS Date (0=Sunday)

    let nextPrayerId = null;
    let nextIqamahDate = null;

    for (const id of prayerIds) {
      // Skip jumua1 and jumua2 if today is not Friday
      if (!isFriday && (id === 'jumua1' || id === 'jumua2')) continue;

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
    const isFriday = now.getDay() === 5;

    // Remove highlights from all, but skip jumua rows on non-Friday days
    prayerIds.forEach(id => {
      if (!isFriday && (id === 'jumua1' || id === 'jumua2')) {
        prayerRows[id]?.classList.remove('highlight');
        // Optionally hide these rows on non-Friday:
        // prayerRows[id].style.display = 'none';
      } else {
        // Show them on Friday or normal prayers every day
        // prayerRows[id].style.display = '';
        prayerRows[id]?.classList.remove('highlight');
      }
    });

    const { nextPrayerId, nextIqamahDate } = findNextPrayer();

    if (nextPrayerId && nextIqamahDate) {
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
      upcomingNameElem.textContent = "No upcoming prayer";
      upcomingTimeElem.textContent = "--:--:--";
    }
  }

  //-------------------------------------------
  // Hadith Scrolling
  async function loadHadithsAndScroll() {
    const scrollContainer = document.getElementById('scrolling-bar');
    const scrollTextLabel = document.getElementById('scrolling-text');
    if (!scrollContainer || !scrollTextLabel) return;

    let lines = [];

    // Fetch lines once
    try {
      const response = await fetch('assets/hadith.txt');
      const text = await response.text();
      lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (err) {
      console.error('Failed to load hadith.txt:', err);
      scrollTextLabel.textContent = 'Failed to load Hadiths.';
      return;
    }

    // Scroll one line at a time
    function scrollLine() {
      if (lines.length === 0) return;

      // Pick a random line
      const line = lines[Math.floor(Math.random() * lines.length)];
      scrollTextLabel.textContent = line;

      // Reset styles so text is offscreen right
      scrollTextLabel.style.whiteSpace = 'nowrap';
      scrollTextLabel.style.position = 'relative';
      scrollTextLabel.style.left = scrollContainer.offsetWidth + 'px';

      let leftPos = scrollContainer.offsetWidth;

      function step() {
        leftPos -= 1; // pixels per frame, adjust speed here

        scrollTextLabel.style.left = leftPos + 'px';

        // When fully offscreen left (text's right edge < container left edge)
        if (leftPos + scrollTextLabel.offsetWidth > 0) {
          requestAnimationFrame(step);
        } else {
          // Start next scroll
          scrollLine();
        }
      }

      requestAnimationFrame(step);
    }

    scrollLine(); // Start first scroll
  }

  //-------------------------------------------
  // MAIN FUNCTION
  //-------------------------------------------
  // Helper: Retry until success
  //-------------------------------------------
  // Retry helper that only retries when online
  async function retryUntilSuccess(fn, label = "Unnamed", delay = 5000) {
    let success = false;
    while (!success) {
      // Wait until online before retrying
      if (!navigator.onLine) {
        console.warn(`📡 Offline: Waiting to retry "${label}"...`);
        await new Promise(resolve => {
          window.addEventListener('online', resolve, { once: true });
        });
        console.log(`🌐 Back online: Resuming retry for "${label}"`);
      }

      try {
        await fn();
        console.log(`✅ ${label} loaded successfully`);
        success = true;
      } catch (err) {
        console.warn(`🔁 ${label} failed, retrying in ${delay / 1000}s...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  //-------------------------------------------
  // Example main function calling all async tasks with retry
  async function main() {
    try {
      // Run synchronous setup functions immediately
      setMosqueName();
      updateLiveTime();
      updateCurrentDate();
      updateWifiStatus();
      updateHighlightAndCountdown();

      // Retry async functions until success, respecting online status
      await retryUntilSuccess(updateWeather, "Weather");
      await retryUntilSuccess(fetchHijriDate, "Hijri Date");
      await retryUntilSuccess(updateSunriseTime, "Sunrise Time");
      await retryUntilSuccess(loadIqamahTimes, "Iqamah Times");
      await retryUntilSuccess(updatePrayerTimes, "Prayer Times");
      await retryUntilSuccess(loadNotifications, "Notifications");
      await retryUntilSuccess(loadHadithsAndScroll, "Hadiths");

      console.log("🎉 All async tasks completed successfully");

      // Set intervals for ongoing updates
      setInterval(updateLiveTime, 1000);
      setInterval(updateCurrentDate, 60000);
      setInterval(updateWeather, 1800000);
      setInterval(updateSunriseTime, 3600000);
      setInterval(updatePrayerTimes, 1800000);
      setInterval(loadIqamahTimes, 10000);
      setInterval(updateWifiStatus, 1000);
      setInterval(updateHighlightAndCountdown, 1000);
    } catch (err) {
      console.error("🚨 Unexpected error in main():", err);
    }
  }
  main();
});