// English string table. Seed v1 — only the most prominent UI surfaces
// are migrated here. The rest of the codebase still renders raw EN
// strings via flashMessage / inline template literals; those migrate
// incrementally as we touch the surfaces.
//
// Key convention: dotted lowercase paths. Group by feature/area, NOT
// by file (so renaming files doesn't churn the dictionary).

export default {
  start: {
    title: 'Sweet Match',
    tagline: 'Match candies. Pick your adventure.',
    roguelike: '⚔ Roguelike Run',
    levels: '🎯 Levels Mode',
    free: '🎨 Free Play',
    resume: '▶ Resume {classIcon} Run · Slot {slot} / {total}',
    abandon: '⨯ Abandon current run',
    settings: '⚙ Settings',
    whatsNew: '📖 What\'s New',
    quit: '🚪 Quit Game',
  },
  goodbye: {
    title: 'Thanks for playing!',
    body: 'Sweet Match will be here whenever you\'re back. 🍬',
    back: '↩ Back to start screen',
  },
  run: {
    runComplete: '🏆 Run complete — pick where to go next.',
    runOver: 'Run over — pick where to go next.',
  },
  level: {
    tapToStart: 'Tap anywhere to start',
  },
  save: {
    corrupted: '⚠ Save was corrupted, started fresh.',
    corruptedWithBackup: '⚠ Save was corrupted, started fresh. Your previous save was backed up.',
    writeBlocked: '⚠ Saving disabled (private mode or storage full)',
  },
  modes: {
    roguelike: 'Roguelike',
    levels: 'Levels',
    free: 'Free Play',
  },
};
