let activeCanvas = null;
let ctx = null;
const scale = 1;
let trackPoints = [];
let animationStartTime = null;
let selectedRace = [];
let animationFrameId = null;

const cars = [
  {
    name: "Leclerc",
    telemetryFiles: {
      Monaco: "telemetry_data.json",
      Jeddah: "telemetry_LEC_jeddah.json",
      Canada: "telemetry_LEC_canada.json",
      Miami: "telemetry_LEC_miami.json"
    },
    imageSrc: "FerrariCar.png",
    telemetry: [],
    image: new Image(),
    index: 0,
    visible: true,
    checkboxId: "LeclercCheckbox"
  },
  {
    name: "Piastri",
    telemetryFiles: {
      Monaco: "telemetry_PIAdata.json",
      Jeddah: "telemetry_PIA_jeddah.json",
      Canada: "telemetry_PIA_canada.json",
      Miami: "telemetry_PIA_miami.json"
    },
    imageSrc: "FerrariCar.png",
    telemetry: [],
    image: new Image(),
    index: 0,
    visible: true,
    checkboxId: "PiastriCheckbox"
  },
  {
    name: "Stroll",
    telemetryFiles: {
      Monaco: "telemetry_STRdata.json",
      Jeddah: "telemetry_STR_jeddah.json",
      Canada: "telemetry_STR_canada.json",
      Miami: "telemetry_STR_miami.json"
    },
    imageSrc: "AstonMartinf1Car.png",
    telemetry: [],
    image: new Image(),
    index: 0,
    visible: true,
    checkboxId: "StrollCheckbox"
  }
];

const canvases = {
  Monaco: document.getElementById("MonacoCanvas"),
  Jeddah: document.getElementById("JeddahCanvas"),
  Canada: document.getElementById("CanadianCanvas"),
  Miami: document.getElementById("MiamiCanvas")
};

const trackFiles = {
  Monaco: "MONACO_TRACK.json",
  Jeddah: "Jeddah_TRACK_FIXED.json",
  Canada: "Canada_Track.json",
  Miami: "Miami_Track.json"
};

const carWidth = 30;
const carHeight = 15;

document.querySelectorAll('.race-tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('.race-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedRace = tab.dataset.race;

    // Cancel existing animation
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Reset canvas and state
    for (let race in canvases) {
      canvases[race].style.display = race === selectedRace ? 'block' : 'none';
    }
    activeCanvas = canvases[selectedRace];
    ctx = activeCanvas.getContext("2d");
    ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

    // Reset trackPoints and car telemetry
    trackPoints = [];
    cars.forEach(car => {
      car.telemetry = [];
      car.index = 0;
    });
    animationStartTime = null;

    // Load new race assets
    try {
      await loadRaceAssets(trackFiles[selectedRace], selectedRace);
      if (trackPoints.length === 0) {
        console.error("No track data loaded — cannot animate.");
        return;
      }

      // animation start
      animationFrameId = requestAnimationFrame(animate);
    } catch (err) {
      console.error("Error loading race assets:", err);
    }
  });
});

// tab selection
document.querySelector('.race-tab[data-race="Monaco"]').classList.add('active');
selectedRace = "Monaco"; // default race
activeCanvas = canvases.Monaco;
ctx = activeCanvas.getContext("2d");

async function loadRaceAssets(trackFile, selectedRace) {
  try {
    const res = await fetch(trackFile);
    if (!res.ok) throw new Error(`Track file not found: ${trackFile}`);
    trackPoints = await res.json();

    await Promise.all(cars.map(async car => {
      const telemetryPath = car.telemetryFiles[selectedRace];
      const res = await fetch(telemetryPath);
      if (!res.ok) throw new Error(`Telemetry file not found: ${telemetryPath}`);
      car.telemetry = await res.json();

      await new Promise(resolve => {
        car.image.onload = resolve;
        car.image.src = car.imageSrc;
      });
    }));
  } catch (err) {
    console.error("loadRaceAssets error:", err);
    trackPoints = [];
  }
}

async function startRace() {
  animationStartTime = null;

  if (!document.getElementById("timer")) {
    const timerDiv = document.createElement("div");
    timerDiv.id = "timer";
    timerDiv.textContent = "Time: 0.0s";
    const aside = document.querySelector("aside");
    aside.insertBefore(timerDiv, document.getElementById("telemetryDisplay").nextSibling);
  }

  try {
    await loadRaceAssets(trackFiles[selectedRace], selectedRace);
    if (trackPoints.length === 0) {
      console.error("No track data loaded — cannot animate.");
      return;
    }
    cars.forEach(car => car.index = 0);
    animationFrameId = requestAnimationFrame(animate);
  } catch (err) {
    console.error("startRace error:", err);
  }
}

function animate(timestamp) {
  if (!animationStartTime) animationStartTime = timestamp;
  const elapsedSeconds = (timestamp - animationStartTime) / 1000;

  ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
  drawTrack();

  const telemetryDisplay = document.getElementById('telemetryDisplay');
  if (telemetryDisplay) telemetryDisplay.innerHTML = "";

  // Update timer
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = `Time: ${elapsedSeconds.toFixed(1)}s`;
  }

  const carStates = []; // Store visible cars + current time

  
  cars.forEach(car => {
    const checkbox = document.getElementById(car.checkboxId);
    car.visible = checkbox?.checked;

    if (!car.visible || car.telemetry.length < 2) return;

    const totalTime = car.telemetry[car.telemetry.length - 1].time;
    if (elapsedSeconds > totalTime) return;

    let lowerIdx = 0;
    while (
      lowerIdx < car.telemetry.length - 2 &&
      car.telemetry[lowerIdx + 1].time < elapsedSeconds
    ) {
      lowerIdx++;
    }

    const current = car.telemetry[lowerIdx];
    const next = car.telemetry[lowerIdx + 1];
    const alpha = (elapsedSeconds - current.time) / (next.time - current.time);

    const normalizedProgress = elapsedSeconds / totalTime;
    const trackIndex = normalizedProgress * (trackPoints.length - 1);
    const trackLower = Math.floor(trackIndex);
    const trackUpper = Math.min(trackLower + 1, trackPoints.length - 1);
    const interpAlpha = trackIndex - trackLower;

    const pt1 = trackPoints[trackLower];
    const pt2 = trackPoints[trackUpper];

    const x = pt1.x + (pt2.x - pt1.x) * interpAlpha;
    const y = pt1.y + (pt2.y - pt1.y) * interpAlpha;

    ctx.drawImage(
      car.image,
      x * scale - carWidth / 2,
      y * scale - carHeight / 2,
      carWidth,
      carHeight
    );
    const progress = current.time / totalTime; // 0 to 1


    carStates.push({ car, current, time: current.time, progress });
  });

  // === Phase 2: Determine leader & update telemetry UI ===
  if (carStates.length > 0) {
    const leader = carStates.reduce((lead, c) =>
      c.progress > lead.progress ? c : lead
    );
    const leaderTime = leader.time;


    carStates.forEach(({ car, current, time }) => {
      const delta = time - leaderTime;
      updateTelemetry(car, current, delta);
    });
  }

  animationFrameId = requestAnimationFrame(animate);
}


function drawTrack() {
  if (trackPoints.length === 0) return;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "red";
  ctx.beginPath();
  ctx.moveTo(trackPoints[0].x * scale, trackPoints[0].y * scale);
  for (let i = 1; i < trackPoints.length; i++) {
    ctx.lineTo(trackPoints[i].x * scale, trackPoints[i].y * scale);
  }
  ctx.stroke();
  console.log("First 5 Jeddah track points:", trackPoints.slice(0, 5));
}

function updateTelemetry(car, telemetryPoint, delta) {
  const telemetryDisplay = document.getElementById('telemetryDisplay');
  if (!telemetryDisplay) return; // Prevent error if element is missing

  const speed = Math.round(telemetryPoint.speed);
  const brakePercent = Math.round((telemetryPoint.brake || 0) * 100);
  const deltaText = delta === 0 ? 'Leader' : `+${delta.toFixed(2)}s`;

  telemetryDisplay.innerHTML += `
    <div class="telemetry-card">
      <strong>${car.name}</strong><br>
      Speed: ${speed} km/h<br>
      Brake: ${brakePercent}%<br>
      Gap: ${deltaText}
    </div>
  `;
}

function restartLap() {
  animationStartTime = null;
  animationFrameId = requestAnimationFrame(animate);
}

const telemetryDisplay = document.getElementById('telemetryDisplay');
if (telemetryDisplay) telemetryDisplay.innerHTML = "";
