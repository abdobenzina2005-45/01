import { Fragment, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  BedDouble,
  Bell,
  BookOpenText,
  CalendarDays,
  Castle,
  Check,
  ChevronLeft,
  CircleAlert,
  CircleHelp,
  CloudSun,
  Compass,
  ChevronDown,
  ArrowUp,
  ChevronRight,
  DoorOpen,
  DoorClosed,
  Droplets,
  HandHeart,
  Heart,
  House,
  Landmark,
  LibraryBig,
  LogOut,
  Headphones,
  History,
  MapPin,
  Menu,
  MessageCircleQuestion,
  Moon,
  MoonStar,
  MoreHorizontal,
  Image as ImageIcon,
  Navigation,
  Plus,
  RotateCcw,
  List,
  Maximize2,
  Minimize2,
  Search,
  Settings2,
  Palette,
  PenLine,
  Video,
  Volume1,
  BellRing,
  SlidersHorizontal,
  Play,
  Pause,
  PawPrint,
  SkipBack,
  SkipForward,
  Upload,
  Download,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMedium,
  Sunrise,
  Sunset,
  TimerReset,
  Trash2,
  Utensils,
  Star,
  BookOpen,
  Volume2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { citySchedules, defaultCity, getCityClock, getCityDateLabels, getPrayerScheduleForCity, getNightTimesForCity, prayerMethodLabel, type CitySchedule } from "@/lib/prayerTimes";
import { defaultThemeDefinition, defaultThemeId, loadThemeCatalog, loadThemeStyles, type ThemeDefinition, type ThemeId } from "@/theme/themes";
import { adhkarSceneUrl, adhkarSettingsSceneUrl, featureSceneUrl, fortressSceneUrl, prayerSceneUrl, resolveThemeHeroImage, themeImageUrl } from "@/theme/images";
import MosquesModal from "@/components/MosquesModal";
import SteampunkCounter from "@/components/SteampunkCounter";
import SubhaCounter from "@/components/SubhaCounter";

const DHIKR_THEME_INKS: Record<string, { surface: string; text: string; title: string }> = {
  "luxury-editorial": { surface: "#222320", text: "#eee5d5", title: "#d1b77f" },
  "technological-neon": { surface: "#0b202a", text: "#d9fffc", title: "#b8f7f1" },
  "modern-minimal": { surface: "#f6f5ef", text: "#263f3b", title: "#386e63" },
  "windows11-fluent": { surface: "#243650", text: "#e7f3ff", title: "#d8eaff" },
  andalusian: { surface: "#eadfc5", text: "#354333", title: "#765b36" },
  glassmorphism: { surface: "#272e52", text: "#f2f3ff", title: "#d7dcff" },
  "amoled-cyber": { surface: "#0e1017", text: "#f7f2ff", title: "#e4c9ff" },
  "material-depth": { surface: "#35483f", text: "#f5e8d0", title: "#e1b866" },
  "nature-calm": { surface: "#f7f9f2", text: "#344639", title: "#386e63" },
  "dashboard-grid": { surface: "#17343b", text: "#ecf3ee", title: "#e7ca98" },
};

function getDhikrThemeInk(themeId: string) {
  return DHIKR_THEME_INKS[themeId] ?? DHIKR_THEME_INKS["luxury-editorial"];
}

function parseDhikrHexColor(color: string): [number, number, number] | null {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split("").map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number];
}

function dhikrRelativeLuminance(color: string): number | null {
  const rgb = parseDhikrHexColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getReadableDhikrColor(color: string, themeId: string, role: "text" | "title") {
  const palette = getDhikrThemeInk(themeId);
  const foreground = dhikrRelativeLuminance(color);
  const background = dhikrRelativeLuminance(palette.surface);
  if (foreground === null || background === null) return palette[role];
  const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  return contrast >= 4.5 ? color : palette[role];
}

type Prayer = {
  name: string;
  arabic: string;
  time: string;
  minuteOfDay: number;
  icon: LucideIcon;
  tone: string;
  next?: boolean;
};

type Feature = {
  title: string;
  caption: string;
  icon: LucideIcon;
  tone: string;
  featured?: boolean;
};

type CustomDhikrCard = {
  id: string;
  title: string;
  caption: string;
  iconUrl?: string;
  background?: string;
  contentMode?: "icons" | "dhikrs";
  children?: CustomDhikrCard[];
  dhikrs: MorningDhikr[];
  scope?: "adhkar" | "fortress";
  fortressParentSection?: string;
};


const prayers: Prayer[] = [
  { name: "Fajr", arabic: "الفجر", time: "05:44", minuteOfDay: 5 * 60 + 44, icon: MoonStar, tone: "blue" },
  { name: "Shurooq", arabic: "الشروق", time: "07:07", minuteOfDay: 7 * 60 + 7, icon: Sunrise, tone: "amber" },
  { name: "Dhuhr", arabic: "الظهر", time: "01:35", minuteOfDay: 13 * 60 + 35, icon: Sun, tone: "yellow" },
  { name: "Asr", arabic: "العصر", time: "05:01", minuteOfDay: 17 * 60 + 1, icon: CloudSun, tone: "violet", next: true },
  { name: "Maghrib", arabic: "المغرب", time: "07:50", minuteOfDay: 19 * 60 + 50, icon: Sunset, tone: "orange" },
  { name: "Isha", arabic: "العشاء", time: "09:06", minuteOfDay: 21 * 60 + 6, icon: Moon, tone: "indigo" },
];

const prayerNames = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];

type IqamaWeekPlan = { enabledDays: number[]; minutesByDay: Record<number, number> };
type WeeklyAlertKind = "before" | "adjust" | "iqama";
type FajrAlarmMode = "exact" | "beforeFajr";
type FajrPuzzleMode = "none" | "randomMath" | "customMath" | "sequence";
type FajrAlarm = {
  id: string;
  time: string;
  mode: FajrAlarmMode;
  minutesBeforeFajr: number;
  days: number[];
  soundName: string;
  soundUrl?: string;
  puzzle: FajrPuzzleMode;
  puzzleQuestion?: string;
  puzzleAnswer?: string;
};
const fajrAlarmDays = [
  { index: 0, label: "الأحد" }, { index: 1, label: "الإثنين" }, { index: 2, label: "الثلاثاء" },
  { index: 3, label: "الأربعاء" }, { index: 4, label: "الخميس" }, { index: 5, label: "الجمعة" }, { index: 6, label: "السبت" },
];
const fajrAlarmStorageKey = "al-mosaly-fajr-alarms";
const iqamaWeekdays = [
  { index: 0, label: "الأحد" }, { index: 1, label: "الإثنين" }, { index: 2, label: "الثلاثاء" },
  { index: 3, label: "الأربعاء" }, { index: 4, label: "الخميس" }, { index: 5, label: "الجمعة" }, { index: 6, label: "السبت" },
] as const;
const allIqamaWeekdayIndexes = iqamaWeekdays.map((day) => day.index);
const iqamaWeekPlansStorageKey = "al-mosaly-iqama-week-plans";
const beforeAlertWeekPlansStorageKey = "al-mosaly-before-alert-week-plans";
const prayerCorrectionWeekPlansStorageKey = "al-mosaly-prayer-correction-week-plans";
const fridayDhikrTimesStorageKey = "al-mosaly-friday-dhikr-times";
const defaultFridayDhikrTimes = ["13:00", "16:00", "19:00"];
function loadFridayDhikrTimes() {
  try {
    const raw = localStorage.getItem(fridayDhikrTimesStorageKey);
    if (!raw) return [...defaultFridayDhikrTimes];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return [...defaultFridayDhikrTimes];
    const valid = stored.filter((value): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
    if (valid.length === 0) return [...defaultFridayDhikrTimes];
    return Array.from({ length: 24 }, (_, index) => valid[index] ?? defaultFridayDhikrTime(index));
  } catch {
    return [...defaultFridayDhikrTimes];
  }
}
function defaultFridayDhikrTime(index: number) {
  const minuteOfDay = Math.min(23 * 60 + 45, 13 * 60 + index * 180);
  return `${Math.floor(minuteOfDay / 60).toString().padStart(2, "0")}:${(minuteOfDay % 60).toString().padStart(2, "0")}`;
}

function defaultIqamaWeekPlan(minutes = 15): IqamaWeekPlan {
  return { enabledDays: [...allIqamaWeekdayIndexes], minutesByDay: Object.fromEntries(allIqamaWeekdayIndexes.map((day) => [day, minutes])) };
}

function loadPrayerWeekPlans(storageKey: string, defaultMinutes: number): Record<string, IqamaWeekPlan> {
  const defaults = Object.fromEntries(prayerNames.map((name) => [name, defaultIqamaWeekPlan(defaultMinutes)]));
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Record<string, { enabledDays?: unknown; minutesByDay?: Record<string, unknown> }>;
    return Object.fromEntries(prayerNames.map((name) => {
      const plan = stored[name];
      const enabledDays = Array.isArray(plan?.enabledDays)
        ? plan.enabledDays.filter((day, index, days): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6 && days.indexOf(day) === index)
        : [...allIqamaWeekdayIndexes];
      const minutesByDay = Object.fromEntries(allIqamaWeekdayIndexes.map((day) => {
        const saved = plan?.minutesByDay?.[String(day)];
        return [day, typeof saved === "number" && Number.isFinite(saved) ? Math.floor(saved) : defaultMinutes];
      }));
      return [name, { enabledDays, minutesByDay }];
    }));
  } catch {
    return defaults;
  }
}

function loadIqamaWeekPlans(): Record<string, IqamaWeekPlan> {
  return loadPrayerWeekPlans(iqamaWeekPlansStorageKey, 15);
}

function getWeekdayIndexInTimeZone(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  const weekdayIndexes: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return weekdayIndexes[weekday] ?? date.getDay();
}
const countryNames = Array.from(new Set(citySchedules.map((item) => item.country)));

function scheduleForCity(city: CitySchedule, date: Date, daylightSavingEnabled = true): Prayer[] {
  const calculated = getPrayerScheduleForCity(city, date, daylightSavingEnabled);
  return prayers.map((prayer, index) => ({
    ...prayer,
    arabic: prayerNames[index],
    time: calculated[index]?.time ?? prayer.time,
    minuteOfDay: calculated[index]?.minuteOfDay ?? prayer.minuteOfDay,
  }));
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return { hours, minutes, secs };
}

function isGenericNumberedDhikrTitle(title?: string | null) {
  const normalized = title?.trim().replace(/\s+/g, " ") ?? "";
  return /^(?:الذكر|الدعاء)\s+(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر|السادس عشر|السابع عشر|الثامن عشر|التاسع عشر|العشرون|\d+|[٠-٩]+)$/.test(normalized);
}

function formatIqamaCountdown(prayerMinute: number, currentSeconds: number, delayMinutes: number, enabled: boolean) {
  if (!enabled) return null;

  const daySeconds = 24 * 60 * 60;
  const delaySeconds = Math.max(0, delayMinutes) * 60;
  if (delaySeconds === 0) return null;

  const prayerSeconds = prayerMinute * 60;
  const elapsedSinceAdhan = (currentSeconds - prayerSeconds + daySeconds) % daySeconds;
  if (elapsedSinceAdhan >= delaySeconds) return null;

  const remaining = delaySeconds - elapsedSinceAdhan;
  const hours = Math.floor(remaining / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((remaining % 3600) / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  return `-${hours}:${minutes}:${seconds}`;
}

function SettingsCardArt({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="settings-card-art" aria-hidden="true"><Icon size={128} strokeWidth={1.05} /></span>;
}

function SettingsCardCover({ src }: { src: string }) {
  return <span className="settings-card-cover" aria-hidden="true" style={{ backgroundImage: `url("${src}")` }} />;
}

const SHORT_THEME_NAMES: Record<string, string> = {
  "luxury-editorial": "المظهر الفاخر",
  "technological-neon": "المظهر التكنولوجي",
  "modern-minimal": "المظهر العصري",
  "windows11-fluent": "مظهر ويندوز 11",
  andalusian: "المظهر الأندلسي",
  glassmorphism: "المظهر الزجاجي",
  "amoled-cyber": "مظهر AMOLED",
  "material-depth": "مظهر Material",
  "nature-calm": "المظهر الطبيعي",
  "dashboard-grid": "مظهر لوحة التحكم",
};

function shortThemeName(theme: ThemeDefinition) {
  return SHORT_THEME_NAMES[theme.id] ?? "مظهر إضافي";
}

const features: Feature[] = [
  { title: "التقويم", caption: "هجري وميلادي", icon: CalendarDays, tone: "saffron" },
  { title: "القبلة", caption: "اتجاه القبلة", icon: Compass, tone: "sea" },
  { title: "السبحة", caption: "تسبيح إلكتروني", icon: Sparkles, tone: "plum" },
  { title: "الإعدادات", caption: "خصص تجربتك", icon: Settings2, tone: "slate" },
  { title: "الأذكار", caption: "حصن يومك", icon: HandHeart, tone: "rose" },
  { title: "المصحف", caption: "وردك اليومي", icon: BookOpenText, tone: "mint", featured: true },
  { title: "مساجد", caption: "بالقرب منك", icon: Landmark, tone: "sky" },
  { title: "في مثل هذا اليوم", caption: "من الذاكرة", icon: History, tone: "rust" },
  { title: "حصن المسلم", caption: "أذكار وأدعية", icon: Castle, tone: "teal" },
  { title: "منبه الفجر", caption: "استيقظ للصلاة", icon: BellRing, tone: "blue" },
  { title: "التحفيظ", caption: "احفظ وراجع", icon: BookOpen, tone: "blue" },
  { title: "الأسئلة", caption: "أجب واكتشف", icon: CircleHelp, tone: "orange" },
];
type IslamicEvent = { month: number; day?: number; endDay?: number; title: string };
type HistoryCalendarMode = "gregorian" | "islamic";
const islamicMonthNames = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];
const islamicEvents: IslamicEvent[] = [
  { month: 1, title: "زواج النبي صلى الله عليه وسلم من صفية بنت حيي بن أخطب رضي الله عنها" },
  { month: 1, title: "خروج النبي صلى الله عليه وسلم إلى خيبر" },
  { month: 1, day: 1, title: "بداية شهر محرم، أول شهور السنة الهجرية" },
  { month: 1, day: 10, title: "يوم عاشوراء" },
  { month: 1, day: 10, title: "نجاة موسى عليه السلام ومن معه من المؤمنين من فرعون" },
  { month: 1, day: 10, title: "استشهاد الحسين بن علي رضي الله عنهما" },
  { month: 2, title: "وقوع غزوة الأبواء (ودّان)" },
  { month: 2, title: "وقوع سرية الرجيع ومحنة الصحابة خبيب بن عدي وزيد بن الدثنة رضي الله عنهما" },
  { month: 2, title: "وقوع غزوة خيبر وفتح حصونها" },
  { month: 3, title: "هجرة النبي صلى الله عليه وسلم من مكة إلى المدينة" },
  { month: 3, title: "بيعة أبي بكر الصديق رضي الله عنه بالخلافة العامة في سقيفة بني ساعدة" },
  { month: 3, day: 12, title: "وفاة النبي صلى الله عليه وسلم في المدينة المنورة" },
  { month: 4, title: "وقوع غزوة بُواط" },
  { month: 4, title: "وقوع غزوة بني النضير" },
  { month: 5, title: "وقوع سرية زيد بن حارثة إلى القَردة" },
  { month: 5, title: "وقوع معركة مؤتة الكبرى" },
  { month: 5, title: "وقوع معركة الجمل بين الصحابة في البصرة" },
  { month: 6, title: "وقوع سرية أبي عبيدة بن الجراح إلى أرض جهينة" },
  { month: 6, title: "وقوع وقعة اليمامة في خلافة أبي بكر الصديق وقتال مسيلمة الكذاب" },
  { month: 7, title: "حادثة الإسراء والمعراج" },
  { month: 7, title: "وقوع غزوة تبوك، وهي آخر غزوة غزاها النبي صلى الله عليه وسلم بنفسه" },
  { month: 7, title: "فتح بيت المقدس واسترداده من الصليبيين بقيادة صلاح الدين الأيوبي" },
  { month: 8, title: "فرض صيام شهر رمضان المبارك" },
  { month: 8, title: "وقوع غزوة بني المصطلق" },
  { month: 8, day: 15, title: "تحويل القبلة من المسجد الأقصى إلى المسجد الحرام" },
  { month: 9, title: "وفاة أم المؤمنين خديجة بنت خويلد رضي الله عنها" },
  { month: 9, day: 17, title: "وقوع غزوة بدر الكبرى ويوم الفرقان ونصر المسلمين العظيم" },
  { month: 9, day: 20, title: "فتح مكة المكرمة ودخول الناس في دين الله أفواجاً" },
  { month: 9, day: 21, endDay: 29, title: "وقوع ليلة القدر وبدء نزول القرآن الكريم في غار حراء" },
  { month: 9, day: 21, endDay: 29, title: "ليلة القدر" },
  { month: 10, title: "وقوع غزوة الأحزاب (الخندق) وبني قريظة" },
  { month: 10, title: "وقوع غزوة حنين وطائف" },
  { month: 10, day: 1, title: "عيد الفطر المبارك للمسلمين" },
  { month: 10, day: 7, title: "وقوع غزوة أحد واستشهاد حمزة بن عبد المطلب رضي الله عنه" },
  { month: 11, title: "خروج النبي صلى الله عليه وسلم لمعمرة الحديبية ووقوع صلح الحديبية وبيعة الرضوان" },
  { month: 11, title: "وقوع عمرة القضاء" },
  { month: 12, title: "استشهاد أمير المؤمنين عثمان بن عفان رضي الله عنه" },
  { month: 12, title: "طعن أمير المؤمنين عمر بن الخطاب رضي الله عنه" },
  { month: 12, day: 9, title: "يوم عرفة" },
  { month: 12, day: 9, title: "نزول قول الله تعالى: (اليوم أكملت لكم دينكم)" },
  { month: 12, day: 9, title: "خطبة الوداع" },
  { month: 12, day: 10, title: "يوم النحر وعيد الأضحى المبارك" },
  { month: 12, day: 11, endDay: 13, title: "أيام التشريق وأيام منى" },
];

function eventOccursOnIslamicDay(event: IslamicEvent, day: number) {
  return event.day === undefined || (day >= event.day && day <= (event.endDay ?? event.day));
}

function eventDayLabel(event: IslamicEvent) {
  if (event.day === undefined) return "حدث";
  return event.endDay ? `${event.day}–${event.endDay}` : String(event.day);
}
function shiftDateByDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function getIslamicParts(date: Date, timeZone: string, adjustmentDays = 0) {
  const adjustedDate = shiftDateByDays(date, adjustmentDays);
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone, day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(adjustedDate);
  return {
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
  };
}

const adhkarCards: Feature[] = [
  { title: "أذكار الصباح", caption: "ابدأ يومك بذكر الله", icon: SunMedium, tone: "saffron" },
  { title: "أذكار المساء", caption: "حصن نفسك قبل الغروب", icon: MoonStar, tone: "plum" },
  { title: "أذكار النوم", caption: "سكينة قبل النوم", icon: BedDouble, tone: "sky" },
  { title: "دخول البيت", caption: "سلام على أهل البيت", icon: House, tone: "gold" },
  { title: "الخروج من البيت", caption: "دعاء الخروج المبارك", icon: DoorClosed, tone: "orange" },
  { title: "أذكار الوضوء", caption: "ما يقال قبل وبعد الوضوء", icon: Droplets, tone: "sea" },
  { title: "أذكار الطعام", caption: "البسملة والحمد لله", icon: Utensils, tone: "coral" },
];

const fortressCategories: Feature[] = [
  { title: "أذكار الصلاة", caption: "أذكار وأدعية الصلاة", icon: HandHeart, tone: "teal" },
  { title: "أذكار الأذان", caption: "ما يقال عند الأذان", icon: Bell, tone: "saffron" },
  { title: "أذكار المرض والهم والدين", caption: "أدعية الكرب والشفاء وقضاء الدين", icon: Heart, tone: "rose" },
  { title: "أذكار السفر", caption: "دعاء السفر وما يتعلق به", icon: Navigation, tone: "sky" },
  { title: "أذكار الظواهر الكونية", caption: "أذكار عند الظواهر الكونية", icon: CloudSun, tone: "plum" },
  { title: "أذكار الخوف والفزع", caption: "أدعية الطمأنينة والحفظ", icon: ShieldCheck, tone: "gold" },
  { title: "أذكار الصيام", caption: "أذكار وأدعية الصائم", icon: Sparkles, tone: "mint" },
  { title: "أذكار خاصة بالحيوانات", caption: "أذكار الرفق بالحيوان", icon: PawPrint, tone: "orange" },
];

const prayerDhikrSections: Feature[] = [
  { title: "أدعية استفتاح الصلاة", caption: "ما يقال بعد تكبيرة الإحرام", icon: SunMedium, tone: "saffron" },
  { title: "أدعية الركوع", caption: "أذكار الركوع", icon: ChevronDown, tone: "teal" },
  { title: "أدعية الرفع من الركوع", caption: "أذكار الاعتدال", icon: ArrowUp, tone: "sky" },
  { title: "أدعية السجود", caption: "أذكار السجود", icon: Sparkles, tone: "plum" },
  { title: "أدعية الجلوس بين السجدتين", caption: "ذكر الجلسة بين السجدتين", icon: BookOpen, tone: "gold" },
  { title: "التشهد", caption: "صيغة التشهد في الصلاة", icon: BookOpenText, tone: "mint" },
  { title: "أدعية بعد التشهد الأخير وقبل السلام", caption: "أدعية قبل التسليم", icon: HandHeart, tone: "rose" },
  { title: "دعاء القنوت", caption: "دعاء القنوت في الصلاة", icon: Heart, tone: "coral" },
  { title: "دعاء سجود التلاوة", caption: "ما يقال في سجود التلاوة", icon: BookOpen, tone: "blue" },
  { title: "صلاة الجنازة", caption: "أدعية صلاة الجنازة", icon: MoonStar, tone: "slate" },
  { title: "صلاة الاستخارة", caption: "دعاء الاستخارة", icon: Compass, tone: "violet" },
];

// النصوص الأربعة أدناه منقولة حرفيًا كما زوّد بها المستخدم؛ لا تُعدّل أو تُطبّع.
const fortressOpeningDhikrs: MorningDhikr[] = [
  { title: "الدعاء الأول", text: "اللَّهُمَّ بَاعِدْ بَيْنِي وَبَيْنَ خَطَايَايَ ، كَمَا بَاعَدْتَ بَيْنَ المَشْرِقِ وَالمَغْرِبِ ، اللَّهُمَّ نَقِّنِي مِنَ الخَطَايَا ، كَمَا يُنَقَّى الثَّوْبُ الأَبْيَضُ مِنَ الدَّنَسِ ، اللَّهُمَّ اغْسِلْ خَطَايَايَ بِالْمَاءِ ، وَالثَّلْجِ ، وَالبَرَدِ", targetCount: 1, source: "رواهما البخاري ومسلم", references: "موقع إسلام سؤال وجواب" },
  { title: "الدعاء الثاني", text: "سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ ، وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ ، وَلَا إِلَهَ غَيْرُكَ", targetCount: 1, source: "رواه أبوداود و الترمذي", references: "موقع إسلام سؤال وجواب" },
  { title: "الدعاء الثالث", text: "وَجَّهْتُ وَجْهِيَ لِلَّذِي فَطَرَ السَّمَاوَاتِ وَالْأَرْضَ حَنِيفًا ، وَمَا أَنَا مِنَ الْمُشْرِكِينَ ، إِنَّ صَلَاتِي ، وَنُسُكِي ، وَمَحْيَايَ ، وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ ، لَا شَرِيكَ لَهُ ، وَبِذَلِكَ أُمِرْتُ وَأَنَا مِنَ الْمُسْلِمِينَ ، اللهُمَّ أَنْتَ الْمَلِكُ لَا إِلَهَ إِلَّا أَنْتَ أَنْتَ رَبِّي ، وَأَنَا عَبْدُكَ ، ظَلَمْتُ نَفْسِي ، وَاعْتَرَفْتُ بِذَنْبِي، فَاغْفِرْ لِي ذُنُوبِي جَمِيعًا ، إِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ ، وَاهْدِنِي لِأَحْسَنِ الْأَخْلَاقِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ ، وَاصْرِفْ عَنِّي سَيِّئَهَا لَا يَصْرِفُ عَنِّي سَيِّئَهَا إِلَّا أَنْتَ ، لَبَّيْكَ وَسَعْدَيْكَ وَالْخَيْرُ كُلُّهُ فِي يَدَيْكَ ، وَالشَّرُّ لَيْسَ إِلَيْكَ ، أَنَا بِكَ وَإِلَيْكَ ، تَبَارَكْتَ وَتَعَالَيْتَ ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ", targetCount: 1, source: "رواه مسلم و االنسائي", references: "موقع إسلام سؤال وجواب" },
  { title: "الدعاء الرابع", text: "كَانَ إِذَا قَامَ مِنَ اللَّيْلِ افْتَتَحَ صَلَاتَهُ : اللهُمَّ رَبَّ جَبْرَائِيلَ ، وَمِيكَائِيلَ ، وَإِسْرَافِيلَ ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ ، عَالِمَ الْغَيْبِ وَالشَّهَادَةِ ، أَنْتَ تَحْكُمُ بَيْنَ عِبَادِكَ ، فِيمَا كَانُوا فِيهِ يَخْتَلِفُونَ ، اهْدِنِي لِمَا اخْتُلِفَ فِيهِ مِنَ الْحَقِّ بِإِذْنِكَ ، إِنَّكَ تَهْدِي مَنْ تَشَاءُ إِلَى صِرَاطٍ مُسْتَقِيمٍ", targetCount: 1, source: "رواه مسلم", references: "موقع إسلام سؤال وجواب" },
  { title: "الدعاء الخامس", text: "اللَّهُمَّ لَكَ الحَمْدُ أَنْتَ نُورُ السَّمَوَاتِ وَالأَرْضِ ، وَلَكَ الحَمْدُ أَنْتَ قَيِّمُ السَّمَوَاتِ وَالأَرْضِ ، وَلَكَ الحَمْدُ أَنْتَ رَبُّ السَّمَوَاتِ وَالأَرْضِ وَمَنْ فِيهِنَّ ، أَنْتَ الحَقُّ ، وَوَعْدُكَ الحَقُّ ، وَقَوْلُكَ الحَقُّ ، وَلِقَاؤُكَ الحَقُّ ، وَالجَنَّةُ حَقٌّ ، وَالنَّارُ حَقٌّ ، وَالنَّبِيُّونَ حَقٌّ ، وَالسَّاعَةُ حَقٌّ ، اللَّهُمَّ لَكَ أَسْلَمْتُ ، وَبِكَ آمَنْتُ ، وَعَلَيْكَ تَوَكَّلْتُ ، وَإِلَيْكَ أَنَبْتُ ، وَبِكَ خَاصَمْتُ ، وَإِلَيْكَ حَاكَمْتُ ، فَاغْفِرْ لِي مَا قَدَّمْتُ وَمَا أَخَّرْتُ ، وَمَا أَسْرَرْتُ وَمَا أَعْلَنْتُ ، أَنْتَ إِلَهِي لاَ إِلَهَ إِلَّا أَنْتَ", targetCount: 1, source: "رواه البخاري و مسلم", references: "الموقع اسلام سؤال وجواب" },
];


const fortressPrayerDhikrInitialLists: Record<string, MorningDhikr[]> = {
  "prayer:أدعية الركوع": [
    { title: "الذكر الأول", text: "سُبْحَانَ رَبِّيَ الْعَظِيمِ وَبِحَمْدِهِ ثَلاثًا", targetCount: 1, source: "رواه  أبو داود", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثاني", text: "سُبُّوحٌ قُدُّوسٌ رَبُّ الْمَلائِكَةِ وَالرُّوحِ", targetCount: 1, source: "رواه مسلم", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثالث", text: "سُبْحَانَكَ اللَّهُمَّ رَبَّنَا وَبِحَمْدِكَ، اللَّهُمَّ اغْفِرْ لِي", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الرابع", text: "اللَّهُمَّ لَكَ رَكَعْتُ، وَبِكَ آمَنْتُ، وَلَكَ أَسْلَمْتُ، خَشَعَ لَكَ سَمْعِي وَبَصَرِي وَمُخِّي وَعَظْمِي وَعَصَبِي", targetCount: 1, source: "رواه مسلم", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:أدعية الرفع من الركوع": [
    { title: "الذكر الأول", text: "رَبَّنَا وَلَكَ الْحَمْدُ", targetCount: 1, source: "رواه  البخاري ومسلم", references: "الموقع اسلام ويب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ رَبَّنَا لَكَ الْحَمْدُ مِلْءَ السَّمَاوَاتِ وَمِلْءَ الْارْضِ، وَمَا بَيْنَهُمَا، وَمِلْءَ مَا شِئْتَ مِنْ شَيْءٍ بَعْدُ، أهْلَ الثَّنَاءِ وَالْمَجْدِ، أحَقُّ مَا قَالَ الْعَبْدُ، وَكُلُّنَا لَكَ عَبْدٌ، اللهم لَا مَانِعَ لِمَا أعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الجَدِّ مِنْكَ الْجَدُّ", targetCount: 1, source: "رواه  مسند الإمام أحمد", references: "الموقع اسلام ويب" },
    { title: "الذكر الثالث", text: "رَبَّنَا وَلَكَ الْحَمْدُ، حَمْدًا كَثِيْرًا طَيِّبًا مُبارَكًا فِيْهِ", targetCount: 1, source: "رواه   صحيح أبي داود", references: "الموقع اسلام ويب" },
  ],
  "prayer:أدعية السجود": [
    { title: "الذكر الأول", text: "سُبْحَانَ رَبِّيَ الأَعْلَى. ثلاث مرات أو أكثر.", targetCount: 1, source: "رواه ابن ماجه", references: "الموقع اسلام ويب" },
    { title: "الذكر الثاني", text: "سُبحانَكَ اللّهمَّ ربَّنا وَبِحمدِكَ، اللّهمَّ اغفِرْ لي", targetCount: 1, source: "رواه  البخاري ومسلم", references: "الموقع اسلام ويب" },
    { title: "الذكر الثالث", text: "سُبُّوحٌ قُدُّوسٌ رَبُّ الْمَلاَئِكَةِ وَالرُّوحِ", targetCount: 1, source: "رواه  مسلم", references: "الموقع اسلام ويب" },
    { title: "الذكر الرابع", text: "اللَّهُمَّ لَكَ سَجَدْتُّ وَبِكَ آمَنْتُ، وَلَكَ أسْلَمْتُ، سَجَدَ وَجْهِي لِلَّذِيْ خَلَقَهُ، وَصَوَّرَهُ، وَشَقَّ سَمْعَهُ وَبَصَرَهُ، تَبَارَكَ اللهُ أحْسَنُ الْخَالِقيْنَ.", targetCount: 1, source: "رواه  مسلم", references: "الموقع اسلام ويب" },
    { title: "الذكر الخامس", text: "سُبحانَكَ وَبِحمدِكَ لا إلهَ إلاّ أَنْـتَ", targetCount: 1, source: "رواه  مسلم", references: "الموقع اسلام ويب" },
    { title: "الذكر السادس", text: "اللَّهُمَّ إِنِّيْ أعُوْذُ بِرِضَاكَ مِنْ سَخَطِكَ، وَبِمُعَافَاتِكَ مِنْ عُقوْبَتِكَ، وَأعُوْذُ بِكَ مِنْكَ، لَا أُحْصِـي ثَنَاءً عَلَيْكَ، أنْتَ كَمَا أثْنَيْتَ عَلَى نَفْسِكَ", targetCount: 1, source: "رواه  مسلم", references: "الموقع اسلام ويب" },
  ],
  "prayer:أدعية الجلوس بين السجدتين": [
    { title: "الذكر الأول", text: "رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي", targetCount: 1, source: "رواه النسائي وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ اغْفِرْ لِي، وَارْحَمْنِي، وَاجْبُرْنِي، وَاهْدِنِي، وَارْزُقْنِي", targetCount: 1, source: "رواه الترمذي وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثالث", text: "للَّهُمَّ اغْفِرْ لِي، وَارْحَمْنِي، وَاجْبُرْنِي، وَاهْدِنِي، وَارْزُقْنِي، وَعَافِنِي، وَارْفَعْنِي", targetCount: 1, source: "رواه سنن الترمذي ، وأبو داود ، وابن ماجه", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:التشهد": [
    { title: "الذكر الأول", text: "تشهد ابن مسعود رضي الله عنه: التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ", targetCount: 1, source: "رواه البخاري ومسلم", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثاني", text: "تشهد ابن عمر رضي الله عنهما : التَّحِيَّاتُ لِلَّهِ، الصَّلَوَاتُ الطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ", targetCount: 1, source: "رواه أبو داود وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثالث", text: "تشهد عمر، قاله على المنبر يعلم الناس: التَّحِيَّاتُ لِلَّهِ، الزَّاكِيَاتُ لِلَّهِ، الطَّيِّبَاتُ لِلَّهِ، الصَّلَوَاتُ لِلَّهِ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ", targetCount: 1, source: "رواه مالك  وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:أدعية بعد التشهد الأخير وقبل السلام": [
    { title: "الذكر الأول", text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ وَمِنْ عَذَابِ الْقَبْرِ وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ", targetCount: 1, source: "رواه صحيح مسلم", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ وَأَعُوذُ بِكَ مِنْ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ وَأَعُوذُ بِكَ مِنْ فِتْنَةِ الْمَحْيَا وَفِتْنَةِ الْمَمَاتِ اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْمَأْثَمِ وَالْمَغْرَمِ", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثالث", text: "اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا وَلا يَغْفِرُ الذُّنُوبَ إِلا أَنْتَ فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ وَارْحَمْنِي إِنَّك أَنْتَ الْغَفُورُ الرَّحِيمُ وهذا الدّعاء يُمكن أن يجعله المصلي في التشهد الأخير بعد الاستعاذات السابقة", targetCount: 1, source: "رواه صحيح البخاري", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:دعاء القنوت:صلاة الفجر": [
    { title: "الذكر الأول", text: "اللهم إنا نستعينك ونستغفرك ونؤمن بك ونتوكل عليك ونخضع لك ونخلع ونترك من يكفرك، اللهم إياك نعبد ولك نصلي ونسجد وإليك نسعى ونحفِد، نرجو رحمتك ونخاف عذابك الجد إن عذابك للكافرين ملحق", targetCount: 1, source: "رواه", references: "الموقع اسلام ويب" },
  ],
  "prayer:دعاء القنوت:صلاة الوتر": [
    { title: "الذكر الأول", text: "اللهم اهدني فيمن هديت، وعافني فيمن عافيت، وتولني فيمن توليت، وبارك لي فيما أعطيت، وقني شر ما قضيت، فإنك تقضي ولا يقضى عليك، إنه لا يذل من واليت، ولا يعز من عاديت، تباركت ربنا وتعاليت، لا منجى منك إلا إليك", targetCount: 1, source: "رواه أبو داود  والنسائي وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ إِنِّي أَعُوذُ بِرِضَاكَ مِنْ سَخَطِكَ وَبِمُعَافَاتِكَ مِنْ عُقُوبَتِكَ وَأَعُوذُ بِكَ مِنْكَ لا أُحْصِي ثَنَاءً عَلَيْكَ أَنْتَ كَمَا أَثْنَيْتَ عَلَى نَفْسِكَ", targetCount: 1, source: "رواه الترمذي وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:دعاء القنوت:عند النوازل": [
    { title: "الذكر الأول", text: "اللهم إنا نستعينك ونؤمن بك، ونتوكل عليك ونثني عليك الخير ولا نكفرك، اللهم إياك نعبد، ولك نصلي ونسجد، وإليك نسعى ونحفد، نرجو رحمتك ونخشى عذابك، إن عذابك الجدَّ بالكفار مُلحق، اللهم عذِّب الكفرة أهل الكتاب الذين يصدون عن سبيلك", targetCount: 1, source: "رواه البيهقي وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
  ],
  "prayer:دعاء سجود التلاوة": [
    { title: "الذكر الأول", text: "سَجَدَ وَجْهِيَ للَّذِي خَلَقَهُ، وَشَقَّ سَمْعَهُ وبَصَرَهُ، بِحَوْلِهِ وَقُوَّتِهِ، فَتَبَارَكَ اللَّهُ أَحْسَنُ الْـخَالِقِينَ", targetCount: 1, source: "رواه", references: "الموقع اسلام ويب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ اكْتُبْ لِي بِهَا عِنْدَكَ أجْراً، واْجعَلْهَا لِي عِنْدِكَ ذُخْراً، وَضَعْ عَنِّي بِهَا وِزْرَاً،واقبلها مِنِّي واقبلها مني كما قبلتها مِنْ عَبْدِكَ دَاوُدَ عليه السلام", targetCount: 1, source: "رواه", references: "الموقع اسلام ويب" },
  ],
  "prayer:صلاة الجنازة": [
    { title: "الذكر الأول", text: "اللَّهُمَّ اغْفِرْ لِحَيِّنَا وَمَيِّتِنَا وَصَغِيرِنَا وَكَبِيرِنَا وَذَكَرِنَا وَأُنْثَانَا وَشَاهِدِنَا وَغَائِبِنَا ، اللَّهُمَّ مَنْ أَحْيَيْتَهُ مِنَّا فَأَحْيِهِ عَلَى الْإِيمَانِ ، وَمَنْ تَوَفَّيْتَهُ مِنَّا فَتَوَفَّهُ عَلَى الْإِسْلَامِ ، اللَّهُمَّ لَا تَحْرِمْنَا أَجْرَهُ ، وَلَا تُضِلَّنَا بَعْدَهُ", targetCount: 1, source: "رواه   مسلم. وروى أحمد وأصحاب السنن", references: "الموقع اسلام ويب" },
    { title: "الذكر الثاني", text: "اللَّهُمَّ اغفِرْ له وارحَمْه، واعفُ عنه وعافِه، وأكرِمْ نُزُلَه، ووسِّعْ مُدخَلَه، واغسِلْه بماءٍ وثَلجٍ وبَرَدٍ، ونَقِّه مِنَ الْخَطايا كما يُنَقَّى الثَّوبُ الأبيَضُ مِنَ الدَّنَسِ، وأبدِلْه دارًا خَيرًا مِن دارِه، وأهلًا خَيرًا مِن أهلِه، وزَوجًا خَيرًا مِن زَوجِه، وقِه فِتنةَ القَبرِ وعَذابَ النَّارِ", targetCount: 1, source: "رواه  مسلم", references: "الموقع اسلام ويب" },
  ],
  "prayer:صلاة الاستخارة": [
    { title: "الذكر الأول", text: "اللَّهُمَّ إنِّي أستَخيرُكَ بعِلمِكَ، وأستَعينُكَ بقُدَرتِكَ، وأسألُكَ من فضلِكَ العظيمِ، فإنَّكَ تقدِرُ ولا أقدِرُ، وتَعلمُ ولا أعلَمُ وأنتَ علَّامُ الغيوبِ، اللَّهمَّ إن كُنتَ تعلمُ أنَّ هذا الأمرَ (ويسمي حاجته ) خيرٌ لي في ديني ومَعاشي وعاقِبةِ أَمري فاقدرهُ لي ويسِّرهُ لي ثمَّ بارِكْ لي فيهِ، وإن كنتَ تعلمُ أنَّ هذا الأمرَ(ويسمي حاجته ) شرٌّ لي في ديني ومَعاشي وعاقبةِ أَمري  فاصرفهُ عنِّي واصرِفني عنهُ، واقدُرْ لي الخيرَ حيثُ كانَ ثمَّ أرضِني بِهِ", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار الأذان": [
    { title: "الذكر الأول", text: "مَنْ قَالَ حِينَ يَسْمَعُ النِّدَاءَ: اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلاَةِ القَائِمَةِ، آتِ مُحَمَّدًا الوَسِيلَةَ وَالفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ، حَلَّتْ لَهُ شَفَاعَتِي يَوْمَ القِيَامَةِ", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار المرض والهم والدين:المرض": [
    { title: "أذكار المريض لنفسه", text: "ضع يدَك على الذي تألَّم من جسدِك ، و قُلْ : بسم اللهِ ( ثلاثًا ) و قل ( سبعَ مراتٍ ) أعوذُ باللهِ و قُدرتِه من شرِّ ما أَجِدُ و أُحاذِرُ", targetCount: 1, source: "رواه", references: "الموقع اسلام ويب" },
    { title: "أذكار زيارة المريض", text: "مَن عاد مريضًا لم يحضُرْه أجَلُه فقال عندَه سَبْعَ مرَّاتٍ: أسأَلُ اللهَ العظيمَ ربَّ العَرْشِ العظيمِ أن يَشفِيَك، عافاه اللهُ مِن ذلكَ المرَضِ", targetCount: 1, references: "الموقع اسلام ويب" },
  ],
  "root:أذكار المرض والهم والدين:أذكار الهم والكرب": [
    { title: "الذكر الأول", text: "ما أصاب عبدًا قط همٌّ ولا حزنٌ فقال : ( اللهم إني عبدُك ، وابنُ عبدِك وابنُ أمتِك ، ناصيتي بيدِك ، ماضٍ فيّ حكمُك ، عدلٌ فيّ قضاؤُك ، أسألُك بكلِّ اسمٍ هو لك ، سميتَ به نفسَك ، أو علمته أحدًا من خلقِك ، أو استأثرت به في علمِ الغَيبِ عندك أن تجعلَ القرآنَ ربيعَ قلبي ، ونورَ صدري ، وجلاءَ حزني ، وذهابَ همي وغمي إلا أذهب اللهُ همَّه وغمَّه وأبدله مكانه فرحًا", targetCount: 1, source: "رواه أحمد", references: "الموقع اسلام ويب" },
    { title: "الذكر الثاني", text: "كلماتُ المكروبِ :  اللهُمَّ رحمتَك أرْجو ، فلا تكلْنِي إلى نفسِي طرفةَ عينٍ ، وأصلِحْ لي شأنِي كلَّه", targetCount: 1, source: "رواه أحمد وأبو داود", references: "الموقع اسلام ويب" },
    { title: "الذكر الثالث", text: "كَانَ يَقُولُ عِنْدَ الْكَرْبِ: لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْعَظِيم", targetCount: 1, source: "رواه البخاري ومسلم", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار المرض والهم والدين:أذكار قضاء الدين": [
    { title: "الذكر الأول", text: "اللَّهُمَّ اكْفِني بحلالِك عن حرامِك، وأغْنِني بفَضْلِك عمَّن سِواك", targetCount: 1, source: "رواه", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار السفر": [
    { title: "عند ركوب الدابة أو ما يقوم مقامها", text: `كَانَ إِذَا استَوَى عَلى بَعِيرِهِ خَارِجاً إِلَى سَفَرٍ كبَّر ثلاثاً ثم قال: "سُبْحانَ الَّذي سَخَّرَ لَنا هَذَا وَما كُنَّا لَهُ مُقْرِنينَ، وَإِنَّا إلى رَبِّنَا لَمُنْقَلِبُونَ. اللَّهُمَّ إنَّا نَسألُكَ فِي سفَرِنَا هَذَا البِرَّ وَالتَّقْوَى، وَمِنْ العَمَلِ ما تَرْضَى، اللَّهُمَّ هَوّْن عَلَيْنا سَفَرَنَا هَذَا، وَاطْوِ عَنّا بُعْدَهُ. اللَّهُمَّ أنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالخَلِيفَةُ في الأهْلِ. اللَّهُمَّ إني أعُوذُ بِكَ مِنْ وَعْثاءِ السَّفَرِ، وكآبَةِ المَنْظَرِ، وَسُوءِ المُنْقَلَبِ في المَالِ والأهْلِ. وإذا رَجع قالهنّ وزاد فيهنّ: آيِبُونَ، تائبُونَ، عابدُونَ، لرَبِّنَا حامِدُون`, targetCount: 1, source: "رواه مسلم", references: "الموقع اسلام سؤال وجواب" },
    { title: "دعاء المقيم للمسافر", text: "أَسْتَوْدِعُ اللَّهَ دِينَكُمْ وَأَمَانَتَكُمْ وَخَوَاتِيمَ أَعْمَالِكُمْ", targetCount: 1, source: "رواه سنن أبي داود وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
    { title: "دعاء المقيم للمسافر", text: "أَسْتَوْدِعُكَ اللَّهَ الَّذِي لَا تَضِيعُ وَدَائِعُهُ", targetCount: 1, source: "رواه  ابن ماجة وصححه الألباني", references: "الموقع اسلام سؤال وجواب" },
  ],
  "root:أذكار الظواهر الكونية": [
    { title: "أذكار هبوب الرياح", text: "اللَّهُمَّ إنِّي أسأَلُكَ خيرَها، وخيرَ ما فيها، وخيرَ ما أُرسِلَتْ به، وأَعوذُ بكَ من شرِّها، وشرِّ ما فيها، وشرِّ ما أُرسِلَتْ به", targetCount: 1, source: "رواه صحيح مسلم", references: "الموقع اسلام ويب" },
    { title: "أذكار الرعد", text: "سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ، ثُمَّ يَقُولُ : إِنَّ هَذَا لَوَعِيدٌ شَدِيدٌ لِأَهْلِ الْأَرْضِ .", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام سؤال وجواب" },
    { title: "أذكار المطر", text: "اللَّهمَّ اجعَلهُ صيِّبًا نافعًا", targetCount: 1, source: "رواه النسائي", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار الخوف والفزع": [
    { title: "دعـاء الخوف من الشــرك", text: "اللهمَّ إني أعوذُ بك أنْ أُشرِكَ بك وأنا أعلمُ، و أستغفرُك لما لا أعلمُ.", targetCount: 1, source: "رواه البخاري", references: "الموقع اسلام ويب" },
    { title: "دعاء الخوف من القوم", text: "اللهمَّ إنا نجعلُك في نحورِهم ونعوذُ بك من شرورِهم", targetCount: 1, source: "رواه أبو داود والنسائي", references: "الموقع اسلام ويب" },
  ],
  "root:أذكار خاصة بالحيوانات": [
    { title: "الذكر الأول", text: "إذا سَمِعتُم صياحَ الدِّيَكةِ فاسألوا اللهَ مِن فضلِه؛ فإنَّها رَأت مَلَكًا، وإذا سَمِعتُم نَهيقَ الحِمارِ فتَعَوَّذوا باللهِ مِنَ الشَّيطانِ؛ فإنَّها رَأت شيطانًا.", targetCount: 1, source: "رواه مسلم", references: "الموقع الدرر السنية" },
  ],
  "root:أذكار الصيام": [
    { title: "الذكر الأول", text: "ذهب الظمأُ وابتلَّتِ العروقُ وثبتَ الأجرُ إن شاء اللهُ", targetCount: 1, source: "رواه أبو داود", references: "الموقع اسلام ويب" },
  ],
};

const dhikrCopy: Record<string, { title: string; intro: string; text: string; source?: string; references?: string }> = {
  "السبحة": { title: "السبحة", intro: "وردك في الاستغفار", text: "أذكار السبحة" },
  "أذكار الصباح": { title: "أذكار الصباح", intro: "ابدأ يومك بذكر الله", text: "اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ", source: "آية الكرسى - البقرة 255", references: "رواه الحاكم وابن حبان · موقع إسلام ويب" },
  "أذكار المساء": { title: "أذكار المساء", intro: "حصن نفسك قبل الغروب", text: "أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير." },
  "دخول البيت": { title: "دخول البيت", intro: "سلام على أهل البيت", text: "وردك عند دخول المنزل" },
  "الخروج من البيت": { title: "الخروج من البيت", intro: "دعاء الخروج المبارك", text: "وردك عند الخروج من المنزل" },
  "أذكار الوضوء": { title: "أذكار الوضوء", intro: "النظافة والطهارة", text: "ما يقال قبل وبعد الوضوء" },
  "أذكار الطعام": { title: "أذكار الطعام", intro: "البسملة والحمد لله", text: "بسم الله، اللهم بارك لنا فيه وأطعمنا خيراً منه، الحمد لله الذي أطعمنا وسقانا وجعلنا من المسلمين." },

  "أذكار النوم": { title: "أذكار النوم", intro: "سكينة قبل النوم", text: "وردك اليومي قبل النوم" },
  "أذكار الاستيقاظ": { title: "أذكار الاستيقاظ من النوم", intro: "ابدأ يومك بذكر الله", text: "وردك عند الاستيقاظ" },
  "أذكار متنوعة": { title: "أذكار متنوعة", intro: "أذكار لمواقف يومية", text: "وردك اليومي" },
};

type AudioClip = { id: string; name: string; url: string };
type VoiceProfile = { id: string; reader: string; clips: AudioClip[]; scope: string };
type UploadedSound = { id: string; name: string; url: string };
type UploadedVideo = { id: string; name: string; url: string };
type PrayerSoundKind = "before" | "adhan" | "iqama";
type AdhkarSoundKind = "qiyam" | "duha" | "fridayDhikr" | "fridayAnswer" | "fridayTakbeer" | "fastingFajr" | "fastingMaghrib" | "evening" | "morning" | "sleep";

const farisAbbadVoice: VoiceProfile = {
  id: "faris-abbad-back4app",
  reader: "فارس عباد",
  scope: "أذكار الصباح",
  clips: [
    { id: "faris-01", name: "01.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/31aca7075e32a00c6e3b964a8e0ddff8_01.mp3" },
    { id: "faris-02", name: "02.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/4f61eb6a104a36d6b3758b6c8c8664ae_02.mp3" },
    { id: "faris-03", name: "03.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/e1443a05a9b5f42c35eafe5020b7b011_03.mp3" },
    { id: "faris-04", name: "04.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/0aea42e189b7304312b6b508981cc801_04.mp3" },
    { id: "faris-05", name: "05.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/a044e7b4a2bea6cccbf7ba56af88081c_05.mp3" },
    { id: "faris-06", name: "06.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/1b280ab712101270d931be35a49c5eed_06.mp3" },
    { id: "faris-07", name: "07.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/7b8b123a26586fe9ddbd583bb98b8b02_07.mp3" },
    { id: "faris-08", name: "08.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/41bddfb9c91400eac6be43a6f2b9bee6_08.mp3" },
    { id: "faris-09", name: "09.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/3000f0f197a10448394030f0337b063b_09.mp3" },
    { id: "faris-10", name: "10.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/2e6b66fdefe4b819ffb2cc9814fdb4a9_10.mp3" },
    { id: "faris-11", name: "11.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/1f3e949fde3fe57ea9746b300bb26970_11.mp3" },
    { id: "faris-12", name: "12.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/79fbfc16db018ea3b77af35ed6e9f196_12.mp3" },
    { id: "faris-13", name: "13.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/7d463e61037d4d88a18518ba0825cdff_13.mp3" },
    { id: "faris-14", name: "14.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/ebd4165ac9bbb2fc25b5827fcea5f3ac_14.mp3" },
    { id: "faris-15", name: "15.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/95983e1d25fecb2d9e3e0cacb3a9c46d_15.mp3" },
    { id: "faris-16", name: "16.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/705470d13c36729bd50b6b19ec066f9c_16.mp3" },
    { id: "faris-17", name: "17.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/11406a712e14f6c82d2a489e6ea8e429_17.mp3" },
    { id: "faris-18", name: "18.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/9400e67a30dfd2088c484f38643fb211_18.mp3" },
    { id: "faris-19", name: "19.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/ebef126a5ed63cd827461befd7fd0e3b_19.mp3" },
    { id: "faris-20", name: "20.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/f1fbe837b85020d2eb019cdda5daf83d_20.mp3" },
    { id: "faris-21", name: "21.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/b1fc81a0e4a057e32681607cef229fdd_21.mp3" },
    { id: "faris-22", name: "22.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/7043fa74d073cb2d5169ec1a64c3faa1_22.mp3" },
    { id: "faris-23", name: "23.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/a0aad9caf9f3beec948853e7306e1bd9_23.mp3" },
    { id: "faris-24", name: "24.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/3adeb4cd6f9e3147405396a961bfa02d_24.mp3" },
    { id: "faris-25", name: "25.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/d780c6111c22b9205899862e4a83a05c_25.mp3" },
    { id: "faris-26", name: "26.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/1758df216b7a05eb2bec6f2e3f1c078f_26.mp3" },
    { id: "faris-27", name: "27.mp3", url: "https://parsefiles.back4app.com/hcSZFnnE9Upnjzq2FGy4pi9NrBMUy1ej0kL47AjW/27391b97a96d8f15634dead369e8d0f2_27.mp3" },
  ],
};

type MorningDhikr = {
  text: string;
  title?: string;
  targetCount: number;
  source?: string;
  references: string;
  continuationPrompt?: boolean;
  custom?: boolean;
  highlightSurahs?: boolean;
};

const homeEntryDhikrListInitial: MorningDhikr[] = [
  { text: "إِذَا دَخَلَ الرَّجُلُ بَيْتَهُ فَذَكَرَ اللَّهَ عِنْدَ دُخُولِهِ، وَعِنْدَ طَعَامِهِ، قَالَ الشَّيْطَانُ: لَا مَبِيتَ لَكُمْ وَلَا عَشَاءَ. وَإِذَا دَخَلَ فَلَمْ يُذْكَرِ اللَّهَ عِنْدَ دُخُولِهِ قَالَ الشَّيْطَانُ: أَدْرَكْتُمُ الْمَبِيتَ. فَإِذَا لَمْ يَذْكُرِ اللَّهَ عِنْدَ طَعَامِهِ قَالَ: أَدْرَكْتُمُ الْمَبِيتَ وَالْعَشَاءَ", targetCount: 1, source: "رواه مسلم", references: "موقع إسلام ويب" },
  { text: " عَنْ أَنَسِ بْنِ مَالِكٍ، قَالَ: قَالَ لِي رَسُولُ اللهِ -صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ-: يَا بُنَيَّ، إِذَا دَخَلْتَ عَلَى أَهْلِكَ فَسَلِّمْ يَكُونُ بَرَكَةً عَلَيْكَ وَعَلَى أَهْلِ بَيْتِكَ.", targetCount: 1, source: "رواه الترمذي", references: "موقع إسلام ويب" },
];
const homeExitDhikrListInitial: MorningDhikr[] = [
  { text: "ما خرج النبي صلى الله عليه وسلم من بيتي قطُّ إلا رفع طَرْفَهُ إلى السماء فقال: (اللَّهُمَّ أَعُوذُ بِكَ أَنْ أَضِلَّ، أَوْ أُضَلَّ، أَوْ أَزِلَّ، أَوْ أُزَلَّ، أَوْ أَظْلِمَ، أَوْ أُظْلَمَ، أَوْ أَجْهَلَ، أَوْ يُجْهَلَ عَلَيَّ", targetCount: 1, source: "عن أمِّ سلمة", references: "موقع إسلام ويب" },
  { text: " إِذَا خَرَجَ الرَّجُلُ مِنْ بَيْتِهِ فَقَالَ: بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، ولاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ. قَالَ: يُقَالُ حِينَئِذٍ: هُدِيتَ، وَكُفِيتَ، وَوُقِيتَ، فَتَتَنَحَّى لَهُ الشَّيَاطِينُ، فَيَقُولُ لَهُ شَيْطَانٌ آخَرُ: كَيْفَ لَكَ بِرَجُلٍ قَدْ هُدِيَ وَكُفِيَ وَوُقِيَ؟", targetCount: 1, source: "رواهما أبو داود في سننه", references: "موقع إسلام ويب" },
];
const wuduBeforeDhikrListInitial: MorningDhikr[] = [{ text: "بسم الله", targetCount: 1, source: "رواه صحيح الترمذي", references: "موقع إسلام سؤال وجواب" }];
const wuduAfterDhikrListInitial: MorningDhikr[] = [{ text: "مَا مِنْكُمْ مِنْ أَحَدٍ يَتَوَضَّأُ فَيُبْلِغُ أَوْ فَيُسْبِغُ الْوُضُوءَ ثُمَّ يَقُولُ: أَشْهَدُ أَنْ لا إِلَهَ إِلا اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ،", targetCount: 1, source: "رواه مسلم · موقع إسلام سؤال وجواب", references: "إِلا فُتِحَتْ لَهُ أَبْوَابُ الْجَنَّةِ الثَّمَانِيَةُ يَدْخُلُ مِنْ أَيِّهَا شَاءَ" }];
const foodBeforeDhikrListInitial: MorningDhikr[] = [{ text: "بِسْمِ اللهِ. فإنْ نسي في أَوَّلِهِ، فَليَقُلْ: بِسْمِ اللَّه أَوَّلَهُ وَآخِرَهُ", targetCount: 1, source: "رواه عبدالله بن مسعود · موقع الدرر السنية", references: "" }];
const foodAfterDhikrListInitial: MorningDhikr[] = [{ text: "الحمد لله الذي أطعمني هذا الطعام ورزقنيه من غير حول مني ولا قوة", targetCount: 1, source: "رواه أبو داود · موقع إسلام ويب", references: "غفر له ما تقدم من ذنبه وما تأخر" }];

type SleepDhikr = {
  title: string;
  text: string;
  benefit: string;
  reference: string;
  count: string;
  highlightSurahs?: boolean;
  custom?: boolean;
};

const sleepDhikrListInitial: SleepDhikr[] = [
  {
    title: "الذكر الأول",
    text: "اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ",
    benefit: "[آية الكرسى - البقرة 255] - أجير من الجن حتى يصبح.",
    reference: "ارواه البخاري موقع إسلام سؤال وجواب",
    count: "مرة واحدة",
  },
  {
    title: "الذكر الثاني",
    text: "اللّهُـمَّ بِاسْـمِكَ أَحْـيا وَ أَمـوتُ",
    benefit: "لايوجد",
    reference: "رواه االبخاري الموقع اسلام ويب",
    count: "1 مرات",
  },
  {
    title: "الذكر الثالث",
    text: "آمَنَ الرَّسُولُ بِمَا أُنْزِلَ إِلَيْهِ مِنْ رَبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِنْ رُسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ. لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِنْ قَبْلِنَا رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا أَنْتَ مَوْلَانَا فَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
    benefit: "[البقرة 285 - 286] - من قرأ آيتين من آخر سورة البقرة في ليلة كفتاه",
    reference: "رواه ارواه البخاري و مسلم موقع إسلام سؤال وجواب",
    count: "1 مرات",
  },
  {
    title: "الذكر الرابع",
    text: "جَمَعَ كَفَّيْهِ، ثُمَّ نَفَثَ فِيهِمَا، فَقَرَأَ فِيهِمَا: قُلْ هُوَ ٱللَّهُ أَحَدٌ، ٱللَّهُ ٱلصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ وَ قُلْ قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ، وَ قُلْقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ، مَلِكِ ٱلنَّاسِ، إِلَٰهِ ٱلنَّاسِ، مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ، ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ، مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ، ثُمَّ يَمْسَحُ بِهِمَا مَا اسْتَطَاعَ مِنْ جَسَدِهِ، يَبْدَأُ بِهِمَا عَلَى رَأْسِهِ وَوَجْهِهِ وَمَا أَقْبَلَ مِنْ جَسَدِهِ،  النفث: نفخ لطيف بلا ريق",
    benefit: "سورة الإخلاص والفلق والناس - أجير من الجن حتى يصبح.",
    reference: "ارواه البخاري موقع إسلام سؤال وجواب",
    count: "َثلَاثَ مَرَّاتٍ",
    highlightSurahs: true,
  },
  {
    title: "الذكر الخامس",
    text: "قُلۡ يَٰٓأَيُّهَا ٱلۡكَٰفِرُونَ (1) لَآ أَعۡبُدُ مَا تَعۡبُدُونَ (2) وَلَآ أَنتُمۡ عَٰبِدُونَ مَآ أَعۡبُدُ (3) وَلَآ أَنَا۠ عَابِدٞ مَّا عَبَدتُّمۡ (4) وَلَآ أَنتُمۡ عَٰبِدُونَ مَآ أَعۡبُدُ (5) لَكُمۡ دِينُكُمۡ وَلِيَ دِينِ (6)",
    benefit: "سورة الكافرون - ثُمَّ نَمْ على خاتِمَتِها، فإنَّها بَرَاءَةٌ مِنَ الشِّرْكِ",
    reference: "رواه أبو داود موقع إسلام سؤال وجواب",
    count: "1 مرات",
  },
  {
    title: "الذكر السادس",
    text: "قاللَّهُمَّ أَسْلَمْتُ وَجْهِي إِلَيْكَ: وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، اللَّهُمَّ آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ",
    benefit: "فَإِنْ مُتَّ مِنْ لَيْلَتِكَ فَأَنْتَ عَلَى الْفِطْرَةِ، وَاجْعَلْهُنَّ آخِرَ مَا تَتَكَلَّمُ بِهِ",
    reference: "رواه رواه البخاري موقع إسلام سؤال وجواب",
    count: "1 مرات",
  },
  {
    title: "الذكر السابع",
    text: "إِذَا أَوَى أَحَدُكُمْ إِلَى فِرَاشِهِ فَلْيَنْفُضْ فِرَاشَهُ بِدَاخِلَةِ إِزَارِهِ فَإِنَّهُ لَا يَدْرِي مَا خَلَفَهُ عَلَيْهِ ثُمَّ يَقُولُ: بِاسْمِكَ رَبِّ وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، إِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ",
    benefit: "لاتوجد",
    reference: "رواه البخاري ومسلم موقع إسلام سؤال وجواب",
    count: "1 مرات",
  },
  { title: "الذكر الثامن", text: "اللَّهُمَّ قِنِى عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ", benefit: "لاتوجد", reference: "رواه أبو داود  موقع إسلام سؤال وجواب", count: "ثَلاَثَ مَرَات" },
  { title: "الذكر التاسع", text: "اللَّهُمَّ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ", benefit: "لاتوجد", reference: "رواه مسلم موقع إسلام سؤال وجواب", count: "1 مِرَات" },
  { title: "الذكر العاشر", text: "سُبْحَانَ اللَّهِ.", benefit: "لاتوجد", reference: "رواه البخاري موقع إسلام سؤال وجواب", count: "ثَلَاثًا وَثَلَاثِينَ، مِرَات" },
  { title: "الذكر 11", text: "الْحَمْدُ لِلَّهِ.", benefit: "لاتوجد", reference: "رواه البخاري موقع إسلام سؤال وجواب", count: "ثَلَاثًا وَثَلَاثِينَ، مِرَات" },
  { title: "الذكر 12", text: "اللَّهُ أَكْبَرُ. .", benefit: "لاتوجد", reference: "رواه البخاري موقع إسلام سؤال وجواب", count: "34، مِرَات" },
];

const wakingDhikrListInitial: SleepDhikr[] = [
  { title: "الذكر الأول", text: "امن تعار ـ أي: استيقظ ـ من الليل فقال: لا إلهَ إلاّ اللهُ واللهُ أكبَر، وَلا حَولَ وَلا قوّة إلاّ باللّهِ ، ثم قال: اللهم اغفر لي - أو دعا - استجيب له، فإن توضأ وصلى قبلت صلاته", benefit: "لاتوجد", reference: "رواه البخاري موقع إسلام ويب", count: "مرة واحدة" },
  { title: "الذكر الثاني", text: "الحمدُ للهِ الذي عافاني في جَسَدي وَرَدّ عَليّ روحي وَأَذِنَ لي بِذِكْرِه", benefit: "لاتوجد", reference: "رواه الترمذي والنسائي موقع إسلام ويب", count: "مرة واحدة" },
];

const wakingDhikrListWithThird: SleepDhikr[] = [
  ...wakingDhikrListInitial,
  { title: "الذكر الثالث", text: "الحَمْـدُ لِلّهِ الّذي أَحْـيانا بَعْـدَ ما أَماتَـنا وَإليه النُّـشور", benefit: "لاتوجد", reference: "رواه الترمذي والنسائي موقع إسلام ويب", count: "مرة واحدة" },
];

const miscellaneousDhikrListInitial: SleepDhikr[] = [
  { title: "رؤية مايكره", text: "فإذا رأى أحدكم ما يكره فلينفث عن يساره ثلاثًا، وليستعذ بالله من الشيطان ومن شر ما رأى ثلاثًا ثم لينقلب على جنبه الآخر فإنها لا تضره ولا يخبر بها أحدًا", benefit: "لاتوجد", reference: "موقع الإمام ابن باز", count: "مرة ثلاثًا" },
  { title: "رؤية مايحب", text: "إذا رأى أحدكم ما يحب فليحمد الله وليحدث بذلك من يحب، وإذا رأى ما يكره فلينفث عن يساره ثلاث مرات، وليتعوذ بالله من الشيطان ومن شر ما رأى ثلاث مرات، ثم لينقلب على جنبه الآخر؛ فإنها لا تضره ولا يخبر بها أحدًا", benefit: "لاتوجد", reference: "موقع الإمام ابن باز", count: "مرة ثلاثًا" },
  { title: "أصاب أحدنا الأرق", text: " يا رسول الله ما أنام من الأرق، قال: إذا أويت إلى فراشك فقل: اللهم رب السموات السبع وما أظللن، ورب الأرضين السبع وما أقللن، ورب الشياطين وما أضللن كن لي جاراً من شر خلقك كلهم جميعاً أن يفرط علي أحد منهم، أو يبغي علي أحد، عز جارك، وجل ثناؤك، ولا إله غيرك", benefit: "لاتوجد", reference: "موقع الإمام إسلام ويب", count: "مرة واحدة" },
];

const sleepTargetCounts = [1, 1, 1, 3, 1, 1, 1, 3, 1, 33, 33, 34];
const wakingTargetCounts = [1, 1, 1];
const miscellaneousTargetCounts = [3, 3, 1];

const eveningDhikrListInitial: MorningDhikr[] = [
  { text: "اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ", targetCount: 1, source: "آية الكرسى - البقرة 255", references: "لرواه الحاكم وابن حبان موقع اسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ هُوَ ٱللَّهُ أَحَدٌ، ٱللَّهُ ٱلصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ", targetCount: 3, source: "سورة الإخلاص", references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ.", targetCount: 3, source: "سورة الفلق", references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ، مَلِكِ ٱلنَّاسِ، إِلَٰهِ ٱلنَّاسِ، مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ، ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ، مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ.", targetCount: 3, source: "سورة الناس", references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "أَمْسَيْـنا وَأَمْسـى المـلكُ لله وَالحَمدُ لله ، لا إلهَ إلاّ اللّهُ وَحدَهُ لا شَريكَ لهُ، لهُ المُـلكُ ولهُ الحَمْـد، وهُوَ على كلّ شَيءٍ قدير ، رَبِّ أسْـأَلُـكَ خَـيرَ ما في هـذهِ اللَّـيْلَةِ وَخَـيرَ ما بَعْـدَهـا ، وَأَعـوذُ بِكَ مِنْ شَـرِّ ما في هـذهِ اللَّـيْلةِ وَشَرِّ ما بَعْـدَهـا ، رَبِّ أَعـوذُبِكَ مِنَ الْكَسَـلِ وَسـوءِ الْكِـبَر ، رَبِّ أَعـوذُ بِكَ مِنْ عَـذابٍ في النّـارِ وَعَـذابٍ في الْقَـبْر", targetCount: 1, references: "رواه مسلم الموقع اسلام ويب" },
  { text: "اللّهُـمَّ بِكَ أَمْسَـينا وَبِكَ أَصْـبَحْنا، وَبِكَ نَحْـيا وَبِكَ نَمُـوتُ وَإِلَـيْكَ الْمَصِيرُ.", targetCount: 1, references: "رواه أصحاب السنن عدا النسائي الموقع اسلام ويب" },
  { text: "اللّهـمَّ أَنْتَ رَبِّـي لا إلهَ إلاّ أَنْتَ ، خَلَقْتَنـي وَأَنا عَبْـدُك ، وَأَنا عَلـى عَهْـدِكَ وَوَعْـدِكَ ما اسْتَـطَعْـت ، أَعـوذُبِكَ مِنْ شَـرِّ ما صَنَـعْت ، أَبـوءُ لَـكَ بِنِعْـمَتِـكَ عَلَـيَّ وَأَبـوءُ بِذَنْـبي فَاغْفـِرْ لي فَإِنَّـهُ لا يَغْـفِرُ الذُّنـوبَ إِلاّ أَنْتَ", targetCount: 1, source: "من قالها موقنا بها حين يمسى ومات من ليلته دخل الجنة وكذلك حين يصبح.", references: "رواه البخاري الموقع اسلام ويب" },
  { text: "االلّهُـمَّ إِنِّـي أَمسيتُ أُشْـهِدُك ، وَأُشْـهِدُ حَمَلَةَ عَـرْشِـك ، وَمَلَائِكَتَكَ ، وَجَمـيعَ خَلْـقِك ، أَنَّـكَ أَنْـتَ اللهُ لا إلهَ إلاّ أَنْـتَ وَحْـدَكَ لا شَريكَ لَـك ، وَأَنَّ ُ مُحَمّـداً عَبْـدُكَ وَرَسـولُـك", targetCount: 4, source: "من قالها أعتقه الله من النار.", references: "رواه  أبو داود والترمذي الموقع اسلام ويب" },
  { text: "اللّهُـمَّ عافِـني في بَدَنـي ، اللّهُـمَّ عافِـني في سَمْـعي ، اللّهُـمَّ عافِـني في بَصَـري ، لا إلهَ إلاّ أَنْـتَ ،اللّهُـمَّ إِنّـي أَعـوذُ بِكَ مِنَ الْكُـفر ، وَالفَـقْر ، وَأَعـوذُ بِكَ مِنْ عَذابِ الْقَـبْر ، لا إلهَ إلاّ أَنْـتَ", targetCount: 3, references: "رواه أبو داود الموقع اسلام ويب" },
  { text: "حَسْبِـيَ اللّهُ لا إلهَ إلاّ هُوَ عَلَـيهِ تَوَكَّـلتُ وَهُوَ رَبُّ العَرْشِ العَظـيم", targetCount: 7, source: "التوبة:129", references: "رواه أبو داود الموقع اسلام ويب" },
  { text: "اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في الدُّنْـيا وَالآخِـرَة ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في ديني وَدُنْـيايَ وَأهْـلي وَمالـي ، اللّهُـمَّ اسْتُـرْ عـوْراتي وَآمِـنْ رَوْعاتـي ، اللّهُـمَّ احْفَظْـني مِن بَـينِ يَدَيَّ وَمِن خَلْفـي وَعَن يَمـيني وَعَن شِمـالي ، وَمِن فَوْقـي ، وَأَعـوذُ بِعَظَمَـتِكَ أَن أُغْـتالَ مِن تَحْتـي", targetCount: 1, references: "رواه أبو داود وابن ماجه" },
  { text: "اللَّهمَّ فاطِرَ السَّمَواتِ والأرضِ، عالِـمَ الْغَـيْبِ وَالشّـهادَةِ رَبَّ كـلِّ شَـيْءٍ وَمَليـكَه ، أَشْهَـدُ أَنْ لا إِلـهَ إِلاّ أَنْت ، أَعـوذُ بِكَ مِن شَـرِّ نَفْسـي وَمِن شَـرِّ الشَّيْـطانِ وَشِرْكِهِ ، وَأَنْ أَقْتَـرِفَ عَلـى نَفْسـي سوءاً أَوْ أَجُـرَّهُ إِلـى مُسْـلِم", targetCount: 1, references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "بِسـمِ اللهِ الذي لا يَضُـرُّ مَعَ اسمِـهِ شَيءٌ في الأرْضِ وَلا في السّمـاءِ وَهـوَ السّمـيعُ العَلـيم", targetCount: 3, source: "لم يضره من الله شيء.", references: "رواه أصحاب السنن عدا النسائي الموقع اسلام ويب" },
  { text: "رَضيـتُ بِاللهِ رَبَّـاً وَبِالإسْلامِ ديـناً وَبِمُحَـمَّدٍ صلى الله عليه وسلم نَبِيّـاً", targetCount: 3, source: "من قالها حين يصبح وحين يمسى كان حقا على الله أن يرضيه يوم القيامة.", references: "رواه أبو داود الموقع اسلام ويب" },
  { text: "يَا حَيُّ يَا قيُّومُ بِرَحْمَتِكَ أسْتَغِيثُ أصْلِحْ لِي شَأنِي كُلَّهُ وَلاَ تَكِلْنِي إلَى نَفْسِي طَـرْفَةَ عَيْنٍ.", targetCount: 1, references: "رواه أبو داود الموقع اسلام ويب" },
  { text: "أَمْسَيْنَا عَلَى فِطْرَةِ الإسْلاَمِ، وَعَلَى كَلِمَةِ الإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ المُشْرِكِينَ.", targetCount: 1, references: "رواه أحمد الموقع اسلام ويب" },
  { text: "أمسيت أثنيَ عليكَ حمدًا، وأشهدُ أن لا إلَه إلَّا اللَّهُ", targetCount: 3, references: "رواه أخرجه النسائي في السنن الكبرى الموقع الدرر السنية" },
  { text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنَ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ، وَقَهْرِ الرِّجَالِ", targetCount: 1, references: "رواه أبو داود الموقع اسلام ويب" },
  { text: "أَعـوذُ بِكَلِمـاتِ اللّهِ التّـامّـاتِ مِنْ شَـرِّ ما خَلَـق", targetCount: 3, references: "رواه رواه مسلم الموقع اسلام ويب" },
  { text: "لا إلَهَ إلَّا اللَّهُ وحدَهُ لا شَريكَ لَهُ ، لَهُ الملكُ ، ولَهُ الحمدُ ،وَهوَ علَى كلِّ شيءٍ قديرٌ", targetCount: 100, source: "كانت له عدل عشر رقاب، وكتبت له مئة حسنة، ومحيت عنه مئة سيئة، وكانت له حرزا من الشيطان", references: "رواه أبو داود الموقع اسلام ويب", continuationPrompt: true },
  { text: "أسْتَغْفِرُ اللهَ", targetCount: 100, references: "رواه ابن أبي شيبة الموقع اسلام ويب" },
  { text: "سبحان الله وبحمده", targetCount: 100, references: "رواه رواه مسلم الموقع اسلام ويب" },
  { text: "سبحان الله", targetCount: 100, references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "الحمد لله", targetCount: 100, references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "الله أكبر", targetCount: 100, references: "رواه الترمذي الموقع اسلام ويب" },
  { text: "لا إله إلا الله وحده، لا شريك له، له الملك، وله الحمد، وهوعلى كل شيء قدير", targetCount: 100, references: "رواه الترمذي الموقع اسلام ويب" },
]; 

const initialMorningDhikr: MorningDhikr[] = [
  { text: "اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ", targetCount: 1, source: "آية الكرسى - البقرة 255", references: "رواه الحاكم وابن حبان · موقع إسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ هُوَ ٱللَّهُ أَحَدٌ، ٱللَّهُ ٱلصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ", targetCount: 3, source: "سورة الإخلاص", references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ.", targetCount: 3, source: "سورة الفلق", references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "بِسْمِ اللهِ الرَّحْمنِ الرَّحِيم\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ، مَلِكِ ٱلنَّاسِ، إِلَٰهِ ٱلنَّاسِ، مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ، ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ، مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ.", targetCount: 3, source: "سورة الناس", references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "أَصْـبَحْنا وَأَصْـبَحَ المُـلْكُ لله وَالحَمدُ لله ، لا إلهَ إلاّ اللّهُ وَحدَهُ لا شَريكَ لهُ، لهُ المُـلكُ ولهُ الحَمْـد، وهُوَ على كلّ شَيءٍ قدير ، رَبِّ أسْـأَلُـكَ خَـيرَ ما في هـذا اليوم وَخَـيرَ ما بَعْـدَه ، وَأَعـوذُ بِكَ مِنْ شَـرِّ ما في هـذا اليوم وَشَرِّ ما بَعْـدَه، رَبِّ أَعـوذُبِكَ مِنَ الْكَسَـلِ وَسـوءِ الْكِـبَر ، رَبِّ أَعـوذُ بِكَ مِنْ عَـذابٍ في النّـارِ وَعَـذابٍ في القَـبْر", targetCount: 1, references: "رواه مسلم · الموقع إسلام ويب" },
  { text: "اللّهُـمَّ بِكَ أَصْـبَحْنا وَبِكَ أَمْسَـينا ، وَبِكَ نَحْـيا وَبِكَ نَمُـوتُ وَإِلَـيْكَ النُّـشُور", targetCount: 1, references: "رواه أصحاب السنن عدا النسائي · الموقع إسلام ويب" },
  { text: "اللّهـمَّ أَنْتَ رَبِّـي لا إلهَ إلاّ أَنْتَ ، خَلَقْتنـي وَأَنا عَبْـدُك ، وَأَنا عَلـى عَهْـدِكَ وَوَعْـدِكَ ما اسْتَـطَعْـت ، أَعـوذُبِكَ مِنْ شَـرِّ ما صَنَـعْت ، أَبـوءُ لَـكَ بِنِعْـمَتِـكَ عَلَـيَّ وَأَبـوءُ بِذَنْـبي فَاغْفـِرْ لي فَإِنَّـهُ لا يَغْـفِرُ الذُّنـوبَ إِلاّ أَنْتَ", targetCount: 1, source: "من قالها موقنا بها حين يمسى ومات من ليلته دخل الجنة وكذلك حين يصبح.", references: "رواه البخاري · الموقع إسلام ويب" },
  { text: "اللّهُـمَّ إِنِّـي أَصْبَـحْتُ أُشْـهِدُك ، وَأُشْـهِدُ حَمَلَـةَ عَـرْشِـك ، وَمَلَائِكَتَكَ ، وَجَمـيعَ خَلْـقِك ، أَنَّـكَ أَنْـتَ اللهُ لا إلهَ إلاّ أَنْـتَ وَحْـدَكَ لا شَريكَ لَـك ، وَأَنَّ ُ مُحَمّـداً عَبْـدُكَ وَرَسـولُـك.", targetCount: 4, source: "من قالها أعتقه الله من النار.", references: "رواه أبو داود والترمذي · الموقع إسلام ويب" },
  { text: "اللّهُـمَّ عافِـني في بَدَنـي ، اللّهُـمَّ عافِـني في سَمْـعي ، اللّهُـمَّ عافِـني في بَصَـري ، لا إلهَ إلاّ أَنْـتَ ،اللّهُـمَّ إِنّـي أَعـوذُ بِكَ مِنَ الْكُـفر ، وَالفَـقْر ، وَأَعـوذُ بِكَ مِنْ عَذابِ القَـبْر ، لا إلهَ إلاّ أَنْـتَ", targetCount: 7, source: "التوبة: 129", references: "رواه أبو داود · الموقع إسلام ويب" },
  { text: "حَسْبِـيَ اللّهُ لا إلهَ إلاّ هُوَ عَلَـيهِ تَوَكَّـلتُ وَهُوَ رَبُّ العَرْشِ العَظـيم", targetCount: 7, source: "التوبة: 129", references: "رواه أبو داود · الموقع إسلام ويب" },
  { text: "اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في الدُّنْـيا وَالآخِـرَة ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في ديني وَدُنْـيايَ وَأهْـلي وَمالـي ، اللّهُـمَّ اسْتُـرْ عـوْراتي وَآمِـنْ رَوْعاتـي ، اللّهُـمَّ احْفَظْـني مِن بَـينِ يَدَيَّ وَمِن خَلْفـي وَعَن يَمـيني وَعَن شِمـالي ، وَمِن فَوْقـي ، وَأَعـوذُ بِعَظَمَـتِكَ أَن أُغْـتالَ مِن تَحْتـي", targetCount: 1, references: "رواه أبو داود وابن ماجه · الموقع إسلام ويب" },
  { text: "اللَّهمَّ فاطِرَ السَّمَواتِ والأرضِ، عالِـمَ الغَـيْبِ وَالشّـهادَةِ رَبَّ كـلِّ شَـيءٍ وَمَليـكَه ، أَشْهَـدُ أَنْ لا إِلـهَ إِلاّ أَنْت ، أَعـوذُ بِكَ مِن شَـرِّ نَفْسـي وَمِن شَـرِّ الشَّيْـطانِ وَشِرْكِهِ ، وَأَنْ أَقْتَـرِفَ عَلـى نَفْسـي سوءاً أَوْ أَجُـرَّهُ إِلـى مُسْـلِم", targetCount: 1, references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "بِسـمِ اللهِ الذي لا يَضُـرُّ مَعَ اسمِـهِ شَيءٌ في الأرْضِ وَلا في السّمـاءِ وَهـوَ السّمـيعُ العَلـيم", targetCount: 3, source: "لم يضره من الله شيء.", references: "رواه أصحاب السنن عدا النسائي · الموقع إسلام ويب" },
  { text: "رَضيـتُ بِاللهِ رَبَّـاً وَبِالإسْلامِ ديـناً وَبِمُحَـمَّدٍ صلى الله عليه وسلم نَبِيّـاً", targetCount: 3, source: "من قالها حين يصبح وحين يمسى كان حقا على الله أن يرضيه يوم القيامة.", references: "رواه أبو داود · الموقع إسلام ويب" },
  { text: "يَا حَيُّ يَا قيُّومُ بِرَحْمَتِكَ أسْتَغِيثُ أصْلِحْ لِي شَأنِي كُلَّهُ وَلاَ تَكِلْنِي إلَى نَفْسِي طَـرْفَةَ عَيْنٍ.", targetCount: 1, references: "رواه أبو داود · الموقع إسلام ويب" },
  { text: "أَصْبَـحْـنا عَلَى فِطْرَةِ الإسْلاَمِ، وَعَلَى كَلِمَةِ الإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ المُشْرِكِينَ", targetCount: 1, references: "رواه أحمد · الموقع إسلام ويب" },
  { text: "أصبحتُ أثنيَ عليكَ حمدًا، وأشهدُ أن لا إلَه إلَّا اللَّهُ", targetCount: 3, references: "أخرجه النسائي في السنن الكبرى · الموقع الدرر السنية" },
  { text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنْ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنْ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ، وَقَهْرِ الرِّجَالِ", targetCount: 1, references: "رواه أبو داود · الموقع إسلام ويب" },
  { text: "سُبْحـانَ اللهِ وَبِحَمْـدِهِ عَدَدَ خَلْـقِه ، وَرِضـا نَفْسِـه ، وَزِنَـةَ عَـرْشِـه ، وَمِـدادَ كَلِمـاتِـه", targetCount: 3, references: "رواه مسلم · الموقع إسلام ويب" },
  { text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا", targetCount: 1, references: "رواه ابن ماجه · الموقع إسلام ويب" },
  { text: "لا إلَهَ إلَّا اللَّهُ وحدَهُ لا شَريكَ لَهُ ، لَهُ الملكُ ، ولَهُ الحمدُ ،وَهوَ علَى كلِّ شيءٍ قديرٌ", targetCount: 100, source: "كانت له عدل عشر رقاب، وكتبت له مئة حسنة، ومحيت عنه مئة سيئة، وكانت له حرزا من الشيطان", references: "رواه أبو داود · الموقع إسلام ويب", continuationPrompt: true },
  { text: "أسْتَغْفِرُ اللهَ", targetCount: 100, references: "رواه ابن أبي شيبة · الموقع إسلام ويب" },
  { text: "سبحان الله وبحمده", targetCount: 100, references: "رواه مسلم · الموقع إسلام ويب" },
  { text: "سبحان الله", targetCount: 100, references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "الحمد لله", targetCount: 100, references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "الله أكبر", targetCount: 100, references: "رواه الترمذي · الموقع إسلام ويب" },
  { text: "لا إله إلا الله وحده، لا شريك له، له الملك، وله الحمد، وهوعلى كل شيء قدير", targetCount: 100, references: "رواه الترمذي · الموقع إسلام ويب" },
];
// النصوص المقدسة لأذكار السبحة منقولة حرفيًا كما زوّد بها المستخدم؛ لا تُعدّل.
const initialTasbeehDhikr: MorningDhikr[] = [
  { text: "أستغفر الله", targetCount: 100, source: "رواه مسلم.", references: "الموقع اسلام ويب" },
  { text: "أستغفر الله العظيم، الذي لا إله إلا هو، الحي القيوم، وأتوب إليه", targetCount: 100, source: "سنن أبي داود و صححه الألباني", references: "الموقع اسلام ويب" },
  { title: "سيد الاستغفار", text: "سيد الاستغفار أن تقول: اللهم أنت ربي، لا إله إلا أنت، خلقتني، وأنا عبدك، وأنا على عهدك، ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك عليّ، وأبوء بذنبي، فاغفر لي؛ فإنه لا يغفر الذنوب إلا أنت،", targetCount: 100, source: "صحيح البخاري", references: "الموقع اسلام ويب" },
];
function HeaderButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button className="icon-button" aria-label={label} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ThemeToggleButton({ darkMode, onToggle, className = "" }: { darkMode: boolean; onToggle: () => void; className?: string }) {
  return <button type="button" className={`dhikr-theme-toggle ${className}`} aria-label={darkMode ? "الانتقال إلى الوضع العادي" : "الانتقال إلى الوضع الليلي"} onClick={onToggle}>{darkMode ? <SunMedium size={19} /> : <Moon size={19} />}</button>;
}


type PickerRgb = { r: number; g: number; b: number };
const colorClamp = (value: number, max = 255) => Math.min(max, Math.max(0, Math.round(value)));
function pickerHexToRgb(hex: string): PickerRgb {
  const value = hex.replace("#", "");
  return { r: Number.parseInt(value.slice(0, 2), 16) || 0, g: Number.parseInt(value.slice(2, 4), 16) || 0, b: Number.parseInt(value.slice(4, 6), 16) || 0 };
}
function pickerRgbToHex({ r, g, b }: PickerRgb) { return `#${[r, g, b].map((value) => colorClamp(value).toString(16).padStart(2, "0")).join("")}`; }
function pickerHexToHsv(hex: string) {
  const { r, g, b } = pickerHexToRgb(hex);
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}
function pickerHsvToHex(h: number, s: number, v: number) {
  const chroma = v * s, x = chroma * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - chroma;
  const sector = Math.floor(h / 60) % 6;
  const rgb = sector === 0 ? [chroma, x, 0] : sector === 1 ? [x, chroma, 0] : sector === 2 ? [0, chroma, x] : sector === 3 ? [0, x, chroma] : sector === 4 ? [x, 0, chroma] : [chroma, 0, x];
  return pickerRgbToHex({ r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 });
}
const dhikrBaseColors = [
  "#f28b82", "#ea4335", "#c5221f", "#a50e0e", "#5c0000", "#fbbc04", "#f9ab00", "#e37400", "#b06000", "#783f04",
  "#fff475", "#fdd663", "#f4c20d", "#e2b000", "#b88700", "#ccff90", "#a8d96c", "#76c893", "#34a853", "#137333",
  "#a7ffeb", "#64d8cb", "#12b5cb", "#0097a7", "#007c83", "#aecbfa", "#8ab4f8", "#4285f4", "#1a73e8", "#174ea6",
  "#d7aefb", "#c58af9", "#a142f4", "#8430ce", "#681da8", "#f6aea9", "#e8eaed", "#bdc1c6", "#80868b", "#202124",
];
function DhikrColorPicker({ initialColor, darkMode, onCancel, onApply }: { initialColor: string; darkMode: boolean; onCancel: () => void; onApply: (color: string) => void }) {
  const [color, setColor] = useState(initialColor.toLowerCase());
  const [hexInput, setHexInput] = useState(initialColor.toUpperCase());
  const [rgb, setRgb] = useState<PickerRgb>(() => pickerHexToRgb(initialColor));
  const initialHsv = pickerHexToHsv(initialColor);
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [brightness, setBrightness] = useState(initialHsv.v);
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    try { const stored = JSON.parse(localStorage.getItem("al-mosaly-custom-colors") || "[]"); return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string" && /^#[0-9a-f]{6}$/i.test(item)).slice(0, 30) : []; }
    catch { return []; }
  });
  useEffect(() => {
    setHexInput(color.toUpperCase());
    setRgb(pickerHexToRgb(color));
  }, [color]);
  const selectColor = (nextColor: string) => {
    const hsv = pickerHexToHsv(nextColor);
    setHue(hsv.h); setSaturation(hsv.s); setBrightness(hsv.v); setColor(nextColor.toLowerCase());
  };
  const setFromHsv = (nextHue: number, nextSaturation: number, nextBrightness: number) => {
    setHue(nextHue); setSaturation(nextSaturation); setBrightness(nextBrightness);
    setColor(pickerHsvToHex(nextHue, nextSaturation, nextBrightness));
  };
  const setFromRgb = (key: keyof PickerRgb, value: number) => {
    const next = { ...rgb, [key]: colorClamp(value) };
    const nextColor = pickerRgbToHex(next), hsv = pickerHexToHsv(nextColor);
    setHue(hsv.h); setSaturation(hsv.s); setBrightness(hsv.v); setColor(nextColor);
  };
  const updateFromPlane = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextSaturation = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const nextBrightness = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setFromHsv(hue, nextSaturation, nextBrightness);
  };
  const addSavedColor = () => {
    const next = [color.toLowerCase(), ...savedColors.filter((item) => item.toLowerCase() !== color.toLowerCase()) ].slice(0, 30);
    setSavedColors(next);
    localStorage.setItem("al-mosaly-custom-colors", JSON.stringify(next));
  };
  return <div className={`dhikr-picker-overlay ${darkMode ? "is-dark" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dhikr-picker-title">
    <button className="dhikr-picker-scrim" type="button" aria-label="إغلاق منتقي الألوان" onClick={onCancel} />
    <section className="dhikr-picker-card">
      <header className="dhikr-picker-header"><h3 id="dhikr-picker-title">تعديل الألوان</h3><button type="button" aria-label="إغلاق" onClick={onCancel}><X size={18} /></button></header>
      <div className="dhikr-picker-main">
        <div className="dhikr-picker-plane-column"><div className="dhikr-picker-plane" role="slider" aria-label="اختيار التشبع والسطوع" aria-valuetext={`التشبع ${Math.round(saturation * 100)}٪، السطوع ${Math.round(brightness * 100)}٪`} tabIndex={0} style={{ "--picker-hue": `${hue}deg`, "--picker-x": `${saturation * 100}%`, "--picker-y": `${(1 - brightness) * 100}%` } as React.CSSProperties} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFromPlane(event); }} onPointerMove={(event) => { if (event.buttons) updateFromPlane(event); }} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); setFromHsv(hue, Math.min(1, saturation + .03), brightness); } else if (event.key === "ArrowLeft") { event.preventDefault(); setFromHsv(hue, Math.max(0, saturation - .03), brightness); } else if (event.key === "ArrowUp") { event.preventDefault(); setFromHsv(hue, saturation, Math.min(1, brightness + .03)); } else if (event.key === "ArrowDown") { event.preventDefault(); setFromHsv(hue, saturation, Math.max(0, brightness - .03)); } }}><span className="dhikr-picker-cursor" /></div><input className="dhikr-picker-hue" type="range" min="0" max="359" value={Math.round(hue)} aria-label="طيف الألوان" title="طيف الألوان" onChange={(event) => setFromHsv(Number(event.target.value), saturation, brightness)} /></div>
        <div className="dhikr-picker-current" style={{ backgroundColor: color }} aria-label={`اللون الحالي ${color}`} />
        <div className="dhikr-picker-hue-column"><div className="dhikr-picker-brightness" role="slider" aria-label="تدرج اللون حتى الأسود" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(brightness * 100)} aria-valuetext={`سطوع ${Math.round(brightness * 100)}٪`} tabIndex={0} style={{ "--picker-color": pickerHsvToHex(hue, saturation, 1), "--picker-level": `${(1 - brightness) * 100}%` } as React.CSSProperties} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); if (rect.height) setFromHsv(hue, saturation, 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))); }} onPointerMove={(event) => { if (event.buttons) { const rect = event.currentTarget.getBoundingClientRect(); if (rect.height) setFromHsv(hue, saturation, 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))); } }} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowRight") { event.preventDefault(); setFromHsv(hue, saturation, Math.min(1, brightness + .03)); } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") { event.preventDefault(); setFromHsv(hue, saturation, Math.max(0, brightness - .03)); } }}><span className="dhikr-picker-brightness-thumb" /></div></div>
        <div className="dhikr-picker-values">
          <label className="dhikr-picker-hex">HEX<input value={hexInput} spellCheck={false} maxLength={7} onChange={(event) => { const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`; setHexInput(next.toUpperCase()); if (/^#[0-9a-f]{6}$/i.test(next)) selectColor(next); }} onBlur={() => setHexInput(color.toUpperCase())} /></label>
          <label className="dhikr-picker-format">النمط<select aria-label="نمط الألوان" value="rgb" onChange={() => undefined}><option value="rgb">RGB</option></select></label>
          <div className="dhikr-picker-rgb"><label><input type="number" min="0" max="255" aria-label="قيمة الأحمر" value={rgb.r} onChange={(event) => setFromRgb("r", Number(event.target.value))} /><span>أحمر</span></label><label><input type="number" min="0" max="255" aria-label="قيمة الأخضر" value={rgb.g} onChange={(event) => setFromRgb("g", Number(event.target.value))} /><span>أخضر</span></label><label><input type="number" min="0" max="255" aria-label="قيمة الأزرق" value={rgb.b} onChange={(event) => setFromRgb("b", Number(event.target.value))} /><span>أزرق</span></label></div>
        </div>
      </div>
      <div className="dhikr-picker-palettes"><section className="dhikr-picker-palette-section dhikr-picker-base"><h4>ألوان أساسية</h4><div className="dhikr-picker-swatches">{dhikrBaseColors.map((item) => <button type="button" key={item} title={item} aria-label={`لون ${item}`} aria-pressed={color.toLowerCase() === item} className={color.toLowerCase() === item ? "is-selected" : ""} style={{ backgroundColor: item }} onClick={() => selectColor(item)} />)}</div></section><section className="dhikr-picker-palette-section dhikr-picker-custom"><div className="dhikr-picker-palette-title"><h4>ألوان مخصصة</h4><button type="button" className="dhikr-picker-add-color" title="حفظ اللون الحالي" aria-label="إضافة اللون الحالي إلى الألوان المخصصة" onClick={addSavedColor}><Plus size={18} /></button></div><div className="dhikr-picker-swatches">{Array.from({ length: 30 }, (_, index) => savedColors[index] ? <button type="button" key={`${savedColors[index]}-${index}`} title={savedColors[index]} aria-label={`لون مخصص ${savedColors[index]}`} aria-pressed={color.toLowerCase() === savedColors[index].toLowerCase()} className={`is-custom ${color.toLowerCase() === savedColors[index].toLowerCase() ? "is-selected" : ""}`} style={{ backgroundColor: savedColors[index] }} onClick={() => selectColor(savedColors[index].toLowerCase())} /> : <button type="button" key={`empty-${index}`} className="is-empty" aria-label="فتحة لون مخصص فارغة" disabled />)}</div></section></div>
      <footer className="dhikr-picker-actions"><button type="button" className="dhikr-picker-confirm" onClick={() => onApply(color.toLowerCase())}>موافق</button><button type="button" className="dhikr-picker-cancel" onClick={onCancel}>إلغاء</button></footer>
    </section>
  </div>;
}

function FeatureTile({ feature, onClick }: { feature: Feature; onClick: () => void }) {
  const Icon = feature.icon;
  return (
    <button type="button" className={`feature-tile ${feature.featured ? "feature-tile-featured" : ""}`} onClick={onClick}>
      <span className={`feature-icon feature-${feature.tone}`}>
        <Icon size={21} strokeWidth={1.8} />
      </span>
      <span className="feature-copy">
        <strong>{feature.title}</strong>
        <small>{feature.caption}</small>
      </span>
    </button>
  );
}

function LocationOption({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" className="location-option" onClick={onClick}><span className="location-option-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><ChevronLeft size={17} /></button>;
}

const KAABA_COORDINATES = { latitude: 21.422487, longitude: 39.826206 };

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function calculateQiblaBearing(latitude: number, longitude: number) {
  const startLatitude = latitude * Math.PI / 180;
  const kaabaLatitude = KAABA_COORDINATES.latitude * Math.PI / 180;
  const longitudeDifference = (KAABA_COORDINATES.longitude - longitude) * Math.PI / 180;
  const y = Math.sin(longitudeDifference) * Math.cos(kaabaLatitude);
  const x = Math.cos(startLatitude) * Math.sin(kaabaLatitude) - Math.sin(startLatitude) * Math.cos(kaabaLatitude) * Math.cos(longitudeDifference);
  return normalizeDegrees(Math.atan2(y, x) * 180 / Math.PI);
}

type QiblaOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number | null };
type QiblaPosition = { latitude: number; longitude: number; source: "gps" | "city" };

function KaabaGlyph({ size = 27 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M5 10.5 18 5l13 5.5v19L18 34 5 29.5z" fill="#17191a" stroke="#c9a65d" strokeWidth="1.2"/><path d="M5 10.5 18 16l13-5.5L18 5z" fill="#252729"/><path d="M5 15.1 18 20.5l13-5.4v3.8L18 24.2 5 18.9z" fill="#c7a14e"/><path d="M8.5 21.2v6.1l7.8 3.1v-6.1zM19.7 24.3v6.1l7.8-3.1v-6.1z" fill="#111314" stroke="#c9a65d" strokeWidth=".65"/><path d="m18 16 0 17" stroke="#d6b76f" strokeWidth=".7" opacity=".75"/></svg>;
}

function QiblaModal({ city, darkMode, onClose }: { city: CitySchedule; darkMode: boolean; onClose: () => void }) {
  const [position, setPosition] = useState<QiblaPosition>({ latitude: city.lat, longitude: city.lon, source: "city" });
  const [mode, setMode] = useState<"ready" | "waiting" | "sensor" | "map">("ready");
  const [heading, setHeading] = useState<number | null>(null);
  const [sensorListening, setSensorListening] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("اضغط لتفعيل البوصلة وتحديد موقعك بدقة.");
  const qiblaBearing = calculateQiblaBearing(position.latitude, position.longitude);
  const arrowAngle = mode === "sensor" && heading !== null ? normalizeDegrees(qiblaBearing - heading) : qiblaBearing;
  const northRingAngle = mode === "sensor" && heading !== null ? -heading : 0;
  const mapsUrl = new URL("https://www.google.com/maps/dir/");
  mapsUrl.searchParams.set("api", "1");
  mapsUrl.searchParams.set("origin", `${position.latitude},${position.longitude}`);
  mapsUrl.searchParams.set("destination", `${KAABA_COORDINATES.latitude},${KAABA_COORDINATES.longitude}`);
  mapsUrl.searchParams.set("travelmode", "walking");

  const requestPosition = () => {
    if (!navigator.geolocation) {
      setLocationMessage(`تعذر تحديد GPS؛ نستخدم موقع ${city.city} كتقدير.`);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude, source: "gps" });
        setLocationMessage("تم تحديد موقعك الحالي عبر GPS.");
      },
      () => setLocationMessage(`لم يُسمح بتحديد الموقع؛ نستخدم ${city.city} كتقدير.`),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const startQibla = async () => {
    setMode("waiting");
    setHeading(null);
    setSensorListening(false);
    setStatusMessage("جارٍ طلب الإذن وتحديد الموقع…");
    requestPosition();
    const sensorWindow = window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
    };
    const permissions: Promise<string>[] = [];
    try {
      if (sensorWindow.DeviceOrientationEvent?.requestPermission) permissions.push(sensorWindow.DeviceOrientationEvent.requestPermission());
      if (sensorWindow.DeviceMotionEvent?.requestPermission) permissions.push(sensorWindow.DeviceMotionEvent.requestPermission());
      const results = await Promise.all(permissions);
      if (results.some((result) => result !== "granted")) {
        setMode("map");
        setStatusMessage("لم يُمنح إذن اتجاه الجهاز؛ استخدم خريطة Google والزاوية المحسوبة.");
        return;
      }
      setStatusMessage("نبحث عن قراءة بوصلة مطلقة…");
      setSensorListening(true);
    } catch {
      setMode("map");
      setStatusMessage("تعذر الوصول إلى الحساسات؛ يمكنك متابعة الاتجاه عبر خرائط Google.");
    }
  };

  useEffect(() => {
    if (!sensorListening) return;
    let foundHeading = false;
    const timeout = window.setTimeout(() => {
      if (!foundHeading) {
        setMode("map");
        setStatusMessage("لم تصل قراءة بوصلة مطلقة من الجهاز؛ انتقل إلى خرائط Google.");
      }
    }, 5000);
    const handleOrientation = (event: Event) => {
      const reading = event as QiblaOrientationEvent;
      const rawHeading = typeof reading.webkitCompassHeading === "number"
        ? reading.webkitCompassHeading
        : reading.absolute && typeof reading.alpha === "number"
          ? 360 - reading.alpha
          : null;
      if (rawHeading === null || !Number.isFinite(rawHeading)) return;
      foundHeading = true;
      const nextHeading = normalizeDegrees(rawHeading);
      setHeading((previous) => {
        if (previous === null) return nextHeading;
        const difference = ((nextHeading - previous + 540) % 360) - 180;
        return normalizeDegrees(previous + difference * 0.28);
      });
      setMode("sensor");
      setStatusMessage("البوصلة متصلة. أبقِ الهاتف أفقيًا والشاشة إلى الأعلى.");
    };
    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
    };
  }, [sensorListening]);

  return createPortal(
    <div className={`qibla-overlay ${darkMode ? "is-dark" : ""}`} role="dialog" aria-modal="true" aria-labelledby="qibla-title">
      <button type="button" className="qibla-backdrop" aria-label="إغلاق نافذة القبلة" onClick={onClose} />
      <section className="qibla-sheet">
        <header className="qibla-header">
          <div className="qibla-header-icon"><Compass size={23} /></div>
          <div><span>بوصلة واتجاه القبلة</span><h2 id="qibla-title">اتجاه الكعبة</h2></div>
          <button type="button" className="qibla-close" aria-label="إغلاق" onClick={onClose}><X size={19} /></button>
        </header>
        <div className={`qibla-status qibla-status-${mode}`} role="status" aria-live="polite"><span className="qibla-status-dot" /><span>{statusMessage}</span></div>
        <div className="qibla-compass" aria-label={mode === "sensor" ? "بوصلة حية باتجاه القبلة" : "اتجاه القبلة من الشمال"}>
          <div className="qibla-compass-rose" style={{ transform: `rotate(${northRingAngle}deg)` }}>
            <span className="qibla-cardinal qibla-cardinal-north">ش</span><span className="qibla-cardinal qibla-cardinal-east">ق</span><span className="qibla-cardinal qibla-cardinal-south">ج</span><span className="qibla-cardinal qibla-cardinal-west">غ</span>
          </div>
          <div className="qibla-pointer" style={{ transform: `rotate(${arrowAngle}deg)` }}><span className="qibla-pointer-line" /><span className="qibla-kaaba-marker"><KaabaGlyph size={31} /></span></div>
          <span className="qibla-compass-center" />
        </div>
        <div className="qibla-bearing"><strong>{qiblaBearing.toFixed(1)}°</strong><span>زاوية القبلة من الشمال الجغرافي</span></div>
        <div className="qibla-location-note"><MapPin size={15} /><span>{position.source === "gps" ? "الموقع الحالي عبر GPS" : `موقع تقديري بحسب المدينة المحددة: ${city.city}`}{locationMessage ? ` — ${locationMessage}` : ""}</span></div>
        <p className="qibla-calibration-note">لأفضل دقة، أبقِ الهاتف أفقيًا وبعيدًا عن المعادن والمغناطيس، وحرّكه على شكل 8 إذا احتاجت البوصلة إلى معايرة.</p>
        {mode === "map" && <div className="qibla-map-fallback"><strong><MapPin size={17} /> وضع الخريطة الاحتياطي</strong><p>ستفتح خرائط Google موقعك والكعبة. زاوية القبلة أعلاه محسوبة مباشرة من الإحداثيات؛ وقد يعرض Google Maps طريقًا للمشي لا خط الاتجاه الجغرافي.</p><a href={mapsUrl.toString()} target="_blank" rel="noopener noreferrer"><Navigation size={17} /> فتح الاتجاه في Google Maps</a></div>}
        {mode === "ready" && <button type="button" className="qibla-primary-button" onClick={startQibla}><Compass size={18} /> ابدأ تحديد القبلة</button>}
        {mode === "waiting" && <button type="button" className="qibla-primary-button" disabled><span className="qibla-loading-dot" /> جارٍ تشغيل البوصلة…</button>}
        {mode === "map" && <button type="button" className="qibla-retry-button" onClick={startQibla}>إعادة محاولة الحساسات</button>}
        {mode === "sensor" && <div className="qibla-live-label"><span /> اتجاه الهاتف يتحدّث مباشرة</div>}
      </section>
    </div>,
    document.body,
  );
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCalendarMode, setHistoryCalendarMode] = useState<HistoryCalendarMode>("gregorian");
  const [historyAnchorDate, setHistoryAnchorDate] = useState(() => new Date());
  const [historyMonthLengthOverride, setHistoryMonthLengthOverride] = useState<29 | 30 | null>(() => {
    const saved = Number(localStorage.getItem("al-mosaly-hijri-month-length"));
    return saved === 29 || saved === 30 ? saved : null;
  });
  const [historyAdjustmentOpen, setHistoryAdjustmentOpen] = useState(false);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState("");
  const [qiblaOpen, setQiblaOpen] = useState(false);
  const [mosquesOpen, setMosquesOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [adhkarOpen, setAdhkarOpen] = useState(false);
  const [fortressOpen, setFortressOpen] = useState(false);
  const [fortressView, setFortressView] = useState<"root" | "prayer" | "qunut" | "illness" | "entries" | "empty">("root");
  const [fortressCategory, setFortressCategory] = useState<string | null>(null);
  const [fortressPrayerCategory, setFortressPrayerCategory] = useState<string | null>(null);
  const [fortressSelectedDhikr, setFortressSelectedDhikr] = useState<MorningDhikr | null>(null);
  const [fortressDhikrIndex, setFortressDhikrIndex] = useState(0);
  const [fortressSectionKey, setFortressSectionKey] = useState("");
  const [fortressDhikrLists, setFortressDhikrLists] = useState<Record<string, MorningDhikr[]>>(() => ({ ...fortressPrayerDhikrInitialLists }));
  const [fortressRootOrder, setFortressRootOrder] = useState<string[]>(() => fortressCategories.map((card) => card.title));
  const [fortressPrayerOrder, setFortressPrayerOrder] = useState<string[]>(() => prayerDhikrSections.map((card) => card.title));
  const [fortressArrangeMode, setFortressArrangeMode] = useState(false);
  const [fortressDraggedCardId, setFortressDraggedCardId] = useState<string | null>(null);
  const [cardCreateForFortress, setCardCreateForFortress] = useState(false);
  const [fortressIconParentSection, setFortressIconParentSection] = useState("root");
  const [customDhikrCards, setCustomDhikrCards] = useState<CustomDhikrCard[]>([]);
  const [adhkarArrangeMode, setAdhkarArrangeMode] = useState(false);
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [cardBackgroundOpen, setCardBackgroundOpen] = useState<string | null>(null);
  const [cardCreateOpen, setCardCreateOpen] = useState(false);
  const [customChildrenOpen, setCustomChildrenOpen] = useState(false);
  const [customCardHistory, setCustomCardHistory] = useState<string[]>([]);
  const [dhikrBannerMenuOpen, setDhikrBannerMenuOpen] = useState(false);
  const [dhikrBannerEditOpen, setDhikrBannerEditOpen] = useState(false);
  const [dhikrBannerText, setDhikrBannerText] = useState<Record<string, string>>({});
  const [dhikrBannerBackground, setDhikrBannerBackground] = useState<Record<string, string | undefined>>({});
  const [dhikrBannerDraft, setDhikrBannerDraft] = useState("");
  const [dhikrBannerBackgroundOpen, setDhikrBannerBackgroundOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("al-mosaly-dark-mode") === "true");
  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    return () => { document.documentElement.classList.remove("dark-mode"); document.body.classList.remove("dark-mode"); };
  }, [darkMode]);
  const [nestedArrangeParentId, setNestedArrangeParentId] = useState<string | null>(null);
  const [cardCreateMode, setCardCreateMode] = useState<"choice" | "icon" | "dhikr">("choice");
  const [customTitle, setCustomTitle] = useState("");
  const [customCaption, setCustomCaption] = useState("");
  const [customIconUrl, setCustomIconUrl] = useState("");
  const [customBackground, setCustomBackground] = useState("");
  const [customCardMode, setCustomCardMode] = useState<"icons" | "dhikrs" | null>(null);
  const [parentCardId, setParentCardId] = useState<string | null>(null);
  const [selectedCustomCardId, setSelectedCustomCardId] = useState<string | null>(null);
  const [customDhikrIndex, setCustomDhikrIndex] = useState(0);
  const [adhkarOrder, setAdhkarOrder] = useState<string[]>(() => adhkarCards.map((card) => card.title));
  const [adhkarBackgrounds, setAdhkarBackgrounds] = useState<Record<string, string | undefined>>({});
  const [sleepCategoriesOpen, setSleepCategoriesOpen] = useState(false);
  const [sleepDhikrIndex, setSleepDhikrIndex] = useState<number | null>(null);
  const [sleepDhikrMode, setSleepDhikrMode] = useState<"sleep" | "waking" | "misc">("sleep");
  const [sleepDhikrList, setSleepDhikrList] = useState<SleepDhikr[]>(sleepDhikrListInitial);
  const [wakingDhikrList, setWakingDhikrList] = useState<SleepDhikr[]>(wakingDhikrListInitial);
  const [miscellaneousDhikrList, setMiscellaneousDhikrList] = useState<SleepDhikr[]>(miscellaneousDhikrListInitial);
  const [activeDhikr, setActiveDhikr] = useState<string | null>(null);
  const [shortVersion, setShortVersion] = useState(false);
  const [parchmentMaximized, setParchmentMaximized] = useState(false);
  const [dhikrCount, setDhikrCount] = useState(0);
  const [counterStyle, setCounterStyle] = useState<"default" | "steampunk" | "lantern">(() => {
    const stored = localStorage.getItem("al-mosaly-counter-style");
    return stored === "steampunk" || stored === "lantern" ? stored : "default";
  });
  const [dhikrStyleOpen, setDhikrStyleOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<"text" | "title">("text");
  const [dhikrEditOpen, setDhikrEditOpen] = useState(false);
  const [dhikrEditTitle, setDhikrEditTitle] = useState("");
  const [dhikrEditText, setDhikrEditText] = useState("");
  const [dhikrEditSource, setDhikrEditSource] = useState("");
  const [dhikrEditReferences, setDhikrEditReferences] = useState("");
  const [dhikrEditCount, setDhikrEditCount] = useState("1");
  const [dhikrTypography, setDhikrTypography] = useState({ textSize: 21, titleSize: 18, lineHeight: 2, titleGap: 15, textColor: getDhikrThemeInk(defaultThemeId).text, titleColor: getDhikrThemeInk(defaultThemeId).title, bold: false, italic: false, underline: false });
  const [dhikrTextColorCustomized, setDhikrTextColorCustomized] = useState(false);
  const [dhikrTitleColorCustomized, setDhikrTitleColorCustomized] = useState(false);
  const setDhikrColor = (target: "text" | "title", color: string) => {
    if (target === "text") setDhikrTextColorCustomized(true);
    else setDhikrTitleColorCustomized(true);
    setDhikrTypography((value) => ({ ...value, [target === "text" ? "textColor" : "titleColor"]: color }));
  };
  const [dhikrContentOverflowing, setDhikrContentOverflowing] = useState(false);
  const parchmentScrollContentRef = useRef<HTMLDivElement | null>(null);
  const [morningDhikrIndex, setMorningDhikrIndex] = useState(0);
  const [tasbeehDhikrIndex, setTasbeehDhikrIndex] = useState(0);
  const [eveningDhikrIndex, setEveningDhikrIndex] = useState(0);
  const [homeEntryDhikrIndex, setHomeEntryDhikrIndex] = useState(0);
  const [homeExitDhikrIndex, setHomeExitDhikrIndex] = useState(0);
  const [wuduBeforeDhikrIndex, setWuduBeforeDhikrIndex] = useState(0);
  const [wuduAfterDhikrIndex, setWuduAfterDhikrIndex] = useState(0);
  const [foodDhikrIndex, setFoodDhikrIndex] = useState(0);
  const [continuationPromptOpen, setContinuationPromptOpen] = useState(false);
  const [continuePastTen, setContinuePastTen] = useState(false);
  const [audioCompletionPromptOpen, setAudioCompletionPromptOpen] = useState(false);
  const [audioRepeatMode, setAudioRepeatMode] = useState(false);
  const [morningDhikr, setMorningDhikr] = useState<MorningDhikr[]>(initialMorningDhikr);
  const [tasbeehDhikr, setTasbeehDhikr] = useState<MorningDhikr[]>(initialTasbeehDhikr);
  const [eveningDhikrList, setEveningDhikrList] = useState<MorningDhikr[]>(eveningDhikrListInitial);
  const [homeEntryDhikrList, setHomeEntryDhikrList] = useState<MorningDhikr[]>(homeEntryDhikrListInitial);
  const [homeExitDhikrList, setHomeExitDhikrList] = useState<MorningDhikr[]>(homeExitDhikrListInitial);
  const [wuduBeforeDhikrList, setWuduBeforeDhikrList] = useState<MorningDhikr[]>(wuduBeforeDhikrListInitial);
  const [wuduAfterDhikrList, setWuduAfterDhikrList] = useState<MorningDhikr[]>(wuduAfterDhikrListInitial);
  const [foodBeforeDhikrList, setFoodBeforeDhikrList] = useState<MorningDhikr[]>(foodBeforeDhikrListInitial);
  const [foodAfterDhikrList, setFoodAfterDhikrList] = useState<MorningDhikr[]>(foodAfterDhikrListInitial);
  const [addDhikrOpen, setAddDhikrOpen] = useState(false);
  const [newDhikrText, setNewDhikrText] = useState("");
  const [newDhikrTitle, setNewDhikrTitle] = useState("");
  const [newDhikrRank, setNewDhikrRank] = useState(String(initialMorningDhikr.length + 1));
  const [newDhikrCount, setNewDhikrCount] = useState("1");
  const [newDhikrSource, setNewDhikrSource] = useState("");
  const [newDhikrBenefit, setNewDhikrBenefit] = useState("");
  const [newDhikrNarrator, setNewDhikrNarrator] = useState("");
  const [expandedDhikr, setExpandedDhikr] = useState(false);
  const [browseBannerProgress, setBrowseBannerProgress] = useState(0);
  const [browseCounts, setBrowseCounts] = useState<Record<number, number>>({});
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([farisAbbadVoice]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [downloadedAudioIndexes, setDownloadedAudioIndexes] = useState<number[]>([]);
  const [voiceManagerOpen, setVoiceManagerOpen] = useState(false);
  const [voiceManagerView, setVoiceManagerView] = useState<"list" | "form">("list");
  const [voiceMenuOpen, setVoiceMenuOpen] = useState<string | null>(null);
  const [voiceChooserOpen, setVoiceChooserOpen] = useState(false);
  const [audioDownloadChoiceOpen, setAudioDownloadChoiceOpen] = useState(false);
  const [audioDownloadListOpen, setAudioDownloadListOpen] = useState(false);
  const [selectedAudioDownloads, setSelectedAudioDownloads] = useState<number[]>(() => Array.from({ length: 27 }, (_, index) => index));
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewStopTimerRef = useRef<number | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [voiceOriginalClipIds, setVoiceOriginalClipIds] = useState<string[]>([]);
  const [newReaderName, setNewReaderName] = useState("");
  const [newVoiceClips, setNewVoiceClips] = useState<AudioClip[]>([]);
  const [playingDhikr, setPlayingDhikr] = useState(false);
  const [dhikrPlayerOpen, setDhikrPlayerOpen] = useState(false);
  const [dhikrPlaybackProgress, setDhikrPlaybackProgress] = useState(0);
  const [dhikrPlaybackDuration, setDhikrPlaybackDuration] = useState(0);
  const [dhikrPlaybackRepeat, setDhikrPlaybackRepeat] = useState(0);
  const dhikrAudioRef = useRef<HTMLAudioElement | null>(null);
  const dhikrPlaybackSequenceRef = useRef(0);
  const dhikrPlaybackRepeatRef = useRef(0);
  const dhikrPlaybackTimerRef = useRef<number | null>(null);
  const audioRepeatModeRef = useRef(false);
  const restartDhikrFromBeginningRef = useRef(false);
  const browseCardRefs = useRef<Record<number, HTMLElement | null>>({});
  const browseScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [activePrayer, setActivePrayer] = useState("الفجر");
  const [prayerSelectionMode, setPrayerSelectionMode] = useState<"automatic" | "manual">("automatic");
  const prayerReturnTimerRef = useRef<number | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationMode, setLocationMode] = useState<"options" | "manual">("options");
  const [locationStep, setLocationStep] = useState<"country" | "city">("country");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySchedule>(defaultCity);
  const [locationStatus, setLocationStatus] = useState("");
  const [activePrayers, setActivePrayers] = useState<Prayer[]>(() => scheduleForCity(defaultCity, new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fajrAlarmOpen, setFajrAlarmOpen] = useState(false);
  const [fajrAlarmComposerOpen, setFajrAlarmComposerOpen] = useState(false);
  const [fajrAlarms, setFajrAlarms] = useState<FajrAlarm[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(fajrAlarmStorageKey) ?? "[]") as FajrAlarm[];
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === "string" && typeof item.time === "string") : [];
    } catch { return []; }
  });
  const [fajrAlarmDraft, setFajrAlarmDraft] = useState<FajrAlarm>(() => ({ id: "", time: "05:00", mode: "exact", minutesBeforeFajr: 30, days: [0, 1, 2, 3, 4, 5, 6], soundName: "نغمة النظام", puzzle: "none" }));
  const [fajrAlarmSound, setFajrAlarmSound] = useState<{ name: string; url: string } | null>(null);
  const [activeFajrAlarm, setActiveFajrAlarm] = useState<{ alarm: FajrAlarm; question: string; answer: string } | null>(null);
  const [fajrPuzzleAnswer, setFajrPuzzleAnswer] = useState("");
  const fajrAlarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const fajrAlarmFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => { try { localStorage.setItem(fajrAlarmStorageKey, JSON.stringify(fajrAlarms.map(({ soundUrl: _soundUrl, ...alarm }) => alarm))); } catch { /* storage may be unavailable */ } }, [fajrAlarms]);
  const [settingsView, setSettingsView] = useState<"root" | "general" | "themeCategories" | "themes" | "counter" | "adhan" | "sounds" | "alerts" | "adhkar">("root");
  const [themes, setThemes] = useState<ThemeDefinition[]>([defaultThemeDefinition]);
  const [themeId, setThemeId] = useState<ThemeId>(defaultThemeId);
  const [daylightSavingEnabled, setDaylightSavingEnabled] = useState(() => localStorage.getItem("al-mosaly-daylight-saving") !== "false");
  useEffect(() => {
    const palette = getDhikrThemeInk(themeId);
    setDhikrTypography((value) => ({
      ...value,
      textColor: dhikrTextColorCustomized ? value.textColor : getReadableDhikrColor(palette.text, themeId, "text"),
      titleColor: dhikrTitleColorCustomized ? value.titleColor : getReadableDhikrColor(palette.title, themeId, "title"),
    }));
  }, [themeId, dhikrTextColorCustomized, dhikrTitleColorCustomized]);
  const [adhkarSettingsView, setAdhkarSettingsView] = useState<"root" | "nawafil" | "friday" | "fasting" | "daily">("root");
  const [adhkarMasterEnabled, setAdhkarMasterEnabled] = useState(true);
  const [nawafilQiyamEnabled, setNawafilQiyamEnabled] = useState(false);
  const [qiyamMinutesBeforeFajr, setQiyamMinutesBeforeFajr] = useState(-125);
  const [duhaEnabled, setDuhaEnabled] = useState(false);
  const [duhaTime, setDuhaTime] = useState("10:00");
  const [fridayMasterEnabled, setFridayMasterEnabled] = useState(false);
  const [fridayDhikrEnabled, setFridayDhikrEnabled] = useState(false);
  const [fridayDhikrCount, setFridayDhikrCount] = useState(3);
  const [fridayDhikrTimes, setFridayDhikrTimes] = useState<string[]>(loadFridayDhikrTimes);
  const [fridayDhikrTimesOpen, setFridayDhikrTimesOpen] = useState(false);
  const [fridayAnswerEnabled, setFridayAnswerEnabled] = useState(false);
  const [fridayTakbeerEnabled, setFridayTakbeerEnabled] = useState(false);
  const [fastingMasterEnabled, setFastingMasterEnabled] = useState(false);
  const [mondayThursdayEnabled, setMondayThursdayEnabled] = useState(false);
  const [whiteDaysEnabled, setWhiteDaysEnabled] = useState(false);
  const [fastingBeforeFajrEnabled, setFastingBeforeFajrEnabled] = useState(false);
  const [fastingBeforeFajrMinutes, setFastingBeforeFajrMinutes] = useState(-30);
  const [fastingPreviousMaghribEnabled, setFastingPreviousMaghribEnabled] = useState(false);
  const [fastingPreviousMaghribMinutes, setFastingPreviousMaghribMinutes] = useState(-30);
  const [dailyMasterEnabled, setDailyMasterEnabled] = useState(false);
  const [eveningDhikrEnabled, setEveningDhikrEnabled] = useState(false);
  const [eveningBeforeMaghrib, setEveningBeforeMaghrib] = useState(true);
  const [eveningDhikrMinutes, setEveningDhikrMinutes] = useState(60);
  const [morningDhikrEnabled, setMorningDhikrEnabled] = useState(false);
  const [morningDhikrMinutes, setMorningDhikrMinutes] = useState(20);
  const [sleepDhikrListEnabled, setSleepDhikrEnabled] = useState(false);
  const [sleepDhikrListMinutes, setSleepDhikrMinutes] = useState(30);
  const [adhkarSoundMode, setAdhkarSoundMode] = useState<"normal" | "vibrate">("normal");
  const [adhkarSoundModal, setAdhkarSoundModal] = useState<"qiyam" | "duha" | "fridayDhikr" | "fridayAnswer" | "fridayTakbeer" | "fastingFajr" | "fastingMaghrib" | "evening" | "morning" | "sleep" | null>(null);
  const [adhkarSoundFiles, setAdhkarSoundFiles] = useState<Record<AdhkarSoundKind, UploadedSound[]>>({ qiyam: [], duha: [], fridayDhikr: [], fridayAnswer: [], fridayTakbeer: [], fastingFajr: [], fastingMaghrib: [], evening: [], morning: [], sleep: [] });
  const [selectedAdhkarSoundIds, setSelectedAdhkarSoundIds] = useState<Record<AdhkarSoundKind, string | null>>({ qiyam: null, duha: null, fridayDhikr: null, fridayAnswer: null, fridayTakbeer: null, fastingFajr: null, fastingMaghrib: null, evening: null, morning: null, sleep: null });
  const [alertsView, setAlertsView] = useState<"root" | "before" | "adjust" | "iqama">("root");
  const [weekdayConfig, setWeekdayConfig] = useState<{ prayer: string; kind: WeeklyAlertKind } | null>(null);
  const [adhanBackgroundEnabled, setAdhanBackgroundEnabled] = useState(false);
  const [adhanVideos, setAdhanVideos] = useState<UploadedVideo[]>([]);
  const [selectedAdhanVideoId, setSelectedAdhanVideoId] = useState<string | null>(null);
  const [adhanVideoPreviewId, setAdhanVideoPreviewId] = useState<string | null>(null);
  const [soundFiles, setSoundFiles] = useState<Record<PrayerSoundKind, UploadedSound[]>>({ before: [], adhan: [], iqama: [] });
  const [selectedSoundIds, setSelectedSoundIds] = useState<Record<PrayerSoundKind, string | null>>({ before: null, adhan: null, iqama: null });
  const [soundModal, setSoundModal] = useState<"before" | "adhan" | "iqama" | null>(null);
  const [backgroundModal, setBackgroundModal] = useState(false);
  const [adhanOverlayOpen, setAdhanOverlayOpen] = useState(false);
  const [adhanOverlayPrayer, setAdhanOverlayPrayer] = useState<string | null>(null);
  const adhanVideoRef = useRef<HTMLVideoElement>(null);
  const adhanOverlayVideoRef = useRef<HTMLVideoElement>(null);
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSound, setPlayingSound] = useState<"before" | "adhan" | "iqama" | null>(null);
  const [playingAdhkarSound, setPlayingAdhkarSound] = useState<keyof typeof adhkarSoundFiles | null>(null);
  const [activeSoundAlert, setActiveSoundAlert] = useState<{ kind: "adhan" | "iqama" | "before" | "adhkar"; title: string } | null>(null);
  const selectedAdhanVideo = adhanVideos.find((video) => video.id === selectedAdhanVideoId) ?? adhanVideos[0] ?? null;
  const adhanVideoUrl = selectedAdhanVideo?.url ?? null;
  const adhanVideoPreview = adhanVideos.find((video) => video.id === adhanVideoPreviewId) ?? null;
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const firedAlertsRef = useRef<Set<string>>(new Set());
  const firedAdhkarAlertsRef = useRef<Set<string>>(new Set());
  const notificationPermissionRequestedRef = useRef(false);
  const [preAlertEnabled, setPreAlertEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(prayerNames.map((name) => [name, false])));
  const [preAlertMinutes, setPreAlertMinutes] = useState<Record<string, number>>(() => Object.fromEntries(prayerNames.map((name) => [name, -15])));
  const [preAlertDrafts, setPreAlertDrafts] = useState<Record<string, string>>({});
  const [iqamaEnabled, setIqamaEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(prayerNames.map((name) => [name, false])));
  const [iqamaMinutes, setIqamaMinutes] = useState<Record<string, number>>(() => Object.fromEntries(prayerNames.map((name) => [name, 15])));
  const [iqamaWeekPlans, setIqamaWeekPlans] = useState<Record<string, IqamaWeekPlan>>(loadIqamaWeekPlans);
  useEffect(() => { try { localStorage.setItem(iqamaWeekPlansStorageKey, JSON.stringify(iqamaWeekPlans)); } catch { /* Keep the current session usable if storage is unavailable. */ } }, [iqamaWeekPlans]);
  const [beforeAlertWeekPlans, setBeforeAlertWeekPlans] = useState<Record<string, IqamaWeekPlan>>(() => loadPrayerWeekPlans(beforeAlertWeekPlansStorageKey, 15));
  useEffect(() => { try { localStorage.setItem(beforeAlertWeekPlansStorageKey, JSON.stringify(beforeAlertWeekPlans)); } catch { /* Keep the current session usable if storage is unavailable. */ } }, [beforeAlertWeekPlans]);
  const [prayerCorrectionWeekPlans, setPrayerCorrectionWeekPlans] = useState<Record<string, IqamaWeekPlan>>(() => loadPrayerWeekPlans(prayerCorrectionWeekPlansStorageKey, 0));
  useEffect(() => { try { localStorage.setItem(prayerCorrectionWeekPlansStorageKey, JSON.stringify(prayerCorrectionWeekPlans)); } catch { /* Keep the current session usable if storage is unavailable. */ } }, [prayerCorrectionWeekPlans]);
  const [prayerCorrectionDrafts, setPrayerCorrectionDrafts] = useState<Record<string, string>>({});

  const getPrayerWeekPlan = (kind: WeeklyAlertKind, prayer: string): IqamaWeekPlan => {
    if (kind === "before") return beforeAlertWeekPlans[prayer] ?? defaultIqamaWeekPlan(Math.abs(preAlertMinutes[prayer] ?? -15));
    if (kind === "adjust") return prayerCorrectionWeekPlans[prayer] ?? defaultIqamaWeekPlan(0);
    return iqamaWeekPlans[prayer] ?? defaultIqamaWeekPlan(iqamaMinutes[prayer] ?? 15);
  };
  const updatePrayerWeekPlan = (kind: WeeklyAlertKind, prayer: string, update: (plan: IqamaWeekPlan) => IqamaWeekPlan) => {
    if (kind === "before") setBeforeAlertWeekPlans((items) => ({ ...items, [prayer]: update(items[prayer] ?? defaultIqamaWeekPlan(Math.abs(preAlertMinutes[prayer] ?? -15))) }));
    else if (kind === "adjust") setPrayerCorrectionWeekPlans((items) => ({ ...items, [prayer]: update(items[prayer] ?? defaultIqamaWeekPlan(0)) }));
    else setIqamaWeekPlans((items) => ({ ...items, [prayer]: update(items[prayer] ?? defaultIqamaWeekPlan(iqamaMinutes[prayer] ?? 15)) }));
  };
  useEffect(() => {
    let cancelled = false;
    const restoreInstalledTheme = async () => {
      const availableThemes = await loadThemeCatalog();
      if (cancelled) return;
      setThemes(availableThemes);
      const stored = localStorage.getItem("al-mosaly-theme");
      const selected = availableThemes.find((theme) => theme.id === stored) ?? defaultThemeDefinition;
      try {
        await loadThemeStyles(selected.id);
        if (cancelled) return;
        setThemeId(selected.id);
        localStorage.setItem("al-mosaly-theme", selected.id);
      } catch {
        if (cancelled) return;
        setThemeId(defaultThemeId);
        localStorage.setItem("al-mosaly-theme", defaultThemeId);
      }
    };
    void restoreInstalledTheme();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>("#root .app-shell");
    if (!appShell) return;

    const themeTokens = [
      "--theme-bg",
      "--theme-surface",
      "--theme-surface-strong",
      "--theme-text",
      "--theme-muted",
      "--theme-accent",
      "--theme-accent-strong",
      "--theme-border",
      "--theme-glow",
    ] as const;
    const body = document.body;
    const previousValues = new Map<string, string>();
    const computedTheme = window.getComputedStyle(appShell);

    themeTokens.forEach((token) => {
      previousValues.set(token, body.style.getPropertyValue(token));
      const value = computedTheme.getPropertyValue(token).trim();
      if (value) body.style.setProperty(token, value);
    });

    return () => {
      themeTokens.forEach((token) => {
        const previous = previousValues.get(token);
        if (previous) body.style.setProperty(token, previous);
        else body.style.removeProperty(token);
      });
    };
  }, [themeId, darkMode]);
  const activeSleepDhikr = sleepDhikrMode === "sleep" ? sleepDhikrList : sleepDhikrMode === "waking" ? wakingDhikrList : miscellaneousDhikrList;
  const activeSleepTargetCounts = activeSleepDhikr.map((_item, index) => (sleepDhikrMode === "sleep" ? sleepTargetCounts : sleepDhikrMode === "waking" ? wakingTargetCounts : miscellaneousTargetCounts)[index] ?? 1);
  const findCustomCard = (items: CustomDhikrCard[], id: string): CustomDhikrCard | null => {
    for (const item of items) { if (item.id === id) return item; const nested = item.children ? findCustomCard(item.children, id) : null; if (nested) return nested; }
    return null;
  };
  const updateCustomCardById = (items: CustomDhikrCard[], id: string, update: (card: CustomDhikrCard) => CustomDhikrCard): CustomDhikrCard[] => items.map((item) => item.id === id ? update(item) : { ...item, children: item.children ? updateCustomCardById(item.children, id, update) : item.children });
  const activeNestedCustomCard = selectedCustomCardId && (activeDhikr?.startsWith("custom:") || customChildrenOpen) ? findCustomCard(customDhikrCards, selectedCustomCardId) : null;
  const activeCustomCard = activeNestedCustomCard;
  const goBackCustomCard = () => {
    const wasFortressCard = activeCustomCard?.scope === "fortress";
    if (customCardHistory.length) {
      const history = [...customCardHistory];
      const parentId = history.pop()!;
      setCustomCardHistory(history);
      setSelectedCustomCardId(parentId);
      setCustomChildrenOpen(true);
    } else {
      setCustomChildrenOpen(false);
      setSelectedCustomCardId(null);
      setCustomCardHistory([]);
      setActiveDhikr(null);
      setSleepDhikrIndex(null);
      setDhikrCount(0);
      setParchmentMaximized(false);
      if (wasFortressCard) {
        setFortressView("root");
        setFortressOpen(true);
      } else setAdhkarOpen(true);
    }
  };
  const orderedAdhkarCards = adhkarOrder.map((id) => adhkarCards.find((card) => card.title === id) ?? customDhikrCards.find((card) => card.id === id)).filter(Boolean) as Array<Feature | CustomDhikrCard>;
  useEffect(() => {
    const element = parchmentScrollContentRef.current;
    if (!element) return;
    const measureOverflow = () => setDhikrContentOverflowing(element.scrollHeight > element.clientHeight + 2);
    measureOverflow();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureOverflow) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [activeDhikr, customDhikrIndex, morningDhikrIndex, tasbeehDhikrIndex, tasbeehDhikr.length, eveningDhikrIndex, homeEntryDhikrIndex, homeExitDhikrIndex, sleepDhikrIndex, wuduBeforeDhikrIndex, foodDhikrIndex, shortVersion, expandedDhikr, parchmentMaximized, dhikrTypography.textSize, dhikrTypography.titleSize, dhikrTypography.lineHeight, dhikrTypography.titleGap, dhikrTypography.bold, dhikrTypography.italic, dhikrTypography.underline]);
  const activeFortressDhikrs = fortressPrayerCategory
    ? [...(fortressPrayerCategory === "أدعية استفتاح الصلاة" ? fortressOpeningDhikrs : []), ...(fortressDhikrLists[fortressSectionKey] ?? [])]
    : fortressSelectedDhikr ? [fortressSelectedDhikr] : [];
  const currentDhikr: MorningDhikr | null = activeDhikr === "حصن المسلم"
    ? activeFortressDhikrs[fortressDhikrIndex] ?? fortressSelectedDhikr
    : activeDhikr === "السبحة"
      ? tasbeehDhikr[tasbeehDhikrIndex]
    : activeDhikr === "أذكار الصباح"
    ? morningDhikr[morningDhikrIndex]
    : activeDhikr === "أذكار المساء"
      ? eveningDhikrList[eveningDhikrIndex]
      : activeDhikr === "دخول البيت"
        ? homeEntryDhikrList[homeEntryDhikrIndex]
        : activeDhikr === "الخروج من البيت"
          ? homeExitDhikrList[homeExitDhikrIndex]
          : activeDhikr === "أذكار الوضوء"
            ? (wuduBeforeDhikrIndex === 0 ? wuduBeforeDhikrList[0] : wuduAfterDhikrList[0])
            : activeDhikr === "أذكار الطعام"
              ? (foodDhikrIndex === 0 ? foodBeforeDhikrList[0] : foodAfterDhikrList[0])
              : (activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") && sleepDhikrIndex !== null
        ? { text: activeSleepDhikr[sleepDhikrIndex].text, targetCount: activeSleepTargetCounts[sleepDhikrIndex], source: activeSleepDhikr[sleepDhikrIndex].benefit, references: activeSleepDhikr[sleepDhikrIndex].reference, highlightSurahs: activeSleepDhikr[sleepDhikrIndex].highlightSurahs, title: activeSleepDhikr[sleepDhikrIndex].title, custom: activeSleepDhikr[sleepDhikrIndex].custom }
        : activeCustomCard
          ? activeCustomCard.dhikrs[customDhikrIndex] ?? null
          : null;
  const activeDhikrCopy = activeDhikr === "حصن المسلم" && fortressSelectedDhikr
    ? { title: isGenericNumberedDhikrTitle(fortressSelectedDhikr.title) ? fortressPrayerCategory ?? fortressCategory ?? "حصن المسلم" : fortressPrayerCategory && ["أذكار السفر", "أذكار الظواهر الكونية", "أذكار الخوف والفزع", "أذكار خاصة بالحيوانات"].includes(fortressPrayerCategory) ? fortressPrayerCategory : fortressSelectedDhikr.title ?? "حصن المسلم", intro: fortressPrayerCategory ?? "دعاء من حصن المسلم", text: "" }
    : activeCustomCard ? { title: activeCustomCard.title, intro: activeCustomCard.caption, text: "" } : dhikrCopy[activeDhikr ?? ""];
  const completedDhikrLabel = activeCustomCard
    ? `تم إكمال ${activeCustomCard.title}`
    : activeDhikr === "دخول البيت"
      ? "تم إكمال أذكار دخول البيت"
      : activeDhikr === "الخروج من البيت"
        ? "تم إكمال أذكار الخروج من البيت"
        : activeDhikr === "أذكار الوضوء"
          ? "تم إكمال أذكار الوضوء"
          : activeDhikr === "أذكار الطعام"
            ? "تم إكمال أذكار الطعام"
            : activeDhikr === "أذكار النوم"
              ? "تم إكمال أذكار النوم"
              : activeDhikr === "أذكار الاستيقاظ"
                ? "تم إكمال أذكار الاستيقاظ"
                : activeDhikr === "أذكار متنوعة"
                  ? "تم إكمال الأذكار المتنوعة"
                  : activeDhikr === "أذكار المساء"
                    ? "تم إكمال أذكار المساء"
                    : activeDhikr === "السبحة"
                    ? "تم إكمال أذكار السبحة"
                    : "تم إكمال أذكار الصباح";
  const activeBannerKey = activeDhikr?.startsWith("custom:") ? activeDhikr : (activeDhikr ?? "");
  const defaultBannerText = activeDhikr === "أذكار الاستيقاظ" ? "ابدأ يومك بذكر الله" : activeDhikrCopy?.intro ?? "وردك اليومي";
  const currentBannerText = dhikrBannerText[activeBannerKey] ?? defaultBannerText;
  const currentBannerBackground = dhikrBannerBackground[activeBannerKey];
  const cityDateLabels = getCityDateLabels(now, selectedCity);
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthLabel = new Intl.DateTimeFormat("ar-MA", { timeZone: selectedCity.timeZone, month: "long", year: "numeric" }).format(calendarMonth);
  const calendarDaysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const calendarFirstWeekday = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarDays = Array.from({ length: calendarFirstWeekday + calendarDaysInMonth }, (_, index) => {
    if (index < calendarFirstWeekday) return null;
    const day = index - calendarFirstWeekday + 1;
    const date = new Date(Date.UTC(calendarYear, calendarMonthIndex, day, 12));
    const schedule = getPrayerScheduleForCity(selectedCity, date, daylightSavingEnabled);
    const key = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const currentKey = new Intl.DateTimeFormat("en-CA", { timeZone: selectedCity.timeZone }).format(now);
    const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { timeZone: selectedCity.timeZone, day: "numeric", month: "long", year: "numeric" }).format(date);
    return { day, key, current: key === currentKey, schedule, hijri };
  });
  const historyCurrentKey = new Intl.DateTimeFormat("en-CA", { timeZone: selectedCity.timeZone }).format(now);
  const historyAnchorParts = new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(historyAnchorDate);
  const historyAnchorYear = Number(historyAnchorParts.find((part) => part.type === "year")?.value ?? now.getFullYear());
  const historyAnchorMonth = Number(historyAnchorParts.find((part) => part.type === "month")?.value ?? now.getMonth() + 1);
  const historyAnchorDay = Number(historyAnchorParts.find((part) => part.type === "day")?.value ?? now.getDate());
  const historyGregorianEntries = Array.from({ length: new Date(historyAnchorYear, historyAnchorMonth, 0).getDate() }, (_, index) => {
    const day = index + 1;
    return new Date(Date.UTC(historyAnchorYear, historyAnchorMonth - 1, day, 12));
  });
  const historyIslamicTarget = getIslamicParts(historyAnchorDate, selectedCity.timeZone);
  const detectedHistoryIslamicEntries = Array.from({ length: 121 }, (_, index) => new Date(historyAnchorDate.getTime() + (index - 60) * 86400000)).filter((date) => {
    const islamic = getIslamicParts(date, selectedCity.timeZone);
    return islamic.month === historyIslamicTarget.month && islamic.year === historyIslamicTarget.year;
  });
  const automaticHistoryMonthLength = detectedHistoryIslamicEntries.length === 30 ? 30 : 29;
  const historyMonthLength = historyMonthLengthOverride ?? automaticHistoryMonthLength;
  const historyIslamicMonthStart = detectedHistoryIslamicEntries[0] ?? historyAnchorDate;
  const historyIslamicEntries = Array.from({ length: historyMonthLength }, (_, index) => shiftDateByDays(historyIslamicMonthStart, index));
  const historyDates = historyCalendarMode === "gregorian" ? historyGregorianEntries : historyIslamicEntries;
  const historyDayEntries = historyDates.map((date, dateIndex) => {
    const gregorian = new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
    const gregorianYear = Number(gregorian.find((part) => part.type === "year")?.value ?? date.getUTCFullYear());
    const gregorianMonth = Number(gregorian.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1);
    const gregorianDay = Number(gregorian.find((part) => part.type === "day")?.value ?? date.getUTCDate());
    const rawIslamic = getIslamicParts(date, selectedCity.timeZone);
    const islamic = historyCalendarMode === "islamic"
      ? { ...rawIslamic, day: dateIndex + 1, month: historyIslamicTarget.month, year: historyIslamicTarget.year }
      : rawIslamic;
    const key = `${gregorianYear}-${String(gregorianMonth).padStart(2, "0")}-${String(gregorianDay).padStart(2, "0")}`;
    return {
      date, key, current: key === historyCurrentKey, gregorianYear, gregorianMonth, gregorianDay, islamic,
      events: islamicEvents.filter((event) => event.month === islamic.month && eventOccursOnIslamicDay(event, islamic.day)),
      hasMarkedEvent: islamicEvents.some((event) => event.month === islamic.month && event.day !== undefined && eventOccursOnIslamicDay(event, islamic.day)),
    };
  });
  const historyMonths = new Set(historyDayEntries.map((entry) => entry.islamic.month));
  const historyMonthEvents = islamicEvents.filter((event, index, events) => historyMonths.has(event.month)
    && events.findIndex((candidate) => candidate.month === event.month && candidate.day === event.day && candidate.endDay === event.endDay && candidate.title === event.title) === index);
  const historyFirstWeekday = historyDayEntries[0]?.date.getUTCDay() ?? 0;
  const historyCalendarDays = Array.from({ length: historyFirstWeekday + historyDayEntries.length }, (_, index) => (
    index < historyFirstWeekday ? null : historyDayEntries[index - historyFirstWeekday]
  ));
  const selectedHistoryEntry = historyDayEntries.find((entry) => entry.key === selectedHistoryKey)
    ?? historyDayEntries.find((entry) => entry.current)
    ?? historyDayEntries[0];
  const historyHijriYears = Array.from(new Set(historyDayEntries.map((entry) => entry.islamic.year)));
  const historyGregorianYears = Array.from(new Set(historyDayEntries.map((entry) => entry.gregorianYear)));
  const historyMonthLabel = historyCalendarMode === "gregorian"
    ? new Intl.DateTimeFormat("ar-MA", { timeZone: selectedCity.timeZone, month: "long", year: "numeric" }).format(historyAnchorDate)
    : new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { timeZone: selectedCity.timeZone, month: "long", year: "numeric" }).format(historyAnchorDate);
  const historyPreviousMonth = () => {
    if (historyCalendarMode === "gregorian") {
      setHistoryAnchorDate(new Date(Date.UTC(historyAnchorYear, historyAnchorMonth - 2, 15, 12)));
    } else if (historyDayEntries[0]) {
      setHistoryAnchorDate(new Date(historyDayEntries[0].date.getTime() - 2 * 86400000));
    }
    setSelectedHistoryKey("");
  };
  const historyNextMonth = () => {
    if (historyCalendarMode === "gregorian") {
      setHistoryAnchorDate(new Date(Date.UTC(historyAnchorYear, historyAnchorMonth, 15, 12)));
    } else if (historyDayEntries[historyDayEntries.length - 1]) {
      setHistoryAnchorDate(new Date(historyDayEntries[historyDayEntries.length - 1].date.getTime() + 2 * 86400000));
    }
    setSelectedHistoryKey("");
  };
  const setHistoryMonthLength = (length: 29 | 30) => {
    localStorage.setItem("al-mosaly-hijri-month-length", String(length));
    setHistoryMonthLengthOverride(length);
    setSelectedHistoryKey("");
  };
  const resetHistoryMonthLength = () => {
    localStorage.removeItem("al-mosaly-hijri-month-length");
    setHistoryMonthLengthOverride(null);
    setSelectedHistoryKey("");
  };
  const openHistory = () => {
    setHistoryAnchorDate(now);
    setHistoryCalendarMode("gregorian");
    setSelectedHistoryKey(historyCurrentKey);
    setHistoryOpen(true);
  };
  const openCalendar = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, year: "numeric", month: "numeric" }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear());
    const month = Number(parts.find((part) => part.type === "month")?.value ?? new Date().getMonth() + 1);
    setCalendarMonth(new Date(year, month - 1, 1));
    setCalendarOpen(true);
  };
  const nightTimes = getNightTimesForCity(selectedCity, now, daylightSavingEnabled);
  const dhikrTargetCount = currentDhikr?.targetCount ?? 1;
  const counterTargetCount = currentDhikr?.continuationPrompt && !continuePastTen ? 10 : dhikrTargetCount;
  const counterProgress = Math.min(100, Math.max(0, (dhikrCount / Math.max(1, counterTargetCount)) * 100));
  const displayedSource = activeDhikr === "أذكار الصباح"
    ? currentDhikr?.source
    : currentDhikr?.source ?? dhikrCopy[activeDhikr ?? ""]?.source;
  const displayedReferences = currentDhikr?.references ?? dhikrCopy[activeDhikr ?? ""]?.references;
  const activeSpecialSequence = activeDhikr === "دخول البيت" ? homeEntryDhikrList : activeDhikr === "الخروج من البيت" ? homeExitDhikrList : activeDhikr === "أذكار الوضوء" ? [...wuduBeforeDhikrList, ...wuduAfterDhikrList] : activeDhikr === "أذكار الطعام" ? [...foodBeforeDhikrList, ...foodAfterDhikrList] : null;
  const activeSpecialIndex = activeDhikr === "دخول البيت" ? homeEntryDhikrIndex : activeDhikr === "الخروج من البيت" ? homeExitDhikrIndex : activeDhikr === "أذكار الوضوء" ? wuduBeforeDhikrIndex : activeDhikr === "أذكار الطعام" ? foodDhikrIndex : null;
  const activeSequenceIndex = activeDhikr === "حصن المسلم" ? fortressDhikrIndex : activeSpecialSequence ? activeSpecialIndex : activeDhikr === "أذكار المساء" ? eveningDhikrIndex : activeDhikr === "السبحة" ? tasbeehDhikrIndex : activeDhikr === "أذكار الصباح" ? morningDhikrIndex : activeCustomCard ? customDhikrIndex : sleepDhikrIndex;
  const activeSequenceLength = activeDhikr === "حصن المسلم" ? activeFortressDhikrs.length : activeSpecialSequence?.length ?? (activeDhikr === "أذكار المساء" ? eveningDhikrList.length : activeDhikr === "السبحة" ? tasbeehDhikr.length : activeDhikr === "أذكار الصباح" ? morningDhikr.length : activeCustomCard ? activeCustomCard.dhikrs.length : activeSleepDhikr.length);
  const browseDhikrs = activeDhikr === "حصن المسلم" ? activeFortressDhikrs : activeSpecialSequence ?? (activeDhikr === "أذكار المساء" ? eveningDhikrList : activeDhikr === "السبحة" ? tasbeehDhikr : activeDhikr === "أذكار الصباح" ? morningDhikr : activeCustomCard ? activeCustomCard.dhikrs : activeSleepDhikr);
  const voiceScope = activeDhikr === "حصن المسلم"
    ? `حصن المسلم:${fortressSectionKey}`
    : activeDhikr ?? "أذكار الصباح";
  const scopedVoiceProfiles = voiceProfiles.filter((profile) => profile.scope === voiceScope);
  const selectedVoice = activeDhikr
    ? scopedVoiceProfiles.find((profile) => profile.id === selectedVoiceId) ?? null
    : null;
  const sequenceIndex = activeSequenceIndex ?? 0;
  // التحميل اختياري ولا يجب أن يمنع تشغيل المقاطع من الإنترنت أو من الجهاز.
  const activeClip = selectedVoice?.clips[sequenceIndex] ?? null;
  const clipForDhikr = (index: number) => selectedVoice?.clips[index] ?? null;

  useEffect(() => {
    return () => { dhikrAudioRef.current?.pause(); voiceProfiles.forEach((profile) => profile.clips.forEach((clip) => URL.revokeObjectURL(clip.url))); };
  }, []);

  useEffect(() => {
    if (!activeDhikr) closeDhikrPlayer();
    setSelectedVoiceId(null);
    setParchmentMaximized(false);
    setBrowseBannerProgress(0);
    setBrowseCounts({});
  }, [activeDhikr]);

  useEffect(() => {
    if (expandedDhikr) setBrowseBannerProgress(0);
  }, [expandedDhikr]);

  useEffect(() => {
    if (!cardMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".adhkar-card-menu") && !target.closest(".adhkar-card-menu-button")) setCardMenuOpen(null);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [cardMenuOpen]);

  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const timer = window.setInterval(refreshNow, 1000);
    document.addEventListener("visibilitychange", refreshNow);
    window.addEventListener("focus", refreshNow);
    window.addEventListener("pageshow", refreshNow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshNow);
      window.removeEventListener("focus", refreshNow);
      window.removeEventListener("pageshow", refreshNow);
    };
  }, []);

  useEffect(() => () => {
    if (prayerReturnTimerRef.current !== null) window.clearTimeout(prayerReturnTimerRef.current);
  }, []);

  const prayerStatus = useMemo(() => {
    const cityClock = getCityClock(now, selectedCity, daylightSavingEnabled);
    const currentSeconds = cityClock.hours * 3600 + cityClock.minutes * 60 + cityClock.seconds;
    const schedule = activePrayers.map((prayer) => ({ ...prayer, seconds: prayer.minuteOfDay * 60 }));
    const recentlyCalledPrayer = schedule.find((prayer) => currentSeconds >= prayer.seconds && currentSeconds < prayer.seconds + 40 * 60);
    const automaticPrayer = recentlyCalledPrayer ?? schedule.find((prayer) => prayer.seconds > currentSeconds) ?? schedule[0];
    const selectedPrayer = activePrayers.find((prayer) => prayer.arabic === activePrayer) ?? automaticPrayer;
    const selectedSeconds = selectedPrayer.minuteOfDay * 60;
    const automaticElapsed = Boolean(recentlyCalledPrayer);
    const automaticDifference = automaticElapsed
      ? currentSeconds - automaticPrayer.seconds
      : (automaticPrayer.seconds - currentSeconds + 24 * 60 * 60) % (24 * 60 * 60);
    const manualElapsed = currentSeconds >= selectedSeconds;
    const manualDifference = manualElapsed ? currentSeconds - selectedSeconds : selectedSeconds - currentSeconds;
    const elapsed = prayerSelectionMode === "automatic" ? automaticElapsed : manualElapsed;
    const difference = prayerSelectionMode === "automatic" ? automaticDifference : manualDifference;
    const duration = formatDuration((difference + 24 * 60 * 60) % (24 * 60 * 60));
    return { automaticPrayer, selectedPrayer, elapsed, duration };
  }, [activePrayer, activePrayers, daylightSavingEnabled, now, prayerSelectionMode, selectedCity]);
  const automaticPrayerNameRef = useRef(prayerStatus.automaticPrayer.arabic);
  automaticPrayerNameRef.current = prayerStatus.automaticPrayer.arabic;
  const cityClock = getCityClock(now, selectedCity, daylightSavingEnabled);
  const currentCitySeconds = cityClock.hours * 3600 + cityClock.minutes * 60 + cityClock.seconds;

  useEffect(() => {
    setActivePrayer(prayerStatus.automaticPrayer.arabic);
    setPrayerSelectionMode("automatic");
  }, [prayerStatus.automaticPrayer.arabic]);

  const notify = (message: string) => toast(message, { className: "arabic-toast" });

  const selectPrayerManually = (prayer: Prayer) => {
    setActivePrayer(prayer.arabic);
    setPrayerSelectionMode("manual");
    notify(`${prayer.arabic}: ${prayer.arabic === prayerStatus.automaticPrayer.arabic ? (prayerStatus.elapsed ? "مضى على الأذان" : "الصلاة القادمة") : "تم اختيار الصلاة"}`);
    if (prayerReturnTimerRef.current !== null) window.clearTimeout(prayerReturnTimerRef.current);
    prayerReturnTimerRef.current = window.setTimeout(() => {
      setActivePrayer(automaticPrayerNameRef.current);
      setPrayerSelectionMode("automatic");
      prayerReturnTimerRef.current = null;
    }, 3000);
  };

  const correctedScheduleForCity = (city: CitySchedule, date: Date) => {
    const weekdayIndex = getWeekdayIndexInTimeZone(date, city.timeZone);
    return scheduleForCity(city, date, daylightSavingEnabled).map((prayer) => {
      const weekPlan = prayerCorrectionWeekPlans[prayer.arabic] ?? defaultIqamaWeekPlan(0);
      const correction = weekPlan.enabledDays.includes(weekdayIndex) ? weekPlan.minutesByDay[weekdayIndex] ?? 0 : 0;
      const minuteOfDay = ((prayer.minuteOfDay + correction) % 1440 + 1440) % 1440;
      const hour = Math.floor(minuteOfDay / 60) % 12 || 12;
      return { ...prayer, minuteOfDay, time: `${hour.toString().padStart(2, "0")}:${(minuteOfDay % 60).toString().padStart(2, "0")}` };
    });
  };

  useEffect(() => {
    setActivePrayers(correctedScheduleForCity(selectedCity, now));
  }, [selectedCity, prayerCorrectionWeekPlans, cityDateLabels.dateLabel, daylightSavingEnabled]);

  const requestNotificationPermission = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "default" || notificationPermissionRequestedRef.current) return;
    notificationPermissionRequestedRef.current = true;
    void Notification.requestPermission();
  };

  const openAdhkarFromNotification = (kind: "morning" | "evening" | "sleep") => {
    setSettingsOpen(false);
    setSleepCategoriesOpen(false);
    setAdhkarOpen(false);
    setShortVersion(false);
    setDhikrCount(0);
    setContinuationPromptOpen(false);
    setExpandedDhikr(false);
    if (kind === "morning") {
      setMorningDhikrIndex(0);
      setActiveDhikr("أذكار الصباح");
    } else if (kind === "evening") {
      setEveningDhikrIndex(0);
      setActiveDhikr("أذكار المساء");
    } else {
      setSleepDhikrIndex(0);
      setSleepDhikrMode("sleep");
      setActiveDhikr("أذكار النوم");
    }
  };

  const playConfiguredSound = (kind: "before" | "adhan" | "iqama", message: string) => {
    const sound = soundFiles[kind].find((item) => item.id === selectedSoundIds[kind]);
    notify(message);
    showPrayerNotification(kind === "iqama" ? "تنبيه الإقامة" : kind === "before" ? "تنبيه قبل الصلاة" : "تنبيه الصلاة", message, `prayer-alert-${kind}-${message}`);
    if (!sound) return;
    setActiveSoundAlert({ kind, title: message });
    audioPlaybackRef.current?.pause();
    const audio = new Audio(sound.url);
    audio.preload = "auto";
    audioPlaybackRef.current = audio;
    audio.onended = () => {
      if (audioPlaybackRef.current === audio) { audioPlaybackRef.current = null; setActiveSoundAlert(null); }
    };
    void audio.play().catch(() => notify("تعذر تشغيل الصوت تلقائياً؛ اضغط اختبار الصوت أو اسمح بالصوت في المتصفح"));
  };

  const playAdhkarAlert = (id: string, title: string, message: string, soundKey: keyof typeof adhkarSoundFiles, target: "morning" | "evening" | "sleep" | null = null) => {
    if (firedAdhkarAlertsRef.current.has(id)) return;
    firedAdhkarAlertsRef.current.add(id);
    const configured = adhkarSoundFiles[soundKey].find((item) => item.id === selectedAdhkarSoundIds[soundKey]);
    notify(message);
    setActiveSoundAlert({ kind: "adhkar", title });
    if (configured && adhkarSoundMode === "normal") {
      audioPlaybackRef.current?.pause();
      const audio = new Audio(configured.url);
      audio.preload = "auto";
      audioPlaybackRef.current = audio;
      audio.onended = () => { if (audioPlaybackRef.current === audio) { audioPlaybackRef.current = null; setActiveSoundAlert(null); } };
      void audio.play().catch(() => notify("تم عرض الإشعار، لكن يحتاج المتصفح إلى السماح بتشغيل الصوت"));
    } else if (adhkarSoundMode === "vibrate" && navigator.vibrate) {
      navigator.vibrate([250, 120, 250]);
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const notification = new Notification(title, { body: message, tag: id });
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (target) openAdhkarFromNotification(target);
      };
    }
  };

  const getIslamicDay = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic", { timeZone: selectedCity.timeZone, day: "numeric" }).formatToParts(date);
    return Number(parts.find((part) => part.type === "day")?.value ?? 0);
  };

  const getCityWeekday = (date: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, weekday: "short" }).format(date) === "Fri" ? 5 : new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, weekday: "short" }).format(date) === "Mon" ? 1 : new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, weekday: "short" }).format(date) === "Thu" ? 4 : 0);

  const getMinutesForTime = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours * 60 + minutes) % 1440;
  };
  const updateFridayDhikrCount = (nextCount: number) => {
    const count = Math.max(1, Math.min(24, Math.floor(nextCount) || 1));
    setFridayDhikrCount(count);
    setFridayDhikrTimes((current) => Array.from({ length: count }, (_, index) => current[index] ?? defaultFridayDhikrTime(index)));
  };
  const formatFridayDhikrTimes = (times: string[]) => times.map((time) => formatPrayerClock(getMinutesForTime(time))).join("، ");
  useEffect(() => {
    localStorage.setItem(fridayDhikrTimesStorageKey, JSON.stringify(fridayDhikrTimes));
  }, [fridayDhikrTimes]);

  useEffect(() => {
    const cityClock = getCityClock(now, selectedCity, daylightSavingEnabled);
    const currentMinute = cityClock.hours * 60 + cityClock.minutes;
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: selectedCity.timeZone }).format(now);
    const fajr = activePrayers.find((prayer) => prayer.arabic === "الفجر")?.minuteOfDay ?? 300;
    const maghrib = activePrayers.find((prayer) => prayer.arabic === "المغرب")?.minuteOfDay ?? 1200;
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: selectedCity.timeZone, weekday: "short" }).format(now);
    // The Friday reminder window follows the Islamic day: Thursday Maghrib to Friday Maghrib.
    const isFridayWindow = (weekday === "Thu" && currentMinute >= maghrib) || (weekday === "Fri" && currentMinute < maghrib);
    const islamicDay = getIslamicDay(now);
    const isFastingDay = mondayThursdayEnabled && (weekday === "Mon" || weekday === "Thu");
    const isWhiteDay = whiteDaysEnabled && islamicDay >= 13 && islamicDay <= 15;
    // Evening intention reminders belong to the night before the fast:
    // Sunday/Wednesday for Monday/Thursday, and Hijri 12–14 for white days.
    const isMondayThursdayIntentionEvening = mondayThursdayEnabled && (weekday === "Sun" || weekday === "Wed");
    const isWhiteDayIntentionEvening = whiteDaysEnabled && islamicDay >= 12 && islamicDay <= 14;
    // Browser timers can be throttled in background tabs. Treat an event as due for
    // 90 seconds after its scheduled instant, and de-duplicate it with its day key.
    const matches = (minute: number) => {
      const scheduledSeconds = ((minute % 1440) + 1440) % 1440 * 60;
      const currentSeconds = currentMinute * 60 + cityClock.seconds;
      const elapsedSeconds = (currentSeconds - scheduledSeconds + 86400) % 86400;
      return elapsedSeconds <= 90;
    };
    const alert = (suffix: string, minute: number, title: string, message: string, sound: keyof typeof adhkarSoundFiles, target: "morning" | "evening" | "sleep" | null = null) => {
      if (matches(minute)) playAdhkarAlert(`${dayKey}-${suffix}`, title, message, sound, target);
    };

    if (adhkarMasterEnabled) {
      if (nawafilQiyamEnabled) alert("qiyam", fajr + qiyamMinutesBeforeFajr, "تنبيه صلاة القيام", `اقترب وقت صلاة القيام، قبل الفجر بـ ${Math.abs(qiyamMinutesBeforeFajr)} دقيقة`, "qiyam", "sleep");
      if (duhaEnabled) alert("duha", getMinutesForTime(duhaTime), "تنبيه صلاة الضحى", "حان وقت صلاة الضحى", "duha");
      if (dailyMasterEnabled) {
        if (morningDhikrEnabled) alert("morning", fajr + morningDhikrMinutes, "أذكار الصباح", "حان وقت أذكار الصباح", "morning", "morning");
        if (eveningDhikrEnabled) alert("evening", maghrib + (eveningBeforeMaghrib ? -eveningDhikrMinutes : eveningDhikrMinutes), "أذكار المساء", "حان وقت أذكار المساء", "evening", "evening");
        if (sleepDhikrListEnabled) alert("sleep", (activePrayers.find((prayer) => prayer.arabic === "العشاء")?.minuteOfDay ?? 1260) + sleepDhikrListMinutes, "أذكار النوم", "حان وقت أذكار النوم", "sleep", "sleep");
      }
      if (fridayMasterEnabled && isFridayWindow) {
        if (fridayDhikrEnabled && fridayDhikrCount > 0) {
          for (let index = 0; index < fridayDhikrCount; index += 1) {
            const configuredTime = fridayDhikrTimes[index] ?? defaultFridayDhikrTime(index);
            alert(`friday-dhikr-${index}`, getMinutesForTime(configuredTime), `تذكير الصلاة على النبي ﷺ رقم ${index + 1}`, "أكثر من الصلاة على النبي ﷺ", "fridayDhikr");
          }
        }
        if (fridayAnswerEnabled) alert("friday-answer", 17 * 60 + 30, "ساعة الإجابة", "تذكير بساعة الإجابة يوم الجمعة", "fridayAnswer");
        if (fridayTakbeerEnabled) alert("friday-takbeer", 11 * 60, "تكبير الجمعة", "استعد لصلاة الجمعة", "fridayTakbeer");
      }
      if (fastingMasterEnabled) {
        if (fastingBeforeFajrEnabled && (isFastingDay || isWhiteDay)) alert("fasting-fajr", fajr + fastingBeforeFajrMinutes, "تنبيه الصيام", "اقترب وقت الفجر، تذكير بنية الصيام", "fastingFajr");
        if (fastingPreviousMaghribEnabled && (isMondayThursdayIntentionEvening || isWhiteDayIntentionEvening)) alert("fasting-maghrib", maghrib + fastingPreviousMaghribMinutes, "تنبيه الصيام", "تذكير بنية صيام الغد", "fastingMaghrib");
      }
    }
    if (firedAdhkarAlertsRef.current.size > 300) firedAdhkarAlertsRef.current.clear();
  }, [now, selectedCity, daylightSavingEnabled, activePrayers, adhkarMasterEnabled, nawafilQiyamEnabled, qiyamMinutesBeforeFajr, duhaEnabled, duhaTime, dailyMasterEnabled, morningDhikrEnabled, morningDhikrMinutes, eveningDhikrEnabled, eveningBeforeMaghrib, eveningDhikrMinutes, sleepDhikrListEnabled, sleepDhikrListMinutes, fridayMasterEnabled, fridayDhikrEnabled, fridayDhikrCount, fridayDhikrTimes, fridayAnswerEnabled, fridayTakbeerEnabled, fastingMasterEnabled, mondayThursdayEnabled, whiteDaysEnabled, fastingBeforeFajrEnabled, fastingBeforeFajrMinutes, fastingPreviousMaghribEnabled, fastingPreviousMaghribMinutes, adhkarSoundFiles, selectedAdhkarSoundIds, adhkarSoundMode]);

  useEffect(() => {
    const cityClock = getCityClock(now, selectedCity, daylightSavingEnabled);
    const currentMinute = cityClock.hours * 60 + cityClock.minutes;
    const currentDay = new Intl.DateTimeFormat("en-CA", { timeZone: selectedCity.timeZone }).format(now);
    const weekdayIndex = getWeekdayIndexInTimeZone(now, selectedCity.timeZone);

    activePrayers.forEach((prayer) => {
      const prayerMinute = prayer.minuteOfDay;
      const dayOffset = prayerMinute < currentMinute - 720 ? 1 : 0;
      const alertKey = `${selectedCity.city}-${currentDay}-${prayer.arabic}`;
      const weekPlan = iqamaWeekPlans[prayer.arabic] ?? defaultIqamaWeekPlan(iqamaMinutes[prayer.arabic] ?? 15);
      const iqamaDelay = weekPlan.minutesByDay[weekdayIndex] ?? iqamaMinutes[prayer.arabic] ?? 15;

      const scheduledSeconds = ((prayerMinute % 1440) + 1440) % 1440 * 60;
      const currentSeconds = currentMinute * 60 + cityClock.seconds;
      const secondsSincePrayer = (currentSeconds - scheduledSeconds + 86400) % 86400;
      if (secondsSincePrayer <= 90 && !firedAlertsRef.current.has(`${alertKey}-adhan`)) {
        firedAlertsRef.current.add(`${alertKey}-adhan`);
        playAdhanExperience(prayer);
      }

      const iqamaSecondsSinceDue = (currentSeconds - (((prayerMinute + iqamaDelay) % 1440 + 1440) % 1440) * 60 + 86400) % 86400;
      if (iqamaEnabled[prayer.arabic] && weekPlan.enabledDays.includes(weekdayIndex) && iqamaSecondsSinceDue <= 90 && !firedAlertsRef.current.has(`${alertKey}-iqama`)) {
        firedAlertsRef.current.add(`${alertKey}-iqama`);
        playConfiguredSound("iqama", `حان وقت إقامة ${prayer.arabic}`);
      }

      const beforeWeekPlan = beforeAlertWeekPlans[prayer.arabic] ?? defaultIqamaWeekPlan(Math.abs(preAlertMinutes[prayer.arabic] ?? -15));
      if (preAlertEnabled[prayer.arabic] && beforeWeekPlan.enabledDays.includes(weekdayIndex)) {
        const minutesBefore = Math.abs(beforeWeekPlan.minutesByDay[weekdayIndex] ?? preAlertMinutes[prayer.arabic] ?? 15);
        const alertMinute = (prayerMinute - minutesBefore + 1440) % 1440;
        const beforeSecondsSinceDue = (currentSeconds - alertMinute * 60 + 86400) % 86400;
        if (beforeSecondsSinceDue <= 90 && !firedAlertsRef.current.has(`${alertKey}-before`)) {
          firedAlertsRef.current.add(`${alertKey}-before`);
          playConfiguredSound("before", `تبقى ${minutesBefore} دقيقة على أذان ${prayer.arabic}`);
        }
      }

      // Keep the key calculation tied to the current local day and avoid an ever-growing set.
      if (dayOffset > 0) firedAlertsRef.current.delete(`${alertKey}-before`);
    });

    if (firedAlertsRef.current.size > 100) firedAlertsRef.current.clear();
  }, [now, selectedCity, daylightSavingEnabled, activePrayers, preAlertEnabled, preAlertMinutes, beforeAlertWeekPlans, iqamaEnabled, iqamaMinutes, iqamaWeekPlans, soundFiles, adhanBackgroundEnabled, adhanVideoUrl]);

  const makeFajrPuzzle = (mode: FajrPuzzleMode, customQuestion?: string, customAnswer?: string) => {
    if (mode === "customMath") return { question: customQuestion?.trim() || "اكتب إجابة اللغز", answer: (customAnswer ?? "").trim() };
    if (mode === "sequence") return { question: "ما العدد التالي؟ 2، 4، 8، 16، ؟", answer: "32" };
    if (mode === "randomMath") { const a = 7 + Math.floor(Math.random() * 9); const b = 3 + Math.floor(Math.random() * 8); return { question: `احسب: ${a} + ${b} = ؟`, answer: String(a + b) }; }
    return { question: "", answer: "" };
  };
  const saveFajrAlarm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fajrAlarmDraft.days.length === 0) { notify("اختر يوماً واحداً على الأقل"); return; }
    const puzzle = makeFajrPuzzle(fajrAlarmDraft.puzzle, fajrAlarmDraft.puzzleQuestion, fajrAlarmDraft.puzzleAnswer);
    const alarm: FajrAlarm = { ...fajrAlarmDraft, id: fajrAlarmDraft.id || `fajr-${Date.now()}`, puzzleQuestion: puzzle.question, puzzleAnswer: puzzle.answer, soundName: fajrAlarmSound?.name ?? fajrAlarmDraft.soundName, soundUrl: fajrAlarmSound?.url };
    setFajrAlarms((items) => [...items, alarm]);
    setFajrAlarmComposerOpen(false);
    setFajrAlarmSound(null);
    notify("تم حفظ منبه الفجر");
  };
  const triggerFajrAlarm = (alarm: FajrAlarm, dayKey: string) => {
    const puzzle = alarm.puzzleQuestion && alarm.puzzleAnswer
      ? { question: alarm.puzzleQuestion, answer: alarm.puzzleAnswer }
      : makeFajrPuzzle(alarm.puzzle, alarm.puzzleQuestion, alarm.puzzleAnswer);
    setActiveFajrAlarm({ alarm, question: puzzle.question, answer: puzzle.answer });
    setFajrPuzzleAnswer("");
    fajrAlarmAudioRef.current?.pause();
    const audio = alarm.soundUrl ? new Audio(alarm.soundUrl) : null;
    fajrAlarmAudioRef.current = audio;
    if (audio) { audio.loop = true; void audio.play().catch(() => undefined); }
    notify(`حان وقت منبه الفجر${alarm.puzzle !== "none" ? " — يجب حل اللغز لإيقافه" : ""}`);
    showPrayerNotification("منبه الفجر", alarm.puzzle !== "none" ? "حل اللغز لإيقاف التنبيه" : "حان وقت منبه الفجر", `fajr-alarm-${dayKey}-${alarm.id}`);
  };
  const dismissFajrAlarm = () => { fajrAlarmAudioRef.current?.pause(); fajrAlarmAudioRef.current = null; setActiveFajrAlarm(null); setFajrPuzzleAnswer(""); };
  useEffect(() => {
    if (activeFajrAlarm) return;
    const clock = getCityClock(now, selectedCity, daylightSavingEnabled);
    const currentMinute = clock.hours * 60 + clock.minutes;
    const weekday = getWeekdayIndexInTimeZone(now, selectedCity.timeZone);
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: selectedCity.timeZone }).format(now);
    const fajr = activePrayers.find((prayer) => prayer.arabic === "الفجر")?.minuteOfDay ?? 300;
    fajrAlarms.forEach((alarm) => {
      const target = alarm.mode === "beforeFajr" ? fajr - Math.max(1, alarm.minutesBeforeFajr) : getMinutesForTime(alarm.time);
      const scheduledSeconds = (((target % 1440) + 1440) % 1440) * 60;
      const currentSeconds = currentMinute * 60 + clock.seconds;
      const elapsed = (currentSeconds - scheduledSeconds + 86400) % 86400;
      const key = `${dayKey}-${alarm.id}`;
      if (alarm.days.includes(weekday) && elapsed <= 90 && !fajrAlarmFiredRef.current.has(key)) { fajrAlarmFiredRef.current.add(key); triggerFajrAlarm(alarm, dayKey); }
    });
    if (fajrAlarmFiredRef.current.size > 300) fajrAlarmFiredRef.current.clear();
  }, [now, selectedCity, daylightSavingEnabled, activePrayers, fajrAlarms, activeFajrAlarm]);
  const openFajrAlarmComposer = () => { setFajrAlarmDraft({ id: "", time: "05:00", mode: "exact", minutesBeforeFajr: 30, days: [0, 1, 2, 3, 4, 5, 6], soundName: "نغمة النظام", puzzle: "none" }); setFajrAlarmSound(null); setFajrAlarmComposerOpen(true); };
  const updateFajrAlarmDays = (day: number) => setFajrAlarmDraft((draft) => ({ ...draft, days: draft.days.includes(day) ? draft.days.filter((item) => item !== day) : [...draft.days, day].sort((a, b) => a - b) }));
  const stopFajrAlarm = () => {
    const ringingAlarm = activeFajrAlarm;
    if (!ringingAlarm) return;
    if (ringingAlarm.alarm.puzzle !== "none" && fajrPuzzleAnswer.trim() !== ringingAlarm.answer) {
      notify("الإجابة غير صحيحة؛ لا يمكن إيقاف التنبيه");
      return;
    }
    dismissFajrAlarm();
  };
  const openSettings = () => { setWeekdayConfig(null); setSettingsView("root"); setAlertsView("root"); setSettingsOpen(true); };
  const closeSettings = () => { setWeekdayConfig(null); setSettingsOpen(false); setSettingsView("root"); setAlertsView("root"); };
  const goBackInSettings = () => {
    if (settingsView === "root") { closeSettings(); return; }
    if (settingsView === "general") { setSettingsView("root"); return; }
    if (settingsView === "themes" || settingsView === "counter") { setSettingsView("themeCategories"); return; }
    if (settingsView === "adhkar" && adhkarSettingsView !== "root") { setAdhkarSettingsView("root"); return; }
    if (settingsView === "themeCategories" || settingsView === "adhan" || settingsView === "adhkar") {
      setSettingsView("root");
      setAlertsView("root");
      setAdhkarSettingsView("root");
      return;
    }
    if (settingsView === "sounds") { setSettingsView("adhan"); return; }
    if (settingsView === "alerts") {
      if (alertsView !== "root") { setAlertsView("root"); return; }
      setSettingsView("adhan");
      return;
    }
    closeSettings();
  };

  const formatPrayerClock = (minuteOfDay: number) => {
    const normalized = ((minuteOfDay % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    return `${(hour % 12 || 12).toString().padStart(2, "0")}:${(normalized % 60).toString().padStart(2, "0")} ${hour >= 12 ? "م" : "ص"}`;
  };
  const qiyamTime = formatPrayerClock((activePrayers.find((prayer) => prayer.arabic === "الفجر")?.minuteOfDay ?? 300) + qiyamMinutesBeforeFajr);
  const fridaySoundTitle = adhkarSoundModal === "qiyam" ? "صوت تنبيه صلاة القيام" : adhkarSoundModal === "duha" ? "صوت تنبيه صلاة الضحى" : adhkarSoundModal === "fridayDhikr" ? "صوت تذكير الصلاة على النبي ﷺ" : adhkarSoundModal === "fridayAnswer" ? "صوت تنبيه ساعة الإجابة" : adhkarSoundModal === "fridayTakbeer" ? "صوت تنبيه تكبير الجمعة" : adhkarSoundModal === "fastingFajr" ? "صوت تنبيه الصيام قبل الفجر" : adhkarSoundModal === "fastingMaghrib" ? "صوت تنبيه الصيام قبل المغرب" : adhkarSoundModal === "evening" ? "صوت تنبيه أذكار المساء" : adhkarSoundModal === "morning" ? "صوت تنبيه أذكار الصباح" : "صوت تنبيه أذكار النوم";
  const uploadAdhkarSound = (event: React.ChangeEvent<HTMLInputElement>) => {
    requestNotificationPermission();
    const file = event.target.files?.[0];
    if (!file || !adhkarSoundModal) return;
    const sound = { id: `${adhkarSoundModal}-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url: URL.createObjectURL(file) };
    setAdhkarSoundFiles((items) => ({ ...items, [adhkarSoundModal]: [...items[adhkarSoundModal], sound] }));
    setSelectedAdhkarSoundIds((items) => ({ ...items, [adhkarSoundModal]: items[adhkarSoundModal] ?? sound.id }));
    notify("تمت إضافة صوت التنبيه");
  };
  const deleteAdhkarSound = (kind: AdhkarSoundKind, id: string) => {
    const sound = adhkarSoundFiles[kind].find((item) => item.id === id);
    if (sound) URL.revokeObjectURL(sound.url);
    if (selectedAdhkarSoundIds[kind] === id) setSelectedAdhkarSoundIds((items) => ({ ...items, [kind]: adhkarSoundFiles[kind].find((item) => item.id !== id)?.id ?? null }));
    setAdhkarSoundFiles((items) => ({ ...items, [kind]: items[kind].filter((item) => item.id !== id) }));
  };
  const uploadAdhanVideo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const video = { id: `adhan-video-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url: URL.createObjectURL(file) };
    setAdhanVideos((items) => [...items, video]);
    setSelectedAdhanVideoId(video.id);
    event.target.value = "";
    notify("تمت إضافة خلفية الأذان");
  };
  const removeAdhanVideo = (id: string) => {
    const video = adhanVideos.find((item) => item.id === id);
    if (!video) return;
    URL.revokeObjectURL(video.url);
    const remaining = adhanVideos.filter((item) => item.id !== id);
    setAdhanVideos(remaining);
    if (selectedAdhanVideoId === id) setSelectedAdhanVideoId(remaining[0]?.id ?? null);
    if (adhanVideoPreviewId === id) setAdhanVideoPreviewId(null);
    notify("تم حذف فيديو خلفية الأذان");
  };
  const closeAdhanOverlay = () => {
    const video = adhanOverlayVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
      adhanAudioRef.current = null;
    }
    setAdhanOverlayOpen(false);
    setAdhanOverlayPrayer(null);
  };
  const stopActiveSoundAlert = () => {
    const audio = audioPlaybackRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; audioPlaybackRef.current = null; }
    if (adhanAudioRef.current) { adhanAudioRef.current.pause(); adhanAudioRef.current.currentTime = 0; adhanAudioRef.current = null; }
    const video = adhanOverlayVideoRef.current;
    if (video) { video.pause(); video.currentTime = 0; }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
    setActiveSoundAlert(null);
    setAdhanOverlayOpen(false);
    setAdhanOverlayPrayer(null);
  };
  const showPrayerNotification = (title: string, message: string, tag: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const notification = new Notification(title, { body: message, tag });
      notification.onclick = () => { window.focus(); notification.close(); };
    } catch { /* Browser notifications may be unavailable in an embedded/insecure context. */ }
  };
  const playAdhanExperience = (prayer: Prayer) => {
    const message = `حان الآن أذان ${prayer.arabic}`;
    notify(message);
    showPrayerNotification(`أذان ${prayer.arabic}`, message, `adhan-${selectedCity.city}-${prayer.arabic}`);
    if (adhanBackgroundEnabled && adhanVideoUrl) {
      setActiveSoundAlert(null);
      setAdhanOverlayPrayer(prayer.arabic);
      setAdhanOverlayOpen(true);
      return;
    }
    playConfiguredSound("adhan", message);
  };
  useEffect(() => {
    if (!adhanOverlayOpen || !adhanOverlayPrayer) return;
    const video = adhanOverlayVideoRef.current;
    if (!video) return;
    video.loop = true;
    video.muted = true;
    video.currentTime = 0;
    void video.play().catch(() => notify("تعذر تشغيل خلفية الأذان تلقائياً"));
    const sound = soundFiles.adhan.find((item) => item.id === selectedSoundIds.adhan);
    if (!sound) return;
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(sound.url);
    adhanAudioRef.current = audio;
    audio.preload = "auto";
    audio.onended = () => {
      if (adhanAudioRef.current === audio) adhanAudioRef.current = null;
      video.pause();
      video.currentTime = 0;
      setAdhanOverlayOpen(false);
      setAdhanOverlayPrayer(null);
    };
    void audio.play().catch(() => notify("تم تشغيل الفيديو، لكن يحتاج المتصفح إلى السماح بتشغيل صوت الأذان"));
    return () => {
      video.pause();
      if (adhanAudioRef.current === audio) {
        audio.pause();
        audio.currentTime = 0;
        adhanAudioRef.current = null;
      }
    };
  }, [adhanOverlayOpen, adhanOverlayPrayer, soundFiles.adhan, selectedSoundIds.adhan]);
  const startAdhanVideoWithAudio = () => {
    const video = adhanVideoRef.current;
    if (!video) return;
    const adhanSound = soundFiles.adhan.find((item) => item.id === selectedSoundIds.adhan);
    if (!adhanSound) {
      video.loop = true;
      return;
    }
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(adhanSound.url);
    adhanAudioRef.current = audio;
    video.loop = true;
    audio.onended = () => {
      video.pause();
      video.currentTime = 0;
      adhanAudioRef.current = null;
    };
    void audio.play().catch(() => notify("اضغط تشغيل الفيديو للسماح بتشغيل صوت الأذان"));
  };
  const stopAdhanVideoWithAudio = () => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
      adhanAudioRef.current = null;
    }
  };
  const uploadSound = (kind: PrayerSoundKind, event: React.ChangeEvent<HTMLInputElement>) => {
    requestNotificationPermission();
    const file = event.target.files?.[0];
    if (!file) return;
    if (playingSound === kind) stopPreviewAudio();
    const sound = { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url: URL.createObjectURL(file) };
    setSoundFiles((items) => ({ ...items, [kind]: [...items[kind], sound] }));
    setSelectedSoundIds((items) => ({ ...items, [kind]: items[kind] ?? sound.id }));
    notify("تمت إضافة الصوت");
  };
  const deleteSound = (kind: PrayerSoundKind, id: string) => {
    const sound = soundFiles[kind].find((item) => item.id === id);
    if (sound) URL.revokeObjectURL(sound.url);
    if (selectedSoundIds[kind] === id) setSelectedSoundIds((items) => ({ ...items, [kind]: soundFiles[kind].find((item) => item.id !== id)?.id ?? null }));
    setSoundFiles((items) => ({ ...items, [kind]: items[kind].filter((item) => item.id !== id) }));
  };
  const stopPreviewAudio = () => {
    const audio = audioPlaybackRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioPlaybackRef.current = null;
    }
    setPlayingSound(null);
    setPlayingAdhkarSound(null);
  };
  const testSound = (kind: PrayerSoundKind) => {
    const sound = soundFiles[kind].find((item) => item.id === selectedSoundIds[kind]);
    if (!sound) { notify("أضف ملفاً صوتياً أولاً"); return; }
    if (playingSound === kind) { stopPreviewAudio(); return; }
    stopPreviewAudio();
    const audio = new Audio(sound.url);
    audio.preload = "auto";
    audioPlaybackRef.current = audio;
    setPlayingSound(kind);
    audio.onended = () => { if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null; setPlayingSound(null); };
    void audio.play().catch(() => { if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null; setPlayingSound(null); notify("تعذر تشغيل الصوت؛ تحقق من صيغة الملف أو اسمح بالصوت في المتصفح"); });
  };
  const testAdhkarSound = (kind: AdhkarSoundKind) => {
    const sound = adhkarSoundFiles[kind].find((item) => item.id === selectedAdhkarSoundIds[kind]);
    if (!sound) { notify("أضف ملفاً صوتياً أولاً"); return; }
    if (playingAdhkarSound === kind) { stopPreviewAudio(); return; }
    stopPreviewAudio();
    const audio = new Audio(sound.url);
    audio.preload = "auto";
    audioPlaybackRef.current = audio;
    setPlayingAdhkarSound(kind);
    audio.onended = () => { if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null; setPlayingAdhkarSound(null); };
    void audio.play().catch(() => { if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null; setPlayingAdhkarSound(null); notify("تعذر تشغيل الصوت؛ تحقق من صيغة الملف أو اسمح بالصوت في المتصفح"); });
  };

  const openLocation = () => {
    setLocationMode("options");
    setLocationStep("country");
    setLocationQuery("");
    setLocationStatus("");
    setLocationOpen(true);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("المتصفح لا يدعم تحديد الموقع الجغرافي");
      return;
    }
    setLocationStatus("جارٍ تحديد موقعك عبر GPS...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = citySchedules.reduce((best, city) => {
          const distance = Math.pow(city.lat - coords.latitude, 2) + Math.pow(city.lon - coords.longitude, 2);
          return distance < best.distance ? { city, distance } : best;
        }, { city: citySchedules[0], distance: Number.POSITIVE_INFINITY }).city;
        setSelectedCity(nearest);
        setActivePrayers(scheduleForCity(nearest, now, daylightSavingEnabled));
        setActivePrayer("الفجر");
        setPrayerSelectionMode("automatic");
        setLocationOpen(false);
        notify(`تم تحديد موقعك: ${nearest.city}، ${nearest.country}`);
      },
      () => setLocationStatus("تعذر الوصول إلى GPS. يمكنك اختيار الموقع يدويًا."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const filteredCountries = countryNames.filter((country) => country.includes(locationQuery.trim()));
  const filteredCities = citySchedules.filter((city) => city.country === selectedCountry && city.city.includes(locationQuery.trim()));

  const chooseCountry = (country: string) => {
    setSelectedCountry(country);
    setLocationQuery("");
    setLocationStep("city");
  };

  const chooseCity = (city: CitySchedule) => {
    setSelectedCity(city);
    setActivePrayers(scheduleForCity(city, now, daylightSavingEnabled));
    setActivePrayer("الفجر");
    setPrayerSelectionMode("automatic");
    setLocationOpen(false);
    notify(`تم تحديث مواقيت الصلاة لـ ${city.city}`);
  };

  const stopDhikrAudio = () => {
    if (dhikrPlaybackTimerRef.current !== null) {
      window.clearTimeout(dhikrPlaybackTimerRef.current);
      dhikrPlaybackTimerRef.current = null;
    }
    dhikrAudioRef.current?.pause();
    dhikrAudioRef.current = null;
    setPlayingDhikr(false);
    setDhikrPlaybackProgress(0);
    setDhikrPlaybackDuration(0);
    dhikrPlaybackRepeatRef.current = 0;
    setDhikrPlaybackRepeat(0);
  };

  const closeDhikrPlayer = () => { stopDhikrAudio(); audioRepeatModeRef.current = false; setAudioCompletionPromptOpen(false); setAudioRepeatMode(false); setDhikrPlayerOpen(false); };

  const resetDhikrPlaybackSession = () => {
    stopDhikrAudio();
    dhikrPlaybackSequenceRef.current = 0;
    dhikrPlaybackRepeatRef.current = 0;
    setDhikrCount(0);
    setBrowseCounts({});
    setCustomDhikrIndex(0);
    setMorningDhikrIndex(0);
    setEveningDhikrIndex(0);
    setHomeEntryDhikrIndex(0);
    setHomeExitDhikrIndex(0);
    setWuduBeforeDhikrIndex(0);
    setWuduAfterDhikrIndex(0);
    setFoodDhikrIndex(0);
    setSleepDhikrIndex(0);
    setFortressDhikrIndex(0);
    setShortVersion(false);
    setContinuationPromptOpen(false);
    setContinuePastTen(false);
    setAudioCompletionPromptOpen(false);
    audioRepeatModeRef.current = false;
    setAudioRepeatMode(false);
  };

  const getCurrentPlaybackSequence = () => {
    if (activeCustomCard) return customDhikrIndex;
    if (activeDhikr === "السبحة") return tasbeehDhikrIndex;
    if (activeDhikr === "أذكار الصباح") return morningDhikrIndex;
    if (activeDhikr === "حصن المسلم") return fortressDhikrIndex;
    if (activeDhikr === "أذكار المساء") return eveningDhikrIndex;
    if (activeDhikr === "دخول البيت") return homeEntryDhikrIndex;
    if (activeDhikr === "الخروج من البيت") return homeExitDhikrIndex;
    if (activeDhikr === "أذكار الوضوء") return wuduBeforeDhikrIndex;
    if (activeDhikr === "أذكار الطعام") return foodDhikrIndex;
    if (["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "")) return sleepDhikrIndex ?? 0;
    return 0;
  };

  const getPlaybackTarget = (item: MorningDhikr | SleepDhikr | undefined, fallback = 1) => {
    if (!item) return fallback;
    return "targetCount" in item ? (item.continuationPrompt && !continuePastTen ? 10 : item.targetCount) : (Number.parseInt(item.count, 10) || fallback);
  };

  const playDhikrClip = (clip: AudioClip | null = activeClip, autoplay = true, playbackSequence = sequenceIndex, playbackTarget = dhikrTargetCount, browseMode = expandedDhikr) => {
    if (!clip) { notify("اختر مقرئاً وأضف مقاطع الأذكار أولاً"); return; }
    dhikrAudioRef.current?.pause();
    const audio = new Audio(clip.url);
    dhikrAudioRef.current = audio;
    setAudioCompletionPromptOpen(false);
    audio.preload = "metadata";
    audio.ontimeupdate = () => setDhikrPlaybackProgress(audio.currentTime);
    audio.onloadedmetadata = () => setDhikrPlaybackDuration(audio.duration || 0);
    audio.onerror = () => {
      setPlayingDhikr(false);
      setDhikrPlaybackDuration(0);
      notify(`تعذر تحميل المقطع الصوتي: ${clip.name}`);
    };
    audio.onended = () => {
      if (browseMode) {
        setBrowseCounts((items) => ({ ...items, [playbackSequence]: Math.max(items[playbackSequence] ?? 0, 1) }));
        window.requestAnimationFrame(() => browseCardRefs.current[playbackSequence]?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else setDhikrCount(1);
      if (audioRepeatModeRef.current) {
        dhikrPlaybackTimerRef.current = window.setTimeout(() => {
          dhikrPlaybackTimerRef.current = null;
          playDhikrClip(clip, true, playbackSequence, playbackTarget, browseMode);
        }, 250);
        return;
      }
      setPlayingDhikr(false);
      setAudioCompletionPromptOpen(true);
    };
    setPlayingDhikr(autoplay);
    if (autoplay) void audio.play().catch(() => { setPlayingDhikr(false); notify("تعذر تشغيل الملف الصوتي؛ اضغط تشغيل مرة أخرى أو تحقق من الملف"); });
  };

  const toggleDhikrAudio = () => {
    if (!dhikrPlayerOpen) {
      if (!selectedVoice) {
        setDhikrPlayerOpen(true);
        notify("اضغط زر السماعات داخل شريط الموسيقى لاختيار القارئ");
        return;
      }
      const currentSequence = restartDhikrFromBeginningRef.current ? 0 : getCurrentPlaybackSequence();
      const clip = clipForDhikr(currentSequence);
      if (!clip) {
        notify(selectedVoice ? `لا يوجد مقطع صوتي للذكر رقم ${currentSequence + 1} لدى هذا المقرئ` : "اختر مقرئاً أولاً من زر السماعات");
        return;
      }
      if (restartDhikrFromBeginningRef.current) resetDhikrPlaybackSession();
      setDhikrPlayerOpen(true);
      audioRepeatModeRef.current = false;
      setAudioRepeatMode(false);
      restartDhikrFromBeginningRef.current = false;
      playDhikrClip(clip, true, currentSequence, getPlaybackTarget(browseDhikrs[currentSequence], dhikrTargetCount), expandedDhikr);
      return;
    }
    if (playingDhikr) {
      closeDhikrPlayer();
      restartDhikrFromBeginningRef.current = true;
      return;
    }
    const currentSequence = getCurrentPlaybackSequence();
    const clip = clipForDhikr(currentSequence);
    if (!clip) {
      closeDhikrPlayer();
      notify(selectedVoice ? `لا يوجد مقطع صوتي للذكر رقم ${currentSequence + 1} لدى هذا المقرئ` : "اختر مقرئاً أولاً من زر السماعات");
      return;
    }
    playDhikrClip(clip, true, currentSequence, getPlaybackTarget(browseDhikrs[currentSequence], dhikrTargetCount), expandedDhikr);
  };

  const toggleDhikrPlayback = () => {
    if (!dhikrAudioRef.current) {
      if (!activeClip) {
        notify(`لا يوجد مقطع صوتي للذكر رقم ${sequenceIndex + 1} لدى هذا المقرئ`);
        return;
      }
      playDhikrClip();
      return;
    }
    if (playingDhikr) {
      dhikrAudioRef.current.pause();
      setPlayingDhikr(false);
    } else {
      void dhikrAudioRef.current.play();
      setPlayingDhikr(true);
    }
  };

  const repeatCurrentAudio = () => {
    setAudioCompletionPromptOpen(false);
    audioRepeatModeRef.current = true;
    setAudioRepeatMode(true);
    playDhikrClip(selectedVoice?.clips[sequenceIndex] ?? null, true, sequenceIndex, dhikrTargetCount, expandedDhikr);
  };

  const advanceAudioToNextDhikr = () => {
    setAudioCompletionPromptOpen(false);
    audioRepeatModeRef.current = false;
    setAudioRepeatMode(false);
    if (sequenceIndex >= activeSequenceLength - 1) {
      notify("تم إكمال الاستماع إلى الأذكار");
      return;
    }
    const nextSequence = sequenceIndex + 1;
    moveMorningDhikr(1);
    dhikrPlaybackSequenceRef.current = nextSequence;
    window.setTimeout(() => {
      const nextClip = clipForDhikr(nextSequence);
      if (nextClip) playDhikrClip(nextClip, true, nextSequence, dhikrTargetCount, expandedDhikr);
      else {
        closeDhikrPlayer();
        notify(`توقف التشغيل: لا يوجد مقطع للذكر رقم ${nextSequence + 1} لدى هذا المقرئ`);
      }
      if (expandedDhikr) window.requestAnimationFrame(() => browseCardRefs.current[nextSequence]?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }, expandedDhikr ? 120 : 0);
  };

  const seekDhikrAudio = (seconds: number) => {
    if (dhikrAudioRef.current) dhikrAudioRef.current.currentTime = Math.max(0, Math.min(dhikrAudioRef.current.duration || 0, dhikrAudioRef.current.currentTime + seconds));
  };

  const previewAudioClip = (clip: AudioClip, previewId: string) => {
    if (previewingVoiceId === previewId && voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.pause();
      voicePreviewAudioRef.current = null;
      if (voicePreviewStopTimerRef.current) window.clearTimeout(voicePreviewStopTimerRef.current);
      voicePreviewStopTimerRef.current = null;
      setPreviewingVoiceId(null);
      return;
    }
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewStopTimerRef.current) window.clearTimeout(voicePreviewStopTimerRef.current);
    const audio = new Audio(clip.url);
    voicePreviewAudioRef.current = audio;
    setPreviewingVoiceId(previewId);
    const stopPreview = () => { audio.pause(); voicePreviewAudioRef.current = null; voicePreviewStopTimerRef.current = null; setPreviewingVoiceId(null); };
    audio.onended = stopPreview;
    voicePreviewStopTimerRef.current = window.setTimeout(stopPreview, 8000);
    void audio.play().catch(() => { stopPreview(); notify("تعذر تشغيل المعاينة؛ اسمح بالصوت في المتصفح"); });
  };

  const previewVoice = (profile: VoiceProfile) => {
    const clip = profile.clips[0];
    if (!clip) { notify("لا توجد مقاطع لهذا القارئ"); return; }
    previewAudioClip(clip, profile.id);
  };

  const downloadAudioClip = (clip: AudioClip, number: number) => {
    const link = document.createElement("a");
    link.href = clip.url;
    link.download = `ذِكر-${String(number).padStart(2, "0")}.mp3`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadCurrentDhikr = () => {
    if (!selectedVoice) { notify("اختر مقرئاً أولاً"); return; }
    const clip = selectedVoice.clips[sequenceIndex];
    if (!clip) { notify("لا يوجد صوت لهذا الذكر"); return; }
    downloadAudioClip(clip, sequenceIndex + 1);
    setDownloadedAudioIndexes((items) => items.includes(sequenceIndex) ? items : [...items, sequenceIndex]);
    setAudioDownloadChoiceOpen(false);
    notify(`بدأ تحميل الذكر ${sequenceIndex + 1} من ${activeSequenceLength}`);
  };

  const downloadSelectedDhikrs = () => {
    if (!selectedVoice) return;
    const selected = [...selectedAudioDownloads].sort((a, b) => a - b);
    selected.forEach((index, offset) => window.setTimeout(() => {
      const clip = selectedVoice.clips[index];
      if (clip) downloadAudioClip(clip, index + 1);
    }, offset * 180));
    setDownloadedAudioIndexes((items) => Array.from(new Set([...items, ...selected])));
    setAudioDownloadListOpen(false);
    setAudioDownloadChoiceOpen(false);
    notify(selected.length ? `بدأ تحميل ${selected.length} من ${activeSequenceLength} أذكار` : "لم تختر أي ذكر للتحميل");
  };

  const addVoiceClips = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setNewVoiceClips((items) => [...items, ...files.map((file) => ({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }))]);
    event.target.value = "";
  };

  const openVoiceManager = (profileId?: string) => {
    const profile = profileId ? scopedVoiceProfiles.find((item) => item.id === profileId) : null;
    setEditingVoiceId(profile?.id ?? null);
    setNewReaderName(profile?.reader ?? "");
    setNewVoiceClips(profile ? [...profile.clips] : []);
    setVoiceOriginalClipIds(profile?.clips.map((clip) => clip.id) ?? []);
    setVoiceManagerView(profile ? "form" : "list");
    setVoiceMenuOpen(null);
    setVoiceChooserOpen(false);
    setVoiceManagerOpen(true);
  };
  const closeVoiceManager = () => {
    const originals = new Set(voiceOriginalClipIds);
    newVoiceClips.forEach((clip) => { if (!originals.has(clip.id)) URL.revokeObjectURL(clip.url); });
    setNewReaderName(""); setNewVoiceClips([]); setVoiceOriginalClipIds([]); setEditingVoiceId(null); setVoiceManagerView("list"); setVoiceManagerOpen(false);
  };
  const backToVoiceList = () => {
    const originals = new Set(voiceOriginalClipIds);
    newVoiceClips.forEach((clip) => { if (!originals.has(clip.id)) URL.revokeObjectURL(clip.url); });
    setNewReaderName(""); setNewVoiceClips([]); setVoiceOriginalClipIds([]); setEditingVoiceId(null); setVoiceMenuOpen(null); setVoiceManagerView("list");
  };
  const saveVoiceProfile = () => {
    const reader = newReaderName.trim();
    if (!reader || !newVoiceClips.length) { notify("اكتب اسم المقرئ واختر مقطعاً واحداً على الأقل"); return; }
    if (editingVoiceId) {
      const previous = voiceProfiles.find((item) => item.id === editingVoiceId);
      const nextIds = new Set(newVoiceClips.map((clip) => clip.id));
      previous?.clips.forEach((clip) => { if (!nextIds.has(clip.id)) URL.revokeObjectURL(clip.url); });
      setVoiceProfiles((items) => items.map((item) => item.id === editingVoiceId ? { ...item, reader, clips: newVoiceClips } : item));
      setSelectedVoiceId(editingVoiceId);
      setNewReaderName(""); setNewVoiceClips([]); setVoiceOriginalClipIds([]); setEditingVoiceId(null); setVoiceMenuOpen(null); setVoiceManagerView("list");
      setVoiceManagerOpen(true);
      notify("تم تعديل صوت المقرئ");
      return;
    }
    const profile = { id: crypto.randomUUID(), reader, clips: newVoiceClips, scope: voiceScope };
    setVoiceProfiles((items) => [...items, profile]);
    setSelectedVoiceId(profile.id);
    setNewReaderName(""); setNewVoiceClips([]); setVoiceMenuOpen(null); setVoiceManagerView("list"); setVoiceManagerOpen(true);
    notify("تمت إضافة صوت المقرئ وترتيب المقاطع");
  };

  const deleteVoiceProfile = (profileId: string) => {
    const profile = voiceProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    if (profileId === farisAbbadVoice.id) {
      stopDhikrAudio();
      setDownloadedAudioIndexes([]);
      setSelectedVoiceId(null);
      setVoiceMenuOpen(null);
      notify("تم حذف المقاطع المحمّلة فقط، وبقي اسم فارس عباد");
      return;
    }
    profile.clips.forEach((clip) => URL.revokeObjectURL(clip.url));
    setVoiceProfiles((items) => items.filter((item) => item.id !== profileId));
    if (selectedVoiceId === profileId) {
      stopDhikrAudio();
      setSelectedVoiceId(null);
    }
    notify("تم حذف صوت المقرئ");
  };

  const deleteNewVoiceClip = (clipId: string) => {
    const clip = newVoiceClips.find((item) => item.id === clipId);
    if (clip && !editingVoiceId) URL.revokeObjectURL(clip.url);
    setNewVoiceClips((items) => items.filter((item) => item.id !== clipId));
  };

  const reorderVoiceClip = (index: number, direction: -1 | 1) => {
    setNewVoiceClips((items) => { const next = index + direction; if (next < 0 || next >= items.length) return items; const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  };

  const openAddDhikr = () => {
    setNewDhikrTitle("");
    setNewDhikrText("");
    setNewDhikrRank(String((activeDhikr === "السبحة" ? tasbeehDhikr.length : morningDhikr.length) + 1));
    setNewDhikrCount("1");
    setNewDhikrSource("");
    setNewDhikrBenefit("");
    setNewDhikrNarrator("");
    setAddDhikrOpen(true);
  };

  const resetCardForm = () => { setCustomTitle(""); setCustomCaption(""); setCustomIconUrl(""); setCustomBackground(""); setCardCreateForFortress(false); };

  const addCardImage = (event: React.ChangeEvent<HTMLInputElement>, target: "icon" | "background") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (target === "icon") setCustomIconUrl(url); else setCustomBackground(url);
    event.target.value = "";
  };

  const fetchMatchingIcon = async () => {
    const query = customTitle.trim();
    if (!query) { notify("اكتب العنوان أولاً لجلب أيقونة مناسبة"); return; }
    try {
      const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=1`);
      const result = await response.json() as { icons?: string[] };
      const icon = result.icons?.[0];
      if (!icon) { notify("لم يتم العثور على أيقونة مناسبة؛ يمكنك إدخال رابط أو اختيار صورة"); return; }
      const [prefix, name] = icon.split(":");
      setCustomIconUrl(`https://api.iconify.design/${prefix}/${name}.svg`);
      notify("تم جلب أيقونة مناسبة للعنوان");
    } catch { notify("تعذر جلب الأيقونة من الإنترنت"); }
  };

  const saveCustomIconCard = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = customTitle.trim();
    if (!title) { notify("اكتب عنوان البطاقة أولاً"); return; }
    const parentCardScope = parentCardId ? findCustomCard(customDhikrCards, parentCardId)?.scope : undefined;
    const isFortressCard = cardCreateForFortress || parentCardScope === "fortress";
    const card: CustomDhikrCard = { id: crypto.randomUUID(), title, caption: customCaption.trim() || "وردك الخاص", iconUrl: customIconUrl.trim() || undefined, background: customBackground || undefined, contentMode: undefined, children: [], dhikrs: [], scope: isFortressCard ? "fortress" : "adhkar", fortressParentSection: isFortressCard ? fortressIconParentSection : undefined };
    if (parentCardId) {
      const appendChild = (items: CustomDhikrCard[]): CustomDhikrCard[] => items.map((item) => item.id === parentCardId ? { ...item, contentMode: "icons", children: [...(item.children ?? []), card] } : { ...item, children: item.children ? appendChild(item.children) : item.children });
      setCustomDhikrCards(appendChild);
    }
    else {
      setCustomDhikrCards((items) => [...items, card]);
      if (cardCreateForFortress) {
        if (fortressIconParentSection === "root") setFortressRootOrder((items) => [...items, card.id]);
        else setFortressPrayerOrder((items) => [...items, card.id]);
      } else setAdhkarOrder((items) => [...items, card.id]);
    }
    if (parentCardId) { setSelectedCustomCardId(parentCardId); setCustomChildrenOpen(true); }
    resetCardForm(); setCardCreateOpen(false); setCardCreateMode("choice"); setCardCreateForFortress(false);
    if (isFortressCard && !parentCardId) setFortressOpen(true);
    notify("تمت إضافة بطاقة الأذكار");
  };

  const moveCustomCard = (id: string, direction: -1 | 1) => {
    setCustomDhikrCards((items) => { const index = items.findIndex((item) => item.id === id); const next = index + direction; if (index < 0 || next < 0 || next >= items.length) return items; const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  };

  const dropAdhkarCard = (targetId: string) => {
    if (!draggedCardId || draggedCardId === targetId) return;
    setAdhkarOrder((items) => {
      const next = [...items];
      const from = next.indexOf(draggedCardId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return items;
      next.splice(from, 1);
      next.splice(to, 0, draggedCardId);
      return next;
    });
    setDraggedCardId(null);
  };

  const dropFortressCard = (targetId: string) => {
    if (!fortressDraggedCardId || fortressDraggedCardId === targetId) return;
    const setter = fortressView === "root" ? setFortressRootOrder : setFortressPrayerOrder;
    setter((items) => {
      const next = [...items];
      const from = next.indexOf(fortressDraggedCardId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return items;
      next.splice(from, 1);
      next.splice(to, 0, fortressDraggedCardId);
      return next;
    });
    setFortressDraggedCardId(null);
  };

  const moveNestedCard = (parentId: string, targetId: string) => {
    if (!draggedCardId || draggedCardId === targetId) return;
    const reorder = (items: CustomDhikrCard[]): CustomDhikrCard[] => items.map((item) => {
      if (item.id === parentId) {
        const children = [...(item.children ?? [])];
        const from = children.findIndex((child) => child.id === draggedCardId);
        const to = children.findIndex((child) => child.id === targetId);
        if (from >= 0 && to >= 0) { const [moved] = children.splice(from, 1); children.splice(to, 0, moved); }
        return { ...item, children };
      }
      return { ...item, children: item.children ? reorder(item.children) : item.children };
    });
    setCustomDhikrCards(reorder);
    setDraggedCardId(null);
  };

  const removeCustomCard = (id: string) => {
    const removeNested = (items: CustomDhikrCard[]): CustomDhikrCard[] => items.filter((item) => item.id !== id).map((item) => {
      const children = item.children ? removeNested(item.children) : item.children;
      return { ...item, children, contentMode: children && children.length === 0 && item.contentMode === "icons" ? undefined : item.contentMode };
    });
    const isFirstAndOnlyChild = Boolean(activeCustomCard && activeCustomCard.children?.length === 1 && activeCustomCard.children[0].id === id);
    setCustomDhikrCards(removeNested);
    if (isFirstAndOnlyChild && activeCustomCard) {
      setSelectedCustomCardId(activeCustomCard.id);
      setCustomChildrenOpen(true);
      setCardMenuOpen(null);
      notify("تم حذف الأيقونة؛ اختر إضافة أيقونة أو إضافة ذكر");
      return;
    }
    if (selectedCustomCardId === id) setSelectedCustomCardId(null);
    setCardMenuOpen(null); notify("تم حذف البطاقة المضافة");
  };

  const updateCustomCardBackground = (id: string, url?: string) => {
    const updateNested = (items: CustomDhikrCard[]): CustomDhikrCard[] => items.map((item) => item.id === id ? { ...item, background: url } : { ...item, children: item.children ? updateNested(item.children) : item.children });
    setCustomDhikrCards(updateNested);
    setAdhkarBackgrounds((items) => ({ ...items, [id]: url }));
  };

  const deleteCurrentDhikr = () => {
    const nestedDhikr = activeCustomCard?.dhikrs[customDhikrIndex];
    if (!currentDhikr?.custom && !nestedDhikr?.custom) { notify("يمكن حذف الأذكار التي أضفتها فقط"); return; }
    if (activeCustomCard) {
      const card = activeCustomCard;
      const isLast = card.dhikrs.length === 1;
      setCustomDhikrCards((items) => updateCustomCardById(items, card.id, (item) => ({ ...item, contentMode: isLast ? undefined : item.contentMode, dhikrs: item.dhikrs.filter((_entry, index) => index !== customDhikrIndex) })));
      if (isLast) { setActiveDhikr(null); setSelectedCustomCardId(card.id); setCustomChildrenOpen(true); }
      else setCustomDhikrIndex((index) => Math.max(0, Math.min(index, card.dhikrs.length - 2)));
    } else if (activeDhikr === "حصن المسلم") {
      const builtInCount = fortressSectionKey === "prayer:أدعية استفتاح الصلاة" ? fortressOpeningDhikrs.length : 0;
      const customIndex = fortressDhikrIndex - builtInCount;
      if (customIndex >= 0) {
        setFortressDhikrLists((items) => ({
          ...items,
          [fortressSectionKey]: (items[fortressSectionKey] ?? []).filter((_entry, index) => index !== customIndex),
        }));
        setFortressDhikrIndex(Math.max(builtInCount ? 0 : 0, fortressDhikrIndex - 1));
        setFortressSelectedDhikr(null);
      }
    } else if (activeDhikr === "السبحة") {
      setTasbeehDhikr((items) => items.filter((_entry, index) => index !== tasbeehDhikrIndex));
      setTasbeehDhikrIndex((index) => Math.max(0, Math.min(index, tasbeehDhikr.length - 2)));
    } else if (activeDhikr === "أذكار الصباح") {
      setMorningDhikr((items) => items.filter((_entry, index) => index !== morningDhikrIndex));
      setMorningDhikrIndex((index) => Math.max(0, Math.min(index, morningDhikr.length - 2)));
    } else if (activeDhikr === "أذكار المساء") {
      setEveningDhikrList((items) => items.filter((_entry, index) => index !== eveningDhikrIndex));
      setEveningDhikrIndex((index) => Math.max(0, Math.min(index, eveningDhikrList.length - 2)));
    } else if (["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "") && sleepDhikrIndex !== null) {
      const removeAt = sleepDhikrIndex;
      if (activeDhikr === "أذكار النوم") setSleepDhikrList((items) => items.filter((_entry, index) => index !== removeAt));
      else if (activeDhikr === "أذكار الاستيقاظ") setWakingDhikrList((items) => items.filter((_entry, index) => index !== removeAt));
      else setMiscellaneousDhikrList((items) => items.filter((_entry, index) => index !== removeAt));
      setSleepDhikrIndex((index) => index === null ? null : Math.max(0, Math.min(index, activeSleepDhikr.length - 2)));
    } else if (activeDhikr === "دخول البيت") {
      setHomeEntryDhikrList((items) => items.filter((_entry, index) => index !== homeEntryDhikrIndex));
      setHomeEntryDhikrIndex((index) => Math.max(0, Math.min(index, homeEntryDhikrList.length - 2)));
    } else if (activeDhikr === "الخروج من البيت") {
      setHomeExitDhikrList((items) => items.filter((_entry, index) => index !== homeExitDhikrIndex));
      setHomeExitDhikrIndex((index) => Math.max(0, Math.min(index, homeExitDhikrList.length - 2)));
    } else if (activeDhikr === "أذكار الوضوء") {
      if (wuduBeforeDhikrIndex === 0) setWuduBeforeDhikrList((items) => items.filter((_entry) => !_entry.custom));
      else setWuduAfterDhikrList((items) => items.filter((_entry) => !_entry.custom));
    } else if (activeDhikr === "أذكار الطعام") {
      if (foodDhikrIndex === 0) setFoodBeforeDhikrList((items) => items.filter((_entry) => !_entry.custom));
      else setFoodAfterDhikrList((items) => items.filter((_entry) => !_entry.custom));
    }
    setDhikrCount(0); notify("تم حذف الذكر المضاف");
  };
  const openDhikrEditor = () => {
    if (!currentDhikr?.custom) { notify("يمكن تعديل الأذكار التي أضفتها فقط"); return; }
    setDhikrEditTitle(currentDhikr.title ?? "");
    setDhikrEditText(currentDhikr.text);
    setDhikrEditSource(currentDhikr.source ?? "");
    setDhikrEditReferences(currentDhikr.references ?? "");
    setDhikrEditCount(String(currentDhikr.targetCount));
    setDhikrEditOpen(true);
  };
  const saveDhikrEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = dhikrEditText.trim();
    if (!text) { notify("اكتب نص الذكر أولاً"); return; }
    const updated: MorningDhikr = { ...currentDhikr!, text, title: dhikrEditTitle.trim() || undefined, source: dhikrEditSource.trim() || undefined, references: dhikrEditReferences.trim(), targetCount: Math.max(1, Number(dhikrEditCount) || 1), custom: true };
    if (activeCustomCard) {
      setCustomDhikrCards((items) => updateCustomCardById(items, activeCustomCard.id, (card) => ({ ...card, dhikrs: card.dhikrs.map((item, index) => index === customDhikrIndex ? updated : item) })));
    } else if (activeDhikr === "حصن المسلم") {
      const builtInCount = fortressSectionKey === "prayer:أدعية استفتاح الصلاة" ? fortressOpeningDhikrs.length : 0;
      const customIndex = fortressDhikrIndex - builtInCount;
      if (customIndex >= 0) {
        setFortressDhikrLists((items) => ({
          ...items,
          [fortressSectionKey]: (items[fortressSectionKey] ?? []).map((item, index) => index === customIndex ? updated : item),
        }));
      }
    } else if (activeDhikr === "السبحة") setTasbeehDhikr((items) => items.map((item, index) => index === tasbeehDhikrIndex ? updated : item));
    else if (activeDhikr === "أذكار الصباح") setMorningDhikr((items) => items.map((item, index) => index === morningDhikrIndex ? updated : item));
    else if (activeDhikr === "أذكار المساء") setEveningDhikrList((items) => items.map((item, index) => index === eveningDhikrIndex ? updated : item));
    else if (activeDhikr === "دخول البيت") setHomeEntryDhikrList((items) => items.map((item, index) => index === homeEntryDhikrIndex ? updated : item));
    else if (activeDhikr === "الخروج من البيت") setHomeExitDhikrList((items) => items.map((item, index) => index === homeExitDhikrIndex ? updated : item));
    else if (activeDhikr === "أذكار النوم") setSleepDhikrList((items) => items.map((item, index) => index === sleepDhikrIndex ? { ...item, title: updated.title ?? item.title, text: updated.text, benefit: updated.source ?? "", reference: updated.references, count: `${updated.targetCount} مرات` } : item));
    else if (activeDhikr === "أذكار الاستيقاظ") setWakingDhikrList((items) => items.map((item, index) => index === sleepDhikrIndex ? { ...item, title: updated.title ?? item.title, text: updated.text, benefit: updated.source ?? "", reference: updated.references, count: `${updated.targetCount} مرات` } : item));
    else if (activeDhikr === "أذكار متنوعة") setMiscellaneousDhikrList((items) => items.map((item, index) => index === sleepDhikrIndex ? { ...item, title: updated.title ?? item.title, text: updated.text, benefit: updated.source ?? "", reference: updated.references, count: `${updated.targetCount} مرات` } : item));
    setDhikrCount(0); setDhikrEditOpen(false); notify("تم تعديل الذكر بنجاح");
  };
  const deleteBrowseDhikr = (index: number) => {
    if (activeCustomCard) {
      const card = activeCustomCard;
      const isLast = card.dhikrs.length === 1;
      setCustomDhikrCards((items) => updateCustomCardById(items, card.id, (item) => ({ ...item, contentMode: isLast ? undefined : item.contentMode, dhikrs: item.dhikrs.filter((_entry, itemIndex) => itemIndex !== index) })));
      setCustomDhikrIndex((current) => Math.max(0, Math.min(current, card.dhikrs.length - 2)));
      if (isLast) { setActiveDhikr(null); setSelectedCustomCardId(card.id); setCustomChildrenOpen(true); }
    } else if (activeDhikr === "السبحة") setTasbeehDhikr((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    else if (activeDhikr === "أذكار الصباح") setMorningDhikr((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    else if (activeDhikr === "أذكار المساء") setEveningDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    else if (activeDhikr === "دخول البيت") setHomeEntryDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    else if (activeDhikr === "الخروج من البيت") setHomeExitDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    else if (["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "")) {
      if (activeDhikr === "أذكار النوم") setSleepDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
      else if (activeDhikr === "أذكار الاستيقاظ") setWakingDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
      else setMiscellaneousDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
    } else if (activeDhikr === "أذكار الوضوء") {
      const beforeLength = wuduBeforeDhikrList.length;
      if (index < beforeLength) setWuduBeforeDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
      else setWuduAfterDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index - beforeLength));
    } else if (activeDhikr === "أذكار الطعام") {
      const beforeLength = foodBeforeDhikrList.length;
      if (index < beforeLength) setFoodBeforeDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index));
      else setFoodAfterDhikrList((items) => items.filter((_entry, itemIndex) => itemIndex !== index - beforeLength));
    }
    setDhikrCount(0); notify("تم حذف الذكر المضاف");
  };
  const openAddFortressDhikr = () => {
    setActiveDhikr("حصن المسلم");
    setFortressSelectedDhikr(null);
    setNewDhikrTitle("");
    setNewDhikrText("");
    const baseCount = fortressPrayerCategory === "أدعية استفتاح الصلاة" ? fortressOpeningDhikrs.length : 0;
    setNewDhikrRank(String(baseCount + (fortressDhikrLists[fortressSectionKey]?.length ?? 0) + 1));
    setNewDhikrCount("1");
    setNewDhikrSource("");
    setNewDhikrBenefit("");
    setNewDhikrNarrator("");
    setAddDhikrOpen(true);
  };

  const addDhikr = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = newDhikrText.trim();
    if (!text) {
      notify("اكتب نص الذكر أولاً");
      return;
    }
    const currentCollectionLength = activeDhikr === "السبحة" ? tasbeehDhikr.length : morningDhikr.length;
    const rank = Math.max(1, Math.min(currentCollectionLength + 1, Number(newDhikrRank) || currentCollectionLength + 1));
    const count = activeDhikr === "حصن المسلم" ? 1 : Math.max(1, Number(newDhikrCount) || 1);
    const references = [newDhikrNarrator.trim() ? `رواه ${newDhikrNarrator.trim()}` : "", newDhikrBenefit.trim(), "الموقع إسلام ويب"].filter(Boolean).join(" · ");
    const addedDhikr: MorningDhikr = { text, targetCount: count, source: newDhikrSource.trim() || undefined, references, custom: true, title: newDhikrTitle.trim() || undefined };
    if (activeDhikr === "حصن المسلم" && fortressSectionKey) {
      setFortressDhikrLists((items) => ({ ...items, [fortressSectionKey]: [...(items[fortressSectionKey] ?? []), addedDhikr] }));
      setFortressSelectedDhikr(addedDhikr);
      setDhikrCount(0);
      setShortVersion(false);
      setContinuationPromptOpen(false);
      setContinuePastTen(false);
      setAddDhikrOpen(false);
      setFortressOpen(false);
      notify(`تمت إضافة الذكر إلى ${fortressPrayerCategory ?? fortressCategory ?? "حصن المسلم"}`);
      return;
    }
    const targetCustomCardId = activeDhikr?.startsWith("custom:") ? activeDhikr.slice("custom:".length) : parentCardId;
    if (!targetCustomCardId && ["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "")) {
      const sleepItem: SleepDhikr = { title: newDhikrTitle.trim() || `الذكر ${activeSleepDhikr.length + 1}`, text, benefit: newDhikrSource.trim() || "", reference: references, count: `${count} مرات`, custom: true };
      if (activeDhikr === "أذكار النوم") setSleepDhikrList((items) => [...items, sleepItem]);
      else if (activeDhikr === "أذكار الاستيقاظ") setWakingDhikrList((items) => [...items, sleepItem]);
      else setMiscellaneousDhikrList((items) => [...items, sleepItem]);
    }
    const appendToCurrentSection = (item: MorningDhikr) => {
      if (activeDhikr === "السبحة") setTasbeehDhikr((items) => [...items.slice(0, rank - 1), item, ...items.slice(rank - 1)]);
      else if (activeDhikr === "أذكار المساء") setEveningDhikrList((items) => [...items, item]);
      else if (activeDhikr === "دخول البيت") setHomeEntryDhikrList((items) => [...items, item]);
      else if (activeDhikr === "الخروج من البيت") setHomeExitDhikrList((items) => [...items, item]);
      else if (activeDhikr === "أذكار الوضوء") { if (wuduBeforeDhikrIndex === 0) setWuduBeforeDhikrList((items) => [...items, item]); else setWuduAfterDhikrList((items) => [...items, item]); }
      else if (activeDhikr === "أذكار الطعام") { if (foodDhikrIndex === 0) setFoodBeforeDhikrList((items) => [...items, item]); else setFoodAfterDhikrList((items) => [...items, item]); }
      else if (!targetCustomCardId && (activeDhikr === "أذكار الصباح" || !activeDhikr)) setMorningDhikr((items) => [...items.slice(0, rank - 1), item, ...items.slice(rank - 1)]);
    };
    if (targetCustomCardId) {
      const targetCard = findCustomCard(customDhikrCards, targetCustomCardId);
      const nextCustomDhikrIndex = targetCard?.dhikrs.length ?? 0;
      const appendDhikr = (items: CustomDhikrCard[]): CustomDhikrCard[] => items.map((card) => card.id === targetCustomCardId ? { ...card, contentMode: "dhikrs", dhikrs: [...card.dhikrs, addedDhikr] } : { ...card, children: card.children ? appendDhikr(card.children) : card.children });
      setCustomDhikrCards(appendDhikr);
      setSelectedCustomCardId(targetCustomCardId);
      setCustomDhikrIndex(nextCustomDhikrIndex);
      setActiveDhikr(`custom:${targetCustomCardId}`);
      setCustomChildrenOpen(false);
    }
    if (!targetCustomCardId) {
      appendToCurrentSection(addedDhikr);
      if (activeDhikr === "السبحة") setTasbeehDhikrIndex(rank - 1);
      else if (activeDhikr === "أذكار الصباح" || !activeDhikr) setMorningDhikrIndex(rank - 1);
    }
    setDhikrCount(0);
    setShortVersion(false);
    // Keep the current view (normal or browse) open after adding a dhikr.
    setContinuePastTen(false);
    setContinuationPromptOpen(false);
    setAddDhikrOpen(false);
    notify(`تمت إضافة الذكر في المرتبة ${rank}`);
  };

  const moveMorningDhikr = (direction: -1 | 1) => {
    if (direction === 1) { setContinuationPromptOpen(false); setContinuePastTen(false); setDhikrCount(0); }
    if (activeDhikr === "حصن المسلم") {
      const nextIndex = fortressDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= activeFortressDhikrs.length) return;
      setFortressDhikrIndex(nextIndex);
      setFortressSelectedDhikr(activeFortressDhikrs[nextIndex] ?? null);
    } else if (activeDhikr === "السبحة") {
      const nextIndex = tasbeehDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= tasbeehDhikr.length) return;
      setTasbeehDhikrIndex(nextIndex);
    } else if (activeCustomCard) {
      const nextIndex = customDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= activeCustomCard.dhikrs.length) return;
      setCustomDhikrIndex(nextIndex);
    } else if ((activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") && sleepDhikrIndex !== null) {
      const nextIndex = sleepDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= activeSleepDhikr.length) return;
      setSleepDhikrIndex(nextIndex);
    } else if (activeDhikr === "أذكار المساء") {
      const nextIndex = eveningDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= eveningDhikrList.length) return;
      setEveningDhikrIndex(nextIndex);
    } else if (activeDhikr === "دخول البيت") {
      const nextIndex = homeEntryDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= homeEntryDhikrList.length) return;
      setHomeEntryDhikrIndex(nextIndex);
    } else if (activeDhikr === "الخروج من البيت") {
      const nextIndex = homeExitDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= homeExitDhikrList.length) return;
      setHomeExitDhikrIndex(nextIndex);
    } else if (activeDhikr === "أذكار الوضوء") {
      const nextIndex = wuduBeforeDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= 2) return;
      setWuduBeforeDhikrIndex(nextIndex);
    } else if (activeDhikr === "أذكار الطعام") {
      const nextIndex = foodDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= 2) return;
      setFoodDhikrIndex(nextIndex);
    } else {
      const nextIndex = morningDhikrIndex + direction;
      if (nextIndex < 0 || nextIndex >= morningDhikr.length) return;
      setMorningDhikrIndex(nextIndex);
    }
    setDhikrCount(0);
    setShortVersion(false);
    setContinuationPromptOpen(false);
    setContinuePastTen(false);
  };

  const moveDhikrManually = (direction: -1 | 1) => {
    setAudioCompletionPromptOpen(false);
    audioRepeatModeRef.current = false;
    setAudioRepeatMode(false);
    stopDhikrAudio();
    dhikrPlaybackSequenceRef.current = Math.max(0, sequenceIndex + direction);
    restartDhikrFromBeginningRef.current = false;
    moveMorningDhikr(direction);
  };

  const syncBrowseSequence = (nextIndex: number) => {
    if (nextIndex === sequenceIndex || nextIndex < 0 || nextIndex >= activeSequenceLength) return;
    setAudioCompletionPromptOpen(false);
    audioRepeatModeRef.current = false;
    setAudioRepeatMode(false);
    stopDhikrAudio();
    dhikrPlaybackSequenceRef.current = nextIndex;
    if (activeDhikr === "حصن المسلم") {
      setFortressDhikrIndex(nextIndex);
      setFortressSelectedDhikr(activeFortressDhikrs[nextIndex] ?? null);
    } else if (activeDhikr === "السبحة") setTasbeehDhikrIndex(nextIndex);
    else if (activeCustomCard) setCustomDhikrIndex(nextIndex);
    else if (activeDhikr === "أذكار الصباح") setMorningDhikrIndex(nextIndex);
    else if (activeDhikr === "أذكار المساء") setEveningDhikrIndex(nextIndex);
    else if (["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "")) setSleepDhikrIndex(nextIndex);
    else if (activeDhikr === "دخول البيت") setHomeEntryDhikrIndex(nextIndex);
    else if (activeDhikr === "الخروج من البيت") setHomeExitDhikrIndex(nextIndex);
    else if (activeDhikr === "أذكار الوضوء") setWuduBeforeDhikrIndex(nextIndex);
    else if (activeDhikr === "أذكار الطعام") setFoodDhikrIndex(nextIndex);
    setDhikrCount(0);
    setShortVersion(false);
    setContinuationPromptOpen(false);
    setContinuePastTen(false);
  };

  const handleBrowseScroll = (event?: React.UIEvent<HTMLDivElement>) => {
    const container = browseScrollAreaRef.current;
    if (!container) return;
    const bannerHeight = Math.max(1, container.parentElement?.querySelector<HTMLElement>(".dhikr-hero-banner")?.offsetHeight ?? 164);
    setBrowseBannerProgress(Math.min(1, Math.max(0, container.scrollTop / bannerHeight)));
    const center = container.getBoundingClientRect().top + container.clientHeight / 2;
    let closestIndex = sequenceIndex;
    let closestDistance = Number.POSITIVE_INFINITY;
    browseDhikrs.forEach((_item, index) => {
      const card = browseCardRefs.current[index];
      if (!card) return;
      const cardCenter = card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
    });
    syncBrowseSequence(closestIndex);
  };

  const themeHeroImage = resolveThemeHeroImage(themeId, themes.find((theme) => theme.id === themeId)?.heroImage);

  const effectiveDhikrTextColor = dhikrTypography.textColor;
  const effectiveDhikrTitleColor = dhikrTypography.titleColor;
  const dhikrTypographyStyle = {
    "--dhikr-text-size": `${dhikrTypography.textSize}px`,
    "--dhikr-title-size": `${dhikrTypography.titleSize}px`,
    "--dhikr-line-height": dhikrTypography.lineHeight,
    "--dhikr-title-gap": `${dhikrTypography.titleGap}px`,
    "--dhikr-text-color": effectiveDhikrTextColor,
    "--dhikr-title-color": effectiveDhikrTitleColor,
    "--dhikr-weight": dhikrTypography.bold ? 800 : 500,
    "--dhikr-style": dhikrTypography.italic ? "italic" : "normal",
    "--dhikr-decoration": dhikrTypography.underline ? "underline" : "none",
  } as React.CSSProperties;

  const settingsHeading = settingsView === "root" ? "الإعدادات"
    : settingsView === "general" ? "إعدادات عامة"
      : settingsView === "themeCategories" ? "إعدادات المظهر"
        : settingsView === "themes" ? "اختيار المظهر"
          : settingsView === "counter" ? "شكل العداد"
            : settingsView === "adhan" ? "إعدادات الأذان والصلاة"
              : settingsView === "sounds" ? "أصوات التنبيه والأذان والإقامة"
                : settingsView === "alerts" ? (alertsView === "before" ? "التنبيه قبل الصلاة" : alertsView === "adjust" ? "تصحيح وقت الصلاة" : alertsView === "iqama" ? "تنبيهات الإقامة" : "تنبيهات الأذان والصلاة والإقامة")
                  : adhkarSettingsView === "nawafil" ? "إعدادات النوافل"
                    : adhkarSettingsView === "friday" ? "إعدادات الجمعة"
                      : adhkarSettingsView === "fasting" ? "إعدادات الصيام"
                        : adhkarSettingsView === "daily" ? "الأذكار اليومية" : "إعدادات الأذكار";

  return (
    <>
      {activeSoundAlert && !adhanOverlayOpen && <div className={`active-sound-alert active-sound-alert-${activeSoundAlert.kind}`} role="status" aria-live="assertive"><span><strong>{activeSoundAlert.kind === "adhan" ? "الأذان" : activeSoundAlert.kind === "iqama" ? "الإقامة" : activeSoundAlert.kind === "before" ? "تنبيه قبل الأذان" : "التنبيه"}</strong><small>{activeSoundAlert.title}</small></span><button type="button" onClick={stopActiveSoundAlert} aria-label={`إغلاق ${activeSoundAlert.kind === "adhan" ? "الأذان" : activeSoundAlert.kind === "iqama" ? "الإقامة" : activeSoundAlert.kind === "before" ? "التنبيه قبل الأذان" : "التنبيه"}`}><X size={18} /> إيقاف</button></div>}
      {adhanOverlayOpen && adhanOverlayPrayer && adhanVideoUrl && <div className="adhan-fullscreen-overlay" role="dialog" aria-modal="true" aria-label={`أذان صلاة ${adhanOverlayPrayer}`}>
        <video ref={adhanOverlayVideoRef} className="adhan-fullscreen-video" src={adhanVideoUrl} muted playsInline preload="auto" />
        <button type="button" className="adhan-fullscreen-close" aria-label="إغلاق فيديو الأذان" onClick={closeAdhanOverlay}><X size={23} /></button>
        <div className="adhan-fullscreen-caption"><span>حان وقت أذان صلاة {adhanOverlayPrayer} بمدينة {selectedCity.city}</span></div>
      </div>}
      <div className={`app-shell theme-${themeId} ${darkMode ? "dark-mode" : ""}`} dir="rtl">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="hero-panel"><div className="hero-theme-photo" aria-hidden="true" style={{ backgroundImage: `url("${themeHeroImage}")` }} />
        <div className="hero-overlay" />
        <div className="hero-noise" />
        <div className="topbar">
          <div className="brand-lockup">
            <button type="button" className="brand-mark theme-toggle" aria-label={darkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"} onClick={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }}>{darkMode ? <SunMedium size={17} /> : <MoonStar size={17} fill="currentColor" />}</button>
            <div>
              <span className="brand-name">المصلى</span>
              <span className="brand-tagline">رفيقك إلى الطمأنينة</span>
            </div>
          </div>
          <div className="top-actions">
            <HeaderButton label="الموقع الحالي" onClick={openLocation}><MapPin size={18} /></HeaderButton>
            <HeaderButton label="الإشعارات" onClick={() => notify("لا توجد إشعارات جديدة") }><Bell size={18} /></HeaderButton>
            <button className="avatar-button" type="button" aria-label="الملف الشخصي" onClick={() => notify("مرحباً بك في المصلى")}>م</button>
          </div>
        </div>

        <div className="hero-content">
          <span className="hero-clock-photo" aria-hidden="true" style={{ backgroundImage: `url("${prayerSceneUrl(activePrayer)}")` }} />
          <button type="button" className="location-label location-label-button" onClick={openLocation}><span className="live-dot" /> {selectedCity.city}، {selectedCity.country} <ChevronLeft size={14} /></button>
          <p className="hero-eyebrow">{prayerStatus.elapsed ? `مضى على أذان ${prayerStatus.selectedPrayer.arabic}` : `تبقى على أذان ${prayerStatus.selectedPrayer.arabic}`}</p>
          <div className="hero-countdown" aria-label={`${prayerStatus.elapsed ? "الوقت المنقضي" : "الوقت المتبقي"} ${prayerStatus.duration.hours} ساعة و${prayerStatus.duration.minutes} دقيقة`}>
            <span>{prayerStatus.duration.hours}</span><b>:</b><span>{prayerStatus.duration.minutes}</span><b>:</b><span>{prayerStatus.duration.secs}</span>
          </div>
          <div className="next-prayer-pill"><span className="next-prayer-icon"><CloudSun size={16} /></span><span>{prayerStatus.selectedPrayer.arabic}</span><i>{prayerStatus.selectedPrayer.time} م</i><span>{prayerStatus.elapsed ? "بعد الأذان" : "الصلاة القادمة"}</span></div>
        </div>

        <section className="radial-prayer-stage" aria-label="مواقيت الصلاة حول الساعة">
          <div className="radial-orbit radial-orbit-outer" />
          <div className="radial-orbit radial-orbit-inner" />
          {activePrayers.map((prayer, index) => {
            const Icon = prayer.icon;
            const selected = activePrayer === prayer.arabic;
            const weekdayIndex = getWeekdayIndexInTimeZone(now, selectedCity.timeZone);
            const iqamaWeekPlan = iqamaWeekPlans[prayer.arabic] ?? defaultIqamaWeekPlan(iqamaMinutes[prayer.arabic] ?? 15);
            const iqamaMinutesForToday = iqamaWeekPlan.minutesByDay[weekdayIndex] ?? iqamaMinutes[prayer.arabic] ?? 15;
            const iqamaCountdown = formatIqamaCountdown(prayer.minuteOfDay, currentCitySeconds, iqamaMinutesForToday, Boolean(iqamaEnabled[prayer.arabic] && iqamaWeekPlan.enabledDays.includes(weekdayIndex)));
            return <button key={`radial-${prayer.arabic}`} type="button" className={`radial-prayer-card radial-prayer-card-${index + 1} ${selected ? "is-active" : ""}`} onClick={() => selectPrayerManually(prayer)}><span className="radial-prayer-photo" aria-hidden="true" style={{ backgroundImage: `url("${prayerSceneUrl(prayer.arabic)}")` }} /><span className={`radial-prayer-icon icon-${prayer.tone}`}><Icon size={24} strokeWidth={1.6} /></span><strong>{prayer.arabic}</strong><time>{prayer.time} <small>م</small></time>{iqamaCountdown && <span className="radial-prayer-iqama" aria-label={`المتبقي للإقامة: ${iqamaCountdown}`}>{iqamaCountdown}</span>}{prayer.arabic === prayerStatus.automaticPrayer.arabic && <span className="radial-prayer-status">{prayerStatus.elapsed ? "مؤداة" : "القادمة"}</span>}</button>;
          })}
          {features.map((feature, index) => {
            const angle = -90 + (index * 360) / features.length;
            const featureImage = featureSceneUrl(feature.title);
            const toolImage = featureImage
              ?? (feature.title === "مساجد"
                ? prayerSceneUrl("الظهر")
                : feature.title === "القبلة"
                  ? prayerSceneUrl("الفجر")
                  : feature.title === "الأذكار"
                    ? adhkarSceneUrl("أذكار الصباح")
                    : feature.title === "منبه الفجر"
                      ? prayerSceneUrl("الفجر")
                      : themeHeroImage);
            const action = feature.title === "مساجد" ? () => setMosquesOpen(true) : feature.title === "القبلة" ? () => setQiblaOpen(true) : feature.title === "السبحة" ? () => { setActiveDhikr("السبحة"); setTasbeehDhikrIndex(0); setDhikrCount(0); setShortVersion(false); setExpandedDhikr(false); setContinuationPromptOpen(false); setContinuePastTen(false); } : feature.title === "الأذكار" ? () => setAdhkarOpen(true) : feature.title === "حصن المسلم" ? () => { setFortressView("root"); setFortressCategory(null); setFortressPrayerCategory(null); setFortressOpen(true); } : feature.title === "منبه الفجر" ? () => { setFajrAlarmOpen(true); } : feature.title === "التقويم" ? openCalendar : feature.title === "في مثل هذا اليوم" ? openHistory : feature.title === "الإعدادات" ? openSettings : () => notify(`${feature.title} — هذه الميزة قيد الإعداد`);
            return <button key={`radial-tool-${feature.title}`} type="button" className={`radial-utility-node radial-utility-all theme-tool-${feature.tone} ${feature.title === "في مثل هذا اليوم" || feature.title === "حصن المسلم" ? "radial-utility-long-label" : ""}`} style={{ "--tool-angle": `${angle}deg` } as React.CSSProperties} onClick={action}><img className="utility-card-photo" src={toolImage} alt="" aria-hidden="true" /><span className="utility-art" aria-hidden="true"><img className="utility-art-photo" src={toolImage} alt="" /></span><strong>{feature.title === "في مثل هذا اليوم" ? <>في مثل هذا<br />اليوم</> : feature.title === "حصن المسلم" ? <>حصن<br />المسلم</> : feature.title}</strong></button>;
          })}
        </section>

        <div className="hero-bottom-note"><span>« وَأَقِمِ الصَّلَاةَ لِذِكْرِي »</span><span className="note-line" /><span>طه 14</span></div>
      </header>

      {mosquesOpen && <MosquesModal city={selectedCity} onClose={() => setMosquesOpen(false)} />}
      {qiblaOpen && <QiblaModal city={selectedCity} darkMode={darkMode} onClose={() => setQiblaOpen(false)} />}

      {calendarOpen && (
        <div className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
          <div className="calendar-backdrop" onClick={() => setCalendarOpen(false)} />
          <section className="calendar-sheet">
            <div className="calendar-topbar">
              <button type="button" className="calendar-close" aria-label="إغلاق" onClick={() => setCalendarOpen(false)}><X size={18} /></button>
              <div className="calendar-title-wrap"><span className="calendar-title-icon"><CalendarDays size={20} /></span><div><h2 id="calendar-title">روزنامة مواقيت الصلاة</h2><p>{selectedCity.city}، {selectedCity.country}</p><small>{calendarDays.find((entry) => entry)?.hijri.split(" ").slice(1).join(" ")}</small></div></div>
              <button type="button" className="calendar-today" onClick={openCalendar}>اليوم</button>
            </div>
            <div className="calendar-navigation"><button type="button" aria-label="الشهر السابق" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={19} /></button><strong>{calendarMonthLabel}</strong><button type="button" aria-label="الشهر التالي" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={19} /></button></div>
            <div className="calendar-legend"><span><i className="calendar-dot calendar-dot-fajr" /> الفجر</span><span><i className="calendar-dot calendar-dot-sun" /> الشروق</span><span><i className="calendar-dot calendar-dot-dhuhr" /> الظهر</span><span><i className="calendar-dot calendar-dot-asr" /> العصر</span><span><i className="calendar-dot calendar-dot-sunset" /> المغرب</span><span><i className="calendar-dot calendar-dot-isha" /> العشاء</span></div>
            <div className="calendar-grid calendar-weekdays">{["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid calendar-days">{calendarDays.map((entry, index) => entry ? <article key={entry.key} className={`calendar-day ${entry.current ? "calendar-day-current" : ""}`}><header><b>{entry.day}</b>{entry.current && <small>اليوم</small>}</header><div className="calendar-hijri">{entry.hijri}</div><div className="calendar-times"><span><i className="calendar-dot calendar-dot-fajr" /> الفجر <b>{entry.schedule[0]?.time}</b></span><span><i className="calendar-dot calendar-dot-sun" /> الشروق <b>{entry.schedule[1]?.time}</b></span><span><i className="calendar-dot calendar-dot-dhuhr" /> الظهر <b>{entry.schedule[2]?.time}</b></span><span><i className="calendar-dot calendar-dot-asr" /> العصر <b>{entry.schedule[3]?.time}</b></span><span><i className="calendar-dot calendar-dot-sunset" /> المغرب <b>{entry.schedule[4]?.time}</b></span><span><i className="calendar-dot calendar-dot-isha" /> العشاء <b>{entry.schedule[5]?.time}</b></span></div></article> : <span className="calendar-empty" key={`empty-${index}`} />)}</div>
            <p className="calendar-note">التاريخ الهجري معروض لكل يوم، وتُحسب المواقيت يوميًا حسب إحداثيات {selectedCity.city} والتوقيت المحلي.</p>
          </section>
        </div>
      )}

      {historyOpen && (
        <div className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
          <div className="history-backdrop" onClick={() => setHistoryOpen(false)} />
          <section className="history-sheet">
            <div className="history-topbar">
              <button type="button" className="history-close" aria-label="إغلاق" onClick={() => setHistoryOpen(false)}><X size={18} /></button>
              <div className="history-title-wrap"><span className="history-title-icon"><History size={20} /></span><div><h2 id="history-title">في مثل هذا اليوم</h2><p>{selectedCity.city}، {selectedCity.country}</p></div></div>
              <button type="button" className="history-settings" aria-label="إعدادات التاريخ الهجري" title="إعدادات التاريخ الهجري" onClick={() => setHistoryAdjustmentOpen((open) => !open)}><Settings2 size={18} /></button>
            </div>
            {historyAdjustmentOpen && <section className="history-adjustment" aria-label="ضبط عدد أيام الشهر الهجري"><h3>ضبط عدد أيام الشهر الهجري</h3><p>اختر طول الشهر القمري يدويًا: 29 أو 30 يومًا. سيُحفظ الاختيار لهذا العرض حتى تغيّره.</p><div className="history-adjustment-actions"><button type="button" aria-label="جعل الشهر 29 يومًا" onClick={() => setHistoryMonthLength(29)}>− يوم</button><strong>{historyMonthLengthOverride ? `${historyMonthLengthOverride} يومًا` : `${automaticHistoryMonthLength} يومًا تلقائيًا`}</strong><button type="button" aria-label="جعل الشهر 30 يومًا" onClick={() => setHistoryMonthLength(30)}>+ يوم</button></div>{historyMonthLengthOverride && <button type="button" className="history-adjustment-reset" onClick={resetHistoryMonthLength}>إعادة الحساب التلقائي</button>}</section>}
            <div className="history-years"><span>السنة الميلادية</span><strong>{historyGregorianYears.join(" / ")}</strong><i>•</i><span>السنة الهجرية</span><strong>{historyHijriYears.join(" / ")}</strong></div>
            <div className="history-mode-switch" role="group" aria-label="نوع التقويم"><button type="button" className={historyCalendarMode === "gregorian" ? "is-active" : ""} onClick={() => { setHistoryCalendarMode("gregorian"); setSelectedHistoryKey(""); }}>ميلادي</button><button type="button" className={historyCalendarMode === "islamic" ? "is-active" : ""} onClick={() => { setHistoryCalendarMode("islamic"); setSelectedHistoryKey(""); }}>هجري</button></div>
            <div className="history-month-heading"><button type="button" aria-label="الشهر السابق" onClick={historyPreviousMonth}><ChevronRight size={19} /></button><span><CalendarDays size={17} /><strong>{historyMonthLabel}</strong><small>{historyCalendarMode === "gregorian" ? "التقويم الميلادي الأساسي" : "التقويم الهجري الأساسي"}</small></span><button type="button" aria-label="الشهر التالي" onClick={historyNextMonth}><ChevronLeft size={19} /></button></div>
            <div className="history-grid history-weekdays">{["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="history-grid history-days">{historyCalendarDays.map((entry, index) => entry ? <button type="button" key={entry.key} className={`history-day ${entry.current ? "history-day-current" : ""} ${entry.key === selectedHistoryEntry?.key ? "history-day-selected" : ""} ${entry.hasMarkedEvent ? "history-day-event" : ""}`} onClick={() => setSelectedHistoryKey(entry.key)}><b>{historyCalendarMode === "gregorian" ? entry.gregorianDay : entry.islamic.day}</b><span>{historyCalendarMode === "gregorian" ? `${entry.islamic.day} ${islamicMonthNames[entry.islamic.month - 1] ?? ""}` : `${entry.gregorianDay}/${entry.gregorianMonth}`}</span>{entry.current && <small>اليوم</small>}{entry.hasMarkedEvent && <i aria-label={`${entry.events.length} أحداث`} />}</button> : <span className="history-empty" key={`history-empty-${index}`} />)}</div>
             <section className="history-events" aria-labelledby="history-events-title"><h3 id="history-events-title"><History size={17} /> {selectedHistoryEntry?.events.length ? "أحداث اليوم" : "أحداث الشهر"}</h3><p className="history-selected-date">{selectedHistoryEntry?.events.length && selectedHistoryEntry ? `${selectedHistoryEntry.gregorianDay} ${new Intl.DateTimeFormat("ar-MA", { month: "long" }).format(selectedHistoryEntry.date)} · ${selectedHistoryEntry.islamic.day} ${islamicMonthNames[selectedHistoryEntry.islamic.month - 1]}` : historyMonthLabel}</p>{selectedHistoryEntry?.events.length ? <div className="history-event-list">{selectedHistoryEntry.events.map((event, index) => <article className="history-event" key={`${event.month}-${event.day}-${event.title}-${index}`}><time><strong>{eventDayLabel(event)}</strong><span>{islamicMonthNames[event.month - 1]}</span></time><p>{event.title}</p></article>)}</div> : historyMonthEvents.length ? <div className="history-event-list">{historyMonthEvents.map((event, index) => <article className="history-event" key={`${event.month}-${event.day}-${event.title}-${index}`}><time><strong>{eventDayLabel(event)}</strong><span>{islamicMonthNames[event.month - 1]}</span></time><p>{event.title}</p></article>)}</div> : <p className="history-no-events">لا توجد أحداث مسجلة لهذا الشهر حتى الآن.</p>}</section>
             <p className="history-note">اضغط على يوم يحوي علامة لعرض أحداثه، أو اختر أي يوم لاستعراض أحداث الشهر. اليوم الحالي مميز بإطار ووسم «اليوم».</p>
          </section>
        </div>
      )}

      {locationOpen && (
        <div className="location-modal" role="dialog" aria-modal="true" aria-labelledby="location-title">
          <div className="location-backdrop" onClick={() => setLocationOpen(false)} />
          <section className="location-sheet">
            <div className="location-topbar"><div className="location-title-wrap"><span className="location-title-icon"><MapPin size={19} /></span><div><h2 id="location-title">تحديد الموقع</h2><p>{prayerMethodLabel}</p></div></div><button type="button" className="location-close" aria-label="إغلاق" onClick={() => setLocationOpen(false)}><X size={18} /></button></div>
            {locationMode === "options" ? <div className="location-options"><LocationOption icon={<Navigation size={20} />} title="تحديد تلقائي" description="استخدم GPS لمعرفة موقعك الحالي" onClick={useCurrentLocation} /><LocationOption icon={<Search size={20} />} title="اختيار يدوي" description="ابحث عن الدولة ثم المدينة" onClick={() => setLocationMode("manual")} /></div> : <div className="location-manual"><button type="button" className="location-back-link" onClick={() => { setLocationMode("options"); setLocationQuery(""); }}><ArrowLeft size={15} /> طرق تحديد أخرى</button><div className="location-breadcrumb"><span className={locationStep === "country" ? "active" : "done"}>الدولة</span><i>‹</i><span className={locationStep === "city" ? "active" : ""}>المدينة</span></div><label className="location-search"><Search size={17} /><input autoFocus value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={locationStep === "country" ? "اكتب اسم الدولة..." : "اكتب اسم المدينة..."} /></label><div className="location-results">{locationStep === "country" ? (filteredCountries.length ? filteredCountries.map((country) => <button type="button" key={country} onClick={() => chooseCountry(country)}><span>{country}<small>{citySchedules.filter((city) => city.country === country).length} مدينة</small></span><ChevronLeft size={16} /></button>) : <p>لا توجد دولة بهذا الاسم</p>) : (filteredCities.length ? filteredCities.map((city) => <button type="button" key={city.city} onClick={() => chooseCity(city)}><span><strong>{city.city}</strong><small>{city.country}</small></span><ChevronLeft size={16} /></button>) : <p>لا توجد مدينة بهذا الاسم</p>)}</div></div>}
            {locationStatus && <p className="location-status">{locationStatus}</p>}
          </section>
        </div>
      )}

      {fortressOpen && (
        <div className="adhkar-modal fortress-modal" role="dialog" aria-modal="true" aria-labelledby="fortress-title">
          <div className="adhkar-backdrop" onClick={() => setFortressOpen(false)} />
          <section className="adhkar-sheet fortress-sheet">
            <div className="adhkar-topbar">
              <button type="button" className="adhkar-back" aria-label={fortressView === "root" ? "إغلاق" : "العودة"} onClick={() => {
                if (fortressView === "root") { setFortressOpen(false); return; }
                if (fortressView === "prayer") { setFortressView("root"); setFortressCategory(null); return; }
                if (fortressView === "qunut") { setFortressView("prayer"); setFortressPrayerCategory(null); return; }
                if (fortressView === "illness") { setFortressView("root"); setFortressCategory(null); return; }
                if (fortressView === "entries") {
                  if (fortressSectionKey.startsWith("prayer:دعاء القنوت:")) { setFortressView("qunut"); setFortressPrayerCategory(null); }
                  else if (fortressCategory === "أذكار الصلاة") { setFortressView("prayer"); setFortressPrayerCategory(null); }
                  else { setFortressView("root"); setFortressCategory(null); setFortressPrayerCategory(null); }
                  return;
                }
                if (fortressCategory === "أذكار الصلاة" && fortressPrayerCategory) { setFortressView("prayer"); setFortressPrayerCategory(null); }
                else { setFortressView("root"); setFortressCategory(null); setFortressPrayerCategory(null); }
              }}><ArrowLeft size={19} /></button>
              <h2 id="fortress-title">{fortressView === "root" ? "حصن المسلم" : fortressView === "prayer" ? "أذكار الصلاة" : fortressView === "qunut" ? "دعاء القنوت" : fortressView === "illness" ? "أذكار المرض والهم والدين" : fortressView === "entries" ? (fortressPrayerCategory ?? fortressCategory ?? "الأذكار") : fortressPrayerCategory ?? fortressCategory ?? "حصن المسلم"}</h2>
              <div className="adhkar-top-actions">
                <ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} />
                <button type="button" className="adhkar-edit" aria-label="إعدادات الأذكار" title="إعدادات الأذكار" onClick={() => { setFortressOpen(false); setSettingsView("adhkar"); setAdhkarSettingsView("root"); setSettingsOpen(true); }}><Settings2 size={17} /></button>
                {(fortressView === "root" || fortressView === "prayer") && <>
                  {fortressArrangeMode ? <button type="button" className="adhkar-edit fortress-done-button" onClick={() => setFortressArrangeMode(false)}>تم</button> : <button type="button" className="adhkar-edit" aria-label="إضافة أيقونة" title="إضافة أيقونة" onClick={() => { setFortressOpen(false); resetCardForm(); setParentCardId(null); setCustomCardMode(null); setCardCreateForFortress(true); setFortressIconParentSection(fortressView === "root" ? "root" : "أذكار الصلاة"); setCardCreateMode("icon"); setCardCreateOpen(true); }}><Plus size={18} /></button>}
                </>}
                {fortressView === "entries" && <button type="button" className="adhkar-edit" aria-label="إضافة ذكر" title="إضافة ذكر" onClick={openAddFortressDhikr}><Plus size={18} /></button>}
              </div>
            </div>
            <p className="adhkar-intro">{fortressView === "root" ? "اختر بابًا من أبواب حصن المسلم" : fortressView === "prayer" ? "اختر موضع الذكر في الصلاة" : fortressView === "qunut" ? "اختر نوع دعاء القنوت" : fortressView === "illness" ? "اختر قسم الأذكار" : fortressView === "entries" ? "أدعية الصلاة الواردة، مع مصادرها" : "لم تُضف النصوص لهذا الباب بعد. أرسل الأذكار ومصادرها لأدرجها كما هي دون تغيير."}</p>
            {fortressView === "root" && <div className="adhkar-grid fortress-grid">{fortressRootOrder.map((id) => {
              const card = fortressCategories.find((entry) => entry.title === id) ?? customDhikrCards.find((entry) => entry.id === id && entry.scope === "fortress" && entry.fortressParentSection === "root");
              if (!card) return null;
              const customCard = "id" in card;
              const Icon = customCard ? ImageIcon : card.icon;
              const cardId = customCard ? card.id : card.title;
              const background = customCard ? card.background : adhkarBackgrounds[cardId];
              const cover = background ? (background.startsWith("#") ? undefined : background) : fortressSceneUrl(card.title);
              return <div key={cardId} className={`adhkar-card-wrap ${fortressArrangeMode ? "is-draggable" : ""} ${fortressDraggedCardId === cardId ? "is-dragging" : ""}`} draggable={fortressArrangeMode} onDragStart={() => fortressArrangeMode && setFortressDraggedCardId(cardId)} onDragOver={(event) => { if (fortressArrangeMode) event.preventDefault(); }} onDrop={() => fortressArrangeMode && dropFortressCard(cardId)} onDragEnd={() => setFortressDraggedCardId(null)} style={background?.startsWith("#") ? { backgroundColor: background } : undefined}>
                {cover && <img className="adhkar-cover-image" src={cover} alt="" aria-hidden="true" />}
                <button type="button" className="adhkar-card fortress-category-card" onClick={() => {
                  if (fortressArrangeMode) return;
                  if (customCard) { setFortressOpen(false); setCustomCardHistory([]); setSelectedCustomCardId(card.id); setCustomDhikrIndex(0); if (card.contentMode === "dhikrs" && card.dhikrs.length) { setActiveDhikr(`custom:${card.id}`); } else setCustomChildrenOpen(true); return; }
                  setFortressCategory(card.title); setFortressPrayerCategory(null); if (card.title === "أذكار الصلاة") setFortressView("prayer"); else if (card.title === "أذكار المرض والهم والدين") setFortressView("illness"); else {
                    const sectionKey = `root:${card.title}`;
                    const sectionDhikrs = fortressDhikrLists[sectionKey] ?? [];
                    setFortressSectionKey(sectionKey);
                    setFortressDhikrIndex(0);
                    setFortressSelectedDhikr(sectionDhikrs[0] ?? null);
                    setFortressPrayerCategory(["أذكار السفر", "أذكار الظواهر الكونية", "أذكار الخوف والفزع", "أذكار خاصة بالحيوانات"].includes(card.title) ? card.title : null);
                    if (sectionDhikrs.length) {
                      setActiveDhikr("حصن المسلم");
                      setDhikrCount(0);
                      setShortVersion(false);
                      setExpandedDhikr(false);
                      setContinuationPromptOpen(false);
                      setContinuePastTen(false);
                      setFortressOpen(false);
                    } else {
                      setFortressView("entries");
                    }
                  }
                }}>{customCard && card.iconUrl && <span className="adhkar-icon feature-mint" style={{ backgroundImage: `url(${card.iconUrl})`, backgroundSize: "cover" }} />}<strong className="adhkar-card-title">{card.title}</strong><small className="adhkar-card-caption">{card.caption}</small></button>
                <button type="button" className="adhkar-card-menu-button" aria-label={`خيارات ${card.title}`} onClick={() => setCardMenuOpen(cardId)}><MoreHorizontal size={16} /></button>
                {cardMenuOpen === cardId && <div className="adhkar-card-menu"><button type="button" onClick={() => { setFortressArrangeMode(true); setCardMenuOpen(null); }}>تحريك هذا الإعداد</button>{customCard && <button type="button" onClick={() => removeCustomCard(card.id)}>حذف</button>}<button type="button" onClick={() => { setCardMenuOpen(null); setCardBackgroundOpen(cardId); }}>تغيير لون أو صورة الخلفية</button></div>}
              </div>;
            })}</div>}
            {fortressView === "prayer" && <div className="adhkar-grid fortress-grid">{fortressPrayerOrder.map((id) => {
              const card = prayerDhikrSections.find((entry) => entry.title === id) ?? customDhikrCards.find((entry) => entry.id === id && entry.scope === "fortress" && entry.fortressParentSection === "أذكار الصلاة");
              if (!card) return null;
              const customCard = "id" in card;
              const Icon = customCard ? ImageIcon : card.icon;
              const cardId = customCard ? card.id : card.title;
              const background = customCard ? card.background : adhkarBackgrounds[cardId];
              const cover = background ? (background.startsWith("#") ? undefined : background) : fortressSceneUrl(card.title);
              return <div key={cardId} className={`adhkar-card-wrap ${fortressArrangeMode ? "is-draggable" : ""} ${fortressDraggedCardId === cardId ? "is-dragging" : ""}`} draggable={fortressArrangeMode} onDragStart={() => fortressArrangeMode && setFortressDraggedCardId(cardId)} onDragOver={(event) => { if (fortressArrangeMode) event.preventDefault(); }} onDrop={() => fortressArrangeMode && dropFortressCard(cardId)} onDragEnd={() => setFortressDraggedCardId(null)} style={background?.startsWith("#") ? { backgroundColor: background } : undefined}>
                {cover && <img className="adhkar-cover-image" src={cover} alt="" aria-hidden="true" />}
                <button type="button" className="adhkar-card fortress-category-card" onClick={() => {
                  if (fortressArrangeMode) return;
                  if (customCard) { setFortressOpen(false); setCustomCardHistory([]); setSelectedCustomCardId(card.id); setCustomDhikrIndex(0); if (card.contentMode === "dhikrs" && card.dhikrs.length) setActiveDhikr(`custom:${card.id}`); else setCustomChildrenOpen(true); return; }
                  if (card.title === "دعاء القنوت") {
                    setFortressCategory("أذكار الصلاة");
                    setFortressPrayerCategory(null);
                    setFortressSectionKey("");
                    setFortressView("qunut");
                    return;
                  }
                  if (card.title === "أدعية استفتاح الصلاة") {
                    setFortressOpen(false);
                    setFortressPrayerCategory(card.title);
                    setFortressSectionKey(`prayer:${card.title}`);
                    setFortressDhikrIndex(0);
                    setFortressSelectedDhikr(fortressOpeningDhikrs[0] ?? null);
                    setActiveDhikr("حصن المسلم");
                    setDhikrCount(0);
                    setExpandedDhikr(false);
                    setContinuationPromptOpen(false);
                    setContinuePastTen(false);
                    return;
                  }
                  const sectionKey = `prayer:${card.title}`;
                  const sectionDhikrs = fortressDhikrLists[sectionKey] ?? [];
                  setFortressPrayerCategory(card.title);
                  setFortressSectionKey(sectionKey);
                  setFortressDhikrIndex(0);
                  setFortressSelectedDhikr(sectionDhikrs[0] ?? null);
                  setDhikrCount(0);
                  setShortVersion(false);
                  setExpandedDhikr(false);
                  setContinuationPromptOpen(false);
                  setContinuePastTen(false);
                  if (sectionDhikrs.length === 0) {
                    // Keep empty Fortress sections in their own window so the user
                    // sees the add-dhikr action instead of a blank parchment.
                    setActiveDhikr(null);
                    setFortressView("entries");
                    setFortressOpen(true);
                  } else {
                    setActiveDhikr("حصن المسلم");
                    setFortressOpen(false);
                  }
                }}>{customCard && card.iconUrl && <span className="adhkar-icon feature-mint" style={{ backgroundImage: `url(${card.iconUrl})`, backgroundSize: "cover" }} />}<strong className="adhkar-card-title">{card.title}</strong><small className="adhkar-card-caption">{card.caption}</small></button>
                <button type="button" className="adhkar-card-menu-button" aria-label={`خيارات ${card.title}`} onClick={() => setCardMenuOpen(cardId)}><MoreHorizontal size={16} /></button>
                {cardMenuOpen === cardId && <div className="adhkar-card-menu"><button type="button" onClick={() => { setFortressArrangeMode(true); setCardMenuOpen(null); }}>تحريك هذا الإعداد</button>{customCard && <button type="button" onClick={() => removeCustomCard(card.id)}>حذف</button>}<button type="button" onClick={() => { setCardMenuOpen(null); setCardBackgroundOpen(cardId); }}>تغيير لون أو صورة الخلفية</button></div>}
              </div>;
            })}</div>}
            {fortressView === "qunut" && <>
              <div className="adhkar-grid fortress-grid fortress-qunut-grid">
                {[{ title: "صلاة الفجر", key: "صلاة الفجر", caption: "قنوت الفجر" }, { title: "صلاة الوتر", key: "صلاة الوتر", caption: "قنوت الوتر" }, { title: "عند النوازل", key: "عند النوازل", caption: "قنوت النوازل" }].map(({ title, key, caption }) => {
                  const cover = fortressSceneUrl(title);
                  return <div className="adhkar-card-wrap fortress-qunut-card" key={key}>
                    {cover && <img className="adhkar-cover-image" src={cover} alt="" aria-hidden="true" />}
                    <button type="button" className="adhkar-card fortress-category-card" onClick={() => { const sectionKey = `prayer:دعاء القنوت:${key}`; const firstDhikr = fortressDhikrLists[sectionKey]?.[0] ?? null; setFortressPrayerCategory(title); setFortressSectionKey(sectionKey); setFortressDhikrIndex(0); setFortressSelectedDhikr(firstDhikr); setDhikrCount(0); setShortVersion(false); setExpandedDhikr(false); setContinuationPromptOpen(false); setContinuePastTen(false); setActiveDhikr("حصن المسلم"); setFortressOpen(false); }}><strong className="adhkar-card-title">{title}</strong><small className="adhkar-card-caption">{caption}</small></button>
                  </div>;
                })}
              </div>
            </>}
            {fortressView === "illness" && <>
              <div className="adhkar-grid fortress-grid fortress-illness-grid">
                {[{ title: "المرض", key: "المرض", caption: "أذكار المريض وزيارته" }, { title: "الهم والكرب", key: "أذكار الهم والكرب", caption: "أذكار الهم والكرب" }, { title: "قضاء الدين", key: "أذكار قضاء الدين", caption: "أذكار قضاء الدين" }].map(({ title, key, caption }) => {
                  const cover = fortressSceneUrl(title);
                  return <div className="adhkar-card-wrap fortress-illness-card" key={key}>
                    {cover && <img className="adhkar-cover-image" src={cover} alt="" aria-hidden="true" />}
                    <button type="button" className="adhkar-card fortress-category-card" onClick={() => { const sectionKey = `root:أذكار المرض والهم والدين:${key}`; const firstDhikr = fortressDhikrLists[sectionKey]?.[0] ?? null; setFortressPrayerCategory(title); setFortressSectionKey(sectionKey); setFortressDhikrIndex(0); setFortressSelectedDhikr(firstDhikr); setDhikrCount(0); setShortVersion(false); setExpandedDhikr(false); setContinuationPromptOpen(false); setContinuePastTen(false); setActiveDhikr("حصن المسلم"); setFortressOpen(false); }}><strong className="adhkar-card-title">{title}</strong><small className="adhkar-card-caption">{caption}</small></button>
                  </div>;
                })}
              </div>
            </>}
            {fortressView === "entries" && <>
              {fortressSectionKey === "prayer:دعاء القنوت:صلاة الفجر" && <p className="fortress-section-note">المالكية يسن عندهم القنوت في صلاة الفجر ويستحبون أن يكون قبل الركوع ويستحب عند المالكية الإسرار بالدعاء في القنوت</p>}
              {fortressSectionKey === "prayer:صلاة الجنازة" && <p className="fortress-section-note">أن يكبر أولاً ثم يستعيذ بالله من الشيطان الرجيم ويسمي ويقرأ الفاتحة وسورة قصيرة أو بعض الآيات. ثم يكبر ويصلي على النبي صلى الله عليه وسلم مثلما يصلي عليه في آخر الصلاة. ثم يكبر الثالثة ويدعو للميت. ثم يكبر الرابعة ويقف قليلاً ثم يسلم تسليمة واحدة عن يمينه</p>}
              {fortressSectionKey === "prayer:صلاة الاستخارة" && <p className="fortress-section-note">فيصلي ركعتين من غير الفريضة يقرأ فيهما بالفاتحة وما تيسر من القرآن</p>}
              {fortressSectionKey === "root:أذكار الأذان" && <p className="fortress-section-note">يَقُولُ مِثْلَ مَا يَقُولُ الـمُؤَذِّنُ إلاَّ فِي "حَيَّ عَلَى الصَّلاةِ وَحَيَّ عَلَى الفَلاَحِ" فَيَقُولُ: "لاَ حَوْلَ وَلا قُوَّةَ إلاَّ باللَّهِ</p>}
              {(() => {
                const builtIns = fortressSectionKey === "prayer:أدعية استفتاح الصلاة" ? fortressOpeningDhikrs : [];
                const items = [...builtIns, ...(fortressDhikrLists[fortressSectionKey] ?? [])];
                return items.length ? <div className="fortress-opening-list">{items.map((item, index) => <button type="button" className="fortress-opening-card" key={`${fortressSectionKey}-${index}`} onClick={() => { setFortressDhikrIndex(index); setFortressSelectedDhikr(item); setActiveDhikr("حصن المسلم"); setDhikrCount(0); setShortVersion(false); setExpandedDhikr(false); setContinuationPromptOpen(false); setContinuePastTen(false); }}><span className="fortress-opening-number">{index + 1}</span>{item.title && !isGenericNumberedDhikrTitle(item.title) && <strong>{item.title}</strong>}<p dir="rtl">{item.text}</p><small>{item.source}{item.references ? ` · ${item.references}` : ""}</small><span className="fortress-opening-action">افتح الذكر <ChevronLeft size={15} /></span></button>)}</div> : <div className="fortress-empty-state"><span><BookOpenText size={29} /></span><strong>لا توجد أذكار مضافة لهذا الباب بعد</strong><p>أضف ذكرًا لهذا القسم، ويمكنك تحديد عنوانه ونصه وعدد مرات تكراره ومصدره ومراجعه.</p><button type="button" className="fortress-add-dhikr-button" onClick={openAddFortressDhikr}><Plus size={16} /> إضافة ذكر</button></div>;
              })()}
            </>}
            {fortressView === "empty" && <div className="fortress-empty-state"><span><BookOpenText size={29} /></span><strong>لا توجد أذكار في هذا الباب بعد</strong><p>يمكنك إضافة الذكر يدويًا إلى هذا الباب مع عنوانه ونصه ومصدره ومرجعه.</p><button type="button" className="fortress-add-dhikr-button" onClick={openAddFortressDhikr}><Plus size={16} /> إضافة ذكر</button></div>}
          </section>
        </div>
      )}

      {adhkarOpen && (
        <div className="adhkar-modal" role="dialog" aria-modal="true" aria-labelledby="adhkar-title">
          <div className="adhkar-backdrop" onClick={() => setAdhkarOpen(false)} />
          <section className="adhkar-sheet">
            <div className="adhkar-topbar">
              <button type="button" className="adhkar-back" aria-label="العودة" onClick={() => setAdhkarOpen(false)}><ArrowLeft size={19} /></button>
              <h2 id="adhkar-title">الأذكار</h2>
              <div className="adhkar-top-actions"><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} /><button type="button" className="adhkar-edit" aria-label="إعدادات الأذكار" onClick={() => { setAdhkarOpen(false); setSettingsView("adhkar"); setAdhkarSettingsView("root"); setSettingsOpen(true); }}><Settings2 size={18} /></button><button type="button" className="adhkar-edit" aria-label="إضافة أيقونة" onClick={() => { resetCardForm(); setCardCreateForFortress(false); setParentCardId(null); setCustomCardMode(null); setCardCreateMode("icon"); setCardCreateOpen(true); }}><Plus size={18} /></button></div>
            </div>
            <p className="adhkar-intro">وردك اليومي بين يديك، اختر ما يناسب وقتك</p>
            <div className="adhkar-grid">
              {orderedAdhkarCards.map((card) => {
                const customCard = "id" in card;
                const Icon = customCard ? ImageIcon : card.icon;
                const cardId = customCard ? card.id : card.title;
                const cardBackground = customCard ? card.background : adhkarBackgrounds[cardId];
                const coverImage = cardBackground ? (cardBackground.startsWith("#") ? undefined : cardBackground) : adhkarSceneUrl(card.title);
                return (
                    <div key={cardId} className={`adhkar-card-wrap ${adhkarArrangeMode ? "is-draggable" : ""} ${draggedCardId === cardId ? "is-dragging" : ""}`} draggable={adhkarArrangeMode} onDragStart={() => adhkarArrangeMode && setDraggedCardId(cardId)} onDragOver={(event) => { if (adhkarArrangeMode) event.preventDefault(); }} onDrop={() => adhkarArrangeMode && dropAdhkarCard(cardId)} onDragEnd={() => setDraggedCardId(null)} style={cardBackground?.startsWith("#") ? { backgroundColor: cardBackground } : undefined}>
                    {coverImage && <img className="adhkar-cover-image" src={coverImage} alt="" aria-hidden="true" />}
                    <button type="button" className="adhkar-card" onClick={() => {
                      if (adhkarArrangeMode) return;
                      if (customCard) { setCustomCardHistory([]); setSelectedCustomCardId(card.id); setCustomDhikrIndex(0); if (card.contentMode === "dhikrs" && card.dhikrs.length) { setCustomChildrenOpen(false); setActiveDhikr(`custom:${card.id}`); } else setCustomChildrenOpen(true); return; }
                      if (card.title === "أذكار النوم") { setAdhkarOpen(false); setSleepCategoriesOpen(true); return; }
                      setSelectedCustomCardId(null); setParentCardId(null); setCustomChildrenOpen(false); setActiveDhikr(card.title); setMorningDhikrIndex(0); setEveningDhikrIndex(0); setHomeEntryDhikrIndex(0); setHomeExitDhikrIndex(0); setWuduBeforeDhikrIndex(0); setFoodDhikrIndex(0); setShortVersion(false); setDhikrCount(0); setContinuationPromptOpen(false); setContinuePastTen(false); setExpandedDhikr(false);
                    }}>
                    <span className={`adhkar-icon feature-${customCard ? "mint" : card.tone}`} style={customCard && card.iconUrl ? { backgroundImage: `url(${card.iconUrl})`, backgroundSize: "cover" } : undefined}>{customCard && card.iconUrl ? null : <Icon size={25} strokeWidth={1.7} />}</span>
                    <strong className="adhkar-card-title">{card.title}</strong>
                    <small className="adhkar-card-caption">{card.caption}</small>
                  </button>
                  <button type="button" className="adhkar-card-menu-button" aria-label={`خيارات ${card.title}`} onClick={() => setCardMenuOpen(cardId)}><MoreHorizontal size={16} /></button>
                  {cardMenuOpen === cardId && <div className="adhkar-card-menu"><button type="button" onClick={() => { setAdhkarArrangeMode(true); setCardMenuOpen(null); }}>تحريك هذا الإعداد</button>{customCard && <button type="button" onClick={() => removeCustomCard(card.id)}>حذف</button>}<button type="button" onClick={() => { setCardMenuOpen(null); setCardBackgroundOpen(cardId); }}>إضافة صورة للخلفية</button></div>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {cardCreateOpen && (
        <div className="card-create-modal" role="dialog" aria-modal="true" aria-labelledby="card-create-title"><div className="card-create-backdrop" onClick={() => { setCardCreateOpen(false); if (parentCardId) setCustomChildrenOpen(true); }} /><section className="card-create-sheet">
          {false ? <><h3 id="card-create-title">إضافة</h3><p>اختر ما تريد إضافته إلى نافذة الأذكار</p><div className="card-create-choice"><button type="button" onClick={() => setCardCreateMode("icon")}><ImageIcon size={22} /><strong>إضافة أيقونة</strong><small>بطاقة جديدة بعنوان ووصف</small></button><button type="button" onClick={() => { setActiveDhikr(selectedCustomCardId ? `custom:${selectedCustomCardId}` : "أذكار الصباح"); openAddDhikr(); setCardCreateOpen(false); }}><HandHeart size={22} /><strong>إضافة ذكر</strong><small>إضافة ذكر إلى أذكار الصباح</small></button></div></> : <form onSubmit={saveCustomIconCard} className="custom-card-form"><div className="card-create-heading"><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} /><button type="button" className="card-create-back" onClick={() => { setCardCreateOpen(false); if (parentCardId) setCustomChildrenOpen(true); else if (cardCreateForFortress) setFortressOpen(true); else setAdhkarOpen(true); }}><ArrowLeft size={17} /></button><h3>إضافة أيقونة</h3></div><label>العنوان<input required value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="مثال: أذكار السفر" /></label><label>الوصف<input value={customCaption} onChange={(event) => setCustomCaption(event.target.value)} placeholder="وصف مختصر للبطاقة" /></label><label>رابط أيقونة من الإنترنت<input value={customIconUrl} onChange={(event) => setCustomIconUrl(event.target.value)} placeholder="https://..." /></label><button type="button" className="fetch-icon-button" onClick={fetchMatchingIcon}><Search size={15} /> جلب أيقونة مناسبة للعنوان</button><label className="card-upload"><Upload size={16} /> اختيار أيقونة من الجهاز<input type="file" accept="image/*" onChange={(event) => addCardImage(event, "icon")} /></label>{customIconUrl && <img className="custom-card-preview" src={customIconUrl} alt="معاينة الأيقونة" />}<label className="card-upload"><ImageIcon size={16} /> إضافة صورة للخلفية<input type="file" accept="image/*" onChange={(event) => addCardImage(event, "background")} /></label><div className="card-create-actions"><button type="submit">تم</button><button type="button" className="secondary" onClick={() => { setCardCreateOpen(false); if (parentCardId) setCustomChildrenOpen(true); }}>إلغاء</button></div></form>}
        </section></div>
      )}

      {customChildrenOpen && activeCustomCard && <div className="card-create-modal" role="dialog" aria-modal="true"><div className="card-create-backdrop" onClick={() => setCustomChildrenOpen(false)} /><section className="card-create-sheet nested-card-sheet"><div className="nested-card-topbar"><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} className="nested-theme-toggle" /><button type="button" className="adhkar-back" aria-label="العودة" onClick={goBackCustomCard}><ArrowLeft size={19} /></button><h3>{activeCustomCard.title}</h3><span aria-hidden="true" /></div><p>{activeCustomCard.contentMode === "icons" ? "أيقونات داخلية — يمكنك إضافة أيقونات أخرى فقط" : "أذكار داخلية — يمكنك إضافة الأذكار فقط"}</p>{!activeCustomCard.contentMode ? <div className="nested-type-choice"><button type="button" onClick={() => { setCustomChildrenOpen(false); setParentCardId(activeCustomCard.id); resetCardForm(); setCustomCardMode("icons"); setCardCreateMode("icon"); setCardCreateOpen(true);; }}><ImageIcon size={22} /><strong>إضافة أيقونة</strong><small>يمكنك إضافة أيقونات أخرى فقط</small></button><button type="button" onClick={() => { setCustomChildrenOpen(false); setParentCardId(activeCustomCard.id); setActiveDhikr(`custom:${activeCustomCard.id}`); openAddDhikr(); setCustomCardMode("dhikrs");; }}><HandHeart size={22} /><strong>إضافة ذكر</strong><small>يمكنك إضافة الأذكار فقط</small></button></div> : activeCustomCard.contentMode === "icons" ? <div className={`nested-card-grid nested-card-grid-count-${Math.min(activeCustomCard.children?.length ?? 0, 6)}`}>{(activeCustomCard.children ?? []).map((child) => <div className={`nested-card-item-wrap ${nestedArrangeParentId === activeCustomCard.id ? "is-draggable" : ""} ${draggedCardId === child.id ? "is-dragging" : ""}`} key={child.id} draggable={nestedArrangeParentId === activeCustomCard.id} onDragStart={() => nestedArrangeParentId === activeCustomCard.id && setDraggedCardId(child.id)} onDragOver={(event) => { if (nestedArrangeParentId === activeCustomCard.id) event.preventDefault(); }} onDrop={() => nestedArrangeParentId === activeCustomCard.id && moveNestedCard(activeCustomCard.id, child.id)} onDragEnd={() => setDraggedCardId(null)}><button type="button" className="nested-card-item" style={child.background ? (child.background.startsWith("#") ? { background: child.background } : { backgroundImage: `url(${child.background})`, backgroundSize: "cover" }) : undefined} onClick={() => { setCustomCardHistory((history) => [...history, activeCustomCard.id]); setSelectedCustomCardId(child.id); setCustomDhikrIndex(0); if (child.contentMode === "dhikrs" && child.dhikrs.length) { setCustomChildrenOpen(false); setActiveDhikr(`custom:${child.id}`); } else setCustomChildrenOpen(true); }}><span style={child.iconUrl ? { backgroundImage: `url(${child.iconUrl})`, backgroundSize: "cover" } : undefined}>{!child.iconUrl && <ImageIcon size={20} />}</span><strong>{child.title}</strong><small>{child.caption}</small></button><button type="button" className="nested-card-menu-button" aria-label={`خيارات ${child.title}`} onClick={(event) => { event.stopPropagation(); setCardMenuOpen(child.id); }}><MoreHorizontal size={15} /></button>{cardMenuOpen === child.id && <div className="adhkar-card-menu nested-card-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setCardMenuOpen(null); setCustomCardHistory((history) => [...history, activeCustomCard.id]); setSelectedCustomCardId(child.id); setCustomChildrenOpen(true); }}>فتح</button><button type="button" onClick={() => { setCardMenuOpen(null); setNestedArrangeParentId(activeCustomCard.id); }}>تحريك هذا الإعداد</button><button type="button" onClick={() => { setCardMenuOpen(null); setCardBackgroundOpen(child.id); }}>إضافة صورة للخلفية</button><button type="button" onClick={() => removeCustomCard(child.id)}>حذف</button></div>}</div>)}</div> : <div className="nested-dhikr-list">{activeCustomCard.dhikrs.map((item, index) => <button type="button" key={`${item.text}-${index}`} onClick={() => { setCustomDhikrIndex(index); setCustomChildrenOpen(false); setActiveDhikr(`custom:${activeCustomCard.id}`); }}><strong>{item.title || `الذكر ${index + 1}`}</strong><small>{item.text.slice(0, 80)}</small></button>)}</div>}{activeCustomCard.contentMode && <div className="nested-card-actions">{activeCustomCard.contentMode === "icons" ? <button type="button" onClick={() => { setCustomChildrenOpen(false); setParentCardId(activeCustomCard.id); resetCardForm(); setCustomCardMode("icons"); setCardCreateMode("icon"); setCardCreateOpen(true); }}><Plus size={15} /> إضافة أيقونة</button> : <button type="button" onClick={() => { setCustomChildrenOpen(false); setParentCardId(activeCustomCard.id); setActiveDhikr(`custom:${activeCustomCard.id}`); openAddDhikr(); }}><Plus size={15} /> إضافة ذكر</button>}</div>}</section></div>}

      {cardBackgroundOpen && <div className="card-create-modal" role="dialog" aria-modal="true"><div className="card-create-backdrop" onClick={() => setCardBackgroundOpen(null)} /><section className="card-create-sheet background-modal-sheet"><div className="card-create-heading"><button type="button" onClick={() => setCardBackgroundOpen(null)}><ArrowLeft size={17} /></button><h3>صورة خلفية البطاقة</h3></div><div className="background-swatches"><button type="button" className="background-default-swatch" aria-label="اللون الافتراضي" onClick={() => { updateCustomCardBackground(cardBackgroundOpen, undefined); setCardBackgroundOpen(null); }}>افتراضي</button>{["#fbefd7", "#e0f0ef", "#eee6f2", "#e5eff5", "#fae8e3", "#e1efe8", "#f8e9df", "#f2e2c9"].map((color) => <button type="button" key={color} style={{ background: color }} aria-label="اختيار لون" onClick={() => { updateCustomCardBackground(cardBackgroundOpen, color); setCardBackgroundOpen(null); }} />)}<label className="background-plus"><Plus size={18} /><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) updateCustomCardBackground(cardBackgroundOpen, URL.createObjectURL(file)); setCardBackgroundOpen(null); }} /></label></div><button type="button" className="background-reset" onClick={() => { updateCustomCardBackground(cardBackgroundOpen, undefined); setCardBackgroundOpen(null); }}>حذف الصورة وإعادة الوضع الافتراضي</button></section></div>}

      {dhikrBannerEditOpen && <div className="card-create-modal" role="dialog" aria-modal="true"><div className="card-create-backdrop" onClick={() => setDhikrBannerEditOpen(false)} /><section className="card-create-sheet banner-edit-sheet"><div className="card-create-heading"><button type="button" onClick={() => setDhikrBannerEditOpen(false)}><ArrowLeft size={17} /></button><h3>تعديل مستطيل الأذكار</h3></div><label className="custom-card-form"><span>العبارة</span><input value={dhikrBannerDraft} onChange={(event) => setDhikrBannerDraft(event.target.value)} placeholder="اكتب العبارة" /></label><div className="banner-edit-section-title">صورة الخلفية</div><div className="background-swatches"><button type="button" className="background-default-swatch" onClick={() => setDhikrBannerBackground((items) => ({ ...items, [activeBannerKey]: undefined }))}>افتراضي</button>{["#536b78", "#8b6f55", "#718b82", "#806d87", "#667c96", "#a36c5d", "#607d68", "#9b8062"].map((color) => <button type="button" key={color} style={{ background: color }} aria-label="اختيار لون" onClick={() => setDhikrBannerBackground((items) => ({ ...items, [activeBannerKey]: color }))} />)}<label className="background-plus"><Plus size={18} /><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setDhikrBannerBackground((items) => ({ ...items, [activeBannerKey]: URL.createObjectURL(file) })); }} /></label></div><button type="button" className="background-reset" onClick={() => setDhikrBannerBackground((items) => ({ ...items, [activeBannerKey]: undefined }))}>حذف الصورة وإعادة الوضع الافتراضي</button><div className="card-create-actions"><button type="button" onClick={() => { setDhikrBannerText((items) => ({ ...items, [activeBannerKey]: dhikrBannerDraft.trim() || defaultBannerText })); setDhikrBannerEditOpen(false); }}>حفظ</button><button type="button" className="secondary" onClick={() => setDhikrBannerEditOpen(false)}>إلغاء</button></div></section></div>}
      {sleepCategoriesOpen && (
        <div className="sleep-modal" role="dialog" aria-modal="true" aria-labelledby="sleep-title">
          <div className="sleep-backdrop" onClick={() => setSleepCategoriesOpen(false)} />
          <section className="sleep-sheet sleep-categories-sheet">
            <div className="sleep-topbar"><button type="button" className="sleep-back" aria-label="العودة إلى الأذكار" onClick={() => { setSleepCategoriesOpen(false); setAdhkarOpen(true); }}><ArrowLeft size={18} /></button><div><h2 id="sleep-title">أذكار النوم</h2><p>سكينة قبل النوم وطمأنينة للقلب</p></div><div className="sleep-topbar-actions"><button type="button" className="sleep-close" aria-label="إغلاق" onClick={() => setSleepCategoriesOpen(false)}><X size={18} /></button><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} className="sleep-theme-toggle" /></div></div>
            <div className="sleep-choice-grid">
              <button type="button" className="sleep-choice sleep-choice-bed" onClick={() => { setSleepCategoriesOpen(false); setSleepDhikrIndex(0); setSleepDhikrMode("sleep"); setActiveDhikr("أذكار النوم"); setShortVersion(false); setDhikrCount(0); setExpandedDhikr(false); }}><span className="sleep-choice-art"><BedDouble size={37} /></span><strong>أذكار الخلود إلى النوم</strong><small>وردك قبل أن تغفو</small></button>
              <button type="button" className="sleep-choice sleep-choice-wake" onClick={() => { setSleepCategoriesOpen(false); setSleepDhikrIndex(0); setSleepDhikrMode("waking"); setActiveDhikr("أذكار الاستيقاظ"); setShortVersion(false); setDhikrCount(0); setExpandedDhikr(false); }}><span className="sleep-choice-art"><Sunrise size={37} /></span><strong>أذكار الاستيقاظ من النوم</strong><small>ابدأ يومك بذكر الله</small></button>
              <button type="button" className="sleep-choice sleep-choice-misc" onClick={() => { setSleepCategoriesOpen(false); setSleepDhikrIndex(0); setSleepDhikrMode("misc"); setActiveDhikr("أذكار متنوعة"); setShortVersion(false); setDhikrCount(0); setExpandedDhikr(false); }}><span className="sleep-choice-art"><Sparkles size={37} /></span><strong>أذكار متنوعة</strong><small>أذكار لمواقف يومية</small></button>
            </div>
          </section>
        </div>
      )}

      {activeDhikr && (
        <div className={`dhikr-modal ${activeDhikr === "حصن المسلم" || activeCustomCard?.scope === "fortress" ? "dhikr-modal-fortress" : ""} ${activeDhikr === "حصن المسلم" && fortressPrayerCategory === "أدعية استفتاح الصلاة" ? "dhikr-modal-fortress-opening" : ""} ${expandedDhikr ? "dhikr-modal-expanded" : ""} ${parchmentMaximized ? "dhikr-modal-parchment-maximized" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dhikr-title">
          <div className="dhikr-backdrop" onClick={() => setActiveDhikr(null)} />
          <section className="dhikr-sheet">
            <div className="dhikr-topbar">
              <button type="button" className="dhikr-icon-button dhikr-back-button" aria-label="العودة" onClick={() => { if (["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "")) { setActiveDhikr(null); setSleepCategoriesOpen(true); } else if (activeDhikr === "حصن المسلم") { setActiveDhikr(null); setFortressView(fortressSectionKey.startsWith("root:أذكار المرض والهم والدين:") ? "illness" : fortressSectionKey.startsWith("root:") ? "root" : fortressSectionKey.startsWith("prayer:دعاء القنوت:") ? "qunut" : "prayer"); setFortressOpen(true); } else if (activeCustomCard?.scope === "fortress") { setActiveDhikr(null); setCustomChildrenOpen(true); } else setActiveDhikr(null); }}><ArrowLeft size={18} /></button>
              <h2 id="dhikr-title">{activeDhikr === "أذكار النوم" ? "أذكار الخلود إلى النوم" : activeDhikr === "أذكار الاستيقاظ" ? "أذكار الاستيقاظ من النوم" : activeDhikrCopy?.title ?? activeDhikr}</h2>
              <div className="dhikr-top-actions"><button type="button" className="dhikr-icon-button" aria-label="إعدادات الأذكار" onClick={() => { setActiveDhikr(null); setExpandedDhikr(false); setSettingsView("adhkar"); setAdhkarSettingsView("root"); setSettingsOpen(true); }}><Settings2 size={16} /></button>{expandedDhikr && <ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} className="dhikr-top-theme-toggle" />}</div>
            </div>
            <div className={`dhikr-hero-banner ${expandedDhikr ? "dhikr-banner-scroll-aware" : ""}`} style={{ ...(currentBannerBackground ? (currentBannerBackground.startsWith("#") ? { background: currentBannerBackground } : { backgroundImage: `url(${currentBannerBackground})`, backgroundSize: "cover" }) : { backgroundImage: `url("${adhkarSceneUrl(activeCustomCard?.title ?? activeDhikr)}")`, backgroundSize: "cover" }), "--browse-banner-progress": browseBannerProgress } as React.CSSProperties & { "--browse-banner-progress": number }}><div className="dhikr-banner-shade" /><div className="dhikr-banner-copy"><span>وردك اليومي</span><strong>{currentBannerText}</strong></div><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} className="dhikr-banner-theme-toggle" /><button type="button" className="dhikr-banner-menu-button" aria-label="خيارات المستطيل" onClick={(event) => { event.stopPropagation(); setDhikrBannerMenuOpen((open) => !open); }}><MoreHorizontal size={18} /></button>{dhikrBannerMenuOpen && <div className="dhikr-banner-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setDhikrBannerDraft(currentBannerText); setDhikrBannerEditOpen(true); setDhikrBannerMenuOpen(false); }}>تعديل</button></div>}</div>
            <div ref={expandedDhikr ? browseScrollAreaRef : undefined} onScroll={expandedDhikr ? handleBrowseScroll : undefined} className="dhikr-scroll-area">
              {expandedDhikr ? (
                <div className="dhikr-browse-list" aria-label="تصفح الأذكار عمودياً">
                  {browseDhikrs.map((item, index) => {
                    const count = browseCounts[index] ?? 0;
                    const targetCount = "targetCount" in item ? item.targetCount : (Number.parseInt(item.count, 10) || 1);
                    const continuationPrompt = "continuationPrompt" in item && item.continuationPrompt;
                    const source = "benefit" in item ? item.benefit : item.source;
                    const references = "reference" in item ? item.reference : item.references;
                    const target = continuationPrompt ? 10 : targetCount;
                    const text = item.highlightSurahs ? "جَمَعَ كَفَّيْهِ، ثُمَّ نَفَثَ فِيهِمَا، فَقَرَأَ فِيهِمَا: قُلْ هُوَ ٱللَّهُ أَحَدٌ، ٱللَّهُ ٱلصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ، وَقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ، وَقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ، مِن شَرِّ ٱلْوَسْوَاسِ الْخَنَّاسِ" : item.text;
                    const browseTitle = activeDhikr === "حصن المسلم" && isGenericNumberedDhikrTitle(item.title)
                      ? undefined
                      : activeDhikr === "أذكار الوضوء"
                      ? (wuduBeforeDhikrIndex === 0 ? "ما يُقال قبل الوضوء" : "ما يُقال بعد الوضوء")
                      : activeDhikr === "أذكار الطعام"
                        ? (foodDhikrIndex === 0 ? "الذكر عند الطعام والشراب" : "الذكر عند الفراغ من الطعام")
                        : ["أذكار النوم", "أذكار الاستيقاظ"].includes(activeDhikr ?? "") ? undefined : item.title;
                    return <Fragment key={`${item.text}-${index}`}>
                      <article ref={(element) => { browseCardRefs.current[index] = element; }} className={`dhikr-browse-card ${browseCounts[index] ? "is-active" : ""} ${("custom" in item && item.custom) ? "is-custom" : ""}`}>
                      {"custom" in item && item.custom && <button type="button" className="dhikr-browse-delete" aria-label={`حذف الذكر ${index + 1}`} onClick={(event) => { event.stopPropagation(); deleteBrowseDhikr(index); }}><Trash2 size={15} /></button>}
                      <div className="dhikr-browse-copy dhikr-typography" style={dhikrTypographyStyle}>
                        {browseTitle && <h3 className="dhikr-browse-title">{browseTitle}</h3>}
                        <p className="dhikr-text">{text}</p>
                        {(source || references) && <small className="dhikr-browse-attribution">{source}{source && references ? " · " : ""}{references}</small>}
                      </div>
                      <div className="dhikr-browse-counter">
                        <button type="button" className={`dhikr-browse-count ${count >= target ? "is-complete" : ""}`} aria-label={`عداد الذكر ${index + 1}، العدد الحالي ${count}`} onClick={() => { if (count < target) { setBrowseCounts((items) => ({ ...items, [index]: Math.min(target, count + 1) })); if (navigator.vibrate) navigator.vibrate(50); } }}>{count >= target ? <Check size={25} strokeWidth={3} /> : <strong>{count}</strong>}</button>
                        {count >= target && <button type="button" className="dhikr-browse-reset" aria-label={`إعادة عداد الذكر ${index + 1}`} onClick={() => setBrowseCounts((items) => ({ ...items, [index]: 0 }))}><RotateCcw size={17} /></button>}
                      </div>
                      <div className="dhikr-browse-meta" aria-label="معلومات الذكر"><span><RotateCcw size={13} /> {target} عدد مرات الذكر</span><span><List size={13} /> {index + 1}/{browseDhikrs.length} إجمالي الأذكار</span></div>
                      </article>
                      {dhikrPlayerOpen && expandedDhikr && <div className="dhikr-browse-divider" aria-hidden="true"><span>•</span><span>•</span><span>•</span></div>}
                    </Fragment>;
                  })}
                </div>
              ) : (
              <div key={`${activeDhikr}-${(activeDhikr === "أذكار المساء" ? eveningDhikrIndex : (activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") ? sleepDhikrIndex : morningDhikrIndex)}`} className="dhikr-artboard dhikr-artboard-transition">
                <button type="button" className="dhikr-side-arrow dhikr-side-arrow-right" aria-label="الانتقال إلى الذكر السابق جهة اليمين" disabled={!activeCustomCard && !activeSpecialSequence && !["حصن المسلم", "السبحة", "أذكار الصباح", "أذكار المساء", "دخول البيت", "الخروج من البيت", "أذكار الوضوء", "أذكار الطعام", "أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "") || activeSequenceIndex === 0} onClick={() => moveDhikrManually(-1)}><CornerUpRight size={21} /></button>
                <div className="parchment-copy dhikr-typography" style={dhikrTypographyStyle}>
                  <div ref={parchmentScrollContentRef} className={`parchment-scroll-content ${dhikrContentOverflowing ? "is-overflowing" : "is-centered"} ${activeDhikr === "حصن المسلم" && isGenericNumberedDhikrTitle(currentDhikr?.title) ? "is-numbered-title-hidden" : ""}`}>
                  {activeDhikr === "أذكار الوضوء" && <h3 className="sacred-dhikr-title">{wuduBeforeDhikrIndex === 0 ? "ما يُقال قبل الوضوء" : "ما يُقال بعد الوضوء"}</h3>}
                  {activeDhikr === "أذكار الطعام" && <h3 className="sacred-dhikr-title">{foodDhikrIndex === 0 ? "الذكر عند الطعام والشراب" : "الذكر عند الفراغ من الطعام"}</h3>}
                  {activeDhikr === "أذكار متنوعة" && sleepDhikrIndex !== null && <h3 className="misc-dhikr-title">{activeSleepDhikr[sleepDhikrIndex].title}</h3>}
                  {currentDhikr?.title && !["أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "") && !(activeDhikr === "حصن المسلم" && isGenericNumberedDhikrTitle(currentDhikr.title)) && <h3 className="custom-dhikr-title">{currentDhikr.title}</h3>}
                  <p className={`dhikr-text ${(currentDhikr?.text.length ?? 0) > 460 ? "dhikr-text-long" : (currentDhikr?.text.length ?? 0) < 90 ? "dhikr-text-short" : ""}`}>{shortVersion ? (activeDhikrCopy?.intro ?? "") : currentDhikr?.highlightSurahs ? <>جَمَعَ كَفَّيْهِ، ثُمَّ نَفَثَ فِيهِمَا، فَقَرَأَ فِيهِمَا: <mark>قُلْ هُوَ ٱللَّهُ أَحَدٌ، ٱللَّهُ ٱلصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ</mark> وَ <mark>قُلْ قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ</mark>، وَ <mark>قُلْقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ، مَلِكِ ٱلنَّاسِ، إِلَٰهِ ٱلنَّاسِ، مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ، ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ، مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ</mark>، ثُمَّ يَمْسَحُ بِهِمَا مَا اسْتَطَاعَ مِنْ جَسَدِهِ، يَبْدَأُ بِهِمَا عَلَى رَأْسِهِ وَوَجْهِهِ وَمَا أَقْبَلَ مِنْ جَسَدِهِ،  النفث: نفخ لطيف بلا ريق</> : (currentDhikr?.text ?? activeDhikrCopy?.text ?? "")}</p>
                  </div>
                  {!shortVersion && (displayedSource || displayedReferences) && (
                    <div className="dhikr-attribution">
                      <span className="dhikr-source">{displayedSource}</span>
                      <span className="dhikr-references">{displayedReferences}</span>
                    </div>
                  )}
                </div>
                <button type="button" className="parchment-expand-button" aria-label={parchmentMaximized ? "تصغير البردة" : "تكبير البردة"} onClick={() => setParchmentMaximized((value) => !value)}>{parchmentMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
                <button type="button" className={`parchment-delete-button ${currentDhikr?.custom || activeCustomCard?.dhikrs[customDhikrIndex]?.custom ? "is-enabled" : ""}`} aria-label="حذف الذكر المضاف" onClick={deleteCurrentDhikr}><Trash2 size={17} /></button>
                {currentDhikr?.custom && <button type="button" className="parchment-edit-button" aria-label="تعديل الذكر المضاف" onClick={openDhikrEditor}><PenLine size={17} /></button>}
                <button type="button" className={`mechanical-counter mechanical-counter-button ${counterStyle !== "default" ? "is-steampunk" : ""}`} aria-label={`زيادة عدد الذكر، العدد الحالي ${dhikrCount} من ${dhikrTargetCount}`} onClick={() => {
                  if (currentDhikr?.continuationPrompt && !continuePastTen && dhikrCount >= 10) {
                    setContinuationPromptOpen(true);
                    return;
                  }
                  if (dhikrCount >= dhikrTargetCount) {
                    if (activeCustomCard && customDhikrIndex < activeCustomCard.dhikrs.length - 1) {
                      setCustomDhikrIndex((index) => index + 1);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${customDhikrIndex + 2} من ${activeCustomCard.dhikrs.length}`);
                    } else if (activeDhikr === "حصن المسلم" && fortressDhikrIndex < activeFortressDhikrs.length - 1) {
                      setFortressDhikrIndex((index) => index + 1);
                      setFortressSelectedDhikr(activeFortressDhikrs[fortressDhikrIndex + 1] ?? null);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${fortressDhikrIndex + 2} من ${activeFortressDhikrs.length}`);
                    } else if (activeDhikr === "أذكار الصباح" && morningDhikrIndex < morningDhikr.length - 1) {
                      setMorningDhikrIndex((index) => index + 1);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${morningDhikrIndex + 2} من ${morningDhikr.length}`);
                    } else if (activeDhikr === "السبحة" && tasbeehDhikrIndex < tasbeehDhikr.length - 1) {
                      setTasbeehDhikrIndex((index) => index + 1);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${tasbeehDhikrIndex + 2} من ${tasbeehDhikr.length}`);
                    } else if (activeDhikr === "أذكار المساء" && eveningDhikrIndex < eveningDhikrList.length - 1) {
                      setEveningDhikrIndex((index) => index + 1);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${eveningDhikrIndex + 2} من ${eveningDhikrList.length}`);
                    } else if (activeDhikr === "دخول البيت" && homeEntryDhikrIndex < homeEntryDhikrList.length - 1) {
                      setHomeEntryDhikrIndex((index) => index + 1); setDhikrCount(0); setShortVersion(false);
                    } else if (activeDhikr === "الخروج من البيت" && homeExitDhikrIndex < homeExitDhikrList.length - 1) {
                      setHomeExitDhikrIndex((index) => index + 1); setDhikrCount(0); setShortVersion(false);
                    } else if (activeDhikr === "أذكار الوضوء" && wuduBeforeDhikrIndex < 1) {
                      setWuduBeforeDhikrIndex((index) => index + 1); setDhikrCount(0); setShortVersion(false);
                    } else if (activeDhikr === "أذكار الطعام" && foodDhikrIndex < 1) {
                      setFoodDhikrIndex((index) => index + 1); setDhikrCount(0); setShortVersion(false);
                    } else if ((activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") && sleepDhikrIndex !== null && sleepDhikrIndex < activeSleepDhikr.length - 1) {
                      setSleepDhikrIndex((index) => index === null ? null : index + 1);
                      setDhikrCount(0);
                      setShortVersion(false);
                      notify(`تم الانتقال إلى الذكر ${sleepDhikrIndex + 2} من ${activeSleepDhikr.length}`);
                    } else {
                      notify(completedDhikrLabel);
                    }
                    return;
                  }
                  setDhikrCount((count) => Math.min(dhikrTargetCount, count + 1));
                  if (navigator.vibrate) navigator.vibrate(50);
                }}>
                  {counterStyle === "steampunk" ? <SteampunkCounter value={dhikrCount} target={counterTargetCount} /> : counterStyle === "lantern" ? <SubhaCounter variant="lantern" value={dhikrCount} target={counterTargetCount} /> : <><span className="counter-progress-ring" style={{ "--counter-progress": `${counterProgress}%`, "--counter-target": counterTargetCount } as React.CSSProperties} role="progressbar" aria-label={`تقدم الذكر ${dhikrCount} من ${counterTargetCount}`} aria-valuemin={0} aria-valuemax={counterTargetCount} aria-valuenow={dhikrCount} /><span className="counter-core"><span className="counter-number">{dhikrCount}</span></span></>}
                </button>
                <button type="button" className="dhikr-side-arrow dhikr-side-arrow-left" aria-label="الانتقال إلى الذكر التالي جهة اليسار" disabled={!activeCustomCard && !activeSpecialSequence && !["حصن المسلم", "السبحة", "أذكار الصباح", "أذكار المساء", "دخول البيت", "الخروج من البيت", "أذكار الوضوء", "أذكار الطعام", "أذكار النوم", "أذكار الاستيقاظ", "أذكار متنوعة"].includes(activeDhikr ?? "") || activeSequenceIndex === activeSequenceLength - 1} onClick={() => { setContinuationPromptOpen(false); setContinuePastTen(false); moveDhikrManually(1); }}><CornerUpLeft size={21} /></button>
              </div>
              )}
              {!dhikrPlayerOpen && !expandedDhikr && <div className="counter-badges"><span><List size={13} /> {activeCustomCard ? `${customDhikrIndex + 1}/${activeCustomCard.dhikrs.length}` : activeDhikr === "حصن المسلم" ? `${fortressDhikrIndex + 1}/${activeFortressDhikrs.length}` : activeDhikr === "السبحة" ? `${tasbeehDhikrIndex + 1}/${tasbeehDhikr.length}` : activeDhikr === "أذكار الصباح" ? `${morningDhikrIndex + 1}/${morningDhikr.length}` : activeDhikr === "أذكار المساء" ? `${eveningDhikrIndex + 1}/${eveningDhikrList.length}` : (activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") && sleepDhikrIndex !== null ? `${sleepDhikrIndex + 1}/${activeSleepDhikr.length}` : "1/1"} إجمالي الأذكار</span><span><RotateCcw size={13} /> {currentDhikr?.continuationPrompt && !continuePastTen ? 10 : dhikrTargetCount} عدد مرات الذكر</span></div>}
{dhikrPlayerOpen && (
              <div className="dhikr-player" aria-label="مشغل الأذكار الصوتي">
                <div className="dhikr-player-top"><span className="voice-player-label">المقرئ</span><button type="button" className="voice-chooser-button" aria-label={selectedVoice?.reader ? `اختيار القارئ الحالي: ${selectedVoice.reader}` : "اختيار القارئ"} title={selectedVoice?.reader ?? "اختر صوتاً"} aria-haspopup="dialog" aria-expanded={voiceChooserOpen} onClick={() => { setVoiceChooserOpen((open) => !open); setVoiceMenuOpen(null); }}><Headphones size={15} /></button>{voiceChooserOpen && createPortal(<div className="voice-chooser-overlay" role="presentation" onClick={() => setVoiceChooserOpen(false)}><div className="voice-chooser-window" role="dialog" aria-modal="true" aria-label="اختيار القارئ" onClick={(event) => event.stopPropagation()}><div className="voice-chooser-heading"><strong>اختيار القارئ</strong><button type="button" aria-label="إغلاق" onClick={() => setVoiceChooserOpen(false)}><X size={15} /></button></div><div className="voice-chooser-list"><button type="button" className="voice-chooser-add" onClick={() => openVoiceManager()}>＋ إضافة صوت جديد</button>{scopedVoiceProfiles.map((profile) => <div className={`voice-chooser-row ${selectedVoiceId === profile.id ? "is-selected" : ""}`} key={profile.id}><button type="button" className="voice-chooser-name" onClick={() => { stopDhikrAudio(); setSelectedVoiceId(profile.id); setVoiceChooserOpen(false); setVoiceMenuOpen(null); }}>{profile.reader}<small>{profile.clips.length} مقطع</small></button><button type="button" className={`voice-chooser-preview ${previewingVoiceId === profile.id ? "is-playing" : ""}`} aria-label={`معاينة صوت ${profile.reader}`} title="معاينة" onClick={(event) => { event.stopPropagation(); previewVoice(profile); }}>{previewingVoiceId === profile.id ? <Pause size={14} /> : <Play size={14} />}</button><button type="button" className="voice-chooser-more" aria-label={`خيارات صوت ${profile.reader}`} onClick={(event) => { event.stopPropagation(); setVoiceMenuOpen((value) => value === profile.id ? null : profile.id); }}><MoreHorizontal size={16} /></button>{voiceMenuOpen === profile.id && <div className="voice-profile-menu voice-chooser-menu">{(profile.id === farisAbbadVoice.id || profile.reader === farisAbbadVoice.reader) && <button type="button" onClick={() => { setSelectedVoiceId(profile.id); setVoiceMenuOpen(null); setVoiceChooserOpen(false); setAudioDownloadChoiceOpen(true); }}>تحميل</button>}<button type="button" onClick={() => openVoiceManager(profile.id)}>تعديل</button><button type="button" onClick={() => deleteVoiceProfile(profile.id)}>حذف</button></div>}</div>)}</div></div></div>, document.body)}</div>
                {!expandedDhikr && <div className="dhikr-player-summary"><div className="counter-badges"><span><List size={13} /> {activeCustomCard ? `${customDhikrIndex + 1}/${activeCustomCard.dhikrs.length}` : activeDhikr === "حصن المسلم" ? `${fortressDhikrIndex + 1}/${activeFortressDhikrs.length}` : activeDhikr === "السبحة" ? `${tasbeehDhikrIndex + 1}/${tasbeehDhikr.length}` : activeDhikr === "أذكار الصباح" ? `${morningDhikrIndex + 1}/${morningDhikr.length}` : activeDhikr === "أذكار المساء" ? `${eveningDhikrIndex + 1}/${eveningDhikrList.length}` : (activeDhikr === "أذكار النوم" || activeDhikr === "أذكار الاستيقاظ" || activeDhikr === "أذكار متنوعة") && sleepDhikrIndex !== null ? `${sleepDhikrIndex + 1}/${activeSleepDhikr.length}` : "1/1"} إجمالي الأذكار</span><span><RotateCcw size={13} /> {currentDhikr?.continuationPrompt && !continuePastTen ? 10 : dhikrTargetCount} عدد مرات الذكر</span></div></div>}
                <div className="dhikr-player-track"><input type="range" min="0" max={dhikrPlaybackDuration || 0} step="0.1" value={Math.min(dhikrPlaybackProgress, dhikrPlaybackDuration || 0)} onChange={(event) => { if (dhikrAudioRef.current) dhikrAudioRef.current.currentTime = Number(event.target.value); }} /><div><small>{Math.floor(dhikrPlaybackProgress / 60).toString().padStart(2, "0")}:{Math.floor(dhikrPlaybackProgress % 60).toString().padStart(2, "0")}</small><small>{Math.floor(dhikrPlaybackDuration / 60).toString().padStart(2, "0")}:{Math.floor(dhikrPlaybackDuration % 60).toString().padStart(2, "0")}</small></div></div>
                <div className="dhikr-player-controls"><button type="button" aria-label="تقديم 5 ثواني" title="تقديم 5 ثواني" onClick={() => seekDhikrAudio(5)}><CornerUpRight size={20} /><small>5</small></button><button type="button" className="dhikr-player-play" aria-label={playingDhikr ? "إيقاف" : "تشغيل"} onClick={toggleDhikrPlayback}>{playingDhikr ? <Pause size={20} /> : <Play size={20} />}</button><button type="button" aria-label="رجوع 5 ثواني" title="رجوع 5 ثواني" onClick={() => seekDhikrAudio(-5)}><CornerUpLeft size={20} /><small>5</small></button><label className="dhikr-speed"><span>السرعة</span><select defaultValue="1" onChange={(event) => { if (dhikrAudioRef.current) dhikrAudioRef.current.playbackRate = Number(event.target.value); }}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
              </div>
              )}
              <div className="dhikr-tools"><button type="button" className="dhikr-style-tool" onClick={() => setDhikrStyleOpen(true)}><Palette size={19} /><b>تنسيق</b></button><button type="button" onClick={() => { const openingBrowse = !expandedDhikr; if (openingBrowse) resetDhikrPlaybackSession(); else closeDhikrPlayer(); setExpandedDhikr(openingBrowse); }}><BookOpen size={19} /><b>تصفح</b></button><button type="button" className={playingDhikr ? "is-playing" : ""} onClick={toggleDhikrAudio}><Headphones size={19} /><b>{playingDhikr ? "إيقاف" : "استماع"}</b></button><button type="button" onClick={openAddDhikr}><Plus size={19} /><b>إضافة</b></button></div>
              {dhikrStyleOpen && <div className="dhikr-style-overlay" role="dialog" aria-modal="true" aria-labelledby="dhikr-style-title"><div className="dhikr-style-backdrop" onClick={() => setDhikrStyleOpen(false)} /><section className="dhikr-style-card"><div className="dhikr-style-heading"><div className="dhikr-style-heading-copy"><span>مظهر الذكر</span><h3 id="dhikr-style-title">تخصيص النص</h3><p>اضبط القراءة كما تحب، وشاهد التغييرات مباشرة.</p></div><div className="dhikr-style-heading-actions"><ThemeToggleButton darkMode={darkMode} onToggle={() => { setDarkMode((value) => { const next = !value; localStorage.setItem("al-mosaly-dark-mode", String(next)); return next; }); }} className="dhikr-style-theme-toggle" /><button type="button" aria-label="إغلاق نافذة تخصيص النص" onClick={() => setDhikrStyleOpen(false)}><X size={18} /></button></div></div><div className="dhikr-style-preview" style={{ color: effectiveDhikrTextColor, "--dhikr-text-color": effectiveDhikrTextColor, "--dhikr-title-color": effectiveDhikrTitleColor } as React.CSSProperties}><span className="dhikr-style-preview-label"><Sparkles size={13} /> معاينة مباشرة</span><strong style={{ color: effectiveDhikrTitleColor, fontSize: `${dhikrTypography.titleSize}px` }}>{activeDhikr === "حصن المسلم" && isGenericNumberedDhikrTitle(currentDhikr?.title) ? "عنوان الذكر" : currentDhikr?.title || "عنوان الذكر"}</strong><p style={{ fontSize: `${dhikrTypography.textSize}px`, lineHeight: dhikrTypography.lineHeight, fontWeight: dhikrTypography.bold ? 800 : 500, fontStyle: dhikrTypography.italic ? "italic" : "normal", textDecoration: dhikrTypography.underline ? "underline" : "none" }}>بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ — معاينة نص الذكر</p></div><div className="dhikr-style-controls"><div className="dhikr-style-control"><label>حجم النص <output>{dhikrTypography.textSize}px</output></label><input type="range" min="14" max="72" value={dhikrTypography.textSize} onChange={(event) => setDhikrTypography((value) => ({ ...value, textSize: Number(event.target.value) }))} /></div><div className="dhikr-style-control"><label>حجم العنوان <output>{dhikrTypography.titleSize}px</output></label><input type="range" min="14" max="48" value={dhikrTypography.titleSize} onChange={(event) => setDhikrTypography((value) => ({ ...value, titleSize: Number(event.target.value) }))} /></div><div className="dhikr-style-control"><label>المسافة بين الأسطر <output>{dhikrTypography.lineHeight}</output></label><input type="range" min="1.3" max="3.5" step="0.1" value={dhikrTypography.lineHeight} onChange={(event) => setDhikrTypography((value) => ({ ...value, lineHeight: Number(event.target.value) }))} /></div><div className="dhikr-style-control"><label>المسافة بين العنوان والنص <output>{dhikrTypography.titleGap}px</output></label><input type="range" min="0" max="60" value={dhikrTypography.titleGap} onChange={(event) => setDhikrTypography((value) => ({ ...value, titleGap: Number(event.target.value) }))} /></div></div><div className="dhikr-style-toggles"><button type="button" className={dhikrTypography.bold ? "active" : ""} aria-pressed={dhikrTypography.bold} onClick={() => setDhikrTypography((value) => ({ ...value, bold: !value.bold }))}><b>غليظ</b></button><button type="button" className={dhikrTypography.italic ? "active" : ""} aria-pressed={dhikrTypography.italic} onClick={() => setDhikrTypography((value) => ({ ...value, italic: !value.italic }))}><i>مائل</i></button><button type="button" className={dhikrTypography.underline ? "active" : ""} aria-pressed={dhikrTypography.underline} onClick={() => setDhikrTypography((value) => ({ ...value, underline: !value.underline }))}><u>تحته خط</u></button></div><div className="dhikr-style-colors"><div className="dhikr-style-color-section"><div className="dhikr-style-color-heading"><strong>لون النص</strong><output>{dhikrTypography.textColor}</output></div><div className="dhikr-color-palette">{[{ label: "أبيض", value: "#ffffff" }, { label: "أسود", value: "#111827" }, { label: "أزرق", value: "#2563eb" }, { label: "أخضر", value: "#15803d" }, { label: "أحمر", value: "#dc2626" }, { label: "أصفر", value: "#ca8a04" }, { label: "برتقالي", value: "#ea580c" }].map((color) => <button type="button" key={color.value} className={dhikrTypography.textColor === color.value ? "selected" : ""} style={{ background: color.value }} aria-label={`لون النص ${color.label}`} aria-pressed={dhikrTypography.textColor === color.value} title={color.label} onClick={() => setDhikrColor("text", color.value)} />)}<button type="button" className="dhikr-custom-color" title="اختيار لون مخصص" aria-label="فتح منتقي لون النص" onClick={() => { setColorPickerTarget("text"); setColorPickerOpen(true); }}><Palette size={16} /></button></div></div><div className="dhikr-style-color-section"><div className="dhikr-style-color-heading"><strong>لون العنوان</strong><output>{dhikrTypography.titleColor}</output></div><div className="dhikr-color-palette">{["#111827", "#2563eb", "#15803d", "#dc2626", "#ca8a04", "#ea580c"].map((color) => <button type="button" key={color} className={dhikrTypography.titleColor === color ? "selected" : ""} style={{ background: color }} aria-label={`لون العنوان ${color}`} aria-pressed={dhikrTypography.titleColor === color} title={color} onClick={() => setDhikrColor("title", color)} />)}<button type="button" className="dhikr-custom-color" title="اختيار لون مخصص للعنوان" aria-label="فتح منتقي لون العنوان" onClick={() => { setColorPickerTarget("title"); setColorPickerOpen(true); }}><Palette size={16} /></button></div></div></div><button type="button" className="dhikr-style-done" onClick={() => setDhikrStyleOpen(false)}><Check size={16} /> تم</button></section></div>}{colorPickerOpen && createPortal(<DhikrColorPicker key={colorPickerTarget} initialColor={colorPickerTarget === "text" ? dhikrTypography.textColor : dhikrTypography.titleColor} darkMode={darkMode} onCancel={() => setColorPickerOpen(false)} onApply={(color) => { setDhikrColor(colorPickerTarget, color); setColorPickerOpen(false); }} />, document.body)}{dhikrEditOpen && <div className="add-dhikr-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-dhikr-title"><form className="add-dhikr-card" onSubmit={saveDhikrEdit}><div className="add-dhikr-heading"><span className="dhikr-confirm-icon"><PenLine size={20} /></span><div><h3 id="edit-dhikr-title">تعديل الذكر المضاف</h3><p>عدّل النص والعنوان والمصدر والبيانات.</p></div><button type="button" className="add-dhikr-close" onClick={() => setDhikrEditOpen(false)}><X size={18} /></button></div><label>العنوان <span className="optional-field">(اختياري)</span><input value={dhikrEditTitle} onChange={(event) => setDhikrEditTitle(event.target.value)} /></label><label>النص المقدس<textarea required value={dhikrEditText} onChange={(event) => setDhikrEditText(event.target.value)} /></label><label>عدد المرات<input type="number" min="1" value={dhikrEditCount} onChange={(event) => setDhikrEditCount(event.target.value)} /></label><label>المصدر أو الفائدة<textarea rows={2} value={dhikrEditSource} onChange={(event) => setDhikrEditSource(event.target.value)} /></label><label>باقي البيانات والمراجع<textarea rows={2} value={dhikrEditReferences} onChange={(event) => setDhikrEditReferences(event.target.value)} /></label><div className="add-dhikr-actions"><button type="submit">حفظ التعديلات</button><button type="button" className="secondary" onClick={() => setDhikrEditOpen(false)}>إلغاء</button></div></form></div>}

            </div>
            {continuationPromptOpen && currentDhikr?.continuationPrompt && (
              <div className="dhikr-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="continue-dhikr-title">
                <div className="dhikr-confirm-card">
                  <span className="dhikr-confirm-icon"><RotateCcw size={20} /></span>
                  <h3 id="continue-dhikr-title">هل تريد إكمال الذكر؟</h3>
                  <p>أتممت 10 مرات. يمكنك الاستمرار حتى 100 مرة أو الانتقال إلى الذكر التالي.</p>
                  <div className="dhikr-confirm-actions">
                    <button type="button" onClick={() => { setContinuePastTen(true); setContinuationPromptOpen(false); }}>إكمال حتى 100</button>
                    <button type="button" className="secondary" onClick={() => { setContinuationPromptOpen(false); moveMorningDhikr(1); }}>الذكر التالي</button>
                  </div>
                </div>
              </div>
            )}
            {audioCompletionPromptOpen && !audioRepeatMode && (
              <div className="dhikr-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="audio-completion-title">
                <div className="dhikr-confirm-card">
                  <span className="dhikr-confirm-icon"><Headphones size={20} /></span>
                  <h3 id="audio-completion-title">انتهى الاستماع إلى الذكر</h3>
                  <p>تمت قراءة الذكر مرة واحدة. اختر ما تريد فعله الآن.</p>
                  <div className="dhikr-confirm-actions">
                    <button type="button" onClick={advanceAudioToNextDhikr}>الذكر التالي</button>
                    <button type="button" className="secondary" onClick={repeatCurrentAudio}>تكرار بلا نهاية</button>
                  </div>
                </div>
              </div>
            )}
            {audioDownloadChoiceOpen && createPortal(<div className="audio-download-overlay" role="dialog" aria-modal="true" aria-labelledby="audio-download-title"><div className="audio-download-backdrop" onClick={() => setAudioDownloadChoiceOpen(false)} /><section className="audio-download-card"><div className="audio-download-heading"><div><h3 id="audio-download-title">تحميل صوت الأذكار</h3><p>الذكر الحالي: {sequenceIndex + 1}/{activeSequenceLength}</p></div><button type="button" onClick={() => setAudioDownloadChoiceOpen(false)}><X size={18} /></button></div><div className="audio-download-choice"><button type="button" onClick={downloadCurrentDhikr}><Download size={20} /><strong>تحميل هذا الذكر</strong><small>تحميل الذكر الحالي فقط</small></button><button type="button" onClick={() => { setAudioDownloadChoiceOpen(false); setAudioDownloadListOpen(true); }}><List size={20} /><strong>تحميل جميع الأذكار</strong><small>اختيار الأذكار المراد تحميلها</small></button></div></section></div>, document.body)}
            {audioDownloadListOpen && createPortal(<div className="audio-download-overlay" role="dialog" aria-modal="true" aria-labelledby="audio-download-list-title"><div className="audio-download-backdrop" onClick={() => setAudioDownloadListOpen(false)} /><section className="audio-download-card audio-download-list-card"><div className="audio-download-heading"><div><h3 id="audio-download-list-title">تحميل جميع الأذكار</h3><p>فعّل العلامة بجانب كل ذكر تريد تحميله.</p></div><button type="button" onClick={() => setAudioDownloadListOpen(false)}><X size={18} /></button></div><div className="audio-download-list">{selectedVoice?.clips.slice(0, activeSequenceLength).map((clip, index) => <div className="audio-download-item" key={clip.id}><label><input type="checkbox" checked={selectedAudioDownloads.includes(index)} onChange={() => setSelectedAudioDownloads((items) => items.includes(index) ? items.filter((item) => item !== index) : [...items, index])} /><i /> <span>الذكر {String(index + 1).padStart(2, "0")}</span></label><button type="button" onClick={() => previewAudioClip(clip, `download-${index}`)}>{previewingVoiceId === `download-${index}` ? <Pause size={14} /> : <Play size={14} />} معاينة</button></div>)}</div><div className="audio-download-actions"><button type="button" onClick={downloadSelectedDhikrs}><Download size={15} /> تحميل</button><button type="button" className="secondary" onClick={() => setAudioDownloadListOpen(false)}>إلغاء</button></div></section></div>, document.body)}
            {voiceManagerOpen && (
              <div className="voice-manager-overlay" role="dialog" aria-modal="true" aria-labelledby="voice-manager-title">
                <div className="voice-manager-backdrop" onClick={closeVoiceManager} />
                <section className="voice-manager-card">
                  <div className="voice-manager-heading">
                    <div><h3 id="voice-manager-title">{voiceManagerView === "list" ? "الأصوات المضافة" : editingVoiceId ? "تعديل صوت المقرئ" : "إضافة صوت مقرئ جديد"}</h3><p>{voiceManagerView === "list" ? "الأصوات المتاحة لهذه النافذة فقط" : "رتّب المقاطع لتتوافق مع ترتيب الأذكار"}</p></div>
                    <button type="button" onClick={voiceManagerView === "form" ? backToVoiceList : closeVoiceManager} aria-label={voiceManagerView === "form" ? "العودة إلى الأصوات" : "إغلاق"}>{voiceManagerView === "form" ? <ArrowLeft size={18} /> : <X size={18} />}</button>
                  </div>
                  {voiceManagerView === "list" ? (
                    <>
                      {scopedVoiceProfiles.length > 0 ? <div className="saved-voice-list">{scopedVoiceProfiles.map((profile) => <div className="saved-voice-row" key={profile.id}><button type="button" className="saved-voice-open" onClick={() => openVoiceManager(profile.id)}><span>{profile.reader}<small>{profile.clips.length} مقطع</small></span></button><div className="voice-profile-menu-wrap"><button type="button" className="voice-profile-menu-button" aria-label={`خيارات صوت ${profile.reader}`} onClick={() => setVoiceMenuOpen((value) => value === profile.id ? null : profile.id)}><MoreHorizontal size={16} /></button>{voiceMenuOpen === profile.id && <div className="voice-profile-menu"><button type="button" onClick={() => openVoiceManager(profile.id)}>تعديل</button><button type="button" onClick={() => deleteVoiceProfile(profile.id)}>حذف</button></div>}</div></div>)}</div> : <div className="voice-empty-state">لا توجد أصوات مضافة لهذه النافذة بعد.</div>}
                      <button type="button" className="voice-add-profile-button" onClick={() => { setEditingVoiceId(null); setNewReaderName(""); setNewVoiceClips([]); setVoiceOriginalClipIds([]); setVoiceMenuOpen(null); setVoiceManagerView("form"); }}>＋ إضافة صوت مقرئ جديد</button>
                    </>
                  ) : (
                    <>
                      <label>اسم المقرئ<input value={newReaderName} onChange={(event) => setNewReaderName(event.target.value)} placeholder="مثال: الشيخ محمد" /></label>
                      <label className="voice-upload-label"><Upload size={16} /> اختيار المقاطع من الجهاز<input type="file" accept="audio/*" multiple onChange={addVoiceClips} /></label>
                      <div className="voice-order-title">ترتيب المقاطع: {newVoiceClips.map((_clip, index) => String(index + 1).padStart(2, "0")).join(" - ") || "لم تختر مقاطع بعد"}</div>
                      <div className="voice-clip-list">{newVoiceClips.map((clip, index) => <div className="voice-clip-row" key={clip.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{clip.name}</span><button type="button" disabled={index === 0} onClick={() => reorderVoiceClip(index, -1)}>↑</button><button type="button" disabled={index === newVoiceClips.length - 1} onClick={() => reorderVoiceClip(index, 1)}>↓</button><button type="button" className="voice-clip-delete" aria-label={`حذف المقطع ${clip.name}`} onClick={() => deleteNewVoiceClip(clip.id)}><Trash2 size={13} /></button></div>)}</div>
                      <div className="voice-manager-actions"><button type="button" onClick={saveVoiceProfile}>حفظ الصوت</button><button type="button" className="secondary" onClick={backToVoiceList}>العودة إلى الأصوات</button></div>
                    </>
                  )}
                </section>
              </div>
            )}
            {addDhikrOpen && (
              <div className="add-dhikr-overlay" role="dialog" aria-modal="true" aria-labelledby="add-dhikr-title">
                <form className="add-dhikr-card" onSubmit={addDhikr}>
                  <div className="add-dhikr-heading"><span className="dhikr-confirm-icon"><Plus size={20} /></span><div><h3 id="add-dhikr-title">إضافة ذكر جديد</h3><p>سيظهر الذكر مباشرة في المرتبة التي تختارها.</p></div><button type="button" className="add-dhikr-back" aria-label="العودة إلى نافذة البطاقة" onClick={() => { setAddDhikrOpen(false); if (parentCardId) setCustomChildrenOpen(true); }}><ArrowLeft size={18} /></button></div>
                  <label>العنوان <span className="optional-field">(اختياري)</span><input value={newDhikrTitle} onChange={(event) => setNewDhikrTitle(event.target.value)} placeholder="عنوان الذكر" /></label>
                  <label>نص الذكر<textarea required value={newDhikrText} onChange={(event) => setNewDhikrText(event.target.value)} placeholder="اكتب نص الذكر هنا" /></label>
                  <div className="add-dhikr-fields"><label>الرتبة<input type="number" min="1" max={activeDhikr === "السبحة" ? tasbeehDhikr.length + 1 : morningDhikr.length + 1} value={newDhikrRank} onChange={(event) => setNewDhikrRank(event.target.value)} /></label>{activeDhikr !== "حصن المسلم" && <label>عدد المرات<input type="number" min="1" value={newDhikrCount} onChange={(event) => setNewDhikrCount(event.target.value)} /></label>}</div>
                  <label>المصدر أو الفائدة<textarea rows={2} value={newDhikrSource} onChange={(event) => setNewDhikrSource(event.target.value)} placeholder="مثال: من قاله غُفرت ذنوبه" /></label>
                  <label>الراوي<input value={newDhikrNarrator} onChange={(event) => setNewDhikrNarrator(event.target.value)} placeholder="مثال: رواه مسلم" /></label>
                  <div className="add-dhikr-actions"><button type="submit">حفظ وإضافة الذكر</button><button type="button" className="secondary" onClick={() => { setAddDhikrOpen(false); if (parentCardId) setCustomChildrenOpen(true); }}>إلغاء</button></div>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {fajrAlarmOpen && <div className="fajr-alarm-modal" role="dialog" aria-modal="true" aria-labelledby="fajr-alarm-title"><div className="fajr-alarm-backdrop" onClick={() => setFajrAlarmOpen(false)} /><section className="fajr-alarm-sheet"><header className="fajr-alarm-header"><button type="button" onClick={() => setFajrAlarmOpen(false)} aria-label="إغلاق"><X size={19} /></button><div><h2 id="fajr-alarm-title">منبه الفجر</h2><p>أنشئ تنبيهاتك واستيقظ بهدوء</p></div><span><BellRing size={21} /></span></header>{fajrAlarms.length === 0 ? <div className="fajr-alarm-empty"><BellRing size={36} /><strong>لا توجد منبهات بعد</strong><small>اضغط على زر الإضافة لإنشاء منبه للفجر</small></div> : <div className="fajr-alarm-list">{fajrAlarms.map((alarm) => <article className="fajr-alarm-item" key={alarm.id}><div><strong>{alarm.mode === "beforeFajr" ? `${alarm.minutesBeforeFajr} دقيقة قبل الفجر` : alarm.time}</strong><small>{alarm.days.length === 7 ? "كل الأيام" : alarm.days.map((day) => fajrAlarmDays[day].label).join("، ")} · {alarm.soundName}</small>{alarm.puzzle !== "none" && <em>لغز مفعّل</em>}</div><button type="button" aria-label="حذف المنبه" onClick={() => setFajrAlarms((items) => items.filter((item) => item.id !== alarm.id))}><Trash2 size={16} /></button></article>)}</div>}<button type="button" className="fajr-alarm-add" onClick={openFajrAlarmComposer}><Plus size={25} /></button>{fajrAlarmComposerOpen && <div className="fajr-alarm-composer" role="dialog" aria-modal="true"><form onSubmit={saveFajrAlarm}><div className="fajr-alarm-composer-heading"><div><h3>إضافة منبه</h3><small>اختر وقت الاستيقاظ وطريقة التذكير</small></div><button type="button" onClick={() => setFajrAlarmComposerOpen(false)}><X size={17} /></button></div><div className="fajr-alarm-mode"><button type="button" className={fajrAlarmDraft.mode === "exact" ? "active" : ""} onClick={() => setFajrAlarmDraft((draft) => ({ ...draft, mode: "exact" }))}>اختيار الوقت</button><button type="button" className={fajrAlarmDraft.mode === "beforeFajr" ? "active" : ""} onClick={() => setFajrAlarmDraft((draft) => ({ ...draft, mode: "beforeFajr" }))}>قبل الفجر بالدقائق</button></div>{fajrAlarmDraft.mode === "exact" ? <label>وقت التنبيه<input type="time" required value={fajrAlarmDraft.time} onChange={(event) => setFajrAlarmDraft((draft) => ({ ...draft, time: event.target.value }))} /></label> : <label>التذكير قبل الفجر بـ <input type="number" min="1" max="720" required value={fajrAlarmDraft.minutesBeforeFajr} onChange={(event) => setFajrAlarmDraft((draft) => ({ ...draft, minutesBeforeFajr: Math.max(1, Number(event.target.value) || 1) }))} /><span>دقيقة</span></label>}<fieldset><legend>تكرار الأيام</legend><div className="fajr-alarm-days">{fajrAlarmDays.map((day) => <button type="button" key={day.index} className={fajrAlarmDraft.days.includes(day.index) ? "active" : ""} aria-pressed={fajrAlarmDraft.days.includes(day.index)} onClick={() => updateFajrAlarmDays(day.index)}>{day.label.slice(0, 3)}</button>)}</div></fieldset><div className="fajr-alarm-sound"><strong>الصوت</strong><small>{fajrAlarmSound?.name ?? fajrAlarmDraft.soundName}</small><div><button type="button" onClick={() => { const audio = new Audio(); audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA="; void audio.play().catch(() => undefined); }}>اختبار صوت النظام</button><label>إضافة صوت<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (fajrAlarmSound) URL.revokeObjectURL(fajrAlarmSound.url); setFajrAlarmSound({ name: file.name, url: URL.createObjectURL(file) }); } }} /></label></div></div><div className="fajr-alarm-puzzle"><button type="button" onClick={() => setFajrAlarmDraft((draft) => ({ ...draft, puzzle: draft.puzzle === "none" ? "randomMath" : "none" }))}><CircleHelp size={17} /> الألغاز <span>{fajrAlarmDraft.puzzle === "none" ? "متوقف" : "مفعّل"}</span></button>{fajrAlarmDraft.puzzle !== "none" && <div className="fajr-puzzle-options"><button type="button" className={fajrAlarmDraft.puzzle === "randomMath" ? "active" : ""} onClick={() => setFajrAlarmDraft((draft) => ({ ...draft, puzzle: "randomMath" }))}>مسألة عشوائية</button><button type="button" className={fajrAlarmDraft.puzzle === "sequence" ? "active" : ""} onClick={() => setFajrAlarmDraft((draft) => ({ ...draft, puzzle: "sequence" }))}>متتالية</button><label>لغز رياضي من كتابتك<input value={fajrAlarmDraft.puzzleQuestion ?? ""} placeholder="مثال: 12 + 8 = ؟" onChange={(event) => setFajrAlarmDraft((draft) => ({ ...draft, puzzle: "customMath", puzzleQuestion: event.target.value }))} /></label>{fajrAlarmDraft.puzzle === "customMath" && <label>الإجابة الصحيحة<input value={fajrAlarmDraft.puzzleAnswer ?? ""} onChange={(event) => setFajrAlarmDraft((draft) => ({ ...draft, puzzleAnswer: event.target.value }))} /></label>}<small>عند التفعيل لن يظهر زر الإيقاف إلا بعد الإجابة الصحيحة.</small></div>}</div><button type="submit" className="fajr-alarm-save"><Check size={16} /> حفظ المنبه</button></form></div>}</section></div>}
      {activeFajrAlarm && <div className="fajr-ringing-modal" role="alertdialog" aria-modal="true" aria-labelledby="fajr-ringing-title"><section><BellRing size={38} /><h2 id="fajr-ringing-title">حان وقت منبه الفجر</h2><p>{activeFajrAlarm.alarm.puzzle === "none" ? "يمكنك إيقاف التنبيه الآن." : "حل اللغز لإيقاف التنبيه."}</p>{activeFajrAlarm.alarm.puzzle !== "none" && <><strong className="fajr-ringing-question">{activeFajrAlarm.question}</strong><input autoFocus inputMode="numeric" value={fajrPuzzleAnswer} onChange={(event) => setFajrPuzzleAnswer(event.target.value)} placeholder="اكتب الإجابة هنا" /></>}<button type="button" onClick={stopFajrAlarm}>{activeFajrAlarm.alarm.puzzle === "none" ? "إيقاف التنبيه" : "تحقق من الإجابة"}</button></section></div>}
      {settingsOpen && (
        <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="settings-backdrop" onClick={closeSettings} />
          <section className={`settings-sheet ${settingsView === "counter" ? "settings-sheet-counter-wide" : ""}`}>
            <div className="settings-topbar"><button type="button" className="settings-close settings-topbar-back" onClick={goBackInSettings} aria-label={settingsView === "root" ? "إغلاق الإعدادات" : "العودة إلى النافذة السابقة"}><ArrowLeft size={18} /></button><span className="settings-title-icon"><Settings2 size={20} /></span><div><h2 id="settings-title">{settingsHeading}</h2><p>خصص تجربة المصلى كما تحب</p></div><span className="settings-topbar-spacer" aria-hidden="true" /></div>
            {settingsView === "root" && <div className="settings-list">
              <button type="button" className="settings-row settings-visual-general" onClick={() => setSettingsView("general")}><SettingsCardCover src={"/settings-backgrounds/general.jpg"} /><span className="settings-row-icon"><SlidersHorizontal size={20} /></span><span><strong>إعدادات عامة</strong><small>التوقيت والخيارات العامة</small></span><SettingsCardArt icon={SlidersHorizontal} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-visual-appearance" onClick={() => setSettingsView("themeCategories")}><SettingsCardCover src={themeHeroImage} /><span className="settings-row-icon"><Palette size={20} /></span><span><strong>إعدادات المظهر</strong><small>{shortThemeName(themes.find((theme) => theme.id === themeId) ?? defaultThemeDefinition)}</small></span><SettingsCardArt icon={Palette} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-visual-prayer" onClick={() => setSettingsView("adhan")}><SettingsCardCover src={"/settings-backgrounds/mosque.jpg"} /><span className="settings-row-icon settings-row-icon-warm"><Volume1 size={20} /></span><span><strong>إعدادات الأذان والصلاة</strong><small>الخلفيات، الأصوات والتنبيهات</small></span><SettingsCardArt icon={CloudSun} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-visual-adhkar" onClick={() => { setSettingsView("adhkar"); setAdhkarSettingsView("root"); }}><SettingsCardCover src={"/settings-backgrounds/adhkar.jpg"} /><span className="settings-row-icon settings-row-icon-green"><HandHeart size={20} /></span><span><strong>إعدادات الأذكار</strong><small>النوافل والجمعة والأذكار اليومية</small></span><ChevronLeft size={17} /></button>
            </div>}

            {settingsView === "general" && <div className="settings-list">
              <div className="settings-dst-row"><div><strong><SunMedium size={16} /> التوقيت الصيفي</strong><small>{daylightSavingEnabled ? "مفعّل: يتبع أحدث قواعد المنطقة الزمنية تلقائيًا" : "متوقف: استخدام التوقيت القياسي للمنطقة"}</small></div><label className="settings-toggle-wrap" aria-label="تفعيل التوقيت الصيفي"><input type="checkbox" checked={daylightSavingEnabled} onChange={(event) => { const enabled = event.target.checked; setDaylightSavingEnabled(enabled); localStorage.setItem("al-mosaly-daylight-saving", String(enabled)); notify(enabled ? "تم تفعيل التوقيت الصيفي حسب قواعد المنطقة" : "تم إيقاف التوقيت الصيفي واستخدام التوقيت القياسي"); }} /><i /></label></div>
            </div>}

            {settingsView === "themeCategories" && <div className="settings-list theme-category-list">
              
              <button type="button" className="settings-row settings-theme-category settings-visual-appearance" onClick={() => setSettingsView("themes")}><SettingsCardCover src={adhkarSceneUrl("أذكار الصباح")} /><span className="settings-row-icon"><Palette size={21} /></span><span><strong>عام</strong><small>اختيار سمة المصلى</small></span><SettingsCardArt icon={Palette} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-theme-category settings-theme-counter-entry" onClick={() => setSettingsView("counter")}><SettingsCardCover src={featureSceneUrl("السبحة") ?? themeHeroImage} /><span className="settings-row-icon"><Sparkles size={21} /></span><span><strong>العداد</strong><small>تغيير شكل العداد أسفل البردة</small></span><SettingsCardArt icon={Sparkles} /><ChevronLeft size={17} /></button>
            </div>}
            {settingsView === "counter" && <div className="settings-list counter-settings-list">
              
              <div className="counter-chooser-grid">
                <button type="button" className={`counter-chooser-card ${counterStyle === "default" ? "is-selected" : ""}`} aria-pressed={counterStyle === "default"} onClick={() => { setCounterStyle("default"); localStorage.setItem("al-mosaly-counter-style", "default"); }}><div className="counter-chooser-face"><span className="counter-chooser-ring" /><span className="counter-chooser-core">0</span></div><div className="counter-chooser-copy"><strong>الوضع الافتراضي</strong><small>يتغير شكله تلقائيًا مع كل سمة</small></div>{counterStyle === "default" && <span className="counter-settings-option-mark"><Check size={15} /></span>}</button>
                <button type="button" className={`counter-chooser-card counter-chooser-steampunk ${counterStyle === "steampunk" ? "is-selected" : ""}`} aria-pressed={counterStyle === "steampunk"} onClick={() => { setCounterStyle("steampunk"); localStorage.setItem("al-mosaly-counter-style", "steampunk"); }}><div className="counter-chooser-face"><SteampunkCounter value={0} target={100} /></div><div className="counter-chooser-copy"><strong>عداد التروس والماء</strong><small>شكل steampunk مع امتلاء الماء مع الذكر</small></div>{counterStyle === "steampunk" && <span className="counter-settings-option-mark"><Check size={15} /></span>}</button>
                <button type="button" className={`counter-chooser-card counter-chooser-subha counter-chooser-lantern ${counterStyle === "lantern" ? "is-selected" : ""}`} aria-pressed={counterStyle === "lantern"} onClick={() => { setCounterStyle("lantern"); localStorage.setItem("al-mosaly-counter-style", "lantern"); }}><div className="counter-chooser-face"><SubhaCounter variant="lantern" value={0} target={100} /></div><div className="counter-chooser-copy"><strong>الفانوس</strong><small>يزداد نور الفانوس مع الذكر</small></div>{counterStyle === "lantern" && <span className="counter-settings-option-mark"><Check size={15} /></span>}</button>
              </div>
            </div>}
            {settingsView === "themes" && <div className="settings-list theme-settings-list">
              
              <div className="theme-settings-intro settings-visual-appearance"><SettingsCardCover src={themeHeroImage} /><strong>اختر المظهر</strong><small>تظهر علامة الاختيار على السمة المفعّلة حاليًا.</small><SettingsCardArt icon={Palette} /></div>
              
              <div className="theme-chooser-grid">
                {themes.map((theme, index) => <button type="button" key={theme.id} className={`theme-chooser-card ${theme.id === themeId ? "is-selected" : ""}`} aria-pressed={theme.id === themeId} title={shortThemeName(theme)} style={{ backgroundImage: `linear-gradient(90deg, rgba(8,12,14,.82), rgba(8,12,14,.28)), url("${(theme.heroImage ?? themeImageUrl(theme.id, "hero.jpg"))}")` }} onClick={() => { void loadThemeStyles(theme.id).then(() => { setThemeId(theme.id); localStorage.setItem("al-mosaly-theme", theme.id); notify(`تم تفعيل ${shortThemeName(theme)}`); }).catch(() => notify(`تعذر تحميل ملفات المظهر ${theme.name}`)); }}><span className={`theme-chooser-swatch theme-swatch-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span></span><span className="theme-chooser-copy"><strong>{shortThemeName(theme)}</strong><small>{theme.description}</small><em>{theme.palette}</em></span>{theme.id === themeId && <Check className="theme-chooser-check" size={17} />}</button>)}
              </div>
            </div>}

            {settingsView === "adhan" && <div className="settings-list">
              
              <button type="button" className="settings-row settings-visual-video" onClick={() => setBackgroundModal(true)}><SettingsCardCover src={"/settings-backgrounds/mosque.jpg"} /><span className="settings-row-icon"><Video size={20} /></span><span><strong>خلفيات الأذان</strong><small>{adhanBackgroundEnabled ? "مفعّلة" : "متوقفة"}</small></span><SettingsCardArt icon={Video} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-visual-sounds" onClick={() => setSettingsView("sounds")}><SettingsCardCover src={"/settings-backgrounds/general.jpg"} /><span className="settings-row-icon"><Volume1 size={20} /></span><span><strong>أصوات التنبه والأذان والإقامة</strong><small>اختبار وإضافة ملفات صوتية</small></span><SettingsCardArt icon={Volume2} /><ChevronLeft size={17} /></button>
              <button type="button" className="settings-row settings-visual-alerts" onClick={() => { setAlertsView("root"); setSettingsView("alerts"); }}><SettingsCardCover src={"/settings-backgrounds/alerts.jpg"} /><span className="settings-row-icon"><BellRing size={20} /></span><span><strong>تنبيهات الأذان والصلاة والإقامة</strong><small>التنبيه قبل الصلاة وتصحيح الوقت</small></span><SettingsCardArt icon={BellRing} /><ChevronLeft size={17} /></button>
            </div>}

            {settingsView === "sounds" && <div className="settings-list">
              
              {([ ["before", "أصوات التنبيه قبل الأذان", Bell], ["adhan", "أصوات الأذان", Volume1], ["iqama", "أصوات الإقامة", DoorOpen] ] as const).map(([kind, title, Icon]) => <button type="button" className={`sound-setting sound-setting-button settings-visual-sound settings-visual-sound-${kind}`} key={kind} onClick={() => setSoundModal(kind)}><SettingsCardCover src={(kind === "before" ? "/settings-backgrounds/adhkar.jpg" : kind === "adhan" ? "/settings-backgrounds/audio.jpg" : "/settings-backgrounds/mosque.jpg")} /><span className="settings-row-icon"><Icon size={25} /></span><div><strong>{title}</strong><small>{soundFiles[kind].length ? `${soundFiles[kind].length} صوت${soundFiles[kind].length > 1 ? "اً" : ""}` : "لم تتم إضافة صوت بعد"}</small></div><SettingsCardArt icon={Icon} /><ChevronLeft size={17} /></button>)}
            </div>}

            {backgroundModal && <div className="sound-modal" role="dialog" aria-modal="true" aria-labelledby="background-modal-title"><div className="sound-modal-backdrop" onClick={() => { setAdhanVideoPreviewId(null); setBackgroundModal(false); }} /><section className="sound-modal-card background-modal-card settings-visual-video-modal"><SettingsCardCover src={"/settings-backgrounds/mosque.jpg"} /><SettingsCardArt icon={Video} /><div className="sound-modal-header"><button type="button" onClick={() => { setAdhanVideoPreviewId(null); setBackgroundModal(false); }} aria-label="العودة"><ArrowLeft size={17} /></button><div><h3 id="background-modal-title">خلفيات الأذان</h3><p>أضف عدة فيديوهات واختر الخلفية المستخدمة عند الأذان</p></div><Video size={21} /></div><div className="background-toggle-row"><SettingsCardCover src={"/settings-backgrounds/mosque.jpg"} /><span><strong>تفعيل خلفيات الأذان</strong><small>{adhanBackgroundEnabled ? "الخلفية مفعّلة" : "الخلفية متوقفة"}</small></span><label className="settings-toggle-wrap"><input type="checkbox" checked={adhanBackgroundEnabled} onChange={(event) => setAdhanBackgroundEnabled(event.target.checked)} /><i /></label></div><div className="background-video-manager"><label className="settings-upload"><Upload size={16} /> إضافة فيديو<input type="file" accept="video/*" onChange={uploadAdhanVideo} /></label></div>{adhanVideos.length === 0 ? <div className="background-video-empty"><Video size={24} /><strong>لم تتم إضافة فيديو بعد</strong><small>يمكنك إضافة أي عدد من فيديوهات الخلفية والاختيار بينها.</small></div> : <div className="background-video-list">{adhanVideos.map((video) => <div className={`background-video-item ${selectedAdhanVideo?.id === video.id ? "is-selected" : ""}`} key={video.id}><button type="button" className="background-video-select" onClick={() => { setSelectedAdhanVideoId(video.id); setAdhanVideoPreviewId(video.id); }} aria-label={`معاينة واختيار فيديو ${video.name}`}><span className="background-video-thumb"><video src={video.url} muted playsInline preload="metadata" /></span><span className="background-video-copy"><strong>{video.name}</strong><small>{selectedAdhanVideo?.id === video.id ? "الخلفية المختارة حالياً" : "اضغط للاختيار"}</small></span>{selectedAdhanVideo?.id === video.id && <span className="counter-settings-option-mark background-video-check"><Check size={15} /></span>}</button><button type="button" className="background-delete-button" onClick={() => removeAdhanVideo(video.id)} aria-label={`حذف فيديو ${video.name}`}><Trash2 size={16} /></button></div>)}</div>}{adhanVideoPreview && <div className="background-video-preview-overlay" role="presentation" onClick={() => setAdhanVideoPreviewId(null)}><div className="background-video-preview-card" role="dialog" aria-modal="true" aria-label={`معاينة فيديو ${adhanVideoPreview.name}`} onClick={(event) => event.stopPropagation()}><div className="background-video-preview-header"><strong>{adhanVideoPreview.name}</strong><button type="button" onClick={() => setAdhanVideoPreviewId(null)} aria-label="إغلاق المعاينة"><X size={18} /></button></div><video src={adhanVideoPreview.url} controls autoPlay loop playsInline /></div></div>}</section></div>}

            {soundModal && (() => {
              const soundTitle = soundModal === "before" ? "أصوات التنبيه قبل الأذان" : soundModal === "adhan" ? "أصوات الأذان" : "أصوات الإقامة";
              const sounds = soundFiles[soundModal];
              return <div className="sound-modal" role="dialog" aria-modal="true" aria-labelledby="sound-modal-title"><div className="sound-modal-backdrop" onClick={() => setSoundModal(null)} /><section className={`sound-modal-card settings-visual-sound-modal settings-visual-sound-${soundModal}`}><SettingsCardCover src={(soundModal === "before" ? "/settings-backgrounds/adhkar.jpg" : soundModal === "adhan" ? "/settings-backgrounds/audio.jpg" : "/settings-backgrounds/mosque.jpg")} /><SettingsCardArt icon={soundModal === "before" ? Bell : soundModal === "adhan" ? Volume1 : DoorOpen} /><div className="sound-modal-header"><button type="button" onClick={() => setSoundModal(null)} aria-label="العودة"><ArrowLeft size={17} /></button><div><h3 id="sound-modal-title">{soundTitle}</h3><p>أضف أصواتاً متعددة واختر الصوت المستخدم للتشغيل</p></div><Volume1 size={21} /></div><div className="sound-library-list">{sounds.length === 0 ? <div className="sound-file-status">لم تتم إضافة صوت بعد</div> : sounds.map((sound) => <div className={`sound-library-row ${selectedSoundIds[soundModal] === sound.id ? "is-selected" : ""}`} key={sound.id}><button type="button" className="sound-library-select" onClick={() => setSelectedSoundIds((items) => ({ ...items, [soundModal]: sound.id }))}><span className="sound-selected-mark">{selectedSoundIds[soundModal] === sound.id ? <Check size={13} /> : null}</span><span>{sound.name}</span></button><button type="button" className="sound-preview-button" onClick={() => testSound(soundModal)} aria-label="معاينة الصوت">{playingSound === soundModal && selectedSoundIds[soundModal] === sound.id ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" className="sound-trash-button" onClick={() => deleteSound(soundModal, sound.id)} aria-label="حذف الصوت"><Trash2 size={15} /></button></div>)}</div><div className="sound-modal-actions"><label><Plus size={16} /> إضافة صوت<input type="file" accept="audio/*" onChange={(event) => uploadSound(soundModal, event)} /></label></div></section></div>;
            })()}

            {settingsView === "alerts" && alertsView === "root" && <div className="settings-list"><button type="button" className="settings-subrow settings-visual-alert-before" onClick={() => setAlertsView("before")}><SettingsCardCover src={"/settings-backgrounds/alerts.jpg"} /><span className="settings-row-icon"><BellRing size={24} /></span><div><strong>التنبيه قبل الصلاة</strong><small>خصص أيام التنبيه ومدته لكل صلاة</small></div><SettingsCardArt icon={BellRing} /><ChevronLeft size={17} /></button><button type="button" className="settings-subrow settings-visual-alert-adjust" onClick={() => setAlertsView("adjust")}><SettingsCardCover src={"/settings-backgrounds/general.jpg"} /><span className="settings-row-icon"><SlidersHorizontal size={24} /></span><div><strong>تصحيح وقت الصلاة</strong><small>خصص تصحيح كل صلاة حسب اليوم بالدقائق الموجبة أو السالبة</small></div><SettingsCardArt icon={SlidersHorizontal} /><ChevronLeft size={17} /></button><button type="button" className="settings-subrow settings-visual-alert-iqama" onClick={() => setAlertsView("iqama")}><SettingsCardCover src={"/settings-backgrounds/mosque.jpg"} /><span className="settings-row-icon"><DoorOpen size={24} /></span><div><strong>تنبيهات الإقامة</strong><small>خصص أيام الإقامة ومدتها لكل صلاة</small></div><SettingsCardArt icon={DoorOpen} /><ChevronLeft size={17} /></button></div>}
            {settingsView === "alerts" && alertsView !== "root" && (
              <div className={`settings-list settings-prayer-list settings-visual-alert-list settings-visual-alert-${alertsView}`}>
                
                {activePrayers.map((prayer) => {
                  const alertKind = alertsView as WeeklyAlertKind;
                  const weekPlan = getPrayerWeekPlan(alertKind, prayer.arabic);
                  const selectedDayMinutes = weekPlan.enabledDays.map((day) => weekPlan.minutesByDay[day] ?? 0);
                  const distinctSelectedMinutes = selectedDayMinutes.filter((value, index, values) => values.indexOf(value) === index);
                  const fallbackMinutes = alertKind === "before" ? Math.abs(preAlertMinutes[prayer.arabic] ?? -15) : alertKind === "adjust" ? 0 : (iqamaMinutes[prayer.arabic] ?? 15);
                  const weeklyInputValue = weekPlan.enabledDays.length === 0
                    ? fallbackMinutes
                    : distinctSelectedMinutes.length === 1 ? distinctSelectedMinutes[0] : "";
                  const weeklyMinutesAreMixed = distinctSelectedMinutes.length > 1;
                  const weekdayButtonLabel = alertKind === "before"
                    ? `اختيار أيام التنبيه قبل الصلاة لصلاة ${prayer.arabic}`
                    : alertKind === "adjust" ? `اختيار أيام تصحيح وقت صلاة ${prayer.arabic}` : `اختيار أيام الإقامة لصلاة ${prayer.arabic}`;
                  const rowDescription = alertKind === "adjust" ? `الوقت الحالي ${prayer.time}` : alertKind === "iqama" ? "تنبيه صوتي بعد الصلاة" : "تنبيه صوتي قبل الصلاة";
                  const updateSelectedDays = (value: number) => updatePrayerWeekPlan(alertKind, prayer.arabic, (plan) => {
                    const minutesByDay = { ...plan.minutesByDay };
                    plan.enabledDays.forEach((day) => { minutesByDay[day] = value; });
                    return { ...plan, minutesByDay };
                  });
                  return (
                    <div className={`prayer-setting-row settings-visual-alert-${alertsView}`} key={prayer.arabic}>
                      <SettingsCardCover src={prayerSceneUrl(prayer.arabic)} />
                      <SettingsCardArt icon={alertsView === "before" ? BellRing : alertsView === "adjust" ? SlidersHorizontal : DoorOpen} />
                      <button type="button" className="prayer-weekday-trigger" aria-label={weekdayButtonLabel} title={alertKind === "before" ? "أيام التنبيه قبل الصلاة" : alertKind === "adjust" ? "أيام تصحيح الوقت" : "أيام الإقامة"} onClick={() => setWeekdayConfig({ prayer: prayer.arabic, kind: alertKind })}><CircleAlert size={17} strokeWidth={2} /></button>
                      <div><strong>{prayer.arabic}</strong><small>{rowDescription}</small></div>
                      {alertsView === "before" ? (
                        <div className="prayer-setting-control"><input type="number" min="1" disabled={!preAlertEnabled[prayer.arabic] || weekPlan.enabledDays.length === 0} value={preAlertDrafts[prayer.arabic] ?? (weeklyInputValue === "" ? "" : String(weeklyInputValue))} placeholder={weeklyMinutesAreMixed ? "متفاوت" : undefined} aria-label={`دقائق التنبيه قبل صلاة ${prayer.arabic} للأيام المحددة`} onChange={(event) => { const raw = event.target.value; setPreAlertDrafts((items) => ({ ...items, [prayer.arabic]: raw })); if (raw === "") return; const parsed = Number(raw); if (!Number.isFinite(parsed)) return; const value = Math.max(1, Math.floor(parsed)); setPreAlertMinutes((items) => ({ ...items, [prayer.arabic]: -value })); updateSelectedDays(value); }} onBlur={() => setPreAlertDrafts((items) => { const next = { ...items }; delete next[prayer.arabic]; return next; })} /><span>دقيقة قبل الصلاة</span><label className="settings-toggle-wrap"><input type="checkbox" checked={preAlertEnabled[prayer.arabic]} onChange={(event) => setPreAlertEnabled((items) => ({ ...items, [prayer.arabic]: event.target.checked }))} /><i /></label></div>
                      ) : alertsView === "iqama" ? (
                        <div className="prayer-setting-control"><input type="number" min="0" disabled={!iqamaEnabled[prayer.arabic] || weekPlan.enabledDays.length === 0} value={weeklyInputValue} placeholder={weeklyMinutesAreMixed ? "متفاوت" : undefined} aria-label={`دقائق الإقامة لصلاة ${prayer.arabic} للأيام المحددة`} onChange={(event) => { const value = Math.max(0, Math.floor(Number(event.target.value) || 0)); setIqamaMinutes((items) => ({ ...items, [prayer.arabic]: value })); updateSelectedDays(value); }} /><span>دقيقة بعد الصلاة</span><label className="settings-toggle-wrap"><input type="checkbox" checked={iqamaEnabled[prayer.arabic]} onChange={(event) => setIqamaEnabled((items) => ({ ...items, [prayer.arabic]: event.target.checked }))} /><i /></label></div>
                      ) : (
                        <div className="prayer-setting-control"><input type="number" step="1" disabled={weekPlan.enabledDays.length === 0} value={prayerCorrectionDrafts[prayer.arabic] ?? (weeklyInputValue === "" ? "" : String(weeklyInputValue))} placeholder={weeklyMinutesAreMixed ? "متفاوت" : undefined} aria-label={`دقائق تصحيح صلاة ${prayer.arabic} للأيام المحددة`} onChange={(event) => { const raw = event.target.value; setPrayerCorrectionDrafts((items) => ({ ...items, [prayer.arabic]: raw })); if (raw === "" || raw === "-" || raw === "+") return; const value = Number(raw); if (Number.isFinite(value)) updateSelectedDays(value); }} onBlur={() => setPrayerCorrectionDrafts((items) => { const next = { ...items }; delete next[prayer.arabic]; return next; })} /><span>دقيقة</span></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {settingsView === "alerts" && alertsView !== "root" && weekdayConfig && (() => {
              const weekPlan = getPrayerWeekPlan(weekdayConfig.kind, weekdayConfig.prayer);
              const weekdayTitle = weekdayConfig.kind === "before" ? `أيام التنبيه قبل الصلاة — ${weekdayConfig.prayer}` : weekdayConfig.kind === "adjust" ? `أيام تصحيح وقت ${weekdayConfig.prayer}` : `أيام إقامة ${weekdayConfig.prayer}`;
              const weekdayDescription = weekdayConfig.kind === "before"
                ? "اختر الأيام التي تريد التنبيه فيها، ثم غيّر الدقائق بجانب الصلاة لتخصيص المدة لكل يوم."
                : weekdayConfig.kind === "adjust" ? "اختر أيام تطبيق التصحيح؛ أدخل دقائق موجبة أو سالبة، وستُحفظ قيمة مستقلة لكل يوم."
                  : "اختر أيام التنبيه، ثم غيّر الدقائق بجانب الصلاة لتطبيق المدة على الأيام المحددة فقط.";
              return createPortal(
                <div className="prayer-weekday-overlay" role="presentation" onClick={() => setWeekdayConfig(null)}>
                  <section className="prayer-weekday-panel" role="dialog" aria-modal="true" aria-labelledby="prayer-weekday-title" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="prayer-weekday-close" aria-label="إغلاق" onClick={() => setWeekdayConfig(null)}><X size={17} /></button>
                    <div className="prayer-weekday-heading"><span><CircleAlert size={19} /></span><div><h3 id="prayer-weekday-title">{weekdayTitle}</h3><p>{weekdayDescription}</p></div></div>
                    <div className="prayer-weekday-options">
                      {iqamaWeekdays.map((day) => {
                        const selected = weekPlan.enabledDays.includes(day.index);
                        return <button type="button" key={day.index} className={`prayer-weekday-option ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => updatePrayerWeekPlan(weekdayConfig.kind, weekdayConfig.prayer, (plan) => { const enabledDays = plan.enabledDays.includes(day.index) ? plan.enabledDays.filter((value) => value !== day.index) : [...plan.enabledDays, day.index].sort((a, b) => a - b); return { ...plan, enabledDays }; })}>{selected && <Check size={14} />}<span>{day.label}</span></button>;
                      })}
                    </div>
                  </section>
                </div>,
                document.querySelector(".app-shell") ?? document.body,
              );
            })()}
            {settingsView === "adhkar" && adhkarSettingsView === "root" && <div className="settings-list adhkar-settings-grid">
              
              {[["nawafil", "النوافل", "تنبيهات قيام الليل"], ["friday", "الجمعة", "الصلاة على النبي وساعة الإجابة"], ["fasting", "الصيام", "تنبيهات صيام الاثنين والخميس وأيام البيض"], ["daily", "أذكار الصباح والمساء والنوم", "تنبيهات الورد اليومي"]].map(([view, title, caption], index) => <button type="button" className={`settings-row settings-visual-adhkar settings-visual-adhkar-${view}`} key={`${title}-${index}`} onClick={() => view === "nawafil" ? setAdhkarSettingsView("nawafil") : view === "friday" ? setAdhkarSettingsView("friday") : view === "fasting" ? setAdhkarSettingsView("fasting") : view === "daily" ? setAdhkarSettingsView("daily") : notify("سيتم العمل على هذا القسم لاحقاً")}><SettingsCardCover src={adhkarSettingsSceneUrl(title)} /><span className="settings-row-icon settings-row-icon-green">{view === "nawafil" ? <MoonStar size={20} /> : view === "friday" ? <Star size={20} /> : view === "fasting" ? <Utensils size={20} /> : <SunMedium size={20} />}</span><span><strong>{title}</strong><small>{caption}</small></span><SettingsCardArt icon={view === "nawafil" ? MoonStar : view === "friday" ? Star : view === "fasting" ? Utensils : SunMedium} /><ChevronLeft size={17} /></button>)}
            </div>}
            {settingsView === "adhkar" && adhkarSettingsView === "nawafil" && <div className="settings-list adhkar-detail-list adhkar-nawafil-list">
              
              <div className="adhkar-master-row adhkar-photo-row adhkar-photo-master"><SettingsCardCover src={adhkarSettingsSceneUrl("النوافل")} /><div><strong>تفعيل إعدادات النوافل</strong><small>عند الإيقاف لا يمكن تغيير أي تنبيه</small></div><label className="settings-toggle-wrap"><input type="checkbox" checked={adhkarMasterEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setAdhkarMasterEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-duha ${!adhkarMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("النوافل")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!adhkarMasterEnabled || !duhaEnabled} onClick={() => setAdhkarSoundModal("duha")}><Volume2 size={18} /></button><div><strong>صلاة الضحى</strong><small>وقت التنبيه: <b>{duhaTime}</b></small></div></div><div className="adhkar-feature-control"><input type="time" disabled={!adhkarMasterEnabled || !duhaEnabled} value={duhaTime} onChange={(event) => setDuhaTime(event.target.value)} /><span>وقت الصلاة</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!adhkarMasterEnabled} checked={duhaEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setDuhaEnabled(event.target.checked); }} /><i /></label></div></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-qiyam ${!adhkarMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("صلاة القيام")} /><div className="adhkar-feature-copy"><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!adhkarMasterEnabled} onClick={() => setAdhkarSoundModal("qiyam")}><Volume2 size={18} /></button><div><strong>صلاة القيام</strong><small>تنبيه قبل الفجر</small></div></div><div className="adhkar-time-result">وقت التنبيه: <b>{qiyamTime}</b></div></div><div className="adhkar-feature-control"><input type="number" max="-1" disabled={!adhkarMasterEnabled || !nawafilQiyamEnabled} value={qiyamMinutesBeforeFajr} onChange={(event) => { const value = Number(event.target.value); setQiyamMinutesBeforeFajr(value < 0 ? Math.floor(value) : -1); }} /><span>دقيقة قبل الفجر</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!adhkarMasterEnabled} checked={nawafilQiyamEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setNawafilQiyamEnabled(event.target.checked); }} /><i /></label></div></div>
            </div>}
            {settingsView === "adhkar" && adhkarSettingsView === "friday" && <div className="settings-list adhkar-detail-list adhkar-friday-list">
              
              <div className="adhkar-master-row adhkar-photo-row adhkar-photo-master"><SettingsCardCover src={adhkarSettingsSceneUrl("الصلاة على النبي ﷺ")} /><div><strong>تفعيل إعدادات الجمعة</strong><small>من مغرب الخميس إلى مغرب الجمعة</small></div><label className="settings-toggle-wrap"><input type="checkbox" checked={fridayMasterEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFridayMasterEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-friday-dhikr ${!fridayMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصلاة على النبي ﷺ")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!fridayMasterEnabled} onClick={() => setAdhkarSoundModal("fridayDhikr")}><Volume2 size={18} /></button><div><strong>التذكير بالصلاة على النبي ﷺ</strong><small>اضغط علامة التعجب لتعديل أوقات التذكير</small></div></div><div className="adhkar-feature-control friday-dhikr-count-control"><button type="button" className="prayer-weekday-trigger adhkar-dhikr-time-trigger" aria-label="تعديل أوقات التذكير بالصلاة على النبي ﷺ" title="تعديل أوقات التذكير" onClick={() => setFridayDhikrTimesOpen(true)}><CircleAlert size={13} strokeWidth={2} /></button><div className="friday-dhikr-count-value"><input type="number" min="1" max="24" disabled={!fridayMasterEnabled || !fridayDhikrEnabled} value={fridayDhikrCount} onChange={(event) => updateFridayDhikrCount(Number(event.target.value))} /><span>عدد التذكير</span></div><div className="friday-dhikr-enable-row"><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fridayMasterEnabled} checked={fridayDhikrEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFridayDhikrEnabled(event.target.checked); }} /><i /></label><span>تفعيل التذكير</span></div></div></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-friday-answer ${!fridayMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("ساعة الإجابة")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!fridayMasterEnabled} onClick={() => setAdhkarSoundModal("fridayAnswer")}><Volume2 size={18} /></button><div><strong>التنبيه لساعة الإجابة</strong><small>وقت مقترح بين العصر والمغرب: 17:30</small></div></div><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fridayMasterEnabled} checked={fridayAnswerEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFridayAnswerEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-friday-takbeer ${!fridayMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("تكبير الجمعة")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!fridayMasterEnabled} onClick={() => setAdhkarSoundModal("fridayTakbeer")}><Volume2 size={18} /></button><div><strong>التكبير لصلاة الجمعة</strong><small>تنبيه قبل الجمعة بنصف ساعة</small></div></div><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fridayMasterEnabled} checked={fridayTakbeerEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFridayTakbeerEnabled(event.target.checked); }} /><i /></label></div>
            </div>}
            {settingsView === "adhkar" && adhkarSettingsView === "fasting" && <div className="settings-list adhkar-detail-list adhkar-fasting-list">
              
              <div className="adhkar-master-row adhkar-photo-row adhkar-photo-master"><SettingsCardCover src={adhkarSettingsSceneUrl("الصيام")} /><div><strong>تفعيل إعدادات الصيام</strong><small>عند الإيقاف لا يمكن تغيير أي تنبيه</small></div><label className="settings-toggle-wrap"><input type="checkbox" checked={fastingMasterEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFastingMasterEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-fasting-monday ${!fastingMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصيام")} /><div><strong>صيام الاثنين والخميس</strong><small>تنبيه لأيام الصيام المستحبة</small></div><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fastingMasterEnabled} checked={mondayThursdayEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setMondayThursdayEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-fasting-white-days ${!fastingMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصيام")} /><div><strong>صيام أيام البيض</strong><small>اليوم الثالث عشر والرابع عشر والخامس عشر هجرياً</small></div><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fastingMasterEnabled} checked={whiteDaysEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setWhiteDaysEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-fasting-fajr ${!fastingMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصيام")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!fastingMasterEnabled || !fastingBeforeFajrEnabled} onClick={() => setAdhkarSoundModal("fastingFajr")}><Volume2 size={18} /></button><div><strong>تنبيه قبل صلاة الفجر</strong><small>وقت التنبيه: <b>{fastingBeforeFajrMinutes} دقيقة</b></small></div></div><div className="adhkar-feature-control"><input type="number" max="-1" disabled={!fastingMasterEnabled || !fastingBeforeFajrEnabled} value={fastingBeforeFajrMinutes} onChange={(event) => setFastingBeforeFajrMinutes(Number(event.target.value) < 0 ? Math.floor(Number(event.target.value)) : -1)} /><span>دقيقة قبل الفجر</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fastingMasterEnabled} checked={fastingBeforeFajrEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFastingBeforeFajrEnabled(event.target.checked); }} /><i /></label></div></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-fasting-maghrib ${!fastingMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصيام قبل المغرب")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!fastingMasterEnabled || !fastingPreviousMaghribEnabled} onClick={() => setAdhkarSoundModal("fastingMaghrib")}><Volume2 size={18} /></button><div><strong>تنبيه قبل صلاة المغرب في اليوم السابق</strong><small>وقت التنبيه: <b>{fastingPreviousMaghribMinutes} دقيقة</b></small></div></div><div className="adhkar-feature-control"><input type="number" max="-1" disabled={!fastingMasterEnabled || !fastingPreviousMaghribEnabled} value={fastingPreviousMaghribMinutes} onChange={(event) => setFastingPreviousMaghribMinutes(Number(event.target.value) < 0 ? Math.floor(Number(event.target.value)) : -1)} /><span>دقيقة قبل المغرب</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!fastingMasterEnabled} checked={fastingPreviousMaghribEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setFastingPreviousMaghribEnabled(event.target.checked); }} /><i /></label></div></div>
            </div>}
            {settingsView === "adhkar" && adhkarSettingsView === "daily" && <div className="settings-list adhkar-detail-list adhkar-daily-list">
              
              <div className="adhkar-master-row adhkar-photo-row adhkar-photo-master"><SettingsCardCover src={adhkarSettingsSceneUrl("أذكار الصباح")} /><div><strong>تفعيل إعدادات الأذكار اليومية</strong><small>عند الإيقاف لا يمكن تغيير أي تنبيه</small></div><label className="settings-toggle-wrap"><input type="checkbox" checked={dailyMasterEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setDailyMasterEnabled(event.target.checked); }} /><i /></label></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-evening ${!dailyMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("الصلاة على النبي ﷺ")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!dailyMasterEnabled || !eveningDhikrEnabled} onClick={() => setAdhkarSoundModal("evening")}><Volume2 size={18} /></button><div><strong>أذكار المساء</strong><small>اختر قبل أو بعد صلاة المغرب</small></div></div><div className="adhkar-feature-control"><input type="number" min="0" disabled={!dailyMasterEnabled || !eveningDhikrEnabled} value={eveningDhikrMinutes} onChange={(event) => setEveningDhikrMinutes(Math.max(0, Number(event.target.value) || 0))} /><span>دقيقة {eveningBeforeMaghrib ? "قبل" : "بعد"} المغرب</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!dailyMasterEnabled} checked={eveningDhikrEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setEveningDhikrEnabled(event.target.checked); }} /><i /></label></div></div>
              {eveningDhikrEnabled && <div className="adhkar-choice-row"><button type="button" className={eveningBeforeMaghrib ? "active" : ""} onClick={() => { setEveningBeforeMaghrib(true); setEveningDhikrMinutes(60); }}>قبل المغرب بساعة</button><button type="button" className={!eveningBeforeMaghrib ? "active" : ""} onClick={() => { setEveningBeforeMaghrib(false); setEveningDhikrMinutes(20); }}>بعد المغرب بـ20 دقيقة</button></div>}
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-morning ${!dailyMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSettingsSceneUrl("أذكار الصباح")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!dailyMasterEnabled || !morningDhikrEnabled} onClick={() => setAdhkarSoundModal("morning")}><Volume2 size={18} /></button><div><strong>أذكار الصباح</strong><small>بعد صلاة الفجر بـ {morningDhikrMinutes} دقيقة</small></div></div><div className="adhkar-feature-control"><input type="number" min="0" disabled={!dailyMasterEnabled || !morningDhikrEnabled} value={morningDhikrMinutes} onChange={(event) => setMorningDhikrMinutes(Math.max(0, Number(event.target.value) || 0))} /><span>دقيقة بعد الفجر</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!dailyMasterEnabled} checked={morningDhikrEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setMorningDhikrEnabled(event.target.checked); }} /><i /></label></div></div>
              <div className={`adhkar-feature-row adhkar-photo-row adhkar-photo-sleep ${!dailyMasterEnabled ? "is-disabled" : ""}`}><SettingsCardCover src={adhkarSceneUrl("أذكار النوم")} /><div className="adhkar-feature-heading"><button type="button" className="adhkar-audio-trigger" disabled={!dailyMasterEnabled || !sleepDhikrListEnabled} onClick={() => setAdhkarSoundModal("sleep")}><Volume2 size={18} /></button><div><strong>أذكار النوم</strong><small>بعد صلاة العشاء بـ {sleepDhikrListMinutes} دقيقة</small></div></div><div className="adhkar-feature-control"><input type="number" min="0" disabled={!dailyMasterEnabled || !sleepDhikrListEnabled} value={sleepDhikrListMinutes} onChange={(event) => setSleepDhikrMinutes(Math.max(0, Number(event.target.value) || 0))} /><span>دقيقة بعد العشاء</span><label className="settings-toggle-wrap"><input type="checkbox" disabled={!dailyMasterEnabled} checked={sleepDhikrListEnabled} onChange={(event) => { if (event.target.checked) requestNotificationPermission(); setSleepDhikrEnabled(event.target.checked); }} /><i /></label></div></div>
            </div>}
            {fridayDhikrTimesOpen && createPortal(
              <div className="prayer-weekday-overlay friday-dhikr-times-overlay" role="presentation" onClick={() => setFridayDhikrTimesOpen(false)}>
                <section className="prayer-weekday-panel friday-dhikr-times-panel" role="dialog" aria-modal="true" aria-labelledby="friday-dhikr-times-title" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="prayer-weekday-close" aria-label="إغلاق" onClick={() => setFridayDhikrTimesOpen(false)}><X size={17} /></button>
                  <div className="prayer-weekday-heading"><span><CircleAlert size={19} /></span><div><h3 id="friday-dhikr-times-title">أوقات التذكير بالصلاة على النبي ﷺ</h3><p>يمكنك تعديل وقت كل تذكير. ستظهر التذكيرات من 1 إلى 24 حسب العدد المحدد.</p></div></div>
                  <div className="friday-dhikr-times-list">
                    {fridayDhikrTimes.slice(0, fridayDhikrCount).map((time, index) => (
                      <label className="friday-dhikr-time-row" key={`friday-dhikr-time-${index}`}><span>التذكير {index + 1}</span><input type="time" value={time} onChange={(event) => setFridayDhikrTimes((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>
                    ))}
                  </div>
                  <button type="button" className="friday-dhikr-times-done" onClick={() => setFridayDhikrTimesOpen(false)}><Check size={16} /> حفظ الأوقات</button>
                </section>
              </div>,
                document.querySelector(".app-shell") ?? document.body,
            )}
            {adhkarSoundModal && <div className="sound-modal adhkar-sound-modal" role="dialog" aria-modal="true"><div className="sound-modal-backdrop" onClick={() => setAdhkarSoundModal(null)} /><section className="sound-modal-card"><div className="sound-modal-header"><button type="button" onClick={() => setAdhkarSoundModal(null)} aria-label="العودة"><ArrowLeft size={17} /></button><div><h3>{fridaySoundTitle}</h3><p>أضف أصواتاً متعددة مستقلة لهذا التنبيه واختر الصوت النشط</p></div><Volume2 size={21} /></div><div className="adhkar-sound-modes"><button type="button" className={adhkarSoundMode === "normal" ? "active" : ""} onClick={() => setAdhkarSoundMode("normal")}><Volume2 size={20} /> صوت عادي</button><button type="button" className={adhkarSoundMode === "vibrate" ? "active" : ""} onClick={() => setAdhkarSoundMode("vibrate")}><BellRing size={20} /> هزاز</button></div><div className="sound-library-list">{adhkarSoundFiles[adhkarSoundModal].length === 0 ? <div className="sound-file-status">لم تتم إضافة صوت بعد</div> : adhkarSoundFiles[adhkarSoundModal].map((sound) => <div className={`sound-library-row ${selectedAdhkarSoundIds[adhkarSoundModal] === sound.id ? "is-selected" : ""}`} key={sound.id}><button type="button" className="sound-library-select" onClick={() => setSelectedAdhkarSoundIds((items) => ({ ...items, [adhkarSoundModal]: sound.id }))}><span className="sound-selected-mark">{selectedAdhkarSoundIds[adhkarSoundModal] === sound.id ? <Check size={13} /> : null}</span><span>{sound.name}</span></button><button type="button" className="sound-preview-button" onClick={() => testAdhkarSound(adhkarSoundModal)} aria-label="معاينة الصوت">{playingAdhkarSound === adhkarSoundModal && selectedAdhkarSoundIds[adhkarSoundModal] === sound.id ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" className="sound-trash-button" onClick={() => deleteAdhkarSound(adhkarSoundModal, sound.id)} aria-label="حذف الصوت"><Trash2 size={15} /></button></div>)}</div><div className="sound-modal-actions"><label><Plus size={16} /> إضافة صوت<input type="file" accept="audio/*" onChange={uploadAdhkarSound} /></label></div></section></div>}
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="التنقل الرئيسي">
        <button type="button" className="mobile-nav-item mobile-nav-active"><MoonStar size={19} /><span>الرئيسية</span></button>
        <button type="button" className="mobile-nav-item" onClick={() => setQiblaOpen(true)}><Compass size={19} /><span>القبلة</span></button>
        <button type="button" className="mobile-nav-center" onClick={() => notify("سبحان الله وبحمده")}><Sparkles size={21} /></button>
        <button type="button" className="mobile-nav-item" onClick={() => notify("المصحف قيد الإعداد")}><BookOpenText size={19} /><span>المصحف</span></button>
        <button type="button" className="mobile-nav-item" onClick={() => setMenuOpen((value) => !value)}><Menu size={19} /><span>المزيد</span></button>
      </nav>
      </div>
    </>
  );
}
