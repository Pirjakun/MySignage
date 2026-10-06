(function() {
  "use strict";

  const STORAGE_KEY_URL = "mysignage_supabase_url";
  const STORAGE_KEY_KEY = "mysignage_supabase_key";

  const DEFAULT_URL = "https://gbznxsvjrxpjuomjkjuq.supabase.co";
  const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdiem54c3ZqcnhwanVvbWpranVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzc5NjksImV4cCI6MjEwNjgxMzk2OX0.2pjYTKuhZjigt-mXoVwwINKlTB-r7FjPOHaLYO87MkI";

  function getUrl() {
    return window.MYSIGNAGE_SUPABASE_URL || localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
  }

  function getKey() {
    return window.MYSIGNAGE_SUPABASE_KEY || localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY;
  }

  function isConfigured() {
    const u = getUrl().trim();
    const k = getKey().trim();
    return u.length > 0 && k.length > 0;
  }

  function setCredentials(url, key) {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY_KEY);
  }

  let clientInstance = null;

  function getClient() {
    if (!isConfigured()) return null;
    if (clientInstance) return clientInstance;

    if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
      try {
        clientInstance = supabase.createClient(getUrl(), getKey());
        return clientInstance;
      } catch (e) {
        console.error("Supabase client init error:", e);
        return null;
      }
    }
    return null;
  }

  async function fetchPlaylistCloud(mode, defaultList) {
    const client = getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("mysignage_playlists")
        .select("items")
        .eq("id", mode)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("Error fetching playlist from Supabase:", error);
      }

      if (data && Array.isArray(data.items)) {
        return data.items;
      }
    } catch (e) {
      console.warn("Supabase fetch playlist exception:", e);
    }
    return null;
  }

  async function savePlaylistCloud(mode, items) {
    const client = getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from("mysignage_playlists")
        .upsert({ id: mode, items: items, updated_at: new Date().toISOString() });

      if (error) {
        console.error("Supabase save playlist error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Supabase save playlist exception:", e);
      return false;
    }
  }

  async function fetchConfigCloud(mode, defaultConfig) {
    const client = getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("mysignage_configs")
        .select("playback_mode, freeze_index, image_fit")
        .eq("id", mode)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("Error fetching config from Supabase:", error);
      }

      if (data) {
        return {
          playbackMode: data.playback_mode || "playlist",
          freezeIndex: Number(data.freeze_index) || 0,
          imageFit: data.image_fit || "contain"
        };
      }
    } catch (e) {
      console.warn("Supabase fetch config exception:", e);
    }
    return null;
  }

  async function saveConfigCloud(mode, configObj) {
    const client = getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from("mysignage_configs")
        .upsert({
          id: mode,
          playback_mode: configObj.playbackMode || "playlist",
          freeze_index: Number(configObj.freezeIndex) || 0,
          image_fit: configObj.imageFit || "contain",
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error("Supabase save config error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Supabase save config exception:", e);
      return false;
    }
  }

  async function uploadImageFileCloud(file) {
    const client = getClient();
    if (!client) throw new Error("Supabase belum dikonfigurasi.");

    const ext = file.name.split('.').pop();
    const cleanName = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${Date.now()}_${cleanName}`;

    const { data, error } = await client.storage
      .from("mysignage_uploads")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true
      });

    if (error) {
      throw new Error(`Upload gagal: ${error.message}`);
    }

    const { data: publicUrlData } = client.storage
      .from("mysignage_uploads")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  function subscribeRealtimeCloud(onUpdateCallback) {
    const client = getClient();
    if (!client) return null;

    try {
      const channel = client.channel("mysignage_realtime_channel");
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mysignage_playlists" },
          (payload) => {
            if (typeof onUpdateCallback === "function") onUpdateCallback(payload);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mysignage_configs" },
          (payload) => {
            if (typeof onUpdateCallback === "function") onUpdateCallback(payload);
          }
        )
        .subscribe();

      return channel;
    } catch (e) {
      console.warn("Realtime subscription error:", e);
      return null;
    }
  }

  // Export globally
  window.MySignageSupabase = {
    getUrl,
    getKey,
    isConfigured,
    setCredentials,
    getClient,
    fetchPlaylistCloud,
    savePlaylistCloud,
    fetchConfigCloud,
    saveConfigCloud,
    uploadImageFileCloud,
    subscribeRealtimeCloud
  };
})();
