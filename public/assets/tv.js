(function() {
  "use strict";

  const KEY_LANDSCAPE = "mysignage_playlist_landscape_v3";
  const KEY_PORTRAIT = "mysignage_playlist_portrait_v3";

  const KEY_CONFIG_LANDSCAPE = "mysignage_config_landscape_v3";
  const KEY_CONFIG_PORTRAIT = "mysignage_config_portrait_v3";

  const DEFAULT_LANDSCAPE = [
    { type: "image", src: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1920&q=85", duration: 5000 },
    { type: "image", src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1920&q=85", duration: 5000 },
    { type: "image", src: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=85", duration: 5000 }
  ];

  const DEFAULT_PORTRAIT = [
    { type: "image", src: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=85", duration: 5000 },
    { type: "image", src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1080&q=85", duration: 5000 },
    { type: "image", src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=85", duration: 5000 }
  ];

  /* --- INDEXED DB ENGINE --- */
  const DB_NAME = "MySignageDB";
  const DB_VERSION = 1;
  const STORE_NAME = "mysignage_store";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getDBItem(key, defaultValue) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            resolve(req.result);
          } else {
            try {
              const ls = JSON.parse(localStorage.getItem(key));
              if (ls !== null && ls !== undefined) return resolve(ls);
            } catch(e){}
            resolve(defaultValue);
          }
        };
        req.onerror = () => resolve(defaultValue);
      });
    } catch (e) {
      return defaultValue;
    }
  }

  // Determine orientation mode
  const path = window.location.pathname.toLowerCase();
  const isPortrait = path.includes("/portrait") || document.body.dataset.mode === "portrait";
  
  const storageKey = isPortrait ? KEY_PORTRAIT : KEY_LANDSCAPE;
  const configKey = isPortrait ? KEY_CONFIG_PORTRAIT : KEY_CONFIG_LANDSCAPE;
  const defaultList = isPortrait ? DEFAULT_PORTRAIT : DEFAULT_LANDSCAPE;

  let list = [...defaultList];
  let config = { playbackMode: "playlist", freezeIndex: 0, imageFit: "contain" };
  let currentIndex = 0;
  let timer = null;

  const dbMode = isPortrait ? "portrait" : "landscape";

  async function loadData() {
    let cloudList = null;
    let cloudCfg = null;

    if (window.MySignageSupabase && window.MySignageSupabase.isConfigured()) {
      try {
        cloudList = await window.MySignageSupabase.fetchPlaylistCloud(dbMode, null);
        cloudCfg = await window.MySignageSupabase.fetchConfigCloud(dbMode, null);
      } catch(e) {
        console.warn("Supabase fetch failed in TV player:", e);
      }
    }

    if (Array.isArray(cloudList) && cloudList.length) {
      list = cloudList;
    } else {
      try {
        const dbList = await getDBItem(storageKey, null);
        if (Array.isArray(dbList) && dbList.length) {
          list = dbList;
        } else {
          list = defaultList;
        }
      } catch(e) {
        list = defaultList;
      }
    }

    if (cloudCfg && typeof cloudCfg === "object") {
      config = cloudCfg;
    } else {
      try {
        const dbCfg = await getDBItem(configKey, null);
        if (dbCfg && typeof dbCfg === "object") {
          config = dbCfg;
        } else {
          config = { playbackMode: "playlist", freezeIndex: 0, imageFit: "contain" };
        }
      } catch(e) {
        config = { playbackMode: "playlist", freezeIndex: 0, imageFit: "contain" };
      }
    }
  }

  function showSlide(item) {
    if (!item) return;
    const stage = document.getElementById("stage");
    if (!stage) return;

    const oldSlides = Array.from(stage.querySelectorAll(".slide"));

    const newSlide = document.createElement("div");
    newSlide.className = "slide";

    if (item.type === "image") {
      const img = new Image();
      img.src = item.src;
      img.style.objectFit = config.imageFit || "contain";
      newSlide.appendChild(img);
    } else {
      const div = document.createElement("div");
      div.className = "text-slide";
      div.textContent = item.text || "";
      newSlide.appendChild(div);
    }

    stage.appendChild(newSlide);

    // Force reflow for smooth CSS opacity transition
    void newSlide.offsetWidth;

    // Fade-in new slide
    newSlide.classList.add("active");

    // Fade-out old slides & cleanup after 1.1s
    oldSlides.forEach(oldSlide => {
      oldSlide.classList.remove("active");
      setTimeout(() => {
        if (oldSlide.parentNode === stage) {
          stage.removeChild(oldSlide);
        }
      }, 1150);
    });
  }

  async function startPlayback() {
    clearTimeout(timer);
    await loadData();
    playNext();
  }

  function playNext() {
    clearTimeout(timer);

    if (!list || !list.length) return;

    // Mode Freeze: Single photo locked
    if (config.playbackMode === "freeze") {
      let targetIndex = Number(config.freezeIndex) || 0;
      if (targetIndex >= list.length || targetIndex < 0) targetIndex = 0;
      const item = list[targetIndex];
      showSlide(item);
      return; // Stop timer in freeze mode
    }

    // Mode Playlist (Auto Loop)
    if (currentIndex >= list.length) {
      currentIndex = 0;
    }

    const item = list[currentIndex];
    showSlide(item);

    const duration = Math.max(Number(item.duration) || 5000, 1000);
    currentIndex = (currentIndex + 1) % list.length;

    timer = setTimeout(() => {
      loadData().then(() => {
        playNext();
      });
    }, duration);
  }

  // Real-time synchronization handlers
  function onDataChanged() {
    currentIndex = 0;
    startPlayback();
  }

  if (typeof BroadcastChannel !== "undefined") {
    const syncChannel = new BroadcastChannel("mysignage_sync");
    syncChannel.onmessage = function() {
      onDataChanged();
    };
  }

  window.addEventListener("storage", function() {
    onDataChanged();
  });

  if (window.MySignageSupabase && window.MySignageSupabase.isConfigured()) {
    window.MySignageSupabase.subscribeRealtimeCloud(() => {
      onDataChanged();
    });
  }

  // Start player
  startPlayback();
})();
