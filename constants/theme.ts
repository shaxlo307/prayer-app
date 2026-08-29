/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

/**
 * Brand palette shared with the marketing landing page (see Day 3/4 hero
 * section). `prayerColors` maps to the landing page's day-arc concept and
 * is marketing-only — per the app spec, in-app screens must NOT color-code
 * by individual prayer. Use `accent` / `streak` / `neutralStroke` below for
 * all in-app components instead.
 */
export const Brand = {
  paper: "#F6F2E9",
  paperDeep: "#EFE9DB",
  ink: "#211F2E",
  muted: "#6B6558",
  line: "rgba(33, 31, 46, 0.13)",

  /**
   * In-app semantic colors (spec section "Color usage"):
   * - `accent`: the ONE color for all "done" states — ring fill, filled
   *   check, progress bar. Never mix with prayerColors on the same screen.
   * - `streak`: a second, distinct color reserved ONLY for streak/flame
   *   indicators, so it reads as a separate signal from completion.
   * - `neutralStroke`: unmarked/missed items. Deliberately not red — the
   *   spec is explicit that nothing should read as a warning/danger color.
   */
  accent: "#B85C3E",
  streak: "#E7B84D",
  neutralStroke: "rgba(33, 31, 46, 0.22)",

  /** Marketing/landing-page only — do not use for in-app screens. */
  prayerColors: {
    fajr: "#7C6FB0",
    dhuhr: "#E7B84D",
    asr: "#D98A4E",
    maghrib: "#B85C3E",
    isha: "#2B2A45",
  } as const,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
