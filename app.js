// Setting the Mosque Name
const mosqueNameLabel = document.getElementById('mosqueName');
mosqueNameLabel.innerHTML = "LMA";
//-------------------------------------------

// Live Time
setInterval(() => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  document.getElementById('currentTime').textContent =
    `${hh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}, 1000);
//-------------------------------------------

// Update Current Date
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

updateCurrentDate();
setInterval(updateCurrentDate, 60 * 1000);
//-------------------------------------------

// Auto Weather Based on Location
function updateWeather() {
  fetch("https://ipapi.co/json/")
    .then(res => res.json())
    .then(location => {
      const { latitude, longitude } = location;

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
}

updateWeather();
setInterval(updateWeather, 30 * 60 * 1000);
//-------------------------------------------

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
//-------------------------------------------

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
//-------------------------------------------

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
//-------------------------------------------

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
  //-------------------------------------------

  // Get times from Google CSV file for Iqamah Times
async function loadIqamahTimes() {
  const baseUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU7_LYYKYZHhM3QxN_DOXXhBk39ygSNDSnQO90nuQdRVmPOssCl6b0blmQD99wmG_MoZe6qsxDebbS/pub?gid=0&single=true&output=csv';

  try {
    const csvUrl = `${baseUrl}&_=${Date.now()}`;
    const response = await fetch(csvUrl);
    const text = await response.text();

    const lines = text.trim().split('\n');
    // Remove header if you have one (uncomment if needed)
    // lines.shift();

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 2) continue;

      const prayerNameRaw = parts[0].trim();
      const timeValue = parts[1].trim();

      // Normalize ID by:
      // - lowercase
      // - remove spaces and apostrophes
      // - replace "jumua" with "jumua" and remove space (e.g. "jumua1")
      let idName = prayerNameRaw.toLowerCase().replace(/[\s']/g, '');

      // Special case for Jumua 1 and Jumua 2:
      idName = idName.replace('jumua1', 'jumua1').replace('jumua2', 'jumua2');

      // Final ID is like fajr-iqamah, dhuhr-iqamah, jumua1-iqamah, etc.
      const labelId = `${idName}-iqamah`;
      const label = document.getElementById(labelId);

      if (label) {
        label.textContent = timeValue;
      } else {
        console.warn(`Label with ID "${labelId}" not found.`);
      }
    }
  } catch (error) {
    console.error('Error fetching Iqamah times:', error);
  }
}

loadIqamahTimes();
setInterval(loadIqamahTimes, 10000);
//-------------------------------------------

// Update Start Times for Prayers, Set Sunset time and Maghrib Iqamah time + 5 Minutes
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

      document.getElementById('fajr-start').textContent = cleanTime(times.Fajr); //Set Fajr Time
      document.getElementById('dhuhr-start').textContent = cleanTime(times.Dhuhr); //Set Dhuhr Time
      document.getElementById('asr-start').textContent = cleanTime(times.Asr); //Set Asr Time
      document.getElementById('maghrib-start').textContent = cleanTime(times.Maghrib); //Set Maghrib Time
      const adjustedMaghribIqamahTime = adjustMinutesTo12HourTime(cleanTime(times.Maghrib), 5); //Asjust Maghrib Time
      document.getElementById('maghrib-iqamah').innerHTML = adjustedMaghribIqamahTime; //Set Maghrib Time
      document.getElementById('isha-start').textContent = cleanTime(times.Isha); //Set Isha Time
      document.getElementById('sunsetTime').innerHTML = cleanTime(`Sunset:<br>${times.Maghrib}`); //Set Sunset Time (Same as Maghrib Start)
      const adjustedJumua1StartTime = adjustMinutesTo12HourTime(document.getElementById('jumua1-iqamah').textContent, -30); //Asjust Jumua 1 Start Time
      const adjustedJumua2StartTime = adjustMinutesTo12HourTime(document.getElementById('jumua2-iqamah').textContent, -30); //Asjust Jumua 2 Start Time
      document.getElementById('jumua1-start').innerHTML = adjustedJumua1StartTime; //Set Jumua 1 Start Time
      document.getElementById('jumua2-start').innerHTML = adjustedJumua2StartTime; //Set Jumua 2 Start Time

    } else {
      console.error('Failed to fetch prayer times:', data);
    }
  } catch (error) {
    console.error('Error fetching IP or prayer times:', error);
  }
}

updatePrayerTimes();
setInterval(updatePrayerTimes, 30 * 60 * 1000);
//-------------------------------------------

// Function to add extra minutes to times - +5 for Maghrib Iqamah
function adjustMinutesTo12HourTime(timeStr, minutesToAdd) {
  const [time, modifier] = timeStr.toLowerCase().split(" ");
  let [hours, minutes] = time.split(":").map(Number);

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