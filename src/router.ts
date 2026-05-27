/**
 * Hash-based routing config. Hash routes work on GitHub Pages without
 * server rewrites and preserve the browser back-button.
 */
export const routes = {
  splash: "/",
  home: "/home",
  modes: "/modes",
  spread: "/spread",
  play: "/play",
  settings: "/settings",
  about: "/about",
} as const;

export type Route = (typeof routes)[keyof typeof routes];
