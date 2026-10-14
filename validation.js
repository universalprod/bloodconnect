const BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
const CONTACT_PREFERENCES = new Set(["phone", "email"]);
const URGENCY_LEVELS = new Set(["urgent", "within-24-hours", "planned"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validPhone(value) {
  return /^[+()0-9. -]{7,24}$/.test(value);
}

function validName(value, maxLength = 80) {
  return value.length >= 2 && value.length <= maxLength;
}

export function normalizeCity(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date >= today;
}

export function validateDonor(formData) {
  const data = {
    fullName: cleanText(formData.get("fullName")),
    email: cleanText(formData.get("email")).toLowerCase(),
    phone: cleanText(formData.get("phone")),
    bloodGroup: cleanText(formData.get("bloodGroup")),
    city: cleanText(formData.get("city")),
    cityKey: normalizeCity(formData.get("city")),
    contactPreference: cleanText(formData.get("contactPreference")),
    consent: formData.get("consent") === "on",
  };

  if (!validName(data.fullName)) return { error: "Enter your full name (at least 2 characters)." };
  if (!validEmail(data.email)) return { error: "Enter a valid email address." };
  if (!validPhone(data.phone)) return { error: "Enter a valid phone number." };
  if (!BLOOD_GROUPS.has(data.bloodGroup)) return { error: "Choose a valid blood group." };
  if (!validName(data.city)) return { error: "Enter a valid city or town." };
  if (!CONTACT_PREFERENCES.has(data.contactPreference)) return { error: "Choose how you prefer to be contacted." };
  if (!data.consent) return { error: "Please agree to the contact and data-use statement." };

  return { data };
}

export function validateDonorSearch(formData) {
  const data = {
    bloodGroup: cleanText(formData.get("bloodGroup")),
    city: cleanText(formData.get("city")),
  };

  if (!BLOOD_GROUPS.has(data.bloodGroup)) return { error: "Choose a valid blood group." };
  if (!validName(data.city)) return { error: "Enter a valid city or town." };
  data.cityKey = normalizeCity(data.city);

  return { data };
}

export function validateRequest(formData) {
  const unitsValue = cleanText(formData.get("units"));
  const units = Number(unitsValue);
  const data = {
    patientName: cleanText(formData.get("patientName")),
    contactName: cleanText(formData.get("contactName")),
    email: cleanText(formData.get("email")).toLowerCase(),
    phone: cleanText(formData.get("phone")),
    hospital: cleanText(formData.get("hospital")),
    city: cleanText(formData.get("city")),
    bloodGroup: cleanText(formData.get("bloodGroup")),
    units,
    urgency: cleanText(formData.get("urgency")),
    neededBy: cleanText(formData.get("neededBy")),
    consent: formData.get("consent") === "on",
  };

  if (!validName(data.patientName)) return { error: "Enter the patient's name (at least 2 characters)." };
  if (!validName(data.contactName)) return { error: "Enter your name (at least 2 characters)." };
  if (!validEmail(data.email)) return { error: "Enter a valid email address." };
  if (!validPhone(data.phone)) return { error: "Enter a valid phone number." };
  if (!validName(data.hospital, 120)) return { error: "Enter a valid hospital or care center." };
  if (!validName(data.city)) return { error: "Enter a valid city or town." };
  if (!BLOOD_GROUPS.has(data.bloodGroup)) return { error: "Choose a valid blood group." };
  if (!Number.isInteger(units) || units < 1 || units > 10) return { error: "Enter a whole number of units from 1 to 10." };
  if (!URGENCY_LEVELS.has(data.urgency)) return { error: "Choose how soon blood is needed." };
  if (!validDate(data.neededBy)) {
    return { error: "Choose a valid date needed." };
  }
  if (!data.consent) return { error: "Please confirm you are authorized to share these details." };

  return { data };
}
