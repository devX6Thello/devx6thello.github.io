"use strict";

(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.WeatherForecastCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const PERMUTATION = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
  const PERM = new Array(512);

  for (let index = 0; index < 512; index += 1) {
    PERM[index] = PERMUTATION[index & 255];
  }

  const NOISE_SCALE = 0.00018;
  const WEATHER_EPOCH_SECONDS = 1753269629;
  const SECOND = 1;
  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK_MS = 7 * DAY * 1000;

  const CACHE_DATA_KEY = "WeeklyWeatherData";
  const CACHE_CREATED_KEY = "WeeklyWeatherCreated";
  const CACHE_VERSION_KEY = "WeeklyWeatherVersion";
  const CACHE_VERSION = "2-calendar-days";

  const DEFAULT_AUDIO_BASE_PATH = "Audios/";
  const STORM_START_SOUNDS = Object.freeze([
    "ZeusLightningStart1.ogg",
    "ZeusLightningStart2.ogg"
  ]);
  const STORM_END_SOUNDS = Object.freeze([
    "ZeusLightningEnd1.ogg",
    "ZeusLightningEnd2.ogg"
  ]);

  const DAY_NAMES_SUNDAY_FIRST = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const DAY_NAMES_MONDAY_FIRST = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ];

  function fade(value) {
    return value * value * value * (value * (value * 6 - 15) + 10);
  }

  function lerp(amount, start, end) {
    return start + amount * (end - start);
  }

  function gradient(hash, x, y, z) {
    const masked = hash & 15;
    const first = masked < 8 ? x : y;
    const second = masked < 4 ? y : masked === 12 || masked === 14 ? x : z;

    return (masked & 1 ? -first : first) + (masked & 2 ? -second : second);
  }

  function perlinNoise(x, y = 0, z = 0) {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);

    const gridX = floorX & 255;
    const gridY = floorY & 255;
    const gridZ = floorZ & 255;

    x -= floorX;
    y -= floorY;
    z -= floorZ;

    const fadeX = fade(x);
    const fadeY = fade(y);
    const fadeZ = fade(z);

    const a = PERM[gridX] + gridY;
    const aa = PERM[a] + gridZ;
    const ab = PERM[a + 1] + gridZ;
    const b = PERM[gridX + 1] + gridY;
    const ba = PERM[b] + gridZ;
    const bb = PERM[b + 1] + gridZ;

    return lerp(
      fadeZ,
      lerp(
        fadeY,
        lerp(fadeX, gradient(PERM[aa], x, y, z), gradient(PERM[ba], x - 1, y, z)),
        lerp(fadeX, gradient(PERM[ab], x, y - 1, z), gradient(PERM[bb], x - 1, y - 1, z))
      ),
      lerp(
        fadeY,
        lerp(fadeX, gradient(PERM[aa + 1], x, y, z - 1), gradient(PERM[ba + 1], x - 1, y, z - 1)),
        lerp(fadeX, gradient(PERM[ab + 1], x, y - 1, z - 1), gradient(PERM[bb + 1], x - 1, y - 1, z - 1))
      )
    );
  }

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
  }


  function normalizeAudioBasePath(basePath) {
    const value =
      typeof basePath === "string" ? basePath : DEFAULT_AUDIO_BASE_PATH;

    if (!value) {
      return "";
    }

    return /[\\/]$/.test(value) ? value : `${value}/`;
  }

  function isAutoplayError(error) {
    return Boolean(
      error &&
        (error.name === "NotAllowedError" ||
          error.name === "SecurityError" ||
          /autoplay|user gesture|user interaction/i.test(error.message || ""))
    );
  }

  function createSoundController(options = {}) {
    const AudioConstructor =
      options.AudioConstructor ||
      (root && typeof root.Audio === "function" ? root.Audio : null);
    const unlockTarget =
      options.unlockTarget === undefined
        ? root && root.document
        : options.unlockTarget;
    const random =
      typeof options.random === "function" ? options.random : Math.random;
    const basePath = normalizeAudioBasePath(options.basePath);
    const maximumPendingSounds = Number.isFinite(options.maxPendingSounds)
      ? Math.max(1, Math.floor(options.maxPendingSounds))
      : 8;
    const unlockEvents =
      Array.isArray(options.unlockEvents) && options.unlockEvents.length
        ? options.unlockEvents.slice()
        : ["pointerdown", "touchstart", "keydown"];

    let enabled = options.enabled !== false;
    let unlocked = options.unlocked === true || !unlockTarget;
    let volume = clamp(
      Number.isFinite(options.volume) ? options.volume : 1,
      0,
      1
    );
    let listenersInstalled = false;
    let pendingSounds = [];
    const activeAudio = new Set();

    function removeUnlockListeners() {
      if (
        !listenersInstalled ||
        !unlockTarget ||
        typeof unlockTarget.removeEventListener !== "function"
      ) {
        return;
      }

      for (const eventName of unlockEvents) {
        unlockTarget.removeEventListener(eventName, handleUnlock);
      }

      listenersInstalled = false;
    }

    function installUnlockListeners() {
      if (
        unlocked ||
        listenersInstalled ||
        !unlockTarget ||
        typeof unlockTarget.addEventListener !== "function"
      ) {
        return;
      }

      for (const eventName of unlockEvents) {
        unlockTarget.addEventListener(eventName, handleUnlock, {
          once: true,
          passive: true
        });
      }

      listenersInstalled = true;
    }

    function releaseAudio(audio) {
      activeAudio.delete(audio);
    }

    function createAudio(fileName) {
      const audio = new AudioConstructor(`${basePath}${fileName}`);
      audio.preload = "auto";
      audio.volume = volume;

      if (typeof audio.addEventListener === "function") {
        audio.addEventListener("ended", () => releaseAudio(audio), {
          once: true
        });
        audio.addEventListener("error", () => releaseAudio(audio), {
          once: true
        });
      }

      return audio;
    }

    function queueFile(fileName) {
      pendingSounds.push(fileName);

      if (pendingSounds.length > maximumPendingSounds) {
        pendingSounds = pendingSounds.slice(-maximumPendingSounds);
      }

      installUnlockListeners();

      return {
        fileName,
        played: false,
        queued: true,
        reason: "awaiting-user-interaction"
      };
    }

    function playFileNow(fileName) {
      if (!enabled) {
        return Promise.resolve({
          fileName,
          played: false,
          queued: false,
          reason: "disabled"
        });
      }

      if (typeof AudioConstructor !== "function") {
        return Promise.resolve({
          fileName,
          played: false,
          queued: false,
          reason: "audio-unavailable"
        });
      }

      let audio;

      try {
        audio = createAudio(fileName);
        activeAudio.add(audio);

        const result = audio.play();

        return Promise.resolve(result)
          .then(() => ({
            fileName,
            played: true,
            queued: false,
            reason: null
          }))
          .catch((error) => {
            releaseAudio(audio);

            if (isAutoplayError(error)) {
              unlocked = false;
              return queueFile(fileName);
            }

            return {
              fileName,
              played: false,
              queued: false,
              reason: "play-failed",
              error
            };
          });
      } catch (error) {
        if (audio) {
          releaseAudio(audio);
        }

        if (isAutoplayError(error)) {
          unlocked = false;
          return Promise.resolve(queueFile(fileName));
        }

        return Promise.resolve({
          fileName,
          played: false,
          queued: false,
          reason: "play-failed",
          error
        });
      }
    }

    function unlock() {
      unlocked = true;
      removeUnlockListeners();

      const queued = pendingSounds;
      pendingSounds = [];

      for (const fileName of queued) {
        void playFileNow(fileName);
      }

      return queued.length;
    }

    function handleUnlock() {
      unlock();
    }

    function playRandom(fileNames) {
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        return Promise.resolve({
          fileName: null,
          played: false,
          queued: false,
          reason: "no-sound-files"
        });
      }

      const index = Math.min(
        fileNames.length - 1,
        Math.floor(random() * fileNames.length)
      );
      const fileName = fileNames[index];

      if (!enabled) {
        return Promise.resolve({
          fileName,
          played: false,
          queued: false,
          reason: "disabled"
        });
      }

      if (!unlocked && unlockTarget) {
        return Promise.resolve(queueFile(fileName));
      }

      return playFileNow(fileName);
    }

    function notifyWeatherChange(previousWeather, currentWeather) {
      if (
        typeof currentWeather !== "string" ||
        previousWeather === currentWeather
      ) {
        return {
          event: null,
          playback: null
        };
      }

      if (currentWeather === "Stormy") {
        return {
          event: "storm-start",
          playback: playRandom(STORM_START_SOUNDS)
        };
      }
      if (previousWeather === "Stormy") {
        return {
          event: "storm-end",
          playback: playRandom(STORM_END_SOUNDS)
        };
      }

      return {
        event: null,
        playback: null
      };
    }

    function setEnabled(value) {
      enabled = Boolean(value);

      if (!enabled) {
        pendingSounds = [];
      } else {
        installUnlockListeners();
      }

      return enabled;
    }

    function setVolume(value) {
      if (!Number.isFinite(value)) {
        throw new TypeError("Sound volume must be a finite number.");
      }

      volume = clamp(value, 0, 1);

      for (const audio of activeAudio) {
        audio.volume = volume;
      }

      return volume;
    }

    function stopAll() {
      for (const audio of activeAudio) {
        try {
          if (typeof audio.pause === "function") {
            audio.pause();
          }

          if ("currentTime" in audio) {
            audio.currentTime = 0;
          }
        } catch {
        }
      }

      activeAudio.clear();
    }

    function destroy() {
      removeUnlockListeners();
      stopAll();
      pendingSounds = [];
    }

    function getState() {
      return Object.freeze({
        available: typeof AudioConstructor === "function",
        basePath,
        enabled,
        pendingCount: pendingSounds.length,
        unlocked,
        volume
      });
    }

    installUnlockListeners();

    return Object.freeze({
      destroy,
      getState,
      notifyWeatherChange,
      playRandom,
      playStormEnd: () => playRandom(STORM_END_SOUNDS),
      playStormStart: () => playRandom(STORM_START_SOUNDS),
      setEnabled,
      setVolume,
      stopAll,
      unlock
    });
  }

  function sampleWeatherAtUnixSeconds(unixSeconds) {
    const modelSeconds = unixSeconds - WEATHER_EPOCH_SECONDS;
    const intensity = perlinNoise(modelSeconds * NOISE_SCALE) + 0.5;

    let humidity = Math.pow(
      perlinNoise(modelSeconds * NOISE_SCALE, 123.4567) + 0.5,
      1.35
    );

    if (!Number.isFinite(humidity)) {
      humidity = 0;
    }

    humidity = clamp(humidity);

    return {
      intensity,
      humidity,
      isStorm: intensity >= 0.65 && humidity >= 0.75
    };
  }

  function classifyCurrentWeather(unixSeconds = Date.now() / 1000) {
    const sample = sampleWeatherAtUnixSeconds(unixSeconds);

    if (sample.intensity < 0.2 && sample.humidity < 0.5) {
      return "Clear Skies";
    }

    if (sample.intensity < 0.6 && sample.humidity >= 0.5) {
      return "Cloudy";
    }

    if (sample.intensity < 0.65 || sample.humidity < 0.75) {
      return "Overcast";
    }

    return "Stormy";
  }


  /**
   * Track weather transitions and play the matching cue once per transition.
   */
  function createWeatherSoundMonitor(options = {}) {
    const soundController =
      options.soundController ||
      createSoundController(options.soundOptions || {});
    const playInitialStorm = options.playInitialStorm === true;
    let previousWeather =
      typeof options.initialWeather === "string"
        ? options.initialWeather
        : null;

    function update(unixSeconds = Date.now() / 1000) {
      const currentWeather = classifyCurrentWeather(unixSeconds);
      const oldWeather = previousWeather;
      let notification = {
        event: null,
        playback: null
      };

      if (oldWeather === null) {
        if (playInitialStorm && currentWeather === "Stormy") {
          notification = {
            event: "storm-start",
            playback: soundController.playStormStart()
          };
        }
      } else {
        notification = soundController.notifyWeatherChange(
          oldWeather,
          currentWeather
        );
      }

      previousWeather = currentWeather;

      return {
        currentWeather,
        event: notification.event,
        playback: notification.playback,
        previousWeather: oldWeather
      };
    }

    function reset(weather = null) {
      previousWeather = typeof weather === "string" ? weather : null;
    }

    return Object.freeze({
      getPreviousWeather: () => previousWeather,
      reset,
      soundController,
      update
    });
  }

  function averageHumidity(dayOffset, unixSeconds = Date.now() / 1000) {
    let total = 0;

    for (let hour = 0; hour < 24; hour += 1) {
      const sampleTime = Math.max(unixSeconds + dayOffset * DAY + hour * HOUR, 0);
      let humidity = Math.pow(
        perlinNoise(sampleTime * NOISE_SCALE, 123.4567) + 0.5,
        1.35
      );

      if (!Number.isFinite(humidity)) {
        humidity = 0.5;
      }

      total += humidity;
    }

    return total / 24;
  }

  function averageIntensity(dayOffset, unixSeconds = Date.now() / 1000) {
    let total = 0;

    for (let hour = 0; hour < 24; hour += 1) {
      const sampleTime = Math.max(unixSeconds + dayOffset * DAY + hour * HOUR, 0);
      let intensity = Math.abs(
        Math.sin(
          perlinNoise(sampleTime * NOISE_SCALE * 0.1, 525.2525) *
            Math.PI *
            2
        )
      );

      if (!Number.isFinite(intensity)) {
        intensity = 0.5;
      }

      total += intensity;
    }

    return total / 24;
  }

  function classifyForecastDay(
    dayOffset,
    unixSeconds = Date.now() / 1000,
    random = Math.random
  ) {
    const samples = [];
    let stormMinutes = 0;

    for (let slot = 0; slot < 144; slot += 1) {
      const sampleTime = unixSeconds + dayOffset * DAY + slot * 10 * MINUTE;
      const intensity = perlinNoise(sampleTime * NOISE_SCALE) + 0.5;
      const humidity = Math.pow(
        perlinNoise(sampleTime * NOISE_SCALE, 123.4567) + 0.5,
        1.35
      );

      samples.push({ intensity, humidity });

      if (intensity >= 0.65 && humidity >= 0.75) {
        stormMinutes += 10;
      }
    }

    if (stormMinutes >= 75) {
      return "Lighting Storms";
    }

    const meanIntensity =
      samples.reduce((sum, sample) => sum + sample.intensity, 0) /
      samples.length;
    const meanHumidity =
      samples.reduce((sum, sample) => sum + sample.humidity, 0) /
      samples.length;

    let condition;

    if (meanIntensity < 0.2 && meanHumidity < 0.5) {
      condition = "Clear Skies";
    } else if (meanIntensity < 0.6 && meanHumidity >= 0.5) {
      condition = "Partially Cloudy";
    } else if (
      (meanIntensity >= 0.2 && meanIntensity < 0.65) ||
      meanHumidity < 0.75
    ) {
      condition = "Overcast";
    } else if (meanIntensity >= 0.65 && meanHumidity >= 0.75) {
      condition = "Rainy";
    } else {
      condition = "Clear Skies";
    }
    if (condition === "Overcast" && random() < 0.2) {
      const alternatives = ["Rainy", "Partially Cloudy", "Clear Skies"];
      condition = alternatives[Math.floor(random() * alternatives.length)];
    }

    return condition;
  }

  function findNextStormSeconds(
    unixSeconds = Date.now() / 1000,
    maxHours = 72,
    stepSeconds = 5
  ) {
    const maximumSteps = (maxHours * HOUR) / stepSeconds;

    for (let step = 1; step <= maximumSteps; step += 1) {
      const offsetSeconds = step * stepSeconds;
      const sample = sampleWeatherAtUnixSeconds(unixSeconds + offsetSeconds);

      if (sample.isStorm) {
        return offsetSeconds;
      }
    }

    return null;
  }

  /**
   * Return complete upcoming storm windows.
   *
   * The scan uses the same deterministic five-second weather samples as the
   * original page. A storm window begins when the model crosses into the storm
   * threshold and ends when it leaves that threshold. If the page is opened
   * during an active storm, that already-started storm is skipped so every
   * returned entry is genuinely upcoming.
   */
  function findUpcomingStorms(
    unixSeconds = Date.now() / 1000,
    maxHours = 168,
    maxStorms = 10,
    stepSeconds = 5
  ) {
    if (!Number.isFinite(unixSeconds)) {
      throw new TypeError("unixSeconds must be finite");
    }

    if (maxHours <= 0 || maxStorms <= 0 || stepSeconds <= 0) {
      return [];
    }

    const storms = [];
    const maximumSteps = Math.floor((maxHours * HOUR) / stepSeconds);
    let previousIsStorm = sampleWeatherAtUnixSeconds(unixSeconds).isStorm;
    let stormStart = null;

    for (let step = 1; step <= maximumSteps; step += 1) {
      const sampleTime = unixSeconds + step * stepSeconds;
      const isStorm = sampleWeatherAtUnixSeconds(sampleTime).isStorm;

      if (!previousIsStorm && isStorm) {
        stormStart = sampleTime;
      } else if (previousIsStorm && !isStorm && stormStart !== null) {
        const stormEnd = sampleTime;
        storms.push({
          startUnixSeconds: stormStart,
          endUnixSeconds: stormEnd,
          durationSeconds: Math.max(0, stormEnd - stormStart)
        });
        stormStart = null;

        if (storms.length >= maxStorms) {
          break;
        }
      }

      previousIsStorm = isStorm;
    }

    if (stormStart !== null && storms.length < maxStorms) {
      storms.push({
        startUnixSeconds: stormStart,
        endUnixSeconds: null,
        durationSeconds: null
      });
    }

    return storms;
  }

  function estimateStormDurationSeconds(
    stormStartUnixSeconds,
    maxHours = 12,
    stepSeconds = 5
  ) {
    const maximumSteps = (maxHours * HOUR) / stepSeconds;
    let durationSeconds = 0;

    for (let step = 1; step <= maximumSteps; step += 1) {
      const sample = sampleWeatherAtUnixSeconds(
        stormStartUnixSeconds + step * stepSeconds
      );

      if (!sample.isStorm) {
        break;
      }

      durationSeconds += stepSeconds;
    }

    return durationSeconds;
  }

  function formatDuration(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / HOUR);
    const minutes = Math.floor((safeSeconds % HOUR) / MINUTE);
    const seconds = safeSeconds % MINUTE;

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  function formatHumidity(value) {
    return `~${Math.floor(clamp(value) * 100 + 0.5)}%`;
  }

  function formatIntensity(value) {
    return Math.floor(clamp(value) * 10 + 0.5);
  }

  function startOfLocalDay(date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    );
  }

  function addLocalDays(date, days) {
    const result = startOfLocalDay(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatForecastDay(date, today) {
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    const calendarDate = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });

    if (localDateKey(date) === localDateKey(today)) {
      return `Today — ${weekday}, ${calendarDate}`;
    }

    return `${weekday}, ${calendarDate}`;
  }

  function forecastForLocalDate(date, today, random) {
    const dayStartSeconds = startOfLocalDay(date).getTime() / 1000;
    const todayStartSeconds = startOfLocalDay(today).getTime() / 1000;
    const dayOffset = Math.round((dayStartSeconds - todayStartSeconds) / DAY);

    return {
      date: localDateKey(date),
      day: formatForecastDay(date, today),
      weekday: date.toLocaleDateString(undefined, { weekday: "long" }),
      dayOffset,
      condition: classifyForecastDay(0, dayStartSeconds, random),
      intensity: averageIntensity(0, dayStartSeconds),
      humidity: averageHumidity(0, dayStartSeconds)
    };
  }

  function generateWeeklyForecast(
    now = new Date(),
    random = Math.random
  ) {
    const today = startOfLocalDay(now);
    const forecast = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      forecast.push(
        forecastForLocalDate(addLocalDays(today, dayOffset), today, random)
      );
    }

    const overcastIndexes = forecast
      .map((entry, index) => entry.condition === "Overcast" ? index : -1)
      .filter((index) => index !== -1);
    if (overcastIndexes.length >= 4) {
      const selectedIndex =
        overcastIndexes[Math.floor(random() * overcastIndexes.length)];
      forecast[selectedIndex].condition =
        random() < 0.5 ? "Partially Cloudy" : "Rainy";
    }

    return forecast;
  }

  function serializeForecast(forecast, now = new Date()) {
    return JSON.stringify({
      version: CACHE_VERSION,
      anchorDate: localDateKey(startOfLocalDay(now)),
      entries: forecast.map((entry) => ({
        date: entry.date,
        condition: entry.condition
      }))
    });
  }

  function parseForecast(serialized, now = new Date()) {
    if (!serialized || !serialized.trim()) {
      return null;
    }

    let payload;

    try {
      payload = JSON.parse(serialized);
    } catch (_error) {
      return null;
    }

    const today = startOfLocalDay(now);
    const expectedAnchor = localDateKey(today);

    if (
      !payload ||
      payload.version !== CACHE_VERSION ||
      payload.anchorDate !== expectedAnchor ||
      !Array.isArray(payload.entries)
    ) {
      return null;
    }

    const conditionByDate = new Map(
      payload.entries.map((entry) => [entry.date, entry.condition])
    );

    const forecast = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addLocalDays(today, dayOffset);
      const dateKey = localDateKey(date);
      const condition = conditionByDate.get(dateKey);

      if (!condition) {
        return null;
      }

      const entry = forecastForLocalDate(date, today, Math.random);
      entry.condition = condition;
      forecast.push(entry);
    }

    return forecast;
  }

  function clearForecastCache(storage) {
    if (!storage) {
      return;
    }

    storage.removeItem(CACHE_DATA_KEY);
    storage.removeItem(CACHE_CREATED_KEY);
    storage.removeItem(CACHE_VERSION_KEY);
  }

  function loadOrGenerateWeeklyForecast(
    storage,
    now = new Date(),
    random = Math.random
  ) {
    if (storage) {
      const cacheVersion = storage.getItem(CACHE_VERSION_KEY);
      const createdAt = Number.parseInt(
        storage.getItem(CACHE_CREATED_KEY) || "0",
        10
      );
      const serialized = storage.getItem(CACHE_DATA_KEY);

      if (
        cacheVersion === CACHE_VERSION &&
        serialized &&
        Number.isFinite(createdAt) &&
        now.getTime() - createdAt < WEEK_MS
      ) {
        const cached = parseForecast(serialized, now);

        if (cached) {
          return { forecast: cached, source: "cache", createdAt };
        }
      }

      // cache cleaner 
      clearForecastCache(storage);
    }

    const forecast = generateWeeklyForecast(now, random);
    const createdAt = now.getTime();

    if (storage) {
      storage.setItem(CACHE_DATA_KEY, serializeForecast(forecast, now));
      storage.setItem(CACHE_CREATED_KEY, String(createdAt));
      storage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }

    return { forecast, source: "generated", createdAt };
  }

  return Object.freeze({
    constants: Object.freeze({
      CACHE_CREATED_KEY,
      CACHE_DATA_KEY,
      CACHE_VERSION,
      CACHE_VERSION_KEY,
      DEFAULT_AUDIO_BASE_PATH,
      DAY,
      HOUR,
      MINUTE,
      NOISE_SCALE,
      STORM_END_SOUNDS,
      STORM_START_SOUNDS,
      WEATHER_EPOCH_SECONDS,
      WEEK_MS
    }),
    averageHumidity,
    averageIntensity,
    classifyCurrentWeather,
    classifyForecastDay,
    clearForecastCache,
    createSoundController,
    createWeatherSoundMonitor,
    estimateStormDurationSeconds,
    findNextStormSeconds,
    findUpcomingStorms,
    formatDuration,
    formatHumidity,
    formatIntensity,
    generateWeeklyForecast,
    loadOrGenerateWeeklyForecast,
    parseForecast,
    perlinNoise,
    sampleWeatherAtUnixSeconds,
    serializeForecast
  });
});
