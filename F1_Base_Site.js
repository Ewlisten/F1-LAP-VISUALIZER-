let activeCanvas = null;
let ctx = null;
const scale = 1;
let trackPoints = [];
let animationStartTime = null;

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

const carWidth = 30;
const carHeight = 15;

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
  const selectedRace = document.getElementById('raceSelect').value;

  // Show only the selected race canvas
  for (let race in canvases) {
    canvases[race].style.display = race === selectedRace ? 'block' : 'none';
  }

  activeCanvas = canvases[selectedRace];
  ctx = activeCanvas.getContext("2d");

  const trackFiles = {
    Monaco: "true_track_path.json",
    Jeddah: "Jeddah_path.json",
    Canada: "canada_track.json",
    Miami: "miami_track.json"
  };

  animationStartTime = null;

  try {
    await loadRaceAssets(trackFiles[selectedRace], selectedRace);

    if (trackPoints.length === 0) {
      console.error("No track data loaded — cannot animate.");
      return;
    }

    cars.forEach(car => {
      car.index = 0;
    });

    requestAnimationFrame(animate);
  } catch (err) {
    console.error("startRace error:", err);
  }
}

function animate(timestamp) {
  if (!animationStartTime) animationStartTime = timestamp;
  const elapsedSeconds = (timestamp - animationStartTime) / 1000;

  ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
  drawTrack();

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

    updateTelemetry(car, current);
  });

  requestAnimationFrame(animate);
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
}

function updateTelemetry(car, telemetryPoint) {
  const telemetryDisplay = document.getElementById('telemetryDisplay');
  telemetryDisplay.textContent = `Driver: ${car.name} | Speed: ${telemetryPoint.speed} km/h`;
}

function restartLap() {
  animationStartTime = null;
  requestAnimationFrame(animate);
}
