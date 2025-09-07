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


app.use(express.urlencoded({ extended: true }));


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
   likes: {
    type: Number,
    default: 0
  },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }]
});
const post = mongoose.model("Users", AdminSchema);

// User Schema (common for both normal + Google login)
const userSchema = new mongoose.Schema({

  name: { type: String, required: true },
  age: { type: Number, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // ⚡ hash later with bcrypt
  dream: { type: String, required: true, enum: ["Doctor", "Engineering", "Lawyer", "Entertainment & Arts", "Developer"] },

  // For Google login
  googleId: { type: String }, // Google unique user ID
  picture: { type: String },  // Profile picture
  createdAt: { type: Date, default: Date.now }
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
        const newUser = new User({
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



router.post("/signin", async (req, res) => {
  const { name,age,phone,email, password,dream } = req.body;
  try {
    const existingUser = await genz.findOne({ email });
    if (existingUser) return res.redirect("/login");

    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new genz({ name, age, phone,email, password: hashedPassword, dream});
    await user.save();

    res.redirect("/view");
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

// -------------------------
// Login Route
// -------------------------
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
    const user = await post.find().sort({ createdAt: -1 });
    const login = await Session.findOne().sort({ createdAt: -1 }); // latest login

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CollegeZ</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>

         .sidebar {
           width: 60px;
           background: #f1f1f1;      /* dark like Instagram */
           display: flex;
           flex-direction: column;
           /*justify-content: space-between; /* pushes last button to bottom */
           align-items: center;
           padding: 1rem 0;
           position: fixed;       /* always visible */
           top: 0;
           right: 0;
           gap:2.5rem;
           height: 100vh;         /* full height */
           z-index: 1000;
         }
        header {
          background-color: #228B22;
          color: white;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
       .btnbtn-primary{
          background-color:#228B22;
          color:white;
        }
       .icon{
          margin-top:2050px;
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
              <h2>Hi ${login.name}</h2>
              <p>Represent your college with us</p>
              <button class="btnbtn-primary" href°>Join Now</button>
            </div>
            <div style="font-size: 2rem;">👤➕</div>
          </div>

        <hr>
   
     <!-- Sidebar -->
<div class="sidebar">
  <div class="icon">
    <a href="/upload">
      <img src="/uploads/1755615628125-1000094854.png" alt="Icon" width="50" height="50">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616091422-1000094853.jpg" alt="Icon" width="50" height="50">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616247244-1000094855.jpg" alt="Icon" width="50" height="50">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616348668-1000095317.jpg" alt="Icon" width="50" height="50">
    </a>
  </div>
</div>
</main>
</body>
</html>
`;


user.forEach(user => {
  html += `
    <center><br>
      <!-- Bootstrap CDN for styling -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <strong>${user.userEmail}</strong>


      <div class="card mb-3 p-3">
        <img src="/uploads/${user.imageurl}" width="700" class="d-block mx-auto" alt="..." />
      </div>
      <div>
      <p>${user.data}</p>
    </div>

    <!-- Like & Save buttons -->
<div style="margin-top:10px;">
  <button class="btn btn-success btn-sm">👍 Like</button>
  <button class="btn btn-outline-primary btn-sm">💾 Save</button>
</div></center><br>`;
});

html += "</div>";
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
