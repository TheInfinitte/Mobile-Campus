/**
 * prisma/seed.ts
 * ------------------------------------------------------------------
 * WHAT: Fills a fresh database with realistic sample data for DELSU, Abraka.
 * WHY : You need real-looking lodges, market items and gigs to develop and
 *       demo the app (and to test the AI Budget Assistant) without waiting
 *       for real users.
 *
 * RUN : npm run db:seed
 *       (after `npx prisma db push` or `npx prisma migrate dev`)
 *
 * Demo accounts (password comes from SEED_PASSWORD, default "password123"):
 *   Student  : 08030000001
 *   Fresher  : 08030000002
 *   Landlord : 08030000010
 *   Admin    : 08030000099
 *   Owner    : 08030000100 (SUPER_ADMIN - user management + suspensions)
 */
import { InstitutionType, PrismaClient, UserRole, VerificationStatus, WaterSource, MeterType, RoomType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../src/lib/encrypt";

// A single shared Prisma connection for the whole seed run.
const prisma = new PrismaClient();

/** Turns naira into kobo, because all money in this app is stored in kobo. */
const naira = (amount: number): number => Math.round(amount * 100);

/** Builds a date some number of days from today (positive = future). */
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/**
 * main
 * WHAT: Creates users, lodges, market items, gigs, roommate posts and the
 *       platform fee configuration, in the right order (parents first).
 * WHY : The database requires the related records to exist before we link them.
 */
async function main(): Promise<void> {
  console.log("🌱 Seeding Mobile Campus database...");

  const password = process.env.SEED_PASSWORD ?? "password123";
  const passwordHash = await bcrypt.hash(password, 10); // 10 rounds is a good balance of speed and safety.

  // -------------------------------------------------------------------------
  // 1. PLATFORM FEE CONFIGURATION
  //    Fees live in the database so admins can change them without a redeploy.
  // -------------------------------------------------------------------------
  const feeRows = [
    {
      key: "HOUSING_TENANT",
      type: "HOUSING_TENANT" as const,
      label: "Mobile Campus fee (tenant)",
      percent: 1,            // 1% of the booking
      fixedKobo: 0,
      minimumKobo: naira(500),   // Never charge less than ₦500
      maximumKobo: naira(25000), // Never charge more than ₦25,000
      payer: "PAYER" as const,
      isActive: true,
    },
    {
      key: "HOUSING_LANDLORD",
      type: "HOUSING_LANDLORD" as const,
      label: "Mobile Campus fee (landlord)",
      percent: 1,            // The other half of the 2% housing commission
      fixedKobo: 0,
      minimumKobo: naira(500),
      maximumKobo: naira(25000),
      payer: "PAYEE" as const,
      isActive: true,
    },
    {
      key: "ESCROW",
      type: "ESCROW" as const,
      label: "Escrow protection fee",
      percent: 3,            // 3% of the item or gig price
      fixedKobo: 0,
      minimumKobo: naira(300),
      maximumKobo: naira(15000),
      payer: "PAYER" as const, // Configurable: who pays the 3%
      isActive: true,
    },
    {
      key: "TRANSFER",
      type: "TRANSFER" as const,
      label: "Payout fee",
      percent: 0,
      fixedKobo: naira(50), // Flat ₦50 per payout to a seller/landlord
      minimumKobo: naira(50),
      maximumKobo: naira(50),
      payer: "PAYEE" as const,
      isActive: true,
    },
  ];

  // upsert = "update if it exists, otherwise create" so re-running the seed
  // never crashes on duplicate keys.
  for (const fee of feeRows) {
    await prisma.feeConfig.upsert({ where: { key: fee.key }, update: fee, create: fee });
  }
  console.log("✔ Fee configuration saved");

  // -------------------------------------------------------------------------
  // 1b. INSTITUTIONS - the multi-campus silo boundaries
  // -------------------------------------------------------------------------
  const delsu = await prisma.institution.upsert({
    where: { slug: "delsu-abraka" },
    update: {},
    create: {
      name: "Delta State University, Abraka",
      shortName: "DELSU",
      slug: "delsu-abraka",
      type: InstitutionType.STATE,
      city: "Abraka",
      state: "Delta",
      areas: ["Ekrejeta", "Ajalomi", "Uruoka", "Oria", "Abraka", "Oleh", "Otovwodo", "Igun", "Orerokpe", "Agbon", "Eku"],
      // SEARCHABLE ONBOARDING: these extra words make the sign-up autocomplete
      // find DELSU no matter what the student types.
      searchAliases: ["DELSU", "Delta State", "Abraka", "Delta"],
      welcomeCredits: 3,
    },
  });
  const uniben = await prisma.institution.upsert({
    where: { slug: "uniben-benin" },
    update: {},
    create: {
      name: "University of Benin, Benin City",
      shortName: "UNIBEN",
      slug: "uniben-benin",
      type: InstitutionType.FEDERAL,
      city: "Benin City",
      state: "Edo",
      areas: ["Ugbowo", "Ekenwan", "Ekosodin", "Ugbekun", "Aduwawa"],
      searchAliases: ["UNIBEN", "Benin", "Ugbowo", "Edo"],
      welcomeCredits: 3,
    },
  });
  // A private university row so the sign-up screen shows all three types.
  await prisma.institution.upsert({
    where: { slug: "covenant-ota" },
    update: {},
    create: {
      name: "Covenant University, Ota",
      shortName: "CU",
      slug: "covenant-ota",
      type: InstitutionType.PRIVATE,
      city: "Ota",
      state: "Ogun",
      areas: ["Canaan Campus"],
      searchAliases: ["Covenant", "CU", "Ota", "Canaan Land"],
      welcomeCredits: 3,
    },
  });
  console.log("✔ Institutions created (DELSU, UNIBEN, CU)");

  // -------------------------------------------------------------------------
  // 2. USERS
  // -------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { phone: "08030000099" },
    update: {},
    create: {
      phone: "08030000099",
      email: "admin@mobilecampus.ng",
      fullName: "Mobile Campus Admin",
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
    },
  });

  // A platform owner. SUPER_ADMIN is the only role that can suspend accounts
  // or change roles, so the demo needs one to exercise those screens.
  await prisma.user.upsert({
    where: { phone: "08030000100" },
    update: {},
    create: {
      phone: "08030000100",
      email: "owner@mobilecampus.ng",
      fullName: "Adaeze Owner",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
    },
  });

  const student = await prisma.user.upsert({
    where: { phone: "08030000001" },
    update: {},
    create: {
      phone: "08030000001",
      email: "chidera.student@mobilecampus.ng",
      fullName: "Chidera Okafor",
      passwordHash,
      role: UserRole.STUDENT,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
      department: "Computer Science",
      level: "300L",
      gender: "female",
      bio: "300L Computer Science. I read at night and I keep my space very neat.",
      whatsAppNumber: "08030000001",
    },
  });

  const fresher = await prisma.user.upsert({
    where: { phone: "08030000002" },
    update: {},
    create: {
      phone: "08030000002",
      email: "tunde.fresher@mobilecampus.ng",
      fullName: "Tunde Bakare",
      passwordHash,
      role: UserRole.STUDENT,
      isVerified: false, // Provisional: can browse and shortlist, cannot pay yet.
      verificationStatus: VerificationStatus.PROVISIONAL,
      consentedToData: true,
      institutionId: delsu.id,
      department: "Undeclared (Fresher)",
      level: "100L",
      gender: "male",
      bio: "New student looking for a quiet place close to the main gate.",
    },
  });

  const student2 = await prisma.user.upsert({
    where: { phone: "08030000003" },
    update: {},
    create: {
      phone: "08030000003",
      email: "emeka.nwosu@mobilecampus.ng",
      fullName: "Emeka Nwosu",
      passwordHash,
      role: UserRole.STUDENT,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
      department: "Mass Communication",
      level: "400L",
      gender: "male",
      bio: "Final year. Selling off my things before I graduate.",
    },
  });

  const landlord = await prisma.user.upsert({
    where: { phone: "08030000010" },
    update: {},
    create: {
      phone: "08030000010",
      email: "mama.sunny.lodge@mobilecampus.ng",
      fullName: "Mrs. Sunny Ogboru",
      passwordHash,
      role: UserRole.LANDLORD,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
      bio: "I own Mama Sunny Lodge in Ekrejeta. Borehole water, prepaid light.",
    },
  });

  const landlord2 = await prisma.user.upsert({
    where: { phone: "08030000011" },
    update: {},
    create: {
      phone: "08030000011",
      email: "urhuoka.estate@mobilecampus.ng",
      fullName: "Mr. Peter Erhire",
      passwordHash,
      role: UserRole.LANDLORD,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: delsu.id,
      bio: "Caretaker for Urhuoka Gardens Estate, 8 rooms available.",
    },
  });

  console.log("✔ Users created");

  // Same-gender roommate matching needs a gender on every student row.
  await prisma.user.update({ where: { phone: "08030000002" }, data: { gender: "male" } });
  await prisma.user.update({ where: { phone: "08030000003" }, data: { gender: "male", skills: ["Developer"] } });
  await prisma.user.update({ where: { phone: "08030000001" }, data: { skills: ["Designer", "Writer"] } });

  // landlord2 lists as an AGENT for an offline owner - the listing shows a badge.
  await prisma.user.update({
    where: { phone: "08030000011" },
    data: { landlordType: "AGENT", principalName: "Chief Daniel Erhire", principalPhone: "08030000021" },
  });

  // A second campus proves the silo: UNIBEN student + landlord.
  const unibenStudent = await prisma.user.upsert({
    where: { phone: "08030000004" },
    update: {},
    create: {
      phone: "08030000004",
      fullName: "Amen Osaro",
      passwordHash,
      role: UserRole.STUDENT,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: uniben.id,
      department: "Biochemistry",
      level: "200L",
      gender: "female",
      studyDownloadsLeft: 3,
    },
  });
  const unibenLandlord = await prisma.user.upsert({
    where: { phone: "08030000012" },
    update: {},
    create: {
      phone: "08030000012",
      fullName: "Mrs. Rita Imasuen",
      passwordHash,
      role: UserRole.LANDLORD,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      consentedToData: true,
      institutionId: uniben.id,
    },
  });
  // Welcome credits for the DELSU demo students (as if just approved).
  await prisma.user.updateMany({
    where: { phone: { in: ["08030000001", "08030000002", "08030000003"] }, studyDownloadsLeft: 0 },
    data: { studyDownloadsLeft: 3 },
  });

  // -------------------------------------------------------------------------
  // 3. VERIFICATION RECORDS (so the admin queue is not empty)
  //    NOTE: in real life the matric/JAMB values are encrypted before saving.
  //    The seed stores placeholder ciphertext-free values because the seed has
  //    no encryption key; production code always encrypts.
  // -------------------------------------------------------------------------
  await prisma.verificationRecord.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: student.id,
        type: "STUDENT_ID",
        status: "APPROVED",
        identifierLast4: "0142",
        phoneNumber: student.phone,
        documentUrls: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
        adminNote: "ID card matches the matriculation list.",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
      {
        userId: fresher.id,
        type: "FRESHER_JAMB",
        status: "PENDING",
        identifierLast4: "8871",
        phoneNumber: fresher.phone,
        documentUrls: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      },
      {
        userId: landlord.id,
        type: "LANDLORD_DOC",
        status: "APPROVED",
        phoneNumber: landlord.phone,
        documentUrls: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
        adminNote: "Certificate of occupancy presented.",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
      {
        userId: landlord2.id,
        type: "LANDLORD_DOC",
        status: "PENDING",
        phoneNumber: landlord2.phone,
        documentUrls: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      },
    ],
  });
  console.log("✔ Verification records created");

  // -------------------------------------------------------------------------
  // 4. LODGES - real areas around DELSU, Abraka.
  // -------------------------------------------------------------------------
  const lodges = [
    {
      landlord,
      title: "Mama Sunny Lodge - Single Self Contain",
      description:
        "Clean single self-contain with tiled bathroom, own kitchenette and a small balcony. Borehole water runs 24/7 and the estate has a prepaid meter, so you only pay for what you use. Two minutes walk to the DELSU main gate.",
      area: "Ekrejeta",
      address: "12 Ekrejeta Road, opposite the filling station",
      monthlyRentKobo: naira(45000),
      annualRentKobo: naira(480000),
      cautionDepositKobo: naira(50000),
      roomType: RoomType.SINGLE_SELF_CONTAIN,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.PREPAID,
      waterNote: "Borehole with a pumping machine. Water is free for tenants.",
      lightNote: "Prepaid meter shared per room. Expect ₦3,000 - ₦6,000 a month.",
      distanceToMainGateMeters: 450,
      distanceToFacultyMeters: 900,
      distanceToMarketMeters: 600,
      amenities: ["Tiled floor", "Security", "Borehole", "Parking", "Wardrobe"],
      availableRooms: 4,
      maxOccupancy: 1,
      caretakerName: "Mrs. Sunny Ogboru",
      caretakerPhone: "08030000010",
      isVerified: true,
      latitude: 5.7689,
      longitude: 6.1003,
      images: [
        { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=70", altText: "Bedroom with tiled floor", isCover: true, sortOrder: 0 },
        { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=70", altText: "Small kitchenette", isCover: false, sortOrder: 1 },
      ],
      reviews: [
        { user: student, rating: 5, safety: 5, cleanliness: 5, comment: "Water never finished on me in one whole semester. Caretaker is very responsive." },
        { user: student2, rating: 4, safety: 4, cleanliness: 4, comment: "Good place. Light is prepaid so budget for token every month." },
      ],
    },
    {
      landlord,
      title: "Mama Sunny Lodge - Double Self Contain (share)",
      description:
        "Spacious double self-contain ideal for two students sharing. Two big windows, cross ventilation and a shared compound with a sitting area. Great if you and a friend want to split the rent.",
      area: "Ekrejeta",
      address: "12 Ekrejeta Road, Block B",
      monthlyRentKobo: naira(65000),
      annualRentKobo: naira(700000),
      cautionDepositKobo: naira(70000),
      roomType: RoomType.DOUBLE_SELF_CONTAIN,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.PREPAID,
      waterNote: "Borehole. Two large storage tanks, so water is always available.",
      lightNote: "Prepaid meter per room.",
      distanceToMainGateMeters: 480,
      distanceToFacultyMeters: 950,
      distanceToMarketMeters: 620,
      amenities: ["Tiled floor", "Security", "Borehole", "Cross ventilation"],
      availableRooms: 2,
      maxOccupancy: 2,
      caretakerName: "Mrs. Sunny Ogboru",
      caretakerPhone: "08030000010",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=70", altText: "Spacious double room", isCover: true, sortOrder: 0 },
      ],
      reviews: [
        { user: student, rating: 4, safety: 5, cleanliness: 4, comment: "Perfect for two. Splitting ₦65k worked well for us." },
      ],
    },
    {
      landlord: landlord2,
      title: "Uruoka Gardens Estate - Room Self Contain",
      description:
        "Newly painted room self-contain in a fenced estate with a security man at night. Borehole water and a standby generator for when NEPA takes light. Very close to the Ajalomi junction.",
      area: "Uruoka",
      address: "Uruoka Gardens Estate, behind the new junction",
      monthlyRentKobo: naira(38000),
      annualRentKobo: naira(420000),
      cautionDepositKobo: naira(40000),
      roomType: RoomType.SINGLE_SELF_CONTAIN,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.GENERATOR,
      waterNote: "Borehole, pumped twice a day.",
      lightNote: "NEPA plus a standby generator. Generator token is ₦1,000 per night.",
      distanceToMainGateMeters: 1200,
      distanceToFacultyMeters: 1600,
      distanceToMarketMeters: 400,
      amenities: ["Fenced", "Security man", "Generator", "Borehole"],
      availableRooms: 8,
      maxOccupancy: 1,
      caretakerName: "Mr. Peter Erhire",
      caretakerPhone: "08030000011",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=70", altText: "Room self contain", isCover: true, sortOrder: 0 },
      ],
      reviews: [],
    },
    {
      landlord: landlord2,
      title: "Ajalomi Chambers - Budget Single Room",
      description:
        "Affordable single room in a shared compound. Bathroom and kitchen are shared with three other tenants. Well water is available all day. Good for students on a tight budget who do not mind sharing.",
      area: "Ajalomi",
      address: "Ajalomi Street, near the bakery",
      monthlyRentKobo: naira(22000),
      annualRentKobo: naira(250000),
      cautionDepositKobo: naira(20000),
      roomType: RoomType.SINGLE_ROOM,
      waterSource: WaterSource.WELL,
      meterType: MeterType.POSTPAID,
      waterNote: "Hand-dug well. You may need to queue in the morning.",
      lightNote: "Postpaid meter. The compound shares one bill, split by room.",
      distanceToMainGateMeters: 1800,
      distanceToFacultyMeters: 2200,
      distanceToMarketMeters: 300,
      amenities: ["Shared kitchen", "Well water"],
      availableRooms: 6,
      maxOccupancy: 1,
      caretakerName: "Mr. Peter Erhire",
      caretakerPhone: "08030000011",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&q=70", altText: "Simple single room", isCover: true, sortOrder: 0 },
      ],
      reviews: [],
    },
    {
      landlord,
      title: "Oria Premium 2-Bedroom Flat",
      description:
        "A modern two-bedroom flat with a fitted kitchen, two bathrooms and a large sitting room. Ideal for a group of three or four students renting together. The estate is quiet and family-friendly.",
      area: "Oria",
      address: "Oria New Layout, Estate Phase 2",
      monthlyRentKobo: naira(120000),
      annualRentKobo: naira(1350000),
      cautionDepositKobo: naira(150000),
      roomType: RoomType.FLAT_2BED,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.PREPAID,
      waterNote: "Borehole with an overhead tank and a pressure pump.",
      lightNote: "Prepaid meter for the whole flat.",
      distanceToMainGateMeters: 2600,
      distanceToFacultyMeters: 3100,
      distanceToMarketMeters: 1500,
      amenities: ["Fitted kitchen", "2 bathrooms", "Fenced estate", "Parking", "Borehole"],
      availableRooms: 1,
      maxOccupancy: 4,
      caretakerName: "Mrs. Sunny Ogboru",
      caretakerPhone: "08030000010",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=900&q=70", altText: "Modern flat living room", isCover: true, sortOrder: 0 },
        { url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=70", altText: "Fitted kitchen", isCover: false, sortOrder: 1 },
      ],
      reviews: [],
    },
    {
      landlord: landlord2,
      title: "Abraka Main Gate Studios - Single Self Contain",
      description:
        "Brand new self-contain rooms two minutes from the main gate. Prepaid light, overhead tank water and a fenced compound with a security man. Ideal if you want to roll out of bed and be in the lecture hall.",
      area: "Abraka",
      address: "3 Market Road, Abraka, behind the union building",
      monthlyRentKobo: naira(55000),
      annualRentKobo: naira(600000),
      cautionDepositKobo: naira(60000),
      roomType: RoomType.SINGLE_SELF_CONTAIN,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.PREPAID,
      waterNote: "Borehole with overhead tanks on every floor.",
      lightNote: "Prepaid meter per room.",
      distanceToMainGateMeters: 250,
      distanceToFacultyMeters: 600,
      distanceToMarketMeters: 350,
      amenities: ["Fenced", "Security man", "Borehole", "Prepaid meter"],
      availableRooms: 3,
      maxOccupancy: 1,
      caretakerName: "Mr. Peter Erhire",
      caretakerPhone: "08030000011",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=900&q=70", altText: "New self contain room", isCover: true, sortOrder: 0 },
      ],
      reviews: [],
    },
    {
      landlord,
      title: "Oleh Campus Lodge - Single Room",
      description:
        "Simple single room five minutes from the DELSU Oleh campus gate. Well water and a compound generator. Perfect for students based at the Oleh campus - not for Abraka lectures.",
      area: "Oleh",
      address: "Campus Road, Oleh, opposite the student village",
      monthlyRentKobo: naira(18000),
      annualRentKobo: naira(200000),
      cautionDepositKobo: naira(15000),
      roomType: RoomType.SINGLE_ROOM,
      waterSource: WaterSource.WELL,
      meterType: MeterType.GENERATOR,
      waterNote: "Well water, pumped morning and evening.",
      lightNote: "Compound generator runs from 6pm to 11pm.",
      distanceToMainGateMeters: 500,
      amenities: ["Well water", "Generator"],
      availableRooms: 4,
      maxOccupancy: 1,
      caretakerName: "Mrs. Sunny Ogboru",
      caretakerPhone: "08030000010",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=70", altText: "Simple single room", isCover: true, sortOrder: 0 },
      ],
      reviews: [],
    },
    {
      landlord,
      title: "Ekrejeta Shared Room (2 per room)",
      description:
        "The cheapest verified option on the platform. Two students to a room, shared bathroom and kitchen, borehole water. Perfect for freshers who want to stay close to campus while they settle in.",
      area: "Ekrejeta",
      address: "8 Ekrejeta Close",
      monthlyRentKobo: naira(15000),
      annualRentKobo: naira(170000),
      cautionDepositKobo: naira(15000),
      roomType: RoomType.SHARED_ROOM,
      waterSource: WaterSource.BOREHOLE,
      meterType: MeterType.PREPAID,
      waterNote: "Borehole shared by the compound.",
      lightNote: "Prepaid meter shared by the compound.",
      distanceToMainGateMeters: 700,
      distanceToFacultyMeters: 1100,
      distanceToMarketMeters: 500,
      amenities: ["Borehole", "Security"],
      availableRooms: 5,
      maxOccupancy: 2,
      caretakerName: "Mrs. Sunny Ogboru",
      caretakerPhone: "08030000010",
      isVerified: true,
      images: [
        { url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=900&q=70", altText: "Shared student room", isCover: true, sortOrder: 0 },
      ],
      reviews: [],
    },
  ];

  for (const lodgeData of lodges) {
    const { images, reviews, landlord: owner, ...rest } = lodgeData;

    // Create (or find) the lodge, then attach its photos and reviews.
    // MULTI-CAMPUS: each lodge lives in one institution (default DELSU); a row
    // may carry its own institutionId (the UNIBEN demo lodge does).
    const lodgeInstitution = (lodgeData as { institutionId?: string }).institutionId === uniben.id ? uniben : delsu;
    const existing = await prisma.lodge.findFirst({ where: { title: rest.title } });
    const lodge = existing
      ? await prisma.lodge.update({ where: { id: existing.id }, data: { ...rest, institutionId: lodgeInstitution.id, city: lodgeInstitution.city, state: lodgeInstitution.state } })
      : await prisma.lodge.create({ data: { ...rest, landlordId: owner.id, institutionId: lodgeInstitution.id, city: lodgeInstitution.city, state: lodgeInstitution.state } });

    // Photos: delete and re-insert so re-running the seed does not duplicate them.
    await prisma.lodgeImage.deleteMany({ where: { lodgeId: lodge.id } });
    await prisma.lodgeImage.createMany({
      data: images.map((image) => ({
        lodgeId: lodge.id,
        url: image.url,
        altText: image.altText,
        isCover: image.isCover,
        sortOrder: image.sortOrder,
      })),
    });

    // Reviews: also refresh the cached average so the listing shows a rating.
    await prisma.review.deleteMany({ where: { lodgeId: lodge.id } });
    if (reviews.length > 0) {
      await prisma.review.createMany({
        data: reviews.map((review) => ({
          lodgeId: lodge.id,
          userId: review.user.id,
          rating: review.rating,
          safety: review.safety,
          cleanliness: review.cleanliness,
          comment: review.comment,
          isVerifiedTenant: true,
        })),
      });
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await prisma.lodge.update({
        where: { id: lodge.id },
        data: { ratingAverage: Number(average.toFixed(2)), ratingCount: reviews.length },
      });
    }
  }
  console.log(`✔ ${lodges.length} lodges created in Ekrejeta, Ajalomi, Uruoka and Oria`);

  // -------------------------------------------------------------------------
  // 5. ROOMMATE PROFILES + BOARD POSTS
  // -------------------------------------------------------------------------
  // Keep the returned profile rows: RoommatePost.profileId points at
  // RoommateProfile.id (NOT User.id), so we need the profile's own id below.
  const profile1 = await prisma.roommateProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      sleepSchedule: "night-reader",
      studyStyle: "alone-quiet",
      cleanliness: 5,
      noiseTolerance: 2,
      budgetKobo: naira(50000),
      smokes: false,
      hasPets: false,
      hasGenerator: false,
      hasFridge: true,
      aboutMe: "I read late at night and sleep early in the morning. Very neat.",
      preferredAreas: ["Ekrejeta", "Uruoka"],
    },
  });

  const profile2 = await prisma.roommateProfile.upsert({
    where: { userId: student2.id },
    update: {},
    create: {
      userId: student2.id,
      sleepSchedule: "early-sleeper",
      studyStyle: "group-study",
      cleanliness: 3,
      noiseTolerance: 4,
      budgetKobo: naira(40000),
      smokes: false,
      hasPets: false,
      hasGenerator: true,
      hasFridge: false,
      aboutMe: "Final year Mass Communication. I have a small generator and a study table.",
      preferredAreas: ["Ajalomi", "Ekrejeta"],
    },
  });

  const roommatePosts = [
    {
      authorId: student.id,
      profileId: profile1.id,
      title: "Looking for 1 more neat girl for a double self-contain in Ekrejeta",
      description:
        "I already have the room reserved. I read at night so I need someone who will not mind a desk lamp. I keep the place very clean and I expect the same.",
      area: "Ekrejeta",
      groupSize: 2,
      slotsLeft: 1,
      budgetPerPersonKobo: naira(32500),
      moveInDate: daysFromNow(14),
    },
    {
      authorId: student2.id,
      profileId: profile2.id,
      title: "3 of us renting a flat in Ajalomi - need 1 more guy",
      description:
        "We are three final-year students moving into a 2-bedroom flat. Rent is ₦120k per year each. We study in groups in the evening and we are relaxed about noise.",
      area: "Ajalomi",
      groupSize: 4,
      slotsLeft: 1,
      budgetPerPersonKobo: naira(30000),
      moveInDate: daysFromNow(30),
    },
  ];

  for (const post of roommatePosts) {
    const existing = await prisma.roommatePost.findFirst({ where: { title: post.title } });
    if (!existing) {
      await prisma.roommatePost.create({ data: { ...post, institutionId: delsu.id } });
    }
  }
  console.log("✔ Roommate profiles and board posts created");

  // -------------------------------------------------------------------------
  // 6. MARKET ITEMS (including the Graduating Student Drop)
  // -------------------------------------------------------------------------
  const marketItems = [
    {
      sellerId: student2.id,
      title: "Sumec Firman 2.5KVA Generator (fairly used)",
      description:
        "Selling because I am graduating. Starts with one pull, no knocking sound. Comes with the original plug and a spare spark plug. You can test it before you pay.",
      category: "Generator",
      priceKobo: naira(95000),
      negotiableMinKobo: naira(85000),
      condition: "Fairly used",
      area: "Ekrejeta",
      pickupNote: "Pickup at Ekrejeta Road. I can carry it to the gate for free.",
      images: ["https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=70"],
      isGraduatingDrop: true,
    },
    {
      sellerId: student2.id,
      title: "6x6 Foam Mattress with cover",
      description: "Thick foam mattress, no sagging. Clean cover included. Used for two semesters.",
      category: "Mattress",
      priceKobo: naira(28000),
      negotiableMinKobo: naira(24000),
      condition: "Used",
      area: "Ekrejeta",
      pickupNote: "Pickup only, I have no means of transport for it.",
      images: ["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=70"],
      isGraduatingDrop: true,
    },
    {
      sellerId: student2.id,
      title: "Binatone Standing Fan (16 inch)",
      description: "Works perfectly, all three speeds. Selling everything before I leave Abraka.",
      category: "Fan",
      priceKobo: naira(14000),
      negotiableMinKobo: naira(12000),
      condition: "Used",
      area: "Ajalomi",
      pickupNote: "Meet me at Ajalomi junction.",
      images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=70"],
      isGraduatingDrop: true,
    },
    {
      sellerId: student2.id,
      title: "12.5kg Gas Cylinder with burner",
      description: "Cylinder is not expired, burner works. Gas is empty, so the price is for the cylinder only.",
      category: "Gas Cylinder",
      priceKobo: naira(32000),
      condition: "Used",
      area: "Uruoka",
      pickupNote: "Pickup at Uruoka Gardens.",
      images: ["https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&q=70"],
      isGraduatingDrop: true,
    },
    {
      sellerId: student.id,
      title: "200L & 300L Computer Science past questions and textbooks",
      description:
        "Bundle of 7 books: Data Structures, Discrete Maths, Computer Architecture plus past question packs. All in good condition with my notes inside.",
      category: "Books",
      priceKobo: naira(18000),
      negotiableMinKobo: naira(15000),
      condition: "Used",
      area: "Ekrejeta",
      pickupNote: "I can meet you at the faculty gate.",
      images: ["https://images.unsplash.com/photo-1512820790803-83ca734da794?w=900&q=70"],
      isGraduatingDrop: false,
    },
    {
      sellerId: fresher.id,
      title: "Mini Fridge (90 litres)",
      description: "Small fridge, cools well. Selling because my new room has no space for it.",
      category: "Fridge",
      priceKobo: naira(55000),
      negotiableMinKobo: naira(48000),
      condition: "Fairly used",
      area: "Oria",
      pickupNote: "Pickup at Oria New Layout.",
      images: ["https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=900&q=70"],
      isGraduatingDrop: false,
    },
    {
      sellerId: student.id,
      title: "Study Table and Chair",
      description: "Wooden study table with two drawers and a matching chair. Strong and stable.",
      category: "Furniture",
      priceKobo: naira(22000),
      negotiableMinKobo: naira(18000),
      condition: "Used",
      area: "Ekrejeta",
      pickupNote: "Pickup at Ekrejeta Close.",
      images: ["https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=900&q=70"],
      isGraduatingDrop: false,
    },
  ];

  for (const item of marketItems) {
    const existing = await prisma.marketItem.findFirst({ where: { title: item.title } });
    if (!existing) {
      await prisma.marketItem.create({ data: { ...item, institutionId: delsu.id } });
    }
  }
  console.log(`✔ ${marketItems.length} market items created`);

  // -------------------------------------------------------------------------
  // 7. MICRO-GIGS
  // -------------------------------------------------------------------------
  const gigs = [
    {
      posterId: student.id,
      title: "Wash and fold 2 weeks of clothes",
      description: "I have exams this week. Need someone to wash, iron and fold about 15 items. Soap and water are in my room.",
      category: "Laundry",
      area: "Ekrejeta",
      budgetKobo: naira(4000),
      isNegotiable: true,
      dueDate: daysFromNow(2),
    },
    {
      posterId: student2.id,
      title: "Braids my hair (medium knotless)",
      description: "Looking for someone good at knotless braids. I will buy the attachments myself.",
      // "Hair" moved to the Services OFFERED side; hiring it is "Other" here.
      category: "Other",
      area: "Ajalomi",
      budgetKobo: naira(8000),
      isNegotiable: false,
      dueDate: daysFromNow(5),
    },
    {
      posterId: student2.id,
      title: "Tutor me in Calculus (MTH 201)",
      description: "I need 3 sessions before my test. Preferably a 300L or 400L Mathematics student.",
      category: "Tutoring",
      area: "Ekrejeta",
      budgetKobo: naira(15000),
      isNegotiable: false,
      dueDate: daysFromNow(10),
    },
    {
      posterId: student.id,
      title: "Clean my room before move-out inspection",
      description: "Deep clean, including the bathroom and kitchen tiles. I want my full caution deposit back.",
      category: "Cleaning",
      area: "Ekrejeta",
      budgetKobo: naira(6000),
      isNegotiable: true,
      dueDate: daysFromNow(7),
    },
    // ---- Services OFFERED: students advertising their own skills ----
    {
      posterId: student.id,
      gigType: "OFFERED" as const,
      title: "Knotless braids - I come to your lodge",
      description: "Medium and large knotless, neat parts, lasts 6+ weeks. Book a day ahead. Prices shown are per style.",
      category: "Hair & Beauty",
      area: "Ekrejeta",
      budgetKobo: naira(7000),
      isNegotiable: true,
      dueDate: null,
    },
    {
      posterId: student2.id,
      gigType: "OFFERED" as const,
      title: "Phone screen repair & software fixes",
      description: "Cracked screens, battery swaps, flashing and unlocking. Most repairs done same day at the tech hub.",
      category: "Tech Support",
      area: "Ajalomi",
      budgetKobo: naira(5000),
      isNegotiable: true,
      dueDate: null,
    },
    {
      posterId: fresher.id,
      gigType: "OFFERED" as const,
      title: "Laundry service - wash, dry and iron",
      description: "Per-bag pricing. I collect from your door on Monday and return everything pressed by Wednesday.",
      category: "Laundry",
      area: "Uruoka",
      budgetKobo: naira(3000),
      isNegotiable: false,
      dueDate: null,
    },
  ];

  for (const gig of gigs) {
    const existing = await prisma.gig.findFirst({ where: { title: gig.title } });
    if (!existing) {
      await prisma.gig.create({ data: { ...gig, institutionId: delsu.id } });
    }
  }
  console.log(`✔ ${gigs.length} micro-gigs created`);

  // -------------------------------------------------------------------------
  // 7b. FOOD DIRECTORY - showcase spots (no cart, order via WhatsApp)
  // -------------------------------------------------------------------------
  const vendors = [
    {
      name: "Mama Nkechi's Kitchen",
      description: "Legendary jollof and fried rice with huge portions. The student favourite on Ekrejeta road - expect a short queue around 2pm.",
      categories: ["Rice & Swallow", "Late Night"],
      priceMinKobo: naira(1200),
      priceMaxKobo: naira(2500),
      whatsAppNumber: "08031112222",
      websiteUrl: null,
      imageUrl: null,
      area: "Ekrejeta",
      status: "ACTIVE" as const,
      isSponsored: true,
      suggestedById: student.id,
    },
    {
      name: "Grill Republic",
      description: "Suya, asun and grilled fish every evening from 6pm. Cold drinks available. They deliver within Ajalomi for orders above ₦3,000.",
      categories: ["Grills & BBQ", "Late Night"],
      priceMinKobo: naira(1500),
      priceMaxKobo: naira(4000),
      whatsAppNumber: "08053334444",
      websiteUrl: "https://grillrepublic.example.com/menu",
      imageUrl: null,
      area: "Ajalomi",
      status: "ACTIVE" as const,
      isSponsored: false,
      suggestedById: student2.id,
    },
    {
      name: "Sunrise Bakery & Breakfast",
      description: "Fresh bread, meat pie and akara from 6:30am. The cheapest breakfast within walking distance of the main gate.",
      categories: ["Bakery & Pastries", "Breakfast"],
      priceMinKobo: naira(300),
      priceMaxKobo: naira(1200),
      whatsAppNumber: "07061234567",
      websiteUrl: null,
      imageUrl: null,
      area: "Abraka",
      status: "ACTIVE" as const,
      isSponsored: false,
      suggestedById: fresher.id,
    },
    {
      // A pending suggestion so the admin food queue has something to review.
      name: "Smoothie Spot Uruoka",
      description: "Fresh fruit smoothies and yogurt bowls. Opens at 10am, closes when the fruits run out.",
      categories: ["Drinks & Smoothies"],
      priceMinKobo: naira(800),
      priceMaxKobo: naira(1500),
      whatsAppNumber: "08098765432",
      websiteUrl: null,
      imageUrl: null,
      area: "Uruoka",
      status: "SUGGESTED" as const,
      isSponsored: false,
      suggestedById: student.id,
    },
  ];

  for (const vendor of vendors) {
    const existing = await prisma.foodVendor.findFirst({ where: { name: vendor.name } });
    if (!existing) {
      await prisma.foodVendor.create({ data: { ...vendor, institutionId: delsu.id } });
    }
  }
  console.log(`✔ ${vendors.length} food directory spots created (1 pending review)`);

  // A couple of reviews so the directory cards show real ratings.
  const mamaNkechi = await prisma.foodVendor.findFirst({ where: { name: "Mama Nkechi's Kitchen" } });
  if (mamaNkechi) {
    const reviewData = [
      { userId: student2.id, rating: 5, comment: "Best jollof around the gate. Portion is serious - I share mine in two." },
      { userId: fresher.id, rating: 4, comment: "Taste is great but the 2pm queue is real. Go early or WhatsApp ahead." },
    ];
    for (const review of reviewData) {
      const existingReview = await prisma.foodReview.findUnique({
        where: { vendorId_userId: { vendorId: mamaNkechi.id, userId: review.userId } },
      });
      if (!existingReview) {
        await prisma.foodReview.create({ data: { ...review, vendorId: mamaNkechi.id } });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7c. CAMPUS ERRANDS - strictly non-food logistics
  // -------------------------------------------------------------------------
  const errands = [
    {
      posterId: student.id,
      title: "Drop my transcript request at the Faculty of Science office",
      description: "The sealed envelope is with my roommate at Hostel B. Ask for Mr Okon at the front desk and get the receipt stamped.",
      category: "Document Drop",
      pickupPoint: "Hostel B reception, Ekrejeta",
      dropOffPoint: "Faculty of Science front desk, main campus",
      feeKobo: naira(1500),
      isNegotiable: false,
      dueAt: daysFromNow(2),
    },
    {
      posterId: student2.id,
      title: "Handover: standing fan sold on the marketplace",
      description: "Buyer is coming from Oria. Meet at the main gate, hand over the fan, collect nothing - payment is already in escrow.",
      category: "Item Handover",
      pickupPoint: "My room, Ajalomi street",
      dropOffPoint: "Main gate, opposite the bakery",
      feeKobo: naira(1000),
      isNegotiable: true,
      dueAt: daysFromNow(1),
    },
    {
      posterId: fresher.id,
      title: "Return my hostel key to the caretaker",
      description: "I left for the weekend and forgot to drop the spare key. It is taped behind my door - caretaker's office is at the lodge entrance.",
      category: "Key Drop-off",
      pickupPoint: "Room 12, Peace Lodge, Uruoka",
      dropOffPoint: "Caretaker's office, Peace Lodge entrance",
      feeKobo: naira(700),
      isNegotiable: false,
      dueAt: null,
    },
  ];

  for (const errand of errands) {
    const existing = await prisma.errand.findFirst({ where: { title: errand.title } });
    if (!existing) {
      await prisma.errand.create({ data: { ...errand, institutionId: delsu.id } });
    }
  }
  console.log(`✔ ${errands.length} campus errands created`);

  // -------------------------------------------------------------------------
  // 7d. URGENT 2K - peer-to-peer goodwill board (no lending, no treasury)
  // -------------------------------------------------------------------------
  // Private goodwill records: Chidera has followed through twice, Emeka let
  // someone down once and is serving the 7-day pause that comes with it.
  await prisma.goodwillRecord.upsert({
    where: { userId: student.id },
    update: {},
    create: { userId: student.id, helpsCompleted: 2, requestsReceived: 1 },
  });
  await prisma.goodwillRecord.upsert({
    where: { userId: student2.id },
    update: {},
    create: {
      userId: student2.id,
      helpsAbandoned: 1,
      boardBannedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      banReason: "Unlocked the details of Student #2050 and let the 120-minute transfer window expire.",
    },
  });

  const goodwillExists = await prisma.goodwillRequest.findFirst();
  if (!goodwillExists) {
    // 1. OPEN and anonymous: a fresher needs transport home.
    await prisma.goodwillRequest.create({
      data: {
        requesterId: fresher.id,
        institutionId: delsu.id,
        alias: "Student #7134",
        story:
          "My mum is in hospital in Warri and I need to get home this weekend. I have ₦1,500 but the bus is ₦4,000. I would be so grateful for any help at all.",
        amountKobo: naira(4000),
        bankName: "Opay",
        // Demo only: real values are AES-encrypted by encrypt() at runtime.
        // Real ciphertext: the reveal flow must decrypt real values.
        bankAccountNumberEnc: encrypt("9876543210"),
        bankAccountNameEnc: encrypt("Tunde Bakare"),
        status: "OPEN",
      },
    });

    // 2. RECEIVED: a closed loop, so the board has a real example of a
    //    helper following through and the recipient confirming.
    const labManual = await prisma.goodwillRequest.create({
      data: {
        requesterId: student2.id,
        institutionId: delsu.id,
        alias: "Student #2050",
        story: "I need a lab manual and calculator batteries for tomorrow's practical and I am completely broke until Monday.",
        amountKobo: naira(3500),
        bankName: "Kuda MFB",
        bankAccountNumberEnc: encrypt("5551234567"),
        bankAccountNameEnc: encrypt("Emeka Nwosu"),
        status: "RECEIVED",
        receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.goodwillHelp.create({
      data: {
        requestId: labManual.id,
        helperId: student.id,
        status: "RECEIVED",
        committedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
        note: "Sent from my GTB account",
      },
    });
    console.log("✔ 2 demo goodwill requests created (1 open on the board, 1 closed loop)");
  }

  // -------------------------------------------------------------------------
  // 8. A WELCOME NOTIFICATION for the demo student
  // -------------------------------------------------------------------------
  await prisma.notification.create({
    data: {
      userId: student.id,
      title: "You are verified ✅",
      body: "Your student ID was approved. You can now pay rent with escrow protection.",
      link: "/housing",
      channel: "IN_APP",
    },
  });

  // -------------------------------------------------------------------------
  // 9. MULTI-CAMPUS + NEW FEATURES DEMO ROWS
  // -------------------------------------------------------------------------

  // One UNIBEN lodge so the silo is visible: DELSU students never see it.
  const unibenLodgeExists = await prisma.lodge.findFirst({ where: { title: "Ugbowo Self Contain - Borehole & Prepaid" } });
  if (!unibenLodgeExists) {
    await prisma.lodge.create({
      data: {
        landlordId: unibenLandlord.id,
        institutionId: uniben.id,
        title: "Ugbowo Self Contain - Borehole & Prepaid",
        description: "Clean single self-contain near the UNIBEN main gate. Borehole water and prepaid meter.",
        area: "Ugbowo",
        address: "12 Campus Road, Ugbowo, Benin City",
        city: uniben.city,
        state: uniben.state,
        monthlyRentKobo: naira(45000),
        annualRentKobo: naira(450000),
        cautionDepositKobo: naira(30000),
        roomType: RoomType.SINGLE_SELF_CONTAIN,
        waterSource: WaterSource.BOREHOLE,
        meterType: MeterType.PREPAID,
        isVerified: true,
        images: { create: [{ url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=70", isCover: true, sortOrder: 0 }] },
      },
    });
  }

  // Community board: one real-name post and one anonymous confession.
  const gistExists = await prisma.communityPost.findFirst({ where: { body: { contains: "best rice" } } });
  if (!gistExists) {
    await prisma.communityPost.create({
      data: {
        authorId: student.id, institutionId: delsu.id, topic: "Food spots",
        body: "The mama put near Ajalomi junction does the best rice and stew under 1500. Go before 12pm!",
      },
    });
    await prisma.communityPost.create({
      data: {
        authorId: student2.id, institutionId: delsu.id, topic: "Confessions", isAnonymous: true,
        alias: "Anonymous Student #4821",
        body: "I almost paid a 'landlord' on WhatsApp last week. Thank God I checked the verified badge here first. Always pay through escrow.",
      },
    });
  }

  // Project hub: one same-school blind pitch and one national one.
  const projectExists = await prisma.project.findFirst({ where: { title: "Campus Eats Map" } });
  if (!projectExists) {
    const campusEats = await prisma.project.create({
      data: {
        ownerId: student.id, institutionId: delsu.id,
        title: "Campus Eats Map",
        problem: "Freshers waste money on bad food because nobody maps the cheap, clean spots.",
        domain: "EdTech", stage: "IDEA", skillsNeeded: ["Developer", "Designer"], scope: "SAME_SCHOOL",
        fullDetails: "We crowd-source verified food spots with prices, rate them weekly, and sell featured listings to vendors. Monetisation plan attached. Need a React Native dev and a Figma designer. Equity split open for discussion.",
      },
    });
    await prisma.project.create({
      data: {
        ownerId: student2.id, institutionId: delsu.id,
        title: "PastQ - AI Past Question Explainer",
        problem: "Students have past questions but no one to explain the answers.",
        domain: "AI / Data", stage: "PROTOTYPE", skillsNeeded: ["Developer", "Marketer"], scope: "NATIONAL",
        fullDetails: "An LLM wrapper that walks through past-question answers step by step. Prototype in Python. Looking for a frontend dev and a growth marketer. Open to students from any Nigerian university.",
      },
    });
    // student2 is already approved on Campus Eats to demo the unlock flow.
    await prisma.projectApplication.create({
      data: {
        projectId: campusEats.id, applicantId: student2.id,
        message: "I can build the React Native app, I have shipped two side projects.",
        skillsOffered: ["Developer"], status: "APPROVED", decidedAt: new Date(),
      },
    });
  }

  // Study vault: an approved past question, a pending upload and a request.
  const docExists = await prisma.studyDocument.findFirst({ where: { courseCode: "CSC 205" } });
  if (!docExists) {
    await prisma.studyDocument.create({
      data: {
        uploaderId: student2.id, institutionId: delsu.id,
        department: "Computer Science", courseCode: "CSC 205",
        title: "CSC 205 Past Questions 2021-2024", kind: "PAST_QUESTION",
        description: "Four years of past questions with the 2024 answers filled in.",
        fileUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=70",
        status: "APPROVED", downloads: 4, pages: 12,
      },
    });
    await prisma.studyDocument.create({
      data: {
        uploaderId: student.id, institutionId: delsu.id,
        department: "Computer Science", courseCode: "CSC 101",
        title: "CSC 101 Intro to Computing - Full Notes", kind: "LECTURE_NOTE",
        fileUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=900&q=70",
        status: "PENDING",
      },
    });
    await prisma.materialRequest.create({
      data: {
        requesterId: fresher.id, institutionId: delsu.id,
        department: "Computer Science", courseCode: "CSC 101",
        details: "Please I need the 2023 exam paper, my CA starts next week.",
      },
    });
  }

  console.log("\n🎉 Seed complete!");
  console.log(`   Demo password for every account: ${password}`);
  console.log("   Student  : 08030000001");
  console.log("   Fresher  : 08030000002 (provisional - cannot pay yet)");
  console.log("   Landlord : 08030000010");
  console.log("   Admin    : 08030000099");
  console.log("   Owner    : 08030000100 (SUPER_ADMIN)");
}

// Run the seed, then close the database connection.
// If anything fails we log it and exit with a failure code so you notice.
main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
