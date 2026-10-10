/**
 * src/lib/data.ts
 * WHAT: Static reference data shared across the whole app - labels, option
 *       lists and area descriptions.
 * WHY : Keeping these lists in one place means the filters, the AI assistant
 *       and the forms all offer exactly the same options.
 *
 * MULTI-CAMPUS NOTE: the community / area names are NO LONGER a global list.
 * Each Institution row stores its own `areas` array (Ekrejeta for DELSU,
 * Ugbowo for UNIBEN, ...). Pages fetch the viewer's institution and pass
 * `areas` down to filters and forms. AREA_INFO below only adds friendly
 * blurbs where we know the neighbourhood (currently DELSU).
 */

/**
 * AREA_INFO
 * WHAT: A short, honest description and rough walking time for known areas.
 * WHY : The listing cards and the AI assistant use this to explain an area to
 *       a fresher who has never been to the town. Unknown areas simply get a
 *       generic line - see areaLabel().
 */
export const AREA_INFO: Record<string, { blurb: string; walkMinutes: number }> = {
  Ekrejeta: { blurb: "The closest and most popular student area. Walking distance to the main gate.", walkMinutes: 6 },
  Ajalomi: { blurb: "Busy area with cheap rooms and plenty of food spots.", walkMinutes: 15 },
  Uruoka: { blurb: "Quieter estates with borehole water, a short ride from campus.", walkMinutes: 18 },
  Oria: { blurb: "Newer layouts with bigger flats, better for groups renting together.", walkMinutes: 25 },
  Abraka: { blurb: "The town itself - close to the market, banks and transport, mixed housing.", walkMinutes: 20 },
  Oleh: { blurb: "Around the DELSU Oleh campus. A different campus from Abraka - check your faculty location first.", walkMinutes: 0 },
  Otovwodo: { blurb: "Budget rooms along the express road.", walkMinutes: 30 },
  Igun: { blurb: "Further out but the cheapest rents on the list.", walkMinutes: 40 },
  Orerokpe: { blurb: "Railway town south of Abraka with quiet compounds and lower rents.", walkMinutes: 0 },
  Agbon: { blurb: "The wider Agbon community - family compounds and budget rooms, best with a bike.", walkMinutes: 0 },
  Eku: { blurb: "Home of the federal medical centre. Quieter, cheaper, and a ride from campus.", walkMinutes: 0 },
  Ugbowo: { blurb: "The classic UNIBEN student axis, close to the main gate.", walkMinutes: 10 },
  Ekpoma: { blurb: "Near the Ekpoma campus, busy and affordable.", walkMinutes: 0 },
};

/**
 * areaLabel
 * WHAT: Returns the area name, or "Other" for an empty/unknown value.
 * WHY : Older rows may contain an area we no longer recognise.
 */
export function areaLabel(area: string | null | undefined): string {
  if (!area) return "Other";
  return area;
}

/**
 * areaBlurb
 * WHAT: Friendly one-liner about an area, with a safe generic fallback.
 * WHY : New campuses have areas we have not described yet; the UI must never
 *       crash or show "undefined" for them.
 */
export function areaBlurb(area: string): string {
  return AREA_INFO[area]?.blurb ?? "Community near this campus - ask seniors for the latest gist.";
}

/**
 * areaWalkMinutes
 * WHAT: Rough walk time to the main gate, 0 when we do not know the area.
 * WHY : The AI budget assistant uses this to explain distances; 0 means
 *       "no walk estimate", and the assistant simply skips the walk line.
 */
export function areaWalkMinutes(area: string): number {
  return AREA_INFO[area]?.walkMinutes ?? 0;
}

/** Room types with plain-English labels. */
export const ROOM_TYPE_LABELS: Record<string, string> = {
  SINGLE_SELF_CONTAIN: "Single self-contain",
  DOUBLE_SELF_CONTAIN: "Double self-contain",
  SINGLE_ROOM: "Single room (shared facilities)",
  DOUBLE_ROOM: "Double room (shared facilities)",
  FLAT_2BED: "2-bedroom flat",
  FLAT_3BED: "3-bedroom flat",
  SHARED_ROOM: "Shared room",
};

/**
 * roomTypeLabel
 * WHAT: Plain-English label for a room type enum value.
 * WHY : Enums keep the database tidy; humans want "Single self-contain".
 */
export function roomTypeLabel(roomType: string): string {
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}

/** Water source labels. */
export const WATER_LABELS: Record<string, string> = {
  BOREHOLE: "Borehole",
  WELL: "Well",
  TAP: "Tap water",
  NONE: "No water source",
};

/** Electricity meter labels. */
export const METER_LABELS: Record<string, string> = {
  PREPAID: "Prepaid meter",
  POSTPAID: "Postpaid meter",
  GENERATOR: "Generator only",
  NONE: "No electricity",
};

/** Marketplace categories - the things students actually buy and sell. */
export const MARKET_CATEGORIES = [
  "Generator",
  "Mattress",
  "Fan",
  "Gas Cylinder",
  "Books",
  "Fridge",
  "Furniture",
  "Electronics",
  "Kitchen",
  "Clothing",
  "Other",
] as const;

/**
 * GIG_CATEGORIES
 * WHAT: Categories on the "Services Wanted" side - help a student is HIRING.
 * WHY : "Food Run" was removed on purpose: food now lives in the Food
 *       Directory and physical fetches live on the Errands board, so the gig
 *       board stays about skills.
 */
export const GIG_CATEGORIES = [
  "Laundry",
  "Tutoring",
  "Cleaning",
  "Photography",
  "Assignments & Research",
  "Other",
] as const;

/**
 * SERVICE_CATEGORIES
 * WHAT: Categories on the "Services Offered" side - skills a student SELLS.
 * WHY : Hair, laundry, tech support and the rest are personal services people
 *       advertise; they get their own list so the two boards never mix.
 */
export const SERVICE_CATEGORIES = [
  "Hair & Beauty",
  "Laundry",
  "Tech Support",
  "Tutoring",
  "Cleaning",
  "Photography",
  "Tailoring",
  "Other",
] as const;

/** Food directory filter chips - kept short so the row fits a 360px phone. */
export const FOOD_CATEGORIES = [
  "Rice & Swallow",
  "Grills & BBQ",
  "Bakery & Pastries",
  "Drinks & Smoothies",
  "Breakfast",
  "Late Night",
] as const;

/**
 * ERRAND_CATEGORIES
 * WHAT: The ONLY task types allowed on the errands board.
 * WHY : Strictly non-food. If a student picks anything else the API rejects
 *       it - a cold plate of rice is nobody's errand.
 */
export const ERRAND_CATEGORIES = [
  "Document Drop",
  "Item Handover",
  "Key Drop-off",
  "Printing & Photocopy",
  "Queue Stand-in",
  "Other",
] as const;

/** Sleep schedule options for the roommate questionnaire. */
export const SLEEP_SCHEDULES = [
  { value: "night-reader", label: "Night reader (I study late)" },
  { value: "early-sleeper", label: "Early sleeper (lights out by 10pm)" },
  { value: "flexible", label: "Flexible (I adjust to my roommate)" },
] as const;

/** Study style options. */
export const STUDY_STYLES = [
  { value: "alone-quiet", label: "I study alone in silence" },
  { value: "group-study", label: "I study in groups" },
  { value: "library", label: "I study at the library" },
] as const;

/**
 * GENDER_OPTIONS
 * WHAT: The two choices used for same-gender roommate matching.
 * WHY : Matching is strictly same-gender for safety and privacy, so the
 *       questionnaire asks once and every match query relies on it.
 */
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

/** Amenities a landlord can tick when creating a lodge. */
export const AMENITIES = [
  "Tiled floor",
  "Security",
  "Security man",
  "Borehole",
  "Generator",
  "Parking",
  "Wardrobe",
  "Fitted kitchen",
  "Fenced",
  "Cross ventilation",
  "WiFi",
  "Water tank",
] as const;

/**
 * SKILL_TAGS
 * WHAT: The skill vocabulary for the Project Hub.
 * WHY : Fixed tags let the matcher pair a project that needs a Developer with
 *       a student who offers Developer, without free-text fuzzy matching.
 */
export const SKILL_TAGS = [
  "Developer",
  "Designer",
  "Marketer",
  "Writer",
  "Data Analyst",
  "Video Editor",
  "Hardware",
  "Finance",
  "Legal",
  "Community Manager",
] as const;

/** Project domains shown in the blind-pitch form and filters. */
export const PROJECT_DOMAINS = [
  "EdTech",
  "Fintech",
  "Health",
  "AgriTech",
  "E-commerce",
  "Social",
  "AI / Data",
  "Climate",
  "Logistics",
  "Creative",
  "Other",
] as const;

/** Labels for the project stage enum. */
export const PROJECT_STAGE_LABELS: Record<string, string> = {
  IDEA: "Idea stage",
  PROTOTYPE: "Prototype built",
  MVP: "MVP live",
  LAUNCHED: "Launched",
};

/** Labels for the project scope enum. */
export const PROJECT_SCOPE_LABELS: Record<string, string> = {
  SAME_SCHOOL: "Same school only",
  NATIONAL: "Open to all schools (national)",
};

/** Topics offered on the community board (free text is also allowed). */
export const COMMUNITY_TOPICS = [
  "Campus gist",
  "Confessions",
  "Study tips",
  "Hostel life",
  "Food spots",
  "Worship & fellowship",
  "Side hustles",
  "Questions",
] as const;

/** Labels for study vault material kinds. */
export const STUDY_KIND_LABELS: Record<string, string> = {
  PAST_QUESTION: "Past question",
  LECTURE_NOTE: "Lecture note",
  SLIDES: "Slides",
  OTHER: "Other",
};
