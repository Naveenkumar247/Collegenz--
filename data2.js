const bcryptjs = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const multer = require('multer');
const uri = "mongodb+srv://naveen:naveen1234@mongodb.wypdxsg.mongodb.net/?retryWrites=true&w=majority&appName=Mongodb>"
const router = express.Router();

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
  

//UserSchena



// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded images

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

// Schema + Model
const AdminSchema = new mongoose.Schema({
  data: String,
  imageurl: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("Users", AdminSchema);





// POST form handler
router.post("/submit", upload.single("image"), async (req, res) => {
  const { data } = req.body;
  const imageurl = req.file?.filename;

  console.log("📥 Received:", data, imageurl);

  if (!data || !req.file) {
    return res.send("<h3>⚠️ No data received</h3>");
  }

  try {
    const newUser = new User({ data, imageurl });
    await newUser.save();
    res.redirect('/view');
  } catch (err) {
    console.error("❌ Save failed:", err.message);
    res.send("Error saving to database");
  }
});



const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

const entry = mongoose.model("emails", userSchema);

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


// Signup Route
app.post("/signup", async (req, res) => { 
    const { email, password } = req.body;
    try {
        const existingUser = await entry.findOne({ email });
        if (existingUser) {
            return res.redirect("/view");
        }
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
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await entry.findOne({ email });
        if (user && await bcryptjs.compare(password, user.password)) {
            req.session.entry = user;
            res.redirect("/view");
        } else {
            res.send("Invalid credentials");
        }
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

// VIEW all data route
router.get("/view", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    let html =  `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CollegenZ</title>
      <!-- Bootstrap CDN for styling -->
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
              <button class="btnbtn-primary">Join Now</button>
            </div>
            <div style="font-size: 2rem;">👤➕</div>
          </div>


        <!-- Sidebar -->
        <div class="sidebar">
          <button  title="Settings">⚙️</button>
          <button title="Saved">🔖</button>
          <button title="Feed">📄</button>
          <button href="/view" title="Home">🏠</button>
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
          <div class="card mb-3 p-3">
            <img src="/uploads/${user.imageurl}" width="700"class="d-block mx-auto" alt="..." />
          </div>
        </div>

          <p>${user.data}</p>
        </div></center>`;
    });

    html += `</div>`;
    res.send(html);

  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
    res.send("Failed to load data");
  }
});

// Connect the router
app.use("/", router);

// Start the server
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});


