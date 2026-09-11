import "dotenv/config";
import express, { Response } from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import type { SquadMember, Spotlight, SpotlightSource } from "./src/types";
import { normalizePhone } from "./src/utils/phone";

const app = express();
// Port is configurable so the app can slot into a shared box that already
// assigns its own ports per service. Defaults to 3000 when unset.
const PORT = Number(process.env.PORT) || 3000;
const APP_URL = process.env.APP_URL
  ? (/^https?:\/\//i.test(process.env.APP_URL) ? process.env.APP_URL : `http://${process.env.APP_URL}`)
  : `http://localhost:${PORT}`;

app.use(express.json());

// -------------------------------------------------------------
// Voter Identity (tcf_vid cookie) - no extra deps
// -------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      voterId: string;
    }
  }
}

const VOTER_COOKIE = "tcf_vid";
const VOTER_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  let voterId = cookies[VOTER_COOKIE];
  if (!voterId || !VOTER_ID_PATTERN.test(voterId)) {
    voterId = crypto.randomUUID().replace(/-/g, "");
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
    const isSecure = req.secure || forwardedProto === "https";
    const attrs = [
      `${VOTER_COOKIE}=${voterId}`,
      "Path=/",
      `Max-Age=${60 * 60 * 24 * 365}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(isSecure ? ["Secure"] : [])
    ];
    res.setHeader("Set-Cookie", attrs.join("; "));
  }
  req.voterId = voterId;
  next();
});

// -------------------------------------------------------------
// Host authentication (shared key)
// -------------------------------------------------------------
// HOST_KEY is a shared secret handed only to whoever runs the stage console.
// When it is unset the gate is a no-op, so local dev and CI behave exactly as
// before. In production (public URL) it must be set, otherwise any attendee who
// strips ?mode=audience — or anyone with curl — can close rounds, broadcast to
// every phone in the room, or burn the Gemini key.
const HOST_KEY = process.env.HOST_KEY || "";

function hasHostKey(req: express.Request): boolean {
  if (!HOST_KEY) return true;
  const provided = req.headers["x-tcf-host"];
  return typeof provided === "string" && provided === HOST_KEY;
}

function requireHost(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (hasHostKey(req)) return next();
  return res.status(403).json({ success: false, error: "Host key required." });
}

// Lets the client decide whether to render the console. Never echoes the key.
app.get("/api/host/verify", (req, res) => {
  res.json({ success: true, ok: hasHostKey(req) });
});

// Persistent State Storage File Path
const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "room_state.json");

// Ensure .data dir exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create .data directory for state persistence:", e);
}

// Initial default Plateau Problems tailored for Jos & Plateau State context
const defaultProblems = [
  {
    id: "prob-1",
    title: "Cold-Chain & Solar Preservation for Potato & Tomato Farmers in Vom/Bokkos",
    description: "Post-harvest loss reaches over 40% for Plateau fresh produce due to lack of off-grid solar cold storage and direct market logistics. Founders can build IoT monitored cold hubs and order matching.",
    category: "Agro-Tech & Cold Chain",
    submittedBy: "Pamela D. (Jos South)",
    upvotes: 42,
    commitments: 18,
    status: "Active Squad",
    collaborators: ["Pamela D.", "Mark G.", "Chidi O.", "Yusuf K."],
    skillsNeeded: ["IoT Hardware", "Solar Power Engineer", "Mobile App Dev", "Agro Logistics"],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    comments: [
      { id: "c1", author: "Mark G.", text: "I have experience with ESP32 sensors and temperature logging. Happy to lead hardware build in Rayfield!", date: "2 days ago" },
      { id: "c2", author: "Chidi O.", text: "We can link this to our logistics web platform for Plateau farm off-takers in Abuja and Lagos.", date: "1 day ago" }
    ]
  },
  {
    id: "prob-2",
    title: "Uninterrupted Mesh Internet & Power Hub for Tech Nodes across Anglo Jos & Bukuru",
    description: "Frequent power cuts and fiber outages disrupt remote engineering teams in Jos. Need a co-funded solar micro-grid + Starlink failover mesh shared among tech hubs and startups.",
    category: "Infrastructure",
    submittedBy: "Gyang K. (Rayfield)",
    upvotes: 35,
    commitments: 14,
    status: "Ideation",
    collaborators: ["Gyang K.", "Esther M.", "Suleiman B."],
    skillsNeeded: ["Network Engineering", "Solar System Integrator", "Community Organizing"],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    comments: [
      { id: "c3", author: "Esther M.", text: "We can set up a shared node at our hub in Anglo Jos as a pilot test site.", date: "Yesterday" }
    ]
  },
  {
    id: "prob-3",
    title: "Global Export & Payment Gateway for Jos Artisanal Mining & Gemstone Crafters",
    description: "Plateau gemstone miners & lapidary artisans lack direct international escrow, verified authenticity passports, and cross-border payment integration for high-value export markets.",
    category: "Commerce & Export",
    submittedBy: "Bilikisu A. (Jos North)",
    upvotes: 29,
    commitments: 11,
    status: "Squad Forming",
    collaborators: ["Bilikisu A.", "David T."],
    skillsNeeded: ["Fintech / Stripe API", "Product Design", "Compliance / Export Law"],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    comments: []
  },
  {
    id: "prob-4",
    title: "Jos Tech Talent Pipeline: Industry-Gated Apprenticeships for Unijos / PLASU Graduates",
    description: "Computer science grads from University of Jos and Plateau State University struggle with practical production code. Need a 12-week open-source project incubator matched with local startup mentors.",
    category: "Tech Talent & Education",
    submittedBy: "Engr. Victor (Unijos)",
    upvotes: 51,
    commitments: 25,
    status: "Prototype Built",
    collaborators: ["Engr. Victor", "Ruth E.", "Solomon P.", "Zainab H."],
    skillsNeeded: ["Senior Mentors", "Curriculum Leads", "DevOps Engineers"],
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    comments: [
      { id: "c4", author: "Ruth E.", text: "First cohort of 15 apprentices starting next month at nHub space!", date: "3 days ago" }
    ]
  }
];

// Initial Attendees / Checked-in Founders
const defaultAttendees = [
  {
    id: "att-1",
    name: "Pamela Dung",
    title: "Founder @ AgriPlateau ColdHubs",
    tags: ["Agro-Tech & Cold Chain", "Hardware & Solar", "Founder / CEO"],
    bio: "Building IoT solar cold-storage containers for Irish potato farmers in Bokkos and Mangu.",
    giveAsk: "Give: IoT firmware / ESP32 architecture help. Ask: Introductions to off-takers and farm cooperatives.",
    location: "Jos South",
    avatarColor: "#0D4734",
    checkedInAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: "att-2",
    name: "Gyang Kim",
    title: "Lead Systems Engineer @ PeakMesh",
    tags: ["Infrastructure", "AI & Software", "DevOps / Cloud"],
    bio: "Setting up failover wireless mesh grids and solar battery backups for tech workspaces in Jos.",
    giveAsk: "Give: Network routing & cloud server hosting tips. Ask: Landlord permission for rooftop antennas in Rayfield.",
    location: "Rayfield, Jos",
    avatarColor: "#166E52",
    checkedInAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: "att-3",
    name: "Bilikisu Ahmed",
    title: "Co-Founder @ JosGems Marketplace",
    tags: ["Commerce & Export", "Fintech / Payments", "Product & Design"],
    bio: "Empowering Plateau artisanal mineral lapidaries with digital escrow verification and global DHL shipping.",
    giveAsk: "Give: Export customs compliance & UI/UX feedback. Ask: React Native developer for mobile checkout.",
    location: "Jos North",
    avatarColor: "#E5A93C",
    checkedInAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  },
  {
    id: "att-4",
    name: "Solomon Pwajok",
    title: "Full-Stack Dev & Unijos CS Mentor",
    tags: ["Tech Talent & Education", "AI & Software", "Student / Builder"],
    bio: "Passionate about open-source developer tooling and training the next generation of Plateau tech builders.",
    giveAsk: "Give: Fullstack code reviews (React/Node/Python). Ask: Startup internships for top 10 graduating students.",
    location: "University of Jos",
    avatarColor: "#BF7E1D",
    checkedInAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  }
];

// Initial Categories Store
const defaultCategoriesStore: Record<string, { upvotes: number; description: string; iconName: string; baseUpvotes?: number }> = {
  "Infrastructure": {
    upvotes: 38,
    description: "Roads, transit hubs, internet mesh grids & physical facility access across Jos and Plateau State.",
    iconName: "Building2"
  },
  "Safety": {
    upvotes: 45,
    description: "Community security networks, rapid emergency alerts, streetlight power & verified identity systems.",
    iconName: "ShieldAlert"
  },
  "Services": {
    upvotes: 29,
    description: "Public health access, waste management, municipal tools & digital civic administration for citizens.",
    iconName: "Layers"
  },
  "Agro-Tech & Cold Chain": {
    upvotes: 52,
    description: "Solar cold storage, farmer-to-market logistics, soil telemetry & crop preservation in Bokkos/Vom.",
    iconName: "Sprout"
  },
  "Tech Talent & Education": {
    upvotes: 41,
    description: "University incubators (Unijos/PLASU), developer bootcamps & industry mentorship pipelines.",
    iconName: "GraduationCap"
  },
  "Commerce & Export": {
    upvotes: 33,
    description: "Gemstone lapidary exports, artisan escrow, cross-border payment gateways & local trade platforms.",
    iconName: "ShoppingBag"
  },
  "Energy & Power": {
    upvotes: 36,
    description: "Off-grid renewable power systems, solar micro-grids & battery swap infrastructure for businesses.",
    iconName: "Zap"
  }
};

// Initial 12 Founding Trustee Candidates (CAMA 2020 Matrix)
const defaultTrusteeCandidates = [
  {
    id: "cand-1",
    seatNumber: 1,
    name: "Nanle Jerry",
    titleOrOrg: "Tin City Founders Convener & AgriGrid CEO",
    bio: "Pioneering agricultural tech and developer communities in Jos since 2019. Committed to full CAC legal incorporation.",
    phoneOrContact: "+234 803 123 4567",
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 38,
    nominatedBy: "Founding Assembly",
    createdAt: Date.now() - 86400000 * 3,
    notes: "Primary convener signatory for CAC Part F association registration."
  },
  {
    id: "cand-2",
    seatNumber: 2,
    name: "Bitrus Longbap",
    titleOrOrg: "Ecosystem Lead @ Plateau Tech Grid",
    bio: "Spearheaded outreach across 6 Plateau universities and connected over 140 engineers to startups.",
    phoneOrContact: "+234 812 987 6543",
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 27,
    nominatedBy: "Jos Founders Collective",
    createdAt: Date.now() - 86400000 * 2,
    notes: "Handles partnerships with northern developer networks."
  },
  {
    id: "cand-3",
    seatNumber: 3,
    name: "Keziah Mallo",
    titleOrOrg: "Founder, J-Town Creative Studio & Tech Narratives",
    bio: "Brand strategist & documentary producer telling stories of Plateau entrepreneurs and tech innovators.",
    phoneOrContact: "+234 809 333 8899",
    scoreR: 5,
    scoreN: 4,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 31,
    nominatedBy: "Media & Growth Track",
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: "cand-4",
    seatNumber: 4,
    name: "David Choji",
    titleOrOrg: "VP Operations, Highland Hub & Jos DevCon",
    bio: "Manages multi-track programming, hackathons, and governance schedules for tech gatherings.",
    phoneOrContact: "+234 805 777 1122",
    scoreR: 5,
    scoreN: 4,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 24,
    nominatedBy: "Founding Ops Squad",
    createdAt: Date.now() - 86400000
  },
  {
    id: "cand-5",
    seatNumber: 5,
    name: "Chief Dachung Gyang",
    titleOrOrg: "Chairman, Plateau Enterprise Holdings & Jos Commercial Chamber",
    bio: "30+ years leading manufacturing and agro-processing businesses in Plateau State.",
    phoneOrContact: "+234 802 444 5555",
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 42,
    nominatedBy: "Chamber of Commerce Alliance",
    createdAt: Date.now() - 86400000 * 4,
    notes: "Key board sponsor for regional industrial alignment."
  },
  {
    id: "cand-6",
    seatNumber: 6,
    name: "Samuel Adebayo",
    titleOrOrg: "Founders Coach & Angel Mentor",
    bio: "Venture mentor advising top African early-stage startups and structuring founder governance pacts.",
    phoneOrContact: "+234 806 888 9900",
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 46,
    nominatedBy: "Founders Assembly",
    createdAt: Date.now() - 86400000 * 5,
    notes: "Exemplary R=5, T=5 mentor identified on official template."
  },
  {
    id: "cand-7",
    seatNumber: 7,
    name: "Prof. Victor Datong",
    titleOrOrg: "Dean of Computing & Applied AI, University of Jos",
    bio: "Spearheading campus-to-industry tech pipelines and federal research grant collaborations.",
    phoneOrContact: "+234 803 999 1100",
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: false,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 29,
    nominatedBy: "Academic Working Group",
    createdAt: Date.now() - 86400000
  },
  {
    id: "cand-8",
    seatNumber: 8,
    name: "Elder Grace Pam",
    titleOrOrg: "Plateau Civic Trust & Peace Building Council Trustee",
    bio: "Highly respected mediator and community elder with 25 years of civic leadership across Plateau communities.",
    phoneOrContact: "+234 802 111 2233",
    scoreR: 5,
    scoreN: 4,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 35,
    nominatedBy: "Civic Council",
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: "cand-9",
    seatNumber: 9,
    name: "Malam Ibrahim Danladi",
    titleOrOrg: "President, Terminus Traders & Automotive Spares Union",
    bio: "Bridge between high-tech platforms and 10,000+ daily physical merchants in Jos main market.",
    phoneOrContact: "+234 808 222 3344",
    scoreR: 4,
    scoreN: 5,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 28,
    nominatedBy: "Real-Economy SME Wing",
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: "cand-10",
    seatNumber: 10,
    name: "Pamela Dung",
    titleOrOrg: "Founder & CEO, AgroCold Jos",
    bio: "Award-winning agri-logistics founder building solar cold-chain storage for Plateau farmers.",
    phoneOrContact: "+234 814 555 6677",
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 39,
    nominatedBy: "Women Techmakers Jos",
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: "cand-11",
    seatNumber: 11,
    name: "Emmanuel Pwajok",
    titleOrOrg: "Lead Builder @ Jos Student Devs (Finalist, NITDA Hackathon)",
    bio: "Final year computer engineering student at PLASU who created offline mesh networking for rural students.",
    phoneOrContact: "+234 816 777 8899",
    scoreR: 4,
    scoreN: 4,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 33,
    nominatedBy: "Campus Builders Forum",
    createdAt: Date.now() - 86400000
  },
  {
    id: "cand-12",
    seatNumber: 12,
    name: "Luka Goyol",
    titleOrOrg: "Director, Central Plateau Innovation Hub (Pankshin)",
    bio: "Connects central and southern Plateau agricultural hubs into the Jos tech ecosystem.",
    phoneOrContact: "+234 807 333 4455",
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 36,
    nominatedBy: "Regional Unity Coalition",
    createdAt: Date.now() - 86400000 * 2
  }
];

// Room State In-Memory Store
type ServerProblem = (typeof defaultProblems)[number] & { baseUpvotes?: number; baseCommitments?: number; squadMembers?: SquadMember[] };
type ServerTrustee = (typeof defaultTrusteeCandidates)[number] & { baseVotes?: number };

// The room starts EMPTY and fills as real people scan in. The default* arrays
// above are demo content kept for their shape (they define the types below) and
// for replay: start with SEED_ROOM=1 to load them back.
//   SEED_ROOM=1 npm run dev
const SEED_ROOM = process.env.SEED_ROOM === "1";

// Sectors are the fixed taxonomy, so they stay — but with no phantom votes on them.
const emptyCategoriesStore = Object.fromEntries(
  Object.entries(defaultCategoriesStore).map(([name, cat]) => [
    name,
    { ...cat, upvotes: 0, baseUpvotes: 0 }
  ])
) as typeof defaultCategoriesStore;

let problems: ServerProblem[] = SEED_ROOM ? [...defaultProblems] : [];
type ServerAttendee = (typeof defaultAttendees)[number] & { organization?: string; linkedin?: string; link?: string; stage?: string; listed?: boolean };
let attendees: ServerAttendee[] = SEED_ROOM ? [...defaultAttendees] : [];
let memberContacts: Record<string, { phone: string; voterId: string }> = {};
interface SectorSuggestion { id: string; name: string; description: string; memberId: string; submittedBy: string; createdAt: number; status: 'pending' | 'approved' | 'mapped' | 'dismissed'; resolvedSector?: string; }
let sectorSuggestions: SectorSuggestion[] = [];
let categoriesStore = SEED_ROOM ? { ...defaultCategoriesStore } : emptyCategoriesStore;
let trusteeCandidates: ServerTrustee[] = SEED_ROOM ? [...defaultTrusteeCandidates] : [];

// -------------------------------------------------------------
// Public view of a trustee record
// -------------------------------------------------------------
// phoneOrContact is typed into the nomination form by whoever is at the
// microphone — it is a real person's phone number, and the room runs on a
// public URL. It stays in memory and in .data/room_state.json (the host needs
// it to actually call the nominee), but it is stripped out of everything an
// unauthenticated client can reach: /api/live/sync, /api/trustees, the SSE
// INIT_SYNC + STATE_UPDATE packets, and the open nominate/endorse responses.
// The host reads contacts through the host-gated GET /api/admin/trustees and
// the GET /api/admin/state export, both behind requireHost.
function publicTrustee(candidate: ServerTrustee) {
  const { phoneOrContact, ...rest } = candidate as ServerTrustee & { phoneOrContact?: string };
  return rest;
}

function publicTrustees() {
  return trusteeCandidates.map(publicTrustee);
}

// -------------------------------------------------------------
// Vote Integrity: one vote per voter (tcf_vid) per target
// -------------------------------------------------------------
type VoteKind = "problem" | "squad" | "category" | "trustee";

interface VoteRecord {
  id: string;
  voterId: string;
  kind: VoteKind;
  targetId: string;
  voterName?: string;
  superpower?: string;
  ts: number;
}

let voteRecords: VoteRecord[] = [];
const castVotes = new Set<string>(); // `${kind}:${targetId}:${voterId}`

const voteKey = (kind: VoteKind, targetId: string, voterId: string) => `${kind}:${targetId}:${voterId}`;

function rebuildCastVotes() {
  castVotes.clear();
  for (const r of voteRecords) castVotes.add(voteKey(r.kind, r.targetId, r.voterId));
}

// Returns the new record, or null if this voter already voted on this target.
// A member's own link — Instagram, a website, anything. Kept separate from the
// linkedin field, which is narrow because it renders as a LinkedIn badge. http
// is allowed: plenty of small Jos businesses are not on TLS yet. Anything that
// is not http(s) — javascript:, data: — fails the protocol check. Shared by the
// check-in handler and the bulk import so a link cannot enter unvalidated
// through the side door.
function normalizeLink(value: string): string {
  const input = value.trim();
  if (!input) return "";
  if (input.length > 300) throw new Error("Keep your link within 300 characters.");
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password || url.port) throw new Error();
    url.search = ""; url.hash = "";
    return url.toString();
  } catch {
    throw new Error("Use a full link such as https://yoursite.com or instagram.com/yourhandle.");
  }
}

function recordVote(kind: VoteKind, targetId: string, voterId: string, voterName?: string): VoteRecord | null {
  const key = voteKey(kind, targetId, voterId);
  if (castVotes.has(key)) return null;
  const record: VoteRecord = {
    id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    voterId,
    kind,
    targetId,
    voterName: voterName ? String(voterName).trim().slice(0, 80) : undefined,
    ts: Date.now()
  };
  voteRecords.push(record);
  castVotes.add(key);
  return record;
}

// Returns true if a vote was removed.
function retractVote(kind: VoteKind, targetId: string, voterId: string): boolean {
  const key = voteKey(kind, targetId, voterId);
  if (!castVotes.has(key)) return false;
  voteRecords = voteRecords.filter(r => !(r.kind === kind && r.targetId === targetId && r.voterId === voterId));
  castVotes.delete(key);
  return true;
}

function dropVotesForTarget(kind: VoteKind, targetId: string) {
  voteRecords = voteRecords.filter(r => !(r.kind === kind && r.targetId === targetId));
  rebuildCastVotes();
}

// Displayed counts = seeded base count + live vote records (never a blind increment).
function recomputeCounts() {
  const tally = new Map<string, number>();
  for (const r of voteRecords) {
    const k = `${r.kind}:${r.targetId}`;
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  for (const p of problems) {
    p.squadMembers = voteRecords.filter(r => r.kind === 'squad' && r.targetId === p.id).map(r => ({ id: r.id, name: r.voterName || 'Member', ...(r.superpower ? { superpower: r.superpower } : {}) }));
    p.upvotes = (p.baseUpvotes ?? 0) + (tally.get(`problem:${p.id}`) || 0);
    p.commitments = (p.baseCommitments ?? 0) + (tally.get(`squad:${p.id}`) || 0);
  }
  for (const [name, cat] of Object.entries(categoriesStore)) {
    cat.upvotes = (cat.baseUpvotes ?? 0) + (tally.get(`category:${name}`) || 0);
  }
  for (const c of trusteeCandidates) {
    c.votes = (c.baseVotes ?? 0) + (tally.get(`trustee:${c.id}`) || 0);
  }
}

function applySquadStatus(problem: ServerProblem) {
  if (problem.commitments >= 3 && problem.status === "Ideation") {
    problem.status = "Squad Forming";
  }
  if (problem.commitments >= 6 && problem.status === "Squad Forming") {
    problem.status = "Active Squad";
  }
}

// The ladder above only ever climbs, which is right on the way in: a squad that
// formed stays formed while people are still joining. Leaving is the one path
// allowed to walk it back down, using the SAME thresholds (3 / 6), so a problem
// that drops to 2 commitments stops advertising itself as "Squad Forming".
// "Prototype Built" is a real milestone, not a vote count, so it never moves.
function relaxSquadStatus(problem: ServerProblem) {
  if (problem.status === "Prototype Built") return;
  if (problem.status === "Active Squad" && problem.commitments < 6) {
    problem.status = problem.commitments >= 3 ? "Squad Forming" : "Ideation";
  } else if (problem.status === "Squad Forming" && problem.commitments < 3) {
    problem.status = "Ideation";
  }
}

function myVotesFor(voterId: string) {
  const mine = { voterId, problems: [] as string[], squads: [] as string[], categories: [] as string[], trustees: [] as string[] };
  for (const r of voteRecords) {
    if (r.voterId !== voterId) continue;
    if (r.kind === "problem") mine.problems.push(r.targetId);
    else if (r.kind === "squad") mine.squads.push(r.targetId);
    else if (r.kind === "category") mine.categories.push(r.targetId);
    else if (r.kind === "trustee") mine.trustees.push(r.targetId);
  }
  return mine;
}

// Seeded counts become the base the first time the server runs with vote records.
function migrateBaseCounts() {
  for (const p of problems) {
    if (p.baseUpvotes === undefined) p.baseUpvotes = p.upvotes || 0;
    if (p.baseCommitments === undefined) p.baseCommitments = p.commitments || 0;
  }
  for (const cat of Object.values(categoriesStore)) {
    if (cat.baseUpvotes === undefined) cat.baseUpvotes = cat.upvotes || 0;
  }
  for (const c of trusteeCandidates) {
    if (c.baseVotes === undefined) c.baseVotes = c.votes || 0;
  }
}
let activityLogs: Array<{
  id: string;
  type: string;
  title: string;
  message: string;
  author: string;
  sector?: string;
  timestamp: number;
}> = [
  {
    id: "act-1",
    type: "squad_joined",
    title: "Squad Commitment",
    message: "Pamela D. joined Cold-Chain & Solar Preservation squad.",
    author: "Pamela D.",
    sector: "Agro-Tech & Cold Chain",
    timestamp: Date.now() - 1000 * 60 * 15
  },
  {
    id: "act-2",
    type: "trustee_vote",
    title: "Trustee Endorsement",
    message: "Samuel Adebayo received +1 Trustee Vote for Seat 6.",
    author: "Room Voter",
    timestamp: Date.now() - 1000 * 60 * 10
  }
];

// Room Session Phase / Host Conductor State
type RoomPhase = "welcome" | "problem_pitch" | "voting" | "trustee_election" | "squad_commit" | "free_roam";

// -------------------------------------------------------------
// Voting Rounds — host-driven ballots layered on top of phases
// -------------------------------------------------------------
type RoundKind = "problem" | "category" | "trustee" | "member";
type RoundStatus = "open" | "revealed";

interface RoundOption {
  squadMembers?: SquadMember[];
  id: string;
  label: string;
  sublabel?: string;
}

interface RoundResultEntry {
  optionId: string;
  label: string;
  sublabel?: string;
  votes: number;
  share: number;
}

interface VotingRound {
  id: string;
  kind: RoundKind;
  title: string;
  prompt?: string;
  status: RoundStatus;
  options: RoundOption[];
  maxSelections: number;
  ballotsCast: number;
  openedAt: number;
  allowSquadSignup?: boolean;
  durationHours?: number;
  endsAt?: string;
  closedAt?: number;
  results?: RoundResultEntry[];
}

// One ballot per voter per round. Kept separate from the ambient upvote records
// so opening/closing rounds never disturbs the running problem/trustee tallies.
interface RoundBallot {
  roundId: string;
  voterId: string;
  voterName?: string;
  selections: string[];
  ts: number;
}

let activeRound: VotingRound | null = null;
let roundBallots: RoundBallot[] = [];
// Completed rounds, newest first. Retain summaries so shared round links stay valid.
let roundHistory: VotingRound[] = [];

// The weekly spotlight. One member at a time, decided either by the host picking
// or by a member ballot closing; both produce the same record.
let activeSpotlight: Spotlight | null = null;
let spotlightHistory: Spotlight[] = [];
let revealTimer: NodeJS.Timeout | null = null;

interface RoomSessionState {
  activePhase: RoomPhase;
  phaseTitle: string;
  announcement: {
    id: string;
    message: string;
    author: string;
    timestamp: number;
  } | null;
  pinnedProblemId?: string;
  allowAudienceNavigation: boolean;
  // Whether a mixer is actually running right now. It cannot be inferred:
  // activePhase defaults to "voting" and is always set, so there is no "off"
  // state to read. The community screen uses this to decide whether to offer
  // mixer mode at all — without it, every public visitor was shown a door into
  // a host-driven screen with nothing behind it.
  mixerLive: boolean;
  activeRound?: VotingRound | null;
  updatedAt: number;
}

let roomSessionState: RoomSessionState = {
  activePhase: "voting",
  phaseTitle: "Live Plateau Problem Voting & Squad Formation",
  announcement: null,
  pinnedProblemId: undefined,
  allowAudienceNavigation: true,
  mixerLive: false,
  activeRound: null,
  updatedAt: Date.now()
};

// Try reading initial state from file if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.problems && Array.isArray(parsed.problems)) problems = parsed.problems;
    if (parsed.memberContacts && typeof parsed.memberContacts === "object") memberContacts = parsed.memberContacts;
    if (parsed.attendees && Array.isArray(parsed.attendees)) attendees = parsed.attendees;
    if (Array.isArray(parsed.sectorSuggestions)) sectorSuggestions = parsed.sectorSuggestions;
    if (parsed.categoriesStore && typeof parsed.categoriesStore === "object") categoriesStore = parsed.categoriesStore;
    if (parsed.trusteeCandidates && Array.isArray(parsed.trusteeCandidates)) trusteeCandidates = parsed.trusteeCandidates;
    if (parsed.activityLogs && Array.isArray(parsed.activityLogs)) activityLogs = parsed.activityLogs;
    if (parsed.voteRecords && Array.isArray(parsed.voteRecords)) voteRecords = parsed.voteRecords;
    if (parsed.roomSessionState && typeof parsed.roomSessionState === "object") {
      roomSessionState = { ...roomSessionState, ...parsed.roomSessionState };
    }
    if (parsed.roundBallots && Array.isArray(parsed.roundBallots)) roundBallots = parsed.roundBallots;
    if (parsed.roundHistory && Array.isArray(parsed.roundHistory)) roundHistory = parsed.roundHistory;
    if (parsed.activeSpotlight && typeof parsed.activeSpotlight === "object") activeSpotlight = parsed.activeSpotlight;
    if (parsed.spotlightHistory && Array.isArray(parsed.spotlightHistory)) spotlightHistory = parsed.spotlightHistory;
    if (parsed.activeRound && typeof parsed.activeRound === "object") activeRound = parsed.activeRound;

    // A round that was mid-reveal when the process died must not come back as a
    // reveal. The reveal timer only ever lived in memory, so nothing would ever
    // clear it again and every phone in the room would be pinned to a stale
    // results screen until the host tapped "Back to Room" by hand. The reveal
    // window has almost certainly elapsed during the restart anyway, so the
    // round goes straight into history. Archived inline rather than through
    // archiveActiveRound() because the SSE client set is not constructed yet at
    // this point in module evaluation (and there is nobody connected to tell).
    if (activeRound && activeRound.status === "revealed" && !activeRound.endsAt) {
      const staleId = activeRound.id;
      roundHistory.unshift(activeRound);
      roundBallots = roundBallots.filter(b => b.roundId !== staleId);
      activeRound = null;
      console.log(`Archived a round that was mid-reveal when the server restarted (${staleId}).`);
      // Write it back now so the on-disk copy matches memory even if nothing
      // else mutates the room before the next restart. Safe here: persistState
      // is a hoisted declaration and only touches values already initialised.
      persistState();
    }

    // A round that survived a restart is re-attached to the session state below.
    roomSessionState.activeRound = activeRound;
    console.log(`Loaded room state from disk cache (${voteRecords.length} vote records).`);
  }
} catch (e) {
  console.warn("Could not read cached room state, using defaults:", e);
}

migrateBaseCounts();
rebuildCastVotes();
recomputeCounts();

// The one definition of "the room, as a file". persistState() writes exactly
// this, and GET /api/admin/state hands back exactly this, so a downloaded
// backup is drop-in compatible with .data/room_state.json.
function buildStateSnapshot() {
  return {
    problems,
    attendees,
    categoriesStore,
    sectorSuggestions,
    trusteeCandidates,
    activityLogs,
    voteRecords,
    roomSessionState,
    activeRound,
    roundBallots,
    roundHistory,
    activeSpotlight,
    spotlightHistory,
    memberContacts,
    lastSaved: Date.now()
  };
}

// Helper to save state to disk
function persistState() {
  try {
    const state = buildStateSnapshot();
    // Atomic write: a crash mid-write can never leave a truncated state file behind.
    const tmpFile = `${STATE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmpFile, STATE_FILE);
  } catch (e) {
    // Non-fatal disk write error
  }
}

// -------------------------------------------------------------
// Server-Sent Events (SSE) Broadcast Engine
// -------------------------------------------------------------
const sseClients = new Set<Response>();

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function broadcastStateUpdate(actionType: string, summary: string, author = "Room Innovator", sector?: string) {
  // Push to activity logs
  const logItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: actionType,
    title: actionType.toUpperCase().replace(/_/g, " "),
    message: summary,
    author,
    sector,
    timestamp: Date.now()
  };
  activityLogs.unshift(logItem);
  if (activityLogs.length > 50) activityLogs.pop();

  persistState();

  // Send full state snapshot packet
  broadcastSSE("STATE_UPDATE", {
    actionType,
    summary,
    problems,
    attendees,
    categories: Object.entries(categoriesStore).map(([name, data]) => ({
      name,
      upvotes: data.upvotes,
      description: data.description,
      iconName: data.iconName,
      problemCount: problems.filter(p => p.category === name).length
    })),
    trusteeCandidates: publicTrustees(),
    activityLogs,
    sessionState: roomSessionState,
    telemetry: {
      attendeesCount: attendees.length,
      problemsCount: problems.length,
      totalVotes: problems.reduce((acc, p) => acc + (p.upvotes || 0), 0),
      totalSquadMembers: problems.reduce((acc, p) => acc + (p.commitments || 0), 0),
      totalTrusteeVotes: trusteeCandidates.reduce((acc, c) => acc + (c.votes || 0), 0),
      activeSSEConnections: sseClients.size
    },
    serverTime: Date.now()
  });
}

// SSE Connection Endpoint
// Every later API request checks the deadline, including votes and new SSE connections.
// This prevents late ballots even between background ticks.
app.use('/api', (_req, _res, next) => { expireRoundIfNeeded(); expireSpotlightIfNeeded(); next(); });

app.get("/api/live/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  res.write(`retry: 3000\n\n`);

  // Initial Sync Event sent immediately upon connection
  const initialPayload = {
    problems,
    attendees,
    categories: Object.entries(categoriesStore).map(([name, data]) => ({
      name,
      upvotes: data.upvotes,
      description: data.description,
      iconName: data.iconName,
      problemCount: problems.filter(p => p.category === name).length
    })),
    trusteeCandidates: publicTrustees(),
    activityLogs,
    sessionState: roomSessionState,
    telemetry: {
      attendeesCount: attendees.length,
      problemsCount: problems.length,
      totalVotes: problems.reduce((acc, p) => acc + (p.upvotes || 0), 0),
      totalSquadMembers: problems.reduce((acc, p) => acc + (p.commitments || 0), 0),
      totalTrusteeVotes: trusteeCandidates.reduce((acc, c) => acc + (c.votes || 0), 0),
      activeSSEConnections: sseClients.size
    },
    serverTime: Date.now()
  };

  res.write(`event: INIT_SYNC\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Periodic SSE Keep-Alive Ping (Every 15s)
setInterval(() => {
  const pingPayload = `event: PING\ndata: ${JSON.stringify({ timestamp: Date.now(), connectedClients: sseClients.size })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(pingPayload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 15000);

// -------------------------------------------------------------
// REST Endpoints
// -------------------------------------------------------------

// REST Fallback for Room Sync Snapshot
app.get("/api/live/sync", (_req, res) => {
  res.json({
    success: true,
    problems,
    attendees,
    categories: Object.entries(categoriesStore).map(([name, data]) => ({
      name,
      upvotes: data.upvotes,
      description: data.description,
      iconName: data.iconName,
      problemCount: problems.filter(p => p.category === name).length
    })),
    trusteeCandidates: publicTrustees(),
    activityLogs,
    sessionState: roomSessionState,
    telemetry: {
      attendeesCount: attendees.length,
      problemsCount: problems.length,
      totalVotes: problems.reduce((acc, p) => acc + (p.upvotes || 0), 0),
      totalSquadMembers: problems.reduce((acc, p) => acc + (p.commitments || 0), 0),
      totalTrusteeVotes: trusteeCandidates.reduce((acc, c) => acc + (c.votes || 0), 0),
      activeSSEConnections: sseClients.size
    },
    serverTime: Date.now()
  });
});

// ----------------- SESSION CONDUCTOR ENDPOINTS -----------------

// Get current session stage
app.get("/api/session/state", (_req, res) => {
  res.json({ success: true, sessionState: roomSessionState });
});

// Host Conductor updates room stage (instantly directs all audience screens)
app.post("/api/session/state", requireHost, (req, res) => {
  const { activePhase, phaseTitle, allowAudienceNavigation, pinnedProblemId, mixerLive } = req.body || {};

  if (activePhase) {
    roomSessionState.activePhase = activePhase;
  }
  if (phaseTitle !== undefined) {
    roomSessionState.phaseTitle = phaseTitle;
  }
  if (allowAudienceNavigation !== undefined) {
    roomSessionState.allowAudienceNavigation = !!allowAudienceNavigation;
  }
  if (pinnedProblemId !== undefined) {
    roomSessionState.pinnedProblemId = pinnedProblemId;
  }
  if (mixerLive !== undefined) {
    roomSessionState.mixerLive = !!mixerLive;
  }
  roomSessionState.updatedAt = Date.now();

  persistState();

  const phaseNames: Record<string, string> = {
    welcome: "1. Welcome & Check-In",
    problem_pitch: "2. Problem Pitch Floor",
    voting: "3. Live Problem Voting",
    trustee_election: "4. Trustee Election Matrix",
    squad_commit: "5. Action Squad Lock-In",
    free_roam: "6. Free Roam Mode"
  };
  const phaseLabel = phaseNames[roomSessionState.activePhase] || roomSessionState.activePhase;

  broadcastStateUpdate("session_phase_changed", `Stage Conductor moved room to: ${phaseLabel}`, "Host Conductor");
  broadcastSSE("SESSION_PHASE_CHANGED", { sessionState: roomSessionState });

  res.json({ success: true, sessionState: roomSessionState });
});

// Host Conductor broadcasts an instant alert banner to audience screens
app.post("/api/session/broadcast", requireHost, (req, res) => {
  const { message, author, durationMs } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ success: false, error: "Broadcast message is required" });
  }

  const announcement = {
    id: `ann-${Date.now()}`,
    message: message.trim().slice(0, 200),
    author: author ? String(author).trim().slice(0, 60) : "Stage Host",
    timestamp: Date.now()
  };

  roomSessionState.announcement = announcement;
  roomSessionState.updatedAt = Date.now();
  persistState();

  broadcastSSE("ANNOUNCEMENT_BROADCAST", { announcement });
  broadcastStateUpdate("host_broadcast", `Host Announcement: "${announcement.message}"`, announcement.author);

  // Auto-clear announcement after duration (default 20 seconds)
  const timeoutMs = typeof durationMs === "number" && durationMs > 0 ? durationMs : 20000;
  setTimeout(() => {
    if (roomSessionState.announcement?.id === announcement.id) {
      roomSessionState.announcement = null;
      persistState();
      broadcastSSE("ANNOUNCEMENT_CLEARED", { id: announcement.id });
    }
  }, timeoutMs);

  res.json({ success: true, announcement, sessionState: roomSessionState });
});

// Dismiss announcement
app.delete("/api/session/broadcast", requireHost, (_req, res) => {
  roomSessionState.announcement = null;
  roomSessionState.updatedAt = Date.now();
  persistState();
  broadcastSSE("ANNOUNCEMENT_CLEARED", {});
  res.json({ success: true, sessionState: roomSessionState });
});

// Audience live reaction (🔥, 💡, 👏, 🚀, ⭐) during pitches and live talks
app.post("/api/session/react", (req, res) => {
  const { emoji, author } = req.body || {};
  const allowed = ["🔥", "💡", "👏", "🚀", "⭐", "❤️", "⚡"];
  const sanitizedEmoji = allowed.includes(emoji) ? emoji : "🔥";

  const reaction = {
    id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    emoji: sanitizedEmoji,
    author: author ? String(author).trim().slice(0, 40) : "Audience",
    timestamp: Date.now()
  };

  broadcastSSE("AUDIENCE_REACTION", reaction);
  res.json({ success: true, reaction });
});

// ----------------- HOST FAILSAFE: STATE EXPORT -----------------

// The whole room as a file, for a host who needs to move it. On a platform with
// no persistent disk (Render free tier) a restart wipes the room; this is the
// only way to carry the evening onto the backup laptop. The response body is
// byte-for-byte what persistState() writes, so the download can be dropped in
// as .data/room_state.json and the laptop picks up exactly where the cloud
// stopped. Host-gated: the file carries every attendee record in the room.
app.get("/api/admin/state", requireHost, (_req, res) => {
  const snapshot = buildStateSnapshot();
  // 2026-09-04T15-30-00 — colons are illegal in filenames on Windows.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="room_state-${stamp}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(snapshot, null, 2));
});

// The trustee list WITH phoneOrContact, for the console only. The public
// payloads strip contacts (see publicTrustee), so this is how the host reads
// back a number they need to ring after the room empties.
// ----------------- BULK MEMBER IMPORT -----------------

// Loading a directory export (a sign-up form's responses, say) as members.
//
// This cannot go through POST /api/attendees. That route stamps the CALLER's
// voter id onto every record it touches, so one import session would leave all
// imported members sharing a single identity: /api/profile/recover hands each
// of them the same cookie, and recordVote() dedupes on
// voteKey(kind, targetId, voterId) — meaning the first member to vote consumes
// the vote for everyone and the rest are silently dropped.
//
// So each row gets a FRESH voter id that no browser holds. Nobody can act as
// that member until they recover the profile with their own number, and the
// row is not claimable by a stranger the way an ownerless row is.
app.post("/api/admin/import-members", requireHost, (req, res) => {
  const rows = req.body?.members;
  if (!Array.isArray(rows)) return res.status(400).json({ error: "Send { members: [...] }." });
  if (rows.length > 500) return res.status(400).json({ error: "Import at most 500 members at a time." });

  const results: { row: number; name: string; action: string; reason?: string }[] = [];
  let created = 0, merged = 0, skipped = 0;

  rows.forEach((row: any, index: number) => {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (!name) { skipped++; results.push({ row: index, name: "", action: "skipped", reason: "no name" }); return; }

    let phone = "";
    if (row.whatsapp !== undefined && String(row.whatsapp).trim() !== "") {
      try { phone = normalizePhone(String(row.whatsapp)); }
      catch (error) { skipped++; results.push({ row: index, name, action: "skipped", reason: (error as Error).message }); return; }
    }

    // A number already in the room is the same person submitting twice. Merge
    // onto the existing record rather than creating a second one, and keep the
    // voter id that record already has so any votes cast under it survive.
    let link = "";
    if (row.link !== undefined && String(row.link).trim() !== "") {
      try { link = normalizeLink(String(row.link)); }
      catch (error) { skipped++; results.push({ row: index, name, action: "skipped", reason: (error as Error).message }); return; }
    }

    const existingId = phone ? Object.keys(memberContacts).find(id => memberContacts[id].phone === phone) : undefined;
    const attendeeId = existingId || `att-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const existingIndex = attendees.findIndex(a => a.id === attendeeId);
    const existing = existingIndex >= 0 ? attendees[existingIndex] : undefined;
    const text = (value: unknown, previous: string | undefined) =>
      typeof value === "string" && value.trim() ? value.trim() : (previous ?? "");

    const record = {
      id: attendeeId,
      name,
      title: text(row.title, existing?.title),
      organization: text(row.organization, existing?.organization),
      linkedin: existing?.linkedin || "",
      link: link || existing?.link || "",
      stage: text(row.stage, existing?.stage),
      listed: typeof row.listed === "boolean" ? row.listed : (existing?.listed ?? true),
      tags: Array.isArray(row.tags)
        ? row.tags.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0).map((t: string) => t.trim())
        : (existing?.tags ?? []),
      bio: text(row.bio, existing?.bio),
      giveAsk: text(row.giveAsk, existing?.giveAsk),
      location: text(row.location, existing?.location),
      avatarColor: existing?.avatarColor || "#0D4734",
      checkedInAt: typeof row.checkedInAt === "string" && !Number.isNaN(Date.parse(row.checkedInAt))
        ? new Date(row.checkedInAt).toISOString()
        : (existing?.checkedInAt || new Date().toISOString())
    };

    if (existingIndex >= 0) { attendees[existingIndex] = record; merged++; results.push({ row: index, name, action: "merged" }); }
    else { attendees.unshift(record); created++; results.push({ row: index, name, action: "created" }); }

    memberContacts[attendeeId] = {
      phone,
      voterId: memberContacts[attendeeId]?.voterId || crypto.randomUUID().replace(/-/g, "")
    };
  });

  persistState();
  broadcastStateUpdate("attendee_checkin", `${created} member${created === 1 ? "" : "s"} added to the directory`);
  res.json({ success: true, created, merged, skipped, total: attendees.length, results });
});

app.get("/api/admin/trustees", requireHost, (_req, res) => {
  res.json({ success: true, candidates: trusteeCandidates });
});

// ----------------- VOTING ROUND ENDPOINTS -----------------

const ROUND_KINDS: RoundKind[] = ["problem", "category", "trustee", "member"];
// Three minutes, not thirty seconds. On venue wifi a phone that locks or drops
// during the reveal needs a wide window to come back and still see the result
// on its own screen; the host can always cut it short with "Back to Room".
const DEFAULT_REVEAL_MS = 180000;

// Build the candidate pool for a ballot kind. optionIds narrows it; empty means "everything".
function buildRoundOptions(kind: RoundKind, optionIds?: string[]): RoundOption[] {
  const wanted = Array.isArray(optionIds) && optionIds.length ? new Set(optionIds.map(String)) : null;

  if (kind === "problem") {
    return problems
      .filter(p => !wanted || wanted.has(p.id))
      .map(p => ({ id: p.id, label: p.title, sublabel: p.category }));
  }
  if (kind === "category") {
    return Object.entries(categoriesStore)
      .filter(([name]) => !wanted || wanted.has(name))
      .map(([name, data]) => ({ id: name, label: name, sublabel: data.description }));
  }
  if (kind === "member") {
    // Community-only members stay eligible. What they declined was their details
    // leaving the platform; a spotlight inside it is the thing they signed up to.
    return attendees
      .filter(a => !wanted || wanted.has(a.id))
      .map(a => ({ id: a.id, label: a.name, sublabel: a.organization || a.title || a.stage || "" }));
  }
  return trusteeCandidates
    .filter(c => !wanted || wanted.has(c.id))
    .map(c => ({ id: c.id, label: c.name, sublabel: c.titleOrOrg }));
}

// Tally is derived from the ballots, never incremented in place.
function tallyRound(round: VotingRound): RoundResultEntry[] {
  const ballots = roundBallots.filter(b => b.roundId === round.id);
  const counts = new Map<string, number>();
  for (const b of ballots) {
    for (const optionId of b.selections) {
      counts.set(optionId, (counts.get(optionId) || 0) + 1);
    }
  }
  const denominator = ballots.length || 1;
  return round.options
    .map(o => ({
      optionId: o.id,
      label: o.label,
      sublabel: o.sublabel,
      votes: counts.get(o.id) || 0,
      share: (counts.get(o.id) || 0) / denominator
    }))
    .sort((a, b) => b.votes - a.votes);
}

function syncRoundToSession() {
  roomSessionState.activeRound = activeRound;
  roomSessionState.updatedAt = Date.now();
}

function ballotFor(roundId: string | null, voterId: string) {
  if (!roundId) return { roundId: null, selections: [] as string[], hasVoted: false };
  const b = roundBallots.find(r => r.roundId === roundId && r.voterId === voterId);
  return { roundId, selections: b ? b.selections : [], hasVoted: !!b };
}

// Public history contains closed-round summaries only, never open ballot tallies.
app.get('/api/round/history', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const closed = [...roundHistory, ...(activeRound?.status === 'revealed' ? [activeRound] : [])];
  const rounds = closed.filter((r, i, all) => all.findIndex(other => other.id === r.id) === i)
    .sort((a, b) => (b.closedAt || b.openedAt) - (a.closedAt || a.openedAt))
    .map(r => ({ id: r.id, title: r.title, kind: r.kind, openedAt: r.openedAt,
      closedAt: r.closedAt, ballotsCast: r.ballotsCast,
      results: r.results || [],
      squadMembersCount: r.options.reduce((count, option) => count + (option.squadMembers?.length || 0), 0)
    }));
  res.json({ success: true, rounds });
});

// Live breakdowns are computed for voters only, never stored in shared state/SSE.
app.get("/api/round", (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const requestedId = typeof req.query.round === 'string' ? req.query.round : undefined;
  const selected = requestedId ? (activeRound?.id === requestedId ? activeRound : roundHistory.find(r => r.id === requestedId)) : activeRound;
  if (requestedId && !selected) return res.status(404).json({ success: false, error: 'This ballot is unavailable or is no longer retained.' });
  const myBallot = ballotFor(selected?.id ?? null, req.voterId);
  res.json({
    success: true,
    round: selected && selected.status === 'open' && myBallot.hasVoted ? { ...selected, results: tallyRound(selected) } : selected,
    myBallot,
    history: roundHistory.slice(0, 10)
  });
});

// Host opens a round. The host picks the ballot type per round.
app.post("/api/round/open", requireHost, (req, res) => {
  const { kind, title, prompt, optionIds, maxSelections, durationHours, endsAt, allowSquadSignup } = req.body || {};
  if (allowSquadSignup !== undefined && typeof allowSquadSignup !== "boolean") return res.status(400).json({ error: "Squad signup must be enabled or disabled." });
  const openedAt = Date.now();
  let deadline: string | undefined;
  let duration: number | undefined;
  if (durationHours !== undefined || endsAt !== undefined) {
    if (durationHours !== undefined && endsAt !== undefined) return res.status(400).json({ error: "Provide a duration or a deadline, not both." });
    const end = endsAt !== undefined ? (typeof endsAt === 'string' ? Date.parse(endsAt) : NaN) : openedAt + (typeof durationHours === 'number' ? durationHours : NaN) * 3600000;
    duration = (end - openedAt) / 3600000;
    if (!Number.isFinite(end) || duration <= 0 || duration > 720) return res.status(400).json({ error: "Deadline must be in the future and within 30 days." });
    deadline = new Date(end).toISOString();
  }

  // A live round must be closed deliberately by the host. Nothing here ends it.
  if (activeRound && activeRound.status === "open") {
    return res.status(409).json({
      success: false,
      error: "A round is already open. Close it first.",
      round: activeRound
    });
  }

  if (!ROUND_KINDS.includes(kind)) {
    return res.status(400).json({ success: false, error: `kind must be one of: ${ROUND_KINDS.join(", ")}` });
  }
  const options = buildRoundOptions(kind, optionIds);
  if (options.length < 2) {
    return res.status(400).json({ success: false, error: "A round needs at least 2 options on the ballot." });
  }

  // A revealed round has already been tallied at close, so it just steps aside
  // into history — results intact — to make room for the new one. An OPEN round
  // never does: it is a live vote, and a stray double-tap, a second host device
  // or a direct API call must not end it out from under the room.
  if (activeRound) {
    archiveActiveRound();
  }

  if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }

  const cap = Number(maxSelections);
  activeRound = {
    id: `round-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    kind,
    title: title ? String(title).trim().slice(0, 120) : `Live ${kind} vote`,
    prompt: prompt ? String(prompt).trim().slice(0, 240) : undefined,
    status: "open",
    options,
    maxSelections: Number.isFinite(cap) && cap >= 1 ? Math.min(Math.floor(cap), options.length) : 1,
    ballotsCast: 0,
    openedAt,
    allowSquadSignup: allowSquadSignup !== false,
    ...(deadline ? { endsAt: deadline, durationHours: duration } : {})
  };

  syncRoundToSession();
  persistState();

  broadcastSSE("ROUND_OPENED", { round: activeRound });
  broadcastStateUpdate("round_opened", `Host opened a ${kind} round: "${activeRound.title}"`, "Host Conductor");

  res.json({ success: true, round: activeRound });
});

// A participant submits their ballot. One ballot per device per round; re-submitting replaces it.
app.post("/api/round/vote", (req, res) => {
  const { roundId, selections, voterName } = req.body || {};

  if (!activeRound || activeRound.status !== "open") {
    return res.status(409).json({ success: false, error: "No round is open right now.", round: activeRound });
  }
  if (roundId && roundId !== activeRound.id) {
    return res.status(409).json({ success: false, error: "That round has already closed.", round: activeRound });
  }

  const raw = Array.isArray(selections) ? selections.map(String) : [];
  const valid = new Set(activeRound.options.map(o => o.id));
  const picked = [...new Set(raw)].filter(id => valid.has(id));

  if (!picked.length) {
    return res.status(400).json({ success: false, error: "Pick at least one option on the ballot." });
  }
  if (picked.length > activeRound.maxSelections) {
    return res.status(400).json({
      success: false,
      error: `This round allows at most ${activeRound.maxSelections} selection(s).`
    });
  }

  const existing = roundBallots.find(b => b.roundId === activeRound!.id && b.voterId === req.voterId);
  if (existing) {
    existing.selections = picked;
    existing.ts = Date.now();
  } else {
    roundBallots.push({
      roundId: activeRound.id,
      voterId: req.voterId,
      voterName: voterName ? String(voterName).trim().slice(0, 80) : undefined,
      selections: picked,
      ts: Date.now()
    });
  }

  activeRound.ballotsCast = roundBallots.filter(b => b.roundId === activeRound!.id).length;
  syncRoundToSession();
  persistState();

  // Only the running total goes out live — never the per-option tally, which would
  // let the room watch the result form and bias later voters.
  broadcastSSE("ROUND_BALLOT_CAST", { roundId: activeRound.id, ballotsCast: activeRound.ballotsCast });

  res.json({
    success: true,
    round: activeRound,
    myBallot: ballotFor(activeRound.id, req.voterId)
  });
});

function closeActiveRound(expired: boolean) {
  if (!activeRound || activeRound.status !== 'open') return;
  activeRound.results = tallyRound(activeRound);
  activeRound.ballotsCast = roundBallots.filter(b => b.roundId === activeRound!.id).length;
  activeRound.status = "revealed";
  activeRound.closedAt = expired && activeRound.endsAt ? Date.parse(activeRound.endsAt) : Date.now();

  syncRoundToSession();
  persistState();

  promoteSpotlightFromRound(activeRound);

  broadcastSSE("ROUND_CLOSED", { round: activeRound });
  broadcastStateUpdate(
    "round_closed",
    `Round closed: "${activeRound.title}" — ${activeRound.ballotsCast} ballot(s) cast`,
    "Host Conductor"
  );

}

// ----------------- WEEKLY SPOTLIGHT -----------------

const SPOTLIGHT_DEFAULT_DAYS = 7;

// A spotlight COPIES the member's details rather than referencing them. The
// history is a record of what was true that week — it has to keep reading
// correctly after the member edits their profile, and has to survive them
// leaving the directory entirely.
function spotlightFrom(member: ServerAttendee, source: SpotlightSource, extra: Partial<Spotlight> = {}): Spotlight {
  return {
    id: `spot-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    memberId: member.id,
    name: member.name,
    organization: member.organization || "",
    stage: member.stage || "",
    bio: member.bio || "",
    giveAsk: member.giveAsk || "",
    link: member.link || "",
    location: member.location || "",
    listed: member.listed !== false,
    source,
    startedAt: Date.now(),
    ...extra
  };
}

// Retiring is append-only: a spotlight that ran is part of the record whether it
// ended on its clock, was replaced, or was cleared by the host.
function retireSpotlight() {
  if (!activeSpotlight) return;
  spotlightHistory.unshift({ ...activeSpotlight, endedAt: Date.now() });
  activeSpotlight = null;
}

function expireSpotlightIfNeeded() {
  if (activeSpotlight?.endsAt && Date.now() >= Date.parse(activeSpotlight.endsAt)) {
    retireSpotlight();
    persistState();
    broadcastSSE("SPOTLIGHT_UPDATED", { spotlight: null });
  }
}

function startSpotlight(next: Spotlight) {
  retireSpotlight();
  activeSpotlight = next;
  persistState();
  broadcastSSE("SPOTLIGHT_UPDATED", { spotlight: activeSpotlight });
  broadcastStateUpdate("spotlight_started", `${next.name} is this week's spotlight`, next.name);
}

app.get("/api/spotlight", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, spotlight: activeSpotlight, history: spotlightHistory.slice(0, 30) });
});

// The picked path. The host names someone; no ballot involved.
app.post("/api/spotlight", requireHost, (req, res) => {
  const { memberId, note, days } = req.body || {};
  const member = attendees.find(a => a.id === memberId);
  if (!member) return res.status(404).json({ error: "No member with that id. Refresh the directory and try again." });
  if (note !== undefined && (typeof note !== "string" || note.length > 400)) return res.status(400).json({ error: "Keep the note within 400 characters." });
  const runFor = days === undefined ? SPOTLIGHT_DEFAULT_DAYS : Number(days);
  if (!Number.isFinite(runFor) || runFor <= 0 || runFor > 90) return res.status(400).json({ error: "A spotlight runs between 1 and 90 days." });

  startSpotlight(spotlightFrom(member, "picked", {
    note: typeof note === "string" ? note.trim() : "",
    endsAt: new Date(Date.now() + runFor * 86400000).toISOString()
  }));
  res.json({ success: true, spotlight: activeSpotlight });
});

app.delete("/api/spotlight", requireHost, (_req, res) => {
  if (!activeSpotlight) return res.status(409).json({ error: "There is no spotlight running." });
  retireSpotlight();
  persistState();
  broadcastSSE("SPOTLIGHT_UPDATED", { spotlight: null });
  res.json({ success: true, spotlight: null });
});

// The voted path. A closing member ballot promotes its winner.
//
// A tie promotes NOBODY. Breaking it by ballot order would invent a result the
// vote did not produce, and this record is meant to be citable months later.
// The host picks between the tied members with POST /api/spotlight instead.
function promoteSpotlightFromRound(round: VotingRound) {
  if (round.kind !== "member" || !round.results?.length || !round.ballotsCast) return;
  const sorted = [...round.results].sort((a, b) => b.votes - a.votes);
  const top = sorted.filter(r => r.votes === sorted[0].votes);
  if (!sorted[0].votes || top.length !== 1) return;
  const member = attendees.find(a => a.id === top[0].optionId);
  if (!member) return;
  const runFor = round.durationHours ? Math.max(1, Math.round(round.durationHours / 24)) : SPOTLIGHT_DEFAULT_DAYS;
  startSpotlight(spotlightFrom(member, "voted", {
    roundId: round.id,
    votes: top[0].votes,
    endsAt: new Date(Date.now() + runFor * 86400000).toISOString()
  }));
}

function expireRoundIfNeeded() {
  if (activeRound?.status === 'open' && activeRound.endsAt && Date.now() >= Date.parse(activeRound.endsAt)) closeActiveRound(true);
}

app.post('/api/round/extend', requireHost, (req, res) => {
  if (!activeRound || activeRound.status !== 'open' || !activeRound.endsAt || req.body?.roundId !== activeRound.id) return res.status(409).json({ error: 'This timed round is no longer open.', round: activeRound });
  const end = Date.parse(activeRound.endsAt) + 24 * 3600000;
  if (end - activeRound.openedAt > 720 * 3600000) return res.status(400).json({ error: 'A round can run for at most 30 days.' });
  activeRound.endsAt = new Date(end).toISOString();
  activeRound.durationHours = (end - activeRound.openedAt) / 3600000;
  syncRoundToSession();
  persistState();
  broadcastSSE('ROUND_UPDATED', { round: activeRound });
  res.json({ success: true, round: activeRound });
});

// Signup remains available after voting closes, including archived results.
app.post('/api/round/join-squad', (req, res) => {
  const { roundId, optionId, skill, leave } = req.body || {};
  const round = activeRound?.id === roundId ? activeRound : roundHistory.find(r => r.id === roundId);
  const option = round?.options.find(o => o.id === optionId);
  if (!round || !option) return res.status(404).json({ success: false, error: 'This ballot option is unavailable.' });
  if (round.allowSquadSignup === false && leave !== true) return res.status(409).json({ success: false, error: 'Squad signup is disabled for this ballot.' });
  const memberId = Object.keys(memberContacts).find(id => memberContacts[id].voterId === req.voterId);
  const member = attendees.find(a => a.id === memberId);
  if (!member) return res.status(401).json({ success: false, error: 'Join the community first.' });
  if (leave !== true && (typeof skill !== 'string' || !skill.trim() || skill.length > 80)) return res.status(400).json({ success: false, error: 'Choose a skill of up to 80 characters.' });
  option.squadMembers = (option.squadMembers || []).filter(m => m.id !== member.id);
  if (leave !== true) option.squadMembers.push({ id: member.id, name: member.name, superpower: skill.trim() });
  syncRoundToSession();
  persistState();
  if (round === activeRound) broadcastSSE('ROUND_UPDATED', { round });
  else broadcastSSE('ROUND_SQUAD_UPDATED', { round });
  broadcastStateUpdate('squad_updated', `${member.name} ${leave === true ? 'left' : 'joined'} the squad for "${option.label}"`, member.name);
  res.json({ success: true, round, archived: round !== activeRound });
});

// Host closes the round: tally, reveal, and schedule the return to idle.
app.post("/api/round/close", requireHost, (req, res) => {
  if (!activeRound) {
    return res.status(409).json({ success: false, error: "There is no round to close." });
  }
  if (activeRound.status === "revealed") {
    return res.json({ success: true, round: activeRound });
  }

  closeActiveRound(false);
  // Community results remain available until the host opens another round or archives them.
  if (activeRound.endsAt) return res.json({ success: true, round: activeRound });

  // Reveal, then return to idle. The host can also clear it early.
  const holdMs = Number(req.body?.revealMs);
  const revealMs = Number.isFinite(holdMs) && holdMs > 0 ? holdMs : DEFAULT_REVEAL_MS;
  const closingId = activeRound.id;
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (activeRound?.id === closingId && activeRound.status === "revealed") {
      archiveActiveRound();
    }
  }, revealMs);

  res.json({ success: true, round: activeRound, revealMs });
});

function archiveActiveRound() {
  if (!activeRound) return;
  const archived = activeRound;
  roundHistory.unshift(activeRound);
  const clearedId = activeRound.id;
  // The tally is already snapshotted into round.results, so the individual
  // ballots have served their purpose. Dropping them keeps the state file flat
  // across an evening instead of growing ~30KB per round, and stops per-voter
  // selections sitting on disk long after the round they belonged to.
  roundBallots = roundBallots.filter(b => b.roundId !== clearedId);
  activeRound = null;
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
  syncRoundToSession();
  persistState();
  // The archived round rides along so a phone can keep showing "last round
  // result" on the idle screen instead of the round simply vanishing.
  broadcastSSE("ROUND_CLEARED", { roundId: clearedId, round: archived });
}

// Host dismisses the results early and sends every phone back to the room view.
app.delete("/api/round", requireHost, (_req, res) => {
  if (!activeRound) {
    return res.json({ success: true, round: null });
  }
  if (activeRound.status === "open") return res.status(409).json({ error: "Close the round before archiving it." });
  archiveActiveRound();
  res.json({ success: true, round: null, history: roundHistory.slice(0, 10) });
});

// A ballot option must not vanish from under a live round. The tally is keyed
// by option id, so deleting one mid-round would strand every ballot that picked
// it and leave phones voting for something that no longer exists. True for a
// round in ANY status (open or revealed) — the host closes it first.
function isOnActiveRound(targetId: string): boolean {
  return !!activeRound && activeRound.options.some(o => o.id === targetId);
}

// ----------------- VOTER ENDPOINTS -----------------

// What has this device already voted for? (identity = tcf_vid cookie)
app.get("/api/votes/mine", (req, res) => {
  res.json({ success: true, ...myVotesFor(req.voterId) });
});

// ----------------- TRUSTEES ENDPOINTS -----------------

// Get all trustee candidates
app.get("/api/trustees", (_req, res) => {
  res.json({
    success: true,
    candidates: publicTrustees()
  });
});

// Nominate or update candidate
app.post("/api/trustees/nominate", (req, res) => {
  const {
    id,
    seatNumber,
    name,
    titleOrOrg,
    bio,
    phoneOrContact,
    scoreR,
    scoreN,
    scoreT,
    reachable,
    confirmed,
    camaChecks,
    nominatedBy,
    notes
  } = req.body;

  if (!name || !name.trim() || !seatNumber) {
    return res.status(400).json({ success: false, error: "Candidate Name and Seat Number are required" });
  }

  const candidateId = id || `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  // Editing (id given) targets that candidate; a fresh nomination replaces whoever holds the seat.
  const existingIdx = id
    ? trusteeCandidates.findIndex(c => c.id === id)
    : trusteeCandidates.findIndex(c => c.seatNumber === Number(seatNumber));
  const replaced = existingIdx >= 0 ? trusteeCandidates[existingIdx] : null;

  // Nominating into a FREE seat is open to the floor - that is the feature.
  // Nominating over an OCCUPIED seat is destructive: it evicts the incumbent and
  // drops their endorsements below. That is the same act as DELETE /api/trustees/:id,
  // which is host-gated, so it cannot be reachable through an ungated route.
  if (!id && replaced && !hasHostKey(req)) {
    return res.status(409).json({
      success: false,
      error: "seat_taken",
      message: `Seat ${seatNumber} is already held by ${replaced.name}. Speak to the host to change it.`,
      candidates: publicTrustees()
    });
  }

  const isNewPerson = !replaced || replaced.id !== candidateId;

  const newCandidate = {
    id: candidateId,
    seatNumber: Number(seatNumber),
    name: name.trim(),
    titleOrOrg: titleOrOrg ? titleOrOrg.trim() : "Tin City Founder",
    bio: bio ? bio.trim() : "",
    phoneOrContact: phoneOrContact ? phoneOrContact.trim() : "",
    // 0 means "not yet scored". A nomination from the floor sends no scores, and
    // defaulting those to 5 made a stranger indistinguishable from a vetted
    // candidate on the sheet the host picks legal signatories from. An
    // explicitly supplied score still clamps to the 1-5 the console uses.
    scoreR: typeof scoreR === "number" ? Math.min(5, Math.max(1, scoreR)) : 0,
    scoreN: typeof scoreN === "number" ? Math.min(5, Math.max(1, scoreN)) : 0,
    scoreT: typeof scoreT === "number" ? Math.min(5, Math.max(1, scoreT)) : 0,
    reachable: reachable !== undefined ? !!reachable : true,
    confirmed: confirmed !== undefined ? !!confirmed : true,
    // Same reasoning: nobody has run a CAMA 2020 disqualification check on a
    // name shouted from the floor, so every box starts unticked. The console
    // sends the full object when the host nominates or edits, so its own
    // ticking is unchanged.
    camaChecks: {
      isOver18: !!camaChecks?.isOver18,
      isSoundMind: !!camaChecks?.isSoundMind,
      notBankrupt: !!camaChecks?.notBankrupt,
      noFraudConviction: !!camaChecks?.noFraudConviction
    },
    votes: 0,
    baseVotes: isNewPerson ? 0 : (replaced!.baseVotes ?? replaced!.votes ?? 0),
    nominatedBy: nominatedBy || "Founders Assembly",
    createdAt: isNewPerson ? Date.now() : replaced!.createdAt,
    notes: notes || ""
  };

  if (existingIdx >= 0) {
    trusteeCandidates[existingIdx] = newCandidate;
  } else {
    trusteeCandidates.push(newCandidate);
  }

  if (isNewPerson) {
    // The person being replaced takes their endorsements with them.
    if (replaced) dropVotesForTarget("trustee", replaced.id);
    // The nominator's own endorsement is the candidate's first vote - and their only one.
    recordVote("trustee", newCandidate.id, req.voterId, newCandidate.nominatedBy);
  }
  recomputeCounts();

  broadcastStateUpdate("trustee_nominated", `Nominated ${newCandidate.name} for Seat ${newCandidate.seatNumber}`, newCandidate.nominatedBy);
  res.json({ success: true, candidate: publicTrustee(newCandidate), candidates: publicTrustees(), myVotes: myVotesFor(req.voterId) });
});

// Vote / Endorse a trustee candidate
app.post("/api/trustees/:id/vote", (req, res) => {
  const { id } = req.params;
  const { voterName } = req.body || {};
  const candidate = trusteeCandidates.find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: "Trustee candidate not found" });
  }

  if (!recordVote("trustee", candidate.id, req.voterId, voterName)) {
    return res.status(409).json({
      success: false,
      error: "already_voted",
      message: `You have already endorsed ${candidate.name}.`,
      candidate: publicTrustee(candidate),
      candidates: publicTrustees(),
      myVotes: myVotesFor(req.voterId)
    });
  }
  recomputeCounts();

  broadcastStateUpdate("trustee_voted", `Endorsed ${candidate.name} for Trustee Seat ${candidate.seatNumber}`, voterName || "Founder");
  res.json({ success: true, candidate: publicTrustee(candidate), candidates: publicTrustees(), myVotes: myVotesFor(req.voterId) });
});

// Withdraw an endorsement
app.delete("/api/trustees/:id/vote", (req, res) => {
  const { id } = req.params;
  const candidate = trusteeCandidates.find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: "Trustee candidate not found" });
  }

  if (!retractVote("trustee", candidate.id, req.voterId)) {
    return res.status(404).json({
      success: false,
      error: "not_voted",
      message: `You have not endorsed ${candidate.name}.`,
      myVotes: myVotesFor(req.voterId)
    });
  }
  recomputeCounts();

  broadcastStateUpdate("trustee_vote_withdrawn", `An endorsement for ${candidate.name} (Seat ${candidate.seatNumber}) was withdrawn`);
  res.json({ success: true, candidate: publicTrustee(candidate), candidates: publicTrustees(), myVotes: myVotesFor(req.voterId) });
});

// Host removes a nominee from the board (duplicate, test entry, joke nomination).
// Host-gated: the board is otherwise append-only, and this is destructive.
app.delete("/api/trustees/:id", requireHost, (req, res) => {
  const { id } = req.params;
  const candidate = trusteeCandidates.find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: "Trustee candidate not found" });
  }

  if (isOnActiveRound(candidate.id)) {
    return res.status(409).json({
      success: false,
      error: "on_active_round",
      message: `${candidate.name} is an option on the current voting round. Close the round first, then delete.`,
      round: activeRound
    });
  }

  // The nominee takes their endorsements with them - no stranded vote records.
  dropVotesForTarget("trustee", candidate.id);
  trusteeCandidates = trusteeCandidates.filter(c => c.id !== candidate.id);

  recomputeCounts();
  persistState();
  // Full-snapshot broadcast, same as every other mutating route: every phone
  // and the projector drop the nominee without a refresh.
  broadcastStateUpdate(
    "trustee_removed",
    `Host removed ${candidate.name} from Trustee Seat ${candidate.seatNumber}`,
    "Host Conductor"
  );

  res.json({ success: true, candidates: publicTrustees(), myVotes: myVotesFor(req.voterId) });
});

// Update trustee R-N-T scores and flags
app.post("/api/trustees/:id/score", requireHost, (req, res) => {
  const { id } = req.params;
  const { scoreR, scoreN, scoreT, reachable, confirmed, notes } = req.body;
  const candidate = trusteeCandidates.find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ success: false, error: "Trustee candidate not found" });
  }

  if (typeof scoreR === "number") candidate.scoreR = Math.min(5, Math.max(1, scoreR));
  if (typeof scoreN === "number") candidate.scoreN = Math.min(5, Math.max(1, scoreN));
  if (typeof scoreT === "number") candidate.scoreT = Math.min(5, Math.max(1, scoreT));
  if (reachable !== undefined) candidate.reachable = !!reachable;
  if (confirmed !== undefined) candidate.confirmed = !!confirmed;
  if (notes !== undefined) candidate.notes = notes;

  broadcastStateUpdate("trustee_scored", `Updated R-N-T evaluation for ${candidate.name} (Seat ${candidate.seatNumber})`);
  res.json({ success: true, candidate: publicTrustee(candidate), candidates: publicTrustees() });
});

// ----------------- ATTENDEES ENDPOINTS -----------------

// Get all checked-in attendees
app.get("/api/attendees", (_req, res) => {
  res.json({ success: true, attendees });
});

// Trusted-community recovery: knowing the number is sufficient; no OTP is sent.
app.post("/api/profile/recover", (req, res) => {
  let phone: string;
  try { phone = normalizePhone(String(req.body?.whatsapp ?? "")); }
  catch (error) { return res.status(400).json({ error: (error as Error).message }); }
  const match = Object.entries(memberContacts).find(([, contact]) => phone && contact.phone === phone);
  const attendee = match && attendees.find(a => a.id === match[0]);
  if (!match || !attendee) return res.status(404).json({ error: "No profile has this number saved yet. Use your original browser to add it in Your Profile, or join as a new member." });
  const secure = req.secure || String(req.headers["x-forwarded-proto"]).toLowerCase() === "https";
  res.removeHeader("Set-Cookie"); // Replace any guest cookie issued earlier in this request.
  res.cookie(VOTER_COOKIE, match[1].voterId, { httpOnly: true, sameSite: "lax", secure, maxAge: 365 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, attendee: { ...attendee, whatsapp: phone } });
});

app.get("/api/profile/me", (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const match = Object.entries(memberContacts).find(([, contact]) => contact.voterId === req.voterId);
  const attendee = match && attendees.find(a => a.id === match[0]);
  res.json({ attendee: attendee ? { ...attendee, whatsapp: match![1].phone } : null });
});

// Sign out this browser only. Keep the member and their votes for phone recovery.
app.post('/api/profile/signout', (req, res) => {
  const secure = req.secure || String(req.headers['x-forwarded-proto']).toLowerCase() === 'https';
  res.removeHeader('Set-Cookie');
  res.cookie(VOTER_COOKIE, crypto.randomBytes(16).toString('hex'), { httpOnly: true, sameSite: 'lax', secure, maxAge: 365 * 24 * 60 * 60 * 1000 });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
});

// Check-in or update attendee profile
app.post(["/api/attendees", "/api/attendees/checkin"], (req, res) => {
  const { id, name, title, tags, bio, giveAsk, location, avatarColor, whatsapp, organization, linkedin, link, stage, listed } = req.body;
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ success: false, error: "Name is required for check-in" });
  }

  if (name.trim().length > 80) return res.status(400).json({ error: 'Keep your display name within 80 characters.' });
  if (organization !== undefined && (typeof organization !== 'string' || organization.length > 160)) return res.status(400).json({ error: 'Keep your organization within 160 characters.' });
  const attendeeId = id || `att-${Date.now()}`;
  const existingIndex = attendees.findIndex(a => a.id === attendeeId);
  const existing = existingIndex >= 0 ? attendees[existingIndex] : undefined;
  const contact = memberContacts[attendeeId];
  if (contact && contact.voterId !== req.voterId) return res.status(403).json({ error: "Use Already joined? to recover this profile first." });
  let phone = contact?.phone || "";
  if (whatsapp !== undefined) {
    try { phone = normalizePhone(String(whatsapp)); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
  }
  if (phone && Object.entries(memberContacts).some(([key, value]) => key !== attendeeId && value.phone === phone)) {
    return res.status(409).json({ error: "That number already belongs to a profile. Use Already joined? to recover it." });
  }


  // Blank stays blank. A field the client actually sent wins even when it is an
  // empty string (that is somebody clearing it); a field the client omitted
  // falls back to what the record already held, and to empty otherwise. The
  // server does not invent a title, a tag or a town — every attendee reading
  // "Tin City Founder / Founder / CEO / Jos, Plateau State" is what made the
  // directory useless.
  const text = (value: unknown, previous: string | undefined) =>
    typeof value === "string" ? value.trim() : (previous ?? "");

  let linkedinUrl = existing?.linkedin || '';
  if (linkedin !== undefined) {
    if (typeof linkedin !== 'string') return res.status(400).json({ error: 'Enter a LinkedIn profile URL.' });
    linkedinUrl = linkedin.trim();
    if (linkedinUrl) {
      try {
        const url = new URL(/^https?:\/\//i.test(linkedinUrl) ? linkedinUrl : `https://${linkedinUrl}`);
        if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname) || !url.pathname.startsWith('/in/') || url.pathname.length <= 4 || url.username || url.password || url.port) throw new Error();
        url.search = ''; url.hash = ''; linkedinUrl = url.toString();
      } catch { return res.status(400).json({ error: 'Use a LinkedIn profile URL such as https://www.linkedin.com/in/your-name.' }); }
    }
  }
  // The member's own link — Instagram, a website, anything. linkedin above stays
  // narrow because it renders as a LinkedIn badge; this one is the general case.
  // http is allowed: plenty of small Jos businesses are not on TLS yet. Anything
  // that is not http(s) — javascript:, data: — fails the protocol check.
  let linkUrl = existing?.link || '';
  if (link !== undefined) {
    if (typeof link !== 'string') return res.status(400).json({ error: 'Enter a link, or leave it blank.' });
    try { linkUrl = normalizeLink(link); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
  }
  if (stage !== undefined && (typeof stage !== 'string' || stage.length > 60)) return res.status(400).json({ error: 'Keep your stage within 60 characters.' });
  if (listed !== undefined && typeof listed !== 'boolean') return res.status(400).json({ error: 'Listing preference must be true or false.' });
  if (avatarColor !== undefined && (typeof avatarColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(avatarColor))) return res.status(400).json({ error: 'Choose a valid avatar colour.' });

  const newAttendee = {
    id: attendeeId,
    name: name.trim(),
    title: text(title, existing?.title),
    organization: text(organization, existing?.organization),
    linkedin: linkedinUrl,
    tags: Array.isArray(tags)
      ? tags.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0).map((t: string) => t.trim())
      : (existing?.tags ?? []),
    bio: text(bio, existing?.bio),
    giveAsk: text(giveAsk, existing?.giveAsk),
    location: text(location, existing?.location),
    link: linkUrl,
    stage: text(stage, existing?.stage),
    listed: typeof listed === 'boolean' ? listed : (existing?.listed ?? true),
    avatarColor: avatarColor || existing?.avatarColor || "#0D4734",
    checkedInAt: existing ? existing.checkedInAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    attendees[existingIndex] = newAttendee;
  } else {
    attendees.unshift(newAttendee);
  }

  // Identity remains stable when display names change, including squad rosters.
  if (existing && existing.name !== newAttendee.name) {
    const affected = new Set(voteRecords.filter(r => r.kind === 'squad' && r.voterId === req.voterId).map(r => r.targetId));
    for (const record of voteRecords) if (record.voterId === req.voterId) record.voterName = newAttendee.name;
    for (const ballot of roundBallots) if (ballot.voterId === req.voterId) ballot.voterName = newAttendee.name;
    for (const problem of problems) if (affected.has(problem.id)) {
      if (!voteRecords.some(r => r.kind === 'squad' && r.targetId === problem.id && r.voterName === existing.name)) problem.collaborators = problem.collaborators.filter(n => n !== existing.name);
      if (!problem.collaborators.includes(newAttendee.name)) problem.collaborators.push(newAttendee.name);
    }
    for (const round of [...roundHistory, ...(activeRound ? [activeRound] : [])]) for (const option of round.options) for (const member of option.squadMembers || []) if (member.id === attendeeId) member.name = newAttendee.name;
    recomputeCounts();
    syncRoundToSession();
    if (activeRound) broadcastSSE('ROUND_UPDATED', { round: activeRound });
  }
  memberContacts[attendeeId] = { phone, voterId: req.voterId };
  broadcastStateUpdate("attendee_checkin", `${newAttendee.name} checked in to the meetup`, newAttendee.name);
  res.json({ success: true, attendee: { ...newAttendee, whatsapp: phone }, attendees });
});

// Remove attendee
app.delete("/api/attendees/:id", requireHost, (req, res) => {
  const { id } = req.params;
  const removed = attendees.find(a => a.id === id);
  attendees = attendees.filter(a => a.id !== id);
  delete memberContacts[id];
  if (removed) {
    broadcastStateUpdate("attendee_removed", `${removed.name} checked out`);
  }
  res.json({ success: true, attendees });
});

// ----------------- CATEGORIES ENDPOINTS -----------------

// Get all categories with problem counts
app.get("/api/categories", (_req, res) => {
  const result = Object.entries(categoriesStore).map(([name, data]) => {
    const problemCount = problems.filter(p => p.category === name).length;
    return {
      name,
      upvotes: data.upvotes,
      description: data.description,
      iconName: data.iconName,
      problemCount
    };
  });
  res.json({ success: true, categories: result });
});

// Host-managed sectors. Ballot options are snapshots and retain their original names.
const validSectorName = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.trim().length <= 80 && !['__proto__', 'prototype', 'constructor', 'all'].includes(value.trim().toLowerCase());
app.post('/api/categories', requireHost, (req, res) => {
  const { name, description } = req.body || {};
  if (!validSectorName(name) || typeof description !== 'string' || description.length > 1000) return res.status(400).json({ error: 'Enter a sector name (up to 80 characters) and description (up to 1000 characters).' });
  const trimmed = name.trim();
  if (Object.keys(categoriesStore).some(n => n.toLowerCase() === trimmed.toLowerCase())) return res.status(409).json({ error: 'A sector with this name already exists.' });
  categoriesStore[trimmed] = { upvotes: 0, baseUpvotes: 0, description: description.trim(), iconName: 'FolderKanban' };
  broadcastStateUpdate('sector_created', `Created sector: ${trimmed}`, 'Host', trimmed);
  broadcastSSE('SECTORS_UPDATED', {});
  res.status(201).json({ success: true, categories: serializeCategories(), problems });
});
app.patch('/api/categories/:name', requireHost, (req, res) => {
  const original = req.params.name;
  const { name, description } = req.body || {};
  if (!Object.hasOwn(categoriesStore, original)) return res.status(404).json({ error: 'This sector no longer exists. Refresh the list.' });
  if (!validSectorName(name) || typeof description !== 'string' || description.length > 1000) return res.status(400).json({ error: 'Enter a sector name (up to 80 characters) and description (up to 1000 characters).' });
  const renamed = name.trim();
  if (Object.keys(categoriesStore).some(n => n !== original && n.toLowerCase() === renamed.toLowerCase())) return res.status(409).json({ error: 'A sector with this name already exists.' });
  const sector = categoriesStore[original];
  sector.description = description.trim();
  if (renamed !== original) {
    delete categoriesStore[original]; categoriesStore[renamed] = sector;
    for (const suggestion of sectorSuggestions) if (suggestion.resolvedSector === original) suggestion.resolvedSector = renamed;
    for (const problem of problems) if (problem.category === original) problem.category = renamed;
    for (const record of voteRecords) if (record.kind === 'category' && record.targetId === original) record.targetId = renamed;
    rebuildCastVotes(); recomputeCounts();
  }
  broadcastStateUpdate('sector_updated', `Updated sector: ${original}${renamed !== original ? ` → ${renamed}` : ''}`, 'Host', renamed);
  broadcastSSE('SECTORS_UPDATED', {});
  res.json({ success: true, categories: serializeCategories(), problems });
});

app.delete('/api/categories/:name', requireHost, (req, res) => {
  const name = req.params.name;
  const replacement = req.body?.replacement;
  if (!Object.hasOwn(categoriesStore, name)) return res.status(404).json({ error: 'Sector not found.' });
  const linked = problems.filter(p => p.category === name);
  if ((linked.length || replacement) && (typeof replacement !== 'string' || replacement === name || !Object.hasOwn(categoriesStore, replacement))) return res.status(400).json({ error: 'Choose another existing sector for the linked challenges.' });
  for (const problem of linked) problem.category = replacement;
  // An opinion about one sector must not become support for a different sector.
  dropVotesForTarget('category', name);
  delete categoriesStore[name];
  for (const suggestion of sectorSuggestions) if (suggestion.resolvedSector === name) suggestion.resolvedSector = replacement || undefined;
  recomputeCounts();
  broadcastStateUpdate('sector_deleted', `Deleted sector: ${name}`, 'Host');
  broadcastSSE('SECTORS_UPDATED', {});
  res.json({ success: true, categories: serializeCategories(), problems });
});

app.post('/api/sector-suggestions', (req, res) => {
  const memberId = Object.keys(memberContacts).find(id => memberContacts[id].voterId === req.voterId);
  const member = attendees.find(a => a.id === memberId);
  if (!member) return res.status(401).json({ error: 'Join or recover your community profile before suggesting a sector.' });
  const { name, description } = req.body || {};
  if (!validSectorName(name) || typeof description !== 'string' || description.length > 1000) return res.status(400).json({ error: 'Enter a sector name and a description of up to 1000 characters.' });
  const trimmed = name.trim();
  if (Object.keys(categoriesStore).some(n => n.toLowerCase() === trimmed.toLowerCase())) return res.status(409).json({ error: 'This sector already exists. Choose it from the list.' });
  if (sectorSuggestions.some(s => s.status === 'pending' && s.name.toLowerCase() === trimmed.toLowerCase())) return res.status(409).json({ error: 'This sector has already been suggested and is awaiting host review.' });
  sectorSuggestions.unshift({ id: crypto.randomUUID(), name: trimmed, description: description.trim(), memberId: member.id, submittedBy: member.name, createdAt: Date.now(), status: 'pending' });
  persistState();
  res.status(201).json({ success: true });
});
app.get('/api/sector-suggestions/mine', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const ids = Object.keys(memberContacts).filter(id => memberContacts[id].voterId === req.voterId);
  res.json({ success: true, suggestions: sectorSuggestions.filter(s => ids.includes(s.memberId)).map(s => ({ id: s.id, name: s.name, status: s.status, resolvedSector: s.resolvedSector })) });
});
app.get('/api/sector-suggestions', requireHost, (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, suggestions: sectorSuggestions.filter(s => s.status === 'pending') });
});
app.post('/api/sector-suggestions/:id/review', requireHost, (req, res) => {
  const suggestion = sectorSuggestions.find(s => s.id === req.params.id);
  if (!suggestion || suggestion.status !== 'pending') return res.status(409).json({ error: 'This suggestion has already been reviewed or is unavailable.' });
  const { action, target } = req.body || {};
  if (action === 'approve') {
    if (Object.keys(categoriesStore).some(n => n.toLowerCase() === suggestion.name.toLowerCase())) return res.status(409).json({ error: 'That sector now exists. Map the suggestion to it instead.' });
    categoriesStore[suggestion.name] = { description: suggestion.description, upvotes: 0, baseUpvotes: 0, iconName: 'FolderKanban' };
    suggestion.status = 'approved'; suggestion.resolvedSector = suggestion.name;
  } else if (action === 'map') {
    if (typeof target !== 'string' || !Object.hasOwn(categoriesStore, target)) return res.status(400).json({ error: 'Choose an existing sector.' });
    suggestion.status = 'mapped'; suggestion.resolvedSector = target;
  } else if (action === 'dismiss') suggestion.status = 'dismissed';
  else return res.status(400).json({ error: 'Choose approve, map or dismiss.' });
  broadcastStateUpdate('sector_suggestion_reviewed', `Reviewed sector suggestion: ${suggestion.name}`, 'Host');
  broadcastSSE('SECTORS_UPDATED', {});
  res.json({ success: true, categories: serializeCategories(), problems, suggestions: sectorSuggestions.filter(s => s.status === 'pending') });
});

// Vote on a category
function serializeCategories() {
  return Object.entries(categoriesStore).map(([catName, data]) => ({
    name: catName,
    upvotes: data.upvotes,
    description: data.description,
    iconName: data.iconName,
    problemCount: problems.filter(p => p.category === catName).length
  }));
}

app.post("/api/categories/:name/vote", (req, res) => {
  const { name } = req.params;
  const { increment } = req.body || {};

  if (!Object.hasOwn(categoriesStore, name)) {
    return res.status(404).json({ success: false, error: "Category not found" });
  }

  // Legacy clients sent { increment: false } to un-vote; honour that as a retraction.
  if (increment === false) {
    if (!retractVote("category", name, req.voterId)) {
      return res.status(404).json({ success: false, error: "not_voted", message: `You have not prioritized "${name}".`, categories: serializeCategories(), myVotes: myVotesFor(req.voterId) });
    }
    recomputeCounts();
    broadcastStateUpdate("category_vote_withdrawn", `A sector priority vote for "${name}" was withdrawn`, "Founder", name);
    return res.json({ success: true, categories: serializeCategories(), myVotes: myVotesFor(req.voterId) });
  }

  if (!recordVote("category", name, req.voterId)) {
    return res.status(409).json({
      success: false,
      error: "already_voted",
      message: `You have already prioritized "${name}".`,
      categories: serializeCategories(),
      myVotes: myVotesFor(req.voterId)
    });
  }
  recomputeCounts();

  broadcastStateUpdate("category_voted", `Prioritized sector: "${name}"`, "Founder", name);
  res.json({ success: true, categories: serializeCategories(), myVotes: myVotesFor(req.voterId) });
});

// Withdraw a sector priority vote
app.delete("/api/categories/:name/vote", (req, res) => {
  const { name } = req.params;

  if (!Object.hasOwn(categoriesStore, name)) {
    return res.status(404).json({ success: false, error: "Category not found" });
  }

  if (!retractVote("category", name, req.voterId)) {
    return res.status(404).json({ success: false, error: "not_voted", message: `You have not prioritized "${name}".`, categories: serializeCategories(), myVotes: myVotesFor(req.voterId) });
  }
  recomputeCounts();

  broadcastStateUpdate("category_vote_withdrawn", `A sector priority vote for "${name}" was withdrawn`, "Founder", name);
  res.json({ success: true, categories: serializeCategories(), myVotes: myVotesFor(req.voterId) });
});

// ----------------- PROBLEMS ENDPOINTS -----------------

// Get all problems
app.get("/api/problems", (_req, res) => {
  res.json({ success: true, problems });
});

// Create new problem
app.post("/api/problems", (req, res) => {
  const { title, description, category, submittedBy, skillsNeeded, autoCommit, autoUpvote } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ success: false, error: "Title, description and category are required" });
  }

  if (typeof category !== 'string' || !Object.hasOwn(categoriesStore, category)) return res.status(400).json({ success: false, error: 'Choose an existing sector. Refresh the page if the sector was renamed.' });
  const authorName = submittedBy ? submittedBy.trim() : "Anonymous Founder";
  const isCommit = autoCommit === true;
  const isUpvote = autoUpvote !== false;

  const newProb = {
    id: `prob-${Date.now()}`,
    title: title.trim(),
    description: description.trim(),
    category: category || "General Plateau Problem",
    submittedBy: authorName,
    upvotes: 0,
    commitments: 0,
    baseUpvotes: 0,
    baseCommitments: 0,
    status: (isCommit ? "Squad Forming" : "Ideation") as "Ideation" | "Squad Forming" | "Active Squad" | "Prototype Built",
    collaborators: [authorName],
    skillsNeeded: Array.isArray(skillsNeeded) && skillsNeeded.length > 0 ? skillsNeeded : ["Developers", "Domain Experts"],
    createdAt: new Date().toISOString(),
    comments: []
  };

  problems.unshift(newProb);

  // The author's own upvote / commitment are real, deduplicated votes.
  if (isUpvote) recordVote("problem", newProb.id, req.voterId, authorName);
  if (isCommit) recordVote("squad", newProb.id, req.voterId, authorName);

  recomputeCounts();

  broadcastStateUpdate("problem_created", `Submitted new problem: "${newProb.title}"`, authorName, newProb.category);
  res.status(201).json({ success: true, problem: newProb, problems, myVotes: myVotesFor(req.voterId) });
});

// Update a problem's assigned category. Host-gated: only the console offers this,
// and an open route let anyone reassign anyone's problem.
app.post("/api/problems/:id/category", requireHost, (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  const problem = problems.find(p => p.id === id);
  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  if (typeof category !== 'string' || !Object.hasOwn(categoriesStore, category)) return res.status(400).json({ success: false, error: 'Choose an existing sector.' });
  problem.category = category;

  broadcastStateUpdate("problem_recategorized", `Recategorized "${problem.title}" to ${problem.category}`, "Founder", problem.category);
  res.json({ success: true, problem, problems });
});

// Vote on problem
app.post("/api/problems/:id/vote", (req, res) => {
  const { id } = req.params;
  const { commit, name } = req.body || {};
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  const collaboratorName = name ? String(name).trim() : "Jos Founder";

  if (commit) {
    if (!recordVote("squad", problem.id, req.voterId, collaboratorName)) {
      return res.status(409).json({
        success: false,
        error: "already_committed",
        message: `You are already in the squad for "${problem.title}".`,
        problem,
        problems,
        myVotes: myVotesFor(req.voterId)
      });
    }
    // Committing implies support - counted once, never twice.
    recordVote("problem", problem.id, req.voterId, collaboratorName);
    if (!problem.collaborators.includes(collaboratorName)) {
      problem.collaborators.push(collaboratorName);
    }
    recomputeCounts();
    applySquadStatus(problem);
    broadcastStateUpdate("squad_joined", `${collaboratorName} committed to squad for "${problem.title}"`, collaboratorName, problem.category);
  } else {
    if (!recordVote("problem", problem.id, req.voterId, collaboratorName)) {
      return res.status(409).json({
        success: false,
        error: "already_voted",
        message: `You have already upvoted "${problem.title}".`,
        problem,
        problems,
        myVotes: myVotesFor(req.voterId)
      });
    }
    recomputeCounts();
    broadcastStateUpdate("problem_voted", `Upvoted "${problem.title}"`, collaboratorName, problem.category);
  }

  res.json({ success: true, problem, problems, myVotes: myVotesFor(req.voterId) });
});

// Host removes a problem from the board (duplicate, test entry, joke entry).
// Host-gated: the board is otherwise append-only, and this is destructive.
app.delete("/api/problems/:id", requireHost, (req, res) => {
  const { id } = req.params;
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  if (isOnActiveRound(problem.id)) {
    return res.status(409).json({
      success: false,
      error: "on_active_round",
      message: `"${problem.title}" is an option on the current voting round. Close the round first, then delete.`,
      round: activeRound
    });
  }

  // Both strands of vote record hang off a problem id: upvotes AND squad
  // commitments. Dropping only one would leave the other stranded and skew
  // recomputeCounts() for whatever id gets minted next.
  dropVotesForTarget("problem", problem.id);
  dropVotesForTarget("squad", problem.id);
  problems = problems.filter(p => p.id !== problem.id);

  // A pinned problem that no longer exists would blank the audience screens.
  if (roomSessionState.pinnedProblemId === problem.id) {
    roomSessionState.pinnedProblemId = undefined;
    roomSessionState.updatedAt = Date.now();
  }

  recomputeCounts();
  persistState();
  // Full-snapshot broadcast, same as every other mutating route: every phone
  // and the projector drop the card without a refresh.
  broadcastStateUpdate(
    "problem_deleted",
    `Host removed problem: "${problem.title}"`,
    "Host Conductor",
    problem.category
  );

  res.json({ success: true, problems, myVotes: myVotesFor(req.voterId) });
});

// Withdraw an upvote (squad commitments are not withdrawable)
app.delete("/api/problems/:id/vote", (req, res) => {
  const { id } = req.params;
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  if (!retractVote("problem", problem.id, req.voterId)) {
    return res.status(404).json({
      success: false,
      error: "not_voted",
      message: `You have not upvoted "${problem.title}".`,
      problem,
      problems,
      myVotes: myVotesFor(req.voterId)
    });
  }
  recomputeCounts();

  broadcastStateUpdate("problem_vote_withdrawn", `An upvote for "${problem.title}" was withdrawn`, "Founder", problem.category);
  res.json({ success: true, problem, problems, myVotes: myVotesFor(req.voterId) });
});

// Join Squad directly
app.post("/api/problems/:id/join-squad", (req, res) => {
  const { id } = req.params;
  const { name, role, skill } = req.body;
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  const memberId = Object.keys(memberContacts).find(id => memberContacts[id].voterId === req.voterId);
  const member = attendees.find(a => a.id === memberId);
  const founderName = member?.name || (name ? String(name).trim() : "Jos Innovator");
  if (skill !== undefined && (typeof skill !== 'string' || !skill.trim() || skill.length > 80)) return res.status(400).json({ success: false, error: 'Choose a skill of up to 80 characters.' });

  if (!recordVote("squad", problem.id, req.voterId, founderName)) {
    return res.status(409).json({
      success: false,
      error: "already_committed",
      message: `You are already in the squad for "${problem.title}".`,
      problem,
      problems,
      myVotes: myVotesFor(req.voterId)
    });
  }
  const commitment = voteRecords.find(r => r.kind === 'squad' && r.targetId === problem.id && r.voterId === req.voterId);
  if (commitment && typeof skill === 'string') commitment.superpower = skill.trim();
  recordVote("problem", problem.id, req.voterId, founderName);
  if (!problem.collaborators.includes(founderName)) {
    problem.collaborators.push(founderName);
  }
  recomputeCounts();
  applySquadStatus(problem);

  const roleText = role || skill ? ` (${role || skill})` : "";
  broadcastStateUpdate("squad_joined", `${founderName}${roleText} joined the action squad for "${problem.title}"`, founderName, problem.category);
  res.json({ success: true, problem, problems, myVotes: myVotesFor(req.voterId) });
});

// Leave a squad. Deliberately an AUDIENCE route (no requireHost): a mis-tap on
// a phone must be undoable by the person who made it.
app.delete("/api/problems/:id/join-squad", (req, res) => {
  const { id } = req.params;
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  // The name to strip comes from the commitment record itself, so it matches
  // whatever the join path stored ("Jos Innovator" here, "Jos Founder" via
  // POST /vote with commit) instead of trusting the client to resend it.
  const committedRecord = voteRecords.find(
    r => r.kind === "squad" && r.targetId === problem.id && r.voterId === req.voterId
  );
  const founderName = committedRecord?.voterName
    || (req.body?.name ? String(req.body.name).trim() : "Jos Innovator");

  if (!retractVote("squad", problem.id, req.voterId)) {
    return res.status(404).json({
      success: false,
      error: "not_committed",
      message: `You are not in the squad for "${problem.title}".`,
      problem,
      problems,
      myVotes: myVotesFor(req.voterId)
    });
  }

  // Joining also casts the implied upvote, so leaving takes it back. Tolerant
  // on purpose: the upvote may already have been withdrawn on its own.
  retractVote("problem", problem.id, req.voterId);

  // Only drop the name if nobody else in this squad is still using it.
  const nameStillInSquad = voteRecords.some(
    r => r.kind === "squad" && r.targetId === problem.id && r.voterName === founderName
  );
  if (!nameStillInSquad) {
    problem.collaborators = problem.collaborators.filter(c => c !== founderName);
  }

  recomputeCounts();
  relaxSquadStatus(problem);

  broadcastStateUpdate("squad_left", `${founderName} left the action squad for "${problem.title}"`, founderName, problem.category);
  res.json({ success: true, problem, problems, myVotes: myVotesFor(req.voterId) });
});

// Add comment to problem
app.post("/api/problems/:id/comments", (req, res) => {
  const { id } = req.params;
  const { author, text } = req.body;
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: "Comment text required" });
  }

  const authorName = author ? author.trim() : "Tin City Founder";
  const comment = {
    id: `c-${Date.now()}`,
    author: authorName,
    text: text.trim(),
    date: "Just now"
  };

  problem.comments.push(comment);
  broadcastStateUpdate("problem_comment", `New insight on "${problem.title}" by ${authorName}`, authorName, problem.category);
  res.json({ success: true, comment, problem, problems });
});

// Gemini AI Action Plan Generator for Plateau Problems
app.post("/api/generate-solution-plan", requireHost, async (req, res) => {
  try {
    const { problemTitle, problemDescription, category } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is not set. Please add it in AI Studio Settings."
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are the Lead Tech Architect and Ecosystem Catalyst for Tin City Founders in Jos, Plateau State, Nigeria.
Analyze this local Plateau Problem and formulate an actionable, high-impact collaboration roadmap for Jos tech founders, agronomists, engineers, and entrepreneurs.

PROBLEM TITLE: "${problemTitle}"
CATEGORY: "${category}"
PROBLEM DESCRIPTION: "${problemDescription}"

Generate a structured JSON response with the following exact keys:
- "summary": A 2-sentence executive summary highlighting why solving this in Jos unlocks immense local economic value.
- "sprintRoadmap": An array of 4 distinct sprint milestones (e.g., Week 1: Ground Validation in Bokkos/Jos South, Week 2: Prototype Architecture & IoT/API Spec, Week 3: Pilot Cohort Deployment, Week 4: Founder Showcase & Pitch to Off-takers/Investors).
- "requiredTechStack": An array of 4-6 recommended tools, frameworks, hardware, or APIs (e.g. React/Node, Solar IoT, Paystack, Open-source GIS).
- "keyPlateauPartners": An array of 3-4 local stakeholders in Plateau State to engage (e.g. University of Jos, PLASU, Potato Farmers Association in Bokkos, Rayfield Tech Hubs, Plateau Ministry of Science & Tech).
- "growthHackTip": One unique local founder insight or creative advantage specific to running this startup out of Jos (e.g. cool climate for servers/agri-produce, cost of living advantage, vibrant developer community).

Return ONLY valid JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "";
    const parsed = JSON.parse(responseText);

    res.json({
      success: true,
      plan: parsed
    });
  } catch (error: any) {
    console.error("Gemini AI plan generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate AI solution roadmap"
    });
  }
});

// -------------------------------------------------------------
// Vite & Static file handling
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Loaded lazily so the production image never needs vite installed at all.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tin City Founders Real-Time Server running at ${APP_URL}`);
  });
}

expireRoundIfNeeded();
expireSpotlightIfNeeded();
setInterval(() => { expireRoundIfNeeded(); expireSpotlightIfNeeded(); }, 1000).unref();
startServer();
