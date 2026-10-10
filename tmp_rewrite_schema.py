"""
tmp_rewrite_schema.py
WHAT: One-off script that rewrites the "Urgent 2k" part of schema.prisma from
      the lending model into a pure peer-to-peer goodwill board.
WHY : Keeps the edit surgical - the marker block is replaced wholesale and the
      rest of the 1500-line schema is never touched.
"""
import pathlib
import re

path = pathlib.Path("prisma/schema.prisma")
source = path.read_text()

# --- 1. FeeType: the 5% emergency fee no longer exists ----------------------
source = source.replace(
    '  TRANSFER // Fixed cost per Flutterwave transfer/payout.\n  EMERGENCY // 5% service fee on the "Urgent 2k" emergency cash advance.\n}',
    "  TRANSFER // Fixed cost per Flutterwave transfer/payout.\n}",
)

# --- 2. Replace the two lending enums with the goodwill lifecycle -----------
source = source.replace(
    """/// URGENT 2K: lifecycle of an emergency cash advance.
/// PENDING     = waiting for a peer funder on the anonymous board.
/// ACTIVE      = funded, the clock is running to dueDate.
/// GRACE_PERIOD= deadline missed; a private 48-hour extension was granted.
/// REPAID      = settled in full (amount + 5% service fee).
/// OVERDUE     = grace expired. Private - never shown publicly, no shaming.
enum EmergencyStatus {
  PENDING
  ACTIVE
  GRACE_PERIOD
  REPAID
  OVERDUE
  CANCELLED
}

/// Who funded an emergency advance: the platform treasury or a peer student.
enum EmergencyFunderType {
  SYSTEM
  PEER
}""",
    """/// URGENT 2K: lifecycle of a goodwill request on the student support board.
/// OPEN         = posted, anonymous, waiting for someone to commit.
/// COMMITTED    = a helper accepted the commitment notice, details revealed,
///                the 2-hour transfer timer is running.
/// SENT         = the helper says the money has left their bank app; the
///                recipient now confirms.
/// RECEIVED     = the recipient confirmed. The loop is closed.
/// RELEASED     = the recipient let the helper off the hook (they said the
///                money is not needed or never arrived, no penalty).
/// CANCELLED    = the recipient withdrew the request.
enum GoodwillStatus {
  OPEN
  COMMITTED
  SENT
  RECEIVED
  RELEASED
  CANCELLED
}""",
)

# --- 3. Swap the Institution relation list ----------------------------------
source = source.replace(
    """  foodVendors       FoodVendor[]
  errands           Errand[]
  emergencyRequests EmergencyRequest[]""",
    """  foodVendors      FoodVendor[]
  errands          Errand[]
  goodwillRequests GoodwillRequest[]
  goodwillHelps    GoodwillHelp[]""",
)

# --- 4. Swap the User relation block ----------------------------------------
source = source.replace(
    """  // Urgent 2k: advances this student borrowed, advances they funded for
  // classmates, and their private trust record (repayments + tier limit).
  emergencyRequests   EmergencyRequest[]   @relation("EmergencyBorrower")
  emergenciesFunded   EmergencyRequest[]   @relation("EmergencyFunder")
  trustScore          UserTrustScore?""",
    """  // URGENT 2K GOODWILL BOARD: requests this student posted, the ones they
  // offered to help with, and their private goodwill record.
  goodwillPosted      GoodwillRequest[]    @relation("GoodwillRequester")
  goodwillHelped      GoodwillHelp[]       @relation("GoodwillHelper")
  goodwillRecord      GoodwillRecord?""",
)

# --- 5. Replace the whole lending model block -------------------------------
marker = "// ===========================================================================\n// URGENT 2K - EMERGENCY CASH ADVANCE"
start = source.index(marker)
new_block = '''// ===========================================================================
// URGENT 2K - PEER-TO-PEER GOODWILL BOARD (no lending, no fees, no escrow)
// ===========================================================================
//
// WHAT THIS IS NOT: the platform is never a lender, never a credit provider
// and never holds anyone's money. There is no treasury pool, no interest, no
// service fee and no repayment obligation - because nothing is ever lent.
//
// WHAT IT IS: a student asks classmates for help with a small, real
// emergency. Another student chooses to help and sends the money straight
// from their own bank app to the requester's own bank account. The platform
// only does three things: verify identities, protect dignity through
// anonymity, and record who actually followed through.
//
// The two anti-abuse rules live here:
//   1. A helper who unlocks a classmate's identity and bank details is
//      committing to send. Ghosting after that is a privacy violation, so it
//      costs them 7 days away from the board (GoodwillRecord.boardBannedUntil).
//   2. A requester can never be publicly flagged, ranked or shamed. Asking
//      for help carries no penalty of any kind.

/// PRIVATE GOODWILL RECORD: one row per student. Tracks how often they
/// followed through on help they committed to, how often they let someone
/// down, and any active board ban. Never shown to other students - only the
/// owner sees their own counts, and admins see them for moderation.
model GoodwillRecord {
  userId String @id
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Times this student said "I have sent the funds" and the recipient agreed.
  helpsCompleted Int @default(0)
  // Times this student unlocked someone's details and never followed through.
  helpsAbandoned Int @default(0)
  // Times this student confirmed money arrived. Used for the "Grateful" badge.
  requestsReceived Int @default(0)

  /// SNOOPER PENALTY: while this timestamp is in the future the student cannot
  /// open the support board or commit to anything. Set to 7 days out when a
  /// transfer timer expires without the helper marking funds sent.
  boardBannedUntil DateTime?
  /// Why the ban was applied, so admins can review it fairly.
  banReason String?

  updatedAt DateTime @updatedAt
}

/// ONE HELP OFFER. A request can collect several of these over time - each one
/// is one student's commitment, with its own 2-hour timer and outcome. Keeping
/// them separate is what makes the snooper penalty auditable: we can prove
/// exactly who unlocked what, when, and what they did next.
model GoodwillHelp {
  id        String @id @default(cuid())
  requestId String
  request   GoodwillRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  helperId  String
  helper    User            @relation("GoodwillHelper", fields: [helperId], references: [id], onDelete: Cascade)

  status GoodwillStatus @default(COMMITTED)

  /// The moment the commitment notice was accepted and details were revealed.
  committedAt DateTime  @default(now())
  /// committedAt + 2 hours. If this passes while still COMMITTED, the snooper
  /// penalty is applied.
  expiresAt DateTime
  /// When the helper marked "I have sent the funds".
  sentAt DateTime?
  /// When the recipient confirmed the money landed.
  confirmedAt DateTime?
  /// Optional note the helper leaves, e.g. "Sent from my GTB account".
  note String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // One active offer per helper per request - no double-claiming, but a
  // helper who was released may offer again later.
  @@unique([requestId, helperId])
  @@index([helperId, status])
  @@index([status, expiresAt])
}

/// ONE GOODWILL REQUEST. Posted by a student in need. Shown to browsers as
/// `alias` + `story` + amount only; the identity and bank details are locked
/// until a helper accepts the commitment notice.
model GoodwillRequest {
  id            String @id @default(cuid())
  institutionId String
  institution   Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)

  requesterId String
  requester   User   @relation("GoodwillRequester", fields: [requesterId], references: [id], onDelete: Cascade)

  /// ANONYMOUS DISPLAY METADATA: what the public board shows instead of a name.
  alias String // e.g. "Student #4821"
  /// The situation, in the requester's own words. Moderated, never financial
  /// advice, never a promise of anything in return.
  story String
  /// How much they are hoping to raise, in kobo. A hope, not a debt - nobody
  /// is ever obliged to repay a goodwill gift.
  amountKobo Int

  status GoodwillStatus @default(OPEN)

  // Payout details, AES-encrypted at rest exactly like matric numbers.
  // Revealed to a helper only after the commitment notice is accepted, and
  // only after the account name has been matched against the student ID.
  bankName String
  bankAccountNumberEnc String
  bankAccountNameEnc String

  /// The helper currently holding an active commitment, if any. Denormalised
  /// from GoodwillHelp so the board can show "someone is on it" in one query.
  activeHelpId String?

  receivedAt DateTime?
  /// Set when the requester withdraws or releases a helper.
  closedAt DateTime?
  adminNote String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  helps GoodwillHelp[]

  @@index([institutionId, status])
  @@index([requesterId, status])
  @@index([status])
}
'''
source = source[:start] + new_block
path.write_text(source)

# Sanity: nothing lending-related may survive.
leftovers = [
    word
    for word in ("TreasuryPool", "UserTrustScore", "EmergencyRequest", "EmergencyStatus", "EmergencyFunderType", "repaymentKobo", "lenderEarningsKobo")
    if re.search(word, source)
]
print("leftover lending terms:", leftovers or "none")
print("goodwill models present:", all(m in source for m in ("model GoodwillRequest", "model GoodwillHelp", "model GoodwillRecord", "enum GoodwillStatus")))
