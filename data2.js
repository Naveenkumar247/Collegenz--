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
const User = mongoose.model("Users", AdminSchema);

// User Schema (common for both normal + Google login)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },

  // For normal login
  password: { type: String }, // bcrypt hash stored

  // For Google login
  googleId: { type: String }, // Google unique user ID
  picture: { type: String },  // Profile picture

  createdAt: { type: Date, default: Date.now }
});

const entry  = mongoose.model("logins", userSchema);



// Verify Google Token and Save User
router.post("/verify-token", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    // Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com", // replace with your client id
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Check if user already exists
    let user = await entry.findOne({ email: payload.email });

    if (!user) {
      // Save new Google user
      user = new entry({
        email: payload.email,
        picture: payload.picture,
        createdAt: new Date(),
      });
      await user.save();
    }

    // Set session or send JWT
    req.session.userEmail = user.email;
    return res.status(200).json({ message: "Login successful", user });

  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid token" });
  }
});





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
  const { email, password } = req.body;
  try {
    const existingUser = await entry.findOne({ email });
    if (existingUser) return res.redirect("/login");

    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new entry({ email, password: hashedPassword });
    await user.save();

    res.redirect("/view");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});


// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await entry.findOne({ email });
    if (!user || !user.password)
      return res.status(400).send("User not found");

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid credentials");

    req.session.userId = user._id;
    req.session.userEmail = user.email;
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
    const users = await User.find().sort({ createdAt: -1 });

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
          background: #f1f1f1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 0;
          position: fixed;
          right: 0;
          top: 70px;
          height: calc(100vh - 70px);
          z-index:1000;

        }
        .sidebar button {
          background: none;
          border: none;
          font-size: 1.5rem;
          margin: 1rem 0;
          cursor: pointer;

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
              <h2>Join with us</h2>
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
      <img src="/uploads/1755615628125-1000094854.png" alt="Icon" width="30" height="30">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616091422-1000094853.jpg" alt="Icon" width="30" height="30">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616247244-1000094855.jpg" alt="Icon" width="30" height="30">
    </a>
    <a href="/upload">
      <img src="/uploads/1755616348668-1000095317.jpg" alt="Icon" width="30" height="30">
    </a>
  </div>
</div>
</main>
</body>
</html>
`;


users.forEach(user => {
  html += `
    <center>
      <!-- Bootstrap CDN for styling -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <strong>${user.userEmail}</strong><br>


      <div class="card mb-3 p-3">
        <img src="/uploads/${user.imageurl}" width="700" class="d-block mx-auto" alt="..." />
      </div>
      <div>
      <p>${user.data}</p>
    </center></div>`;
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
