export type CitySchedule = {
  country: string;
  city: string;
  lat: number;
  lon: number;
  timeZone: string;
  times?: string[];
};

export type CalculatedPrayer = { time: string; minuteOfDay: number };
export type NightTimes = { midnight: CalculatedPrayer; lastThird: CalculatedPrayer; nightLengthMinutes: number };

const MOROCCO = "المغرب";
const MOROCCO_PERMANENT_GMT_START = Date.UTC(2026, 8, 20, 2);

const moroccoCityData: [string, number, number][] = [
  ["الدار البيضاء", 33.5731, -7.5898],
  ["الرباط", 34.0209, -6.8416],
  ["مراكش", 31.6295, -7.9811],
  ["فاس", 34.0331, -5.0003],
  ["طنجة", 35.7595, -5.834],
  ["أكادير", 30.4278, -9.5981],
  ["مكناس", 33.8935, -5.5473],
  ["وجدة", 34.6814, -1.9086],
  ["تطوان", 35.5785, -5.3684],
  ["القنيطرة", 34.261, -6.5802],
  ["سلا", 34.0531, -6.7985],
  ["تمارة", 33.9272, -6.9063],
  ["المحمدية", 33.6861, -7.3828],
  ["الجديدة", 33.2316, -8.5007],
  ["آسفي", 32.2994, -9.2372],
  ["بني ملال", 32.3373, -6.3498],
  ["خريبكة", 32.886, -6.9209],
  ["الناظور", 35.1681, -2.9335],
  ["تازة", 34.21, -4.01],
  ["العرائش", 35.1932, -6.1557],
  ["سطات", 33.001, -7.6166],
  ["برشيد", 33.2655, -7.5875],
  ["الحسيمة", 35.2493, -3.9373],
  ["الصويرة", 31.5085, -9.7595],
  ["ورزازات", 30.9189, -6.8934],
  ["الرشيدية", 31.9314, -4.4244],
  ["كلميم", 28.987, -10.0574],
  ["العيون", 27.1253, -13.1625],
  ["الداخلة", 23.6848, -15.957],
  ["طانطان", 28.438, -11.103],
  ["تارودانت", 30.4703, -8.8769],
  ["خنيفرة", 32.9391, -5.6672],
  ["تاونات", 34.5361, -4.6401],
  ["شفشاون", 35.1688, -5.2636],
  ["سيدي قاسم", 34.2215, -5.7078],
  ["سيدي سليمان", 34.2648, -5.9254],
  ["ميدلت", 32.6852, -4.7451],
  ["أزيلال", 31.9616, -6.5711],
  ["بن جرير", 32.2308, -8.838],
  ["قلعة السراغنة", 32.0526, -8.315],
  ["السمارة", 26.7384, -11.6719],
  ["بوجدور", 26.1262, -14.484],
  ["الفقيه بن صالح", 32.5014, -6.6872],
  ["جرسيف", 34.2257, -3.3536],
  ["وزان", 34.7958, -5.5785],
  ["سوق الأربعاء الغرب", 34.4876, -6.0026],
];

const moroccoCities: CitySchedule[] = moroccoCityData.map(([city, lat, lon]) => ({ country: MOROCCO, city, lat, lon, timeZone: "Africa/Casablanca" }));

const internationalCities: CitySchedule[] = [
  { country: "المملكة العربية السعودية", city: "الرياض", lat: 24.7136, lon: 46.6753, timeZone: "Asia/Riyadh", times: ["05:44", "07:07", "01:35", "05:01", "07:50", "09:06"] },
  { country: "المملكة العربية السعودية", city: "مكة المكرمة", lat: 21.3891, lon: 39.8579, timeZone: "Asia/Riyadh", times: ["05:08", "06:25", "12:22", "03:43", "06:19", "07:49"] },
  { country: "مصر", city: "القاهرة", lat: 30.0444, lon: 31.2357, timeZone: "Africa/Cairo", times: ["05:08", "06:34", "12:52", "04:22", "07:10", "08:29"] },
  { country: "الإمارات العربية المتحدة", city: "دبي", lat: 25.2048, lon: 55.2708, timeZone: "Asia/Dubai", times: ["05:02", "06:17", "12:18", "03:42", "06:19", "07:49"] },
  { country: "الأردن", city: "عمّان", lat: 31.9539, lon: 35.9106, timeZone: "Asia/Amman", times: ["05:19", "06:42", "12:39", "04:14", "07:00", "08:18"] },
  { country: "تركيا", city: "إسطنبول", lat: 41.0082, lon: 28.9784, timeZone: "Europe/Istanbul", times: ["05:18", "06:48", "01:13", "04:44", "07:38", "09:03"] },
  { country: "المملكة المتحدة", city: "لندن", lat: 51.5072, lon: -0.1276, timeZone: "Europe/London", times: ["04:51", "06:26", "01:05", "05:02", "07:44", "09:18"] },
  { country: "الولايات المتحدة الأمريكية", city: "نيويورك", lat: 40.7128, lon: -74.006, timeZone: "America/New_York", times: ["05:12", "06:29", "01:00", "04:48", "07:31", "08:54"] },
];

export const citySchedules: CitySchedule[] = [...moroccoCities, ...internationalCities];
export const defaultCity = citySchedules[0];
export const prayerMethodLabel = "حساب فلكي يومي حسب الإحداثيات والتوقيت المحلي";

function fixAngle(angle: number) {
  return angle - 360 * Math.floor(angle / 360);
}

function fixHour(hour: number) {
  return hour - 24 * Math.floor(hour / 24);
}

function julianDay(year: number, month: number, day: number) {
  let adjustedYear = year;
  let adjustedMonth = month;
  if (adjustedMonth <= 2) {
    adjustedYear -= 1;
    adjustedMonth += 12;
  }
  const a = Math.floor(adjustedYear / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (adjustedYear + 4716)) + Math.floor(30.6001 * (adjustedMonth + 1)) + day + b - 1524.5;
}

function sunPosition(jd: number) {
  const d = jd - 2451545;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * Math.sin(g * Math.PI / 180) + 0.02 * Math.sin(2 * g * Math.PI / 180));
  const e = 23.439 - 0.00000036 * d;
  const rightAscension = Math.atan2(Math.cos(e * Math.PI / 180) * Math.sin(l * Math.PI / 180), Math.cos(l * Math.PI / 180)) * 180 / Math.PI / 15;
  const equation = q / 15 - fixHour(rightAscension);
  const declination = Math.asin(Math.sin(e * Math.PI / 180) * Math.sin(l * Math.PI / 180)) * 180 / Math.PI;
  return { equation, declination };
}

function midDay(time: number, jd: number) {
  return fixHour(12 - sunPosition(jd + time).equation);
}

function sunAngleTime(angle: number, time: number, direction: "cw" | "ccw", latitude: number, jd: number) {
  const { equation, declination } = sunPosition(jd + time);
  const noon = 12 - equation;
  const cosine = (-Math.sin(angle * Math.PI / 180) - Math.sin(declination * Math.PI / 180) * Math.sin(latitude * Math.PI / 180)) / (Math.cos(declination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180));
  const delta = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI / 15;
  return noon + (direction === "cw" ? delta : -delta);
}

function asrTime(time: number, latitude: number, jd: number) {
  const { declination } = sunPosition(jd + time);
  const angle = -Math.atan(1 / (1 + Math.tan(Math.abs((latitude - declination) * Math.PI / 180)))) * 180 / Math.PI;
  return sunAngleTime(angle, time, "cw", latitude, jd);
}

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function getTimeZoneOffsetHours(date: Date, timeZone: string) {
  // Morocco's Decree 2.26.530 ended the permanent UTC+1 system on 20 Sep 2026.
  // Keep this explicit fallback for browsers whose bundled tzdata predates IANA 2026c/e.
  if (timeZone === "Africa/Casablanca" && date.getTime() >= MOROCCO_PERMANENT_GMT_START) return 0;
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const hours = Number(match[2]) + Number(match[3] ?? 0) / 60;
  return match[1] === "-" ? -hours : hours;
}

function getStandardTimeZoneOffsetHours(year: number, timeZone: string) {
  const winterOffset = getTimeZoneOffsetHours(new Date(Date.UTC(year, 0, 15, 12)), timeZone);
  const summerOffset = getTimeZoneOffsetHours(new Date(Date.UTC(year, 6, 15, 12)), timeZone);
  return Math.min(winterOffset, summerOffset);
}

function normalizeMinutes(minutes: number) {
  return ((Math.round(minutes) % 1440) + 1440) % 1440;
}

function displayTime(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function parseStaticTime(value: string, index: number) {
  const [rawHour, minute] = value.split(":").map(Number);
  const hour = index >= 2 && index <= 5 && rawHour < 12 ? rawHour + 12 : rawHour;
  return hour * 60 + minute;
}

function calculateAstronomicalMinutes(city: CitySchedule, date: Date, daylightSavingEnabled: boolean) {
  const { year, month, day } = getDateParts(date, city.timeZone);
  const currentDate = new Date(Date.UTC(year, month - 1, day, 12));
  const timezone = daylightSavingEnabled
    ? getTimeZoneOffsetHours(currentDate, city.timeZone)
    : getStandardTimeZoneOffsetHours(year, city.timeZone);
  const jd = julianDay(year, month, day) + city.lon / (15 * 24);
  let times = [5, 6, 12, 13, 18, 18].map((value) => value / 24);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const raw = [
      sunAngleTime(18, times[0], "ccw", city.lat, jd),
      sunAngleTime(0.833, times[1], "ccw", city.lat, jd),
      midDay(times[2], jd),
      asrTime(times[3], city.lat, jd),
      sunAngleTime(0.833, times[4], "cw", city.lat, jd),
      sunAngleTime(17, times[5], "cw", city.lat, jd),
    ];
    times = raw.map((value) => (value - city.lon / 15 + timezone) / 24);
  }
  const localCalibration = city.country === MOROCCO ? [-6, -4, 4, -1, 4, -1] : [0, 0, 0, 0, 0, 0];
  return times.map((value, index) => normalizeMinutes(value * 24 * 60 + localCalibration[index]));
}

export function getPrayerScheduleForCity(city: CitySchedule, date: Date, daylightSavingEnabled = true): CalculatedPrayer[] {
  // All cities use the same astronomical method; static presets are intentionally ignored.
  const minutes = calculateAstronomicalMinutes(city, date, daylightSavingEnabled);
  return minutes.map((minuteOfDay) => ({ minuteOfDay, time: displayTime(minuteOfDay) }));
}

export function getNightTimesForCity(city: CitySchedule, date: Date, daylightSavingEnabled = true): NightTimes {
  const schedule = getPrayerScheduleForCity(city, date, daylightSavingEnabled);
  const sunset = schedule[4]?.minuteOfDay ?? 18 * 60;
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const nextFajr = (getPrayerScheduleForCity(city, nextDay, daylightSavingEnabled)[0]?.minuteOfDay ?? 5 * 60) + 1440;
  const nightLengthMinutes = Math.max(1, nextFajr - sunset);
  const midnightMinutes = sunset + nightLengthMinutes / 2;
  const lastThirdMinutes = sunset + (nightLengthMinutes * 2) / 3;
  return {
    midnight: { minuteOfDay: normalizeMinutes(midnightMinutes), time: displayTime(midnightMinutes) },
    lastThird: { minuteOfDay: normalizeMinutes(lastThirdMinutes), time: displayTime(lastThirdMinutes) },
    nightLengthMinutes: Math.round(nightLengthMinutes),
  };
}

export function getCityClock(date: Date, city: CitySchedule, daylightSavingEnabled = true) {
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: city.timeZone, year: "numeric" }).format(date));
  const currentOffset = getTimeZoneOffsetHours(date, city.timeZone);
  const standardOffset = getStandardTimeZoneOffsetHours(year, city.timeZone);
  const clockDate = daylightSavingEnabled || currentOffset === standardOffset
    ? date
    : new Date(date.getTime() + (standardOffset - currentOffset) * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: city.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(clockDate);
  return {
    hours: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minutes: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
    seconds: Number(parts.find((part) => part.type === "second")?.value ?? 0),
  };
}

export function getCityDateLabels(date: Date, city: CitySchedule) {
  const dateLabel = new Intl.DateTimeFormat("ar-MA", { timeZone: city.timeZone, day: "numeric", month: "long", year: "numeric" }).format(date);
  const weekdayLabel = new Intl.DateTimeFormat("ar-MA", { timeZone: city.timeZone, weekday: "long" }).format(date);
  const hijriLabel = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { timeZone: city.timeZone, day: "numeric", month: "long", year: "numeric" }).format(date);
  return { dateLabel, weekdayLabel, hijriLabel };
}
