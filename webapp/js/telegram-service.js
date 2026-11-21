export class TelegramService {
  constructor(webApp = window.Telegram?.WebApp ?? null) {
    this.webApp = webApp;
  }

  init() {
    if (!this.webApp) return;
    try {
      this.webApp.ready();
      this.webApp.expand();
      this.syncTheme(document.documentElement.dataset.theme);
    } catch (_) {}
  }

  getUser() {
    return this.webApp?.initDataUnsafe?.user ?? null;
  }

  getColorScheme() {
    return this.webApp?.colorScheme ?? null;
  }

  haptic(style = "light") {
    try {
      this.webApp?.HapticFeedback?.impactOccurred(style);
    } catch (_) {}
  }

  syncTheme(theme) {
    if (!this.webApp) return;
    const dark = theme === "dark";
    const header = dark ? "#1c2128" : "#efe6d8";
    const bg = dark ? "#171b20" : "#f3ede3";
    try {
      this.webApp.setHeaderColor?.(header);
      this.webApp.setBackgroundColor?.(bg);
    } catch (_) {}
  }
}
