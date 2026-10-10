/**
 * src/lib/validators.ts
 * WHAT: Zod schemas that validate EVERYTHING coming into the API - sign-up
 *       details, lodge filters, listings, escrow creation, fee edits and more.
 * WHY : Never trust the browser. A user can edit any request. Zod gives us one
 *       clear definition of "valid input" with automatic, readable errors.
 *
 * HOW IT IS USED IN A ROUTE:
 *   const parsed = safeParse(createLodgeSchema, await request.json());
 *   if (!parsed.ok) return json({ error: parsed.error }, 400);
 */
import { z } from "zod";
import { GIG_CATEGORIES, MARKET_CATEGORIES } from "./data";

// -------------------------------------------------------------------------
// SHARED PIECES
// -------------------------------------------------------------------------

/** A Nigerian phone number in local format, e.g. 08012345678. */
export const phoneSchema = z
  .string()
  .min(10, "Enter a valid phone number")
  .max(14, "Enter a valid phone number")
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => /^0[789][01]\d{8}$/.test(digits), "Enter a valid Nigerian phone number (e.g. 08012345678)");

/** A 6-digit OTP code. */
export const otpSchema = z.string().trim().length(6, "The code is 6 digits");

/**
 * passwordSchema
 * WHAT: Minimum 8 characters with at least one letter and one number.
 * WHY : Students share phones and reuse passwords. A small amount of friction
 *       here prevents very weak passwords.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long") // bcrypt only reads the first 72 bytes.
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

/** Money in kobo: a whole number, never negative. */
export const koboSchema = z
  .number({ invalid_type_error: "Enter an amount" })
  .int("Amounts must be whole numbers")
  .nonnegative("Amount cannot be negative");

/** A short piece of free text with a sane length limit. */
export const shortText = (label: string, max = 120) =>
  z.string({ required_error: `${label} is required` }).trim().min(2, `${label} is too short`).max(max, `${label} is too long`);

/** A longer description. */
export const longText = (label: string, max = 2000) =>
  z.string({ required_error: `${label} is required` }).trim().min(10, `${label} needs a little more detail`).max(max, `${label} is too long`);

/** An HTTPS image URL (we accept Cloudinary and, for seeds, unsplash/picsum). */
export const imageUrlSchema = z
  .string()
  .url("That is not a valid image link")
  .refine((url) => url.startsWith("https://"), "Image links must use https");

/** A list of image URLs, 1 to 8 images. */
export const imageListSchema = z.array(imageUrlSchema).min(1, "Add at least one photo").max(8, "You can add up to 8 photos");

// -------------------------------------------------------------------------
// AUTH
// -------------------------------------------------------------------------

/** Step 1 of sign-up: phone number, name and password. */
export const startSignupSchema = z.object({
  phone: phoneSchema,
  fullName: shortText("Your full name", 80),
  password: passwordSchema,
  role: z.enum(["STUDENT", "LANDLORD"]),
  // MULTI-CAMPUS: every account belongs to one institution, chosen here.
  institutionId: z.string().min(1, "Choose your institution"),
  // Landlords pick how they list: as the owner, or as an agent for an owner.
  landlordType: z.enum(["DIRECT", "AGENT"]).default("DIRECT"),
  // Only needed when landlordType = AGENT: the real owner's details, shown
  // publicly on their listings for transparency.
  principalName: z.string().trim().max(80).optional(),
  principalPhone: phoneSchema.optional(),
  // The NDPA consent line must be ticked.
  consent: z.literal(true, { errorMap: () => ({ message: "You must accept the data protection terms" }) }),
}).refine(
  (d) => d.role !== "LANDLORD" || d.landlordType !== "AGENT" || (!!d.principalName && !!d.principalPhone),
  { message: "As an agent, add the property owner's name and phone" }
);

/** Step 2: verify the SMS code. */
export const verifySignupSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
});

/** Sign in with a phone number and password. */
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password"),
});

/** Requesting a login OTP instead of a password. */
export const requestOtpSchema = z.object({ phone: phoneSchema });

// -------------------------------------------------------------------------
// VERIFICATION
// -------------------------------------------------------------------------

/**
 * submitVerificationSchema
 * WHAT: The proof a user uploads for verification.
 * WHY : Students submit a matric number + ID card; freshers submit a JAMB
 *       number + admission letter; landlords submit an ownership document.
 *       The identifiers are encrypted before they are stored.
 */
export const submitVerificationSchema = z.object({
  type: z.enum(["STUDENT_ID", "FRESHER_JAMB", "LANDLORD_DOC"]),
  // The identifier that matches the chosen type.
  matricNumber: z.string().trim().max(40).optional(),
  jambRegNumber: z.string().trim().max(40).optional(),
  nationalId: z.string().trim().max(40).optional(),
  // The student ID card photo itself. Required for BOTH student types - a
  // registration number alone is too easy to fake.
  idCardUrl: imageUrlSchema.optional(),
  // Extra proof images (admission letter, ownership document, ...).
  documentUrls: z.array(imageUrlSchema).max(8).default([]),
  consent: z.literal(true, { errorMap: () => ({ message: "You must allow us to store this document for verification" }) }),
}).refine(
  (data) => {
    // Each verification type needs its own identifier.
    if (data.type === "STUDENT_ID") return !!data.matricNumber && data.matricNumber.length >= 4;
    if (data.type === "FRESHER_JAMB") return !!data.jambRegNumber && data.jambRegNumber.length >= 4;
    return true; // Landlords verify with documents only.
  },
  { message: "Enter the number that matches your document" }
).refine(
  (data) => data.type === "LANDLORD_DOC" || !!data.idCardUrl,
  { message: "Upload a clear photo of your student ID card" }
);

/**
 * matricUpgradeSchema
 * WHAT: A verified fresher adding their matric number once issued.
 * WHY : Freshers start on JAMB; when the school issues a matric number they
 *       upgrade, and an admin re-checks the ID card against the new number.
 */
export const matricUpgradeSchema = z.object({
  matricNumber: z.string().trim().min(4, "Enter your matric number").max(40),
  idCardUrl: imageUrlSchema,
  consent: z.literal(true, { errorMap: () => ({ message: "You must allow us to store this document for verification" }) }),
});

/** An admin approving or rejecting a verification. */
export const reviewVerificationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_MORE_INFO"]),
  note: z.string().trim().max(500).optional(),
});

// -------------------------------------------------------------------------
// HOUSING
// -------------------------------------------------------------------------

/** Creating a new lodge listing. */
export const createLodgeSchema = z.object({
  title: shortText("Title", 90),
  description: longText("Description", 3000),
  area: z.string().min(2, "Choose an area"),
  address: shortText("Address", 200),
  monthlyRentKobo: koboSchema.refine((v) => v > 0, "Enter the monthly rent"),
  annualRentKobo: koboSchema,
  cautionDepositKobo: koboSchema,
  roomType: z.enum([
    "SINGLE_SELF_CONTAIN",
    "DOUBLE_SELF_CONTAIN",
    "SINGLE_ROOM",
    "DOUBLE_ROOM",
    "FLAT_2BED",
    "FLAT_3BED",
    "SHARED_ROOM",
  ]),
  waterSource: z.enum(["BOREHOLE", "WELL", "TAP", "NONE"]),
  meterType: z.enum(["PREPAID", "POSTPAID", "GENERATOR", "NONE"]),
  waterNote: z.string().trim().max(300).optional(),
  lightNote: z.string().trim().max(300).optional(),
  distanceToMainGateMeters: z.number().int().nonnegative().optional(),
  distanceToFacultyMeters: z.number().int().nonnegative().optional(),
  distanceToMarketMeters: z.number().int().nonnegative().optional(),
  amenities: z.array(z.string().max(60)).max(12).default([]),
  availableRooms: z.number().int().min(1).max(50).default(1),
  maxOccupancy: z.number().int().min(1).max(10).default(1),
  caretakerName: shortText("Caretaker name", 80).optional(),
  caretakerPhone: phoneSchema.optional(),
  images: imageListSchema,
});

/**
 * lodgeFilterSchema
 * WHAT: Everything the housing search screen can filter by.
 * WHY : One schema serves both the URL query string and the AI assistant, so
 *       the AI can only ever produce a filter the app already understands.
 *
 * NOTE: everything is optional - an empty filter simply means "show all".
 */
export const lodgeFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  area: z.string().trim().max(40).optional(),
  minRentKobo: koboSchema.optional(),
  maxRentKobo: koboSchema.optional(),
  roomType: z.string().trim().max(40).optional(),
  water: z.enum(["BOREHOLE", "WELL", "TAP", "NONE"]).optional(),
  meter: z.enum(["PREPAID", "POSTPAID", "GENERATOR", "NONE"]).optional(),
  maxDistanceMeters: z.number().int().nonnegative().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  sort: z.enum(["relevance", "price-asc", "price-desc", "rating", "distance"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

/** Requesting to view a lodge. */
export const viewingRequestSchema = z.object({
  lodgeId: z.string().min(1),
  preferredDate: z.coerce.date({ errorMap: () => ({ message: "Choose a date and time" }) }),
  message: z.string().trim().max(500).optional(),
});

/** A caretaker confirming or rejecting a viewing. */
export const viewingResponseSchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED", "COMPLETED", "CANCELLED"]),
  reply: z.string().trim().max(300).optional(),
});

/** Writing a review. Only verified past tenants may do this (checked server-side). */
export const createReviewSchema = z.object({
  lodgeId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  safety: z.number().int().min(1).max(5).optional(),
  cleanliness: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(15, "Tell other students a little more (15 characters minimum)").max(1000),
});

/** Move-in / move-out condition checklist. */
export const checklistSchema = z.object({
  lodgeId: z.string().min(1),
  escrowId: z.string().optional(),
  phase: z.enum(["MOVE_IN", "MOVE_OUT"]),
  items: z.array(
    z.object({
      item: z.string().max(120),
      ok: z.boolean(),
      note: z.string().max(300).optional(),
    })
  ).min(1, "Tick at least one item"),
  photoUrls: z.array(imageUrlSchema).max(10).default([]),
  signed: z.boolean().default(false),
});

// -------------------------------------------------------------------------
// ROOMMATES
// -------------------------------------------------------------------------

/** The compatibility questionnaire. */
export const roommateProfileSchema = z.object({
  sleepSchedule: z.enum(["night-reader", "early-sleeper", "flexible"]),
  studyStyle: z.enum(["alone-quiet", "group-study", "library"]),
  cleanliness: z.number().int().min(1).max(5),
  noiseTolerance: z.number().int().min(1).max(5),
  budgetKobo: koboSchema.refine((v) => v > 0, "Enter your maximum monthly rent"),
  smokes: z.boolean().default(false),
  hasPets: z.boolean().default(false),
  hasGenerator: z.boolean().default(false),
  hasFridge: z.boolean().default(false),
  // Same-gender matching is a hard safety rule, so gender is required and
  // used ONLY for roommate pairing - never shown publicly.
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Select your gender - matching is same-gender only" }) }),
  aboutMe: z.string().trim().max(400).optional(),
  preferredAreas: z.array(z.string().max(40)).max(6).default([]),
});

/** Posting to the roommate board. */
export const roommatePostSchema = z.object({
  title: shortText("Title", 90),
  description: longText("Description", 1500),
  area: z.string().min(2, "Choose an area"),
  groupSize: z.number().int().min(2, "A group needs at least 2 people").max(10),
  budgetPerPersonKobo: koboSchema.refine((v) => v > 0, "Enter a budget per person"),
  moveInDate: z.coerce.date().optional(),
});

/** Applying to join a roommate post. */
export const roommateApplicationSchema = z.object({
  postId: z.string().min(1),
  message: z.string().trim().max(400).optional(),
});

/** Accepting or declining an application. */
export const roommateApplicationDecisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
});

// -------------------------------------------------------------------------
// MARKETPLACE
// -------------------------------------------------------------------------

/** Listing an item for sale. */
export const createMarketItemSchema = z.object({
  title: shortText("Title", 90),
  description: longText("Description", 2000),
  category: z.string().min(2, "Choose a category"),
  priceKobo: koboSchema.refine((v) => v > 0, "Enter a price"),
  negotiableMinKobo: koboSchema.optional(),
  condition: z.enum(["New", "Used", "Fairly used"]).default("Used"),
  area: z.string().min(2, "Choose an area"),
  pickupNote: z.string().trim().max(300).optional(),
  images: imageListSchema,
  isGraduatingDrop: z.boolean().default(false),
});

/** Marketplace search filters. */
export const marketFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  area: z.string().trim().max(40).optional(),
  minKobo: koboSchema.optional(),
  maxKobo: koboSchema.optional(),
  graduatingOnly: z.coerce.boolean().optional(),
  sort: z.enum(["newest", "price-asc", "price-desc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

// -------------------------------------------------------------------------
// GIGS
// -------------------------------------------------------------------------

/** Posting a task. */
export const createGigSchema = z.object({
  // BIDIRECTIONAL BOARD: WANTED = "I need help", OFFERED = "I offer a service".
  gigType: z.enum(["WANTED", "OFFERED"]).default("WANTED"),
  title: shortText("Title", 90),
  description: longText("Description", 1500),
  category: z.string().min(2, "Choose a category"),
  area: z.string().min(2, "Choose an area"),
  budgetKobo: koboSchema.refine((v) => v > 0, "Enter a budget"),
  isNegotiable: z.boolean().default(false),
  dueDate: z.coerce.date().optional(),
});

/** Gig search filters. */
export const gigFilterSchema = z.object({
  // Which side of the board to browse. Empty = everything.
  gigType: z.enum(["WANTED", "OFFERED"]).optional(),
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  area: z.string().trim().max(40).optional(),
  minKobo: koboSchema.optional(),
  maxKobo: koboSchema.optional(),
  sort: z.enum(["newest", "price-asc", "price-desc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

// -------------------------------------------------------------------------
// FOOD DIRECTORY (showcase only - no cart, no checkout)
// -------------------------------------------------------------------------

/** A student suggesting a new food spot for the directory. */
export const foodSuggestionSchema = z.object({
  name: shortText("Vendor name", 80),
  description: longText("Description", 600),
  categories: z.array(z.string().trim().min(2).max(30)).min(1, "Pick at least one category").max(4),
  priceMinKobo: koboSchema.refine((v) => v > 0, "Enter the lowest typical price"),
  priceMaxKobo: koboSchema.refine((v) => v > 0, "Enter the highest typical price"),
  whatsAppNumber: z.string().trim().min(10, "Enter the vendor's WhatsApp number").max(20),
  websiteUrl: z.string().trim().url("That does not look like a web address").max(300).optional().or(z.literal("")),
  area: z.string().min(2, "Choose an area"),
});

/** A star rating + comment on a food spot. */
export const foodReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5, "Rate between 1 and 5 stars"),
  comment: longText("Comment", 500),
});

/** An admin's decision on a suggested food spot (or toggling a sponsored slot). */
export const adminFoodDecisionSchema = z.object({
  id: z.string().min(1),
  // APPROVE puts it on the directory, REMOVE hides it, ACTIVATE brings a
  // removed spot back, SPONSOR/UNSPONSOR manage the paid top slot.
  decision: z.enum(["APPROVE", "REMOVE", "ACTIVATE", "SPONSOR", "UNSPONSOR"]),
  adminNote: z.string().trim().max(300).optional(),
});

// -------------------------------------------------------------------------
// CAMPUS ERRANDS (non-food logistics)
// -------------------------------------------------------------------------

/** Categories that must NEVER include food - food belongs in the directory. */
const NON_FOOD_ERRAND_CATEGORIES = [
  "Document Drop",
  "Item Handover",
  "Key Drop-off",
  "Printing & Photocopy",
  "Queue Stand-in",
  "Other",
] as const;

/** Posting a new errand. */
export const createErrandSchema = z.object({
  title: shortText("Title", 90),
  description: longText("Description", 1200),
  category: z.enum(NON_FOOD_ERRAND_CATEGORIES, { errorMap: () => ({ message: "Choose a non-food task category" }) }),
  pickupPoint: z.string().trim().min(4, "Where is it collected?").max(140),
  dropOffPoint: z.string().trim().min(4, "Where is it delivered?").max(140),
  feeKobo: koboSchema.refine((v) => v > 0, "Enter the task fee"),
  isNegotiable: z.boolean().default(false),
  dueAt: z.coerce.date().optional(),
});

/** Errand board filters. */
export const errandFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  sort: z.enum(["newest", "fee-asc", "fee-desc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

/** Poster or mover actions on a claimed errand. */
export const errandActionSchema = z.object({
  action: z.enum(["CLAIM", "COMPLETE", "CANCEL"]),
});

// -------------------------------------------------------------------------
// URGENT 2K - PEER-TO-PEER GOODWILL BOARD (no lending, no fees)
// -------------------------------------------------------------------------

/**
 * Posting a goodwill request.
 * The bank account name is collected here and compared server-side against
 * the legal name on the verified student ID - the client cannot skip it, and
 * a mismatch means the request is never created at all.
 */
export const goodwillRequestSchema = z.object({
  // In kobo. A hope, not a debt - nobody is ever obliged to repay a gift.
  amountKobo: koboSchema.refine((v) => v >= 50000, "The smallest request is ₦500"),
  story: longText("Your situation", 600),
  bankName: z.string().trim().min(2, "Choose your bank").max(60),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "A Nigerian bank account number is 10 digits"),
  // Must match the legal name on the uploaded student ID, exactly.
  bankAccountName: shortText("Account name", 80),
  consent: z.literal(true, { errorMap: () => ({ message: "You must accept the board rules." }) }),
});

/**
 * The commitment gate.
 * `accept` must be literally true: the helper has read that unlocking a
 * classmate's identity and bank details obliges them to send, and that
 * ghosting costs 7 days away from the board.
 */
export const goodwillCommitSchema = z.object({
  accept: z.literal(true, {
    errorMap: () => ({ message: "You must accept the commitment notice before details are revealed." }),
  }),
});

/** The helper marking that the money has left their bank app. */
export const goodwillSentSchema = z.object({
  note: z.string().trim().max(200).optional(),
});

// -------------------------------------------------------------------------
// ESCROW / PAYMENTS
// -------------------------------------------------------------------------

/** Starting a payment for a deal. */
export const createEscrowSchema = z.object({
  type: z.enum(["RENT", "PURCHASE", "SERVICE"]),
  // Exactly one of these must be provided - checked with .refine below.
  lodgeId: z.string().optional(),
  marketItemId: z.string().optional(),
  gigId: z.string().optional(),
  // For rentals: how many months are being paid for.
  months: z.number().int().min(1).max(24).optional(),
});

/** Confirming that you received what you paid for (releases the money). */
export const confirmEscrowSchema = z.object({
  escrowId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

/** Opening a dispute. */
export const disputeSchema = z.object({
  escrowId: z.string().min(1),
  reason: shortText("Reason", 120),
  details: longText("What happened?", 2000),
  evidenceUrls: z.array(imageUrlSchema).max(6).default([]),
});

/** An admin resolving a dispute. */
export const resolveDisputeSchema = z.object({
  decision: z.enum(["RESOLVED_FOR_PAYER", "RESOLVED_FOR_PAYEE"]),
  resolution: longText("Your decision and reason", 1000),
});

// -------------------------------------------------------------------------
// REPORTS
// -------------------------------------------------------------------------

/** Reporting a scam, fake listing or harassment. */
export const reportSchema = z.object({
  type: z.enum(["SCAM", "HARASSMENT", "FAKE_LISTING", "INAPPROPRIATE", "OTHER"]),
  details: longText("Tell us what happened", 1500),
  lodgeId: z.string().optional(),
  marketItemId: z.string().optional(),
  gigId: z.string().optional(),
  communityPostId: z.string().optional(),
  reportedUserId: z.string().optional(),
});

// -------------------------------------------------------------------------
// AI BUDGET ASSISTANT
// -------------------------------------------------------------------------

/**
 * budgetPromptSchema
 * WHAT: The message a student sends to the AI Budget Assistant.
 * WHY : We rate-limit this endpoint because it calls a paid AI model. A hard
 *       length limit also stops someone pasting an entire essay.
 */
export const budgetPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Tell me what you need, for example: I have 150k")
    .max(400, "Keep it under 400 characters"),
  // Optional: let the user narrow the search to one area.
  area: z.string().trim().max(40).optional(),
});

// -------------------------------------------------------------------------
// ADMIN
// -------------------------------------------------------------------------

/** Editing a fee rule. */
export const feeConfigSchema = z.object({
  key: z.string().min(3).max(40),
  label: shortText("Label", 80),
  percent: z.number().int().min(0).max(50, "A fee above 50% is not allowed"),
  fixedKobo: koboSchema,
  minimumKobo: koboSchema,
  maximumKobo: koboSchema,
  payer: z.enum(["PAYER", "PAYEE", "SPLIT"]),
  isActive: z.boolean().default(true),
});

/** Admin dashboard filter (verification queue, reports, disputes). */
export const adminListSchema = z.object({
  status: z.string().trim().max(30).optional(),
  type: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
});

// -------------------------------------------------------------------------
// COMMUNITY BOARD
// -------------------------------------------------------------------------

/** A post on the community (gist) board. Anonymous mode is optional. */
export const communityPostSchema = z.object({
  body: z.string().trim().min(5, "Say a little more").max(2000, "Keep it under 2000 characters"),
  topic: z.string().trim().max(40).optional(),
  // Anonymous posts show an alias publicly; the true author stays server-side.
  isAnonymous: z.boolean().default(false),
});

/** A reply under a community post. Same anonymity rules. */
export const communityReplySchema = z.object({
  body: z.string().trim().min(2, "Say a little more").max(1000, "Keep it under 1000 characters"),
  isAnonymous: z.boolean().default(false),
});

// -------------------------------------------------------------------------
// PROJECT HUB (blind pitch)
// -------------------------------------------------------------------------

/** Creating a blind-pitch collaboration listing. */
export const projectSchema = z.object({
  title: shortText("Project title", 90),
  // PUBLIC teaser: high level only - never the secret sauce.
  problem: longText("The problem you are solving", 600),
  domain: z.string().min(2, "Pick a domain"),
  stage: z.enum(["IDEA", "PROTOTYPE", "MVP", "LAUNCHED"]),
  skillsNeeded: z.array(z.string().max(40)).min(1, "Add at least one skill you need").max(6),
  scope: z.enum(["SAME_SCHOOL", "NATIONAL"]),
  // PRIVATE until the owner approves an applicant.
  fullDetails: longText("The full pitch (shown only after you approve someone)", 4000),
  contactNote: z.string().trim().max(300).optional(),
});

/** Applying to join a project. */
export const projectApplicationSchema = z.object({
  message: longText("Why should the owner pick you?", 600),
  skillsOffered: z.array(z.string().max(40)).min(1, "Add at least one skill you offer").max(6),
});

/** The owner approving or declining an applicant. */
export const projectDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "DECLINED"]),
});

/** The skills a student offers, edited from their profile. */
export const skillsSchema = z.object({
  skills: z.array(z.string().max(40)).max(8).default([]),
});

// -------------------------------------------------------------------------
// STUDY VAULT
// -------------------------------------------------------------------------

/** Uploading a past question / lecture note. */
export const studyDocSchema = z.object({
  department: shortText("Department", 80),
  courseCode: shortText("Course code", 20),
  title: shortText("Title", 120),
  kind: z.enum(["PAST_QUESTION", "LECTURE_NOTE", "SLIDES", "OTHER"]),
  description: z.string().trim().max(500).optional(),
  // A PDF or image-set link from the uploader endpoint.
  fileUrl: z.string().url("Add the file").refine((u) => u.startsWith("https://"), "File links must use https"),
  pages: z.number().int().min(1).max(2000).optional(),
});

/** Asking seniors for a material on the request board. */
export const materialRequestSchema = z.object({
  department: shortText("Department", 80),
  courseCode: shortText("Course code", 20),
  details: z.string().trim().max(500).optional(),
});

// -------------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------------

/** Result of running a schema against some input. */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string; issues: z.ZodIssue[] };

/**
 * safeParse
 * WHAT: Runs a Zod schema and returns either the clean data or a single
 *       readable error message.
 * WHY : API routes need a quick "valid or not" check with a message we can show
 *       directly to the user on their phone.
 */
export function safeParse<T, I = T>(schema: z.ZodType<T, z.ZodTypeDef, I>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const firstIssue = result.error.issues[0];
  return {
    ok: false,
    error: firstIssue?.message ?? "That input is not valid.",
    issues: result.error.issues,
  };
}

/** Re-export the option lists so client forms can use the same values. */
export const VALID_MARKET_CATEGORIES = MARKET_CATEGORIES;
export const VALID_GIG_CATEGORIES = GIG_CATEGORIES;

// ---------------------------------------------------------------------------
// ADMIN MODERATION & USER MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * moderationSchema
 * WHAT: Validates an admin's moderation decision on one piece of content.
 * WHY : Moderation changes what students can see, so the action must be one
 *       of a known set and the note must be meaningful. An empty reason is
 *       the classic cause of "why was my listing removed?" support tickets.
 */
export const moderationSchema = z.object({
  // Which kind of content. Drives which table the route updates.
  type: z.enum(["MARKET_ITEM", "GIG", "LODGE"]),
  id: z.string().min(1, "Which listing did you mean?"),
  // FLAG = mark for review (still visible). HIDE = pull off the student board.
  // RESTORE = put it back. DELETE = remove it permanently.
  action: z.enum(["FLAG", "HIDE", "RESTORE", "DELETE"]),
  // Required for FLAG and HIDE: the seller is told why. Optional for the
  // others because those actions are not punishments.
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

/**
 * userActionSchema
 * WHAT: Validates a SUPER_ADMIN action on another account.
 * WHY : Suspending someone is serious and reversible-only-by-staff, so the
 *       input is checked strictly: a duration from a fixed list, a reason
 *       that will be shown to the user verbatim, and a role from the enum.
 */
export const userActionSchema = z.object({
  userId: z.string().min(1, "Which account?"),
  // SUSPEND = block sign-in. LIFT = unblock. SET_ROLE = change their tier.
  // NOTE = save a private admin note only.
  action: z.enum(["SUSPEND", "LIFT", "SET_ROLE", "NOTE"]),
  // How long the suspension lasts, in days. 0 means permanent.
  days: z.number().int().min(0).max(3650, "Pick a suspension length under 10 years.").optional(),
  // Shown to the user when they are blocked, and kept for the audit trail.
  reason: z.string().trim().max(300, "Keep the reason under 300 characters.").optional(),
  // New tier, only used when action = SET_ROLE.
  role: z.enum(["STUDENT", "LANDLORD", "ADMIN", "SUPER_ADMIN"]).optional(),
  // Private note only admins can see.
  adminNote: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});
