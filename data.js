const mongoose = require('mongoose');
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const router = express.Router();

// MongoDB URI
const uri = "mongodb+srv://naveen:naveen1234@mongodb.wypdxsg.mongodb.net/?retryWrites=true&w=majority&appName=Mongodb>";

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

// MongoDB Connection
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB!');
}).catch((err) => {
  console.error('❌ Connection error:', err.message);
});

// Schema + Model
const userSchema = new mongoose.Schema({
  data: String,
  imageurl: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);

// ROUTES
// ROUTES

// Serve form
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "form.html"));
});

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
    res.send(`
      <center>
        <h2>✅ Data Saved!</h2>
        <a href="/view">View All Uploads</a>
      </center>
    `);
  } catch (err) {
    console.error("❌ Save failed:", err.message);
    res.send("Error saving to database");
  }
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
          background-color: #0d6efd;
          color: white;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
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
              <button class="btn btn-primary">Join Now</button>
            </div>
            <div style="font-size: 2rem;">👤➕</div>
          </div>


        <!-- Sidebar -->
        <div class="sidebar">
          <button title="Settings">⚙️</button>
          <button title="Saved">🔖</button>
          <button title="Feed">📄</button>
          <button title="Home">🏠</button>
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
