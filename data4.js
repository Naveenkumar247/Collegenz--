const path = require("path");
const multer = require('multer');
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Google client
const client = new OAuth2Client("544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com");

// ✅ ONE unified User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String }, // only for normal signup
  googleId: { type: String }, // only for google login
  name: { type: String },
  picture: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("Users", userSchema);

//
// ---------- GOOGLE LOGIN ----------
//
app.post("/verify-token", async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "544793130820-9r6d2rv2lcrt3sad31mfk1spcp3gdff7.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    // save or update
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = new User({
        email: payload.email,
        googleId: payload.sub,
        name: payload.name,
        picture: payload.picture,
      });
      await user.save();
    }

    req.session.user = { id: user._id, email: user.email };
    return res.redirect("/view");
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid token" });
  }
});



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

//
// ---------- NORMAL SIGNUP ----------
//
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.redirect("/view"); // already registered

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    req.session.user = { id: newUser._id, email: newUser.email };
    res.redirect("/view");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});

//
// ---------- NORMAL LOGIN ----------
//
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("User not found");

    if (!user.password) {
      return res.status(400).send("This account uses Google Sign-In");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid credentials");

    req.session.user = { id: user._id, email: user.email };
    res.redirect("/view");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

//
// ---------- LOGOUT ----------
//
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

//
// ---------- PROTECTED ROUTE EXAMPLE ----------
//
app.get("/view", (req, res) => {
  if (!req.session.user) return res.status(401).send("Please login first");
  res.send(`Welcome ${req.session.user.email}, you are logged in!`);
});

//
// ---------- START SERVER ----------
//
mongoose
  .connect("mongodb+srv://naveen:naveen1234@mongodb.wypdxsg.mongodb.net/?retryWrites=true&w=majority&appName=Mongodb>")
  .then(() => {
    app.listen(3000, () => console.log("Server running on http://localhost:3000"));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
