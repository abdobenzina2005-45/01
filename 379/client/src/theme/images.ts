import type { ThemeId } from "./themes";

const baseUrl = import.meta.env.BASE_URL;

/** Theme-specific hero imagery; the built-in theme deliberately lives beside Themes/. */
export function themeImageUrl(themeId: ThemeId, imageName: string): string {
  const safeName = imageName.split("/").map(encodeURIComponent).join("/");
  if (themeId === "luxury-editorial") {
    return `${baseUrl}ThemeImages/luxury-editorial/${safeName}`;
  }
  return `${baseUrl}Themes/${encodeURIComponent(themeId)}/assets/images/${safeName}`;
}

/** Resolve a manifest path against Vite's configured deployment base. */
export function resolveThemeHeroImage(themeId: ThemeId, configuredPath?: string): string {
  if (!configuredPath) return themeImageUrl(themeId, "hero.jpg");
  if (/^(?:https?:|data:|blob:)/i.test(configuredPath) || configuredPath.startsWith(baseUrl)) return configuredPath;
  return `${baseUrl}${configuredPath.replace(/^\/+/, "")}`;
}

/** Shared contextual scenes remain inside the Themes package tree. */
export function sharedThemeImageUrl(group: "prayers" | "adhkar" | "fortress", imageName: string): string {
  return `${baseUrl}Themes/_shared/images/${group}/${encodeURIComponent(imageName)}`;
}

const prayerImageByArabic: Record<string, string> = {
  الفجر: "prayer-fajr.jpg",
  الشروق: "prayer-sunrise.jpg",
  الظهر: "prayer-dhuhr.jpg",
  العصر: "prayer-asr.jpg",
  المغرب: "prayer-maghrib.jpg",
  العشاء: "prayer-isha.jpg",
};

export function prayerSceneUrl(arabicPrayerName: string): string {
  return sharedThemeImageUrl("prayers", prayerImageByArabic[arabicPrayerName] ?? "prayer-dhuhr.jpg");
}

export function adhkarSceneUrl(label: string | null | undefined): string {
  const value = label ?? "";
  const name = value.includes("الصباح") || value.includes("الاستيقاظ")
    ? "dhikr-morning.jpg"
    : value.includes("المساء")
      ? "dhikr-evening.jpg"
      : value.includes("النوم")
        ? "dhikr-sleep.jpg"
        : value.includes("البيت")
          ? "dhikr-home.jpg"
          : "dhikr-daily.jpg";
  return sharedThemeImageUrl("adhkar", name);
}

/** Contextual imagery for the notification settings cards. */
export function adhkarSettingsSceneUrl(label: string | null | undefined): string {
  const value = label ?? "";
  if (value.includes("الصيام") || value.includes("صيام")) return sharedThemeImageUrl("fortress", "category-fasting.jpg");
  if (value.includes("القيام") || value.includes("النوافل")) return prayerSceneUrl("الفجر");
  if (value.includes("الضحى")) return prayerSceneUrl("الشروق");
  if (value.includes("تكبير") || value.includes("الجمعة")) return prayerSceneUrl("الظهر");
  if (value.includes("ساعة الإجابة")) return sharedThemeImageUrl("adhkar", "dhikr-daily.jpg");
  if (value.includes("الصلاة على النبي")) return sharedThemeImageUrl("adhkar", "dhikr-evening.jpg");
  if (value.includes("المساء")) return sharedThemeImageUrl("adhkar", "dhikr-evening.jpg");
  if (value.includes("الصباح")) return sharedThemeImageUrl("adhkar", "dhikr-morning.jpg");
  if (value.includes("النوم")) return sharedThemeImageUrl("adhkar", "dhikr-sleep.jpg");
  return sharedThemeImageUrl("adhkar", "dhikr-daily.jpg");
}


const fortressImageByArabic: Record<string, string> = {
  "أذكار الصلاة": "category-prayer.jpg",
  "أذكار الأذان": "category-adhan.jpg",
  "أذكار المرض والهم والدين": "category-illness-worry-debt.jpg",
  "المرض": "category-illness-worry-debt.jpg",
  "أذكار المريض لنفسه": "category-illness-worry-debt.jpg",
  "أذكار زيارة المريض": "category-illness-worry-debt.jpg",
  "أذكار الهم والكرب": "category-fear.jpg",
  "أذكار قضاء الدين": "category-illness-worry-debt.jpg",
  "أذكار السفر": "category-travel.jpg",
  "عند ركوب الدابة أو ما يقوم مقامها": "category-travel.jpg",
  "دعاء المقيم للمسافر": "category-travel.jpg",
  "أذكار هبوب الرياح": "category-cosmos.jpg",
  "أذكار الرعد": "category-cosmos.jpg",
  "أذكار المطر": "category-cosmos.jpg",
  "دعـاء الخوف من الشــرك": "category-fear.jpg",
  "دعاء الخوف من القوم": "category-fear.jpg",
  "أذكار الظواهر الكونية": "category-cosmos.jpg",
  "أذكار الخوف والفزع": "category-fear.jpg",
  "أذكار الصيام": "category-fasting.jpg",
  "أذكار خاصة بالحيوانات": "category-animals.jpg",
  "أدعية استفتاح الصلاة": "prayer-opening.jpg",
  "أدعية الركوع": "prayer-ruku.jpg",
  "أدعية الرفع من الركوع": "prayer-rise.jpg",
  "أدعية السجود": "prayer-sujood.jpg",
  "أدعية الجلوس بين السجدتين": "prayer-between-sujood.jpg",
  "التشهد": "prayer-tashahhud.jpg",
  "أدعية بعد التشهد الأخير وقبل السلام": "prayer-before-salam.jpg",
  "دعاء القنوت": "prayer-qunut.jpg",
  "صلاة الفجر": "prayer-qunut.jpg",
  "صلاة الوتر": "prayer-opening.jpg",
  "عند النوازل": "category-fear.jpg",
  "دعاء سجود التلاوة": "prayer-recitation-prostration.jpg",
  "صلاة الجنازة": "prayer-funeral.jpg",
  "صلاة الاستخارة": "prayer-istikhara.jpg",
};

export function fortressSceneUrl(label: string | null | undefined): string {
  const key = label ?? "";
  if (key === "أذكار الظواهر الكونية") return sharedThemeImageUrl("adhkar", "dhikr-sleep.jpg");
  if (key === "أذكار الخوف والفزع") return sharedThemeImageUrl("adhkar", "dhikr-home.jpg");
  if (key === "أذكار الصيام") return sharedThemeImageUrl("adhkar", "dhikr-evening.jpg");
  if (key === "أذكار خاصة بالحيوانات") return themeImageUrl("nature-calm", "hero.jpg");
  return sharedThemeImageUrl("fortress", fortressImageByArabic[key] ?? "category-prayer.jpg");
}

const featureBackgroundByArabic: Record<string, string> = {
  "التقويم": "calendar.svg",
  "السبحة": "tasbeeh.svg",
  "حصن المسلم": "fortress.svg",
  "الدعاء": "dua.svg",
  "بنك الصدقات": "charity.svg",
  "طاعاتك": "deeds.svg",
  "التحفيظ": "quran.svg",
  "الأسئلة": "questions.svg",
  "في مثل هذا اليوم": "history.svg",
  "المصحف": "quran.svg",
  "الأذكار": "adhkar.svg",
  "منبه الفجر": "fajr-alarm.svg",
  "الإعدادات": "settings.svg",
  "القبلة": "qibla.svg",
  "مساجد": "mosques.svg",
};

export function featureSceneUrl(label: string | null | undefined): string | undefined {
  const fileName = featureBackgroundByArabic[label ?? ""];
  return fileName ? `${baseUrl}feature-backgrounds/${fileName}` : undefined;
}
