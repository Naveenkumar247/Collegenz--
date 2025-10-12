const bcryptjs = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const multer = require('multer');
const uri = "mongodb+srv://naveen:naveen1234@mongodb.wypdxsg.mongodb.net/?retryWrites=true&w=majority&appName=Mongodb>"
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client("544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com");
const app = express();
const cron = require("node-cron");
const nodemailer = require("nodemailer");

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
}));


// MongoDB Connection
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB!');
}).catch((err) => {
  console.error('❌ Connection error:', err.message);
});

  
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded images
app.use('/view', express.static('assets'));



// File upload setup using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });


// Post Schema
const AdminSchema = new mongoose.Schema({
  data: String,
  imageurl: String,
  createdAt: { type: Date, default: Date.now },
  event_date: { type: Date },
  userEmail:{ type: String},
  // Likes
  likes: { type: Number, default: 0 },
  likedBy: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  default: [],
  set: arr => [...new Set(arr.map(id => id.toString()))]  // enforce unique
},

  saves: { type: Number, default: 0 }, 
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "logins"}]
});
const Post = mongoose.model("Users", AdminSchema);


const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  dream: { type: String, required: true, enum: ["Doctor", "Engineering", "Lawyer", "Entertainment & Arts", "Developer"] },

  // For Google login
  googleId: { type: String },
  picture: { type: String },
  createdAt: { type: Date, default: Date.now },

  // ⭐ Saved posts
  savedPosts: [
    {
      postId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
      data: String,
      imageurl: String,
      event_date: Date,
      createdAt: Date,
      userEmail: String
    }
  ]
});

const genz  = mongoose.model("logins", userSchema);

// POST form handler
router.post('/submit', upload.single("imageurl"), async (req, res) => {
    const { data, event_date } = req.body;
    const imageurl = req.file ? req.file.filename : null;
    const userEmail = req.session.userEmail;  // ✅ comes automatically from login

    if (!data || !userEmail) {
        return res.send("<h3>No data received</h3>");
    }

    try {
        const newUser = new Post({
            data,
            imageurl,
            event_date,
            userEmail   // ✅ saved automatically
        });

        await newUser.save();
        res.redirect('/view');
    } catch (err) {
        console.error("✘ Save failed:", err.message);
        res.send("Error saving to database");
    }
});



// Routes


app.get("/",(req,res) => {
    res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/signin", (req, res) => {
    res.sendFile(path.join(__dirname, "sign.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/submit",(req,res) => {
    res.sendFile(path.join(__dirname, "form.html"));
});
app.get("/upload",(req,res) => {
    res.sendFile(path.join(__dirname, "upload.html"));
});
app.get("/calender",(req,res) => {
    res.sendFile(path.join(__dirname, "calender.html"));
});
app.get("/roadmap",(req,res) => {
    res.sendFile(path.join(__dirname, "roadmap.html"));
});
app.get("/profile",(req,res) => {
    res.sendFile(path.join(__dirname, "profile.html"));
});
app.get("/sitemap.xml",(req,res) => {
    res.sendFile(path.join(__dirname, "sitemap.xml"));
});
app.get("/robots.txt",(req,res) => {
    res.sendFile(path.join(__dirname, "robots.txt"));
});


router.post("/signin", async (req, res) => {
  const { name,age,phone,email, password,dream } = req.body;
  try {
    const existingUser = await genz.findOne({ email });
    if (existingUser) return res.redirect("/login");

    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new genz({ name, age, phone,email, password: hashedPassword, dream});
    await user.save();

    res.redirect("/signin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});

	
// Session Schema
const SessionSchema = new mongoose.Schema({
  name:{type: String, required:true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "genz", required: true }, // adjust model name if different
  email: { type: String, required: true },
  sessionId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

const Session = mongoose.model("Session", SessionSchema);

router.post("/save/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userId; // must be set at login

    console.log("👉 Save attempt:", { postId, userId });

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in first." });
    }

    // Find the post
    const foundPost = await Post.findById(postId);
    if (!foundPost) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    // Find the user
    const user = await genz.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prevent duplicates
    const alreadySaved = user.savedPosts.some(
      (p) => p.postId.toString() === foundPost._id.toString()
    );
    if (alreadySaved) {
      return res.json({ success: false, message: "Already saved." });
    }

    // Add new saved post
    user.savedPosts.push({
      postId: foundPost._id,
      data: foundPost.data,
      imageurl: foundPost.imageurl,
      event_date: foundPost.event_date,
      createdAt: foundPost.createdAt,
      userEmail: foundPost.userEmail
    });

    await user.save();

    console.log("✅ Post saved for user:", user.email, user.savedPosts);

    res.json({ success: true, message: "Post saved successfully!" });
  } catch (err) {
    console.error("❌ Save failed:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
  });

app.use(session({
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // must be false for localhost
    httpOnly: true,
    sameSite: "lax"
  }
}));

app.post("/posts/:id/like", async (req, res) => {
  try {
    const userId = req.body.userId; 
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    console.log("Like request => userId:", userId, "postId:", postId);
    console.log("Current likes before action:", post.likes);

    const alreadyLiked = post.likedBy.includes(userId);

    if (alreadyLiked) {
      post.likedBy.pull(userId);
      post.likes = post.likes - 1;
      console.log("User unliked. Updated likes:", post.likes);
    } else {
      post.likedBy.push(userId);
      post.likes = post.likes + 1;
      console.log("User liked. Updated likes:", post.likes);
    }

    await post.save();
    console.log("Likes after save:", post.likes);

    res.json({ likes: post.likes, liked: !alreadyLiked });
  } catch (err) {
    console.error("Like error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/:id/save", async (req, res) => {
  try {
    const userId = req.body.userId;
    const postId = req.params.id;

    const user = await genz.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    console.log("Save request => userId:", userId, "postId:", postId);
    console.log("Current saves before action:", post.saves);

    // Ensure arrays exist
    if (!Array.isArray(user.savedPosts)) user.savedPosts = [];
    if (!Array.isArray(post.savedBy)) post.savedBy = [];

    // Check if already saved
    const alreadySaved = post.savedBy.some(id => id.toString() === userId);

    if (alreadySaved) {
      // --- UNSAVE ---
      post.savedBy = post.savedBy.filter(id => id.toString() !== userId);
      post.saves = Math.max(0, post.saves - 1);

      user.savedPosts = user.savedPosts.filter(sp => sp.postId.toString() !== postId);
      console.log("User unsaved post. Updated saves:", post.saves);
    } else {
      // --- SAVE ---
      post.savedBy.push(userId);
      post.saves = post.saves + 1;

      user.savedPosts.push({
        postId,
        data: post.data,
        imageurl: post.imageurl,
        event_date: post.event_date,
        createdAt: post.createdAt,
        userEmail: post.userEmail
      });

      console.log("User saved post. Updated saves:", post.saves);
    }

    // Ensure Mongoose knows subdocument changed
    user.markModified("savedPosts");

    // Save both
    await user.save();
    await post.save();

    console.log("Saves after save:", post.saves);
    res.json({ saves: post.saves, saved: !alreadySaved });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Email Transporter (Use Gmail App Password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourgmail@gmail.com", // 🔹 replace with your Gmail
    pass: "your-app-password",   // 🔹 use App Password (not normal password)
  },
});

// 🕒 Run every day at 9:00 AM
cron.schedule("0 9 * * *", async () => {
  console.log("🔍 Checking for next-day event reminders...");

  try {
    // Find all users that have savedPosts with event_date
    const users = await genz.find({ "savedPosts.event_date": { $exists: true } });

    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = new Date(tomorrow.setHours(0, 0, 0, 0));
    const end = new Date(tomorrow.setHours(23, 59, 59, 999));

    for (const user of users) {
      for (const post of user.savedPosts) {
        if (post.event_date && post.event_date >= start && post.event_date <= end) {
          // Compose email
          const mailOptions = {
            from: "yourgmail@gmail.com",
            to: user.email,
            subject: `Reminder: "${post.data}" is happening tomorrow!`,
            text: `Hey ${user.name}, this is a friendly reminder that your saved event "${post.data}" is scheduled for tomorrow (${new Date(post.event_date).toDateString()}).`,
          };

          try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Reminder sent to ${user.email} for "${post.data}"`);
          } catch (err) {
            console.error("❌ Failed to send reminder:", err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Reminder cron job failed:", err.message);
  }
});

router.get("/roadmap", (req, res) => {
  // get input from query string ?path=frontend
  const roadmap = req.query.path || "frontend"; // default frontend
  res.render("roadmap", { roadmap });
});


router.get("/api/events", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json([]);

    const user = await genz.findById(userId);

    // Convert savedPosts → FullCalendar events
    const events = user.savedPosts
  .filter(p => p.event_date)
  .map(p => ({
    title: p.data,
    start: p.event_date.toISOString().split("T")[0], // only date part
    allDay: true,                                   // no time shown
    color: "#228B22",
    url: "/view"
  }));

    res.json(events);
  } catch (err) {
    console.error("❌ API events fetch failed:", err.message);
    res.status(500).json([]);
  }
});

router.get("/calender", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await genz.findById(userId).populate("savedPosts.postId");

    res.render("calender", { user }); // pass user with savedPosts
  } catch (err) {
    console.error("❌ Calendar fetch failed:", err.message);
    res.status(500).send("Server error");
  }
});
// -------------------------
// Login Route// -------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await genz.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).send("User not found");
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send("Invalid credentials");
    }

    // Save user info in express-session
    req.session.userId = user._id;
    req.session.userEmail = user.email;
    req.session.username = user.name
    // Save session info in MongoDB
    const newSession = new Session({
      name:user.name,
      userId: user._id,
      email: user.email,
      sessionId: req.sessionID, // provided by express-session
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) // 1 day
    });

    await newSession.save();

    res.redirect("/view");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

// Protected Route
app.get("/dashboard", (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized. Please log in.");
    }
    res.send(`Welcome ${req.session.user.email}`);
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.send("Logged out");
    });
});

// VIEW: all data route
router.get("/view", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    const login = await Session.findOne().sort({ createdAt: -1 }); // latest login

    let html = `

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CollegeZ</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .sidebar {
      width: 60px;
      background: #f1f1f1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem 0;
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      z-index: 1000;
    }
    .sidebar .icon {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    header {
      background-color: #228B22;
      color: white;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btnbtn-primary {
      background-color:#228B22;
      color:white;
    }
    .icon {
      font-size: 1.8rem;
      color: white;
      margin: 1rem 0;
    }
  </style>
</head>

<body>
  <header>
    <h1 class="m-0">CollegenZ</h1>
    <input type="text" class="form-control w-25" placeholder="Search...">
  </header>

  <main class="d-flex" style="margin-top: 50px;">
    <div class="container me-auto">
      <!-- Join With Us Section -->
      <div class="card mb-4 p-3 d-flex flex-row justify-content-between align-items-center">
        <div>
          <h2>Hi ${login ? login.name : "Guest"}</h2>
          <p>Represent your college with us</p>
          <button class="btn btn-primary">Join Now</button>
        </div>
        <div style="font-size: 2rem;">👤➕</div>
      </div>

      <hr>`;

posts.forEach(p => {
  html += `
    <div class="card mb-3 p-3 text-center" style="max-width: 700px; margin: 20px auto;">
      <strong>${p.userEmail}</strong>

      <div class="my-3">
        <img src="/uploads/${p.imageurl}" class="img-fluid" alt="Post image" />
      </div>

      <p>${p.data}</p>

      <!-- Like & Save buttons with counts -->
      <div class="mt-3 d-flex justify-content-center align-items-center gap-4">
        <!-- Like -->
        <button class="btn btn-link btn-sm like-btn" data-id="${p._id}" style="color: gray; font-size: 1.2rem;">
          <i class="bi bi-heart"></i>
        </button>
        <span class="like-count" id="like-count-${p._id}">${p.likes || 0}</span>

        <!-- Save -->
        <button class="btn btn-link btn-sm save-btn" data-id="${p._id}" style="color: gray; font-size: 1.2rem;">
          <i class="bi bi-bookmark"></i>
        </button>
        <span class="save-count" id="save-count-${p._id}">${p.saves || 0}</span>
      </div>
    </div>
  `;
});

// Sidebar + scripts
html += `
    </div>
  </main>

  <!-- Sidebar -->
  <div class="sidebar">
    <div class="icon">
      <a href="/view">
        <img src="/uploads/1755615628125-1000094854.png" alt="Icon" width="50" height="50">
      </a>
      <a href="/roadmap">
        <img src="/uploads/1755616091422-1000094853.jpg" alt="Icon" width="50" height="50">
      </a>
      <a href="/upload">
        <img src="/uploads/1755616247244-1000094855.jpg" alt="Icon" width="50" height="50">
      </a>
      <a href="/calender">
        <img src="/uploads/1755616348668-1000095317.jpg" alt="Icon" width="50" height="50">
      </a>
    </div>
  </div>

  <script>

         document.querySelectorAll(".save-btn").forEach(button => {
          button.addEventListener("click", async () => {
            const postId = button.getAttribute("data-id");
            try {
              const res = await fetch("/save/" + postId, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
              });
              const data = await res.json();
              alert(data.message || "Post saved!");
            } catch (err) {
              console.error("Error saving post:", err);
            }
          });
        });
    const currentUserId = "${login ? login._id : ""}"; // 👈 inject logged-in userId here

    document.addEventListener("click", async function(e) {
      // Like button
      if (e.target.closest(".like-btn")) {
        const btn = e.target.closest(".like-btn");
        const postId = btn.getAttribute("data-id");
        const icon = btn.querySelector("i");
        const countEl = document.getElementById("like-count-" + postId);

        const res = await fetch("/posts/" + postId + "/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await res.json();

        if (data.liked) {
          icon.classList.replace("bi-heart", "bi-heart-fill");
          icon.style.color = "#228B22";
        } else {
          icon.classList.replace("bi-heart-fill", "bi-heart");
          icon.style.color = "gray";
        }
        countEl.textContent = data.likes;
      }

      // Save button
if (e.target.closest(".save-btn")) {
  const btn = e.target.closest(".save-btn");
  const postId = btn.getAttribute("data-id");
  const icon = btn.querySelector("i");
  const countEl = document.getElementById("save-count-" + postId);

  const res = await fetch("/save/" + postId, { // ✅ fixed route here
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: currentUserId })
  });

  const data = await res.json();

  if (data.saved) {  // or data.success if backend sends that
    icon.classList.replace("bi-bookmark", "bi-bookmark-fill");
    icon.style.color = "#228B22";
  } else {
    icon.classList.replace("bi-bookmark-fill", "bi-bookmark");
    icon.style.color = "gray";
  }

  if (data.saves !== undefined) {
    countEl.textContent = data.saves;
  }
}
    });
  </script>
</body>
</html>`;


/*<body>
  <header>
    <h1 class="m-0">CollegenZ</h1>
    <input type="text" class="form-control w-25" placeholder="Search...">
  </header>

  <main class="d-flex" style="margin-top: 50px;">
    <div class="container me-auto">
      <!-- Join With Us Section -->
      <div class="card mb-4 p-3 d-flex flex-row justify-content-between align-items-center">
        <div>
          <h2>Hi ${login ? login.name : "Guest"}</h2>
          <p>Represent your college with us</p>
          <button class="btnbtn-primary">Join Now</button>
        </div>
        <div style="font-size: 2rem;">👤➕</div>
      </div>

      <hr>`;

posts.forEach(p => {
  html += `
    <div class="card mb-3 p-3 text-center" style="max-width: 700px; margin: 20px auto;">
      <strong>${p.userEmail}</strong>

      <div class="my-3">
        <img src="/uploads/${p.imageurl}" class="img-fluid" alt="Post image" />
      </div>

      <p>${p.data}</p>

      <!-- Like & Save buttons with counts -->
      <div class="mt-3 d-flex justify-content-center align-items-center gap-4">
        <!-- Like -->
        <button class="btn btn-link btn-sm like-btn" data-id="${p._id}" style="color: gray; font-size: 1.2rem;">
          <i class="bi bi-heart"></i>
        </button>
        <span class="like-count" id="like-count-${p._id}">${p.likes || 0}</span>

        <!-- Save -->
        <button class="btn btn-link btn-sm save-btn" data-id="${p._id}" style="color: gray; font-size: 1.2rem;">
          <i class="bi bi-bookmark"></i>
        </button>
        <span class="save-count" id="save-count-${p._id}">${p.totalSaved || 0}</span>
      </div>
    </div>
  `;
});

// Sidebar + scripts
html += `
    </div>
  </main>

  <!-- Sidebar -->
  <div class="sidebar">
    <div class="icon">
      <a href="/view">
        <img src="/uploads/1755615628125-1000094854.png" alt="Icon" width="50" height="50">
      </a>
      <a href="/roadmap">
        <img src="/uploads/1755616091422-1000094853.jpg" alt="Icon" width="50" height="50">
      </a>
      <a href="/upload">
        <img src="/uploads/1755616247244-1000094855.jpg" alt="Icon" width="50" height="50">
      </a>
      <a href="/calender">
        <img src="/uploads/1755616348668-1000095317.jpg" alt="Icon" width="50" height="50">
      </a>
    </div>
  </div>

  <script>
    const currentUserId = "${login ? login._id : ""}"; // 👈 inject logged-in userId here

    document.addEventListener("click", async function(e) {
      // Like button
      if (e.target.closest(".like-btn")) {
        const btn = e.target.closest(".like-btn");
        const postId = btn.getAttribute("data-id");
        const icon = btn.querySelector("i");
        const countEl = document.getElementById("like-count-" + postId);

        const res = await fetch("/posts/" + postId + "/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await res.json();

        if (data.liked) {
          icon.classList.replace("bi-heart", "bi-heart-fill");
          icon.style.color = "#228B22";
        } else {
          icon.classList.replace("bi-heart-fill", "bi-heart");
          icon.style.color = "gray";
        }
        countEl.textContent = data.likes;
      }

      // Save button
      if (e.target.closest(".save-btn")) {
        const btn = e.target.closest(".save-btn");
        const postId = btn.getAttribute("data-id");
        const icon = btn.querySelector("i");
        const countEl = document.getElementById("save-count-" + postId);

        const res = await fetch("/posts/" + postId + "/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await res.json();

        if (data.saved) {
          icon.classList.replace("bi-bookmark", "bi-bookmark-fill");
          icon.style.color = "#228B22";
        } else {
          icon.classList.replace("bi-bookmark-fill", "bi-bookmark");
          icon.style.color = "gray";
        }

        countEl.textContent = data.totalSaved;
      }
    });
  </script>
</body>
</html>`;



   <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CollegeZ</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        

        .sidebar {
         width: 60px;
         background: #f1f1f1;
         display: flex;
         flex-direction: column;
         align-items: center;
         padding: 1rem 0;
         position: fixed;
         top: 0;
         right: 0;
         height: 100vh;
         z-index: 1000;
         }

       .sidebar .icon {
         margin-top: auto; // pushes icons to bottom 
         display: flex;
         flex-direction: column;
         gap: 1rem;
        }      
        header {
          background-color: #228B22;
          color: white;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btnbtn-primary {
          background-color:#228B22;
          color:white;
        }
        .icon {
          font-size: 1.8rem;
          color: white;
          margin: 1rem 0;
        }
      </style>
    </head>
    <body>
      <header>
        <h1 class="m-0">CollegenZ</h1>
        <input type="text" class="form-control w-25" placeholder="Search...">
      </header>

      <main class="d-flex" style="margin-top: 50px;">
        <div class="container me-auto">
          <!-- Join With Us Section -->
          <div class="card mb-4 p-3 d-flex flex-row justify-content-between align-items-center">
            <div>
              <h2>Hi ${login ? login.name : "Guest"}</h2>
              <p>Represent your college with us</p>
              <button class="btnbtn-primary">Join Now</button>
            </div>
            <div style="font-size: 2rem;">👤➕</div>
          </div>

          <hr>
    `;


      posts.forEach(p => {
      html += `
    <div class="card mb-3 p-3 text-center" style="max-width: 700px; margin: 20px auto;">
      <strong>${p.userEmail}</strong>
      
      <div class="my-3">
        <img src="/uploads/${p.imageurl}" class="img-fluid" alt="Post image" />
      </div>
      
      <p>${p.data}</p>
      
      <!-- Like & Save buttons -->
      <div class="mt-3">
        <button class="btn btn-success btn-sm me-2">Like</button>
        <button class="btn btn-outline-primary btn-sm save-btn" data-id="${p._id}">Save</button>
      </div>
    </div>
  `;
});

    // Sidebar + script
    html += `
        </div>
      </main>

      <!-- Sidebar -->
      <div class="sidebar">
        <div class="icon">
          <a href="/view">
            <img src="/uploads/1755615628125-1000094854.png" alt="Icon" width="50" height="50">
          </a>
          <a href="/roadmap">
            <img src="/uploads/1755616091422-1000094853.jpg" alt="Icon" width="50" height="50">
          </a>
          <a href="/upload">
            <img src="/uploads/1755616247244-1000094855.jpg" alt="Icon" width="50" height="50">
          </a>
          <a href="/calender">
            <img src="/uploads/1755616348668-1000095317.jpg" alt="Icon" width="50" height="50">
          </a>
        </div>
      </div>

      <script>
        document.querySelectorAll(".save-btn").forEach(button => {
          button.addEventListener("click", async () => {
            const postId = button.getAttribute("data-id");
            try {
              const res = await fetch("/save/" + postId, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
              });
              const data = await res.json();
              alert(data.message || "Post saved!");
            } catch (err) {
              console.error("Error saving post:", err);
            }
          });
        });
      </script>
    </body>
    </html>*/
    

    res.send(html);
  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
    res.status(500).send("Failed to load data");
  }
});


// Connect the router
app.use("/", router);

// Start the server
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
