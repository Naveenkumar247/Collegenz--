const bcrypt = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");

const app = express();
const router = express.Router();
const client = new OAuth2Client("544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
}));

// MongoDB Connection
mongoose.connect("mongodb+srv://naveen:naveen1234@mongodb.wypdxsg.mongodb.net/?retryWrites=true&w=majority&appName=Mongodb>", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ Connection error:", err.message));

// File upload setup using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ✅ Unified User Schema (signup + google login)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },

  // for manual signup
  password: { type: String },

  // for google login
  googleId: { type: String },
  name: { type: String },
  picture: { type: String },

  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

// ✅ Verify Google token and save user
app.post("/verify-token", async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com"
    });

    const payload = ticket.getPayload();

    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = new User({
        googleId: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      });
      await user.save();
    }

    req.session.userEmail = user.email;
    res.json({ message: "Login successful", user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ POST form handler (upload)
router.post("/submit", upload.single("imageurl"), async (req, res) => {
  const { data } = req.body;
  const imagepath = req.file ? req.file.filename : null;
  const userEmail = req.session.userEmail; // from login

  if (!data || !userEmail) {
    return res.send("<h3>No data received</h3>");
  }

  try {
    const newUser = new User({
      email: userEmail,
      name: data, // store form data as "name"
      picture: imagepath
    });

    await newUser.save();
    res.redirect("/view");
  } catch (err) {
    console.error("❌ Save failed:", err.message);
    res.send("Error saving to database");
  }
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "sign.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/form", (req, res) => {
  res.sendFile(path.join(__dirname, "form.html"));
});
app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "upload.html"));
});

// ✅ Signup Route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send("Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.send("Signup successful");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send("Invalid credentials");

    req.session.userEmail = user.email;
    res.send("Login successful");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

// ✅ Protected Route
app.get("/dashboard", (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).send("Unauthorized. Please log in.");
  }
  res.send(`Welcome ${req.session.userEmail}`);
});

// ✅ Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.send("Logged out");
  });
});

// ✅ View all data route
router.get("/view", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>User List</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="p-4">
        <h2>User List</h2>
        <ul class="list-group">
    `;
    users.forEach(u => {
      html += `<li class="list-group-item">${u.email} - ${u.name || "No name"} </li>`;
    });
    html += `
        </ul>
      </body>
      </html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Error fetching users");
  }
});

app.use("/", router);

// Start server
app.listen(3000, () => console.log("🚀 Server running on port 3000"));
