const defaultSounds = [
  { name: "Ghop Ghop", file: "sounds/ghop-gop-gop.mp3" },
  { name: "Fahhh", file: "sounds/faaah.mp3" },
  { name: "Sad Violin", file: "sounds/sedsound.mp3" },
  { name: "AAH-JF", file: "sounds/aah-meme-jacqueline-fernandez.mp3" },
  { name: "Dun Dun Dun", file: "sounds/dun-dun-dun-sound-effect-brass_8nFBccR.mp3" },
  { name: "lund-pakad-ke-taraju", file: "sounds/lund-pakad-ke-tarazu-ki-tarah-cid.mp3" },
  { name: "Wow", file: "sounds/omg wow.mp3" },
  { name: "Sad Violin", file: "sounds/sedsound.mp3" },
  { name: "Kbc Clock", file: "sounds/kbc-clock.mp3" },
  { name: "Kbc Question", file: "sounds/kbc-question.mp3" },
  { name: "7 crore", file: "sounds/7-crore-kbc.mp3" },
  { name: "Aww", file: "sounds/aww.mp3" },
  { name: "Mudi-BKL", file: "sounds/mudi-ji-bkl.mp3" },
  { name: "Romance", file: "sounds/Romance.mp3" }

];

const board = document.getElementById("board");
const msg = document.getElementById("msg");
const stopAllBtn = document.getElementById("stopAllBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

let currentAudio = null;
const activePads = new Set();
const customPads = new Map();
let db = null;

function stopAudio(audio, reset = true) {
  if (!audio) return;
  audio.pause();
  if (reset) {
    try { audio.currentTime = 0; } catch (_) {}
  }
}

function stopAllSounds() {
  activePads.forEach(({ audio, setPlaying }) => {
    stopAudio(audio);
    setPlaying(false);
  });
  currentAudio = null;
}

stopAllBtn.addEventListener("click", stopAllSounds);

function createPad(name, src, onRemove = null, isCustom = false, customId = null) {
  const audio = new Audio(src);
  audio.preload = "auto";

  const pad = document.createElement("div");
  pad.className = "pad";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "play";
  btn.setAttribute("aria-label", `Play ${name}`);
  btn.setAttribute("aria-pressed", "false");

  const icon = document.createElement("span");
  icon.className = "icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▶";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = name;
  btn.append(icon, label);
  pad.appendChild(btn);

  const setPlaying = (on) => {
    pad.classList.toggle("playing", on);
    icon.textContent = on ? "⏸" : "▶";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", `${on ? "Pause" : "Play"} ${name}`);
  };

  const padRecord = { audio, setPlaying, pad };
  activePads.add(padRecord);

  btn.addEventListener("click", async () => {
    msg.textContent = "";

    if (!audio.paused && !audio.ended) {
      stopAudio(audio, false);
      setPlaying(false);
      if (currentAudio === audio) currentAudio = null;
      return;
    }

    if (currentAudio && currentAudio !== audio) {
      const previous = [...activePads].find(item => item.audio === currentAudio);
      stopAudio(currentAudio);
      if (previous) previous.setPlaying(false);
    }

    try {
      audio.currentTime = 0;
      await audio.play();
      currentAudio = audio;
      pad.classList.remove("missing");
    } catch (_) {
      setPlaying(false);
      pad.classList.add("missing");
      currentAudio = null;
      msg.textContent = `Couldn't play "${name}". Check that the audio file exists and is supported.`;
    }
  });

  audio.addEventListener("play", () => {
    pad.classList.remove("missing");
    setPlaying(true);
  });
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => {
    setPlaying(false);
    if (currentAudio === audio) currentAudio = null;
    try { audio.currentTime = 0; } catch (_) {}
  });
  audio.addEventListener("error", () => {
    pad.classList.add("missing");
    setPlaying(false);
    if (currentAudio === audio) currentAudio = null;
  });

  if (onRemove) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove";
    removeBtn.title = `Remove ${name}`;
    removeBtn.setAttribute("aria-label", `Remove ${name}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", async () => {
      stopAudio(audio);
      if (currentAudio === audio) currentAudio = null;
      activePads.delete(padRecord);
      pad.remove();
      audio.removeAttribute("src");
      audio.load();
      if (isCustom) URL.revokeObjectURL(src);
      if (customId !== null) customPads.delete(customId);
      try {
        await onRemove();
        msg.textContent = `Removed "${name}".`;
      } catch (_) {
        msg.textContent = `Removed "${name}" from the screen, but couldn't update browser storage.`;
      }
    });
    pad.appendChild(removeBtn);
  }

  board.appendChild(pad);
  return {
    audio,
    cleanup() {
      stopAudio(audio);
      activePads.delete(padRecord);
      if (currentAudio === audio) currentAudio = null;
      audio.removeAttribute("src");
      audio.load();
      if (isCustom) URL.revokeObjectURL(src);
    }
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("meme-soundboard", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("sounds")) {
        request.result.createObjectStore("sounds", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbDo(database, mode, operation) {
  return new Promise((resolve, reject) => {
    let result;
    let request;
    let transaction;
    try {
      transaction = database.transaction("sounds", mode);
      request = operation(transaction.objectStore("sounds"));
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Storage operation aborted"));
  });
}

function addCustomPad(database, item) {
  const url = URL.createObjectURL(item.blob);
  const pad = createPad(
    item.name,
    url,
    () => dbDo(database, "readwrite", store => store.delete(item.id)),
    true,
    item.id
  );
  customPads.set(item.id, pad);
}

function safeAudioExtension(type, name) {
  const match = String(name || "").match(/\.([a-z0-9]{1,8})$/i);
  if (match) return match[1].toLowerCase();
  const known = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav",
    "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/aac": "aac", "audio/webm": "webm", "audio/flac": "flac"
  };
  return known[type] || "audio";
}

async function exportSoundboard() {
  if (!db) {
    msg.textContent = "Custom sounds aren't available to export in this browser.";
    return;
  }
  if (typeof JSZip === "undefined") {
    msg.textContent = "Backup tool didn't load. Check your internet connection and refresh.";
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = "PACKING SOUNDS...";
  try {
    const items = await dbDo(db, "readonly", store => store.getAll());
    const zip = new JSZip();
    const manifest = { format: "madhur-model-soundboard", version: 1, sounds: [] };
    const folder = zip.folder("sounds");

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!(item.blob instanceof Blob)) continue;
      const ext = safeAudioExtension(item.blob.type, item.originalName || "");
      const filename = `custom-${String(i + 1).padStart(3, "0")}.${ext}`;
      folder.file(filename, item.blob);
      manifest.sounds.push({ name: item.name, file: `sounds/${filename}`, type: item.blob.type || "audio/mpeg" });
    }

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "madhur-model-soundboard-backup.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    msg.textContent = `Backup downloaded! ${manifest.sounds.length} custom sound(s) packed up. 🤘`;
  } catch (_) {
    msg.textContent = "Couldn't create the backup. Please try again.";
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = "⬇ EXPORT BACKUP";
  }
}

async function importSoundboard(file) {
  if (!db) {
    msg.textContent = "Custom sounds can't be saved in this browser.";
    return;
  }
  if (typeof JSZip === "undefined") {
    msg.textContent = "Backup tool didn't load. Check your internet connection and refresh.";
    return;
  }
  if (!file) return;

  importBtn.disabled = true;
  importBtn.textContent = "IMPORTING...";
  try {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) throw new Error("Backup manifest is missing");
    const manifest = JSON.parse(await manifestFile.async("string"));
    if (manifest.format !== "madhur-model-soundboard" || !Array.isArray(manifest.sounds)) {
      throw new Error("This isn't a Madhur Model soundboard backup");
    }
    if (manifest.sounds.length > 200) throw new Error("Backup contains too many sounds");

    const existing = await dbDo(db, "readonly", store => store.getAll());
    const existingKeys = new Set(existing.map(item => `${item.name}\u0000${item.blob?.size}\u0000${item.blob?.type}`));
    let added = 0;
    let skipped = 0;

    for (const sound of manifest.sounds) {
      if (!sound || typeof sound.name !== "string" || typeof sound.file !== "string") {
        skipped++;
        continue;
      }
      // Only accept files inside the sounds folder; don't read arbitrary ZIP paths.
      if (!sound.file.startsWith("sounds/") || sound.file.includes("..") || sound.file.startsWith("/")) {
        skipped++;
        continue;
      }
      const zippedFile = zip.file(sound.file);
      if (!zippedFile) { skipped++; continue; }
      const blob = await zippedFile.async("blob");
      if (!blob.size || blob.size > 50 * 1024 * 1024) { skipped++; continue; }
      const type = typeof sound.type === "string" && sound.type.startsWith("audio/") ? sound.type : "audio/mpeg";
      const typedBlob = new Blob([blob], { type });
      const name = sound.name.trim().slice(0, 24);
      if (!name) { skipped++; continue; }
      const key = `${name}\u0000${typedBlob.size}\u0000${typedBlob.type}`;
      if (existingKeys.has(key)) { skipped++; continue; }

      const item = { name, blob: typedBlob, originalName: sound.file.split("/").pop() };
      item.id = await dbDo(db, "readwrite", store => store.add(item));
      addCustomPad(db, item);
      existingKeys.add(key);
      added++;
    }

    msg.textContent = `Import complete! ${added} sound(s) added${skipped ? `, ${skipped} skipped (duplicates or invalid files)` : ""}. 🎉`;
  } catch (_) {
    msg.textContent = "Couldn't import that backup. Choose a valid soundboard ZIP and try again.";
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = "⬆ IMPORT BACKUP";
    importFile.value = "";
  }
}

exportBtn.addEventListener("click", exportSoundboard);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => importSoundboard(importFile.files[0]));

async function init() {
  defaultSounds.forEach(sound => createPad(sound.name, sound.file));
  try {
    db = await openDB();
    const savedSounds = await dbDo(db, "readonly", store => store.getAll());
    savedSounds.forEach(item => addCustomPad(db, item));
    exportBtn.disabled = false;
    importBtn.disabled = false;
  } catch (_) {
    msg.textContent = "Custom sounds may not be available in this browser, but the built-in sounds can still be used.";
    exportBtn.disabled = true;
    importBtn.disabled = true;
  }

  document.getElementById("addBtn").addEventListener("click", async () => {
    const nameInput = document.getElementById("newName");
    const fileInput = document.getElementById("newFile");
    const name = nameInput.value.trim();
    const file = fileInput.files[0];

    if (!name || !file) {
      msg.textContent = "Enter a button name and choose an audio file.";
      return;
    }
    if (!file.type.startsWith("audio/")) {
      msg.textContent = "That file doesn't look like an audio file.";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      msg.textContent = "That file is too large. Please choose an audio file under 50 MB.";
      return;
    }
    if (!db) {
      msg.textContent = "Custom sounds can't be saved in this browser. The built-in sounds are still available.";
      return;
    }

    const addBtn = document.getElementById("addBtn");
    addBtn.disabled = true;
    try {
      const item = { name: name.slice(0, 24), blob: file, originalName: file.name };
      item.id = await dbDo(db, "readwrite", store => store.add(item));
      addCustomPad(db, item);
      nameInput.value = "";
      fileInput.value = "";
      msg.textContent = `Added "${item.name}". Nice one! 🎵`;
    } catch (_) {
      msg.textContent = "Couldn't save that sound. Try another audio file.";
    } finally {
      addBtn.disabled = false;
    }
  });
}

init();
