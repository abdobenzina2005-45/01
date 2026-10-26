export type ThemeId = string;

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  englishName: string;
  description: string;
  palette: string;
  preview: string;
  heroImage?: string;
  builtIn?: boolean;
};

type OptionalThemeManifest = {
  themes?: unknown[];
};

export const defaultThemeId: ThemeId = "luxury-editorial";

/** The fallback theme is always bundled with the application. */
export const defaultThemeDefinition: ThemeDefinition = {
  id: defaultThemeId,
  name: "الفاخر Editorial",
  englishName: "Luxury Editorial",
  description: "المظهر الافتراضي المدمج: فحمي مطفأ وذهبي عتيق بتباين هادئ",
  palette: "#171817 · #bd9d68 · #eee5d5",
  preview: `${import.meta.env.BASE_URL}Themes/luxury-editorial/assets/preview.png`,
  heroImage: `${import.meta.env.BASE_URL}ThemeImages/luxury-editorial/hero.jpg`,
  builtIn: true,
};

const optionalThemesBase = `${import.meta.env.BASE_URL}Themes/`;
const pendingThemeLoads = new Map<ThemeId, Promise<void>>();

function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value !== defaultThemeId;
}

function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return isValidThemeId(item.id)
    && typeof item.name === "string"
    && typeof item.englishName === "string"
    && typeof item.description === "string"
    && typeof item.palette === "string"
    && typeof item.preview === "string"
    && (item.heroImage === undefined || typeof item.heroImage === "string");
}

/** Read the installed optional-theme catalog from the public Themes folder. */
export async function loadThemeCatalog(): Promise<ThemeDefinition[]> {
  try {
    const response = await fetch(`${optionalThemesBase}manifest.json`, { cache: "no-store" });
    if (!response.ok) return [defaultThemeDefinition];
    const manifest = await response.json() as OptionalThemeManifest;
    const optional = Array.isArray(manifest.themes) ? manifest.themes.filter(isThemeDefinition) : [];
    const unique = new Map<ThemeId, ThemeDefinition>();
    for (const theme of optional) {
      if (!unique.has(theme.id)) unique.set(theme.id, theme);
    }
    return [defaultThemeDefinition, ...Array.from(unique.values())];
  } catch {
    // The built-in theme remains available when optional files or the manifest are absent.
    return [defaultThemeDefinition];
  }
}

/** Load an optional stylesheet only when its theme is selected. */
export function loadThemeStyles(themeId: ThemeId): Promise<void> {
  if (themeId === defaultThemeId) return Promise.resolve();
  if (!isValidThemeId(themeId)) return Promise.reject(new Error(`Invalid theme id: ${themeId}`));

  const pending = pendingThemeLoads.get(themeId);
  if (pending) return pending;

  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[data-mosaly-theme]"))
    .find((link) => link.dataset.mosalyTheme === themeId);
  if (existing?.dataset.loaded === "true") return Promise.resolve();

  const link = existing ?? document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${optionalThemesBase}${encodeURIComponent(themeId)}/theme.css`;
  link.dataset.mosalyTheme = themeId;

  const loading = new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => {
      link.dataset.loaded = "true";
      resolve();
    }, { once: true });
    link.addEventListener("error", () => {
      link.remove();
      reject(new Error(`Could not load theme: ${themeId}`));
    }, { once: true });
    if (!existing) document.head.appendChild(link);
  });

  pendingThemeLoads.set(themeId, loading);
  void loading.catch(() => pendingThemeLoads.delete(themeId));
  return loading;
}
