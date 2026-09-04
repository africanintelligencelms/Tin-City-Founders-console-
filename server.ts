import "dotenv/config";
import express, { Response } from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const app = express();
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
type ServerProblem = (typeof defaultProblems)[number] & { baseUpvotes?: number; baseCommitments?: number };
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
let attendees = SEED_ROOM ? [...defaultAttendees] : ([] as typeof defaultAttendees);
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
type RoundKind = "problem" | "category" | "trustee";
type RoundStatus = "open" | "revealed";

interface RoundOption {
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
// Completed rounds, newest first, capped so the state file stays small.
let roundHistory: VotingRound[] = [];
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
  activeRound?: VotingRound | null;
  updatedAt: number;
}

let roomSessionState: RoomSessionState = {
  activePhase: "voting",
  phaseTitle: "Live Plateau Problem Voting & Squad Formation",
  announcement: null,
  pinnedProblemId: undefined,
  allowAudienceNavigation: true,
  activeRound: null,
  updatedAt: Date.now()
};

// Try reading initial state from file if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.problems && Array.isArray(parsed.problems)) problems = parsed.problems;
    if (parsed.attendees && Array.isArray(parsed.attendees)) attendees = parsed.attendees;
    if (parsed.categoriesStore && typeof parsed.categoriesStore === "object") categoriesStore = parsed.categoriesStore;
    if (parsed.trusteeCandidates && Array.isArray(parsed.trusteeCandidates)) trusteeCandidates = parsed.trusteeCandidates;
    if (parsed.activityLogs && Array.isArray(parsed.activityLogs)) activityLogs = parsed.activityLogs;
    if (parsed.voteRecords && Array.isArray(parsed.voteRecords)) voteRecords = parsed.voteRecords;
    if (parsed.roomSessionState && typeof parsed.roomSessionState === "object") {
      roomSessionState = { ...roomSessionState, ...parsed.roomSessionState };
    }
    if (parsed.roundBallots && Array.isArray(parsed.roundBallots)) roundBallots = parsed.roundBallots;
    if (parsed.roundHistory && Array.isArray(parsed.roundHistory)) roundHistory = parsed.roundHistory;
    if (parsed.activeRound && typeof parsed.activeRound === "object") activeRound = parsed.activeRound;

    // A round that was mid-reveal when the process died must not come back as a
    // reveal. The reveal timer only ever lived in memory, so nothing would ever
    // clear it again and every phone in the room would be pinned to a stale
    // results screen until the host tapped "Back to Room" by hand. The reveal
    // window has almost certainly elapsed during the restart anyway, so the
    // round goes straight into history. Archived inline rather than through
    // archiveActiveRound() because the SSE client set is not constructed yet at
    // this point in module evaluation (and there is nobody connected to tell).
    if (activeRound && activeRound.status === "revealed") {
      const staleId = activeRound.id;
      roundHistory.unshift(activeRound);
      if (roundHistory.length > 20) roundHistory.length = 20;
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
    trusteeCandidates,
    activityLogs,
    voteRecords,
    roomSessionState,
    activeRound,
    roundBallots,
    roundHistory,
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
  const { activePhase, phaseTitle, allowAudienceNavigation, pinnedProblemId } = req.body || {};

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
app.get("/api/admin/trustees", requireHost, (_req, res) => {
  res.json({ success: true, candidates: trusteeCandidates });
});

// ----------------- VOTING ROUND ENDPOINTS -----------------

const ROUND_KINDS: RoundKind[] = ["problem", "category", "trustee"];
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

// Current round plus what this device has already submitted.
app.get("/api/round", (req, res) => {
  res.json({
    success: true,
    round: activeRound,
    myBallot: ballotFor(activeRound?.id ?? null, req.voterId),
    history: roundHistory.slice(0, 10)
  });
});

// Host opens a round. The host picks the ballot type per round.
app.post("/api/round/open", requireHost, (req, res) => {
  const { kind, title, prompt, optionIds, maxSelections } = req.body || {};

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
    openedAt: Date.now()
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

// Host closes the round: tally, reveal, and schedule the return to idle.
app.post("/api/round/close", requireHost, (req, res) => {
  if (!activeRound) {
    return res.status(409).json({ success: false, error: "There is no round to close." });
  }
  if (activeRound.status === "revealed") {
    return res.json({ success: true, round: activeRound });
  }

  activeRound.results = tallyRound(activeRound);
  activeRound.ballotsCast = roundBallots.filter(b => b.roundId === activeRound!.id).length;
  activeRound.status = "revealed";
  activeRound.closedAt = Date.now();

  syncRoundToSession();
  persistState();

  broadcastSSE("ROUND_CLOSED", { round: activeRound });
  broadcastStateUpdate(
    "round_closed",
    `Round closed: "${activeRound.title}" — ${activeRound.ballotsCast} ballot(s) cast`,
    "Host Conductor"
  );

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
  if (roundHistory.length > 20) roundHistory.length = 20;
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
  archiveActiveRound();
  res.json({ success: true, round: null, history: roundHistory.slice(0, 10) });
});

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
  const isNewPerson = !replaced || replaced.id !== candidateId;

  const newCandidate = {
    id: candidateId,
    seatNumber: Number(seatNumber),
    name: name.trim(),
    titleOrOrg: titleOrOrg ? titleOrOrg.trim() : "Tin City Founder",
    bio: bio ? bio.trim() : "",
    phoneOrContact: phoneOrContact ? phoneOrContact.trim() : "",
    scoreR: typeof scoreR === "number" ? Math.min(5, Math.max(1, scoreR)) : 5,
    scoreN: typeof scoreN === "number" ? Math.min(5, Math.max(1, scoreN)) : 5,
    scoreT: typeof scoreT === "number" ? Math.min(5, Math.max(1, scoreT)) : 5,
    reachable: reachable !== undefined ? !!reachable : true,
    confirmed: confirmed !== undefined ? !!confirmed : true,
    camaChecks: camaChecks || {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
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
  res.json({ success: true, candidate, candidates: trusteeCandidates });
});

// ----------------- ATTENDEES ENDPOINTS -----------------

// Get all checked-in attendees
app.get("/api/attendees", (_req, res) => {
  res.json({ success: true, attendees });
});

// Check-in or update attendee profile
app.post(["/api/attendees", "/api/attendees/checkin"], (req, res) => {
  const { id, name, title, tags, bio, giveAsk, location, avatarColor } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Name is required for check-in" });
  }

  const attendeeId = id || `att-${Date.now()}`;
  const existingIndex = attendees.findIndex(a => a.id === attendeeId || a.name.toLowerCase() === name.trim().toLowerCase());

  const newAttendee = {
    id: attendeeId,
    name: name.trim(),
    title: title ? title.trim() : "Tin City Founder",
    tags: Array.isArray(tags) && tags.length > 0 ? tags : ["Founder / CEO"],
    bio: bio ? bio.trim() : "",
    giveAsk: giveAsk ? giveAsk.trim() : "",
    location: location ? location.trim() : "Jos, Plateau State",
    avatarColor: avatarColor || "#0D4734",
    checkedInAt: existingIndex >= 0 ? attendees[existingIndex].checkedInAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    attendees[existingIndex] = newAttendee;
  } else {
    attendees.unshift(newAttendee);
  }

  broadcastStateUpdate("attendee_checkin", `${newAttendee.name} checked in to the meetup`, newAttendee.name);
  res.json({ success: true, attendee: newAttendee, attendees });
});

// Remove attendee
app.delete("/api/attendees/:id", requireHost, (req, res) => {
  const { id } = req.params;
  const removed = attendees.find(a => a.id === id);
  attendees = attendees.filter(a => a.id !== id);
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

  if (!categoriesStore[name]) {
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

  if (!categoriesStore[name]) {
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

  // If category wasn't in store, create it
  if (!categoriesStore[newProb.category]) {
    categoriesStore[newProb.category] = {
      upvotes: 1,
      baseUpvotes: 1,
      description: `Community reported challenges under ${newProb.category}.`,
      iconName: "FolderKanban"
    };
  }
  recomputeCounts();

  broadcastStateUpdate("problem_created", `Submitted new problem: "${newProb.title}"`, authorName, newProb.category);
  res.status(201).json({ success: true, problem: newProb, problems, myVotes: myVotesFor(req.voterId) });
});

// Update a problem's assigned category
app.post("/api/problems/:id/category", (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  const problem = problems.find(p => p.id === id);
  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  if (!category || !category.trim()) {
    return res.status(400).json({ success: false, error: "Category is required" });
  }

  problem.category = category.trim();

  if (!categoriesStore[problem.category]) {
    categoriesStore[problem.category] = {
      upvotes: 1,
      baseUpvotes: 1,
      description: `Community reported challenges under ${problem.category}.`,
      iconName: "FolderKanban"
    };
  }

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

  const founderName = name ? String(name).trim() : "Jos Innovator";

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

startServer();
