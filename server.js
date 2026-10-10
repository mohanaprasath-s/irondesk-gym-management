/* ==========================================================================
   IronDesk Gym Management — Backend Server (v2)
   ==========================================================================
   What's new compared to v1:
     • PUT /api/members/:id   -> lets the "Renew" button update a member
     • Your private files (server.js, data.json, package.json...) can no
       longer be downloaded by visitors. Before, express.static(__dirname)
       would have let anyone open /data.json or even /server.js (with the
       admin password inside!) once the app is online.
     • Port and admin password can come from environment variables, so you
       don't have to edit this file when you deploy.

   RUN IT:
     npm install
     node server.js
   Then open  http://localhost:3000/login.html
   ========================================================================== */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

/* --------------------------------------------------------------------------
   MIDDLEWARE
-------------------------------------------------------------------------- */
app.use(cors());
app.use(express.json());

// Block anyone from downloading your source code and data through the browser.
// (Runs BEFORE express.static, so these requests never reach the files.)
const PRIVATE_FILES = ["/server.js", "/data.json", "/package.json", "/package-lock.json", "/readme.md"];
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (PRIVATE_FILES.includes(p) || p.startsWith("/node_modules")) {
    return res.status(404).send("Not found");
  }
  next();
});

// Visiting the bare address (http://localhost:3000/) goes to the login page.
app.get("/", (req, res) => res.redirect("/login.html"));

// Serves login.html and gym-management.html from this folder.
app.use(express.static(__dirname));

/* --------------------------------------------------------------------------
   "DATABASE" — a JSON file on disk
-------------------------------------------------------------------------- */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const starter = {
      members: [],
      trainers: [],
      payments: [],
      nextMemberId: 1,
      nextTrainerId: 1,
      nextPaymentId: 1,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(starter, null, 2));
    return starter;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

/* --------------------------------------------------------------------------
   AUTH
   Change the password WITHOUT editing code by starting the server like:
     Windows cmd:   set ADMIN_PASSWORD=MyStrongPass123 && node server.js
   If you don't set one, it falls back to gym123 (fine for local testing,
   NOT fine once the app is online).
-------------------------------------------------------------------------- */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "gym123";

const sessions = new Set();

function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Not logged in or session expired." });
  }
  next();
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    return res.json({ token: token });
  }

  res.status(401).json({ error: "Wrong username or password." });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const token = req.headers["authorization"].slice(7);
  sessions.delete(token);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   MEMBERS
-------------------------------------------------------------------------- */
app.get("/api/members", requireAuth, (req, res) => {
  res.json(db.members);
});

app.post("/api/members", requireAuth, (req, res) => {
  const { name, phone, plan, expires } = req.body;

  if (!name || !plan || !expires) {
    return res.status(400).json({ error: "Missing name, plan, or expires." });
  }

  const member = { id: db.nextMemberId++, name, phone: phone || "", plan, expires };
  db.members.push(member);
  saveData(db);
  res.status(201).json(member);
});

// NEW: update a member (used by the Renew button to change plan + expiry).
app.put("/api/members/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const member = db.members.find((m) => m.id === id);

  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  // Only copy over the fields that were actually sent.
  const { name, phone, plan, expires } = req.body;
  if (name !== undefined) member.name = name;
  if (phone !== undefined) member.phone = phone;
  if (plan !== undefined) member.plan = plan;
  if (expires !== undefined) member.expires = expires;

  saveData(db);
  res.json(member);
});

app.delete("/api/members/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.members = db.members.filter((m) => m.id !== id);
  saveData(db);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   TRAINERS
-------------------------------------------------------------------------- */
app.get("/api/trainers", requireAuth, (req, res) => {
  res.json(db.trainers);
});

app.post("/api/trainers", requireAuth, (req, res) => {
  const { name, specialty } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Missing name." });
  }

  const trainer = { id: db.nextTrainerId++, name, specialty: specialty || "" };
  db.trainers.push(trainer);
  saveData(db);
  res.status(201).json(trainer);
});

app.delete("/api/trainers/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.trainers = db.trainers.filter((t) => t.id !== id);
  saveData(db);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   PAYMENTS
-------------------------------------------------------------------------- */
app.get("/api/payments", requireAuth, (req, res) => {
  res.json(db.payments);
});

app.post("/api/payments", requireAuth, (req, res) => {
  const { memberId, amount, mode } = req.body;

  if (!memberId || !amount) {
    return res.status(400).json({ error: "Missing memberId or amount." });
  }

  // Use the server's local date (not UTC) so late-night payments get the right day.
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const payment = {
    id: db.nextPaymentId++,
    memberId: Number(memberId),
    amount: Number(amount),
    mode: mode || "Cash",
    date: localDate,
  };
  db.payments.push(payment);
  saveData(db);
  res.status(201).json(payment);
});

/* --------------------------------------------------------------------------
   START THE SERVER
-------------------------------------------------------------------------- */
app.listen(PORT, () => {
  console.log("IronDesk running at http://localhost:" + PORT);
  console.log("Open  http://localhost:" + PORT + "/login.html  in your browser.");
  if (ADMIN_PASSWORD === "gym123") {
    console.log("WARNING: using the default password. Set ADMIN_PASSWORD before going online.");
  }
});
