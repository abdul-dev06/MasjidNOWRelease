// 🕒 Live Time
setInterval(() => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  document.getElementById('currentTime').textContent =
    `${hh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}, 1000);

// 📅 Current Date
const dateLabel = document.getElementById('currentDate');
const now = new Date();

const optionsMonth = { month: 'long' };
const optionsDay = { day: 'numeric' };
const optionsYear = { year: 'numeric' };

const month = now.toLocaleDateString(undefined, optionsMonth);
const day = now.toLocaleDateString(undefined, optionsDay);
const year = now.toLocaleDateString(undefined, optionsYear);

// Compose with a line break after day
dateLabel.innerHTML = `${month} ${day}<br>${year}`;

// 🌐 Auto Location & Weather
fetch("https://ipapi.co/json/")
  .then(res => res.json())
  .then(location => {
    const { latitude, longitude, city, region, country_name } = location;

    // 🌤 Fetch weather from Open-Meteo
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`)
      .then(res => res.json())
      .then(data => {
        const temp = Math.round(data.current.temperature_2m);
        document.getElementById('currentWeather').innerHTML = `🌡<br>${temp}°C`;
      })
      .catch(() => {
        document.getElementById('currentWeather').textContent = "⚠️ Weather Error";
      });

  })
  .catch(() => {
    document.getElementById('currentWeather').textContent = "⚠️ Location Error";
  });

// Setting the Mosque Name
const mosqueNameLabel = document.getElementById('mosqueName');
const mosqueName = "LMA";
mosqueNameLabel.innerHTML = mosqueName;

// Checking WiFi Status
const wifiStatusLabel = document.getElementById('wifiStatus');

// Function to update WiFi status
function updateWifiStatus() {
  if (navigator.onLine) {
    wifiStatusLabel.innerHTML = '🌐<br>Online';
  } else {
    wifiStatusLabel.innerHTML = '❌<br>Offline';
  }
}

updateWifiStatus();

window.addEventListener('online', updateWifiStatus);
window.addEventListener('offline', updateWifiStatus);

// Hijri date API Call
function fetchHijriDate() {
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

  fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      const hijriRaw = data?.to;
      const hijriLabel = document.getElementById('hijriDate');

      if (hijriRaw) {
        const [hYear, hMonth, hDay] = hijriRaw.split("-").map(Number);
        const hijriMonthName = hijriMonths[hMonth - 1];
        hijriLabel.innerHTML = `${hijriMonthName} ${hDay}<br>${hYear}`;
      } else {
        hijriLabel.innerHTML = `📅<br>Hijri date unavailable`;
      }
    })
    .catch(err => {
      console.error("Hijri fetch error:", err);
      document.getElementById('hijriDate').innerHTML = `<br>Error fetching date`;
    });
}
fetchHijriDate();

//Getting the sunrise time
async function updateSunriseTime() {
  try {
    // Get IP location info
    const ipResponse = await fetch('http://ip-api.com/json/');
    if (!ipResponse.ok) throw new Error('Failed to get IP location');
    const ipData = await ipResponse.json();
    const { lat, lon } = ipData;

    // Fetch sunrise time from sunrise-sunset API
    const sunResponse = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    if (!sunResponse.ok) throw new Error('Failed to get sunrise time');
    const sunData = await sunResponse.json();

    if (sunData.status === "OK") {
      const sunriseUTC = new Date(sunData.results.sunrise);
      const sunriseLocal = sunriseUTC.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Update your sunrise label
      document.getElementById('sunriseTime').innerHTML = `Sunrise:<br>${sunriseLocal}`;
    } else {
      console.error('Sunrise-sunset API returned status:', sunData.status);
      document.getElementById('sunriseTime').textContent = 'Sunrise: N/A';
    }
  } catch (error) {
    console.error('Error fetching sunrise time:', error);
    document.getElementById('sunriseTime').textContent = 'Sunrise: N/A';
  }
}

updateSunriseTime();

setInterval(updateSunriseTime, 3600000);

// Rotate Notifications
let announcements = [];
let currentIndex = 0;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function rotateAnnouncement() {
  const textElement = document.getElementById('notificationText');

  // Fade out
  textElement.style.opacity = '0';

  setTimeout(() => {
    if (announcements.length > 0) {
      textElement.textContent = announcements[currentIndex];
      currentIndex = (currentIndex + 1) % announcements.length;
    }

    // Fade in
    textElement.style.opacity = '1';
  }, 500); // match transition time
}

fetch('notifications.txt')
  .then(response => response.text())
  .then(data => {
    announcements = data.split('\n').map(a => a.trim()).filter(a => a !== '');
    shuffle(announcements); // Shuffle randomly

    // Show the first one immediately
    rotateAnnouncement();

    // Rotate every 8 seconds
    setInterval(rotateAnnouncement, 8000);
  })
  .catch(err => {
    console.error("Failed to load notifications:", err);
    const textElement = document.getElementById('notificationText');
    textElement.textContent = "⚠️ Could not load announcements.";
  });

async function updatePrayerTimes() {
  try {
    // Step 1: Get IP address from ipify
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const userIp = ipData.ip || 'N/A';

    // Step 2: Build prayer times API URL with the real IP
    const country = 'CA';
    const zipcode = 'T1H 3Y3';
    const method = '2';
    const juristic = '1';
    const apiUrl = `https://www.islamicfinder.us/index.php/api/prayer_times?user_ip=${userIp}&country=${country}&zipcode=${zipcode}&method=${method}&juristic=${juristic}`;

    // Step 3: Fetch prayer times
    const prayerResponse = await fetch(apiUrl);
    const data = await prayerResponse.json();

    if (data.success) {
      const times = data.results;

      // Helper to clean am/pm formatting
      const cleanTime = (str) => str.replace(/%am%/gi, 'am').replace(/%pm%/gi, 'pm');

      document.getElementById('fajr-start').textContent = cleanTime(times.Fajr);
      document.getElementById('dhuhr-start').textContent = cleanTime(times.Dhuhr);
      document.getElementById('asr-start').textContent = cleanTime(times.Asr);
      document.getElementById('maghrib-start').textContent = cleanTime(times.Maghrib);
      document.getElementById('isha-start').textContent = cleanTime(times.Isha);
    } else {
      console.error('Failed to fetch prayer times:', data);
    }
  } catch (error) {
    console.error('Error fetching IP or prayer times:', error);
  }
}

updatePrayerTimes();
