import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initial default Plateau Problems tailored for Jos & Plateau State context
let problems = [
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

// In-memory store for room attendees / checked-in founders
let attendees: Array<{
  id: string;
  name: string;
  title: string;
  tags: string[];
  bio: string;
  giveAsk: string;
  location: string;
  avatarColor: string;
  checkedInAt: string;
}> = [
  {
    id: "att-1",
    name: "Pamela Dung",
    title: "Founder @ AgriPlateau ColdHubs",
    tags: ["Agro-Tech & Cold Chain", "Hardware & Solar", "Founder / CEO"],
    bio: "Building IoT solar cold-storage containers for Irish potato farmers in Bokkos and Mangu.",
    giveAsk: "Give: IoT firmware / ESP32 architecture help. Ask: Introductions to off-takers and farm cooperatives.",
    location: "Jos South",
    avatarColor: "#10b981",
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
    avatarColor: "#6366f1",
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
    avatarColor: "#f59e0b",
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
    avatarColor: "#ec4899",
    checkedInAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  }
];

// Predefined Categories & Category Priority Voting Store
let categoriesStore: Record<string, { upvotes: number; description: string; iconName: string }> = {
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

// API Routes

// Get all checked-in attendees
app.get("/api/attendees", (_req, res) => {
  res.json({ success: true, attendees });
});

// Check-in or update attendee profile
app.post("/api/attendees", (req, res) => {
  const { id, name, title, tags, bio, giveAsk, location, avatarColor } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Name is required for check-in" });
  }

  const attendeeId = id || `att-${Date.now()}`;
  const existingIndex = attendees.findIndex(a => a.id === attendeeId);

  const newAttendee = {
    id: attendeeId,
    name: name.trim(),
    title: title ? title.trim() : "Tin City Founder",
    tags: Array.isArray(tags) && tags.length > 0 ? tags : ["Founder / CEO"],
    bio: bio ? bio.trim() : "",
    giveAsk: giveAsk ? giveAsk.trim() : "",
    location: location ? location.trim() : "Jos, Plateau State",
    avatarColor: avatarColor || "#6366f1",
    checkedInAt: existingIndex >= 0 ? attendees[existingIndex].checkedInAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    attendees[existingIndex] = newAttendee;
  } else {
    attendees.unshift(newAttendee);
  }

  res.json({ success: true, attendee: newAttendee, attendees });
});

// Remove attendee
app.delete("/api/attendees/:id", (req, res) => {
  const { id } = req.params;
  attendees = attendees.filter(a => a.id !== id);
  res.json({ success: true, attendees });
});

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
app.post("/api/categories/:name/vote", (req, res) => {
  const { name } = req.params;
  const { increment } = req.body; // boolean, true for +1, false for -1
  
  if (!categoriesStore[name]) {
    return res.status(404).json({ success: false, error: "Category not found" });
  }

  const delta = increment === false ? -1 : 1;
  categoriesStore[name].upvotes = Math.max(0, categoriesStore[name].upvotes + delta);

  const updatedCategories = Object.entries(categoriesStore).map(([catName, data]) => ({
    name: catName,
    upvotes: data.upvotes,
    description: data.description,
    iconName: data.iconName,
    problemCount: problems.filter(p => p.category === catName).length
  }));

  res.json({ success: true, categories: updatedCategories });
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

  // If category wasn't in store, ensure it exists
  if (!categoriesStore[problem.category]) {
    categoriesStore[problem.category] = {
      upvotes: 1,
      description: `Community reported challenges under ${problem.category}.`,
      iconName: "FolderKanban"
    };
  }

  res.json({ success: true, problem, problems });
});

// Get all problems
app.get("/api/problems", (_req, res) => {
  res.json({ success: true, problems });
});

// Create new problem
app.post("/api/problems", (req, res) => {
  const { title, description, category, submittedBy, skillsNeeded, autoCommit } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ success: false, error: "Title, description and category are required" });
  }

  const authorName = submittedBy ? submittedBy.trim() : "Anonymous Founder";
  const isCommit = autoCommit === true;

  const newProb = {
    id: `prob-${Date.now()}`,
    title: title.trim(),
    description: description.trim(),
    category: category || "General Plateau Problem",
    submittedBy: authorName,
    upvotes: 1,
    commitments: isCommit ? 1 : 0,
    status: isCommit ? "Squad Forming" : "Ideation",
    collaborators: [authorName],
    skillsNeeded: Array.isArray(skillsNeeded) && skillsNeeded.length > 0 ? skillsNeeded : ["Developers", "Domain Experts"],
    createdAt: new Date().toISOString(),
    comments: []
  };

  problems.unshift(newProb);
  res.status(201).json({ success: true, problem: newProb, problems });
});

// Vote on problem
app.post("/api/problems/:id/vote", (req, res) => {
  const { id } = req.params;
  const { commit, name } = req.body; // commit boolean, optional name
  const problem = problems.find(p => p.id === id);

  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }

  problem.upvotes += 1;
  if (commit) {
    problem.commitments += 1;
    if (name && !problem.collaborators.includes(name)) {
      problem.collaborators.push(name);
    }
  }

  res.json({ success: true, problem, problems });
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

  const comment = {
    id: `c-${Date.now()}`,
    author: author ? author.trim() : "Tin City Founder",
    text: text.trim(),
    date: "Just now"
  };

  problem.comments.push(comment);
  res.json({ success: true, comment, problem, problems });
});

// Gemini AI Action Plan Generator for Plateau Problems
app.post("/api/generate-solution-plan", async (req, res) => {
  try {
    const { problemTitle, problemDescription, category } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is not set. Please add it in AI Studio Secrets."
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

// Vite & Static file handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Tin City Founders Dashboard Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
