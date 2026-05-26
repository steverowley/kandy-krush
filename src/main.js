import { Board } from './game/board.js';
import { findMatches, deriveNewSpecials, activationClears, detectCombo, applyCombo } from './game/match.js';
import { applyGravity } from './game/cascade.js';
import { calcScore } from './game/score.js';
import { findAnyValidSwap, hasAnyValidSwap, reshuffle } from './game/hint.js';
import {
  LEVELS,
  getLevel,
  nextLevelId,
  isLastLevel,
  progressTowardObjective,
  starsForLevel,
} from './game/levels.js';
import {
  RUN_LENGTH,
  BOSS_SLOTS,
  getRoguelikeLevel,
  gemsEarned,
  UPGRADES,
  pickUpgradeChoices,
  categoryColor,
  SKILL_TREE,
  ownedSkills,
  RUN_LIVES_BASE,
  ARCHETYPES,
  archetypeFor,
  archetypeCounts,
  synergyStacks,
  CLASSES,
  getClass,
  RELICS,
  pickRelicChoices,
  getRelic,
  MUTATORS,
  isMutatorSlot,
  pickRandomMutator,
  getMutator,
} from './game/roguelike.js';
import {
  renderBoard,
  setScore,
  setScoreOverride,
  clearScoreOverride,
  setBest,
  setStreak,
  flashMessage,
  applyTheme,
  animateSwap,
  animatePop,
  showHintGlow,
  clearHintGlow,
  showAchievement,
  setLevelUI,
  setLevelChip,
  showLevelComplete,
  showLevelFail,
  hideLevelOverlay,
  bumpMoveCounter,
  flashObjectiveDelta,
  showLevelIntro,
  showWelcome,
  showStartMenu,
  hideStartMenu,
  showGoodbye,
  showCascadeBanner,
  popNewSpecial,
  setPowerupCounts,
  setHammerArmed,
  setArmedTool,
  setComboMeter,
  setLuckyCharge,
  showChangelog,
  showUpgradePicker,
  showClassPicker,
  showRelicPicker,
  setRunHud,
  showBossBanner,
  showBossDefeatedBanner,
  showRunSummary,
  showRoguelikeIntro,
  showShop,
  showCrossroadsEvent,
  flashMutatorActivation,
  showSkillTree,
  showRunHistory,
  showClassMastery,
} from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createSettingsUI } from './ui/settings.js';
import { createLevelSelect } from './ui/levelSelect.js';
import { createAchievements } from './ui/achievements.js';
import * as sfx from './audio/sfx.js';
import * as speech from './audio/speech.js';
import * as haptics from './audio/haptics.js';
import {
  spawnFloatingNumber,
  spawnTileSparkles,
  spawnPopSpecks,
  spawnConfetti,
  drawMatchTrails,
  spawnShockwave,
  spawnScreenFlash,
  screenShake,
  spawnStarRain,
  spawnLightningRow,
  spawnBlackHole,
  spawnSnake,
  spawnEater,
  showEaterTelegraph,
  clearEaterTelegraph,
} from './ui/particles.js';
import {
  load as loadSave,
  save as saveSave,
  bumpStreakForToday,
  resetProgress as resetProgressSave,
  getLoadStatus,
  getSaveStatus,
} from './storage/save.js';
import * as telemetry from './telemetry.js';
import * as purchases from './purchases.js';
import * as i18n from './i18n.js';
import { createRng, dailySeed, dailySeedStamp } from './game/rng.js';
import * as bus from './game/event-bus.js';
import { registerRunEffects } from './game/run-effects.js';

const COLS = 6;
const ROWS = 6;
const CANDY_TYPES = 6;

// Reward the player when their score crosses one million in a single
// level / slot — they get an INSTANT WIN and the score field shows the
// infinity symbol. Each subsequent infinite this session shows as
// ∞+1, ∞+2, etc.
const INFINITE_SCORE_THRESHOLD = 1_000_000;

const persistedRaw = loadSave();
const persisted = bumpStreakForToday(persistedRaw);

// 🛟 Save-load diagnostics. If the save was corrupted on boot, log
// the details to the console (so we can spot it in dev) and queue a
// toast for after the start screen is up so the player at least knows
// "we couldn't read your save — we backed it up and started fresh."
const _bootLoadStatus = getLoadStatus();
if (!_bootLoadStatus.ok) {
  // eslint-disable-next-line no-console
  console.error('[save] load failed:', _bootLoadStatus);
  // Defer the user-facing toast — flashMessage / DOM aren't ready at
  // module-eval time. 800ms after boot is enough for the start screen
  // to be up.
  setTimeout(() => {
    const backupNote = _bootLoadStatus.backedUpTo
      ? ' Your previous save was backed up.'
      : '';
    flashMessage(`⚠ Save was corrupted, started fresh.${backupNote}`, 4000);
  }, 800);
}

// 📊 Telemetry boot. Provider stays at 'console' until a real
// analytics provider is picked (see PROJECT_PLAN.md decisions). App
// version is wired up later (it depends on CHANGELOG_ENTRIES which is
// defined further down) — for now the version goes in via setUserProps.
telemetry.init({ provider: 'console' });
telemetry.setUserProps({
  has_run_in_progress: !!persisted.inRoguelikeRun,
  runs_completed: persisted.roguelike?.runsCompleted || 0,
  save_ok: _bootLoadStatus.ok,
  save_version_from: _bootLoadStatus.versionFrom,
});

// 💳 IAP plumbing. No provider wired today — purchases.purchase(sku)
// returns { ok: false, error: 'IAP_NOT_CONFIGURED' }. Grant handlers
// are wired up so the day a provider lands (RevenueCat / native /
// Stripe), `purchases.grantGems(50, 'iap-gem-pack')` already does the
// right thing. Telemetry tracks every grant so we can audit later.
purchases.init(null, {
  grantGems: (n, reason) => {
    if (!state.roguelike) return { ok: false, error: 'NO_ROGUELIKE_STATE' };
    state.roguelike.gems = (state.roguelike.gems || 0) + n;
    persist();
    telemetry.track('grant_gems', { n, reason: reason || null });
    return { ok: true, granted: { kind: 'gems', qty: n } };
  },
  grantPowerup: (kind, n) => {
    const bank = state.levelProgress?.powerupBank;
    if (!bank) return { ok: false, error: 'NO_BANK' };
    bank[kind] = Math.min(20, (bank[kind] || 0) + n);
    persist();
    telemetry.track('grant_powerup', { kind, n });
    return { ok: true, granted: { kind: 'powerup', subkind: kind, qty: n } };
  },
  unlockSkipForLevel: (id) => {
    state.levelProgress = state.levelProgress || {};
    state.levelProgress.skipUnlocked = state.levelProgress.skipUnlocked || {};
    state.levelProgress.skipUnlocked[id] = true;
    persist();
    telemetry.track('grant_level_skip', { level_id: id });
    return { ok: true, granted: { kind: 'skip', level_id: id } };
  },
});
// Daily login gem bonus — fires once per calendar day on first
// boot. Scales gently with streak (5 + streak, capped at 25).
// 🌳 Generous Daily meta doubles the awarded gems.
const isNewLoginDay = persistedRaw.lastPlayedDate !== persisted.lastPlayedDate;
let dailyLoginGems = 0;
if (isNewLoginDay && persisted.roguelike) {
  dailyLoginGems = Math.min(25, 5 + (persisted.streak || 1));
  if (persisted.roguelike.skills && persisted.roguelike.skills['generous-daily']) {
    dailyLoginGems *= 2;
  }
  persisted.roguelike.gems = (persisted.roguelike.gems || 0) + dailyLoginGems;
}

const state = {
  board: new Board(COLS, ROWS, CANDY_TYPES),
  score: 0,
  highScore: persisted.highScore,
  streak: persisted.streak,
  lastPlayedDate: persisted.lastPlayedDate,
  busy: false,
  // Set true when an infinite combo trips. Each cascade loop bails on
  // its next iteration so we don't stall the game.
  cascadeAbort: false,
  // Number of infinite-combo auto-wins triggered this session. First
  // shows as "∞", second as "∞+1", third as "∞+2", etc.
  infiniteCount: 0,
  // When set, overrides the displayed score string (e.g. on infinity
  // auto-win). Cleared on slot / level start.
  scoreOverride: null,
  selected: null,
  settings: { ...persisted.settings },
  levelProgress: { ...persisted.levelProgress },
  level: null,
  movesRemaining: 0,
  progress: {
    type: {},
    matches: 0,
    specials: 0,
    jellyRemaining: 0,
    jellyTotal: 0,
    ingredientsTotal: 0,
    ingredientsDropped: 0,
  },
  jellyMap: new Map(),
  lockMap: new Map(),
  // 🪨 Grumblock — a wandering enemy that locks its current tile. Set
  // of "c,r" keys. Moves every few swaps; gone when adjacent matches
  // break it.
  grumblockSet: new Set(),
  resolved: false,
  almostFired: false,
  seenWelcome: persisted.seenWelcome,
  seenRoguelikeIntro: !!persisted.seenRoguelikeIntro,
  seenVersion: persisted.seenVersion,
  installPromptDismissedAt: persisted.installPromptDismissedAt || 0,
  armedTool: null,
  luckyCharge: 0,
  luckyReady: false,
  luckyMode: false,
  luckyModeRemaining: 0,
  comboLevel: 0,
  // Roguelike run state — currentSlot mirrors levelProgress.roguelike but
  // we also track whether the level we're playing is part of an active run.
  roguelike: persisted.roguelike || {
    currentSlot: 1, gems: 0, runsCompleted: 0, runsStarted: 0, bestSlot: 0,
  },
  inRoguelikeRun: !!persisted.inRoguelikeRun,
  // Upgrades + relics survive page reloads, restored from save.
  runUpgrades: Array.isArray(persisted.runUpgrades) ? persisted.runUpgrades.slice() : [],
  runRelics: Array.isArray(persisted.runRelics) ? persisted.runRelics.slice() : [],
  // 🌅 Daily-seed tracking (Phase B1). Per-day best-slot the player
  // reached in today's daily — surfaces on the start screen.
  dailySeedDate: persisted.dailySeedDate || null,
  dailySeedBestSlot: persisted.dailySeedBestSlot || 0,
  // 📓 Last 20 runs, most recent first. Updated in recordRunHistory().
  runHistory: Array.isArray(persisted.runHistory) ? persisted.runHistory.slice(0, 20) : [],
  // 🔄 Banked free rerolls for the current run (from Reroll Bank meta).
  // Survives reloads mid-run.
  runFreeRerolls: Number(persisted.runFreeRerolls) || 0,
  // 🆙 Ascension state (Phase 17r / D12).
  // ascensionUnlocked = highest ascension reached. ascensionLevel =
  // what the player has selected for the next/current run.
  ascensionUnlocked: Math.max(0, Math.min(3, Number(persisted.ascensionUnlocked) || 0)),
  ascensionLevel: Math.max(0, Math.min(3, Number(persisted.ascensionLevel) || 0)),
  runRng: null,
  runIsDaily: false,
  runDailyStamp: null,
  // Per-slot counters for relic triggers. Reset on slot start.
  slotMatchCount: 0,
  relicSwapCount: 0,
};

function upgradeCount(id) {
  return state.runUpgrades.filter((u) => u === id).length;
}

function hasRelic(id) {
  return state.runRelics && state.runRelics.includes(id);
}

// Bottomless Stomach relic multiplier — used in match + clearType counters.
function bottomlessMulti() {
  let m = hasRelic('bottomless') ? 2 : 1;
  // 🥪 Buffet Day mutator — every match also counts double toward the objective.
  if (hasMutator('buffet-day')) m *= 2;
  return m;
}

function activeMutator() {
  if (!state.inRoguelikeRun) return null;
  return state.slotMutator ? getMutator(state.slotMutator) : null;
}
function hasMutator(id) {
  return state.inRoguelikeRun && state.slotMutator === id;
}

// Class awakening — fires when a class's archetype count crosses
// its threshold. Wanderer awakens at 3+ TOTAL upgrades.
function classAwakened() {
  if (!state.inRoguelikeRun) return false;
  const cls = state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null;
  if (!cls) return false;
  const counts = archetypeCounts(state.runUpgrades || []);
  // ✨ Early Awakening meta — threshold-1
  const earlier = hasMeta('early-awaken') ? 1 : 0;
  if (cls.archetype) return counts[cls.archetype] >= Math.max(1, 2 - earlier);
  return (state.runUpgrades || []).length >= Math.max(2, 3 - earlier);
}
function isClass(id) {
  return state.inRoguelikeRun && state.roguelike?.currentClass === id;
}

function showRunInventory() {
  if (!state.inRoguelikeRun) return;
  const cls = state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null;
  const stats = cls && state.roguelike?.classStats ? state.roguelike.classStats[cls.id] : null;
  showRunSummary({
    outcome: 'in-progress',
    inProgress: true,
    klass: cls,
    slotReached: state.roguelike?.currentSlot || 1,
    totalSlots: RUN_LENGTH,
    gemsEarned: 0,
    totalGems: state.roguelike?.gems || 0,
    bestSlot: state.roguelike?.bestSlot || 0,
    archetypes: ARCHETYPES,
    archCounts: archetypeCounts(state.runUpgrades || []),
    relics: (state.runRelics || []).slice(),
    getRelic,
    awakened: classAwakened(),
    runsCompleted: state.roguelike?.runsCompleted || 0,
    classStats: stats,
    upgradesList: (state.runUpgrades || []).slice(),
    getUpgrade: (id) => UPGRADES.find((u) => u.id === id),
    highlights: state.runHighlights || null,
  });
}

function bumpClassStats(outcome, slotReached) {
  if (!state.roguelike) return;
  const id = state.roguelike.currentClass;
  if (!id) return;
  if (!state.roguelike.classStats) state.roguelike.classStats = {};
  const cur = state.roguelike.classStats[id] || { runs: 0, completes: 0, bestSlot: 0 };
  cur.runs = (cur.runs || 0) + 1;
  if (outcome === 'complete') cur.completes = (cur.completes || 0) + 1;
  cur.bestSlot = Math.max(cur.bestSlot || 0, slotReached);
  state.roguelike.classStats[id] = cur;
}

// Show the mode-picker start menu. Each button switches modes and
// starts the appropriate flow. Called from app boot (when no run is
// in progress) and from the run-summary close on game over.
function openStartMenu(subtitle = null) {
  // 📂 Surface a Resume affordance when there's a persisted roguelike
  // run. The Resume button reuses startRoguelikeRun (which preserves
  // currentSlot when > 1); Abandon ends the run and re-opens the start
  // menu so the player gets a clean Roguelike / Levels / Free Play list.
  const cls = state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null;
  const inProgress = state.inRoguelikeRun
    ? {
        slot: state.roguelike?.currentSlot || 1,
        totalSlots: RUN_LENGTH,
        classIcon: cls?.icon || null,
      }
    : null;
  const todayStamp = dailySeedStamp();
  const dailyStatus = {
    stamp: todayStamp,
    playedToday: state.dailySeedDate === todayStamp,
    bestSlot: state.dailySeedDate === todayStamp ? (state.dailySeedBestSlot || 0) : 0,
  };
  const ascLvl = state.ascensionLevel || 0;
  const ascUnlocked = state.ascensionUnlocked || 0;
  const ascensionInfo = ASCENSION_LEVELS[ascLvl] || ASCENSION_LEVELS[0];
  showStartMenu({
    subtitle,
    version: APP_VERSION,
    runInProgress: inProgress,
    dailyStatus,
    ascension: {
      level: ascLvl,
      unlocked: ascUnlocked,
      label: ascensionInfo.name,
    },
    onAscensionCycle: () => {
      // Cycle through unlocked levels: 0 → 1 → 2 → … → unlocked → 0.
      const next = (ascLvl + 1) > ascUnlocked ? 0 : ascLvl + 1;
      state.ascensionLevel = next;
      persist();
      telemetry.track('ascension_picked', { level: next });
      flashMessage(`${ASCENSION_LEVELS[next].name} — ${ASCENSION_LEVELS[next].desc}`, 2400);
      openStartMenu(subtitle); // re-render with new label
    },
    stats: {
      best: state.highScore || 0,
      runsCompleted: state.roguelike?.runsCompleted || 0,
      gems: state.roguelike?.gems || 0,
    },
    onResume: () => {
      sfx.unlockAudio();
      state.settings.mode = 'roguelike';
      sfx.setMusicMode('roguelike');
      persist();
      playModeTransition('roguelike');
      startRoguelikeRun();
    },
    onAbandon: () => {
      sfx.unlockAudio();
      // endRoguelikeRun shows the run-summary modal which chains into
      // openStartMenu on close — so the player sees their reward
      // breakdown and lands back on a fresh start screen.
      endRoguelikeRun();
    },
    onRoguelike: () => {
      sfx.unlockAudio();
      telemetry.track('mode_picked', { mode: 'roguelike' });
      state.settings.mode = 'roguelike';
      sfx.setMusicMode('roguelike');
      // Clear any prior daily-seed flag so a fresh "Roguelike Run"
      // doesn't inherit a seeded rng from the previous session.
      state.runRng = null;
      state.runIsDaily = false;
      persist();
      playModeTransition('roguelike');
      startRoguelikeRun();
    },
    onDaily: () => {
      sfx.unlockAudio();
      telemetry.track('mode_picked', { mode: 'daily' });
      state.settings.mode = 'roguelike';
      sfx.setMusicMode('roguelike');
      persist();
      playModeTransition('roguelike');
      startDailySeedRun();
    },
    onLevels: () => {
      sfx.unlockAudio();
      telemetry.track('mode_picked', { mode: 'levels' });
      state.settings.mode = 'levels';
      sfx.setMusicMode('levels');
      persist();
      playModeTransition('levels');
      startLevel(state.levelProgress.currentLevel || 1);
    },
    onFreePlay: () => {
      sfx.unlockAudio();
      telemetry.track('mode_picked', { mode: 'free' });
      state.settings.mode = 'free';
      sfx.setMusicMode('free');
      persist();
      playModeTransition('free');
      startFreePlay();
    },
    onSettings: () => {
      const btn = document.getElementById('settings-open');
      if (btn) btn.click();
    },
    onHelp: () => {
      // The start-screen button is labeled "📖 What's New" so it should
      // show the changelog, not the tutorial. Tutorial is still reachable
      // via the in-game "?" button in the header.
      showChangelog(CHANGELOG_ENTRIES.slice(0, 5), () => { /* no-op */ });
    },
    onQuit: () => {
      // Web app — we can't truly close the window from script (browsers
      // block it for non-script-opened tabs). Show a goodbye screen and
      // try window.close() best-effort. The "Back to start screen"
      // button lets the player bounce back if they change their mind.
      // If a roguelike run is in flight, forfeit it SILENTLY (award
      // gems for slots reached, clear run state) — we don't want the
      // run-summary modal on top of the goodbye screen.
      if (state.inRoguelikeRun && state.roguelike) {
        const reached = state.roguelike.currentSlot || 1;
        const gems = gemsEarned(reached, false, metaSkills());
        state.roguelike.gems = (state.roguelike.gems || 0) + gems;
        state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, reached);
        state.roguelike.currentSlot = 1;
        state.inRoguelikeRun = false;
        state.runUpgrades = [];
        state.runRelics = [];
        state.roguelike.currentClass = null; state.runFreeRerolls = 0;
        document.body.classList.remove('boss-active', 'boss-final');
      }
      sfx.setMusicEnabled(false);
      persist();
      showGoodbye(() => { openStartMenu(null); });
      try { window.close(); } catch { /* ignore */ }
    },
  });
}

function showEndOfRunSummary(outcome, slotReached, gemsEarnedThisRun) {
  // Snapshot the run state BEFORE the run gets cleared.
  const cls = state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null;
  bumpClassStats(outcome, slotReached);
  const stats = cls && state.roguelike?.classStats ? state.roguelike.classStats[cls.id] : null;
  showRunSummary({
    outcome,
    klass: cls,
    slotReached,
    totalSlots: RUN_LENGTH,
    gemsEarned: gemsEarnedThisRun,
    totalGems: state.roguelike?.gems || 0,
    bestSlot: state.roguelike?.bestSlot || slotReached,
    archetypes: ARCHETYPES,
    archCounts: archetypeCounts(state.runUpgrades || []),
    relics: (state.runRelics || []).slice(),
    getRelic,
    awakened: classAwakened(),
    runsCompleted: state.roguelike?.runsCompleted || 0,
    classStats: stats,
    highlights: state.runHighlights || null,
    onReplay: () => {
      // The run state has already been cleared by the caller (after this
      // function returns it'll be cleared if not already). Kick off a
      // fresh run immediately.
      setTimeout(() => startRoguelikeRun(), 100);
    },
    onClose: () => {
      openStartMenu(outcome === 'complete' ? '🏆 Run complete — pick where to go next.' : 'Run over — pick where to go next.');
    },
  });
}

// Shows the upgrade-picker with optional reroll. Reroll is offered
// only on the first display per slot AND only if the player has a
// Shuffle in their power-up bank to spend.
function showUpgradeChoicesForSlot(n, canReroll) {
  const choices = pickUpgradeChoices(state.runUpgrades, n, runRng());
  const counts = archetypeCounts(state.runUpgrades);
  const bank = powerupBank();
  // 🐘 Elephant Memory relic — all rerolls free + repeatable.
  // 🔄 Free First Reroll meta — first reroll per slot is free (one shot).
  // 🔄 Reroll Bank meta — start each run with 3 free rerolls in your pocket.
  const eleMemory = hasRelic('free-reroll');
  const firstFreeMeta = hasMeta('free-reroll-1') && canReroll && !state.firstRerollUsed;
  const bankedReroll = canReroll && (state.runFreeRerolls || 0) > 0;
  const free = eleMemory || firstFreeMeta || bankedReroll;
  const rerollAllowed = canReroll && (free || (bank.shuffle || 0) > 0);
  const onReroll = rerollAllowed ? () => {
    if (!free) {
      const b = powerupBank();
      if ((b.shuffle || 0) > 0) {
        b.shuffle--;
        setPowerupCounts(b);
        persist();
      }
    } else if (firstFreeMeta) {
      state.firstRerollUsed = true;
    } else if (bankedReroll) {
      state.runFreeRerolls = Math.max(0, (state.runFreeRerolls || 0) - 1);
      persist();
    }
    const flashStr = eleMemory
      ? '🐘 Free reroll!'
      : firstFreeMeta
        ? '🔄 Free reroll!'
        : bankedReroll
          ? `🔄 Bank reroll! (${state.runFreeRerolls} left)`
          : '🔄 Rerolled!';
    flashMessage(flashStr, 900);
    showUpgradeChoicesForSlot(n, eleMemory); // Elephant keeps button alive
  } : null;
  // Build awakening info so the picker can flag any card whose pick
  // would awaken the current class.
  const cls = state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null;
  const earlier = hasMeta('early-awaken') ? 1 : 0;
  const awakenInfo = cls
    ? {
        alreadyAwakened: classAwakened(),
        archetype: cls.archetype || null,
        anyUpgrade: !cls.archetype, // Wanderer awakens on TOTAL upgrades
        totalCount: (state.runUpgrades || []).length,
        threshold: cls.archetype ? Math.max(1, 2 - earlier) : Math.max(2, 3 - earlier),
      }
    : null;
  showUpgradePicker(choices, state.runUpgrades, (chosen) => {
    state.runUpgrades.push(chosen.id);
    const arch = archetypeFor(chosen.id);
    const willStack = arch ? (counts[arch] || 0) + 1 : 0;
    const synergyTag = willStack >= 2 && ARCHETYPES[arch]
      ? ` (${ARCHETYPES[arch].icon} ${ARCHETYPES[arch].name} ×${willStack})` : '';
    // Was this the awakening pick?
    const wasAwakened = awakenInfo && !awakenInfo.alreadyAwakened && classAwakened();
    flashMessage(`Picked: ${chosen.name}${synergyTag}${wasAwakened ? ' · ✨ AWAKENED!' : ''}`, 1600);
    speech.speak(`Picked ${chosen.name}${wasAwakened ? '. Awakened!' : ''}`);
    spawnConfetti(wasAwakened ? 50 : 20);
    if (wasAwakened) spawnStarRain(20);
    haptics.specialBirth();
    persist();
    refreshRunHud();
    setTimeout(() => playRoguelikeSlot(state.roguelike.currentSlot), 250);
  }, categoryColor, ARCHETYPES, counts, onReroll, awakenInfo);
}

const CROSSROADS_SLOT_LIST = [27, 47, 77, 87];

function nextMilestoneAhead() {
  if (!state.inRoguelikeRun) return null;
  const slot = state.roguelike?.currentSlot || 1;
  // Next boss = next multiple of 10 strictly after current slot.
  let nextBoss = Math.ceil((slot + 0.0001) / 10) * 10;
  if (nextBoss > RUN_LENGTH) nextBoss = -1;
  // Next mutator = next slot > current that's a mutator slot.
  let nextMut = slot + 1;
  while (nextMut <= RUN_LENGTH && !isMutatorSlot(nextMut)) nextMut++;
  if (nextMut > RUN_LENGTH) nextMut = -1;
  // Next crossroads triggers AFTER a crossroads slot is finished, so the
  // event hits the start of slot+1. Find the next slot > current where
  // (slot - 1) is a crossroads slot.
  let nextCross = -1;
  for (const c of CROSSROADS_SLOT_LIST) {
    const eventSlot = c + 1; // event fires before playing slot c+1
    if (eventSlot > slot && (nextCross === -1 || eventSlot < nextCross)) nextCross = eventSlot;
  }
  const bossDist = nextBoss > 0 ? nextBoss - slot : 999;
  const mutDist = nextMut > 0 ? nextMut - slot : 999;
  const crossDist = nextCross > 0 ? nextCross - slot : 999;
  const minDist = Math.min(bossDist, mutDist, crossDist);
  if (minDist === 999) return null;
  if (minDist === crossDist) {
    return { icon: '✨', label: 'Crossroads', distance: crossDist === 1 ? '1 slot' : `${crossDist} slots` };
  }
  if (minDist === bossDist) {
    return { icon: '⚔', label: nextBoss === RUN_LENGTH ? 'FINAL BOSS' : 'Boss', distance: bossDist === 1 ? '1 slot' : `${bossDist} slots` };
  }
  return { icon: '🌪', label: 'Mutator', distance: mutDist === 1 ? '1 slot' : `${mutDist} slots` };
}

function refreshRunHud() {
  setRunHud({
    visible: !!state.inRoguelikeRun,
    klass: state.roguelike?.currentClass ? getClass(state.roguelike.currentClass) : null,
    archCounts: archetypeCounts(state.runUpgrades || []),
    archetypes: ARCHETYPES,
    relics: state.runRelics || [],
    getRelic,
    slot: state.roguelike?.currentSlot,
    totalSlots: RUN_LENGTH,
    mutator: activeMutator(),
    awakened: classAwakened(),
    nextMilestone: nextMilestoneAhead(),
  });
}

// Counters for upgrades that trigger on a schedule. Reset per slot.
let lightningCounter = 0;
let eaterCounter = 0;
let eaterPendingColumn = -1;
const EATER_FROM_SLOT = 9;
const EATER_EVERY_MOVES = 5;
const EATER_BITE = 3;
function resetAbilityCounters() {
  lightningCounter = 0;
  eaterCounter = 0;
  eaterPendingColumn = -1;
  clearEaterTelegraph();
}

function pickEaterColumn() {
  if (!state.board) return -1;
  const cols = [];
  for (let c = 0; c < state.board.cols; c++) {
    for (let r = 0; r < EATER_BITE; r++) {
      if (!state.board.isIngredient(c, r) && (state.lockMap.get(`${c},${r}`) || 0) === 0) {
        cols.push(c);
        break;
      }
    }
  }
  if (cols.length === 0) return -1;
  return cols[Math.floor(Math.random() * cols.length)];
}

async function fireEater() {
  if (!state.board) return;
  const col = eaterPendingColumn >= 0 ? eaterPendingColumn : pickEaterColumn();
  eaterPendingColumn = -1;
  clearEaterTelegraph();
  if (col < 0) return;
  // At slot 90+ a second eater also fires from a different column.
  const slot = state.level && state.level.runSlot;
  const cols = [col];
  if (slot >= 90) {
    let col2 = pickEaterColumn();
    if (col2 < 0 || col2 === col) col2 = (col + 2) % state.board.cols;
    cols.push(col2);
  }
  const positions = [];
  for (const c of cols) {
    for (let r = 0; r < EATER_BITE && r < state.board.rows; r++) {
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      positions.push({ c, r });
    }
    spawnEater(c, EATER_BITE);
  }
  flashMessage(cols.length > 1 ? '🦷🦷 DOUBLE EATER!' : '🦷 THE EATER!', 1600);
  speech.speak(cols.length > 1 ? 'Double eater' : 'The eater');
  sfx.playEaterChomp();
  haptics.epic();
  screenShake(7, 420);
  await delay(820);
  state.board.clear(positions);
  decrementJellyAt(positions);
  renderBoard(state.board, state);
  await delay(220);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
}

function maybeFireEater() {
  if (state.settings.mode !== 'roguelike') return;
  if (!state.level || !state.level.runSlot) return;
  if (state.level.runSlot < EATER_FROM_SLOT) return;
  if (state.level.isBoss) return; // bosses are punishing enough
  if (hasMutator('slow-down')) return; // 🐢 Slow Down mutator
  // Settings: Enemies toggle — disables The Eater entirely.
  if (state.settings && state.settings.enemies === false) return;
  // ❄️ Time Freeze upgrade — Eater paused while Lucky-MODE active.
  if (state.luckyMode && upgradeCount('time-freeze') > 0) return;
  eaterCounter++;
  // Eater speeds up in the late game — every 4 moves at slot 75+,
  // every 3 moves at slot 90+. Still telegraphed with the 2-move
  // warning so the player can plan.
  let eaterInterval = EATER_EVERY_MOVES;
  const slot = state.level.runSlot;
  if (slot >= 90) eaterInterval = 3;
  else if (slot >= 75) eaterInterval = 4;
  // 👅 Tongue Tie upgrade — slow the Eater by +1 move per stack.
  if (state.inRoguelikeRun) eaterInterval += upgradeCount('tongue-tie');
  const movesUntilFire = eaterInterval - eaterCounter;
  // Telegraph window: pick the column 2 moves early and show a warning
  // arrow above it each remaining turn (Slay-the-Spire intent reads).
  if (movesUntilFire === 2) {
    eaterPendingColumn = pickEaterColumn();
    if (eaterPendingColumn >= 0) {
      showEaterTelegraph(eaterPendingColumn, movesUntilFire);
      flashMessage('🦷 The Eater is coming…', 1400);
      speech.speak('The eater is coming');
    }
  } else if (movesUntilFire === 1 && eaterPendingColumn >= 0) {
    showEaterTelegraph(eaterPendingColumn, 1);
    flashMessage('🦷 The Eater is HERE next turn!', 1400);
  } else if (movesUntilFire <= 0) {
    eaterCounter = 0;
    setTimeout(() => fireEater(), 400);
  }
}

// ---------- Grumblock — a wandering enemy ----------
// Appears at slot 50+ (non-boss). Each grumblock locks one tile so
// the player can't match it. Every few swaps, it picks a random
// adjacent tile and moves there. Cleared by adjacent matches.
const GRUMBLOCK_SLOT_MIN = 50;
const GRUMBLOCK_MOVE_EVERY = 4;
let grumblockCounter = 0;

function spawnGrumblock() {
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      const key = `${c},${r}`;
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(key) || 0) > 0) continue;
      if (state.grumblockSet.has(key)) continue;
      candidates.push({ c, r });
    }
  }
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const key = `${pick.c},${pick.r}`;
  state.grumblockSet.add(key);
  state.lockMap.set(key, 1);
  renderBoard(state.board, state);
}

function moveGrumblocks() {
  if (state.grumblockSet.size === 0) return;
  const toMove = [...state.grumblockSet];
  for (const key of toMove) {
    if (!state.grumblockSet.has(key)) continue;
    const [c, r] = key.split(',').map(Number);
    const neighbours = [];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= state.board.cols) continue;
      if (nr < 0 || nr >= state.board.rows) continue;
      const nkey = `${nc},${nr}`;
      if (state.grumblockSet.has(nkey)) continue;
      if (state.board.isIngredient(nc, nr)) continue;
      if ((state.lockMap.get(nkey) || 0) > 0) continue;
      neighbours.push({ c: nc, r: nr });
    }
    if (neighbours.length === 0) continue;
    const target = neighbours[Math.floor(Math.random() * neighbours.length)];
    state.grumblockSet.delete(key);
    state.lockMap.delete(key);
    const nkey = `${target.c},${target.r}`;
    state.grumblockSet.add(nkey);
    state.lockMap.set(nkey, 1);
  }
  flashMessage('🪨 Grumblock shuffles…', 900);
  renderBoard(state.board, state);
}

function maybeMoveGrumblocks() {
  if (state.grumblockSet.size === 0) return;
  grumblockCounter++;
  if (grumblockCounter >= GRUMBLOCK_MOVE_EVERY) {
    grumblockCounter = 0;
    moveGrumblocks();
  }
}

// Sweep grumblockSet to keep it in sync with lockMap. Any grumblock
// whose lock has dropped to 0 (broken by an adjacent match) is
// removed from the set.
function syncGrumblocks() {
  if (state.grumblockSet.size === 0) return;
  const dead = [];
  for (const key of state.grumblockSet) {
    if (!state.lockMap.has(key) || (state.lockMap.get(key) || 0) <= 0) {
      dead.push(key);
    }
  }
  for (const key of dead) {
    state.grumblockSet.delete(key);
    state.lockMap.delete(key);
  }
  if (dead.length > 0) {
    flashMessage(`🪨 Grumblock smashed! (-${dead.length})`, 1000);
  }
}

// 🌪 Wild-archetype ability scoring helper. Lightning / Bee Storm /
// Meteor used to clear tiles for FREE (no score, only cascade matches
// below them scored). The gameplay review flagged this as the reason
// Wild builds (Stormbringer / Comet / Crazy Cat) are non-viable —
// abilities don't scale with your score multipliers, so a pure-Wild
// build has nothing to scale UP.
//
// Now: each Wild ability awards score for its direct clears, using the
// same calcScore + applyRunScoreMultiplier pipeline that matches use.
// Wild's score competitiveness comes from FREQUENCY of fires (5 + slot
// % 5 with wildSpeedup) — so they're still distinct from Scorer's
// stacking-multiplier strategy.
function awardAbilityScore(positions, { color = '#FF006E', label } = {}) {
  if (!state.inRoguelikeRun) return;
  if (!positions || positions.length === 0) return;
  const base = calcScore(positions, 1);
  const earned = consumeLuckyIfReady(applyRunScoreMultiplier(base, 1, positions.length));
  if (earned <= 0) return;
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`${label ? label + ' ' : ''}+${earned.toLocaleString()}`, positions, { color });
  maybeTriggerInfiniteScore();
  achievements.onScore(state.score);
}

async function fireLightning() {
  if (!state.board) return;
  const r = Math.floor(Math.random() * state.board.rows);
  // 🌪 Stormbringer AWAKENING — cross-shaped lightning blast: row + column.
  const crossBlast = isClass('stormbringer') && classAwakened();
  const colHit = crossBlast ? Math.floor(Math.random() * state.board.cols) : -1;
  const positions = [];
  for (let c = 0; c < state.board.cols; c++) {
    if (state.board.isIngredient(c, r)) continue;
    if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
    positions.push({ c, r });
  }
  if (crossBlast) {
    for (let rr = 0; rr < state.board.rows; rr++) {
      if (rr === r) continue;
      if (state.board.isIngredient(colHit, rr)) continue;
      if ((state.lockMap.get(`${colHit},${rr}`) || 0) > 0) continue;
      positions.push({ c: colHit, r: rr });
    }
  }
  if (positions.length === 0) return;
  spawnLightningRow(r);
  flashMessage(crossBlast ? '⚡ CROSS BLAST!' : '⚡ LIGHTNING STRIKE!', 1200);
  speech.speak('Lightning strike');
  sfx.playMatch(positions.length, 2);
  haptics.epic();
  screenShake(6, 320);
  await delay(220);
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  decrementJellyAt(positions);
  awardAbilityScore(positions, { color: '#FFD60A', label: '⚡' });
  renderBoard(state.board, state);
  await delay(140);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  // Cascade any resulting matches
  let result = findMatches(state.board);
  let lvl = 1;
  while (result.positions.length > 0 && !state.cascadeAbort) {
    await processMatchRound(result, lvl, null);
    result = findMatches(state.board);
    lvl++;
  }
}

function maybeTriggerLightning() {
  const stacks = upgradeCount('lightning');
  if (stacks <= 0) return;
  lightningCounter++;
  // Each stack reduces the threshold by 1, minimum every 2 matches.
  // Wild synergy speeds it up further by dividing the threshold.
  let threshold = Math.max(2, 4 - (stacks - 1));
  threshold = Math.max(1, Math.round(threshold / wildSpeedup()));
  if (lightningCounter >= threshold) {
    lightningCounter = 0;
    fireLightning();
  }
}

function maybeTriggerMeteor() {
  const stacks = upgradeCount('meteor');
  if (stacks <= 0) return;
  state.meteorCounter = (state.meteorCounter || 0) + 1;
  let threshold = Math.max(3, 8 - (stacks - 1) * 2);
  threshold = Math.max(2, Math.round(threshold / wildSpeedup()));
  if (state.meteorCounter >= threshold) {
    state.meteorCounter = 0;
    fireMeteor();
  }
}

function maybeTriggerBeeStorm() {
  const stacks = upgradeCount('bee-storm');
  if (stacks <= 0) return;
  state.beeStormCounter = (state.beeStormCounter || 0) + 1;
  let threshold = Math.max(4, 10 - (stacks - 1) * 2);
  threshold = Math.max(3, Math.round(threshold / wildSpeedup()));
  if (state.beeStormCounter >= threshold) {
    state.beeStormCounter = 0;
    fireBeeStorm();
  }
}

async function fireBeeStorm() {
  if (!state.board) return;
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const positions = candidates.slice(0, 6);
  if (positions.length === 0) return;
  flashMessage('🐝 BEE STORM!', 1200);
  speech.speak('Bee storm');
  sfx.playMatch(positions.length, 2);
  haptics.combo();
  // Reuse the existing snake visual for movement flair.
  spawnSnake(positions);
  screenShake(4, 240);
  await delay(420);
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  decrementJellyAt(positions);
  awardAbilityScore(positions, { color: '#fbbf24', label: '🐝' });
  renderBoard(state.board, state);
  await delay(140);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  let result = findMatches(state.board);
  let lvl = 1;
  while (result.positions.length > 0 && !state.cascadeAbort) {
    await processMatchRound(result, lvl, null);
    result = findMatches(state.board);
    lvl++;
  }
}

async function fireMeteor() {
  if (!state.board) return;
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const positions = candidates.slice(0, 3);
  if (positions.length === 0) return;
  flashMessage('☄️ METEOR!', 1100);
  speech.speak('Meteor');
  haptics.epic();
  sfx.playMatch(positions.length, 2);
  screenShake(5, 280);
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  decrementJellyAt(positions);
  awardAbilityScore(positions, { color: '#f97316', label: '☄' });
  renderBoard(state.board, state);
  await delay(120);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  let result = findMatches(state.board);
  let lvl = 1;
  while (result.positions.length > 0 && !state.cascadeAbort) {
    await processMatchRound(result, lvl, null);
    result = findMatches(state.board);
    lvl++;
  }
}

// ---------- Crazy tiles ----------
const CRAZY_KINDS = ['tnt', 'void', 'bolt', 'prism', 'wormhole'];

function pickCrazyKind() {
  // Prism + Wormhole are rare (weight 0.4) compared to the common 3 (weight 1).
  const weights = { tnt: 1, void: 1 + upgradeCount('void-touched'), bolt: 1, prism: 0.4, wormhole: 0.4 };
  let total = 0;
  for (const k of CRAZY_KINDS) total += weights[k] || 1;
  let pick = Math.random() * total;
  for (const k of CRAZY_KINDS) {
    pick -= weights[k] || 1;
    if (pick < 0) return k;
  }
  return 'tnt';
}

function findCrazyHostCell() {
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      const cell = state.board.cell(c, r);
      if (!cell || cell.crazy || cell.special || cell.ingredient) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function spawnCrazyTile(kind) {
  // 🌀 Crazy tiles (void / bolt / prism / TNT / wormhole) are a
  // roguelike-only mechanic — they shouldn't exist in Levels or Free
  // Play. Every upgrade / relic / mutator that triggers a spawn already
  // only fires inside a run, but big-match natural spawns + a few relic
  // hooks reach here from any mode, so gate at the entry point.
  if (!state.inRoguelikeRun) return;
  // Default to a weighted random kind when callers (relics, mutators,
  // upgrade hooks) call spawnCrazyTile() with no argument — without
  // this we'd write cell.crazy = undefined and leave a dud tile.
  if (!kind) kind = pickCrazyKind();
  const target = findCrazyHostCell();
  if (!target) return;
  const cell = state.board.cell(target.c, target.r);
  cell.crazy = kind;
  renderBoard(state.board, state);
  spawnTileSparkles(target.c, target.r, 14, { color: '#FF006E' });
  const labels = { tnt: 'TNT', void: 'Void', bolt: 'Bolt', prism: '🌈 Prism', wormhole: '🕳 Wormhole' };
  flashMessage(`${labels[kind]} appeared! Pop it!`, 1500);
  haptics.specialBirth();
}

function maybeSpawnCrazyOnMatch(matchSize, cascadeLevel) {
  // Roguelike-only — spawnCrazyTile is also gated, but bail early here
  // so we don't even roll the chance outside a run.
  if (!state.inRoguelikeRun) return;
  let chance = 0;
  if (matchSize >= 5) chance += 0.18;
  if (matchSize >= 6) chance += 0.14;
  if (cascadeLevel >= 3) chance += 0.10;
  if (cascadeLevel >= 5) chance += 0.10;
  // 💫 Crazy Sense meta — boost spawn chance by 50%.
  if (hasMeta('crazy-sense')) chance *= 1.5;
  if (chance <= 0) return;
  if (Math.random() > chance) return;
  spawnCrazyTile(pickCrazyKind());
}

async function triggerCrazyEffect(pos, kind) {
  let positions = [];
  if (kind === 'tnt') {
    const rad = tntRadius();
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const c = pos.c + dc, r = pos.r + dr;
        if (c < 0 || c >= state.board.cols) continue;
        if (r < 0 || r >= state.board.rows) continue;
        if (state.board.isIngredient(c, r)) continue;
        positions.push({ c, r });
      }
    }
    flashMessage(rad >= 2 ? `💣 MEGA BOOM! ×${rad}` : '💣 BOOM!', 1300);
    // Chain Bomb upgrade — chance to spawn another TNT in the blast zone.
    if (upgradeCount('chain-bomb') > 0) {
      const chance = Math.min(0.9, 0.3 * upgradeCount('chain-bomb'));
      if (Math.random() < chance && positions.length > 0) {
        const seed = positions[Math.floor(Math.random() * positions.length)];
        setTimeout(() => {
          const cell = state.board && state.board.cell(seed.c, seed.r);
          if (cell) {
            cell.crazy = 'tnt';
            renderBoard(state.board, state);
            flashMessage('💣 CHAIN BOMB!', 800);
          }
        }, 350);
      }
    }
    // 💣 Bombardier AWAKENING — TNT pop also grants a random power-up.
    if (isClass('bombardier') && classAwakened()) {
      const bank = powerupBank();
      const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
      const pickP = pool[Math.floor(Math.random() * pool.length)];
      if ((bank[pickP] || 0) < effectivePowerupCap(pickP)) {
        bank[pickP] = (bank[pickP] || 0) + 1;
        setPowerupCounts(bank);
        flashMessage(`🎁 +1 ${pickP}!`, 900);
      }
    }
    // 💧 Bomb Splash upgrade — TNT pop also fills Lucky bar +15% per stack.
    if (upgradeCount('bomb-splash') > 0) {
      const fill = 15 * upgradeCount('bomb-splash');
      state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + fill);
      if (state.luckyCharge >= 100) state.luckyReady = true;
      setLuckyCharge(state.luckyCharge, state.luckyReady);
    }
    // 💣 Bomb Squad relic — TNT pop also grants a random power-up.
    if (hasRelic('bomb-squad')) {
      const bank = powerupBank();
      const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
      const pickP = pool[Math.floor(Math.random() * pool.length)];
      if ((bank[pickP] || 0) < effectivePowerupCap(pickP)) {
        bank[pickP] = (bank[pickP] || 0) + 1;
        setPowerupCounts(bank);
        flashMessage(`💣 Bomb Squad! +1 ${pickP}`, 900);
      }
    }
    speech.speak('Boom!');
    sfx.playMatch(positions.length, 2);
    haptics.epic();
    spawnConfetti(48);
    screenShake(8, 420);
  } else if (kind === 'void') {
    const candidates = [];
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        if (state.board.isIngredient(c, r)) continue;
        if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
        candidates.push({ c, r });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    positions = candidates.slice(0, 8);
    flashMessage('🌀 VOID', 1500);
    speech.speak('Void!');
    haptics.combo();
    spawnBlackHole(positions);
    await delay(700);
  } else if (kind === 'bolt') {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.isIngredient(c, pos.r)) continue;
      positions.push({ c, r: pos.r });
    }
    for (let r = 0; r < state.board.rows; r++) {
      if (r === pos.r) continue;
      if (state.board.isIngredient(pos.c, r)) continue;
      positions.push({ c: pos.c, r });
    }
    flashMessage('⚡ ZAP!', 1300);
    speech.speak('Zap!');
    sfx.playMatch(positions.length, 2);
    haptics.epic();
    spawnLightningRow(pos.r);
    screenShake(6, 320);
    await delay(220);
  } else if (kind === 'wormhole') {
    // 🕳 Wormhole — sucks in the 8 surrounding tiles AND spawns a new
    // random crazy tile somewhere else on the board, so the pop both
    // clears + plants chaos. Replaces the old "swap two random tiles"
    // behavior, which read as "the tile did nothing" since the visual
    // outcome was invisible on a board full of distant changes.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const c = pos.c + dc;
        const r = pos.r + dr;
        if (c < 0 || c >= state.board.cols) continue;
        if (r < 0 || r >= state.board.rows) continue;
        if (state.board.isIngredient(c, r)) continue;
        positions.push({ c, r });
      }
    }
    flashMessage('🕳 WORMHOLE!', 1300);
    speech.speak('Wormhole');
    haptics.combo();
    spawnConfetti(20);
    screenShake(4, 240);
    // Clear the wormhole tile itself.
    positions.push({ c: pos.c, r: pos.r });
    // After the pop resolves, plant a fresh random crazy tile elsewhere
    // so the wormhole "outputs" something — keeps the chaos flowing.
    setTimeout(() => spawnCrazyTile(), 400);
    await delay(220);
  } else if (kind === 'prism') {
    // 🌈 Prism — clear ALL tiles of one random color across the board.
    // 🔭 Prism Lens relic doubles it: 2 random colors instead of 1.
    const colors = new Set();
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        if (state.board.isIngredient(c, r)) continue;
        const t = state.board.typeAt(c, r);
        if (t != null) colors.add(t);
      }
    }
    const colorList = [...colors];
    const wantedColors = hasRelic('prism-lens') ? 2 : 1;
    const targetColors = new Set();
    while (targetColors.size < wantedColors && colorList.length > 0) {
      const idx = Math.floor(Math.random() * colorList.length);
      targetColors.add(colorList.splice(idx, 1)[0]);
    }
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        if (state.board.isIngredient(c, r)) continue;
        if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
        if (targetColors.has(state.board.typeAt(c, r))) positions.push({ c, r });
      }
    }
    const colorWord = wantedColors === 2 ? 'TWO colors' : 'one color';
    flashMessage(`🌈 PRISM! ${colorWord} cleared (${positions.length} tiles)`, 1800);
    speech.speak('Prism!');
    sfx.playMatch(positions.length, 3);
    haptics.epic();
    spawnConfetti(40);
    spawnScreenFlash('rgba(255, 214, 10, 0.4)');
    screenShake(6, 380);
    await delay(220);
  }
  // 💥 CHAIN REACTION — any OTHER crazy tile inside this blast zone
  // chains and pops too (collect them before clearing so the kind
  // info isn't lost).
  const chainCrazy = [];
  for (const p of positions) {
    if (p.c === pos.c && p.r === pos.r) continue;
    const cellHere = state.board.cell(p.c, p.r);
    if (cellHere && cellHere.crazy) {
      chainCrazy.push({ pos: { c: p.c, r: p.r }, kind: cellHere.crazy });
    }
  }
  if (positions.length > 0) {
    // Always include the crazy's own position so it visually leaves the
    // board after firing (void / prism otherwise leave a dud behind).
    const keys = new Set(positions.map((p) => `${p.c},${p.r}`));
    const ownKey = `${pos.c},${pos.r}`;
    if (!keys.has(ownKey) && !state.board.isIngredient(pos.c, pos.r)) {
      positions.push({ c: pos.c, r: pos.r });
    }
    spawnPopSpecks(positions);
    await animatePop(positions);
    state.board.clear(positions);
    decrementJellyAt(positions);
  }
  renderBoard(state.board, state);
  await delay(160);
  // Fire the chained crazy tiles. They run sequentially for the visual
  // chain-bang feel, before gravity reflows the board.
  for (const { pos: cpos, kind: ckind } of chainCrazy) {
    flashMessage('💥 CHAIN!', 700);
    await triggerCrazyEffect(cpos, ckind);
  }
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  // Small settle delay so the outer cascade loop's findMatches() sees
  // the post-gravity board before continuing. Prevents the occasional
  // "after a crazy tile, matches just sit there" glitch where gravity
  // hadn't fully painted before the next check ran.
  await delay(180);
}

async function fireBlackHole() {
  const stacks = upgradeCount('black-hole');
  if (stacks <= 0) return;
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(5 * stacks, candidates.length);
  const positions = candidates.slice(0, n);
  spawnBlackHole(positions);
  flashMessage('🌀 BLACK HOLE', 1600);
  speech.speak('Black hole');
  haptics.combo();
  await delay(750);
  state.board.clear(positions);
  decrementJellyAt(positions);
  awardAbilityScore(positions, { color: '#a855f7', label: '🌀' });
  renderBoard(state.board, state);
  await delay(160);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
}

function maybeFireSnake() {
  if (upgradeCount('hungry-snake') <= 0) return;
  const path = [];
  const visited = new Set();
  let c = Math.floor(Math.random() * state.board.cols);
  let r = Math.floor(Math.random() * state.board.rows);
  const key0 = `${c},${r}`;
  if (state.board.isIngredient(c, r) || state.lockMap.get(key0) > 0) {
    // try again from a corner
    c = 0; r = 0;
  }
  path.push({ c, r });
  visited.add(`${c},${r}`);
  const targetLen = 4 + upgradeCount('hungry-snake'); // grows with stacks
  while (path.length < targetLen) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let moved = false;
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= state.board.cols || nr < 0 || nr >= state.board.rows) continue;
      const k = `${nc},${nr}`;
      if (visited.has(k)) continue;
      if (state.board.isIngredient(nc, nr)) continue;
      if ((state.lockMap.get(k) || 0) > 0) continue;
      path.push({ c: nc, r: nr });
      visited.add(k);
      c = nc; r = nr;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  if (path.length < 2) return;
  spawnSnake(path);
  flashMessage('🐍 SNAKE FEAST', 1500);
  speech.speak('Snake');
  sfx.playCascade();
  haptics.combo();
  setTimeout(() => {
    state.board.clear(path);
    decrementJellyAt(path);
    awardAbilityScore(path, { color: '#16a34a', label: '🐍' });
    renderBoard(state.board, state);
    setTimeout(() => {
      const fallen = gravityWithIngredients();
      renderBoard(state.board, state, { fallen });
    }, 180);
  }, 900);
}

function metaSkills() {
  return ownedSkills(state.roguelike.skills || {});
}
function hasMeta(id) { return metaSkills().has(id); }

function buyMetaSkill(id) {
  const skill = SKILL_TREE.find((s) => s.id === id);
  if (!skill) return false;
  if (hasMeta(id)) return false;
  if ((state.roguelike.gems || 0) < skill.cost) return false;
  state.roguelike.gems -= skill.cost;
  if (!state.roguelike.skills) state.roguelike.skills = {};
  state.roguelike.skills[id] = true;
  // Bigger Bank — applied inside effectivePowerupCap(): +2 to every
  // per-type cap when this skill is owned.
  persist();
  flashMessage(`Unlocked: ${skill.name}`, 1500);
  speech.speak(`Unlocked ${skill.name}`);
  haptics.specialBirth();
  refreshLevelUI();
  return true;
}

// Effective per-type powerup cap. `kind` is one of hammer / shuffle /
// colorBomb / plusMoves; if omitted, returns the LARGEST cap across
// kinds (defensive fallback for older callers that didn't pass a kind).
function effectivePowerupCap(kind) {
  const computeFor = (k) => {
    let cap = BASE_POWERUP_CAPS[k] || 1;
    // 🏦 Bigger Bank meta-skill — uniform +2 across all stash caps.
    if (hasMeta('bigger-bank')) cap += 2;
    if (state.inRoguelikeRun) {
      const counts = archetypeCounts(state.roguelike?.upgrades || []);
      cap += synergyStacks(counts.sustain);
      // 🧺 Caretaker upgrade — +1 cap per stack.
      cap += upgradeCount('caretaker');
      // 🎉 Power Friday mutator — bank cap doubled this slot.
      if (hasMutator('power-friday')) cap *= 2;
    }
    return cap;
  };
  if (kind) return computeFor(kind);
  // Fallback: max across all kinds (so old code that didn't pass a kind
  // still picks the most permissive cap and doesn't accidentally clamp
  // a colorBomb award to a smaller cap than intended).
  let max = 0;
  for (const k of Object.keys(BASE_POWERUP_CAPS)) {
    max = Math.max(max, computeFor(k));
  }
  return max;
}

function runArchetypeCounts() {
  return archetypeCounts(state.roguelike?.upgrades || []);
}

// Run the queue of visual side-effects that applyRunUpgradesOnSlotStart
// deferred (Black Hole spawn, Storm Caller, mutator banner, etc.).
// Called once the intro card dismisses so the animations are actually
// visible and don't fire under the overlay. Effects fire with a small
// stagger so they don't all step on each other.
function runDeferredSlotEffects() {
  if (!state.deferredSlotFx || state.deferredSlotFx.length === 0) return;
  const fx = state.deferredSlotFx;
  state.deferredSlotFx = [];
  let i = 0;
  for (const f of fx) {
    setTimeout(() => { try { f(); } catch {} }, 200 + i * 250);
    i++;
  }
}

function applyRunUpgradesOnSlotStart() {
  if (!state.inRoguelikeRun) return;
  // Per-slot counter resets.
  state.slotMatchCount = 0;
  state.relicSwapCount = 0;
  // Queue for visual side-effects (mutator banner, eraser meteor,
  // grumblock spawn, etc.). Drained by runDeferredSlotEffects() once
  // the intro card is dismissed so they don't fire under the overlay.
  state.deferredSlotFx = [];
  // Roll the slot mutator. The mutatorsSeen tracker reads this
  // immediately after, via the bus.emit('slot:start') call lower
  // in playRoguelikeSlot — PR #17ax ordered the apply-then-emit
  // sequence so the value is set before the event fires.
  const slot = state.roguelike.currentSlot;
  if (isMutatorSlot(slot)) {
    state.slotMutator = pickRandomMutator(runRng()).id;
  } else {
    state.slotMutator = null;
  }
  // Every per-slot side-effect (moves bumps, gem/life bumps, Lucky-bar
  // fill, power-up grants, lock weakening, deferred meteor, +1-life-
  // at-1-life) now lives as a `bus.on('slot:start', …)` subscriber in
  // src/game/run-effects.js. See PRs #17az/#17ba/#17bb/#17bc. This
  // function only handles the resets + the mutator roll above; the
  // bus subscribers fire immediately after when playRoguelikeSlot
  // emits the slot:start event.
  state.eclipseTick = 0;
  // Reset Ironclad awakening's per-slot free hammer.
  state.ironcladHammerUsed = false;
  // Reset Quick Draw relic's per-slot free power-up.
  state.quickDrawUsed = false;
  // Reset Free Bomb upgrade's per-slot free color bombs.
  state.freeBombsUsed = 0;
  // Reset Buttered Bread upgrade's per-slot emergency revive.
  state.butteredUsed = false;
  // 🌬 Second Wind relic — migrated to bus.on('slot:start', …) in
  // run-effects.js (PR #17bb).
  // 🎁 Generous starter — migrated to bus.on('slot:start', …) in
  // run-effects.js (PR #17be). Reads ctx.slot from the payload.
  // first-free upgrade — fresh first-swap flag.
  state.firstSwapUsed = false;
  // first-free-reroll meta — fresh per slot.
  state.firstRerollUsed = false;
  // meteor counter resets per slot.
  state.meteorCounter = 0;
  // bee storm counter resets per slot.
  state.beeStormCounter = 0;
  // 🪨 Grumblock — wandering enemy, slot 50+ non-boss.
  state.grumblockSet = new Set();
  grumblockCounter = 0;
  const slotN = state.roguelike.currentSlot;
  if (slotN >= GRUMBLOCK_SLOT_MIN && !state.level?.isBoss && state.settings?.enemies !== false) {
    const count = slotN >= 80 ? 2 : 1;
    state.deferredSlotFx.push(() => {
      for (let i = 0; i < count; i++) spawnGrumblock();
      flashMessage(`🪨 Grumblock${count > 1 ? 's' : ''} appears!`, 1400);
    });
  }
  refreshRunHud();
  if (state.slotMutator) {
    const m = activeMutator();
    if (m) {
      state.deferredSlotFx.push(() => {
        flashMutatorActivation();
        flashMessage(`${m.icon} ${m.name} — ${m.desc}`, 2400);
        speech.speak(`${m.name} mutator active.`);
      });
    }
  }
  const bank = powerupBank();
  // Meta: Sweet Start — at slot 1 only
  if (hasMeta('sweet-start') && state.roguelike.currentSlot === 1) {
    bank.hammer = Math.min(effectivePowerupCap('hammer'), (bank.hammer || 0) + 1);
  }
  bank.hammer = Math.min(effectivePowerupCap('hammer'), (bank.hammer || 0) + upgradeCount('hammer+1'));
  bank.hammer = Math.min(effectivePowerupCap('hammer'), (bank.hammer || 0) + upgradeCount('hammer-rain') * 2);
  bank.colorBomb = Math.min(effectivePowerupCap('colorBomb'), (bank.colorBomb || 0) + upgradeCount('slot-bomb'));
  bank.shuffle = Math.min(effectivePowerupCap('shuffle'), (bank.shuffle || 0) + upgradeCount('slot-shuffle'));
  bank.plusMoves = Math.min(effectivePowerupCap('plusMoves'), (bank.plusMoves || 0) + upgradeCount('slot-plus3'));
  setPowerupCounts(bank);
  // Meta: Lucky Soul — Lucky starts at 25%
  if (hasMeta('lucky-soul')) {
    state.luckyCharge = Math.max(state.luckyCharge, 25);
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }
  // Reset ability counters at slot start
  resetAbilityCounters();
  // Trigger Black Hole on slot start, if owned. Deferred until the
  // intro card is dismissed so the animation doesn't run under it.
  if (upgradeCount('black-hole') > 0) {
    state.deferredSlotFx.push(() => fireBlackHole());
  }
  if (upgradeCount('storm-caller') > 0) {
    state.deferredSlotFx.push(() => {
      for (let i = 0; i < upgradeCount('storm-caller'); i++) spawnCrazyTile('bolt');
    });
  }
  // 🍬 Sweet Steady upgrade — slot start: gain +1 random powerup per stack.
  if (upgradeCount('sweet-steady') > 0) {
    const bank2 = powerupBank();
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    for (let i = 0; i < upgradeCount('sweet-steady'); i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if ((bank2[pick] || 0) < effectivePowerupCap(pick)) bank2[pick] = (bank2[pick] || 0) + 1;
    }
    setPowerupCounts(bank2);
  }
  // 🎴 Wild Card upgrade — slot start: spawn 1 random crazy tile per stack.
  if (upgradeCount('wild-card') > 0) {
    state.deferredSlotFx.push(() => {
      for (let i = 0; i < upgradeCount('wild-card'); i++) spawnCrazyTile();
    });
  }
  // 🐝 Sweet Roar upgrade — slot start: fire Bee Storm once per stack.
  if (upgradeCount('sweet-roar') > 0) {
    state.deferredSlotFx.push(() => {
      for (let i = 0; i < upgradeCount('sweet-roar'); i++) fireBeeStorm();
    });
  }
  // 🐝 Bee Tonic upgrade — slot start: Lucky bar +20% per stack.
  if (upgradeCount('bee-tonic') > 0) {
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 20 * upgradeCount('bee-tonic'));
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }
  // 🦴 Iron Tongue relic — at slot start, one random lock loses one level.
  if (hasRelic('iron-tongue')) state.deferredSlotFx.push(() => ironTongueBreak());
  // 🫖 Tea Time relic — slot start: Lucky bar +30%.
  if (hasRelic('tea-time')) {
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 30);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }
  // 🛏 Sweet Cushion relic — slot starts at 1 life: +5 moves and +50% Lucky bar.
  if (hasRelic('sweet-cushion') && state.roguelike?.livesRemaining === 1) {
    state.movesRemaining = (state.movesRemaining || 0) + 5;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 50);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    refreshLevelUI();
    flashMessage('🛏 Sweet Cushion: +5 moves, +50% 🍀', 1400);
  }
  // 🎄 Sweet Wreath relic — slot start: every jelly tile loses 1 level.
  if (hasRelic('sweet-wreath') && state.jellyMap && state.jellyMap.size > 0) {
    const toDelete = [];
    for (const [k, v] of state.jellyMap) {
      if (v <= 1) toDelete.push(k);
      else state.jellyMap.set(k, v - 1);
    }
    for (const k of toDelete) state.jellyMap.delete(k);
    if (state.board) renderBoard(state.board, state);
    flashMessage('🎄 Sweet Wreath: jelly weakened!', 1200);
  }
  // 🗝 Lock-Free Day mutator — clear ALL locks at slot start.
  if (hasMutator('lock-free-day') && state.lockMap && state.lockMap.size > 0) {
    state.lockMap.clear();
    if (state.board) renderBoard(state.board, state);
    flashMessage('🗝 Lock-Free Day: all locks gone!', 1400);
  }
  // ❄️ Frosty Crown relic — slot start: every lock loses 1 level.
  if (hasRelic('frosty-crown') && state.lockMap && state.lockMap.size > 0) {
    const toDelete = [];
    for (const [k, v] of state.lockMap) {
      if (v <= 1) toDelete.push(k);
      else state.lockMap.set(k, v - 1);
    }
    for (const k of toDelete) state.lockMap.delete(k);
    if (state.board) renderBoard(state.board, state);
    flashMessage('❄️ Frosty Crown: locks weakened!', 1200);
  }
}

function maybeFireRelicsOnSwap() {
  if (!state.inRoguelikeRun) return;
  state.relicSwapCount = (state.relicSwapCount || 0) + 1;
  // 🛡 Thunder Foot upgrade — every 8 swaps, +2 moves per stack.
  if (upgradeCount('thunder-foot') > 0 && state.relicSwapCount % 8 === 0) {
    const bonus = 2 * upgradeCount('thunder-foot');
    state.movesRemaining += bonus;
    refreshLevelUI();
    flashMessage(`⚡ Thunder Foot! +${bonus} moves`, 1000);
  }
  // ❄️ Frost upgrade — every 7 swaps, weaken every lock by N levels.
  if (upgradeCount('frost') > 0 && state.relicSwapCount % 7 === 0 && state.lockMap && state.lockMap.size > 0) {
    const drop = upgradeCount('frost');
    const toDelete = [];
    for (const [k, v] of state.lockMap) {
      const next = v - drop;
      if (next <= 0) toDelete.push(k);
      else state.lockMap.set(k, next);
    }
    for (const k of toDelete) state.lockMap.delete(k);
    if (state.board) renderBoard(state.board, state);
    flashMessage('❄️ Frost cracks locks', 1000);
  }
  // 🛠 Sweet Smith relic — every 5 swaps, +1 to the lowest-count power-up.
  if (hasRelic('sweet-smith') && state.relicSwapCount % 5 === 0) {
    const bank = powerupBank();
    let lowestKey = null;
    let lowestCount = Infinity;
    for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
      const n = bank[key] || 0;
      if (n < effectivePowerupCap(key) && n < lowestCount) {
        lowestCount = n;
        lowestKey = key;
      }
    }
    if (lowestKey) {
      bank[lowestKey] = (bank[lowestKey] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🛠 Sweet Smith! +1 ${lowestKey}`, 1000);
    }
  }
  // 🎩 Top Hat relic — every 5 swaps, grant +1 of a random power-up.
  if (hasRelic('top-hat') && state.relicSwapCount % 5 === 0) {
    const bank = powerupBank();
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
      bank[pick] = (bank[pick] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🎩 Top Hat! +1 ${pick}`, 1100);
    }
  }
  // 🎰 Slot Machine relic — 8% chance per swap to spawn a crazy tile.
  if (hasRelic('slot-machine') && Math.random() < 0.08) {
    spawnCrazyTile();
    flashMessage('🎰 Jackpot!', 900);
  }
  // Mutator: 💫 Crazy Rain — a crazy tile every 4 swaps.
  if (hasMutator('crazy-rain') && state.relicSwapCount % 4 === 0) {
    spawnCrazyTile();
    flashMessage('💫 Crazy Rain', 800);
  }
  // 📖 Sweet Spell relic — every 7 swaps, Lucky bar +25%.
  if (hasRelic('sweet-spell') && state.relicSwapCount % 7 === 0) {
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 25);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    flashMessage('📖 Sweet Spell +25% 🍀', 900);
  }
  // 🔋 Power Up relic — every 10 swaps, +1 of every power-up.
  if (hasRelic('power-up') && state.relicSwapCount % 10 === 0) {
    const bank = powerupBank();
    for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
      bank[key] = Math.min(effectivePowerupCap(key), (bank[key] || 0) + 1);
    }
    setPowerupCounts(bank);
    flashMessage('🔋 Power Up! +1 of each', 1100);
  }
  // 🍋 Sour Drop relic — every 13 swaps, Lucky bar +50%.
  if (hasRelic('sour-drop') && state.relicSwapCount % 13 === 0) {
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 50);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    flashMessage('🍋 Sour Drop +50% 🍀', 1000);
  }
}

function ironTongueBreak() {
  if (!state.lockMap || state.lockMap.size === 0) return;
  const keys = [...state.lockMap.keys()];
  const k = keys[Math.floor(Math.random() * keys.length)];
  const lvl = state.lockMap.get(k);
  if (lvl > 1) {
    state.lockMap.set(k, lvl - 1);
  } else {
    state.lockMap.delete(k);
  }
  flashMessage('🦴 Iron Tongue cracks a lock', 1100);
  renderBoard(state.board, state);
}

function applyRunScoreMultiplier(amount, cascadeLevel = 1, matchSize = 0) {
  if (!state.inRoguelikeRun) return amount;
  let m = 1;
  m *= Math.pow(1.25, upgradeCount('score+25'));
  m *= Math.pow(1.05, upgradeCount('greedy-brain'));
  if (cascadeLevel >= 2) m *= Math.pow(1.5, upgradeCount('cascade-king'));
  // ⛔ Combo-streak + big-match used to be unbounded stacks of ×2 each,
  // so a chain-3-size-5 with 3 stacks each landed at ×64 just from
  // those two upgrades. Cap their *effective* stack count at 2 so the
  // max contribution is ×4 — still strong, no longer runaway. Players
  // can still pick the third copy; it just doesn't compound further.
  if (cascadeLevel >= 3) m *= Math.pow(2, Math.min(upgradeCount('combo-streak'), 2));
  if (matchSize >= 5) m *= Math.pow(2, Math.min(upgradeCount('big-match'), 2));
  if (hasMeta('score-sage')) m *= 1.1;
  // Scorer synergy: +15% per Scorer stack beyond the first.
  const scorerSyn = synergyStacks(runArchetypeCounts().scorer);
  if (scorerSyn > 0) m *= 1 + 0.15 * scorerSyn;
  // 🎯 Snowball upgrade — compounding ×1.03 per match per stack.
  // Exponent cap lowered from 60 (max ×5.92) to 40 (max ×3.26) so
  // Snowball stays distinct but doesn't carry the entire Scorer build
  // on its own past the mid-late game.
  if (upgradeCount('snowball') > 0) {
    const exponent = (state.slotMatchCount || 0) * upgradeCount('snowball');
    if (exponent > 0) m *= Math.pow(1.03, Math.min(exponent, 40));
  }
  // 🍰 Sugar Rush relic — first 3 matches of every slot are 3×.
  if (hasRelic('sugar-rush') && (state.slotMatchCount || 0) < 3) m *= 3;
  // 🌹 Crimson Rose relic — first match of every slot is ×5.
  if (hasRelic('crimson-rose') && (state.slotMatchCount || 0) === 0) m *= 5;
  // 👁 Crit Eye meta-skill — first match of every slot is ×1.5.
  if (hasMeta('crit-eye') && (state.slotMatchCount || 0) === 0) m *= 1.5;
  // 🍯 Honey Trap relic — boss slots only: first 3 matches score ×3.
  if (hasRelic('honey-trap') && state.level?.isBoss && (state.slotMatchCount || 0) < 3) m *= 3;
  // 🌅 Sunrise Hour relic — slots 1-10 score ×1.5.
  if (hasRelic('sunrise-hour') && state.level?.runSlot && state.level.runSlot <= 10) m *= 1.5;
  // 🌇 Sunset Hour relic — slots 96-100 score ×2.
  if (hasRelic('sunset-hour') && state.level?.runSlot && state.level.runSlot >= 96) m *= 2;
  // ⛈ Storm Heart relic — at 1 life remaining, all matches score ×2.
  if (hasRelic('storm-heart') && state.roguelike?.livesRemaining === 1) m *= 2;
  // 🧁 Sweet Boost mutator — first 5 matches each score ×2.
  if (hasMutator('sweet-boost') && (state.slotMatchCount || 0) < 5) m *= 2;
  // ⚔️ Big Crit mutator — all cascades (chain ≥2) score ×4.
  if (hasMutator('big-crit') && cascadeLevel >= 2) m *= 4;
  // 💪 Mega Mode mutator — every match scores ×3.
  if (hasMutator('mega-mode')) m *= 3;
  // 🎰 Bonus Round mutator — every match scores ×1.5.
  if (hasMutator('bonus-round')) m *= 1.5;
  // 🍬 Sweet Treat upgrade — 3-tile matches score +25% per stack.
  if (matchSize === 3 && upgradeCount('sweet-treat') > 0) {
    m *= 1 + 0.25 * upgradeCount('sweet-treat');
  }
  // ⚡ Power Surge upgrade — 6+ tile matches score ×2 per stack.
  if (matchSize >= 6 && upgradeCount('power-surge') > 0) {
    m *= Math.pow(2, upgradeCount('power-surge'));
  }
  // 💥 Sweet Crit Day mutator — 5+ tile matches score ×5.
  if (matchSize >= 5 && hasMutator('sweet-crit-day')) m *= 5;
  // 🪞 Mirror Shard relic — 4-in-a-row matches score +50%.
  if (hasRelic('mirror') && matchSize === 4) m *= 1.5;
  // 🪞 Twin Mirror relic — 5+ matches score ×3.
  if (hasRelic('twin-mirror') && matchSize >= 5) m *= 3;
  // 🧠 Big Brain relic — +25% per cascade level past 1.
  if (hasRelic('big-brain') && cascadeLevel >= 2) {
    m *= 1 + 0.25 * (cascadeLevel - 1);
  }
  // Mutator: ☀️ Golden Hour — ×2 across the slot.
  if (hasMutator('golden-hour')) m *= 2;
  // Mutator: 🏆 Big Spender — 5+ matches score ×3.
  if (hasMutator('big-spender') && matchSize >= 5) m *= 3;
  // Mutator: 🦄 Unicorn Day — wild random ×0.5 to ×3 per match.
  if (hasMutator('unicorn')) m *= 0.5 + Math.random() * 2.5;
  // ⚔ Champion AWAKENING — first match per slot scores 5×.
  if (isClass('champion') && classAwakened() && (state.slotMatchCount || 0) === 0) {
    m *= 5;
  }
  let scored = Math.round(amount * m);
  // 🎯 Gold Rush upgrade — +20 flat per stack.
  if (upgradeCount('gold-rush') > 0) scored += 20 * upgradeCount('gold-rush');
  // Mutator: 💎 Diamond Day — flat +100 per match (after multipliers).
  if (hasMutator('diamond-day')) scored += 100;
  // Mutator: 🎊 Confetti Day — flat +50 per match + confetti burst.
  if (hasMutator('confetti-day')) {
    scored += 50;
    spawnConfetti(12);
  }
  // Mutator: 🌨 Snowstorm — flat +10 per cleared tile (matchSize-scaled).
  if (hasMutator('snowstorm') && matchSize > 0) {
    scored += 10 * matchSize;
  }
  return scored;
}

function runLuckyRate() {
  let m = 1;
  for (let i = 0; i < upgradeCount('lucky-fast'); i++) m *= 1.5;
  for (let i = 0; i < upgradeCount('lucky-fast-2'); i++) m *= 2;
  // Lucky synergy: +20% fill per Lucky stack beyond the first.
  const luckySyn = synergyStacks(runArchetypeCounts().lucky);
  if (luckySyn > 0) m *= 1 + 0.2 * luckySyn;
  // 🍀 Lucky Aura meta-skill — +25% Lucky bar fill. Roguelike-only.
  if (state.inRoguelikeRun && hasMeta('lucky-aura')) m *= 1.25;
  // 🍀 Lucky Stream mutator — Lucky bar fills 3× faster this slot.
  if (hasMutator('lucky-stream')) m *= 3;
  return LUCKY_PER_MOVE * m;
}

// Bomber synergy: TNT explosion radius expands by 1 cell per Bomber
// stack beyond the first (1 -> 3x3, 2 -> 5x5, 3 -> 7x7).
function tntRadius() {
  if (!state.inRoguelikeRun) return 1;
  // 💥 Bigger Bomb upgrade — +1 radius per stack on top of bomber synergy.
  return 1 + synergyStacks(runArchetypeCounts().bomber) + upgradeCount('bigger-bomb');
}

// Wild synergy: ability counters trigger 25% faster per Wild stack
// beyond the first. Returns a divisor (e.g. 1.0 normal, 1.5 = 33%
// faster, 2.0 = 50% faster).
function wildSpeedup() {
  if (!state.inRoguelikeRun) return 1;
  let s = 1 + 0.25 * synergyStacks(runArchetypeCounts().wild);
  // 🔮 Spell Power mutator — Wild auto-fire abilities trigger 2× faster this slot.
  if (hasMutator('spell-power')) s *= 2;
  return s;
}

// Changelog — newest entry first. APP_VERSION auto-derives from the
// top entry's id so adding a new entry here is enough to make the
// "What's new" modal re-appear on every player's next visit. No
// manual version bump needed for future releases.
const CHANGELOG_ENTRIES = [
  {
    id: '2026-05-26-17bi',
    items: [
      '🧪 CASCADE MODULE COVERAGE — new `tests/cascade.test.js` exercises `applyGravity`: single-hole + middle-hole + entirely-empty column behavior, no-op when full, fallenCells reporting (only-spawn, fall+spawn, multi-column), candyTypes ceiling, and the critical "shifted tiles keep their cell object" rule so specials don\'t lose their `special` tag when they fall. 10 new tests; 229 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17bh',
    items: [
      '🧪 BOARD MODULE COVERAGE — new `tests/board.test.js` exercises `src/game/board.js`: idx (row-major), inBounds (rejects negatives + overflow), cell/at/typeAt/specialAt accessors (including the "ingredient cells read as null type" rule), set/setType writers, fillNoMatches (verifies no horizontal OR vertical 3-in-a-row at fill time across 10 trials), swap (symmetric), adjacent (4-way only, not diagonal), and clear (with empty-list no-op). 22 new tests; 219 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17bg',
    items: [
      '🧪 ROGUELIKE MODULE COVERAGE — new `tests/roguelike.test.js` exercises the pure utilities in `src/game/roguelike.js`: formatObjectiveHint across every objective kind, isMutatorSlot cadence (every 5th slot, never bosses, never zero/negative), pickRandomMutator determinism with a seeded RNG, getMutator/getRelic/getClass lookups, archetypeFor / archetypeCounts / synergyStacks build-synergy math, pickUpgradeChoices + pickRelicChoices (count, owned-exclusion, determinism), and getRoguelikeLevel\'s slot scaling + endless-mode handoff past slot 100. 30 new tests; 197 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17bf',
    items: [
      '📔 OVERNIGHT RUN SUMMARY — PROJECT_PLAN.md now has a "Tonight\'s autonomous run" appendix listing every PR shipped between #289 and #312 (24 total). The recommended-next-moves list also got reordered: bundler / fonts / native packaging / telemetry-vendor pulled to the top, B6 dropped to follow-ups since the event-driven branches are done. Test count and B6 line refreshed to 167 / 43 migrations.',
    ],
  },
  {
    id: '2026-05-26-17be',
    items: [
      '🎁 GENEROUS STARTER MIGRATED TO THE BUS — the slot-1 "+1 of every power-up" grant (×2 with the powerful-start meta) was the last inline slot-init effect in applyRunUpgradesOnSlotStart. Now a `bus.on(\'slot:start\', …)` subscriber in run-effects.js that reads ctx.slot from the event payload. 3 new tests; 167 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17bd',
    items: [
      '🧹 applyRunUpgradesOnSlotStart CLEANUP — collapsed 30 lines of per-PR migration breadcrumbs into one short summary block. The function is now what it always should have been: per-slot counter resets + mutator roll + per-slot flag resets. Every side effect lives as a `bus.on(\'slot:start\', …)` subscriber in run-effects.js. PROJECT_PLAN.md refreshed: B6 line now reflects 42 inline migrations across #283–#310; B12 test count 136 → 164. No behavioral change. 164 tests pass.',
    ],
  },
  {
    id: '2026-05-26-17bc',
    items: [
      '✏️🗝 ERASER + LOCKPICK MIGRATED — the last two slot-init mutator branches in applyRunUpgradesOnSlotStart moved to `bus.on(\'slot:start\', …)` subscribers in run-effects.js. Eraser queues a meteor onto `deferredSlotFx` so the visual fires after the intro card. Lockpick walks `state.lockMap` and decrements each entry by 1 (level-1 locks disappear). Helpers channel gains `fireMeteor` + `renderBoard`. applyRunUpgradesOnSlotStart is now ~25 lines of pure resets + the mutator roll — exactly what it should be. 6 new tests; 164 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17bb',
    items: [
      '🍀🎁🔨💣🌬 FIVE MORE SLOT-INIT EFFECTS MIGRATED — Lucky Day (fills Lucky bar), Gift Slot (+1 of each power-up), Hammer Storm (+3 hammers), Bomb Cache (+2 color bombs), Second Wind (+1 life at 1 life) all moved from inline branches in applyRunUpgradesOnSlotStart to focused `bus.on(\'slot:start\', …)` subscribers in run-effects.js. applyRunUpgradesOnSlotStart shrinks toward "just the per-slot resets" — the role it should have had all along. 8 new tests; 158 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ba',
    items: [
      '🚶 SLOT-START MOVES BUNDLE MIGRATED — five sources of "+N moves at slot start" (moves+2 upgrade × 2 per stack, mover+3 upgrade × 3 per stack, 🐢 Slow Turtle relic +5, 🌪 Quick Slot mutator +5, 🥪 Long Lunch mutator +10) all moved from inline branches in applyRunUpgradesOnSlotStart to a single bundled `bus.on(\'slot:start\', …)` subscriber in run-effects.js. Bundled because the shape is identical across sources and N-source subscribers would duplicate plumbing without separating concerns. 7 new tests; 150 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17az',
    items: [
      '💝🎰💵 SURPRISE LIFE + BONUS ROUND + BIG MONEY MIGRATED — three slot-init mutators (+1 life, +10 gems with persist, +10 gems without persist) moved from `applyRunUpgradesOnSlotStart` to `bus.on(\'slot:start\', …)` subscribers in run-effects.js. Helpers channel gains `refreshLevelUI`. Possible thanks to the #17ax ordering fix (apply happens BEFORE the bus emit now). 4 new tests; 143 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ay',
    items: [
      '💰 TREASURE SLOT MIGRATED TO THE BUS — the mutator\'s "+5 gems on slot win (+10 with treasure-sense meta)" branch lived inline at the top of advanceRoguelikeAfterWin. Now a `bus.on(\'slot:complete\', …)` subscriber in run-effects.js. Helpers channel gains `hasMeta`. 3 new tests; 139 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ax',
    items: [
      '🐛 BUG FIX — slot:start emitted in the WRONG ORDER. playRoguelikeSlot was emitting `bus.emit(\'slot:start\', …)` BEFORE calling `applyRunUpgradesOnSlotStart()`, which is the function that sets `state.slotMutator`. Net effect: the mutatorsSeen tracker (added in #284) was reading the previous slot\'s mutator (or `null` on the first one), and the run-summary "Mutators encountered" list was effectively empty across every run. Swapped the two calls so the mutator is set before the event fires. 136 tests still pass.',
    ],
  },
  {
    id: '2026-05-26-17aw',
    items: [
      '🧹 CASCADE-1 BLOCK CLEANUP — processMatchRound\'s cascade-1 block was carrying 50 lines of per-PR migration comment trail. Collapsed to a single 6-line summary listing every migrated subscriber + where it lives in run-effects.js. PROJECT_PLAN.md refreshed: B6 line now reflects all 29 inline side-effect migrations (#283–#303); B12 test count 102 → 136. No behavioral change. 136 tests still pass.',
    ],
  },
  {
    id: '2026-05-26-17av',
    items: [
      '🍰💣 SUGAR RUSH FLASH + CRAZY MAGNET MIGRATED — the last two side-effect branches in processMatchRound\'s cascade-1 block moved to `bus.on(\'roguelike:match\', …)` subscribers. Sugar Rush\'s third-match "spent" flash and Crazy Magnet\'s % 3 random crazy-tile spawn now live in run-effects.js. Sugar Rush\'s score multiplier itself stays inline — it\'s a synchronous score function, not a side effect. Helpers channel gains `pickCrazyKind`. 3 new tests; 136 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17au',
    items: [
      '🌀🪞🪙🐞 WHIRLPOOL + CRACKED MIRROR + COIN TOSS + LADYBUG MIGRATED — four more cascade-1 inline branches moved to `bus.on(\'roguelike:match\', …)` subscribers in run-effects.js. Whirlpool (% 10 → 280ms-delayed reshuffle), Cracked Mirror (matchSize ≥ 5 → +20% Lucky), Coin Toss (25% chance per match → random power-up), Lucky Ladybug (% 11 → random power-up). Helpers channel gains `preservingReshuffle`. 7 new tests; 133 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17at',
    items: [
      '🌶💥✨ SPICE BOX + SUGAR CRASH + SPARK STRIKE MIGRATED — three more per-Nth-match effects moved to `bus.on(\'roguelike:match\', …)` subscribers. Spice Box (% 12 → random crazy tile), Sugar Crash (% 14 → TNT), Spark Strike (% 12 → free Lightning). Helpers channel gains `fireLightning`. 4 new tests; 126 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17as',
    items: [
      '🪅👜🍨 PIÑATA + PIXIE POUCH + SUNDAE SATURDAY MIGRATED — three per-Nth-match power-up grants moved to `bus.on(\'roguelike:match\', …)` subscribers in run-effects.js. Piñata (% 5 → random pick), Pixie Pouch (% 18 → +1 each kind, cap-respecting), Sundae Saturday (% 8 → +1 plusMoves, cap-respecting). Same shape as Coin Purse / Diamond Mine from #299. 6 new tests; 122 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ar',
    items: [
      '🚌 NEW BUS EVENT: `roguelike:match` — fires immediately after slotMatchCount is incremented inside processMatchRound\'s cascade-level-1 block. Carries `{ slotMatchCount, cascadeLevel, matchSize }`. Unlocks migration of the entire family of per-Nth-match relics/upgrades (Coin Purse, Diamond Mine, Whirlpool, Piñata, Spice Box, Sugar Crash, Sundae Saturday, Pixie Pouch, Spark Strike) that couldn\'t use the canonical `match` event because that fires before the increment.',
      '👛⛏ COIN PURSE + DIAMOND MINE MIGRATED — first two subscribers on the new event. Coin Purse (every 10 matches → +1 gem with persist) and Diamond Mine (every 6 matches → +1 gem) both moved out of the cascade-1 inline block to `bus.on(\'roguelike:match\', …)` in run-effects.js. 4 new tests; 116 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17aq',
    items: [
      '🍵🍀 BOTTOMLESS CUP + LUCKY MAGNET MIGRATED TO THE BUS — both per-swap (cascade level 1) Lucky-bar effects (Bottomless Cup mutator: +20%/match; Lucky Magnet upgrade: 5%/stack chance to instafill) moved from the `if (cascadeLevel === 1)` block in processMatchRound to `bus.on(\'match\', …)` subscribers in run-effects.js. Both gate on ctx.cascadeLevel === 1 from the match payload. 7 new tests; 112 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ap',
    items: [
      '🛰 ECHO DRONE MIGRATED TO THE BUS — the relic\'s "+10% Lucky bar per special spawned" branch lived as the last roguelike inline in processMatchRound\'s specials region. Now a `bus.on(\'match\', …)` subscriber in run-effects.js. Helpers channel also gains `hasMutator` so the upcoming mutator-event migrations (Bottomless Cup, Diamond Mine, Sweet Tooth, ...) don\'t need to grow the channel each time. 3 new tests; 105 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ao',
    items: [
      '🧹 ROADMAP + DEAD-COMMENT CLEANUP — PROJECT_PLAN.md now reflects the 13 inline-effect migrations completed in this run (B6 line + test count bumped from 52 → 102). processMatchRound\'s migrated-out branches lost their per-PR comment trail in favor of one short pointer per block to src/game/run-effects.js — the noise was useful while migrating, less useful now that the destination is established.',
    ],
  },
  {
    id: '2026-05-26-17an',
    items: [
      '🧁 CONFECTIONERY MIGRATED TO THE BUS — the relic\'s "+1 random power-up per special spawned" branch lived inline in processMatchRound under the specials block; now a `bus.on(\'match\', …)` subscriber in run-effects.js. Helpers channel gains `powerupBank`, `setPowerupCounts`, `effectivePowerupCap`. The `if (specialsCreated.length > 0)` block in processMatchRound is now empty of roguelike branches — pure cleanup of legacy code coming. 4 new tests; 102 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17am',
    items: [
      '💣🌈 BOMB MAKER + PRISM MAKER MIGRATED TO THE BUS — both probabilistic crazy-tile spawners that fire when a special is born (Bomb Maker: 50%×N roll per stack to spawn TNT; Prism Maker: single roll capped at 60% to spawn a Prism) moved from inline branches in processMatchRound to `bus.on(\'match\', …)` subscribers in run-effects.js. 5 new tests; 98 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17al',
    items: [
      '🔥🌊 FURNACE + CASCADE SPLASH MIGRATED TO THE BUS — both cascade-gated crazy-tile spawners (Furnace: cascade ≥3 → 1 TNT per stack; Cascade Splash: cascade ≥2 → 60% chance per stack to spawn a random kind) moved from inline `if (cascadeLevel >= …)` branches in processMatchRound to `bus.on(\'cascade\', …)` subscribers in `run-effects.js`. Helpers channel gains `spawnCrazyTile`. 5 new tests; 93 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ak',
    items: [
      '🌸 CHERRY WAND MIGRATED TO THE BUS — the relic\'s "+25% Lucky bar per special spawned" branch lived in the `if (specialsCreated.length > 0)` block inside processMatchRound. Now a `bus.on(\'match\', …)` subscriber in run-effects.js that reads `ctx.specialsCreated.length` from the match payload, keeping the round-scoped semantics of the inline branch. 4 new tests; 88 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17aj',
    items: [
      '✨🪞 STARDUST + ECHO MATCH MIGRATED TO THE BUS — both cascade-≥4 effects (Stardust relic\'s +1 gem with persist, Echo Match upgrade\'s 50%-per-stack Lucky-bar fill) used to live in the cascade-level inline block in processMatchRound. Now both are `bus.on(\'cascade\', …)` subscribers in `run-effects.js`. Helpers channel gains `upgradeCount` + `persist`. 7 new tests; 84 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ai',
    items: [
      '🌟 GLOW STICK MIGRATED TO THE BUS — the relic\'s cascade-≥6-fills-Lucky branch used to live as an `if (...)` inside processMatchRound; now a `bus.on(\'cascade\', …)` subscriber in `run-effects.js`. First effect to use the new `helpers` injection channel (hasRelic / setLuckyCharge / flashMessage) so run-effects can keep up its no-import-from-main.js rule. 5 new tests; 77 total now pass.',
    ],
  },
  {
    id: '2026-05-26-17ah',
    items: [
      '🧪 BUS INTEGRATION TEST FOR THE RUN LIFECYCLE — new `tests/integration-run-flow.test.js` simulates a complete roguelike slot end-to-end through the event bus (slot:start → match × N → cascade chain → infinite → slot:complete) and asserts the migrated `run-effects.js` subscribers aggregate `state.runHighlights` the same way the old inline branches did. Also covers: 32-mutator cap holds across a 40-slot run, non-roguelike runs do not pollute highlights, single `unsub()` call removes every handler. Catches future B6 bus-migration regressions before they ship. 72 tests pass.',
    ],
  },
  {
    id: '2026-05-25-17ag',
    items: [
      '♾ ENDLESS MODE LABELS READ RIGHT — Resume button used to show "Slot 137 / 100" past slot 100, which was nonsensical. Now it reads "Slot 137 ♾" when the player is past the standard cap. Run-summary modal title gets the same treatment: "You reached slot 137 (Endless)" instead of the cap-comparison.',
    ],
  },
  {
    id: '2026-05-25-17af',
    items: [
      '♾ ENDLESS MODE STATE NO LONGER CLAMPED TO SLOT 100 — `sanitizeRoguelike` clamped `currentSlot` to 100 and `classStats[].bestSlot` to 100; same for `dailySeedBestSlot` and `runHistory[].slot`. With Endless Mode (#272) the player can legitimately reach slot 150+ — those clamps were silently losing the achievement on next reload. Bumped all four to 9999 as the defensive upper bound. 3 new tests; 68 total now pass.',
    ],
  },
  {
    id: '2026-05-25-17ae',
    items: [
      '🚌 INFINITE-COMBO TRACKER MIGRATED TO THE BUS — new `infinite` event on the event bus emitted from `maybeTriggerInfiniteScore`; the run-highlights `infiniteCount` bump moves to a subscriber in `run-effects.js`. Mirrors the slot:start / slot:complete migrations from #284. 65 tests pass.',
    ],
  },
  {
    id: '2026-05-25-17ad',
    items: [
      '🔤 ATKINSON FONT NOW LOADS LOCALLY — dropped the Google Fonts `<link>` + preconnects. styles/main.css now carries a `@font-face` block pointing at `assets/fonts/atkinson-hyperlegible-{regular,bold}.woff2` with `font-display: swap`. New `tools/fetch-fonts.sh` populates the WOFF2 files from the upstream Google Fonts repo (open-source, SIL OFL). If the font binaries aren\'t dropped in yet the font-family chain falls back to system-ui — game stays readable regardless. Removes the last third-party network dependency at boot.',
    ],
  },
  {
    id: '2026-05-25-17ac',
    items: [
      '🚌 TWO MORE EFFECTS MIGRATED TO THE BUS — the per-slot mutator history tracker (`runHighlights.mutatorsSeen`) and the best-slot-score tracker (`runHighlights.bestSlotScore`) used to be inline branches in `applyRunUpgradesOnSlotStart` and `advanceRoguelikeAfterWin`. Both now subscribers on `bus.on(\'slot:start\', …)` and `bus.on(\'slot:complete\', …)` in run-effects.js. 5 new tests; 63 total now pass.',
    ],
  },
  {
    id: '2026-05-25-17ab',
    items: [
      '🚌 FIRST EFFECT MIGRATED TO THE BUS — the per-run highlights tracker (maxCascade / biggestMatch / totalMatches) used to be a 13-line inline branch in the middle of processMatchRound. Now it lives in `src/game/run-effects.js` as a `bus.on(\'match\', …)` subscriber. Sets the pattern for the rest of the B6 migration: pull one inline branch at a time, add a focused test, delete the original. 6 new tests; 58 total now pass.',
    ],
  },
  {
    id: '2026-05-25-17aa',
    items: [
      '🪟 SETTINGS-LAUNCHED MODALS NO LONGER HIDE BEHIND SETTINGS — Skill Tree / Run History / Class Mastery overlays live at z-[58]/[68], but the Settings panel itself was bumped to z-[115] back in 17g (so Settings could overlay the start screen). Result: clicking those Settings entries appeared to do nothing because the modal painted behind Settings. Now each entry closes the Settings panel first, then opens the modal — cleaner UX, one panel at a time.',
    ],
  },
  {
    id: '2026-05-25-17z',
    items: [
      '🧪 `./tests/run.sh` — single short token to run the full test suite. Updates the test README so contributors don\'t have to copy the glob.',
    ],
  },
  {
    id: '2026-05-25-17x',
    items: [
      '🗺 PROJECT_PLAN.md UPDATED — refreshed the roadmap with every PR landed this session. Phase A: 9 / 10 done (A2 Tailwind build step pending). Phase B: 12 / 14. Phase C: 3 / 5. Phase D: 8 / 12. Open product-owner decisions surfaced (bundler, telemetry vendor, native packaging, cloud save backend, privacy policy). Recommended next moves listed in order of leverage.',
    ],
  },
  {
    id: '2026-05-25-17w',
    items: [
      '⚡ FASTER COLD-BOOT — service worker flipped from network-first to cache-first + stale-while-revalidate. Cached responses now return immediately while the network fetch updates the cache in the background. On a slow signal that\'s the difference between "waiting for the round-trip" and "the start screen is already there." Deploys take one extra reload to be seen (normal SW behaviour); offline boot from cold cache still works.',
      '🧪 SHELL HYGIENE TESTS — new `tests/sw-shell.test.js` verifies every entry in the SW SHELL list resolves to a real file on disk (catches typos at PR time) and that no duplicates slipped in. Brings the test count to 52 / 52.',
    ],
  },
  {
    id: '2026-05-25-17v',
    items: [
      '🚌 EVENT BUS — new `src/game/event-bus.js` with on / off / emit / clear. Canonical events emit from the cascade pipeline today (match, cascade, special:birth, swap, slot:start, slot:complete) so future relics / upgrades / boss mechanics can subscribe without editing the 360-line processMatchRound monolith. Bus failures are isolated (one handler throwing doesn\'t kill the others). 9 new tests; 49 total now pass.',
      'Existing inline relic/upgrade branches still run unchanged — the bus is purely additive. Migration is one branch at a time, no big-bang rewrite.',
    ],
  },
  {
    id: '2026-05-25-17u',
    items: [
      '📊 RUN STATS — the run-summary modal now shows 5 stat cards instead of 2: 🔁 Max cascade, 💥 Biggest match, 🎯 Total matches, 🏔 Best slot score, ♾ Infinites. Tracks them through `state.runHighlights`, persisted across reloads. PC-roguelike players love stat-stalking; this is the screen they\'ll screenshot and share.',
    ],
  },
  {
    id: '2026-05-25-17t',
    items: [
      '⌨ KEYBOARD INPUT — Arrow keys (or WASD) move the focus cursor across the board. Space / Enter selects + commits swaps. Esc opens the new Pause overlay (or deselects first if a tile is selected). 1 / 2 / 3 / 4 fire hammer / shuffle / color bomb / +3 moves. H requests a hint. PC-game-on-mobile means actually being playable on a keyboard.',
      '⏸ PAUSE OVERLAY — Esc now opens a proper Pause overlay (▶ Resume / ⚙ Settings / 🏠 Quit to start screen) instead of instantly home-buttoning out of the run. Resume is the default focus so a second Esc gets you back fast.',
    ],
  },
  {
    id: '2026-05-25-17s',
    items: [
      '🏅 CLASS MASTERY — new Settings entry "🏅 Class Mastery" opens a per-class progress grid. Each of the 11 classes shows three tier badges: 🥉 Bronze (cleared slot 10), 🥈 Silver (cleared slot 30), 🥇 Gold (full run completed). Derived from the existing classStats record; no new state required. Encourages cycling through every class instead of one-shotting Champion forever.',
      '📤 NATIVE SHARE ON RUN END — the "📋 Copy summary" button on the run-summary modal now uses the Web Share API first (system share sheet on iOS / Android PWA) and falls back to clipboard copy on desktop. Same payload (class / build / relics / slot / gems) — better target for the share-with-a-friend retention loop.',
    ],
  },
  {
    id: '2026-05-25-17r',
    items: [
      '🆙 ASCENSIONS — clear a roguelike run, unlock Ascension 1. A new "🆙 Ascension: A0 ↕" chip appears under the Roguelike Run button; tap to cycle through unlocked levels before starting your next run. A1 = -1 max life. A2 = A1 + -10% move budget on non-boss slots. A3 = A2 + 25% harder score targets. Beat each ascension to unlock the next. The replay loop the gameplay review flagged as missing.',
    ],
  },
  {
    id: '2026-05-25-17q',
    items: [
      '👋 ONBOARDING TOUR — the first-run roguelike intro used to dump 5 dense cards on the player at once (Class / Upgrades+Synergy / Relics / Mutators / Enemies). Gameplay-review agent flagged this as a D1 churn risk. Now it\'s a stepper: one concept at a time, ← Back / Next → / "Skip — I know how to play" controls + step dots so you can see where you are. Same 5 concepts, far less cognitive load on first contact.',
    ],
  },
  {
    id: '2026-05-25-17p',
    items: [
      '🔓 ENDLESS MODE — new 100💎 skill-tree node. After clearing slot 100 the run KEEPS GOING — slot 101, 102, … with continued scaling. Boss-defeated banner still fires on the Kraken kill; the run only ends when you die. Beat the boss, eat the boss, keep eating bosses.',
      '🔄 REROLL BANK — new 90💎 skill-tree node. Start every run with 3 FREE upgrade rerolls in your pocket, no Shuffle required. Carries between slots; persists across reloads. Toast tells you how many rerolls you have left.',
      'Both are "system unlocks" — the kind of skill-tree pick the gameplay review flagged as missing (Slay-the-Spire Ascensions / Balatro vouchers territory) versus the 21 existing numerical-buff nodes. Best-in-slot end-game purchases.',
    ],
  },
  {
    id: '2026-05-25-17o',
    items: [
      '🎚 PARTICLE CAP — `#particles` was unbounded; a chain-≥5 cascade could stack ~150 absolutely-positioned divs over 1-2s, fighting the main thread on mid-tier Android. New 80-particle ceiling — past that, new spawns evict the oldest particles instead of piling up. The "lots happening" feel is preserved; the worst-case main-thread cost drops by ~45%.',
    ],
  },
  {
    id: '2026-05-25-17n',
    items: [
      '📓 RUN HISTORY — new Settings entry "📓 Run History" opens a modal listing your last 20 roguelike runs (most recent first). Each row shows the date, class, outcome (🏆 WIN or "Slot X/100"), gems earned, final score, and a 🌅 DAILY chip when the run was a daily seed. PC-roguelike players love stat-stalking.',
    ],
  },
  {
    id: '2026-05-25-17m',
    items: [
      '⚡ DIFF-RENDER THE BOARD — `renderBoard()` used to rebuild all 36 tile buttons + 40 SVGs from scratch every call. A chain-10 cascade triggered ~7 full rebuilds, allocating + destroying ~720 DOM nodes in ~5 seconds. Now each call computes a per-cell signature (type, special, crazy, jelly, lock, selected, adjacent, falling, intro) and only repaints cells whose signature changed since the last render. ~95% allocation reduction in the common cascade case. Intro drops + dimension changes still force a full rebuild because the drop animation needs fresh nodes.',
    ],
  },
  {
    id: '2026-05-25-17l',
    items: [
      '🧪 TEST SUITE — new `tests/` directory with 40 tests across 6 files (score, match, rng, i18n, purchases, save). Uses Node\'s built-in `node:test` runner so there are zero new dependencies — run `node --test tests/*.test.js`. Covers the pure-game modules (no DOM required) plus the save round-trip + corruption recovery flow with an in-memory localStorage shim.',
    ],
  },
  {
    id: '2026-05-25-17k',
    items: [
      '👑 BOSSES HAVE KITS NOW — each of the 10 bosses ticks an actual mechanic instead of being a reskinned regular slot. Per-boss tooltips telegraph what to expect.',
      '🟦 BOSS 1 Jelly Guardian regenerates 1 jelly every 4 moves. 🔒 BOSS 2 Lock Tyrant adds a fresh lock every 5 moves. 👑 BOSS 3 Sweet King alternates jelly + lock spawns every 4 moves. 🐌 BOSS 4 Chocolate Snail regenerates jelly every 5 moves. 🪦 BOSS 5 Padlock Pharaoh HARDENS a random lvl-1 lock to lvl-2 every 4 moves. 🐍 BOSS 6 Cherry Hydra has a 50% chance to spawn a fresh cherry at row 0 every time you drop one. 👻 BOSS 7 Echo Wraith HEALS — every non-purple tile cleared reduces your purple progress by 1. 🕸 BOSS 8 Lattice Queen locks a random jelly tile every 6 moves. 🧁 BOSS 9 Confectioner spawns a distraction cherry every 4 moves. 🐙 BOSS 10 Candy Kraken picks a random mechanic every 3 moves.',
    ],
  },
  {
    id: '2026-05-25-17j',
    items: [
      '🌪 WILD ARCHETYPE NOW SCORES — Lightning, Bee Storm, Meteor, Hungry Snake, and Black Hole abilities used to clear tiles for free (no score, only cascade matches below them scored). Wild builds were mathematically punished: a pure Stormbringer / Comet / Crazy Cat run produced more chaos than points. Now every direct ability-clear awards score through the same calcScore + applyRunScoreMultiplier pipeline that regular matches use — Wild becomes a frequency-based scoring archetype distinct from Scorer\'s multiplier-stacking strategy.',
      'Floating numbers from ability scores show with a colored prefix (⚡ ⚒ 🐝 ☄ 🐍 🌀) so you can tell which ability earned which chunk.',
    ],
  },
  {
    id: '2026-05-25-17i',
    items: [
      '🌅 DAILY SEED RUN — new purple "🌅 Today\'s Daily Seed" button on the start screen launches a roguelike run where the upgrade picks, relic choices, and mutators are all seeded from today\'s UTC date. Everyone on the same calendar day gets the same draft. PRs into a leaderboard the day the backend goes up.',
      'Run end records your best slot on today\'s daily — the start-screen button shows "✓ Slot X" when you\'ve already played. Only the first attempt per day counts (Spire / Balatro convention).',
      'Implementation: new `src/game/rng.js` with mulberry32 + `dailySeed()` derived from YYYYMMDD UTC. Pickers (`pickUpgradeChoices`, `pickRelicChoices`, `pickRandomMutator`) accept an optional `rng` param; main.js threads `runRng()` through every call site.',
    ],
  },
  {
    id: '2026-05-25-17h',
    items: [
      '💳 IAP PLUMBING — new `src/purchases.js` provider-agnostic shim. Grant handlers wired today (`grantGems(n)`, `grantPowerup(kind, n)`, `unlockSkipForLevel(id)`) so when a real provider (RevenueCat / native StoreKit / Stripe) is picked, every existing call site already does the right thing. `purchases.purchase(sku)` returns `IAP_NOT_CONFIGURED` until then. Every grant emits a telemetry event for audit.',
      '🌍 i18n PRIMITIVES — new `src/i18n.js` with `t(key, params)` lookup against a dotted dictionary, locale switching, `Intl.NumberFormat`-backed `formatNumber()`. Seed `strings.en.js` with the highest-impact surfaces (start screen, goodbye, save errors). Missing keys render as the key itself for dev visibility. Unblocks LATAM/JP localization without a code sweep.',
    ],
  },
  {
    id: '2026-05-25-17g',
    items: [
      '📲 PWA MANIFEST FILLED OUT — added `id`, `categories: [games, entertainment, puzzle]`, `lang`, `display_override`, separate `any` and `maskable` icon entries (Android launcher was misreading the combined `purpose: "any maskable"`), and three home-screen shortcuts: Roguelike / Levels / Free Play. Long-pressing the installed icon now jumps straight into a mode.',
      '🚀 SHORTCUT URL ACTIONS — appending `?action=roguelike` / `?action=levels` / `?action=free` to the URL skips the start menu and launches that mode directly. Same query the new manifest shortcuts use.',
      '🍎 iOS PWA — `apple-mobile-web-app-status-bar-style` is now `black-translucent` so the game owns the full screen height when installed (was leaving a white status-bar gap on iPhone).',
      '♿ HIGH-CONTRAST PASS — Crossroads, Shop, Relic picker, Class picker, and the Roguelike intro panel now have explicit `body.theme-hc` overrides (was inheriting the global text-white rule on top of their light gradients, leaving titles invisible). Inline archetype `style="color:..."` text inside cards forced to accent yellow on the HC dark background. Disabled-row gray fades flip to `#374151` / `#d4d4d4` so they still read.',
    ],
  },
  {
    id: '2026-05-25-17f',
    items: [
      '🕳 WORMHOLE REDESIGN — old behavior swapped two distant random tiles, which looked like "the wormhole did nothing" to the player. New behavior: sucks in the 8 surrounding cells AND spawns a new random crazy tile somewhere else on the board. Now the pop both clears and plants chaos — distinctly "wormhole".',
      '⚖ SCORER DOMINANCE PASS — combo-streak and big-match upgrades effectively cap at 2 stacks each (was unbounded), so chain-3-size-5 builds can\'t spiral into ×64 from those two alone. Snowball exponent cap lowered from 60 (×5.92 max standalone) to 40 (×3.26 max). Scorer is still the strongest archetype; it no longer mathematically punishes everyone else.',
    ],
  },
  {
    id: '2026-05-25-17e',
    items: [
      '▶ RESUME RUN — when you have a roguelike run in progress, the start screen now shows a green "▶ Resume <class> Run · Slot X / 100" button at the top so it\'s obvious you can pick it back up. PC-game-on-mobile framing: close the tab anywhere, come back, hit Resume, you\'re back at the slot you left.',
      '⨯ ABANDON CURRENT RUN — small link under the mode buttons. Ends the run cleanly (awards gems for slots reached) and unhides the regular "⚔ Roguelike Run" entry so you can start fresh. The "⚔ Roguelike Run" button is hidden while a run is in flight to remove the "wait, will this overwrite my run?" ambiguity.',
    ],
  },
  {
    id: '2026-05-25-17d',
    items: [
      '📊 TELEMETRY SCAFFOLDING — new `src/telemetry.js` provider-agnostic event sink. Emits `boot / mode_picked / run_start / slot_complete / run_end / infinite_combo` to console.debug today; flipping the provider to `beacon` with a URL ships them to a real analytics endpoint with zero code changes elsewhere. Anonymous device id (uuid in localStorage) + per-tab session id, no PII.',
      '🚑 WINDOW-LEVEL ERROR REPORTING — `window.error` and `unhandledrejection` are captured along with the last 10 telemetry events as breadcrumbs, so when the analytics provider is hooked up we get crash reports with the context that led to them.',
    ],
  },
  {
    id: '2026-05-25-17c',
    items: [
      '💾 SAVE CORRUPTION NO LONGER SILENTLY WIPES PROGRESS — if your save can\'t be parsed on boot, we back up the raw payload to a dated localStorage key (`sweet-match.v1.corrupt.<timestamp>`) and toast "Save was corrupted, started fresh. Your previous save was backed up." instead of just resetting silently.',
      '⚠ STORAGE WRITE FAILURES SURFACE — if persist() can\'t write (private mode, quota exceeded, SecurityError) you now see "Saving disabled" once per session instead of losing progress on next reload with no warning.',
      '🔢 SAVE VERSION FIELD — every save now carries `version: 1` so future schema migrations have a hinge to dispatch on without having to guess.',
    ],
  },
  {
    id: '2026-05-25-17b',
    items: [
      '🚑 INPUT NEVER FREEZES AGAIN — one thrown error inside the swap / hammer / color bomb / +moves / slot intro pipelines used to leave `state.busy = true` forever, bricking input for the rest of the session. Every entry point is now wrapped in try / finally so the busy flag always clears, and a window-level error / unhandledrejection listener resets it as a last-resort backstop.',
    ],
  },
  {
    id: '2026-05-25-17a',
    items: [
      '📱 HEADER FITS THE iPHONE — Settings + Restart shrink to icon-only buttons on phones so the 🏠 home button is no longer clipped off the right edge of a 390px viewport. The big "Sweet Match" title shrinks to text-2xl on mobile too.',
      '📲 INSTALL PROMPT NO LONGER COVERS THE BOARD — the iOS "add to home screen" toast was firing on a blind 3-second timer, often landing on top of an active game. It now only appears while the start screen is showing.',
      '🍎 iOS LAYOUT FIXES — `min-h-screen` swapped for `min-h-dvh` so the start screen doesn\'t overshoot the viewport when Safari\'s URL bar is visible. Board now has `touch-action: none` + `user-select: none` so swipes don\'t race the page scroller or accidentally select text.',
      '🔊 AUDIO UNLOCK ON FIRST GESTURE — first sound effect could be silent on iOS if the first tap didn\'t happen to be one of the buttons that explicitly unlocked audio. A document-level pointerdown/keydown/touchstart listener now guarantees audio unlocks on any first interaction.',
      '📖 "WHAT\'S NEW" NOW SHOWS THE CHANGELOG — the start-screen button was wired to the welcome tutorial by mistake. Now opens the actual update list.',
      '🛡 RUN HUD VISIBLE FROM SLOT 1 — a previous boot-time `setRunHud({ visible: false })` could leave the HUD hidden once a run started. Forced refresh on slot start guarantees the build readout shows immediately.',
      '🗺 PROJECT_PLAN.md — full consumer-product roadmap (4-phase, ~30 items) lives in-repo for visibility.',
    ],
  },
  {
    id: '2026-05-25-15q',
    items: [
      '👀 BIG READABILITY PASS — text everywhere is now bigger and higher-contrast. The faded `opacity-70` uppercase labels on the run-summary stat cards (SCORE / SLOT REACHED / GEMS EARNED / BEST EVER) are now bold gray-900 at text-sm; the AWAKENED chip uses pink-700 instead of pink-500 so the white text actually shows; the run HUD\'s "Next milestone" / "No upgrades yet" / "Relics:" lines drop their opacity tricks for proper gray-700/900.',
      '🎨 START SCREEN IS LEGIBLE NOW — the subtitle, stats badges, Quit Game link, and version footer were all gray-500/600/700 italic on the pink/purple gradient (failing AA). Now bold gray-900 / pink-900, no italic on critical text, and version sits in a white pill.',
      '♿ HIGH-CONTRAST MODE NO LONGER HIDES THE START SCREEN — in HC mode the global `h1 { color: #fff }` rule was making the "Sweet Match" title invisible against the light gradient background. Added explicit HC overrides for the start screen, goodbye screen, and boss banner so titles, buttons, and labels all render on dark backgrounds.',
      '🗣 BOSS BANNER TAUNT + TIP — were pale pink italic + pale yellow over a red gradient (≈3:1 contrast). Now white-bold (with a black/40 plate behind the taunt) and yellow-200 bold.',
      '💬 TOOLTIPS WRAP NICELY — `data-tip` tooltips were `white-space: nowrap` and used to clip horizontally off small screens (the Settings panel tip "Spend gems on permanent roguelike boosts" overlapped the next button). Now wrap and max-width 280px.',
      '🎯 FOCUS RINGS ON SETTINGS BUTTONS — every `.setting-toggle` / `.setting-size` now shows a 3px pink (yellow in HC) outline when keyboard-focused. Skill-tree buy and install-prompt buttons too.',
      '👆 BIGGER TAP TARGETS — Install prompt CTA and dismiss × now meet the 44×44 px touch target. Skill-tree buy button bumped to py-3.',
      '📜 OTHER COPY BUMPS — level-intro "Tap anywhere to start" is now text-sm gray-700 (was text-xs gray-500). Skill-tree desc, class picker desc, upgrade picker desc all bumped to text-base sm:text-lg gray-900. Class picker "Never played" no longer italic gray-500.',
    ],
  },
  {
    id: '2026-05-25-16a',
    items: [
      '🎨 EXPERIMENTAL WEBGL RENDERER — opt in via ⚙ Settings → "🎨 WebGL renderer" (page reload required) or by appending `?canvas=1` to the URL. Pixi.js v8 paints the candies in a Canvas2D/WebGL layer overlaid on the board for smoother sprite movement, while the DOM tiles stay as transparent hit targets so input is unchanged.',
      'Scope of this first phase: base candy shapes, swap / pop / intro-drop animations. Specials (line / rainbow) and crazy tiles (TNT / void / bolt / prism / wormhole) still fall back to the DOM renderer in this phase — toggling on the WebGL mode will paint them as plain candies for now.',
    ],
  },
  {
    id: '2026-05-25-15p',
    items: [
      '🐛 BUG HUNT — fixed a ReferenceError when the Surprise Drop kicked in (was referencing the removed POWERUP_CAP constant), so the random in-game power-up gift no longer crashes.',
      '🚪 QUIT GAME NOW WORKS — the goodbye screen was being CSS-hidden by the same rule that hides the game UI on the start screen. Now it actually appears. Quitting mid-roguelike-run also forfeits the run silently (awards gems for slots reached) and persists state before leaving.',
      '🏠 HOME MID-ANIMATION IS SAFE — pressing 🏠 while a boss banner, level intro, or any in-flight overlay is up now closes them cleanly instead of leaving them stuck behind the start screen. Pending level-intro promises also resolve so callers don\'t leak.',
      '🌀 NO MORE DUD CRAZY TILES — relics that called spawnCrazyTile() with no kind argument were leaving cells with `crazy=undefined`. They now pick a weighted-random kind so each spawn is a real tile.',
      '♿ OS REDUCE-MOTION RESPECTED — the start screen logo float now stops when the operating system requests reduce-motion, not just the in-app toggle.',
    ],
  },
  {
    id: '2026-05-25-15o',
    items: [
      '🎮 PROPER GAME FLOW — launch goes STRAIGHT to the start screen now: no tutorial pop-up, no changelog pop-up, no auto-resume into your last mode. Pick a mode → play → tap 🏠 to quit back to the start screen. From there: pick another mode or 🚪 Quit Game.',
      '👋 GOODBYE SCREEN — Quit Game shows a "Thanks for playing" screen with a button to bounce back to the start screen if you change your mind. Music stops cleanly.',
      '🍬 START SCREEN POLISH — animated 🍬 logo, your best score / runs / gems shown as small badges, app version at the bottom. Tutorial + changelog still reachable via ⚙ / 📖 / ? buttons.',
    ],
  },
  {
    id: '2026-05-25-15n',
    items: [
      '🏁 PROPER FULL-PAGE START SCREEN — the start menu is no longer a modal sitting on top of the game board. It\'s a true title screen now: big logo, mode buttons, settings & "What\'s New" shortcuts, and the game UI underneath is completely hidden until you pick a mode. Launching the app and tapping 🏠 mid-game both land here.',
    ],
  },
  {
    id: '2026-05-25-15m',
    items: [
      '🚫 CRAZY TILES ARE ROGUELIKE-ONLY — TNT, Void, Bolt, Prism, and Wormhole tiles no longer spawn in Levels or Free Play. They\'re a deliberate roguelike chaos mechanic, so confining them there keeps Levels honest and Free Play relaxed.',
      '🎒 POWERUP STASH CAPPED PER-TYPE — base caps are now 3 hammers, 3 shuffles, 1 color bomb, 1 +3 moves. Bigger Bank meta-skill / Caretaker upgrade / Sustain synergy / Power Friday mutator all still raise these. Old saves that stockpiled past the new cap get trimmed on next launch.',
      '🏠 START MENU IS ACCESSIBLE FROM ANYWHERE — added a 🏠 button to the header that takes you back to the start screen from any mode. Properly closes any in-flight roguelike run (with the usual run summary → gems award) before swapping.',
    ],
  },
  {
    id: '2026-05-25-15l',
    items: [
      '🎬 LAUNCH NOW BOOTS TO THE START SCREEN — opening the app drops you on the proper mode-picker (⚔ Roguelike / 🎯 Levels / 🎨 Free Play) instead of jumping straight into whatever mode you were last in. Mid-run roguelikes still auto-resume so you don\'t lose progress.',
      '🏠 BACK TO START MENU LIVES IN SETTINGS — the in-settings "Mode" cycle button is gone; in its place is a clear "Back to Start Menu" entry. Mode switching now happens only at the start screen, like a proper game.',
      '🔊 MODE-PICK NOW PLAYS THE MODE-TRANSITION JINGLE — short audio cue when you pick a mode so the start menu feels alive.',
    ],
  },
  {
    id: '2026-05-25-15k',
    items: [
      '🏁 GAME-OVER → START MENU — closing the run summary now opens a proper mode-picker (Roguelike / Levels / Free Play) so you always know where to go next instead of dumping you back into whatever the game was rendering. Settings & What\'s New shortcuts live here too.',
      '💥 CRAZY TILES (void / black hole / prism / bomb / wormhole) NOW POP MORE RELIABLY — adjacent-match trigger added: any orthogonal neighbor that matches will fire the crazy tile, and the crazy tile itself clears off the board after its effect so you don\'t see a "dud" left behind.',
      '🗣 SPEECH NO LONGER CUTS ITSELF OFF — voiceover lines used to cancel each other every time a new one fired, so boss intros / combo callouts got chopped mid-sentence. Now they queue (capped at 4 in-flight) and play to completion in order.',
      '🪜 NO MORE MENU STACKING — opening the start menu now dismisses any other modal that was up (run summary, settings, changelog, etc.) so panels never pile on top of each other.',
    ],
  },
  {
    id: '2026-05-25-15j',
    items: [
      '🗣 VOICEOVER + GOAL TEXT NOW MATCH THE SCALED TARGETS — roguelike score targets scale ×0.5 per slot and clearJelly / cherry slots get tighter move budgets, but the hint text bundled into the original level configs was still announcing the OLD numbers. Now every hint regenerates from the actual scaled objective, so the spoken intro, intro card, and level info bar all read the correct goal (e.g. "Reach 130,000 points." at slot 50 instead of "Reach 5,000 points.").',
    ],
  },
  {
    id: '2026-05-25-15i',
    items: [
      '♾️ INFINITE TRIGGER IS NOW SCORE-BASED — crossing 1,000,000 points in a single level / slot grants the INSTANT WIN with the ∞ score (was 25-cascade chain depth). Easier to hit on purpose with a strong build, and reads as a clear "you broke a million" milestone. First infinite of your session is ∞, then ∞+1, ∞+2, …',
    ],
  },
  {
    id: '2026-05-25-15h',
    items: [
      '⏳ JELLY + CHERRY SLOTS TIGHTEN UP — clearJelly and dropIngredients objectives have fixed board counts (can\'t scale the target). Their MOVE BUDGET now shrinks per slot instead: slot 25 → -10%, slot 50 → -20%, slot 100 → -40%. Bosses stay hand-tuned and exempt.',
    ],
  },
  {
    id: '2026-05-25-15g',
    items: [
      '♾️ INFINITE COMBO = AUTO WIN — if a cascade ever chains past 25 rounds, the game declares INSTANT WIN, force-satisfies whatever the objective was, and paints the score as the infinity symbol. First infinite of your session is "∞", second is "∞+1", third "∞+2", and so on — earn bragging rights for breaking the game.',
      'Belt + suspenders: state.cascadeAbort flag bails every cascade loop the moment the threshold trips, so we don\'t actually stall the JS thread.',
    ],
  },
  {
    id: '2026-05-25-15f',
    items: [
      '🧹 LISTENER DEDUP — replaced raw addEventListener on persistent close buttons (Skill Tree, Run Inventory, Changelog) with a registry-backed replaceListener. Re-opening a panel without closing it first no longer stacks duplicate click handlers.',
    ],
  },
  {
    id: '2026-05-25-15e',
    items: [
      '⌨ MODAL FOCUS RETURNS — opening the Run Inventory, Skill Tree, or What\'s New from a keyboard / screen-reader now returns focus to the trigger button on close (used to drop focus to body, breaking Tab order).',
    ],
  },
  {
    id: '2026-05-25-15d',
    items: [
      '🔇 MUTE NOW KILLS IN-FLIGHT SOUNDS — toggling sound off used to let already-playing SFX envelopes ring out for ~half a second (kick drums, boss stingers, epic-cascade). Now all active gain nodes are tracked and ramped to silence in 40ms when you mute.',
    ],
  },
  {
    id: '2026-05-25-15c',
    items: [
      '🌑 HIGH-CONTRAST PANELS — changelog and skill-tree panels now properly render dark in High Contrast mode. Previously they inherited white text on a default white background and became unreadable.',
    ],
  },
  {
    id: '2026-05-25-15b',
    items: [
      '🛡 XSS HARDENING — every innerHTML site that interpolates game-catalog text (class / relic / upgrade / mutator names and descriptions) now runs through escapeHtml. Safe-by-source today; corrupted saves or future import features can\'t inject markup.',
    ],
  },
  {
    id: '2026-05-25-15a',
    items: [
      '🩸 RED-BORDER CLEANUP — the boss-fight red pulsing border now properly clears when you finish or fail a run (was lingering into the main menu and Levels mode after a boss-slot end).',
      '📦 OFFLINE FIX — service worker cache now includes haptics.js and roguelike.js (were missing, causing module load failures in offline mode). Cache version bumped to v5.',
    ],
  },
  {
    id: '2026-05-25-14l',
    items: [
      '➕ +MOVES REVIVE FIXED — the input-lock from 14k accidentally blocked the +Moves revive when you ran out of moves. Now the lock only applies during the post-WIN settle (movesRemaining > 0). +Moves still revives you from a fail.',
    ],
  },
  {
    id: '2026-05-25-14k',
    items: [
      '🔒 INPUT LOCKED AFTER WIN — once the objective is met, swaps / taps / armed tools / +Moves / Shuffle are blocked during the 1.2s settle window so you can\'t accidentally make a phantom move while the success panel is animating in.',
      '🍒 COLOR BOMB CHERRY GUARD — Color Bomb now explicitly skips ingredient cells (cherries). Was previously safe by virtue of cherries having no candy type, but the explicit guard prevents future ingredient kinds from being eaten.',
    ],
  },
  {
    id: '2026-05-25-14j',
    items: [
      '⏱ SUCCESS PANEL SETTLES — when an objective is met, you now see a "🎉 LEVEL CLEAR / SLOT CLEAR" flash for ~1.2s and the score counter finishes rolling before the success panel pops up. Final cascades, leftover-move bonuses, and Lucky-MODE payouts all land on screen first.',
      '🎚 LONGER SCORE ROLL — score counter animation cap bumped 700ms → 1100ms with a slower per-point curve so big payouts feel weighty instead of snapping instantly.',
    ],
  },
  {
    id: '2026-05-25-14i',
    items: [
      '📈 ROGUELIKE SCORE TARGETS SCALE WITH SLOT — score-style objectives in roguelike runs now multiply by (1 + slot × 0.5). Slot 50 score targets jump 26×; slot 100 jumps 51×. Matches / clear-type targets scale more gently (×0.2 per slot). Bosses scale half-rate since they\'re already hand-tuned. No more breezing past targets with 200k while the goal said 5k.',
      'Hand-placed obstacle counts (clearJelly, dropIngredients) are NOT scaled — those are tied to board geometry.',
    ],
  },
  {
    id: '2026-05-25-14h',
    items: [
      '🌑 NO MORE INTRO-OVERLAP — Black Hole, Storm Caller, Eraser, Grumblock spawn, Wild Card, Sweet Roar, Iron Tongue, and the mutator banner all wait for you to tap the intro before they fire. They used to play under the intro card.',
      '🎬 EMPTY-TILE STATE — when a tile pops and is briefly empty, it now shows a soft gray inset (or dark in high-contrast) instead of flashing pure white. Cascades read smoother.',
      '🐌 SLOWER CASCADES — base round delays bumped from 160/260ms → 220/340ms with bigger bonuses at chain ≥3 / ≥5. More time to enjoy the combo.',
    ],
  },
  {
    id: '2026-05-25-14g',
    items: [
      '🍒 CHERRY BUG (round 2) — special-special combos (double-rainbow, rainbow-stripes, stripes-pair) were destroying cherries because applyCombo paints whole rows/board without an ingredient filter. Now filters them out before the clear.',
      '⏸ NO MORE TAP-THROUGHS — level intros no longer auto-dismiss. You have to tap to start. (Tap is blocked for the first 400ms after open so you can\'t accidentally close it on opening swipe.)',
      '🛡 PICKER GUARDS — relic picker, upgrade picker, crossroads, merchant, level-complete, level-fail, and run-summary panels all block clicks for 600ms after opening. No more accidental rapid-tap relic choices.',
      '🌑 HIGH-CONTRAST INVENTORY — added dark theme rules for the run inventory panel so it\'s readable when High Contrast is on (previously inherited white text on white background).',
    ],
  },
  {
    id: '2026-05-25-14f',
    items: [
      '👁 ACCESSIBILITY PASS — archetype + build-vibe chips no longer render yellow-on-yellow. Text color now picks black or white based on the background\'s luminance for WCAG-friendly contrast.',
      '🔎 BIGGER FONTS — run HUD bumped from text-sm/base to text-base/lg. "Next milestone" hint, "Relics:" label, and inventory relic descriptions all go from text-xs → text-sm.',
      '⌨ KEYBOARD ACCESS — the run HUD chip is now a real button (role/tabindex/aria-label) and opens the inventory with Enter / Space, not just tap.',
      '💬 TILE TOOLTIPS — bumped from 13px → 15px font, wider, with a yellow accent border. Easier to read at a glance on touch devices.',
      '📋 INVENTORY ROWS — upgrade rows in the inventory now use black text on white with a colored left-border accent for readability (instead of low-contrast tinted backgrounds with same-color text).',
    ],
  },
  {
    id: '2026-05-25-14e',
    items: [
      '👹 BOSSES ARE MEANER — every boss got 4-12 fewer moves AND tougher targets. Sweet King: 6,000 (was 5,000) in 34 moves (was 40). Padlock Pharaoh: 7,500 in 32. Echo Wraith: 36 purples in 26 moves. The Confectioner: 10,000 in 36. Candy Kraken final: 16,000 score in 48 moves with deeper locks (level-3) and an extra jelly row.',
      '🩸 BOSS-MODE BOARD — during boss fights the board now pulses with a red border so you feel the pressure. Final boss pulses faster + harder. Reduce-Motion disables the animation but keeps the red.',
    ],
  },
  {
    id: '2026-05-25-14d',
    items: [
      '📋 BUILD VIEW — the run HUD now sports a "📋 BUILD" chip and a proper cursor + tooltip ("Tap to see your full build"). Tap to open the full inventory with class, upgrades, relics, AWAKENED status, and run highlights.',
      '🏆 UPGRADE TIERS — the inventory panel labels stacked upgrades by tier (II, III, IV, MAX at ×5). Max-tier upgrades render filled, so you can see at a glance which builds are pushed to the limit.',
      '👹 BOSS INTROS LINGER — boss banners hold 3.0s (4.2s for the Candy Kraken final) so you can actually read the taunt and tactical tip before the fight kicks off.',
    ],
  },
  {
    id: '2026-05-25-14c',
    items: [
      '🍒 BUG FIX — Bolt crazy tiles no longer destroy cherries. They were silently being deleted off the board, making cherry-objective levels uncompletable.',
      '🪤 SAFETY NET — board now auto-cascades any stale matches on load (level start, slot start, after a shuffle). If matches ever exist, they pop and award points.',
      '🟧 HEXAGON — orange tile is taller and more obviously a hexagon (point-top, 6×88px vertical).',
      '🐌 BIGGER COMBOS, LONGER BEATS — cascade chains of 3+ now linger longer between rounds so you can see what just happened. Small matches stay snappy.',
    ],
  },
  {
    id: '2026-05-25-14b',
    items: [
      '🟧 SHAPE FIX — the orange candy is now a hexagon instead of a diamond. The diamond looked too much like the pink triangle at a glance; the hexagon reads instantly different.',
    ],
  },
  {
    id: '2026-05-25-14a',
    items: [
      '💬 TILE TOOLTIPS — hover any tile on desktop (or long-press 0.5s on mobile) and you\'ll see a description: what crazy tiles do, what specials do, jelly/lock hit-counts, and so on. Finally clear what everything on the board means.',
      '🩹 BUG FIX — added a settle delay after crazy-tile pops so the cascade always sees the post-gravity board. Should stop the occasional "matches just sit there after a TNT" hiccup.',
    ],
  },
  {
    id: '2026-05-25-13y',
    items: [
      '🔒 Lucky Aura meta-skill is now strictly Roguelike-only. The wacky stuff stays in Roguelike — Levels and Free Play are back to clean grandma-mode.',
    ],
  },
  {
    id: '2026-05-25-13x',
    items: [
      '😊 NEW RELIC — Sweet Smile: 25% chance to keep a life when you would lose one. Anti-frustration cushion.',
      '🔋 NEW RELIC — Power Up: every 10 swaps in a slot, gain +1 of EVERY power-up.',
    ],
  },
  {
    id: '2026-05-25-13w',
    items: [
      '🔥 NEW UPGRADE — Furnace (Wild): cascade chain ≥3 spawns a TNT crazy tile per stack. New cascade-bomber bridge for chain-heavy builds.',
    ],
  },
  {
    id: '2026-05-25-13v',
    items: [
      '📜 NEW CHAPTER — "Postlude" (levels 131-135). Edge Case, Slowburn, Iron Cage, Cherry Storm, and Endless (40k score, 100 moves).',
      'Level count is now 135.',
    ],
  },
  {
    id: '2026-05-25-13u',
    items: [
      '🎒 NEW META-SKILL — Pocket Friend (75💎): every run starts with 1 random relic already in your inventory. Permanent early-game boost.',
    ],
  },
  {
    id: '2026-05-25-13t',
    items: [
      '👑 NEW RELIC — Sweet Throne: boss kill grants +1 of EVERY power-up. Bigger restock than Boss Bounty.',
      '🃏 NEW RELIC — Joker: Crossroads events show 4 options instead of 3. More choice, more strategy.',
    ],
  },
  {
    id: '2026-05-25-13s',
    items: [
      '🎉 NEW MUTATOR — Power Friday: power-up bank cap is doubled this slot. Hoard everything.',
      '🗝 NEW MUTATOR — Lock-Free Day: ALL locks on the board vanish at slot start. Free movement.',
    ],
  },
  {
    id: '2026-05-25-13r',
    items: [
      '💧 NEW UPGRADE — Bomb Splash (Bomber): TNT pop fills Lucky bar +15% per stack. Bomber→Lucky bridge.',
      '🚀 NEW UPGRADE — Lucky Reload (Lucky): when Lucky-MODE fires, +1 "+3 Moves" power-up per stack. Stacks with Cherry Reload.',
    ],
  },
  {
    id: '2026-05-25-13q',
    items: [
      '🐝 NEW UPGRADE — Sweet Roar (Wild): slot start fires a free Bee Storm per stack. Open big.',
      '🪙 NEW MUTATOR — Coin Toss: every match has a 25% chance to drop a random power-up. Bank fills up fast.',
    ],
  },
  {
    id: '2026-05-25-13p',
    items: [
      '✨ TWO NEW CROSSROADS OPTIONS — 💪 The Forge (+1 stack of a random upgrade you already have) and 🍀 The Well (Lucky bar fills to FULL right now).',
      'Crossroads pool is now 7 deep; you always see 3 random options per event.',
    ],
  },
  {
    id: '2026-05-25-13o',
    items: [
      '❤️ NEW UPGRADE — Heart Steal (Sustain): boss kills restore +1 life per stack. Keep your hearts full through the marathon.',
      '✨ NEW UPGRADE — Spark Strike (Wild): every 12 matches in a slot, fire a free Lightning bolt (no Lightning upgrade required).',
    ],
  },
  {
    id: '2026-05-25-13n',
    items: [
      '⛈ NEW RELIC — Storm Heart: at 1 life remaining, ALL matches score ×2. High-stakes comeback push.',
      '🛏 NEW RELIC — Sweet Cushion: slot starts at 1 life → +5 moves AND +50% Lucky bar. Last-stand cushion to climb back.',
    ],
  },
  {
    id: '2026-05-25-13m',
    items: [
      '💥 NEW UPGRADE — Bigger Bomb (Bomber): TNT explosion radius +1 per stack on top of Bomber synergy. Stack 2 → 5×5 → 7×7 → 9×9 board-clearers.',
    ],
  },
  {
    id: '2026-05-25-13l',
    items: [
      '🎄 NEW RELIC — Sweet Wreath: slot start, every jelly tile loses 1 level. Mirrors Frosty Crown for jelly-heavy boards.',
    ],
  },
  {
    id: '2026-05-25-13k',
    items: [
      '💥 NEW MUTATOR — Sweet Crit Day: 5+ tile matches score ×5 this slot.',
      '🍀 NEW MUTATOR — Lucky Stream: Lucky bar fills 3× faster this slot. Burst-mode every few swaps.',
    ],
  },
  {
    id: '2026-05-25-13j',
    items: [
      '⚡ NEW UPGRADE — Power Surge (Scorer): 6+ tile matches score ×2 per stack. Big-match scoring explosion.',
      '🌅 NEW UPGRADE — Sweet Glow (Lucky): Lucky-MODE lasts +1 extra match per stack. Stretch the burst window.',
    ],
  },
  {
    id: '2026-05-25-13i',
    items: [
      '🌸 NEW RELIC — Cherry Wand: each special candy created fills Lucky bar by +25%. Special-rich builds now feed Lucky-MODE bursts.',
      '🫖 NEW RELIC — Tea Time: slot start Lucky bar +30%. Gentle opening sip.',
    ],
  },
  {
    id: '2026-05-25-13h',
    items: [
      '🔮 NEW MUTATOR — Spell Power: Wild auto-fire abilities (Lightning / Meteor / Bee Storm) trigger 2× faster this slot. Massive payoff for Wild-stacked builds.',
    ],
  },
  {
    id: '2026-05-25-13g',
    items: [
      '🎺 NEW RELIC — Lucky Whistle: when Lucky-MODE triggers, drop a random power-up.',
      '🎶 NEW RELIC — Healing Hum: when Lucky-MODE ends naturally (window expires), gain +1 max life.',
    ],
  },
  {
    id: '2026-05-25-13f',
    items: [
      '🏁 NEW CHAPTER — "Aftermath" (levels 126-130). Glass Maze, Tower Defense, Picky Eater, Marathon, and the new final at 30,000 score: Aftermath.',
      'Level count is now 130.',
    ],
  },
  {
    id: '2026-05-25-13e',
    items: [
      '🍬 NEW UPGRADE — Sweet Steady (Sustain): slot start grants +1 random power-up per stack. Drip restock.',
      '🌨 NEW MUTATOR — Snowstorm: every match earns a flat +10 per cleared tile. Big matches snowball with bonus points.',
    ],
  },
  {
    id: '2026-05-25-13d',
    items: [
      '✨ HUD UPGRADE — the "Next" milestone chip on the run HUD now also flags incoming Crossroads events. Plan your power-up spending around the next stop.',
    ],
  },
  {
    id: '2026-05-25-13c',
    items: [
      '💣 NEW RELIC — Bomb Squad: when TNT pops, drop a random power-up. Stacks with Bombardier awakening.',
      '❄️ NEW RELIC — Frosty Crown: slot start, every lock loses 1 level. Lock-heavy boards open up faster.',
    ],
  },
  {
    id: '2026-05-25-13b',
    items: [
      '🌟 NEW RELIC — Glow Stick: cascade chains ≥6 instantly trigger Lucky-MODE, regardless of bar. Cascade builds skip the charge phase.',
      '🐝 NEW RELIC — Bee Wing: every Lucky-MODE match also spawns a random crazy tile. Lucky-MODE becomes chaos-mode.',
    ],
  },
  {
    id: '2026-05-25-13a',
    items: [
      '🧚 NEW RELIC — Fairy Light: hint sparkles appear after just 0.8 sec idle (fastest hint relic, beats Goldfish 1.5s).',
      '🧠 NEW RELIC — Sweet Memory: every power-up use grants +5% Lucky bar. Build Lucky-MODE off your power-up bank.',
    ],
  },
  {
    id: '2026-05-25-12z',
    items: [
      '🐝 NEW CLASS — Hivemind: hybrid start with Bee Tonic + Lucky Magnet. Lucky-MODE on tap from move one.',
      '🐱 NEW CLASS — Crazy Cat: hybrid start with Wild Card + Storm Caller. Slot start is pure chaos — TWO crazy tiles already on the board.',
      'Class roster: 19.',
    ],
  },
  {
    id: '2026-05-25-12y',
    items: [
      '💪 NEW MUTATOR — Mega Mode: every match scores ×3 this slot. Stronger than Golden Hour.',
      '🎰 NEW MUTATOR — Bonus Round: +10💎 instantly AND every match scores ×1.5 this slot.',
      'Mutator pool: 30.',
    ],
  },
  {
    id: '2026-05-25-12x',
    items: [
      '👜 NEW RELIC — Pixie Pouch: every 18 matches in a slot, gain +1 of EVERY power-up. Burst restock for marathon slots.',
      '🍋 NEW RELIC — Sour Drop: every 13 swaps in a slot, +50% Lucky bar. Bigger jolts than Sweet Spell.',
    ],
  },
  {
    id: '2026-05-25-12w',
    items: [
      '🎴 NEW UPGRADE — Wild Card (Wild): slot start spawns 1 random crazy tile per stack. Always begin with board chaos.',
      '🐝 NEW UPGRADE — Bee Tonic (Lucky): slot start adds +20% Lucky bar per stack. Stacks with Lucky Soul and Lucky Day mutator.',
    ],
  },
  {
    id: '2026-05-25-12v',
    items: [
      '🍒 NEW UPGRADE — Cherry Reload (Lucky): when Lucky fires, gain +1 Shuffle per stack. Lucky-focused builds now have a stream of shuffles to reshape the board.',
    ],
  },
  {
    id: '2026-05-25-12u',
    items: [
      '🦴 NEW RELIC — Bone Charm: locks decrement by 2 per hit instead of 1. Lock-heavy boards melt fast.',
      '🔄 NEW RELIC — Sweet Reset: shuffles are FREE during boss slots. Reorganize for big-match boss openings without spending bank.',
    ],
  },
  {
    id: '2026-05-25-12t',
    items: [
      '🍀 NEW META-SKILL — Lucky Aura (80💎): Lucky bar fills 25% faster on every run. Compounds with Lucky Fast and Lucky synergy.',
      '👁 NEW META-SKILL — Crit Eye (70💎): first match of every slot scores ×1.5. Stacks with Crimson Rose / Sugar Rush.',
    ],
  },
  {
    id: '2026-05-25-12s',
    items: [
      '🎭 NEW CHAPTER — "Encore" (levels 121-125). For the player who beat True End and wants more: Curtain Call, Sticky Web, Locked Garden, Cherry Fountain, and the cascade-only Encore!',
      'Level count is now 125.',
    ],
  },
  {
    id: '2026-05-25-12r',
    items: [
      '🌅 NEW RELIC — Sunrise Hour: on slots 1-10, all scores ×1.5. Early-game ramp.',
      '🌇 NEW RELIC — Sunset Hour: on slots 96-100, all scores ×2. End-game payoff for the marathon.',
    ],
  },
  {
    id: '2026-05-25-12q',
    items: [
      '➕ NEW UPGRADE — Plus More (Sustain): each "+3 Moves" power-up gives +1 extra per stack. Stack two → +5 per use.',
      '🍬 NEW UPGRADE — Sweet Treat (Scorer): 3-tile matches score +25% per stack. Small-match builds with cascades now competitive.',
    ],
  },
  {
    id: '2026-05-25-12p',
    items: [
      '⛏ NEW MUTATOR — Diamond Mine: every 6 matches in a slot earns +1 💎. Mine ore.',
      '⚔️ NEW MUTATOR — Big Crit: all cascades (chain ≥2) score ×4 this slot. Cascade-focus payoff.',
      'Mutator pool: 28.',
    ],
  },
  {
    id: '2026-05-25-12o',
    items: [
      '✨ MORE CROSSROADS — events now trigger at slots 27, 47, 77, AND 87 (4 per run, up from 2).',
      '🆕 TWO NEW OPTIONS — ❤️ The Spring (+1 max life) and 🎲 The Gamble (50/50 for +30💎). Each crossroads shows 3 random options from a pool of 5, so they stay fresh.',
    ],
  },
  {
    id: '2026-05-25-12n',
    items: [
      '🏆 BIGGER ACHIEVEMENTS — new pop-up badges for Massive Match (8+), Unbelievable (12+), Mega Cascade (chain ≥6), LEGENDARY (chain ≥9), Cascade God (15+ cascades), 50k and 100k score milestones.',
    ],
  },
  {
    id: '2026-05-25-12m',
    items: [
      '🍨 NEW RELIC — Sundae Saturday: every 8 matches in a slot grants +1 "+3 Moves" power-up. Steady drip for marathon slots.',
      '💥 NEW RELIC — Sugar Crash: every 14 matches in a slot, a TNT crazy tile spawns. Mid-late slot bursts on cascade-heavy builds.',
    ],
  },
  {
    id: '2026-05-25-12l',
    items: [
      '✨ NEW EVENT — The Crossroads. At slots 27 and 77 a brief no-cost detour appears: pick from 🛍 The Vault (FREE relic), 🎁 The Cache (+2 of every power-up), or 💎 The Reserve (+20 💎).',
      'Slay-the-Spire-style mid-run decision points that reward planning your build path.',
    ],
  },
  {
    id: '2026-05-25-12k',
    items: [
      '🔨 NEW MUTATOR — Hammer Storm: start of slot, gain +3 Hammers. Smash through obstacles.',
      '💣 NEW MUTATOR — Bomb Cache: start of slot, gain +2 Color Bombs. Big boom potential.',
      'Mutator pool is now 26.',
    ],
  },
  {
    id: '2026-05-25-12j',
    items: [
      '🎼 TWO MORE CHIPTUNES — Song D (slinky shuffle, Bb–Eb feel, syncopated) and Song E (slow waltz ballad). The roguelike music bank is now 5 songs deep; runs feel less repetitive.',
    ],
  },
  {
    id: '2026-05-25-12i',
    items: [
      '✨ BUILD VIBE — the run HUD now shows a colored playstyle label next to your archetype chips. Bomber-heavy? "🔥 Demolisher." Mixed? "🌈 Polymath." Lucky-heavy? "🍀 Charmlord." Identifies your build at a glance.',
      'Appears once you have 3+ upgrades total — early game stays clean.',
    ],
  },
  {
    id: '2026-05-25-12h',
    items: [
      '🌊 NEW CLASS — Cascadesmith: hybrid start with Cascade King + Cascade Splash. Build a chain reactor that snowballs every swap.',
      '🌀 NEW CLASS — Sorcerer: hybrid start with Echo Match + Meteor Shower. Ride cascades into Lucky-MODE bursts.',
      'Class roster is now 17.',
    ],
  },
  {
    id: '2026-05-25-12g',
    items: [
      '🧁 NEW RELIC — Confectionery: each special candy you create also drops a random power-up. Pairs huge with Prism Maker / Bomb Maker chains.',
      '🪞 NEW RELIC — Cracked Mirror: matches of 5+ tiles fill the Lucky bar by +20%. Big-match builds now bridge into Lucky-MODE bursts.',
    ],
  },
  {
    id: '2026-05-25-12f',
    items: [
      '👅 NEW UPGRADE — Tongue Tie (Sustain): The Eater attacks +1 move slower per stack. Stacks with Slow Down mutator and Time Freeze.',
      '💰 NEW UPGRADE — Gold Pile (Scorer): each boss kill grants +5 gems per stack. Build a boss-rush gem economy.',
    ],
  },
  {
    id: '2026-05-25-12e',
    items: [
      '🏅 RUN HIGHLIGHTS — the run-summary panel now shows your max cascade and biggest single match for the current run. New chase-stats to push for personal bests.',
    ],
  },
  {
    id: '2026-05-25-12d',
    items: [
      '🎼 NEW CHIPTUNE — Song C: a heroic, brassy "stage-clear" march with walking bass and rising hook. Inspired by 16-bit fighting game themes. The chiptune player now rotates through 3 songs in roguelike runs.',
    ],
  },
  {
    id: '2026-05-25-12c',
    items: [
      '🌊 NEW UPGRADE — Cascade Splash (Wild): every cascade chain ≥2 has a 60% chance per stack to spawn a random crazy tile. Snowball boards into chaos.',
      '🪞 NEW UPGRADE — Echo Match (Lucky): cascade chains ≥4 also fill your Lucky bar by +50% per stack. Cascade-focused builds now feed Lucky-MODE.',
    ],
  },
  {
    id: '2026-05-25-12b',
    items: [
      '🌶 NEW RELIC — Spice Box: every 12 matches in a slot, a random crazy tile spawns. Constant board chaos.',
      '🍯 NEW RELIC — Honey Trap: BOSS slots only, the first 3 matches score ×3. Build a boss-rush spike for late-run wins.',
    ],
  },
  {
    id: '2026-05-25-12a',
    items: [
      '🎉 NEW MUTATOR — Powerup Party: EVERY power-up is free this slot. Bank doesn\'t decrement on use. Dump your whole arsenal.',
      '🥪 NEW MUTATOR — Buffet Day: every match counts double toward the objective. Slots end fast.',
      'Mutator pool now 24 strong — every 5th non-boss slot rolls a fresh weather event.',
    ],
  },
  {
    id: '2026-05-25-11z',
    items: [
      '💬 BOSS TAUNTS — every roguelike boss now opens with a one-line taunt on the battle banner. From "You shall not pass my walls of jelly!" to the Candy Kraken\'s "TASTE THE ABYSS."',
      'Tiny touch of personality before every fight.',
    ],
  },
  {
    id: '2026-05-25-11y',
    items: [
      '💎 NEW META-SKILLS — three new entries in the Skill Tree push the run economy further:',
      '🧲 Gem Magnet (65💎): all end-of-run gems +10%, compounds with every other source.',
      '🎁 Boss Bounty (55💎): each boss kill also drops +1 random power-up into your bank.',
      '💰 Treasure Sense (50💎): Treasure mutator slots grant +5 extra gems (10 total).',
    ],
  },
  {
    id: '2026-05-25-11x',
    items: [
      '🌌 NEW CHAPTER — "Beyond" (levels 116-120). For the player who beat the game: Echoes, Mirror Pond, Last Cherry Grove, Forever Loop, and the final True End at 25,000 score.',
      'Levels mode is now 120 levels deep — over 6× the original grandma-mode set.',
    ],
  },
  {
    id: '2026-05-25-11w',
    items: [
      '🐞 NEW RELIC — Lucky Ladybug: every 11 matches in a slot, a random power-up appears in your bank. Stacks beautifully with Piñata for a power-up rain build.',
      '📖 NEW RELIC — Sweet Spell: every 7 swaps in a slot, your Lucky bar gains +25%. A new path to keep Lucky-MODE flowing for builds that thrive on bursts.',
    ],
  },
  {
    id: '2026-05-25-11v',
    items: [
      '🎉 EPIC RUN-COMPLETE FANFARE — completing a full 100-slot roguelike run now triggers waves of confetti, star rain, screen flashes, AND multiple audio stingers timed across ~2 seconds.',
      'It really feels like the triumph it is. 100 slots, 10 bosses, the final Candy Kraken — you deserve it.',
    ],
  },
  {
    id: '2026-05-25-11u',
    items: [
      '⛰ 5 MORE POST-POST-GAME LEVELS (111-115) — "True Hell" chapter for players who finished Beyond the Apocalypse.',
      'Crimson Tide (7k/22m no obstacles) · Eternal Loop (50 matches/30) · Jelly Singularity (entire 36-cell board is double-jelly) · Cherry Symphony (7 cherries) · Sweet Infinity (15k score, the new top).',
      'Total Levels mode count: 115. If you beat 115, you really did beat the game.',
    ],
  },
  {
    id: '2026-05-25-11t',
    items: [
      '🌹 NEW RELIC — Crimson Rose. The very first match of every slot scores ×5.',
      'Stack with Champion awakening (which also makes first match ×5) for ×25 first match. Set up specials before your first swap.',
      'Relic pool now 27.',
    ],
  },
  {
    id: '2026-05-25-11s',
    items: [
      '💪 NEW META SKILL — Powerful Start (55💎). Slot 1 of every run grants +2 of every power-up (instead of +1).',
      'Pair with Sweet Start meta for a hammer-rich opening. Skill tree now 14 unlocks.',
    ],
  },
  {
    id: '2026-05-25-11r',
    items: [
      '⚙️ NEW SETTING — Enemies On/Off (default On). Toggle off to disable both The Eater AND Grumblock in roguelike mode — chill survival mode for grandma or anyone who wants the build variety without the threats.',
      'Persisted across sessions like all other settings.',
    ],
  },
  {
    id: '2026-05-25-11q',
    items: [
      '🧁 NEW MUTATOR — Sweet Boost. First 5 matches of every slot score ×2. Like Sugar Rush relic but bigger spread.',
      'Mutator pool now 22.',
    ],
  },
  {
    id: '2026-05-25-11p',
    items: [
      '🔁 NEW-RUN BUTTON on the end-of-run summary. After completing or failing a run, click "🔁 New run" instead of "Continue" to immediately roll into a fresh roguelike (class picker pops back up).',
      'Inventory view (mid-run) suppresses the button — it only appears on the actual end-of-run summary.',
    ],
  },
  {
    id: '2026-05-25-11o',
    items: [
      '🪞 NEW RELIC — Twin Mirror. Matches of 5+ tiles score ×3. Stacks with Big Match upgrade (×2 per stack) for explosive big-match scoring.',
      'Relic pool now 26.',
    ],
  },
  {
    id: '2026-05-25-11n',
    items: [
      '❄️ NEW UPGRADE — Time Freeze (Lucky). While Lucky-MODE is active, The Eater is frozen and won\'t attack.',
      'Pair with Charmer awakening (Lucky-MODE +3 matches) for long stretches of safety against the late-game Eater.',
      'Upgrade pool now 39.',
    ],
  },
  {
    id: '2026-05-25-11m',
    items: [
      '🍵 NEW MUTATOR — Bottomless Cup. Every match adds +20% to the Lucky bar. Trigger Lucky-MODE almost every move.',
      'Mutator pool now 21.',
    ],
  },
  {
    id: '2026-05-25-11l',
    items: [
      '✏️ NEW MUTATOR — Eraser. Clears 3 random tiles at slot start, often triggering a free cascade.',
      'Mutator pool now 20.',
    ],
  },
  {
    id: '2026-05-25-11k',
    items: [
      '🔇 Music auto-pauses when you switch tabs — saves CPU + battery, and stops audio leaking out of background tabs.',
      'Restores to your music preference when you return to the tab.',
    ],
  },
  {
    id: '2026-05-25-11j',
    items: [
      '✨ Picking a CLASS or an UPGRADE now also fires confetti + haptic — consistent with relic acquisition. Awakening-trigger picks get BIGGER confetti + star rain.',
      'Every roguelike reward now FEELS like a reward.',
    ],
  },
  {
    id: '2026-05-25-11i',
    items: [
      '✨ Relic acquisition now FEELS rewarding — confetti burst + star rain + special-birth haptic when you pick a relic from a boss reward.',
      'Subtle polish that makes each rare boss reward feel earned.',
    ],
  },
  {
    id: '2026-05-25-11h',
    items: [
      '⏰ NEW MUTATOR — Time Bonus. On slot win, each leftover move converts to +30 score. Stacks with Crown of Sweetness (50/move) for huge end-of-slot bonuses.',
      'Mutator pool now 19.',
    ],
  },
  {
    id: '2026-05-25-11g',
    items: [
      '👯 NEW RELIC — Lucky Twin. Lucky Strike grants 2 hammers per fire instead of 1.',
      'Relic pool now 25.',
    ],
  },
  {
    id: '2026-05-25-11f',
    items: [
      '💗 NEW UPGRADE — Heart Beat (Sustain). +1 max lives per stack for the rest of the run. Stack 3× → 6 total lives (8 with Two Extra Lives meta).',
      'Upgrade pool now 38.',
    ],
  },
  {
    id: '2026-05-25-11e',
    items: [
      '👛 NEW RELIC — Coin Purse. Every 10 matches in a slot earns you +1 💎.',
      'Pair with Stardust, Penny Pincher, Big Money mutator, and Daily Bonus meta for a runaway gem economy.',
      'Relic pool now 24.',
    ],
  },
  {
    id: '2026-05-25-11d',
    items: [
      '🧠 NEW UPGRADE — Mind Reader (Lucky). Lucky burst multiplier +1 per stack (×3 → ×4 → ×5 → ...).',
      'Stack with Strong Drink relic for the ultimate Lucky build — burst at ×5+ then ×3 sustain.',
      'Upgrade pool now 37.',
    ],
  },
  {
    id: '2026-05-25-11c',
    items: [
      '🔮 NEW CLASS — Witch! Lucky/Wild hybrid starting with Lucky Strike + Hungry Snake. Channels chaos magic.',
      '🪆 NEW UPGRADE — Voodoo Doll (Lucky). When Lucky bar reaches READY, also gain +1 of every power-up.',
      'Class pool 15, Upgrade pool 36.',
    ],
  },
  {
    id: '2026-05-25-11b',
    items: [
      '🥷👑 TWO MORE HYBRID CLASSES — class pool grows from 12 to 14.',
      '🥷 Ninja (Sustain) — First Swap Free + Bomb Maker. Silent and explosive.',
      '👑 Royal (Scorer) — Score Boost + Lucky Strike. Born of wealth and luck.',
    ],
  },
  {
    id: '2026-05-25-11a',
    items: [
      '🧙 NEW STARTING CLASS — Wizard! First HYBRID class: starts with TWO upgrades from different archetypes — Combo Streak (Scorer) + Lightning (Wild).',
      'Awakening matches Stormbringer (cross-blast lightning). A solid pick for cascade-heavy + auto-fire builds.',
      'Class pool now 12.',
    ],
  },
  {
    id: '2026-05-25-10z',
    items: [
      '🥪 NEW MUTATOR — Long Lunch. +10 moves at slot start. Take your time.',
      'Mutator pool now 18.',
    ],
  },
  {
    id: '2026-05-25-10y',
    items: [
      '🍞 NEW UPGRADE — Buttered Bread (Sustain). When you would run out of moves, gain +3 moves per stack — once per slot.',
      'Emergency safety net that turns a near-loss into a possible win. Combine with Thunder Foot + Mover for a Sustain-heavy "endless slot" build.',
      'Upgrade pool now 35.',
    ],
  },
  {
    id: '2026-05-25-10x',
    items: [
      '🍀 NEW UPGRADE — Lucky Fast II (Lucky). Lucky bar fills 100% faster per stack. Stronger sibling of Lucky Fast (which is 50%).',
      'Stack both for Lucky-MODE every other match. Upgrade pool now 34.',
    ],
  },
  {
    id: '2026-05-25-10w',
    items: [
      '🎊 NEW MUTATOR — Confetti Day. Every match earns +50 flat score AND a burst of confetti. Pure party.',
      'Mutator pool now 17.',
    ],
  },
  {
    id: '2026-05-25-10v',
    items: [
      '🛠 NEW RELIC — Sweet Smith. Every 5 swaps, +1 to your most-depleted power-up. Keeps every slot topped up so you\'re never out of options.',
      'Pairs with Top Hat (random p-up every 5 swaps) for a power-up engine.',
      'Relic pool now 23.',
    ],
  },
  {
    id: '2026-05-25-10u',
    items: [
      '💵 NEW MUTATOR — Big Money. +10💎 immediately at slot start. Pure gem income for the Skill Tree.',
      'Mutator pool now 16.',
    ],
  },
  {
    id: '2026-05-25-10t',
    items: [
      '🍴 NEW RELIC — Bottomless Stomach. Every match counts as 2 toward both the matches counter AND the clearType counter for the slot\'s objective.',
      'Cuts match/clearType slots in half. Pair with Snowball + Big Brain for both scoring AND objective velocity.',
      'Relic pool now 22.',
    ],
  },
  {
    id: '2026-05-25-10s',
    items: [
      '🌳 NEW META SKILL — Generous Daily (50💎). Doubles your daily login gem bonus. At max streak that\'s up to 50💎/day on free.',
      'Skill tree now 13 unlocks.',
    ],
  },
  {
    id: '2026-05-25-10r',
    items: [
      '💣 NEW UPGRADE — Free Bomb (Bomber). The first N Color Bombs per slot are free, where N = stack count.',
      'Stack 3× and three Color Bombs each slot cost nothing. Pairs with Slot Bomb (which gives +1 bomb per slot) for a "burn down the board" build.',
      'Upgrade pool now 33.',
    ],
  },
  {
    id: '2026-05-25-10q',
    items: [
      '🐝 NEW UPGRADE — Bee Storm (Wild). Every 10 matches a buzzing swarm clears 6 random tiles. Threshold drops per stack and scales further with Wild synergy and Stormbringer awakening.',
      'Pairs beautifully with Meteor Shower + Lightning for an auto-fire chaos build.',
      'Upgrade pool now 32.',
    ],
  },
  {
    id: '2026-05-25-10p',
    items: [
      '📰 What\'s New modal now shows the LATEST 5 versions in one go — players who skipped a few updates catch up on everything they missed without digging through history.',
      'Each version gets a small id header for context. Top entry tagged "Today".',
    ],
  },
  {
    id: '2026-05-25-10o',
    items: [
      '🧺 NEW UPGRADE — Caretaker (Sustain). Power-up bank cap +1 per stack. Stacks freely with Bigger Bank meta (9→12) and Sustain synergy.',
      'Build wide Sustain runs into a 15+ cap and never feel constrained on power-ups again.',
      'Upgrade pool now 31.',
    ],
  },
  {
    id: '2026-05-25-10n',
    items: [
      '📋 SHARE YOUR RUN — the run-summary modal now has a "Copy summary" button that puts a clipboard-friendly recap of your class, build, relics, and gems earned.',
      'Brag to your friends. Sample: "Sweet Match — 🏆 RUN COMPLETE. Class: ⚔ Champion ✨ AWAKENED. Build: 🎯5 💣2 ⚡1. Relics: 🎩🐢🍰. 💎 +147."',
    ],
  },
  {
    id: '2026-05-25-10m',
    items: [
      '🍀 NEW UPGRADE — Lucky Magnet (Lucky). 5% chance per stack per match to instantly fill the Lucky bar.',
      '🐟 NEW RELIC — Goldfish. Hint sparkles appear after 1.5s idle (vs 3s with Hawkeye, 7s default).',
      '🥃 NEW RELIC — Strong Drink. Lucky-MODE multiplier doubles — ×3 sustain instead of ×1.5.',
      'Upgrade pool 30, Relic pool 21.',
    ],
  },
  {
    id: '2026-05-25-10l',
    items: [
      '👑 BOSSES SLAIN counter — tracks total bosses defeated across all runs. Surfaces in the Skill Tree gem chip: "💎 47 — 12 runs · 3 completes · best slot 89 · 27 bosses slain".',
      'Persisted across reloads. Sanitised on load.',
    ],
  },
  {
    id: '2026-05-25-10k',
    items: [
      '🧠 NEW UPGRADE — Greedy Brain (Scorer). All scores +5% per stack. Mild but always-on multiplier — great filler upgrade for Scorer builds.',
      '🐛 Fix: roguelike slot header read "Slot X of 30" left over from the old run length. Now correctly shows "Slot X of 100".',
      'Upgrade pool now 29.',
    ],
  },
  {
    id: '2026-05-25-10j',
    items: [
      '🔨 NEW UPGRADE — Hammer Shower (Sustain). Start of each slot, gain +2 Hammers per stack to your bank.',
      'Stack 3× and you start every slot with 6 free hammers. Perfect for lock-heavy + Ironclad-awakening builds.',
      'Upgrade pool now 28.',
    ],
  },
  {
    id: '2026-05-25-10i',
    items: [
      '🦷🔊 The Eater now has a dedicated CHOMP sound effect — low descending growl + filtered noise crunch when the jaws bite down. Much more menacing than the generic match sound.',
    ],
  },
  {
    id: '2026-05-25-10h',
    items: [
      '❄️ NEW UPGRADE — Frost (Sustain). Every 7 swaps, every lock on the board loses 1 level per stack. Auto-cracks locks over time.',
      'Combines with Iron Tongue relic + Lockpick mutator for a complete anti-lock build.',
      'Upgrade pool now 27.',
    ],
  },
  {
    id: '2026-05-25-10g',
    items: [
      '🛒 MORE MERCHANTS — the mid-run merchant now also appears after slots 33 and 73 (in addition to 13 and 53). Four shop events per 100-slot run.',
      'More chances to convert your gem hoard into in-run boosters between bosses.',
    ],
  },
  {
    id: '2026-05-25-10f',
    items: [
      '🐢 NEW MUTATOR — Slow Down. The Eater skips this slot entirely. Pure breathing room in the late-game.',
      'Mutator pool now 15.',
    ],
  },
  {
    id: '2026-05-25-10e',
    items: [
      '💝 NEW MUTATOR — Surprise Life. +1 Life at slot start. Pure defensive buff for when the run feels tight.',
      'Mutator pool now 14.',
    ],
  },
  {
    id: '2026-05-25-10d',
    items: [
      '💰 NEW MUTATOR — Treasure Slot. Finishing this slot grants +5 💎 on top of your usual reward.',
      'Mutator pool now 13.',
    ],
  },
  {
    id: '2026-05-25-10c',
    items: [
      '🕳 NEW CRAZY TILE — Wormhole! Pop a Wormhole to swap a random pair of distant tiles on the board, creating brand new match opportunities.',
      'Rare (weight 0.4, same as Prism). Spins ominously in dark blue + green. Crazy tile pool now 5.',
    ],
  },
  {
    id: '2026-05-25-10b',
    items: [
      '🗝 NEW MUTATOR — Lockpick. Slot starts with every lock on the board weakened by 1 level. Saves the slot when paired with a lock-heavy layout.',
      'Mutator pool now 12.',
    ],
  },
  {
    id: '2026-05-25-10a',
    items: [
      '✨ TIERED SCORE POPS — big matches now get BIG numbers. Scores 500+ pop in orange at 44px, scores 2,000+ pop in hot pink at 60px.',
      'Snowball + Big Brain + cascade-king late-slot scores are now genuinely satisfying to watch.',
    ],
  },
  {
    id: '2026-05-25-9z',
    items: [
      '🤠 NEW RELIC — Quick Draw. The first power-up you use each slot is FREE, whatever kind it is.',
      'Stacks with Ironclad awakening — Ironclad gets a free hammer, then Quick Draw gives you another free power-up of any kind.',
      'Relic pool now 19.',
    ],
  },
  {
    id: '2026-05-25-9y',
    items: [
      '🛡 NEW UPGRADE — +3 Moves (Sustain). Stronger sibling of +2 Moves. Every slot starts with 3 extra moves per stack.',
      'Upgrade pool now 26.',
    ],
  },
  {
    id: '2026-05-25-9x',
    items: [
      '🏅 Level Select now shows your BEST SCORE per level — see "Best: 4,250" right under the star rating on each tile.',
      'Chase higher scores on levels you\'ve already cleared. Combine with the new leftover-moves bonus for bigger numbers.',
    ],
  },
  {
    id: '2026-05-25-9w',
    items: [
      '➕ LEFTOVER-MOVES BONUS in Levels mode! When you beat a level with moves to spare, each unspent move converts to +25 points (classic Candy-Crush style).',
      'Bumps your best-score record if it pushes you over. Encourages efficient play, not just barely scraping by.',
      'Roguelike still uses Crown of Sweetness relic (50 pts/move) — the relic is now strictly better.',
    ],
  },
  {
    id: '2026-05-25-9v',
    items: [
      '🎁 BOSS BONUS — defeating a boss now grants BOTH a Relic pick AND a free Upgrade pick (instead of just the relic).',
      'Boss fights now compound your build twice as fast. Earlier bosses snowball into stronger builds for the late-run challenges.',
    ],
  },
  {
    id: '2026-05-25-9u',
    items: [
      '✨ NEW RELIC — Stardust. Every cascade chain of 4 or more earns you a free 💎 mid-run.',
      'Pair with cascade-king + Big Brain + Snowball for chain-heavy builds that print gems.',
      'Relic pool now 18.',
    ],
  },
  {
    id: '2026-05-25-9t',
    items: [
      '🎯 NEW UPGRADE — Snowball (Scorer). Each match in a slot multiplies the next match\'s score by 3% per stack. Compounds — match 20 with 1 stack scores ×1.80 baseline.',
      'Capped at 60 effective stacks per match to keep things sane. Pair with Big Brain relic for runaway late-slot scores.',
      'Upgrade pool now 25.',
    ],
  },
  {
    id: '2026-05-25-9s',
    items: [
      '🔮 NEXT MILESTONE HINT — the run HUD now shows what\'s coming up: "Next: ⚔ Boss in 3 slots" or "Next: 🌪 Mutator in 2 slots".',
      'Plan your build around the upcoming challenge — save power-ups for the boss, or rush a Lucky Day mutator.',
    ],
  },
  {
    id: '2026-05-25-9r',
    items: [
      '💣 NEW UPGRADE — Crazy Magnet (Bomber). Every 3rd match per slot auto-spawns a random crazy tile (TNT 💣 / Void 🌀 / Bolt ⚡ / Prism 🌈).',
      'Stacking spawns multiple per trigger. Combined with Chain Bomb, Bomb Maker, and Crazy Sense meta — a true Bomber build now drowns the board in crazies.',
    ],
  },
  {
    id: '2026-05-25-9q',
    items: [
      '🛒 MID-RUN MERCHANT! After slots 13 and 53, a shop blocks the path. Spend your 💎 on per-run boosters before continuing.',
      'Three items: ❤️ +1 Life (15💎) · 🎁 +1 of every power-up (8💎) · 👑 Random Relic (20💎). Buy any/all you can afford then Continue.',
      'Real Slay-the-Spire-style economy — save gems for the shop, or spend them on permanent skill-tree upgrades. Your choice.',
    ],
  },
  {
    id: '2026-05-25-9p',
    items: [
      '📋 Run inventory now LISTS each upgrade by name (Score Boost ×2, Bomb Maker, Lightning, etc.) below the archetype tallies. Hover for description.',
      'Combined with the relic descriptions, the inventory panel is now a real "build sheet" you can consult mid-run.',
    ],
  },
  {
    id: '2026-05-25-9o',
    items: [
      '🦷🦷 DOUBLE EATER at slot 90+! When The Eater fires in the final stretch (slots 90-99), TWO chomps drop from different columns.',
      'Combined with the slot 90 Eater interval of 3 moves, the late-run is genuinely intense. Stack 🛡 Sustain and ❤️‍🔥 Phoenix for survival.',
    ],
  },
  {
    id: '2026-05-25-9n',
    items: [
      '📊 SKILL TREE STATS — the gem counter at the top of the Skill Tree now shows a stats line: "X runs · Y completes · best slot Z".',
      'See your overall progression at a glance whenever you open the tree.',
    ],
  },
  {
    id: '2026-05-25-9m',
    items: [
      '🎁 GENEROUS STARTER — slot 1 of every roguelike run now grants +1 of every power-up to your bank (hammer, shuffle, colour bomb, +3 moves).',
      'Smoother on-ramp for the long marathon. Combine with Sweet Start meta (+1 hammer at slot 1) to set up an even fatter opening.',
    ],
  },
  {
    id: '2026-05-25-9l',
    items: [
      '🌀 NEW RELIC — Whirlpool. Every 10 matches the board reshuffles in place (specials preserved). Opens new opportunities when you\'re stuck.',
      'Relic pool now 17.',
    ],
  },
  {
    id: '2026-05-25-9k',
    items: [
      '🏆 BOSS DEFEATED BANNER — replaces the tiny "BOSS DEFEATED!" toast with a full-screen gold-and-pink victory banner: trophy icon, boss name, and "Pick your relic" tip.',
      'The final boss (Candy Kraken) gets the special "YOU WIN!" tier label with the crown icon and run-complete tip.',
    ],
  },
  {
    id: '2026-05-25-9j',
    items: [
      '🎁 DAILY LOGIN BONUS — your first visit each calendar day grants gems for the Skill Tree.',
      '5💎 base + your streak count, capped at 25💎/day. Pair with the Daily Bonus skill in the tree for runaway gem income.',
    ],
  },
  {
    id: '2026-05-25-9i',
    items: [
      '📚 First-time Roguelike WELCOME — new players entering Roguelike for the first time get a one-page rundown of all the new systems: Classes, Synergy, Relics, Mutators, and Enemies. Click "Let\'s go" to pick your class.',
      'Persists "seen" status so you only see it once. Veterans skip straight to the class picker.',
    ],
  },
  {
    id: '2026-05-25-9h',
    items: [
      '📋 TAP THE RUN HUD to see your full build at any time — class, archetype tallies, AND each relic with its full description (not just an icon).',
      'No more "wait what does this relic do again?" mid-run.',
    ],
  },
  {
    id: '2026-05-25-9g',
    items: [
      '🎯⚡ 2 NEW UPGRADES — pool now 23 across all archetypes.',
      '🎯 Gold Rush (Scorer) — every match earns a flat +20 score per stack on top of any multiplier · ⚡ Thunder Foot (Sustain) — every 8 swaps in a slot, gain +2 free moves per stack.',
    ],
  },
  {
    id: '2026-05-25-9f',
    items: [
      '🦷⚡ The Eater accelerates in late-game roguelike — every 5 moves until slot 74, every 4 moves at slot 75+, every 3 moves at slot 90+.',
      'Boss slots are still safe from the Eater. The Slay-the-Spire telegraph still gives you 2 moves of warning regardless of interval.',
      'Real escalation as you approach the final boss.',
    ],
  },
  {
    id: '2026-05-25-9e',
    items: [
      '⛰ POST-GAME LEVELS 101-110 — "Beyond the Apocalypse" — ten brutal challenges for players who cleared the Sweet Apocalypse and want more.',
      'Aftermath (5k in 25 moves, no obstacles) · Cascade Trial (8 specials in 22) · Jelly Armageddon (full board of double-jelly) · Cherry Purgatory (7 cherries) · Iron Grip (24 type clears through a lock maze) · Centurion (50 matches in 50) · Champion\'s Ladder (8k in 30) · Locked-down Vault (almost every cell locked) · Rainbow Rite (10 specials!) · Beyond the Summit (12k score through everything — the new top).',
    ],
  },
  {
    id: '2026-05-25-9d',
    items: [
      '👑 3 MORE RELICS — pool now 16. Try them all.',
      '🪅 Piñata — every 5 matches drops a random power-up · 🧠 Big Brain — +25% score per cascade level (additive on top of cascade-king) · 🌬 Second Wind — start a slot with only 1 life left and you bounce back to 2.',
    ],
  },
  {
    id: '2026-05-25-9c',
    items: [
      '💥 CRAZY TILE CHAIN REACTIONS — if a crazy tile\'s blast zone contains ANOTHER crazy tile, the second one chains and pops too. Stack them for spectacular combos.',
      'TNT next to a Bolt = explosion + row+column clear. Prism + TNT = colour wipe + bomb. Chain potentially extends through Void → TNT → Bolt → Prism cascades.',
      'Visible "💥 CHAIN!" toast on each link.',
    ],
  },
  {
    id: '2026-05-25-9b',
    items: [
      '🪨 NEW ENEMY — Grumblock! A wandering grey rock with little eyes that drifts around the board. It locks its current tile so you can\'t match it.',
      'Spawns on slot 50+ (non-boss). Every 4 swaps it picks a random adjacent tile and moves there. Pop it by clearing matches in an adjacent tile.',
      'Slot 80+ gets TWO Grumblocks shuffling around at once. Plan your matches around the moving threat.',
    ],
  },
  {
    id: '2026-05-25-9a',
    items: [
      '👋 RESUME-RUN TOAST — when you reopen the app with a roguelike run in progress, a "Welcome back!" toast names your class, slot, and how many upgrades + relics you\'re holding.',
      'Spoken aloud too: "Welcome back. Resuming slot 47."',
    ],
  },
  {
    id: '2026-05-25-8z',
    items: [
      '🎵 AUDIO POLISH — cascade chains now climb in pitch much more aggressively (+80Hz per chain level, was +40Hz). Chain ×5+ feels twice as triumphant.',
      'New EPIC CASCADE sweep when you hit a chain of 5 or more: a soaring 6-note rising arpeggio with a sub-bass rumble.',
      'New BOSS STINGER on boss intro — sharp orchestral hit + descending minor 6th + cymbal burst. Replaces the generic "sparkly chord".',
    ],
  },
  {
    id: '2026-05-25-8y',
    items: [
      '✨ MUTATOR juice — mutator activation now shows a brief radial yellow flash across the screen + the HUD chip pulses softly while the mutator is active.',
      'Hard to miss when a slot lights up with a buff.',
      'Reduce-motion users get the chip without the pulse or flash.',
    ],
  },
  {
    id: '2026-05-25-8x',
    items: [
      '📊 Class picker now SHOWS your run history per class — "Run #3 · 1 ✓ · best slot 67" — so you can chase your previous bests on the next run.',
      'Classes you\'ve never played read "Never played — your first run." Try them all!',
    ],
  },
  {
    id: '2026-05-25-8w',
    items: [
      '📈 PER-CLASS RUN STATS — every run tracks runs/completes/best-slot per class. Run summary now shows "Champion run #3, 1 win, best slot 67".',
      'Sanitised + persisted across reloads so your bragging rights survive.',
    ],
  },
  {
    id: '2026-05-25-8v',
    items: [
      '⚔ 5 NEW STARTING CLASSES — pick from 11 classes (up from 6) at run start. Each archetype now has at least 2 paths.',
      '🔥 Pyromaniac (Chain Bomb) · 🌟 Comet (Meteor Shower) · 💰 Merchant (Combo Streak) · 🍃 Druid (First Swap Free) · 🃏 Gambler (Lucky Strike).',
      'Each new class starts with a different free upgrade so you can lean into a Bomber-Wild or Scorer-Sustain hybrid immediately.',
    ],
  },
  {
    id: '2026-05-25-8u',
    items: [
      '🌳 SKILL TREE expands — 4 new permanent meta upgrades to spend gems on!',
      '🔄 Free First Reroll (45💎) — first upgrade reroll of every slot is free · 💫 Crazy Sense (50💎) — crazy tiles spawn 50% more often · ✨ Early Awakening (60💎) — your class awakens with one fewer archetype upgrade · 🪙 Daily Bonus (40💎) — +1 extra gem per slot cleared.',
      'Skill tree total now 12 unlocks across all five archetypes.',
    ],
  },
  {
    id: '2026-05-25-8t',
    items: [
      '🌈 PRISM synergy! New upgrade Prism Maker (Bomber archetype) gives every special a 15% chance to spawn a Prism crazy tile.',
      '🔭 New relic Prism Lens — Prism tiles clear TWO random colors instead of one. Combined with Prism Maker this can wipe most of the board in a single move.',
      'Upgrade pool now 21, relic pool now 13.',
    ],
  },
  {
    id: '2026-05-25-8s',
    items: [
      '🌈 NEW CRAZY TILE — Prism! Pop a Prism crazy tile to instantly clear ALL tiles of one random color across the board. Massive cascade potential.',
      'Prism is rare (weight 0.4 vs 1.0 for the common 3) — when it appears, take advantage. Spins through rainbow colors so you can\'t miss it.',
      'Crazy tile pool grows from 3 (TNT 💣, Void 🌀, Bolt ⚡) to 4 with Prism 🌈.',
    ],
  },
  {
    id: '2026-05-25-8r',
    items: [
      '🪙❤️‍🔥🦅🐘 FOUR MORE RELICS — pool grows from 8 to 12. Pick from a wider variety after every boss.',
      '🪙 Penny Pincher — +2 gems per boss · ❤️‍🔥 Phoenix — auto-revive once when you\'d lose your last life (consumes the relic) · 🦅 Hawkeye — hints appear after 3s idle instead of 7s · 🐘 Elephant Memory — every upgrade reroll is FREE (no Shuffle cost) and you can reroll repeatedly.',
    ],
  },
  {
    id: '2026-05-25-8q',
    items: [
      '✨ Upgrade picker now CALLS OUT the card that would awaken your class — pulsing pink hint: "This pick AWAKENS your class!"',
      'Class picker now shows the awakening details so you can plan your build from the very first choice.',
      'Pick that triggers awakening prints a celebratory "AWAKENED!" in the toast + speech.',
    ],
  },
  {
    id: '2026-05-25-8p',
    items: [
      '🎺💥 BOSS MUSIC! Boss slots now play a faster, more aggressive variant of the chiptune — tempo bumps from 132 to 178 BPM, bass doubles to every half-beat, snare rolls every bar.',
      'When you survive the boss the music drops back to the standard chip groove. Feels like a real escalation.',
    ],
  },
  {
    id: '2026-05-25-8o',
    items: [
      '🔄 REROLL the upgrade picker! Don\'t love your 3 choices? Spend 1 Shuffle from your bank to get 3 fresh ones.',
      'Only one reroll per slot — choose wisely. Hidden if you have no Shuffles to spend.',
      'Combined with Wider Choice meta + Wanderer awakening, you can now see up to 5 cards then reroll for 5 more — real build-shaping options.',
    ],
  },
  {
    id: '2026-05-25-8n',
    items: [
      '💾 RUN STATE PERSISTS across reloads — close the tab mid-run and your class, upgrades, and relics are all there when you come back.',
      'On a 100-slot marathon this is huge: never lose a 9-relic build to a stray browser refresh.',
      'Save layer now stores runUpgrades + runRelics + inRoguelikeRun, with array length capped at 200 entries to keep storage tidy.',
    ],
  },
  {
    id: '2026-05-25-8m',
    items: [
      '📜 RUN SUMMARY — at the end of every run (complete or fail), a recap card appears with: class, slot reached, gems earned, total gems, best slot, archetype tallies, and all relics collected.',
      'Satisfying closure to the 100-slot marathon. See your full build at a glance.',
    ],
  },
  {
    id: '2026-05-25-8l',
    items: [
      '🐙 BOSS INTRO BANNER — every boss slot now opens with a dramatic full-screen reveal: tier label, boss icon, name, and tip. Pink-purple gradient with a yellow border that bursts in and gracefully fades.',
      'Each of the 10 bosses gets a thematic icon: 🍮 Jelly Guardian · 🔒 Lock Tyrant · 👑 Sweet King · 🐌 Snail · 🗿 Pharaoh · 🍒 Hydra · 👻 Wraith · 🕷 Lattice Queen · 🧁 Confectioner · 🐙 Candy Kraken.',
      'Reduce-motion users get the banner without the bouncy animation.',
    ],
  },
  {
    id: '2026-05-25-8k',
    items: [
      '🃏 FOUR NEW UPGRADE CARDS — Combo Streak (cascade chain ≥3 ×2 score) · Chain Bomb (TNT pops spawn more TNT) · First Swap Free (first swap of every slot is free) · ☄️ Meteor Shower (every 8 matches, 3 random tiles explode).',
      'Upgrade pool grows from 16 to 20 cards — deeper archetype variety for the long marathon.',
      'Meteor stacks accelerate the threshold: 2 meteors fire every 6 matches, 3 every 4 matches. Goes wild with Stormbringer awakening + Wild synergy.',
    ],
  },
  {
    id: '2026-05-25-8j',
    items: [
      '✨ CLASS AWAKENINGS — each class unlocks a unique passive once you have 2+ upgrades of its archetype (Wanderer: 3+ total).',
      '⚔ Champion: first match per slot scores 5× · 🌪 Stormbringer: Lightning becomes a row+column CROSS BLAST · 🛡 Ironclad: first hammer per slot is free · 💣 Bombardier: TNT pops also spawn a 🎁 power-up · 🍀 Charmer: Lucky-MODE lasts +3 extra matches · 🎲 Wanderer: +1 extra upgrade card every slot.',
      'AWAKENED chip flashes in the run HUD once your build is committed.',
      'Real build payoff — stack your class\'s archetype to unlock the passive that makes that class shine.',
    ],
  },
  {
    id: '2026-05-25-8i',
    items: [
      '🌑🎁🦄🍭🔨 FIVE MORE WACKY MUTATORS for variety on the 100-slot marathon. Total mutator pool now 11.',
      '🌑 Eclipse — free moves every other swap · 🎁 Gift Slot — +1 of EVERY power-up at slot start · 🦄 Unicorn Day — random ×0.5 to ×3 per match · 🍭 Sweet Tooth — every special candy auto-upgrades to RAINBOW · 🔨 Hammer Time — hammers are free this slot.',
      'Whacky and wild — every 5th slot is a surprise.',
    ],
  },
  {
    id: '2026-05-25-8h',
    items: [
      '🌪 SLOT MUTATORS — every 5th roguelike slot (5, 15, 25, … excluding bosses) rolls a random one-slot buff that changes how the slot plays.',
      'Six mutators: ☀️ Golden Hour (×2 scores) · 💎 Diamond Day (+100 per match) · 🍀 Lucky Day (Lucky bar starts FULL) · 🌪 Quick Slot (+5 moves) · 💫 Crazy Rain (crazy tile every 4 swaps) · 🏆 Big Spender (5+ matches ×3).',
      'Active mutator appears in the run HUD with a tooltip and a full-screen toast on slot start.',
    ],
  },
  {
    id: '2026-05-25-8g',
    items: [
      '🧭 RUN HUD — a new strip above the board shows your roguelike build at a glance: current class, archetype tallies (🎯×3 💣×2 …), and held relics 🎩🐢🍰.',
      'Updates live on every slot start, upgrade pick, and relic pick. Hidden outside roguelike mode.',
      'Hover/tap a relic icon to see its description without opening any menu.',
    ],
  },
  {
    id: '2026-05-25-8f',
    items: [
      '👑 RELICS! Every boss kill rewards you with a Relic pick — choose 1 of 3 rare per-run passives that completely change how the run plays.',
      'Eight relics in the pool: 🎩 Top Hat (random p-up every 5 swaps) · 🐢 Slow Turtle (+5 moves per slot) · 🍰 Sugar Rush (first 3 matches score 3×) · 👑 Crown of Sweetness (leftover moves → 50 pts each) · 🎰 Slot Machine (8% chance per swap to spawn a crazy tile) · 🦴 Iron Tongue (auto-break a lock each slot) · 🛰 Echo Drone (specials charge Lucky bar) · 🪞 Mirror Shard (4-matches score 50% more).',
      'Up to 9 relics per full run. Pair them with your class + upgrades for true Slay-the-Spire-style build variety.',
    ],
  },
  {
    id: '2026-05-25-8e',
    items: [
      '⚔ STARTING CLASSES — every roguelike run now opens with a class pick. Six classes, each grants a free starting upgrade that pushes you toward an archetype.',
      '🎲 Wanderer (no bonus, pure freedom) · 💣 Bombardier (Bomb Maker) · 🍀 Charmer (Lucky Fast) · 🛡 Ironclad (+2 Moves) · 🌪 Stormbringer (Lightning) · ⚔ Champion (Score Boost).',
      'Combined with the new synergy system, classes give you a head start on a build path — pick Bombardier and chase Bomber upgrades for 7×7 MEGA BOOMs, or Wanderer for a fully self-directed run.',
      'Also: roguelike save now correctly caps at slot 100 (was clamping to 30 before — a stealth bug for anyone past slot 30).',
    ],
  },
  {
    id: '2026-05-25-8d',
    items: [
      '🧬 BUILD ARCHETYPES — every upgrade now belongs to one of five archetypes: 🎯 Scorer, 💣 Bomber, 🍀 Lucky, 🛡 Sustain, ⚡ Wild. The picker shows the archetype badge so you can shape a build.',
      'Synergy bonuses kick in at 2+ stacks in the same archetype: Scorer +15% score per stack · Bomber +1 TNT radius per stack (3×3 → 5×5 → 7×7 MEGA BOOM) · Lucky +20% bar fill per stack · Sustain +1 power-up bank cap per stack · Wild abilities cool down 25% faster per stack.',
      'Pick the same archetype repeatedly and your run takes a distinct shape: Survivors-style snowball.',
      'Build tracker chip in the picker shows your current archetype tallies. Synergy hints appear on every card.',
    ],
  },
  {
    id: '2026-05-25-8c',
    items: [
      '🏰 ROGUELIKE → 100 SLOTS. The run is now a real marathon: 100 slots, bosses every 10.',
      'Seven new bosses: Chocolate Snail (40), Padlock Pharaoh (50), Cherry Hydra (60), Echo Wraith (70), Lattice Queen (80), The Confectioner (90), and the FINAL BOSS — Candy Kraken (100) — 60 moves to score 12,000 with every obstacle in play.',
      'Run-complete bonus bumped from 20💎 to 50💎. Each boss still grants 5💎 (10💎 with Boss Slayer skill).',
    ],
  },
  {
    id: '2026-05-25-8b',
    items: [
      '🎯 100 LEVELS! Levels mode expanded from 39 to 100 across 12 themed chapters: Cherry Orchard, Combo Storm, Jelly Maze, Lock Tyrant, Special Lab, Cherry Forest, Match Marathon, Rainbow Rush, Stronghold, Cherry Vault, Jelly Castle, and Mastery.',
      'Level 100 — "Sweet Apocalypse" — is the summit: cherries + jelly + locks + 8,000 points in 50 moves.',
      'Smooth difficulty curve: every chapter introduces a new twist on familiar mechanics. Halfway-home gets its own jelly heavyweight at level 50.',
    ],
  },
  {
    id: '2026-05-25-8a',
    items: [
      '🎺 Roguelike music REPLACED with a Guile\'s-Theme-style 16-bit chiptune march — driving D-minor groove, square-wave melody, marching snare backbeat, octave-jumping bass.',
      'Drops the lo-fi pads + vinyl crackle in roguelike mode — the chiptune carries the whole vibe.',
      'Two looping songs alternate so the run doesn\'t get monotonous. 132 BPM keeps the tempo up.',
    ],
  },
  {
    id: '2026-05-25-7p',
    items: [
      '🦷 You can actually SEE The Eater now — repositioned + bigger entrance. It descends from above and the jaws land squarely over the top 3 cells of the target column.',
      'Slay-the-Spire-style telegraph: two moves before The Eater chomps, a hot-pink warning arrow appears above the doomed column with a countdown (2 → 1 → CHOMP). Plan around it.',
      'Reduce-motion users get the warning text without the bobbing arrow.',
    ],
  },
  {
    id: '2026-05-25-7o',
    items: [
      '💣🌀⚡ NEW: Crazy Tiles appear organically on the board after big matches and deep cascades. Pop them by matching for huge effects.',
      '💣 TNT — explodes in a 3×3 area. 🌀 Void — sucks 8 random tiles. ⚡ Bolt — clears its whole row + column.',
      'Three new upgrade cards boost crazy tiles: Bomb Maker (specials also drop TNT), Void Touched (Void spawns 2× more often), Storm Caller (a Bolt waits for you every slot start).',
      'So roguelike upgrades are now a real mix: passive bonuses + automatic abilities + crazy-tile spawners.',
    ],
  },
  {
    id: '2026-05-25-7n',
    items: [
      '🦷 HARD MODE bite! From Roguelike slot 9+, every 5 moves THE EATER drops down from above with a big jaw, eyes glowing, and chomps the top 3 candies of a random column.',
      'Eater respects locks, jelly, and cherries (it won\'t eat through them).',
      'Skips boss slots — those are already mean enough.',
      'More hard-mode mechanics coming: a moving Grumblock enemy and wandering-eye tiles are next.',
    ],
  },
  {
    id: '2025-05-24-7m',
    items: [
      '⚡ NEW upgrade: Lightning Strike — every 4 matches a real lightning bolt zigzags across the screen and clears a whole row.',
      '🌀 NEW upgrade: Black Hole — at the start of each slot, a vortex appears at the centre and SUCKS 5 random candies in spiraling.',
      '🐍 NEW upgrade: Hungry Snake — make a special candy and a green snake slithers across the board eating 4 random tiles in its wake.',
      'All three abilities stack — pick the same upgrade twice and it triggers more often / eats more / clears bigger.',
    ],
  },
  {
    id: '2025-05-24-7l',
    items: [
      'Roguelike theme rebuilt for readability — solid dark slate, pure white text, hot-pink + gold only on borders and chips. Every label, dialog, card and toast is now legible.',
      'Lives system added — every run starts with 3 lives (♥♥♥ on the chip). Failing a slot costs one life. Out of lives = run over.',
      'New meta skills in the Skill Tree: Extra Life (35 💎) and Two Extra Lives (70 💎) — bring more lives into every future run.',
      'Mode-switch animations rebuilt — each mode has its own drawn-out animation: a 1.6s blood-red iris-blast into Roguelike, a 1.3s sunshine burst into Levels, a 1.1s pastel sweep into Free Play.',
    ],
  },
  {
    id: '2025-05-24-7k',
    items: [
      'Roguelike progression FIXED — hitting the score target on a slot now actually shows the level-complete dialog. The win-check used to early-return for any mode that wasn\'t Levels.',
      'Move counter now ticks down in Roguelike mode too (same fix).',
      'High Contrast and Roguelike themes are now fully accessible — every label, hint, footer, dialog, card and toast has readable text on the dark background.',
      'Streak chip + install toast + cards all get proper dark-mode variants.',
    ],
  },
  {
    id: '2025-05-24-7j',
    items: [
      'Roguelike mode now SHOWS its goals mid-run — slot number, objective, move counter and progress bar all visible.',
      'Mode-switch animation — a wicked red-purple wipe blasts across the screen when entering Roguelike, a soft wipe for Levels/Free Play.',
      'Roguelike music switches to a darker dungeon progression (minor 7ths, lower bass).',
      'Manual Shuffle no longer wipes cherries on cherry levels.',
      '"What\'s new" notifications now appear on every update automatically.',
    ],
  },
  {
    id: '2025-05-24-7f',
    items: [
      'NEW: Roguelike mode — 30 slots with bosses at 10, 20, 30. Settings → Mode → Roguelike.',
      'Pick an upgrade between slots — buffs, consumables, or synergies. They stack within the run.',
      'Earn gems from runs and spend them in the Skill Tree (Settings → Skill Tree) for permanent boosts.',
      'Dedicated boss battles: Jelly Guardian (10), Lock Tyrant (20), Sweet King (30).',
      'Lucky bar reworked: drains when idle, bursts to ×3, sustains ×1.5 for 4 more matches.',
      'Install Sweet Match to your home screen — one-tap prompt on supported browsers.',
    ],
  },
];
const APP_VERSION = CHANGELOG_ENTRIES[0].id;
const CHANGELOG = CHANGELOG_ENTRIES[0].items;
// Now that APP_VERSION is known, retro-fit it onto telemetry as a
// user prop (lives alongside the existing telemetry.init from boot).
telemetry.setUserProps({ app_version: APP_VERSION });
telemetry.track('boot', {
  daily_login_gems: dailyLoginGems,
  streak: persisted.streak || 0,
  has_run_in_progress: !!persisted.inRoguelikeRun,
});
const LUCKY_PER_MOVE = 12;            // % per successful swap
const LUCKY_INSTANT_MULTIPLIER = 3;   // burst on first match after fill
const LUCKY_MODE_MATCHES = 4;         // additional matches at lower mult
const LUCKY_MODE_MULTIPLIER = 1.5;
const LUCKY_DRAIN_AFTER_MS = 7000;    // idle before drain starts
const LUCKY_DRAIN_INTERVAL_MS = 250;
const LUCKY_DRAIN_PER_SEC = 6;        // % per second once draining
const SURPRISE_DROP_MIN_TILES = 6; // Match must clear this many tiles to roll
const SURPRISE_DROP_CHANCE = 0.28; // 28% on a 6+ match

// Per-type stash caps. Hammer / shuffle are "consumable utilities" so the
// base ceiling is higher; color bomb / +moves are run-bending, so the
// base ceiling is tight. The skill tree's "Bigger Bank" + roguelike
// sustain synergy + Caretaker upgrade + Power Friday mutator each raise
// these — see effectivePowerupCap().
const BASE_POWERUP_CAPS = { hammer: 3, shuffle: 3, colorBomb: 1, plusMoves: 1 };
const PLUS_MOVES_BONUS = 3;

function powerupBank() {
  if (!state.levelProgress.powerupBank) {
    state.levelProgress.powerupBank = { hammer: 3, shuffle: 3, colorBomb: 1, plusMoves: 1 };
  }
  return state.levelProgress.powerupBank;
}

// Clamp every power-up in the bank to its current per-type cap. Used
// after caps shrink (e.g., player respec/refresh) or as a defensive
// post-condition after award sites.
function clampPowerupBank() {
  const bank = powerupBank();
  for (const key of Object.keys(BASE_POWERUP_CAPS)) {
    const cap = effectivePowerupCap(key);
    if ((bank[key] || 0) > cap) bank[key] = cap;
  }
  setPowerupCounts(bank);
}

function spendPowerup(kind) {
  const bank = powerupBank();
  if ((bank[kind] || 0) <= 0) return false;
  // 🎉 Powerup Party mutator — every power-up is free for the slot.
  if (hasMutator('powerup-party')) {
    return true;
  }
  // 🔨 Hammer Time mutator — hammers are free for the slot.
  if (kind === 'hammer' && hasMutator('hammer-time')) {
    return true;
  }
  // 🔄 Sweet Reset relic — shuffles are free during boss slots.
  if (kind === 'shuffle' && hasRelic('sweet-reset') && state.level?.isBoss) {
    return true;
  }
  // 🛡 Ironclad AWAKENING — first hammer per slot is free.
  if (kind === 'hammer' && isClass('ironclad') && classAwakened() && !state.ironcladHammerUsed) {
    state.ironcladHammerUsed = true;
    flashMessage('🛡 Ironclad: free hammer!', 1000);
    return true;
  }
  // 🤠 Quick Draw relic — first power-up of any kind per slot is free.
  if (hasRelic('quick-draw') && !state.quickDrawUsed) {
    state.quickDrawUsed = true;
    flashMessage(`🤠 Quick Draw! Free ${kind}`, 1000);
    return true;
  }
  // 💣 Free Bomb upgrade — first N Color Bombs per slot are free.
  if (kind === 'colorBomb' && upgradeCount('free-bomb') > 0) {
    const used = state.freeBombsUsed || 0;
    if (used < upgradeCount('free-bomb')) {
      state.freeBombsUsed = used + 1;
      flashMessage('💣 Free Bomb!', 900);
      return true;
    }
  }
  bank[kind]--;
  setPowerupCounts(bank);
  persist();
  // 🧠 Sweet Memory relic — using any power-up grants +5% Lucky bar.
  if (hasRelic('sweet-memory') && state.inRoguelikeRun) {
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 5);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }
  return true;
}

function earnPowerups(stars) {
  const bank = powerupBank();
  bank.hammer = Math.min(effectivePowerupCap('hammer'), (bank.hammer || 0) + 1);
  if (stars >= 2) {
    bank.shuffle = Math.min(effectivePowerupCap('shuffle'), (bank.shuffle || 0) + 1);
  }
  if (stars >= 3) {
    bank.colorBomb = Math.min(effectivePowerupCap('colorBomb'), (bank.colorBomb || 0) + 1);
    bank.plusMoves = Math.min(effectivePowerupCap('plusMoves'), (bank.plusMoves || 0) + 1);
  }
  setPowerupCounts(bank);
}

sfx.setMuted(!state.settings.sound);
speech.setSpeechEnabled(state.settings.speech);

const achievements = createAchievements({
  speak: (text) => speech.speak(text),
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const HINT_IDLE_MS = 7000;
let hintTimer = null;

function cancelHint() {
  clearTimeout(hintTimer);
  clearHintGlow();
}

function isSwappable(c, r) {
  if (state.board.isIngredient(c, r)) return false;
  if ((state.lockMap.get(`${c},${r}`) || 0) > 0) return false;
  return true;
}

function scheduleHint() {
  cancelHint();
  // 🧚 Fairy Light relic — hints appear after 0.8s idle (fastest).
  // 🐟 Goldfish relic — hints appear after 1.5s idle.
  // 🦅 Hawkeye relic — hints appear after 3s idle instead of 7s.
  const delay = hasRelic('fairy-light') ? 800 : (hasRelic('goldfish') ? 1500 : (hasRelic('hawkeye') ? 3000 : HINT_IDLE_MS));
  hintTimer = setTimeout(() => {
    if (state.busy) {
      scheduleHint();
      return;
    }
    const swap = findAnyValidSwap(state.board, isSwappable);
    if (swap) showHintGlow(swap.a, swap.b);
  }, delay);
}

async function ensureMovesAvailable() {
  if (hasAnyValidSwap(state.board, isSwappable)) return;
  // Loud explanation so the player understands WHY the board is changing
  flashMessage('No moves — shuffling!', 1500);
  speech.speak('No moves. Shuffling.');
  haptics.invalid();
  await delay(280);
  // Spin-out animation across the whole board
  const tiles = document.querySelectorAll('#board .tile');
  tiles.forEach((t, i) => {
    t.style.animationDelay = `${i * 8}ms`;
    t.classList.add('shuffling');
  });
  await delay(520);
  preservingReshuffle();
  // Render with the intro-drop animation so new tiles cascade back in
  renderBoard(state.board, state, { intro: true });
  await delay(80);
  // After a shuffle the new layout might contain matches — eat them.
  await cascadePendingMatches();
}

// Safety net: if the board has any matches right now, cascade them
// (with normal scoring + cascade visuals) until none remain. Used after
// board load / shuffle / crazy-tile reshapes so stale matches don't
// just sit there.
async function cascadePendingMatches() {
  if (!state.board) return;
  let result = findMatches(state.board);
  let cascadeLevel = 1;
  while (result.positions.length > 0 && !state.cascadeAbort) {
    await processMatchRound(result, cascadeLevel, null);
    result = findMatches(state.board);
    cascadeLevel++;
  }
}

// Trigger the ♾️ auto-win when score crosses INFINITE_SCORE_THRESHOLD
// in a single level / slot. Called by processMatchRound after the score
// is updated. Once tripped, state.cascadeAbort is set so every cascade
// loop in the code bails on its next iteration. The flag clears on the
// next swap / slot start.
function maybeTriggerInfiniteScore() {
  if (state.score < INFINITE_SCORE_THRESHOLD) return false;
  if (state.cascadeAbort) return true; // already firing
  state.cascadeAbort = true;
  state.infiniteCount = (state.infiniteCount || 0) + 1;
  // 🚌 Emit the canonical `infinite` event so subscribers (run-effects
  // highlight tracker, future relics, etc.) can hook in. Migrated the
  // inline `runHighlights.infiniteCount` bump to a bus.on('infinite')
  // handler in src/game/run-effects.js (PR #17ae).
  bus.emit('infinite', {
    nth_this_session: state.infiniteCount,
    score: state.score,
    slot: state.roguelike?.currentSlot,
  });
  telemetry.track('infinite_combo', {
    nth_this_session: state.infiniteCount,
    score: state.score,
    mode: state.settings?.mode,
    slot: state.roguelike?.currentSlot,
  });
  const n = state.infiniteCount;
  // First infinite of the session is "∞"; second is "∞+1"; third "∞+2"; …
  const label = n === 1 ? '∞' : `∞+${n - 1}`;
  state.scoreOverride = label;
  // Force-satisfy whatever the level objective is so checkLevelOutcome
  // resolves as a win. clearJelly / dropIngredients use board state;
  // others use state.progress / state.score.
  const obj = state.level && state.level.objective;
  if (obj) {
    if (obj.kind === 'score') state.score = Math.max(state.score, obj.target);
    else if (obj.kind === 'matches') state.progress.matches = Math.max(state.progress.matches, obj.target);
    else if (obj.kind === 'specials') state.progress.specials = Math.max(state.progress.specials, obj.target);
    else if (obj.kind === 'clearJelly') {
      state.jellyMap.clear();
      state.progress.jellyRemaining = 0;
    } else if (obj.kind === 'dropIngredients') {
      state.progress.ingredientsDropped = Math.max(
        state.progress.ingredientsDropped,
        state.progress.ingredientsTotal || obj.target || 0
      );
    } else if (obj.kind === 'clearType') {
      state.progress.type[obj.type] = Math.max(state.progress.type[obj.type] || 0, obj.target);
    }
    refreshLevelUI();
  }
  // Paint the score field as the infinity label, locking against
  // further setScore overwrites until the next slot / level start.
  setScoreOverride(label);
  // Big spectacle.
  flashMessage(`♾️ INFINITE COMBO — INSTANT WIN! (${label})`, 3200);
  speech.speak('Infinite combo. Instant win.');
  spawnConfetti(140);
  spawnStarRain(70);
  spawnScreenFlash('rgba(255, 0, 255, 0.55)');
  screenShake(12, 800);
  haptics.epic();
  sfx.playEpicCascade();
  return true;
}

// Shuffle the candies in place while keeping powered-up sweets,
// cherries (ingredients), jelly, and locks where they were. Tries
// a few arrangements until one has no initial matches AND a legal swap;
// falls back to a fresh fill if it can't find one.
function preservingReshuffle() {
  const board = state.board;
  const movable = [];
  const ingredientCells = [];
  const ingredientKeys = new Set();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      if (!cell) continue;
      if (cell.ingredient) {
        ingredientCells.push({ c, r, cell });
        ingredientKeys.add(`${c},${r}`);
      } else {
        movable.push(cell);
      }
    }
  }
  const slots = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!ingredientKeys.has(`${c},${r}`)) slots.push({ c, r });
    }
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const arr = movable.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    for (let i = 0; i < slots.length; i++) {
      board.set(slots[i].c, slots[i].r, arr[i]);
    }
    for (const p of ingredientCells) board.set(p.c, p.r, p.cell);
    if (
      findMatches(board).positions.length === 0 &&
      hasAnyValidSwap(board, isSwappable)
    ) {
      return;
    }
  }
  // Last resort: fresh fill (loses specials), but keep ingredients.
  board.fillNoMatches();
  for (const p of ingredientCells) board.set(p.c, p.r, p.cell);
}

// Animated mode-switch wipe. Wicked red-purple for Roguelike, soft
// cream-pink for Levels/Free Play. Respects reduce-motion.
function playModeTransition(mode) {
  const el = document.getElementById('mode-transition');
  if (!el) return;
  el.classList.remove('show', 'wicked', 'bright', 'levels');
  let cls = 'bright';
  let duration = 1100;
  if (mode === 'roguelike') {
    cls = 'wicked';
    duration = 1600;
    haptics.epic();
    sfx.playObjectiveComplete('specials');
    screenShake(8, 600);
  } else if (mode === 'levels') {
    cls = 'levels';
    duration = 1300;
    sfx.playRestart();
    haptics.specialBirth();
  } else {
    sfx.playSwap();
  }
  el.classList.add(cls);
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

let _persistFailureWarned = false;
function persist() {
  saveSave({
    highScore: state.highScore,
    streak: state.streak,
    lastPlayedDate: state.lastPlayedDate,
    seenWelcome: state.seenWelcome,
    seenRoguelikeIntro: !!state.seenRoguelikeIntro,
    seenVersion: state.seenVersion,
    installPromptDismissedAt: state.installPromptDismissedAt || 0,
    settings: state.settings,
    levelProgress: state.levelProgress,
    roguelike: state.roguelike,
    inRoguelikeRun: !!state.inRoguelikeRun,
    runUpgrades: state.runUpgrades || [],
    runRelics: state.runRelics || [],
    dailySeedDate: state.dailySeedDate || null,
    dailySeedBestSlot: state.dailySeedBestSlot || 0,
    runHistory: state.runHistory || [],
    runFreeRerolls: state.runFreeRerolls || 0,
    ascensionUnlocked: state.ascensionUnlocked || 0,
    ascensionLevel: state.ascensionLevel || 0,
  });
  // Warn the player ONCE if persist() fails (private mode / quota
  // exceeded / SecurityError). Without this, progress silently doesn't
  // save and the player loses their run on next reload.
  if (!_persistFailureWarned) {
    const status = getSaveStatus();
    if (!status.ok) {
      _persistFailureWarned = true;
      // eslint-disable-next-line no-console
      console.error('[save] persist failed:', status.error);
      flashMessage('⚠ Saving disabled (private mode or storage full)', 5000);
    }
  }
}

// --- Install / Add to Home Screen prompt ---
// On Android (and other PWA-capable browsers) the browser fires
// `beforeinstallprompt`; we capture it and offer a custom Install
// button. On iOS Safari there's no programmatic prompt — we show
// "Tap Share → Add to Home Screen" instead. Dismissed prompts are
// remembered for ~7 days so we don't nag.
let deferredInstallPrompt = null;
const INSTALL_REMINDER_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function shouldShowInstallPrompt() {
  if (isStandalone()) return false;
  const dismissedAt = state.installPromptDismissedAt || 0;
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return days >= INSTALL_REMINDER_DAYS;
}

function showInstallToast(kind) {
  const toast = document.getElementById('install-toast');
  const title = document.getElementById('install-title');
  const body = document.getElementById('install-body');
  const cta = document.getElementById('install-cta');
  if (!toast || !title || !body || !cta) return;
  if (kind === 'ios') {
    title.textContent = 'Add Sweet Match to your home screen';
    body.textContent = "Tap the Share icon, then 'Add to Home Screen'.";
    cta.style.display = 'none';
  } else {
    title.textContent = 'Install Sweet Match';
    body.textContent = 'Get the game on your home screen for one-tap play.';
    cta.style.display = '';
  }
  toast.classList.remove('hidden');
}

function hideInstallToast() {
  const toast = document.getElementById('install-toast');
  if (toast) toast.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (shouldShowInstallPrompt()) showInstallToast('default');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallToast();
});

document.getElementById('install-cta').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  hideInstallToast();
  try {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch {}
  deferredInstallPrompt = null;
  state.installPromptDismissedAt = Date.now();
  persist();
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  hideInstallToast();
  state.installPromptDismissedAt = Date.now();
  persist();
});

// iOS doesn't fire beforeinstallprompt; show the manual instructions
// once on first load if we haven't installed yet. Only fire while the
// start screen is showing — never mid-game (the toast otherwise covers
// the active board on a small phone, blocking play).
if (isIOS() && shouldShowInstallPrompt()) {
  setTimeout(() => {
    if (document.body.classList.contains('start-screen-active')) {
      showInstallToast('ios');
    }
  }, 3000);
}

function maxLivesForRun() {
  let lives = RUN_LIVES_BASE;
  if (hasMeta('extra-life-1')) lives += 1;
  if (hasMeta('extra-life-2')) lives += 1;
  // 💗 Heart Beat upgrade — +1 per stack.
  if (state.inRoguelikeRun) lives += upgradeCount('heart-beat');
  // 🆙 Ascension modifier — A1+ removes one max life.
  lives += ascensionMods().livesAdjust;
  return Math.max(1, lives);
}

// 🆙 Ascensions: post-clear difficulty modifiers (Phase 17r / D12).
// Unlocked after the first run-complete (`state.ascensionUnlocked`),
// the player picks an ascension level (0-3) before starting a run.
// Each level layers a permanent run-difficulty modifier on top of the
// previous one. Modeled after Slay-the-Spire Ascensions / Hades' Heat.
//
// A0: base game.
// A1: -1 max lives (you start with 1 fewer).
// A2: A1 + every non-boss slot has -10% move budget.
// A3: A2 + score-target objectives are +25% harder.
const ASCENSION_LEVELS = [
  { level: 0, name: 'A0 — Base run', desc: 'The standard 100-slot run.' },
  { level: 1, name: 'A1 — Lean Run', desc: '-1 max life. One less mistake to make.' },
  { level: 2, name: 'A2 — Time Pressure', desc: 'A1 + non-boss slots have -10% move budget.' },
  { level: 3, name: 'A3 — High Stakes', desc: 'A2 + score-target objectives are 25% harder.' },
];
function ascensionMods() {
  const lvl = Math.max(0, Math.min(3, state.ascensionLevel || 0));
  return {
    livesAdjust: lvl >= 1 ? -1 : 0,
    moveBudgetMul: lvl >= 2 ? 0.9 : 1,
    scoreTargetMul: lvl >= 3 ? 1.25 : 1,
  };
}
function applyAscensionMods(lvl) {
  if (!lvl) return lvl;
  const mods = ascensionMods();
  let moves = lvl.moves;
  if (!lvl.isBoss && mods.moveBudgetMul !== 1) {
    moves = Math.max(8, Math.round(lvl.moves * mods.moveBudgetMul));
  }
  let obj = lvl.objective;
  if (obj && obj.kind === 'score' && mods.scoreTargetMul !== 1) {
    obj = { ...obj, target: Math.round(obj.target * mods.scoreTargetMul) };
  }
  return { ...lvl, moves, objective: obj };
}

// Helper: returns the rng function the current run's pickers should
// use. For daily-seed runs this is a deterministic seeded mulberry32
// so every player gets the same draft on the same calendar day; for
// normal runs it falls back to Math.random.
function runRng() {
  return state.runRng || Math.random;
}

// Start a daily-seed run. Seed is derived from today's UTC date, so
// every player on the same calendar day gets the same class options,
// upgrade picks, mutators, and relic choices. This is the single
// highest-leverage retention feature in the genre.
function startDailySeedRun() {
  const seed = dailySeed();
  state.runRng = createRng(seed);
  state.runIsDaily = true;
  state.runDailyStamp = dailySeedStamp();
  telemetry.track('daily_seed_start', { stamp: state.runDailyStamp });
  // Reset run state so a daily can't inherit upgrades from a previous run.
  state.inRoguelikeRun = false;
  state.roguelike.currentSlot = 1;
  state.runUpgrades = [];
  state.runRelics = [];
  state.roguelike.currentClass = null; state.runFreeRerolls = 0;
  startRoguelikeRun();
}

function startRoguelikeRun() {
  state.inRoguelikeRun = true;
  if (!state.roguelike.currentSlot || state.roguelike.currentSlot < 1) {
    state.roguelike.currentSlot = 1;
  }
  // Refresh lives if this is a fresh start (slot 1 or zero lives).
  if (state.roguelike.currentSlot === 1 || !state.roguelike.livesRemaining) {
    state.roguelike.livesRemaining = maxLivesForRun();
  }
  if (state.roguelike.currentSlot === 1) {
    state.roguelike.runsStarted = (state.roguelike.runsStarted || 0) + 1;
    state.runUpgrades = [];
    state.runRelics = [];
    state.roguelike.currentClass = null; state.runFreeRerolls = 0;
    // Per-run highlights — surfaced on the run-summary panel when the
    // player finishes (or dies).
    state.runHighlights = {
      maxCascade: 0,
      biggestMatch: 0,
      totalMatches: 0,
      bestSlotScore: 0,
      infiniteCount: 0,
      mutatorsSeen: [],
    };
    // 🔄 Reroll Bank meta — start each run with 3 free upgrade rerolls.
    // Carries between slots; consumed by the upgrade picker.
    state.runFreeRerolls = hasMeta('reroll-bank') ? 3 : 0;
    // 🎒 Pocket Friend meta-skill — start each run with 1 random relic.
    if (hasMeta('pocket-friend')) {
      const choices = pickRelicChoices([], 1, runRng());
      if (choices.length > 0) {
        state.runRelics = [choices[0].id];
        setTimeout(() => {
          flashMessage(`🎒 Pocket Friend: ${choices[0].icon} ${choices[0].name}!`, 1800);
        }, 800);
      }
    }
  }
  if (!state.runHighlights) state.runHighlights = { maxCascade: 0, biggestMatch: 0, totalMatches: 0, bestSlotScore: 0, infiniteCount: 0, mutatorsSeen: [] };
  // Backfill missing fields on resumed runs (forward-compat with old saves).
  if (state.runHighlights.totalMatches == null) state.runHighlights.totalMatches = 0;
  if (state.runHighlights.bestSlotScore == null) state.runHighlights.bestSlotScore = 0;
  if (state.runHighlights.infiniteCount == null) state.runHighlights.infiniteCount = 0;
  if (!Array.isArray(state.runHighlights.mutatorsSeen)) state.runHighlights.mutatorsSeen = [];
  persist();
  // First-ever roguelike run: pop a one-time intro explaining the
  // class / archetype / relic / mutator / enemy systems. Then class.
  if (state.roguelike.currentSlot === 1 && !state.roguelike.currentClass && !state.seenRoguelikeIntro) {
    showRoguelikeIntro(() => {
      state.seenRoguelikeIntro = true;
      persist();
      startRoguelikeRun(); // re-enter to hit the class picker branch
    });
    return;
  }
  // Fresh run with no class yet — show the class picker. The picker
  // grants free starting upgrades that shape the run's archetype.
  if (state.roguelike.currentSlot === 1 && !state.roguelike.currentClass) {
    showClassPicker(CLASSES, ARCHETYPES, (cls) => {
      state.roguelike.currentClass = cls.id;
      for (const id of (cls.start || [])) state.runUpgrades.push(id);
      telemetry.track('run_start', {
        class: cls.id,
        archetype: cls.archetype,
        starting_upgrades: (cls.start || []).slice(),
        runs_completed_before: state.roguelike?.runsCompleted || 0,
      });
      flashMessage(`${cls.icon} ${cls.name} chosen!`, 1600);
      speech.speak(`${cls.name} chosen.`);
      spawnConfetti(30);
      haptics.specialBirth();
      persist();
      refreshRunHud();
      setTimeout(() => playRoguelikeSlot(state.roguelike.currentSlot, { announce: true }), 400);
    }, state.roguelike.classStats || {});
    return;
  }
  playRoguelikeSlot(state.roguelike.currentSlot, { announce: true });
}

function playRoguelikeSlot(slot, { announce = true } = {}) {
  const lvl = applyAscensionMods(getRoguelikeLevel(slot));
  cancelHint();
  hideLevelOverlay();
  state.level = lvl;
  resetBoard();
  applyLevelObstacles(state.level);
  state.movesRemaining = state.level.moves;
  // Apply slot-start mutators / relics FIRST (which is what sets
  // state.slotMutator), THEN emit. With the old order, the
  // mutatorsSeen tracker in run-effects.js was reading the previous
  // slot's mutator instead of the current one — silently empty list
  // for the run summary. Fixed here.
  applyRunUpgradesOnSlotStart();
  bus.emit('slot:start', { slot, isBoss: !!lvl.isBoss, mechanic: lvl.mechanic || null });
  // Defensive: a previous setRunHud({ visible: false }) (e.g. from boot
  // before the run started) could leave the HUD with the `hidden` class
  // even after the run is live. Forcing a refresh here guarantees the
  // build readout is visible from slot 1.
  refreshRunHud();
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  if (announce) {
    state.busy = true;
    const done = async () => {
      state.busy = true;
      try {
        // Fire any visual slot-start FX (Black Hole, Storm Caller, etc.)
        // now that the intro is gone so they don't run under the overlay.
        runDeferredSlotEffects();
        await cascadePendingMatches();
      } finally {
        state.busy = false;
      }
      scheduleHint();
    };
    const p = showLevelIntro(state.level, RUN_LENGTH);
    if (p && typeof p.then === 'function') p.then(done);
    else done();
    if (lvl.isBoss) {
      // Boss intro: dramatic banner overlay + screen flash + shake.
      showBossBanner(lvl, { isFinal: slot === RUN_LENGTH });
      spawnScreenFlash('rgba(255, 0, 110, 0.55)');
      screenShake(10, 520);
      sfx.playBossStinger();
      haptics.epic();
      // Boss music — faster, more aggressive variant of the chiptune.
      sfx.setMusicMode('boss');
      // Red pulsing border on the board for the whole boss fight.
      document.body.classList.add('boss-active');
      if (slot === RUN_LENGTH) document.body.classList.add('boss-final');
    } else {
      // Non-boss slot: back to the standard chip variant.
      sfx.setMusicMode('roguelike');
      document.body.classList.remove('boss-active', 'boss-final');
    }
    speech.speak(
      `Slot ${slot} of ${RUN_LENGTH}.${lvl.isBoss ? ` Boss battle. ${lvl.name}.` : ''} ${lvl.hint}.`
    );
  } else {
    runDeferredSlotEffects();
    cascadePendingMatches().then(() => scheduleHint());
  }
}

function advanceRoguelikeAfterWin() {
  const slot = state.roguelike.currentSlot;
  state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, slot);
  // 🏔 bestSlotScore tracker migrated to a slot:complete bus handler in
  // src/game/run-effects.js (PR #17ac). The emit below feeds the
  // handler the score that used to be read inline here.
  bus.emit('slot:complete', {
    slot,
    isBoss: !!state.level?.isBoss,
    score: state.score,
    movesUsed: (state.level?.moves || 0) - (state.movesRemaining || 0),
  });
  telemetry.track('slot_complete', {
    slot,
    is_boss: !!state.level?.isBoss,
    class: state.roguelike.currentClass,
    upgrades: (state.runUpgrades || []).length,
    relics: (state.runRelics || []).length,
    score: state.score,
    moves_used: (state.level?.moves || 0) - (state.movesRemaining || 0),
  });
  // 💰 Treasure Slot mutator — migrated to bus.on('slot:complete', …)
  // subscriber in run-effects.js (PR #17ay).
  // 🔓 Endless mode: if the player owns `endless-mode` and they've
  // already cleared the Kraken (runsCompleted > 0 OR currentSlot === 100),
  // treat any slot win the same as a regular advance — increment +1
  // and play on. The "run complete" run-summary still fires the first
  // time they clear slot 100 (so they get the reward beat), but
  // subsequent endless-mode slots flow into the regular slot-advance
  // logic below.
  const endlessOn = hasMeta('endless-mode');
  if (slot >= RUN_LENGTH && !endlessOn) {
    // Full run cleared — normal cap path.
    const gems = gemsEarned(slot + 1, true, metaSkills());
    state.roguelike.gems = (state.roguelike.gems || 0) + gems;
    state.roguelike.runsCompleted = (state.roguelike.runsCompleted || 0) + 1;
    // 🆙 Ascension unlock: clearing at level N unlocks N+1 (cap at 3).
    const justBeat = state.ascensionLevel || 0;
    if (justBeat >= (state.ascensionUnlocked || 0)) {
      state.ascensionUnlocked = Math.min(3, justBeat + 1);
      flashMessage(`🆙 Ascension ${state.ascensionUnlocked} unlocked!`, 2400);
      telemetry.track('ascension_unlocked', { level: state.ascensionUnlocked });
    }
    telemetry.track('run_end', {
      outcome: 'complete',
      slot_reached: RUN_LENGTH,
      gems_earned: gems,
      class: state.roguelike.currentClass,
      upgrades: (state.runUpgrades || []).length,
      relics: (state.runRelics || []).length,
      runs_completed_total: state.roguelike.runsCompleted,
      daily: !!state.runIsDaily,
      daily_stamp: state.runDailyStamp || null,
    });
    recordRunHistory({
      ts: Date.now(),
      outcome: 'complete',
      slot: RUN_LENGTH,
      class: state.roguelike.currentClass,
      gems,
      score: state.score || 0,
      daily: !!state.runIsDaily,
      dailyStamp: state.runDailyStamp || null,
    });
    // Daily-seed full clear is the ceiling — record it.
    if (state.runIsDaily) {
      state.dailySeedDate = state.runDailyStamp;
      state.dailySeedBestSlot = RUN_LENGTH;
    }
    state.runRng = null;
    state.runIsDaily = false;
    state.runDailyStamp = null;
    // Show the run summary BEFORE clearing run state so the snapshot
    // can read class, archetypes, and relics.
    showEndOfRunSummary('complete', RUN_LENGTH, gems);
    state.roguelike.currentSlot = 1;
    state.inRoguelikeRun = false;
    state.runUpgrades = [];
    state.runRelics = [];
    state.roguelike.currentClass = null; state.runFreeRerolls = 0;
    document.body.classList.remove('boss-active', 'boss-final');
    persist();
    refreshRunHud();
    flashMessage(`RUN COMPLETE! +${gems} 💎`, 2400);
    speech.speak(`Run complete. You earned ${gems} gems.`);
    // EPIC FANFARE — celebrate the 100-slot triumph in waves so it really lands.
    spawnConfetti(120);
    spawnStarRain(80);
    spawnScreenFlash('rgba(255, 214, 10, 0.4)');
    screenShake(8, 600);
    haptics.epic();
    setTimeout(() => { spawnConfetti(80); spawnStarRain(40); sfx.playObjectiveComplete('specials'); }, 600);
    setTimeout(() => { spawnConfetti(60); spawnStarRain(30); spawnScreenFlash('rgba(255, 0, 110, 0.3)'); }, 1200);
    setTimeout(() => { spawnConfetti(80); sfx.playEpicCascade(); }, 1800);
    return;
  }
  state.roguelike.currentSlot = slot + 1;
  persist();
  // Boss slots and the final slot skip the upgrade picker; other slots
  // offer 3 choices before the next slot starts.
  const justFinished = slot;
  const isBossWin = BOSS_SLOTS.has(justFinished);
  if (isBossWin) {
    state.roguelike.bossesDefeated = (state.roguelike.bossesDefeated || 0) + 1;
    spawnConfetti(80);
    spawnStarRain(40);
    screenShake(7, 400);
    haptics.levelComplete();
    speech.speak('Boss defeated!');
    // Dramatic gold/pink banner. The level just played is the boss
    // we just beat — pull the name from state.level.
    showBossDefeatedBanner(state.level || {}, { isFinal: justFinished >= RUN_LENGTH });
    // 🪙 Penny Pincher relic — +2 gems per boss defeated.
    if (hasRelic('penny-pincher')) {
      state.roguelike.gems = (state.roguelike.gems || 0) + 2;
      flashMessage('🪙 Penny Pincher! +2💎', 1100);
      persist();
    }
    // ❤️ Heart Steal upgrade — boss kills restore +1 life per stack.
    if (upgradeCount('heart-steal') > 0) {
      const heal = upgradeCount('heart-steal');
      state.roguelike.livesRemaining = (state.roguelike.livesRemaining || 0) + heal;
      flashMessage(`❤️ Heart Steal! +${heal} life`, 1100);
      persist();
    }
    // 👑 Sweet Throne relic — boss kill grants +1 of EVERY power-up.
    if (hasRelic('sweet-throne')) {
      const bank = powerupBank();
      for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
        bank[key] = Math.min(effectivePowerupCap(key), (bank[key] || 0) + 1);
      }
      setPowerupCounts(bank);
      flashMessage('👑 Sweet Throne! +1 of each', 1300);
    }
    // 💰 Gold Pile upgrade — +5 gems per stack on each boss kill.
    if (upgradeCount('gold-pile') > 0) {
      const bonus = 5 * upgradeCount('gold-pile');
      state.roguelike.gems = (state.roguelike.gems || 0) + bonus;
      flashMessage(`💰 Gold Pile! +${bonus} 💎`, 1100);
      persist();
    }
    // 🎁 Boss Bounty meta-skill — +1 random power-up per boss kill.
    if (hasMeta('boss-bounty')) {
      const bank = powerupBank();
      const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
        bank[pick] = (bank[pick] || 0) + 1;
        setPowerupCounts(bank);
        flashMessage(`🎁 Boss Bounty! +1 ${pick}`, 1200);
      }
    }
    // Boss reward: relic picker. The final boss skips it (no next slot).
    const isFinalBoss = justFinished >= RUN_LENGTH;
    if (isFinalBoss) {
      setTimeout(() => playRoguelikeSlot(state.roguelike.currentSlot), 1400);
      return;
    }
    setTimeout(() => {
      const choices = pickRelicChoices(state.runRelics || [], 3, runRng());
      showRelicPicker(choices, state.runRelics || [], (relic) => {
        state.runRelics = state.runRelics || [];
        state.runRelics.push(relic.id);
        flashMessage(`${relic.icon} ${relic.name} acquired!`, 1600);
        speech.speak(`${relic.name} acquired.`);
        // Celebratory effects on relic acquisition.
        spawnConfetti(40);
        spawnStarRain(15);
        haptics.specialBirth();
        persist();
        refreshRunHud();
        // Boss BONUS: also offer a free upgrade pick on top of the relic.
        // (Goes straight into the next slot via showUpgradeChoicesForSlot.)
        setTimeout(() => {
          let n = hasMeta('wider-choice') ? 4 : 3;
          if (isClass('wanderer') && classAwakened()) n += 1;
          showUpgradeChoicesForSlot(n, true);
        }, 350);
      });
    }, 1500);
  } else {
    // Mid-run merchant on slots 13 and 53 (between bosses, not on
    // mutator slots, not adjacent to a boss). Player can spend gems
    // on per-run boosters before the upgrade picker appears.
    const SHOP_AFTER_SLOTS = new Set([13, 33, 53, 73]);
    if (SHOP_AFTER_SLOTS.has(justFinished)) {
      runMidRunShop(() => {
        let n = hasMeta('wider-choice') ? 4 : 3;
        if (isClass('wanderer') && classAwakened()) n += 1;
        showUpgradeChoicesForSlot(n, true);
      });
      return;
    }
    // ✨ Crossroads event on slots 27 and 77 — a quick mid-run choice
    // with no cost. Three options, then standard upgrade picker.
    const CROSSROADS_SLOTS = new Set([27, 47, 77, 87]);
    if (CROSSROADS_SLOTS.has(justFinished)) {
      runCrossroadsEvent(() => {
        let n = hasMeta('wider-choice') ? 4 : 3;
        if (isClass('wanderer') && classAwakened()) n += 1;
        showUpgradeChoicesForSlot(n, true);
      });
      return;
    }
    let n = hasMeta('wider-choice') ? 4 : 3;
    // 🎲 Wanderer AWAKENING — +1 upgrade card to choose from.
    if (isClass('wanderer') && classAwakened()) n += 1;
    showUpgradeChoicesForSlot(n, true);
  }
}

function runCrossroadsEvent(onDone) {
  flashMessage('✨ The Crossroads!', 1400);
  speech.speak('The crossroads.');
  // Pool of 5 possible options; show 3 random ones each event so the
  // crossroads stays fresh on its 4 appearances per run.
  const POOL = [
    { icon: '🛍', name: 'The Vault',   desc: 'A FREE random relic added to your run.',         value: 'relic' },
    { icon: '🎁', name: 'The Cache',   desc: '+2 of every power-up immediately.',               value: 'powerups' },
    { icon: '💎', name: 'The Reserve', desc: '+20 💎 instantly. Save them for the shop.',        value: 'gems' },
    { icon: '❤️', name: 'The Spring',  desc: '+1 max life — recover for the back half.',         value: 'life' },
    { icon: '🎲', name: 'The Gamble',  desc: '50/50 — gain +30 💎 or just walk away.',           value: 'gamble' },
    { icon: '💪', name: 'The Forge',   desc: '+1 stack of a random upgrade you already have.',  value: 'forge' },
    { icon: '🍀', name: 'The Well',    desc: 'Your Lucky bar fills to FULL right now.',          value: 'well' },
  ];
  // Shuffle and take 3.
  const shuffled = POOL.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // 🃏 Joker relic — show 4 options instead of 3.
  const numOptions = hasRelic('joker') ? 4 : 3;
  const options = shuffled.slice(0, numOptions);
  setTimeout(() => {
    showCrossroadsEvent({
      options,
      onPick: (choice) => {
        if (choice.value === 'relic') {
          const choices = pickRelicChoices(state.runRelics || [], 1, runRng());
          if (choices.length > 0) {
            const relic = choices[0];
            state.runRelics = state.runRelics || [];
            state.runRelics.push(relic.id);
            flashMessage(`${relic.icon} ${relic.name}!`, 1500);
            speech.speak(`${relic.name} acquired.`);
            spawnConfetti(40);
            spawnStarRain(15);
            haptics.specialBirth();
          } else {
            flashMessage('No new relics — +20 💎 instead', 1500);
            state.roguelike.gems = (state.roguelike.gems || 0) + 20;
          }
        } else if (choice.value === 'powerups') {
          const bank = powerupBank();
          for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
            bank[key] = Math.min(effectivePowerupCap(key), (bank[key] || 0) + 2);
          }
          setPowerupCounts(bank);
          flashMessage('🎁 +2 of every power-up!', 1400);
          spawnConfetti(30);
          haptics.powerup();
        } else if (choice.value === 'life') {
          state.roguelike.livesRemaining = (state.roguelike.livesRemaining || 0) + 1;
          flashMessage('❤️ +1 max life!', 1400);
          spawnConfetti(30);
          haptics.epic();
        } else if (choice.value === 'gamble') {
          if (Math.random() < 0.5) {
            state.roguelike.gems = (state.roguelike.gems || 0) + 30;
            flashMessage('🎲 Lucky! +30 💎', 1500);
            spawnConfetti(50);
            haptics.epic();
          } else {
            flashMessage('🎲 The coin landed wrong. No gems.', 1500);
          }
        } else if (choice.value === 'forge') {
          const list = state.runUpgrades || [];
          if (list.length > 0) {
            const pick = list[Math.floor(Math.random() * list.length)];
            state.runUpgrades = [...list, pick];
            const u = UPGRADES.find((x) => x.id === pick);
            flashMessage(`💪 The Forge — +1 ${u ? u.name : pick}`, 1500);
            spawnConfetti(40);
            haptics.specialBirth();
          } else {
            flashMessage('💪 The Forge — no upgrades yet, +10 💎 instead', 1500);
            state.roguelike.gems = (state.roguelike.gems || 0) + 10;
          }
        } else if (choice.value === 'well') {
          state.luckyCharge = 100;
          state.luckyReady = true;
          setLuckyCharge(state.luckyCharge, state.luckyReady);
          flashMessage('🍀 The Well — Lucky bar FULL!', 1400);
          spawnConfetti(30);
          haptics.epic();
        } else {
          state.roguelike.gems = (state.roguelike.gems || 0) + 20;
          flashMessage('💎 +20 💎', 1300);
          spawnConfetti(40);
          haptics.epic();
        }
        persist();
        refreshRunHud();
        setTimeout(onDone, 600);
      },
    });
  }, 500);
}

function runMidRunShop(onDone) {
  const items = [
    { id: 'shop-life', icon: '❤️', name: '+1 Life', desc: 'Gain one extra life for this run.', cost: 15 },
    { id: 'shop-pups', icon: '🎁', name: '+1 of every power-up', desc: 'Restock your bank.', cost: 8 },
    { id: 'shop-relic', icon: '👑', name: 'Random Relic', desc: 'Add a random relic to your run.', cost: 20 },
  ];
  flashMessage('🛒 A merchant blocks the path!', 1400);
  speech.speak('A merchant blocks the path.');
  setTimeout(() => {
    showShop({
      items,
      getGems: () => state.roguelike.gems || 0,
      onBuy: (it) => {
        if ((state.roguelike.gems || 0) < it.cost) return false;
        state.roguelike.gems -= it.cost;
        if (it.id === 'shop-life') {
          state.roguelike.livesRemaining = (state.roguelike.livesRemaining || 0) + 1;
          flashMessage('❤️ +1 Life', 1000);
        } else if (it.id === 'shop-pups') {
          const bank = powerupBank();
          for (const k of ['hammer','shuffle','colorBomb','plusMoves']) {
            bank[k] = Math.min(effectivePowerupCap(k), (bank[k] || 0) + 1);
          }
          setPowerupCounts(bank);
          flashMessage('🎁 Bank topped up', 1000);
        } else if (it.id === 'shop-relic') {
          const choices = pickRelicChoices(state.runRelics || [], 1, runRng());
          if (choices.length > 0) {
            const r = choices[0];
            state.runRelics = state.runRelics || [];
            state.runRelics.push(r.id);
            flashMessage(`👑 ${r.icon} ${r.name}!`, 1400);
            refreshRunHud();
          }
        }
        persist();
        return true;
      },
      onContinue: () => { if (onDone) onDone(); },
    });
  }, 800);
}

// 📓 Push an entry onto the run-history journal. Most recent first,
// capped at 20 — anything older falls off. Used by the Run History
// modal accessible from Settings.
function recordRunHistory(entry) {
  state.runHistory = state.runHistory || [];
  state.runHistory.unshift(entry);
  if (state.runHistory.length > 20) state.runHistory.length = 20;
  // persist() runs as part of the broader run-end flow, no need here.
}

function endRoguelikeRun() {
  const reached = state.roguelike.currentSlot;
  const gems = gemsEarned(reached, false, metaSkills());
  const wasDaily = !!state.runIsDaily;
  telemetry.track('run_end', {
    outcome: 'fail',
    slot_reached: reached,
    gems_earned: gems,
    class: state.roguelike.currentClass,
    upgrades: (state.runUpgrades || []).length,
    relics: (state.runRelics || []).length,
    daily: wasDaily,
    daily_stamp: state.runDailyStamp || null,
  });
  recordRunHistory({
    ts: Date.now(),
    outcome: 'fail',
    slot: reached,
    class: state.roguelike.currentClass,
    gems,
    score: state.score || 0,
    daily: wasDaily,
    dailyStamp: state.runDailyStamp || null,
  });
  // Record the best slot for today's daily so the start-screen badge
  // shows it. Only the FIRST daily attempt per calendar day counts
  // toward the score (Spire / Balatro convention).
  if (wasDaily) {
    const today = state.runDailyStamp;
    if (state.dailySeedDate !== today) {
      state.dailySeedDate = today;
      state.dailySeedBestSlot = reached;
    } else {
      state.dailySeedBestSlot = Math.max(state.dailySeedBestSlot || 0, reached);
    }
  }
  // Clear daily flags so the next roguelike run isn't seeded by stale state.
  state.runRng = null;
  state.runIsDaily = false;
  state.runDailyStamp = null;
  state.roguelike.gems = (state.roguelike.gems || 0) + gems;
  state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, reached);
  showEndOfRunSummary('fail', reached, gems);
  state.roguelike.currentSlot = 1;
  state.inRoguelikeRun = false;
  state.runUpgrades = [];
  state.runRelics = [];
  state.roguelike.currentClass = null; state.runFreeRerolls = 0;
  document.body.classList.remove('boss-active', 'boss-final');
  persist();
  refreshRunHud();
  flashMessage(`Run over. +${gems} 💎`, 2200);
  speech.speak(`Run over. You reached slot ${reached}. You earned ${gems} gems.`);
}

// Combo meter — visible chain depth during cascades
function updateComboMeter(level) {
  state.comboLevel = level;
  setComboMeter(level);
}

// Lucky charge — fills as you successfully play, gives a 2x score on
// the next successful match round when full.
let luckyDrainTimer = null;
let luckyLastBumpAt = 0;

function bumpLuckyCharge() {
  // Don't fill while ready (waiting to fire) or while in mode (would be lost).
  luckyLastBumpAt = Date.now();
  if (luckyDrainTimer) { clearTimeout(luckyDrainTimer); luckyDrainTimer = null; }
  if (state.luckyMode) {
    refreshLucky();
    return;
  }
  if (state.luckyReady) {
    refreshLucky();
    scheduleLuckyDrainCheck();
    return;
  }
  const wasReady = state.luckyReady;
  state.luckyCharge = Math.min(100, state.luckyCharge + runLuckyRate());
  if (state.luckyCharge >= 100) {
    state.luckyReady = true;
    state.luckyCharge = 100;
    flashMessage('LUCKY READY! Next match triples your score', 1800);
    speech.speak('Lucky ready. Your next match scores triple.');
    haptics.specialBirth();
    spawnConfetti(18);
    // 🪆 Voodoo Doll upgrade — +1 of every power-up when Lucky goes ready.
    if (!wasReady && upgradeCount('voodoo-doll') > 0) {
      const bank = powerupBank();
      for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
        bank[key] = Math.min(effectivePowerupCap(key), (bank[key] || 0) + 1);
      }
      setPowerupCounts(bank);
      flashMessage('🪆 Voodoo Doll! +1 of each', 1100);
    }
  }
  refreshLucky();
  scheduleLuckyDrainCheck();
}

function scheduleLuckyDrainCheck() {
  if (luckyDrainTimer) clearTimeout(luckyDrainTimer);
  // Don't drain when ready, in mode, or already empty.
  if (state.luckyMode || state.luckyReady || state.luckyCharge <= 0) return;
  luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_AFTER_MS);
}

function drainLuckyTick() {
  if (state.luckyMode || state.luckyReady || state.luckyCharge <= 0) {
    luckyDrainTimer = null;
    return;
  }
  const idle = Date.now() - luckyLastBumpAt;
  if (idle < LUCKY_DRAIN_AFTER_MS) {
    luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_AFTER_MS - idle);
    return;
  }
  const drain = LUCKY_DRAIN_PER_SEC * (LUCKY_DRAIN_INTERVAL_MS / 1000);
  state.luckyCharge = Math.max(0, state.luckyCharge - drain);
  refreshLucky();
  if (state.luckyCharge > 0) {
    luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_INTERVAL_MS);
  } else {
    luckyDrainTimer = null;
  }
}

function refreshLucky() {
  setLuckyCharge(state.luckyCharge, {
    ready: state.luckyReady,
    mode: state.luckyMode,
    remaining: state.luckyModeRemaining,
    total: LUCKY_MODE_MATCHES,
  });
}

function consumeLuckyIfReady(baseScore) {
  // Mid-mode: every match within the window gets the ongoing multiplier,
  // counts toward the remaining tally, and ends mode when depleted.
  if (state.luckyMode) {
    state.luckyModeRemaining = Math.max(0, state.luckyModeRemaining - 1);
    if (state.luckyModeRemaining <= 0) {
      state.luckyMode = false;
      flashMessage('Lucky window over', 1200);
      speech.speak('Lucky window over');
      // 🎶 Healing Hum relic — when Lucky-MODE ends naturally, +1 max life.
      if (hasRelic('healing-hum')) {
        state.roguelike.livesRemaining = (state.roguelike.livesRemaining || 0) + 1;
        flashMessage('🎶 Healing Hum! +1 ❤️', 1200);
        persist();
      }
    }
    refreshLucky();
    // 🐝 Bee Wing relic — every Lucky-MODE match also spawns a crazy tile.
    if (hasRelic('bee-wing')) spawnCrazyTile();
    // 🥃 Strong Drink relic — Lucky-MODE multiplier doubles.
    const mult = hasRelic('strong-drink') ? LUCKY_MODE_MULTIPLIER * 2 : LUCKY_MODE_MULTIPLIER;
    return Math.round(baseScore * mult);
  }
  if (!state.luckyReady) return baseScore;
  // Activation moment — burst + start mode
  state.luckyReady = false;
  state.luckyCharge = 0;
  state.luckyMode = true;
  // 🍀 Charmer AWAKENING — Lucky-MODE lasts +3 extra matches.
  const charmerBonus = (isClass('charmer') && classAwakened()) ? 3 : 0;
  // 🌅 Sweet Glow upgrade — Lucky-MODE lasts +1 extra match per stack.
  const glowBonus = upgradeCount('sweet-glow');
  state.luckyModeRemaining = LUCKY_MODE_MATCHES + charmerBonus + glowBonus;
  refreshLucky();
  flashMessage(
    `LUCKY! ×${LUCKY_INSTANT_MULTIPLIER} now, then ×${LUCKY_MODE_MULTIPLIER} for ${LUCKY_MODE_MATCHES} matches`,
    2200
  );
  speech.speak(
    `Lucky! Triple score now, plus one and a half for the next ${LUCKY_MODE_MATCHES} matches.`
  );
  spawnConfetti(56);
  spawnScreenFlash('rgba(255, 214, 10, 0.45)');
  screenShake(6, 360);
  haptics.epic();
  // Lucky Strike synergy upgrade — also tops up a hammer.
  // 👯 Lucky Twin relic — doubles the hammers per fire.
  if (state.inRoguelikeRun && upgradeCount('lucky-strike') > 0) {
    const bank = powerupBank();
    const multi = hasRelic('lucky-twin') ? 2 : 1;
    bank.hammer = Math.min(effectivePowerupCap('hammer'), (bank.hammer || 0) + upgradeCount('lucky-strike') * multi);
    setPowerupCounts(bank);
  }
  // 🎺 Lucky Whistle relic — when Lucky fires, also drop a random power-up.
  if (state.inRoguelikeRun && hasRelic('lucky-whistle')) {
    const bank = powerupBank();
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
      bank[pick] = (bank[pick] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🎺 Lucky Whistle! +1 ${pick}`, 1100);
    }
  }
  // 🍒 Cherry Reload upgrade — Lucky fire also adds +1 Shuffle per stack.
  if (state.inRoguelikeRun && upgradeCount('cherry-reload') > 0) {
    const bank = powerupBank();
    bank.shuffle = Math.min(effectivePowerupCap('shuffle'), (bank.shuffle || 0) + upgradeCount('cherry-reload'));
    setPowerupCounts(bank);
  }
  // 🚀 Lucky Reload upgrade — Lucky fire also adds +1 +3 Moves per stack.
  if (state.inRoguelikeRun && upgradeCount('lucky-reload') > 0) {
    const bank = powerupBank();
    bank.plusMoves = Math.min(effectivePowerupCap('plusMoves'), (bank.plusMoves || 0) + upgradeCount('lucky-reload'));
    setPowerupCounts(bank);
  }
  // 🧠 Mind Reader upgrade — +1 to burst multiplier per stack.
  const burst = LUCKY_INSTANT_MULTIPLIER + upgradeCount('mind-reader');
  return Math.round(baseScore * burst);
}

const SURPRISE_KINDS = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
const SURPRISE_LABELS = {
  hammer: 'Hammer',
  shuffle: 'Shuffle',
  colorBomb: 'Color Bomb',
  plusMoves: '+3 Moves',
};
const SURPRISE_BUTTON_IDS = {
  hammer: 'pu-hammer',
  shuffle: 'pu-shuffle',
  colorBomb: 'pu-colorbomb',
  plusMoves: 'pu-plusmoves',
};

// Big matches occasionally drop a free power-up — flying icon animates
// from the cleared tiles toward the matching power-up button, then the
// bank ticks up.
function maybeDropSurprise(positions, cascadeLevel) {
  if (!positions || positions.length < SURPRISE_DROP_MIN_TILES) return;
  // Chance scales slightly with cascade depth — deeper chains feel more
  // like Vampire Survivors / Survivor.io: rewards stacking on rewards.
  const chance = SURPRISE_DROP_CHANCE + Math.max(0, cascadeLevel - 1) * 0.04;
  if (Math.random() > chance) return;
  const kind = SURPRISE_KINDS[Math.floor(Math.random() * SURPRISE_KINDS.length)];
  // Centroid of the cleared tiles
  let sx = 0, sy = 0, n = 0;
  for (const p of positions) {
    const tile = document.querySelector(`#board .tile[data-c="${p.c}"][data-r="${p.r}"]`);
    if (!tile) continue;
    const rect = tile.getBoundingClientRect();
    sx += rect.left + rect.width / 2;
    sy += rect.top + rect.height / 2;
    n++;
  }
  if (n === 0) return;
  const fromX = sx / n;
  const fromY = sy / n;
  const targetBtn = document.getElementById(SURPRISE_BUTTON_IDS[kind]);
  if (!targetBtn) return;
  const tRect = targetBtn.getBoundingClientRect();
  const toX = tRect.left + tRect.width / 2;
  const toY = tRect.top + tRect.height / 2;
  flashMessage(`Free ${SURPRISE_LABELS[kind]}!`, 1300);
  speech.speak(`Free ${SURPRISE_LABELS[kind]}`);
  haptics.specialBirth();
  animateSurpriseIcon(kind, fromX, fromY, toX, toY, () => {
    const bank = powerupBank();
    bank[kind] = Math.min(effectivePowerupCap(kind), (bank[kind] || 0) + 1);
    setPowerupCounts(bank);
    persist();
    targetBtn.classList.remove('surprise-land');
    void targetBtn.offsetWidth;
    targetBtn.classList.add('surprise-land');
    setTimeout(() => targetBtn.classList.remove('surprise-land'), 600);
  });
}

function animateSurpriseIcon(kind, fromX, fromY, toX, toY, onArrive) {
  const layer = document.getElementById('particles');
  if (!layer) { if (onArrive) onArrive(); return; }
  const dx = toX - fromX;
  const dy = toY - fromY;
  const el = document.createElement('div');
  el.className = 'particle surprise-icon';
  el.style.left = `${fromX}px`;
  el.style.top = `${fromY}px`;
  el.style.setProperty('--fly-dx', `${dx}px`);
  el.style.setProperty('--fly-dy', `${dy}px`);
  el.textContent = SURPRISE_LABELS[kind];
  layer.appendChild(el);
  setTimeout(() => {
    el.remove();
    if (onArrive) onArrive();
  }, 820);
}

function refreshLevelUI() {
  const p = progressTowardObjective(state.level, state.score, state.progress);
  setLevelUI({
    level: state.level,
    movesRemaining: state.movesRemaining,
    current: p.current,
    target: p.target,
    mode: state.settings.mode,
  });
  if (state.settings.mode === 'roguelike') {
    setLevelChip(state.level, 'roguelike', 0, {
      slot: state.roguelike.currentSlot,
      total: RUN_LENGTH,
      gems: state.roguelike.gems,
      isBoss: !!(state.level && state.level.isBoss),
      lives: state.roguelike.livesRemaining || 0,
      maxLives: maxLivesForRun(),
    });
  } else {
    setLevelChip(
      state.level,
      state.settings.mode,
      state.level ? state.levelProgress.stars[state.level.id] || 0 : 0
    );
  }
}

function recordClearedTypes(toClearWithTypes) {
  let objectiveDelta = 0;
  const obj = state.level && state.level.objective;
  const trackedType = obj && obj.kind === 'clearType' ? obj.type : null;
  // 🍴 Bottomless Stomach relic — types count double toward clearType.
  const multi = bottomlessMulti();
  // 👻 Echo Wraith (boss-7): non-matching colors HEAL the wraith —
  // each non-purple tile cleared reduces the purple progress count
  // by 1 (min 0). Punishes off-color matches, makes it about discipline.
  const mech = state.level?.mechanic;
  const wraith = state.level?.isBoss && mech && mech.kind === 'wraith-heal' ? mech.healColor : null;
  let healCount = 0;
  for (const t of toClearWithTypes) {
    if (t == null) continue;
    state.progress.type[t] = (state.progress.type[t] || 0) + multi;
    if (t === trackedType) objectiveDelta += multi;
    if (wraith != null && t !== wraith) healCount++;
  }
  if (wraith != null && healCount > 0 && state.progress.type[wraith]) {
    const before = state.progress.type[wraith];
    state.progress.type[wraith] = Math.max(0, before - healCount);
    const actual = before - state.progress.type[wraith];
    if (actual > 0) {
      objectiveDelta -= actual;
      flashMessage(`👻 Wraith heals! −${actual} purple`, 1100);
    }
  }
  if (objectiveDelta > 0) flashObjectiveDelta(`+${objectiveDelta}`);
  else if (objectiveDelta < 0) flashObjectiveDelta(`${objectiveDelta}`);
}

function flashObjectiveProgress(specialsCreatedCount) {
  const obj = state.level && state.level.objective;
  if (!obj) return;
  if (obj.kind === 'matches') flashObjectiveDelta('+1');
  else if (obj.kind === 'specials' && specialsCreatedCount > 0) {
    flashObjectiveDelta(`+${specialsCreatedCount}`);
  }
}

// 👑 Boss-mechanic dispatcher. Each boss in roguelike.js carries a
// `mechanic` config; this function runs once per consumeMove and
// dispatches by kind. Bosses without `mechanic` are no-ops (pre-B4
// behavior).
let _bossMechanicTick = 0;
function tickBossMechanic() {
  const m = state.level?.mechanic;
  if (!m || !state.level?.isBoss) {
    _bossMechanicTick = 0;
    return;
  }
  _bossMechanicTick++;
  switch (m.kind) {
    case 'jelly-regen':
      if (_bossMechanicTick % m.everyN === 0) bossAddJelly();
      break;
    case 'lock-spawn':
      if (_bossMechanicTick % m.everyN === 0) bossAddLock();
      break;
    case 'alternate-jelly-lock':
      if (_bossMechanicTick % m.everyN === 0) {
        if (_bossMechanicTick / m.everyN % 2 === 0) bossAddLock();
        else bossAddJelly();
      }
      break;
    case 'harden-lock':
      if (_bossMechanicTick % m.everyN === 0) bossHardenLock();
      break;
    case 'lock-jelly':
      if (_bossMechanicTick % m.everyN === 0) bossLockJelly();
      break;
    case 'spawn-cherry':
      if (_bossMechanicTick % m.everyN === 0) bossSpawnCherry();
      break;
    case 'kraken-chaos':
      if (_bossMechanicTick % m.everyN === 0) {
        const choices = [bossAddJelly, bossAddLock, bossHardenLock, bossLockJelly, bossSpawnCherry];
        choices[Math.floor(Math.random() * choices.length)]();
      }
      break;
    // cherry-regrow + wraith-heal are event-driven, not tick-based.
  }
}

function _bossRandomCell(filter) {
  const cands = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (filter && !filter(c, r)) continue;
      cands.push({ c, r });
    }
  }
  if (cands.length === 0) return null;
  return cands[Math.floor(Math.random() * cands.length)];
}

function bossAddJelly() {
  const pick = _bossRandomCell((c, r) => {
    if (state.board.isIngredient(c, r)) return false;
    if ((state.jellyMap.get(`${c},${r}`) || 0) >= 2) return false; // already maxed
    return true;
  });
  if (!pick) return;
  const k = `${pick.c},${pick.r}`;
  state.jellyMap.set(k, (state.jellyMap.get(k) || 0) + 1);
  flashMessage('🟦 Jelly regenerates!', 1000);
  haptics.invalid();
  renderBoard(state.board, state);
  refreshLevelUI();
}

function bossAddLock() {
  const pick = _bossRandomCell((c, r) => {
    if (state.board.isIngredient(c, r)) return false;
    if ((state.lockMap.get(`${c},${r}`) || 0) >= 2) return false;
    return true;
  });
  if (!pick) return;
  const k = `${pick.c},${pick.r}`;
  state.lockMap.set(k, (state.lockMap.get(k) || 0) + 1);
  flashMessage('🔒 New lock!', 1000);
  haptics.invalid();
  renderBoard(state.board, state);
}

function bossHardenLock() {
  // Find a lvl-1 lock and bump to lvl 2. If none, spawn a fresh lvl-1.
  const lvl1Keys = [];
  for (const [k, v] of state.lockMap.entries()) {
    if (v === 1) lvl1Keys.push(k);
  }
  if (lvl1Keys.length > 0) {
    const k = lvl1Keys[Math.floor(Math.random() * lvl1Keys.length)];
    state.lockMap.set(k, 2);
    flashMessage('🔒🔒 Lock hardens!', 1100);
    haptics.invalid();
    renderBoard(state.board, state);
  } else {
    bossAddLock();
  }
}

function bossLockJelly() {
  // Add a lock to a random jelly tile so the jelly can't be matched.
  const jellyKeys = [...state.jellyMap.keys()].filter((k) => (state.lockMap.get(k) || 0) === 0);
  if (jellyKeys.length === 0) { bossAddLock(); return; }
  const k = jellyKeys[Math.floor(Math.random() * jellyKeys.length)];
  state.lockMap.set(k, 1);
  flashMessage('🟦🔒 Jelly locked!', 1100);
  haptics.invalid();
  renderBoard(state.board, state);
}

function bossSpawnCherry() {
  // Drop a fresh cherry at a random column in row 0 (push existing
  // tile down). Only works if there's room (row 0 has at least one
  // non-ingredient cell).
  const cols = [];
  for (let c = 0; c < state.board.cols; c++) {
    if (!state.board.isIngredient(c, 0)) cols.push(c);
  }
  if (cols.length === 0) return;
  const c = cols[Math.floor(Math.random() * cols.length)];
  state.board.set(c, 0, { type: 0, ingredient: true });
  flashMessage('🍒 Fresh cherry spawned!', 1100);
  haptics.invalid();
  renderBoard(state.board, state);
}

function consumeMove() {
  bumpLuckyCharge();
  maybeFireEater();
  maybeFireRelicsOnSwap();
  maybeMoveGrumblocks();
  tickBossMechanic();
  // Free Play has unlimited moves. Levels and Roguelike both count down.
  if (state.settings.mode === 'free' || !state.level) return;
  // 🌑 Eclipse mutator — only every OTHER swap consumes a move.
  if (hasMutator('eclipse')) {
    state.eclipseTick = (state.eclipseTick || 0) + 1;
    if (state.eclipseTick % 2 !== 0) {
      flashMessage('🌑 Free swap', 600);
      refreshLevelUI();
      return;
    }
  }
  // First Swap Free upgrade — once per slot the first swap is free.
  if (state.inRoguelikeRun && !state.firstSwapUsed && upgradeCount('first-free') > 0) {
    state.firstSwapUsed = true;
    flashMessage('🛡 First swap free', 800);
    refreshLevelUI();
    return;
  }
  if (state.movesRemaining > 0) {
    state.movesRemaining--;
    refreshLevelUI();
    bumpMoveCounter();
  }
  // 🍞 Buttered Bread upgrade — emergency revive when you've just
  // hit 0 moves, once per slot.
  if (
    state.movesRemaining === 0
    && upgradeCount('buttered') > 0
    && !state.butteredUsed
    && state.inRoguelikeRun
  ) {
    state.butteredUsed = true;
    const bonus = 3 * upgradeCount('buttered');
    state.movesRemaining += bonus;
    flashMessage(`🍞 Buttered Bread! +${bonus} moves`, 1300);
    refreshLevelUI();
  }
}

function checkLevelOutcome() {
  if (state.resolved) return;
  // Free Play has no level objective. Levels and Roguelike both do.
  if (state.settings.mode === 'free' || !state.level) return;
  const p = progressTowardObjective(state.level, state.score, state.progress);
  if (!p.done && p.target > 0 && !state.almostFired) {
    const ratio = p.current / p.target;
    if (ratio >= 0.8) {
      state.almostFired = true;
      flashMessage('Almost there!', 1200);
      speech.speak('Almost there!');
    }
  }
  if (p.done) {
    state.resolved = true;
    const stars = starsForLevel(state.level, state.movesRemaining);
    const prev = state.levelProgress.stars[state.level.id] || 0;
    const improved = stars > prev;
    const firstClear = prev === 0;
    if (improved) state.levelProgress.stars[state.level.id] = stars;
    if (!state.levelProgress.bestScores) state.levelProgress.bestScores = {};
    const prevBest = state.levelProgress.bestScores[state.level.id] || 0;
    if (state.score > prevBest) {
      state.levelProgress.bestScores[state.level.id] = state.score;
    }
    earnPowerups(stars);
    const next = nextLevelId(state.level.id);
    if (next && next > (state.levelProgress.currentLevel || 0)) {
      state.levelProgress.currentLevel = next;
    }
    persist();
    spawnConfetti(improved && !firstClear ? 72 : 48);
    if (stars === 3) spawnStarRain(36);
    sfx.playObjectiveComplete(state.level.objective.kind);
    haptics.levelComplete();
    if (improved && !firstClear) {
      flashMessage(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}`, 1600);
      speech.speak(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
    } else {
      speech.speak(`Level complete! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
    }
    if (state.inRoguelikeRun) {
      // 👑 Crown of Sweetness relic — leftover moves convert to 50pt each.
      if (hasRelic('crown') && state.movesRemaining > 0) {
        const bonus = state.movesRemaining * 50;
        state.score += bonus;
        setScore(state.score, { animate: true });
        flashMessage(`👑 +${bonus} from leftover moves`, 1500);
      }
      // ⏰ Time Bonus mutator — leftover moves convert to 30pt each.
      if (hasMutator('time-bonus') && state.movesRemaining > 0) {
        const bonus = state.movesRemaining * 30;
        state.score += bonus;
        setScore(state.score, { animate: true });
        flashMessage(`⏰ +${bonus} time bonus`, 1500);
      }
      const isLastSlot = state.roguelike.currentSlot >= RUN_LENGTH;
      // Let the score counter finish rolling and any floating-number
      // animations land before the success panel takes over. Players
      // were getting the panel mid-cascade-celebration.
      flashMessage('🎉 SLOT CLEAR!', 1100);
      setTimeout(() => {
        showLevelComplete({
          level: { ...state.level, id: state.roguelike.currentSlot, name: state.level.name },
          stars,
          score: state.scoreOverride || state.score,
          isLast: isLastSlot,
          onNext: () => advanceRoguelikeAfterWin(),
          onReplay: () => playRoguelikeSlot(state.roguelike.currentSlot),
        });
      }, 1200);
      return;
    }
    // Levels mode: leftover moves convert to +25 each — classic
    // Candy-Crush-style end bonus.
    if (state.settings.mode === 'levels' && state.movesRemaining > 0) {
      const bonus = state.movesRemaining * 25;
      state.score += bonus;
      // Update bestScore record if this bumps it over.
      if (!state.levelProgress.bestScores) state.levelProgress.bestScores = {};
      const prevBest = state.levelProgress.bestScores[state.level.id] || 0;
      if (state.score > prevBest) {
        state.levelProgress.bestScores[state.level.id] = state.score;
      }
      setScore(state.score, { animate: true });
      flashMessage(`+${bonus} from ${state.movesRemaining} leftover moves!`, 1600);
      persist();
    }
    // Settle delay before the success panel so the score roll-up and
    // any in-flight floating-number animations land first.
    flashMessage('🎉 LEVEL COMPLETE!', 1100);
    setTimeout(() => {
      showLevelComplete({
        level: state.level,
        stars,
        score: state.scoreOverride || state.score,
        isLast: isLastLevel(state.level.id),
        onNext: () => startLevel(state.levelProgress.currentLevel),
        onReplay: () => startLevel(state.level.id),
      });
    }, 1200);
    return;
  }
  if (state.movesRemaining <= 0) {
    state.resolved = true;
    sfx.playLevelFail();
    haptics.invalid();
    speech.speak('Try again');
    if (state.inRoguelikeRun) {
      const slotAtFail = state.roguelike.currentSlot;
      // ❤️‍🔥 Phoenix relic — if you'd lose your last life, consume the
      // relic instead so you stay at 1 life and can retry the slot.
      const wouldBeZero = (state.roguelike.livesRemaining || 0) <= 1;
      if (wouldBeZero && hasRelic('phoenix')) {
        state.runRelics = (state.runRelics || []).filter((id) => id !== 'phoenix');
        flashMessage('❤️‍🔥 PHOENIX REVIVES YOU!', 2400);
        speech.speak('Phoenix relic revives you!');
        spawnConfetti(60);
        spawnStarRain(20);
        // Don't decrement lives. Fall through to retry dialog with
        // current life still intact.
        persist();
        refreshLevelUI();
        refreshRunHud();
        const livesLeft = state.roguelike.livesRemaining;
        showLevelFail({
          level: { ...state.level, id: slotAtFail },
          score: state.score,
          canSkip: false,
          onReplay: () => playRoguelikeSlot(slotAtFail),
          onSkip: () => {},
        });
        return;
      }
      // 😊 Sweet Smile relic — 25% chance to keep the life on a loss.
      const smileSaved = hasRelic('sweet-smile') && Math.random() < 0.25;
      if (smileSaved) {
        flashMessage('😊 Sweet Smile saved you!', 1600);
        speech.speak('Sweet smile.');
        spawnConfetti(30);
        haptics.epic();
      }
      // Decrement a life. If lives remain, offer a retry.
      // If lives hit zero, the run is over.
      if (!smileSaved) state.roguelike.livesRemaining = Math.max(0, (state.roguelike.livesRemaining || 0) - 1);
      persist();
      refreshLevelUI();
      if (state.roguelike.livesRemaining <= 0) {
        // Out of lives — end run; show terminal fail dialog.
        const reached = slotAtFail;
        const gems = gemsEarned(reached, false, metaSkills());
        state.roguelike.gems = (state.roguelike.gems || 0) + gems;
        state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, reached);
        showEndOfRunSummary('fail', reached, gems);
        state.roguelike.currentSlot = 1;
        state.inRoguelikeRun = false;
        state.runUpgrades = [];
        state.runRelics = [];
        state.roguelike.currentClass = null; state.runFreeRerolls = 0;
        document.body.classList.remove('boss-active', 'boss-final');
        persist();
        refreshRunHud();
        flashMessage(`Run over — out of lives. +${gems} 💎`, 2400);
        speech.speak(`Out of lives. Run over. You earned ${gems} gems.`);
        showLevelFail({
          level: { ...state.level, id: slotAtFail },
          score: state.score,
          canSkip: true, // we repurpose Skip as "Start new run"
          onReplay: () => startRoguelikeRun(),
          onSkip: () => startRoguelikeRun(),
        });
        return;
      }
      const livesLeft = state.roguelike.livesRemaining;
      flashMessage(`Life lost — ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left`, 1800);
      speech.speak(`Life lost. ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} remaining.`);
      showLevelFail({
        level: { ...state.level, id: slotAtFail },
        score: state.score,
        canSkip: false,
        onReplay: () => playRoguelikeSlot(slotAtFail),
        onSkip: () => {},
      });
      return;
    }
    const replayLevelId = state.level.id;
    showLevelFail({
      level: state.level,
      score: state.score,
      canSkip: !isLastLevel(state.level.id),
      onReplay: () => startLevel(replayLevelId),
      onSkip: () => {
        const next = nextLevelId(replayLevelId);
        if (next) {
          state.levelProgress.currentLevel = next;
          persist();
          startLevel(next);
        } else {
          startLevel(replayLevelId);
        }
      },
    });
  }
}

function messageFor({ matchCount, cascadeLevel, specialsCreated, specialsActivated }) {
  if (specialsActivated.includes('rainbow')) return 'Rainbow blast!';
  if (specialsCreated.some((s) => s.kind === 'rainbow')) return 'Rainbow!';
  if (specialsCreated.some((s) => s.kind && s.kind.startsWith('line'))) return 'Striped!';
  if (cascadeLevel >= 3) return 'Amazing!';
  if (cascadeLevel === 2) return 'Cascade!';
  if (matchCount >= 6) return 'Huge match!';
  if (matchCount >= 5) return 'Big match!';
  if (matchCount >= 4) return 'Nice!';
  return 'Match!';
}

function maybeUpdateBest() {
  if (state.score > state.highScore) {
    state.highScore = state.score;
    setBest(state.highScore);
    persist();
  }
}

async function useHammer(pos) {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.hammer || 0) <= 0) return;
  if (!state.board.cell(pos.c, pos.r)) return;
  const key = `${pos.c},${pos.r}`;
  if (state.lockMap.get(key) > 0 || state.jellyMap.get(key) > 0 || state.board.isIngredient(pos.c, pos.r)) {
    flashMessage('Hammer cannot break special blocks', 1200);
    sfx.playInvalid();
    haptics.invalid();
    return;
  }
  if (!spendPowerup('hammer')) return;
  state.busy = true;
  state.cascadeAbort = false;
  try {
    cancelHint();
    sfx.unlockAudio();
    sfx.playMatch(1, 1);
    haptics.powerup();
    speech.speak('Smash!');
    spawnPopSpecks([pos]);
    await animatePop([pos]);
    state.board.clear([pos]);
    renderBoard(state.board, state);
    await delay(120);
    const fallen = gravityWithIngredients();
    renderBoard(state.board, state, { fallen });
    await delay(220);

    let cascadeResult = findMatches(state.board);
    let cascadeLevel = 1;
    while (cascadeResult.positions.length > 0 && !state.cascadeAbort) {
      await processMatchRound(cascadeResult, cascadeLevel, null);
      cascadeResult = findMatches(state.board);
      cascadeLevel++;
    }

    maybeUpdateBest();
    syncGrumblocks();
    refreshLevelUI();
    await ensureMovesAvailable();
    checkLevelOutcome();
  } finally {
    state.busy = false;
  }
  if (!state.resolved) scheduleHint();
}

async function useColorBomb(pos) {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.colorBomb || 0) <= 0) return;
  const targetCell = state.board.cell(pos.c, pos.r);
  if (!targetCell || targetCell.type == null) return;
  const key = `${pos.c},${pos.r}`;
  if (state.lockMap.get(key) > 0 || state.jellyMap.get(key) > 0) {
    flashMessage('Bomb cannot target special blocks', 1200);
    sfx.playInvalid();
    haptics.invalid();
    return;
  }
  const targetType = targetCell.type;
  if (!spendPowerup('colorBomb')) return;
  state.busy = true;
  state.cascadeAbort = false;
  try {
    cancelHint();
    sfx.unlockAudio();

    // Bomb skips any tile that has jelly OR a lock — power-ups don't
    // affect special blocks per the design rule.
    const positions = [];
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        if (state.board.typeAt(c, r) !== targetType) continue;
        // Belt + suspenders: cherries shouldn't have typeAt === targetType
        // anyway, but make the filter explicit so future ingredient kinds
        // can't get swept by Color Bomb.
        if (state.board.isIngredient(c, r)) continue;
        const k = `${c},${r}`;
        if (state.lockMap.get(k) > 0) continue;
        if (state.jellyMap.get(k) > 0) continue;
        positions.push({ c, r });
      }
    }
    flashMessage('Color bomb!', 1100);
    speech.speak('Color bomb!');
    spawnConfetti(28);
    sfx.playCascade();
    sfx.playMatch(positions.length, 2);
    haptics.powerup();
    haptics.epic();
    spawnPopSpecks(positions);
    await animatePop(positions);
    state.board.clear(positions);
    // Intentionally NOT decrementing jelly or locks — bombs skip those.
    const clearedTypeList = positions.map(() => targetType);
    recordClearedTypes(clearedTypeList);
    state.progress.matches += bottomlessMulti();
    flashObjectiveProgress(0);
    const earned = consumeLuckyIfReady(
      applyRunScoreMultiplier(calcScore(positions, 2), 2, positions.length)
    );
    state.score += earned;
    setScore(state.score, { animate: true });
    maybeTriggerInfiniteScore();
    spawnFloatingNumber(`+${earned.toLocaleString()}`, positions, { color: '#FF006E' });
    maybeDropSurprise(positions, 2);
    achievements.onScore(state.score);
    await delay(180);
    const fallen = gravityWithIngredients();
    renderBoard(state.board, state, { fallen });
    await delay(260);

    let cascadeResult = findMatches(state.board);
    let cascadeLevel = 2;
    while (cascadeResult.positions.length > 0 && !state.cascadeAbort) {
      await processMatchRound(cascadeResult, cascadeLevel, null);
      cascadeResult = findMatches(state.board);
      cascadeLevel++;
    }

    maybeUpdateBest();
    syncGrumblocks();
    refreshLevelUI();
    await ensureMovesAvailable();
    checkLevelOutcome();
  } finally {
    state.busy = false;
  }
  if (!state.resolved) scheduleHint();
}

function usePlusMoves() {
  if (state.busy) return;
  // Allow the fail-revive path: when the player has run out of moves
  // (state.resolved + movesRemaining<=0), this function restores
  // state.resolved=false, +N moves, and hides the level-fail overlay.
  // Block only during the post-WIN settle, where movesRemaining is
  // still > 0 and the success panel is animating in.
  if (state.resolved && state.movesRemaining > 0) return;
  const bank = powerupBank();
  if ((bank.plusMoves || 0) <= 0) return;
  if (state.settings.mode === 'free' || !state.level) {
    speech.speak('Plus moves only works when there are moves to count');
    flashMessage('Not in Free Play', 1100);
    return;
  }
  if (!spendPowerup('plusMoves')) return;
  // ➕ Plus More upgrade — adds +1 move per stack to the bonus.
  const extra = state.inRoguelikeRun ? upgradeCount('plus-more') : 0;
  const total = PLUS_MOVES_BONUS + extra;
  state.movesRemaining += total;
  state.resolved = false;
  refreshLevelUI();
  bumpMoveCounter();
  flashMessage(`+${total} moves!`, 1100);
  speech.speak(`Plus ${total} moves`);
  hideLevelOverlay();
}

async function useShuffle() {
  if (state.busy) return;
  if (state.resolved) return;
  const bank = powerupBank();
  if ((bank.shuffle || 0) <= 0) return;
  if (!spendPowerup('shuffle')) return;
  state.armedTool = null;
  setArmedTool(null);
  cancelHint();
  sfx.unlockAudio();
  state.busy = true;
  state.cascadeAbort = false;
  try {
    flashMessage('Shuffled!', 1100);
    speech.speak('Shuffled!');
    // Same spin-out animation as the auto-shuffle so the manual action
    // also reads as "the board is being rearranged" rather than a snap.
    const tiles = document.querySelectorAll('#board .tile');
    tiles.forEach((t, i) => {
      t.style.animationDelay = `${i * 6}ms`;
      t.classList.add('shuffling');
    });
    await delay(440);
    // Preserves specials AND ingredients (cherries). The old destructive
    // reshuffle was wiping cherries on cherry-objective levels.
    preservingReshuffle();
    renderBoard(state.board, state, { intro: true });
  } finally {
    state.busy = false;
  }
  scheduleHint();
}

function armTool(tool) {
  if (state.busy) return;
  if (state.resolved) return;
  const bank = powerupBank();
  if ((bank[tool] || 0) <= 0) return;
  if (state.armedTool === tool) {
    state.armedTool = null;
    setArmedTool(null);
    return;
  }
  state.selected = null;
  renderBoard(state.board, state);
  state.armedTool = tool;
  setArmedTool(tool);
  if (tool === 'hammer') speech.speak('Tap a candy to smash');
  else if (tool === 'colorBomb') speech.speak('Tap a candy to clear its color');
}

document.getElementById('pu-hammer').addEventListener('click', () => {
  sfx.unlockAudio();
  armTool('hammer');
});

document.getElementById('pu-shuffle').addEventListener('click', (e) => {
  sfx.unlockAudio();
  useShuffle();
  if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
});

document.getElementById('pu-colorbomb').addEventListener('click', () => {
  sfx.unlockAudio();
  armTool('colorBomb');
});

document.getElementById('pu-plusmoves').addEventListener('click', (e) => {
  sfx.unlockAudio();
  usePlusMoves();
  if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
});

async function onTap(pos) {
  if (state.busy) return;
  // Don't accept input during the post-win settle delay either —
  // checkLevelOutcome flips state.resolved as soon as the objective is
  // met but the success panel waits ~1.2s for the score to land.
  if (state.resolved) return;
  if (state.armedTool === 'hammer') {
    state.armedTool = null;
    setArmedTool(null);
    await useHammer(pos);
    return;
  }
  if (state.armedTool === 'colorBomb') {
    state.armedTool = null;
    setArmedTool(null);
    await useColorBomb(pos);
    return;
  }
  cancelHint();
  sfx.unlockAudio();

  if (!state.selected) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
    haptics.tap();
    scheduleHint();
    return;
  }

  if (state.selected.c === pos.c && state.selected.r === pos.r) {
    state.selected = null;
    renderBoard(state.board, state);
    scheduleHint();
    return;
  }

  if (!state.board.adjacent(state.selected, pos)) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
    haptics.tap();
    scheduleHint();
    return;
  }

  const a = state.selected;
  const b = pos;
  state.selected = null;
  await trySwap(a, b);
}

function comboFanfare(kind) {
  switch (kind) {
    case 'double-rainbow': return 'WHOA!';
    case 'rainbow-stripes': return 'POW!';
    case 'rainbow-type': return 'Wow!';
    case 'stripes-pair': return 'BOOM!';
  }
  return 'Combo!';
}

async function runComboTurn(combo) {
  const candidateRaw = applyCombo(state.board, combo);
  // Combos like double-rainbow / rainbow-stripes paint full rows or the
  // entire board — must NOT consume ingredients (cherries), or the
  // dropIngredients objective becomes uncompletable.
  const candidate = candidateRaw.filter((p) => !state.board.isIngredient(p.c, p.r));
  const { clearable: cleared, blocked: lockedBlocked } = splitByLock(candidate);
  const clearedTypes = cleared.map((p) => state.board.typeAt(p.c, p.r));
  sfx.playCascade();
  sfx.playMatch(cleared.length, 2);
  haptics.combo();
  spawnPopSpecks(cleared);
  spawnConfetti(combo.kind === 'double-rainbow' ? 40 : 22);
  await animatePop(cleared);
  state.board.clear(cleared);
  decrementJellyAt(cleared);
  if (lockedBlocked.length > 0) {
    decrementLockAt(lockedBlocked);
    for (const p of lockedBlocked) spawnTileSparkles(p.c, p.r, 8, { color: '#facc15' });
  }
  recordClearedTypes(clearedTypes);
  state.progress.matches += bottomlessMulti();
  flashObjectiveProgress(0);
  const earned = consumeLuckyIfReady(
    applyRunScoreMultiplier(calcScore(cleared, 2), 2, cleared.length)
  );
  state.score += earned;
  maybeDropSurprise(cleared, 2);
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, cleared, { color: '#FF006E' });
  achievements.onScore(state.score);
  maybeTriggerInfiniteScore();
  const banner = comboFanfare(combo.kind);
  flashMessage(banner);
  speech.speak(banner);
  showAchievement(banner);
  renderBoard(state.board, state);
  await delay(180);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(260);
}

async function trySwap(a, b) {
  state.busy = true;
  state.cascadeAbort = false;
  try {
    if (state.board.isIngredient(a.c, a.r) || state.board.isIngredient(b.c, b.r)) {
      sfx.playInvalid();
      haptics.invalid();
      flashMessage('Cherries cannot be swapped', 1000);
      return;
    }
    if (isLocked(a.c, a.r) || isLocked(b.c, b.r)) {
      sfx.playInvalid();
      haptics.invalid();
      flashMessage('Locked!', 900);
      speech.speak('Locked');
      const lockedPos = isLocked(a.c, a.r) ? a : b;
      const tile = document.querySelector(
        `#board .tile[data-c="${lockedPos.c}"][data-r="${lockedPos.r}"]`
      );
      if (tile) {
        tile.classList.add('lock-shake');
        setTimeout(() => tile.classList.remove('lock-shake'), 420);
      }
      return;
    }
    sfx.playSwap();
    haptics.swap();
    bus.emit('swap', { a, b });
    await animateSwap(a, b);
    state.board.swap(a, b);
    renderBoard(state.board, state);

    const cellAtA = state.board.cell(a.c, a.r);
    const cellAtB = state.board.cell(b.c, b.r);
    const combo = detectCombo(cellAtA, cellAtB, a, b);

    if (combo) {
      consumeMove();
      await runComboTurn(combo);
      let cascadeResult = findMatches(state.board);
      let cascadeLevel = 2;
      while (cascadeResult.positions.length > 0 && !state.cascadeAbort) {
        await processMatchRound(cascadeResult, cascadeLevel, null);
        cascadeResult = findMatches(state.board);
        cascadeLevel++;
      }
      maybeUpdateBest();
      refreshLevelUI();
      await ensureMovesAvailable();
      checkLevelOutcome();
      return;
    }

    let result = findMatches(state.board);
    if (result.positions.length === 0) {
      sfx.playInvalid();
      haptics.invalid();
      await animateSwap(a, b);
      state.board.swap(a, b);
      renderBoard(state.board, state);
      flashMessage('Try another', 900);
      return;
    }

    consumeMove();
    let cascadeLevel = 1;
    let swapTarget = b;
    while (result.positions.length > 0 && !state.cascadeAbort) {
      await processMatchRound(result, cascadeLevel, swapTarget);
      result = findMatches(state.board);
      cascadeLevel++;
      swapTarget = null;
    }

    maybeUpdateBest();
    syncGrumblocks();
    refreshLevelUI();
    await ensureMovesAvailable();
    checkLevelOutcome();
  } finally {
    state.busy = false;
  }
  if (!state.resolved) scheduleHint();
}

async function processMatchRound(result, cascadeLevel, swapTarget) {
  const specialsCreated = deriveNewSpecials(result.groups, swapTarget);
  const newSpecialKeys = new Set(specialsCreated.map((s) => `${s.c},${s.r}`));

  const activated = activationClears(state.board, result.positions);
  const specialsActivated = result.positions
    .map((p) => state.board.specialAt(p.c, p.r))
    .filter(Boolean);

  const allCleared = new Set();
  for (const p of result.positions) allCleared.add(`${p.c},${p.r}`);
  for (const p of activated) allCleared.add(`${p.c},${p.r}`);

  const candidate = [...allCleared]
    .filter((k) => !newSpecialKeys.has(k))
    .map((k) => {
      const [c, r] = k.split(',').map(Number);
      return { c, r };
    })
    .filter((p) => !state.board.isIngredient(p.c, p.r));

  const { clearable: toClear, blocked: lockedBlocked } = splitByLock(candidate);
  const clearedTypes = toClear.map((p) => state.board.typeAt(p.c, p.r));

  sfx.playMatch(allCleared.size, cascadeLevel);
  const matchIntensity = allCleared.size >= 5 ? 3 : allCleared.size >= 4 ? 2 : 1;
  haptics.match(matchIntensity);
  if (cascadeLevel >= 2) {
    sfx.playCascade();
    showCascadeBanner(cascadeLevel);
    haptics.cascade(cascadeLevel);
  }
  // 🚌 Emit the canonical `match` event so subscribers (relics,
  // upgrades, future B6 effects) can hook in without editing this
  // function. Today the existing inline relic/upgrade branches still
  // run; subscribers are additive until each branch migrates over.
  bus.emit('match', {
    positions: toClear,
    cascadeLevel,
    allCleared,
    specialsCreated,
    matchSize: allCleared.size,
  });
  if (cascadeLevel >= 2) {
    bus.emit('cascade', { cascadeLevel, totalCleared: allCleared.size });
  }
  for (const s of specialsCreated) {
    bus.emit('special:birth', { type: s.type, c: s.c, r: s.r, kind: s.kind });
  }
  // Roguelike effects gated on cascade level (Stardust, Echo Match,
  // Furnace, Glow Stick, Cascade Splash, run-highlight tracker, etc.)
  // all live as `bus.on('cascade'|'match', …)` subscribers in
  // src/game/run-effects.js — see PRs #283 / #290–#295.
  if (cascadeLevel >= 3) {
    spawnConfetti(20);
  }
  if (cascadeLevel >= 4) {
    screenShake(7, 380);
    spawnConfetti(36);
  }
  if (cascadeLevel >= 5) {
    spawnScreenFlash('rgba(255, 0, 110, 0.35)');
    spawnConfetti(48);
    sfx.playEpicCascade();
  }
  if (allCleared.size >= 6 && allCleared.size < 8) {
    flashMessage('HUGE MATCH!', 1200);
    screenShake(5, 300);
    haptics.epic();
  }
  if (allCleared.size >= 8) {
    flashMessage('EPIC MATCH!', 1400);
    screenShake(9, 460);
    spawnScreenFlash('rgba(255, 214, 10, 0.45)');
    spawnConfetti(60);
    haptics.epic();
  }

  // Collect any crazy tiles to trigger this round. A crazy fires when:
  //   1. it's in toClear (a match consumed its cell), OR
  //   2. it's orthogonally adjacent to a tile in toClear — players were
  //      reporting that matches "next to" a void/bolt/prism wouldn't pop
  //      it, even though that's the obvious player intuition.
  const crazyToTrigger = [];
  const crazyKeys = new Set();
  const queueCrazy = (c, r) => {
    const key = `${c},${r}`;
    if (crazyKeys.has(key)) return;
    const cellHere = state.board.cell(c, r);
    if (!cellHere || !cellHere.crazy) return;
    crazyKeys.add(key);
    crazyToTrigger.push({ pos: { c, r }, kind: cellHere.crazy });
  };
  for (const p of toClear) queueCrazy(p.c, p.r);
  // Adjacent triggers — only fire if there's any actual match this round,
  // otherwise stray cascades from elsewhere shouldn't pop a crazy.
  if (toClear.length > 0) {
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const p of toClear) {
      for (const [dc, dr] of DIRS) {
        const nc = p.c + dc, nr = p.r + dr;
        if (nc < 0 || nc >= state.board.cols) continue;
        if (nr < 0 || nr >= state.board.rows) continue;
        queueCrazy(nc, nr);
      }
    }
  }

  drawMatchTrails(result.groups);
  spawnPopSpecks(toClear);
  await animatePop(toClear);
  state.board.clear(toClear);
  decrementJellyAt(toClear);
  if (lockedBlocked.length > 0) {
    decrementLockAt(lockedBlocked);
    for (const p of lockedBlocked) spawnTileSparkles(p.c, p.r, 8, { color: '#facc15' });
  }
  recordClearedTypes(clearedTypes);
  state.progress.matches += bottomlessMulti();
  state.progress.specials += specialsCreated.length;
  flashObjectiveProgress(specialsCreated.length);
  maybeTriggerLightning();
  maybeTriggerMeteor();
  maybeTriggerBeeStorm();
  if (specialsCreated.length > 0) {
    maybeFireSnake();
    // Roguelike on-special effects (Bomb Maker, Prism Maker, Cherry
    // Wand, Confectionery) live as `bus.on('match', …)` subscribers in
    // src/game/run-effects.js — see PRs #292 / #294 / #295. The match
    // event payload includes `specialsCreated.length`.
  }
  // Trigger crazy-tile pops (after clear, before scoring so the
  // visual chain reads in the right order).
  for (const { pos, kind } of crazyToTrigger) {
    await triggerCrazyEffect(pos, kind);
  }
  // Possibly spawn a new crazy tile from this match
  maybeSpawnCrazyOnMatch(allCleared.size, cascadeLevel);

  for (const s of specialsCreated) {
    // 🍭 Sweet Tooth mutator — auto-upgrade every special to RAINBOW.
    if (hasMutator('sweet-tooth')) s.kind = 'rainbow';
    state.board.set(s.c, s.r, { type: s.type, special: s.kind });
    spawnTileSparkles(s.c, s.r, s.kind === 'rainbow' ? 14 : 10);
    if (s.kind === 'rainbow') {
      spawnShockwave(s.c, s.r, { color: '#FF006E', size: 240 });
      spawnScreenFlash('rgba(255, 214, 10, 0.35)');
      flashMessage('RAINBOW!', 1200);
      screenShake(4, 280);
    } else {
      spawnShockwave(s.c, s.r, { color: '#FFD60A', size: 160 });
    }
  }
  renderBoard(state.board, state);
  for (const s of specialsCreated) popNewSpecial(s.c, s.r);
  if (specialsCreated.length > 0) haptics.specialBirth();
  // 🛰 Echo Drone relic — migrated to bus.on('match', …) subscriber
  // in run-effects.js (PR #17ap).

  const earned = consumeLuckyIfReady(
    applyRunScoreMultiplier(
      calcScore([...allCleared], cascadeLevel),
      cascadeLevel,
      allCleared.size
    )
  );
  // Roguelike per-swap effects (Coin Purse, Diamond Mine, Piñata,
  // Pixie Pouch, Sundae Saturday, Spice Box, Sugar Crash, Spark
  // Strike, Whirlpool, Cracked Mirror, Coin Toss, Lucky Ladybug,
  // Sugar Rush flash, Crazy Magnet) all live as
  // `bus.on('roguelike:match', …)` subscribers in run-effects.js.
  // Bottomless Cup + Lucky Magnet subscribe to plain `match` and
  // gate on cascadeLevel === 1.
  if (state.inRoguelikeRun && cascadeLevel === 1) {
    state.slotMatchCount = (state.slotMatchCount || 0) + 1;
    bus.emit('roguelike:match', {
      slotMatchCount: state.slotMatchCount,
      cascadeLevel,
      matchSize: allCleared.size,
    });
  }
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, toClear);
  // ♾️ Score crossed 1M — declare INSTANT WIN.
  maybeTriggerInfiniteScore();
  maybeDropSurprise(toClear, cascadeLevel);
  updateComboMeter(cascadeLevel);
  achievements.onScore(state.score);

  const ctx = {
    matchCount: allCleared.size,
    cascadeLevel,
    specialsCreated,
    specialsActivated,
  };
  const msg = messageFor(ctx);
  flashMessage(msg);
  speech.speak(msg);
  achievements.onMatch(ctx);

  // Slow down the rhythm so the player can see each cascade resolve.
  // Bigger combos get extra breathing room.
  const preGrav = 220 + (cascadeLevel >= 3 ? 100 : 0) + (cascadeLevel >= 5 ? 100 : 0);
  const postGrav = 340 + (cascadeLevel >= 3 ? 160 : 0) + (cascadeLevel >= 5 ? 200 : 0);
  await delay(preGrav);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(postGrav);
}

function resetBoard() {
  state.board = new Board(COLS, ROWS, CANDY_TYPES);
  state.board.fillNoMatches();
  if (!hasAnyValidSwap(state.board)) {
    reshuffle(state.board, CANDY_TYPES);
  }
  state.score = 0;
  state.scoreOverride = null;
  clearScoreOverride();
  state.selected = null;
  state.busy = false;
  state.resolved = false;
  state.almostFired = false;
  state.cascadeAbort = false;
  state.jellyMap = new Map();
  state.lockMap = new Map();
  state.progress = {
    type: {},
    matches: 0,
    specials: 0,
    jellyRemaining: 0,
    jellyTotal: 0,
    ingredientsTotal: 0,
    ingredientsDropped: 0,
  };
  state.armedTool = null;
  setArmedTool(null);
  setPowerupCounts(powerupBank());
  setScore(0);
  setBest(state.highScore);
  setStreak(state.streak);
  flashMessage('');
  achievements.onNewGame();
}

function applyLevelObstacles(level) {
  state.jellyMap = new Map();
  state.lockMap = new Map();
  let total = 0;
  let ingredientCount = 0;
  if (level && level.obstacles) {
    if (Array.isArray(level.obstacles.jelly)) {
      for (const spec of level.obstacles.jelly) {
        const [c, r, hits = 1] = spec;
        state.jellyMap.set(`${c},${r}`, hits);
        total += hits;
      }
    }
    if (Array.isArray(level.obstacles.locks)) {
      for (const spec of level.obstacles.locks) {
        const [c, r, hits = 1] = spec;
        state.lockMap.set(`${c},${r}`, hits);
      }
    }
    if (Array.isArray(level.obstacles.ingredients)) {
      for (const spec of level.obstacles.ingredients) {
        const [c, r] = spec;
        const cell = state.board.cell(c, r);
        if (cell) cell.ingredient = true;
        ingredientCount++;
      }
    }
  }
  state.progress.jellyTotal = total;
  state.progress.jellyRemaining = total;
  state.progress.ingredientsTotal = ingredientCount;
  state.progress.ingredientsDropped = 0;
}

// After every gravity settle, check the bottom row for ingredients
// that have arrived. Remove them, bump the counter, and (optionally)
// run another gravity pass to fill the freed cells.
function exitIngredients() {
  const bottom = state.board.rows - 1;
  const exited = [];
  for (let c = 0; c < state.board.cols; c++) {
    const cell = state.board.cell(c, bottom);
    if (cell && cell.ingredient) {
      exited.push({ c, r: bottom });
      state.board.set(c, bottom, null);
    }
  }
  if (exited.length === 0) return [];
  state.progress.ingredientsDropped += exited.length;
  spawnConfetti(20);
  for (const p of exited) spawnTileSparkles(p.c, p.r, 12, { color: '#FF006E' });
  const obj = state.level && state.level.objective;
  if (obj && obj.kind === 'dropIngredients') {
    flashObjectiveDelta(`+${exited.length}`);
  }
  // 🐍 Cherry Hydra (boss-6): each dropped cherry has a chance to
  // regrow a fresh cherry at row 0. The boss config carries the chance.
  const mech = state.level?.mechanic;
  if (mech && mech.kind === 'cherry-regrow' && state.level?.isBoss) {
    for (let i = 0; i < exited.length; i++) {
      if (Math.random() < (mech.chance || 0.5)) {
        bossSpawnCherry();
      }
    }
  }
  speech.speak(exited.length === 1 ? 'Dropped!' : `Dropped ${exited.length}!`);
  haptics.drop();
  return exited;
}

function gravityWithIngredients() {
  const fallen = applyGravity(state.board, CANDY_TYPES);
  const exited = exitIngredients();
  if (exited.length > 0) {
    const more = applyGravity(state.board, CANDY_TYPES);
    for (const p of more) fallen.push(p);
  }
  return fallen;
}

function isLocked(c, r) {
  const n = state.lockMap.get(`${c},${r}`);
  return n != null && n > 0;
}

function splitByLock(positions) {
  const clearable = [];
  const blocked = [];
  for (const p of positions) {
    if (isLocked(p.c, p.r)) blocked.push(p);
    else clearable.push(p);
  }
  return { clearable, blocked };
}

function decrementLockAt(positions) {
  if (state.lockMap.size === 0) return 0;
  // 🦴 Bone Charm relic — locks decrement by 2 per hit instead of 1.
  const step = hasRelic('bone-charm') ? 2 : 1;
  let dec = 0;
  for (const p of positions) {
    const k = `${p.c},${p.r}`;
    const n = state.lockMap.get(k);
    if (n && n > 0) {
      const next = Math.max(0, n - step);
      if (next === 0) state.lockMap.delete(k);
      else state.lockMap.set(k, next);
      dec++;
    }
  }
  return dec;
}

function decrementJellyAt(positions) {
  if (state.jellyMap.size === 0) return 0;
  let dec = 0;
  for (const p of positions) {
    const k = `${p.c},${p.r}`;
    const n = state.jellyMap.get(k);
    if (n && n > 0) {
      state.jellyMap.set(k, n - 1);
      dec++;
    }
  }
  if (dec > 0) {
    state.progress.jellyRemaining = Math.max(0, state.progress.jellyRemaining - dec);
    const obj = state.level && state.level.objective;
    if (obj && obj.kind === 'clearJelly') flashObjectiveDelta(`+${dec}`);
  }
  return dec;
}

function startLevel(levelId, { announce = true } = {}) {
  cancelHint();
  hideLevelOverlay();
  state.level = getLevel(levelId);
  resetBoard();
  applyLevelObstacles(state.level);
  state.movesRemaining = state.level.moves;
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  if (announce) {
    const bestStars = state.levelProgress.stars[state.level.id] || 0;
    const bestScore = (state.levelProgress.bestScores || {})[state.level.id] || 0;
    let bestPhrase = '';
    if (bestStars > 0 || bestScore > 0) {
      const parts = [];
      if (bestStars > 0) parts.push(`${bestStars} ${bestStars === 1 ? 'star' : 'stars'}`);
      if (bestScore > 0) parts.push(`${bestScore.toLocaleString()} points`);
      bestPhrase = ` Your best: ${parts.join(', ')}.`;
    }
    const tipPhrase = state.level.tip ? ` Tip: ${state.level.tip}` : '';
    speech.speak(
      `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.level.moves} moves.${bestPhrase}${tipPhrase}`
    );
    // Block input while intro is up; the intro resolves on tap or timeout.
    state.busy = true;
    const done = async () => {
      // Safety net: eat any stale matches on the freshly-loaded board.
      state.busy = true;
      try {
        await cascadePendingMatches();
      } finally {
        state.busy = false;
      }
      scheduleHint();
    };
    const p = showLevelIntro(state.level, LEVELS.length, { bestStars, bestScore });
    if (p && typeof p.then === 'function') p.then(done);
    else done();
  } else {
    cascadePendingMatches().then(() => scheduleHint());
  }
}

function startFreePlay() {
  cancelHint();
  hideLevelOverlay();
  state.level = null;
  resetBoard();
  state.movesRemaining = 0;
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  scheduleHint();
}

function init({ chime = false, announceLevel = true } = {}) {
  if (state.settings.mode === 'roguelike') {
    startRoguelikeRun();
  } else if (state.settings.mode === 'levels') {
    startLevel(state.levelProgress.currentLevel || 1, { announce: announceLevel });
  } else {
    startFreePlay();
  }
  if (chime) sfx.playRestart();
}

applyTheme(state.settings);
// 🚌 Register event-bus subscribers for run effects (first migration
// from the inline-branch maze in processMatchRound — see B6).
registerRunEffects(state, {
  hasRelic,
  hasMutator,
  hasMeta,
  upgradeCount,
  setLuckyCharge,
  flashMessage,
  persist,
  spawnCrazyTile,
  powerupBank,
  setPowerupCounts,
  effectivePowerupCap,
  fireLightning,
  preservingReshuffle,
  pickCrazyKind,
  refreshLevelUI,
  fireMeteor,
  renderBoard,
});
refreshRunHud();
// Old saves may have stockpiles above the new per-type caps. Clamp
// down to the current effective cap so the UI doesn't show "9 hammers"
// after the cap dropped to 3.
clampPowerupBank();

// Pause music when the tab is hidden — saves CPU + battery, and stops
// any audio leaking out when the user switches tabs. Restores to the
// user's settings.music preference when the tab returns to view.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sfx.setMusicEnabled(false);
  } else if (state.settings.music) {
    sfx.setMusicEnabled(true);
  }
});

// Daily login bonus toast (only if we awarded gems on this boot).
if (dailyLoginGems > 0) {
  setTimeout(() => {
    flashMessage(`🎁 Daily bonus! +${dailyLoginGems} 💎 (streak ${state.streak || 1})`, 3200);
    speech.speak(`Daily bonus. Plus ${dailyLoginGems} gems.`);
  }, 400);
  // persist the awarded gems immediately
  persist();
}

// HUD click → open the run inventory detail modal.
const runHudEl = document.getElementById('run-hud');
if (runHudEl) {
  runHudEl.style.cursor = 'pointer';
  runHudEl.title = 'Tap (or press Enter / Space) for run details';
  runHudEl.addEventListener('click', () => { showRunInventory(); });
  runHudEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showRunInventory();
    }
  });
}

// If the player has a roguelike run in progress (persisted from a
// previous session), welcome them back with a short toast naming
// their class + slot.
if (state.inRoguelikeRun && state.roguelike) {
  const cls = state.roguelike.currentClass ? getClass(state.roguelike.currentClass) : null;
  const slot = state.roguelike.currentSlot || 1;
  const upgradeN = (state.runUpgrades || []).length;
  const relicN = (state.runRelics || []).length;
  setTimeout(() => {
    const klassStr = cls ? `${cls.icon} ${cls.name}` : 'your';
    flashMessage(`Welcome back! ${klassStr} run · Slot ${slot}/${RUN_LENGTH} · ${upgradeN} upgrades · ${relicN} relics`, 3600);
    speech.speak(`Welcome back. Resuming slot ${slot}.`);
  }, 600);
}

createSettingsUI({
  initial: state.settings,
  onChange: (next) => {
    state.settings = { ...state.settings, ...next };
    sfx.setMuted(!state.settings.sound);
    sfx.setMusicEnabled(state.settings.music);
    sfx.setMusicMode(state.settings.mode);
    speech.setSpeechEnabled(state.settings.speech);
    applyTheme(state.settings);
    persist();
  },
  onResetProgress: () => {
    resetProgressSave({ settings: state.settings });
    speech.speak('Progress reset. Starting over.');
    location.reload();
  },
  // 🏠 Back to Start Menu — leaves the current session and re-opens the
  // mode picker. A roguelike run in progress is ended so gems are awarded;
  // its run-summary then chains to the start menu via the existing onClose
  // path, so we don't need to call openStartMenu directly in that case.
  onHome: () => {
    if (state.inRoguelikeRun) {
      endRoguelikeRun();
    } else {
      openStartMenu(null);
    }
  },
});

sfx.setMusicEnabled(state.settings.music);
sfx.setMusicMode(state.settings.mode);

const levelSelect = createLevelSelect({
  getProgress: () => state.levelProgress,
  onChoose: (id) => startLevel(id),
});
document.getElementById('level-chip').addEventListener('click', () => {
  if (state.settings.mode === 'levels') levelSelect.show();
});

const skillTreeBtn = document.getElementById('setting-skill-tree');
if (skillTreeBtn) {
  skillTreeBtn.addEventListener('click', () => {
    closeSettingsPanel();
    showSkillTree({
      skills: SKILL_TREE,
      gems: () => state.roguelike.gems || 0,
      owned: () => metaSkills(),
      onBuy: (id) => buyMetaSkill(id),
      stats: {
        runs: state.roguelike?.runsStarted || 0,
        completes: state.roguelike?.runsCompleted || 0,
        bestSlot: state.roguelike?.bestSlot || 0,
        bossesDefeated: state.roguelike?.bossesDefeated || 0,
      },
    });
  });
}

// 🪟 Close the Settings panel before launching a modal that lives at
// a lower z-index than Settings itself (z-115). Without this the new
// modal renders BEHIND Settings and the player sees nothing happen.
// One panel at a time is cleaner UX anyway.
function closeSettingsPanel() {
  const o = document.getElementById('settings-overlay');
  const p = document.getElementById('settings-panel');
  if (o) o.classList.add('hidden');
  if (p) p.classList.add('hidden');
}

// 📓 Run-history modal (Phase 17n / D1).
const runHistoryBtn = document.getElementById('setting-run-history');
if (runHistoryBtn) {
  runHistoryBtn.addEventListener('click', () => {
    closeSettingsPanel();
    showRunHistory({
      entries: state.runHistory || [],
      getClass,
    });
  });
}

// 🏅 Class-mastery modal (Phase 17s / D2).
const classMasteryBtn = document.getElementById('setting-class-mastery');
if (classMasteryBtn) {
  classMasteryBtn.addEventListener('click', () => {
    closeSettingsPanel();
    showClassMastery({
      classes: CLASSES,
      classStats: state.roguelike?.classStats || {},
    });
  });
}

document.getElementById('help-open').addEventListener('click', () => {
  sfx.unlockAudio();
  showWelcome(() => {
    if (state.settings.mode === 'levels' && state.level) {
      speech.speak(
        `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.movesRemaining} moves left.`
      );
    }
  });
});

// 🏠 Header Home button — always-on shortcut back to the start menu so
// the player can swap modes (Roguelike / Levels / Free Play) from any
// game state, not just after a roguelike run ends.
const homeOpenBtn = document.getElementById('home-open');
if (homeOpenBtn) {
  homeOpenBtn.addEventListener('click', () => {
    sfx.unlockAudio();
    if (state.inRoguelikeRun) {
      // endRoguelikeRun() shows the run summary; its onClose chains
      // into openStartMenu, so we don't double-open.
      endRoguelikeRun();
    } else {
      openStartMenu(null);
    }
  });
}

document.getElementById('restart').addEventListener('click', () => {
  sfx.unlockAudio();
  if (state.settings.mode === 'roguelike') {
    // Mid-run restart = forfeit the run from current slot
    if (state.inRoguelikeRun) endRoguelikeRun();
    startRoguelikeRun();
  } else if (state.settings.mode === 'levels') {
    startLevel(state.level ? state.level.id : state.levelProgress.currentLevel || 1);
  } else {
    startFreePlay();
  }
  sfx.playRestart();
});

// 🔊 iOS requires audio to be unlocked from inside a user-gesture event
// handler. We already call sfx.unlockAudio() from every button handler in
// the boot flow, but a defensive one-shot at the document level covers
// any path we missed (e.g. keyboard-only interaction, focus restoration).
function firstGestureUnlock() {
  sfx.unlockAudio();
  document.removeEventListener('pointerdown', firstGestureUnlock, true);
  document.removeEventListener('keydown', firstGestureUnlock, true);
  document.removeEventListener('touchstart', firstGestureUnlock, true);
}
document.addEventListener('pointerdown', firstGestureUnlock, { capture: true, once: false });
document.addEventListener('keydown', firstGestureUnlock, { capture: true, once: false });
document.addEventListener('touchstart', firstGestureUnlock, { capture: true, once: false, passive: true });

async function onSwipe(origin, target) {
  if (state.busy) return;
  if (state.resolved) return;
  cancelHint();
  sfx.unlockAudio();
  // Treat the swipe as: select origin, then commit to target.
  // If origin or target is a tool-armed flow, fall back to taps.
  if (state.armedTool === 'hammer' || state.armedTool === 'colorBomb') {
    return onTap(origin);
  }
  state.selected = null;
  await trySwap(origin, target);
}

attachInput({ onTap, onSwap: onSwipe });

// ⏸ Pause overlay (Phase 17t / C3).
//
// Esc opens this if there's nothing else to dismiss. PC-game framing —
// "quit to start menu" shouldn't be an instant button press; the
// player wants a chance to back out. Resume just hides the overlay
// and returns to the live board.
function openPauseMenu() {
  const overlay = document.getElementById('pause-overlay');
  const panel = document.getElementById('pause-panel');
  if (!overlay || !panel) return;
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  const resume = document.getElementById('pause-resume');
  const settings = document.getElementById('pause-settings');
  const quit = document.getElementById('pause-quit');
  const close = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
  };
  if (resume) resume.onclick = close;
  if (overlay) overlay.onclick = close;
  if (settings) settings.onclick = () => {
    close();
    const btn = document.getElementById('settings-open');
    if (btn) btn.click();
  };
  if (quit) quit.onclick = () => {
    close();
    const btn = document.getElementById('home-open');
    if (btn) btn.click();
  };
  if (resume) resume.focus();
}

// ⌨ Keyboard input (Phase 17t / C1).
//
// Arrow keys: move the focus cursor across the board.
// Space / Enter: select the focused tile (and commit a swap if a
//   neighbor is already selected and adjacent).
// Esc: deselect / clear cursor. If no selection, opens the Pause Menu.
// 1 / 2 / 3 / 4: arm hammer / shuffle / color bomb / +3 moves.
// h: trigger a hint glow.
//
// We don't draw a separate cursor — we reuse the existing `.kb-focus`
// class on the focused tile so the visual is consistent with the
// `:focus-visible` outline on every other button.
let kbCursor = { c: 0, r: 0 };
function paintKbCursor() {
  document.querySelectorAll('#board .tile.kb-focus').forEach((el) => el.classList.remove('kb-focus'));
  const tile = document.querySelector(`#board .tile[data-c="${kbCursor.c}"][data-r="${kbCursor.r}"]`);
  if (tile) tile.classList.add('kb-focus');
}
function nudgeCursor(dc, dr) {
  const c = Math.max(0, Math.min(COLS - 1, kbCursor.c + dc));
  const r = Math.max(0, Math.min(ROWS - 1, kbCursor.r + dr));
  kbCursor = { c, r };
  paintKbCursor();
}
document.addEventListener('keydown', (e) => {
  // Bail if the focus is on a real form element (e.g. someone is typing
  // a username one day). We currently have no text inputs but be safe.
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  // Don't fight modal close handlers — Esc inside a modal goes to the
  // existing settings/overlay handlers via DOM bubbling.
  if (document.body.classList.contains('start-screen-active')) return;
  if (e.key === 'Escape') {
    if (state.selected) {
      state.selected = null;
      renderBoard(state.board, state);
      e.preventDefault();
      return;
    }
    // No selection → open pause overlay.
    openPauseMenu();
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { nudgeCursor(-1, 0); e.preventDefault(); return; }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { nudgeCursor(1, 0); e.preventDefault(); return; }
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { nudgeCursor(0, -1); e.preventDefault(); return; }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { nudgeCursor(0, 1); e.preventDefault(); return; }
  if (e.key === ' ' || e.key === 'Enter') {
    sfx.unlockAudio();
    onTap({ c: kbCursor.c, r: kbCursor.r });
    e.preventDefault();
    return;
  }
  if (e.key === '1') { const b = document.getElementById('pu-hammer'); if (b) b.click(); e.preventDefault(); return; }
  if (e.key === '2') { const b = document.getElementById('pu-shuffle'); if (b) b.click(); e.preventDefault(); return; }
  if (e.key === '3') { const b = document.getElementById('pu-colorbomb'); if (b) b.click(); e.preventDefault(); return; }
  if (e.key === '4') { const b = document.getElementById('pu-plusmoves'); if (b) b.click(); e.preventDefault(); return; }
  if (e.key === 'h' || e.key === 'H') { const b = document.getElementById('hint-btn'); if (b) b.click(); e.preventDefault(); return; }
});

// 🚑 Recovery: if an unhandled error escapes any async board pipeline
// (swap, cascade, hammer, color bomb, plus moves, slot intro), the
// `state.busy = false` cleanup at the bottom of that function never
// runs and the board is frozen for the rest of the session. These
// window-level handlers reset `state.busy` so input recovers — paired
// with the per-function try/finally below for belt-and-suspenders.
function recoverFromStuckBusy(label, detail) {
  if (state.busy) {
    state.busy = false;
    // eslint-disable-next-line no-console
    console.error(`[recover] state.busy reset after ${label}`, detail);
  }
}
window.addEventListener('error', (e) => recoverFromStuckBusy('window error', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => recoverFromStuckBusy('unhandled rejection', e.reason));

document.addEventListener(
  'pointerdown',
  (e) => {
    const target = e.target instanceof Element ? e.target.closest('button, .tile') : null;
    if (!target) return;
    if (target.disabled) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    const cs = getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  },
  { passive: true }
);

// Initialize lucky bar display
setLuckyCharge(0, false);



// Boot flow: ALWAYS land on the start screen. No tutorial, no changelog,
// no auto-resume — the player chooses. Help (?) and What's New on the
// start screen still surface the tutorial / changelog. A roguelike run
// in progress will resume when the player picks Roguelike (startRoguelikeRun
// preserves currentSlot when > 1).
if (!state.seenWelcome) {
  // Mark as seen on first boot so we never block the start screen with
  // the tutorial again. The tutorial stays available via the ? button.
  state.seenWelcome = true;
  state.seenVersion = APP_VERSION;
  persist();
}
// 🚀 PWA shortcut launchers — when the installed app is launched via
// one of the manifest.json `shortcuts` entries, the URL carries an
// `?action=` query that picks a mode directly instead of landing on
// the start menu. Only honored once per boot.
const _bootAction = (() => {
  try { return new URLSearchParams(window.location.search).get('action'); }
  catch { return null; }
})();
if (_bootAction === 'roguelike') {
  state.settings.mode = 'roguelike';
  sfx.setMusicMode('roguelike');
  persist();
  startRoguelikeRun();
} else if (_bootAction === 'levels') {
  state.settings.mode = 'levels';
  sfx.setMusicMode('levels');
  persist();
  startLevel(state.levelProgress.currentLevel || 1);
} else if (_bootAction === 'free') {
  state.settings.mode = 'free';
  sfx.setMusicMode('free');
  persist();
  startFreePlay();
} else {
  openStartMenu(null);
}
persist();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch(() => {
        // No-op: PWA install just won't be available.
      });
  });
}
