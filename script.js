/* Pixel Garden Tapes - core prototype */
const state = {
  op: 0,
  lightLevels: ["Low", "Medium", "High"],
  currentLightIndex: 1,
  lampModes: ["Warm", "Soft Blue", "Cool White"],
  currentLampIndex: 0,
  tapes: [
    { name: "Rainy Day Beats", src: "assets/audio/lofi_tape_1.mp3" },
    { name: "Jazzy Tapes", src: "assets/audio/lofi_tape_2.mp3" },
    { name: "Late Night Drift", src: "assets/audio/lofi_tape_3.mp3" }
  ],
  currentTapeIndex: 0,
  plants: {
    fern: { hydration: 50, nutrition: 50, mood: "Calm", pot: "pot_basic" },
    succulent: { hydration: 45, nutrition: 60, mood: "Relaxed", pot: "pot_basic" },
    spider: { hydration: 40, nutrition: 40, mood: "Mellow", pot: "pot_basic" }
  },
  unlocks: { wallpapers: ["wallpaper_1"], pots: ["pot_basic"], fish: false }
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const audio = {
  rain: $("#audio-rain"),
  click: $("#audio-cassette-click"),
  flip: $("#audio-tape-flip"),
  music: $("#audio-music")
};

function init() {
  // Restore saved state
  const saved = localStorage.getItem("pg_tapes_state");
  if (saved) Object.assign(state, JSON.parse(saved));

  updateHUD();
  applyLamp();
  applyLight();
  applyTape();
  applyWallpaper();
  applyFish();

  // Start ambience
  audio.rain.volume = 0.35;
  audio.music.volume = 0.4;
  audio.rain.play().catch(()=>{});
  audio.music.play().catch(()=>{});

  // Bind UI
  bindControls();
  bindPlants();

  // Passive OP accumulation
  setInterval(() => {
    state.op += 1;
    $("#op-count").textContent = state.op;
  }, 5000); // 1 OP every 5 seconds (tweak)

  // Soft plant need drift (no fail)
  setInterval(() => {
    Object.values(state.plants).forEach(p => {
      p.hydration = Math.max(0, Math.min(100, p.hydration - 1));
      p.nutrition = Math.max(0, Math.min(100, p.nutrition - 0.5));
    });
    renderPlantStatus();
  }, 8000);
}

function bindControls() {
  $("#watering-can").addEventListener("click", () => {
    // Water selected/all plants: simple, soothing action
    Object.values(state.plants).forEach(p => {
      p.hydration = Math.min(100, p.hydration + 15);
      p.mood = "Content";
    });
    addOP(2);
    gentleSound("click");
    renderPlantStatus();
  });

  $("#blinds").addEventListener("click", () => {
    state.currentLightIndex = (state.currentLightIndex + 1) % state.lightLevels.length;
    applyLight();
    addOP(1);
    gentleSound("click");
  });

  $("#lamp").addEventListener("click", () => {
    state.currentLampIndex = (state.currentLampIndex + 1) % state.lampModes.length;
    applyLamp();
    addOP(1);
    gentleSound("click");
  });

  $("#cassette-deck").addEventListener("click", () => {
    flipTape();
    addOP(2);
  });

  $("#window").addEventListener("click", openWindowModal);
  $("#close-window").addEventListener("click", closeWindowModal);

  $("#btn-save").addEventListener("click", saveState);
  $("#btn-reset").addEventListener("click", () => {
    localStorage.removeItem("pg_tapes_state");
    location.reload();
  });

  // Unlocks
  $$(".unlock").forEach(btn => {
    btn.addEventListener("click", () => {
      const cost = parseInt(btn.dataset.cost, 10);
      const type = btn.dataset.type;
      const key = btn.dataset.key;

      if (state.op < cost) return;
      state.op -= cost;

      if (type === "wallpaper" && !state.unlocks.wallpapers.includes(key)) {
        state.unlocks.wallpapers.push(key);
        $("#wallpaper").src = `assets/images/wallpapers/${key}.png`;
      } else if (type === "pot" && !state.unlocks.pots.includes(key)) {
        state.unlocks.pots.push(key);
        // Apply to all current plants for simplicity
        Object.values(state.plants).forEach(p => p.pot = key);
        applyPots();
      } else if (type === "fish" && !state.unlocks.fish) {
        state.unlocks.fish = true;
        applyFish();
      }

      $("#op-count").textContent = state.op;
    });
  });
}

function bindPlants() {
  $$("#plants .plant").forEach(el => {
    const id = el.dataset.id;
    el.querySelector(".pill.water").addEventListener("click", () => {
      state.plants[id].hydration = Math.min(100, state.plants[id].hydration + 20);
      state.plants[id].mood = "Refreshed";
      addOP(1);
      gentleSound("click");
      renderPlantStatus();
    });
    el.querySelector(".pill.fert").addEventListener("click", () => {
      state.plants[id].nutrition = Math.min(100, state.plants[id].nutrition + 15);
      state.plants[id].mood = "Nourished";
      addOP(1);
      gentleSound("click");
      renderPlantStatus();
    });
  });
  renderPlantStatus();
  applyPots();
}

function renderPlantStatus() {
  $$("#plants .plant").forEach(el => {
    const p = state.plants[el.dataset.id];
    el.querySelector(".hydration").textContent = Math.round(p.hydration);
    el.querySelector(".nutrition").textContent = Math.round(p.nutrition);
    el.querySelector(".mood").textContent = computeMood(p);
    // Subtle visual wilt by hydration
    const img = el.querySelector(".plant-img");
    const wilt = Math.max(0, 1 - p.hydration / 100);
    img.style.filter = `drop-shadow(0 6px 14px rgba(0,0,0,${0.35 + wilt*0.25})) saturate(${0.9 - wilt*0.2}) brightness(${0.95 - wilt*0.15})`;
  });
}

function computeMood(p) {
  const light = state.lightLevels[state.currentLightIndex];
  const hydrationOK = p.hydration >= 35;
  const nutritionOK = p.nutrition >= 35;
  const lightMood = light === "Low" ? "Cozy" : light === "Medium" ? "Calm" : "Bright";
  if (hydrationOK && nutritionOK) return lightMood;
  if (!hydrationOK && !nutritionOK) return "A bit wilted";
  if (!hydrationOK) return "Thirsty";
  if (!nutritionOK) return "Peckish";
  return "Calm";
}

function applyLight() {
  $("#light-level").textContent = state.lightLevels[state.currentLightIndex];
  // Light subtly affects wallpaper brightness
  const level = state.lightLevels[state.currentLightIndex];
  const wallpaper = $("#wallpaper");
  wallpaper.style.opacity = level === "Low" ? 0.25 : level === "Medium" ? 0.35 : 0.45;
}

function applyLamp() {
  const mode = state.lampModes[state.currentLampIndex];
  document.body.dataset.lamp = mode;
  $("#lamp-mode").textContent = mode;
}

function flipTape() {
  audio.flip.currentTime = 0;
  audio.flip.play().catch(()=>{});
  setTimeout(() => {
    state.currentTapeIndex = (state.currentTapeIndex + 1) % state.tapes.length;
    const tape = state.tapes[state.currentTapeIndex];
    $("#tape-name").textContent = tape.name;
    audio.music.pause();
    audio.music.src = tape.src;
    audio.music.currentTime = 0;
    audio.music.play().catch(()=>{});
    gentleSound("click");
  }, 400);
}

function addOP(n) {
  state.op += n;
  $("#op-count").textContent = state.op;
}

function gentleSound(which) {
  if (which === "click") {
    audio.click.currentTime = 0;
    audio.click.volume = 0.25;
    audio.click.play().catch(()=>{});
  }
}

function openWindowModal() {
  $("#window-modal").classList.remove("hidden");
  // Louder rain while viewing
  audio.rain.volume = 0.55;
}
function closeWindowModal() {
  $("#window-modal").classList.add("hidden");
  audio.rain.volume = 0.35;
}

function applyWallpaper() {
  const last = state.unlocks.wallpapers[state.unlocks.wallpapers.length - 1];
  $("#wallpaper").src = `assets/images/wallpapers/${last}.png`;
}

function applyPots() {
  const lastPot = state.unlocks.pots[state.unlocks.pots.length - 1];
  $$("#plants .plant").forEach(el => {
    const img = el.querySelector(".plant-img");
    // Overlay pot via CSS mask trick (optional if you have combined sprites)
    img.style.maskImage = `url(assets/images/pots/${lastPot}.png)`;
    img.style.webkitMaskImage = `url(assets/images/pots/${lastPot}.png)`;
    img.style.maskComposite = "exclude";
  });
}

function applyFish() {
  $("#fish-tank").classList.toggle("hidden", !state.unlocks.fish);
}

function saveState() {
  localStorage.setItem("pg_tapes_state", JSON.stringify(state));
  // small confirmation
  const btn = $("#btn-save");
  const old = btn.textContent;
  btn.textContent = "Saved";
  setTimeout(() => (btn.textContent = old), 800);
}

document.addEventListener("DOMContentLoaded", init);
