const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const User = require("./models/User");
require("dotenv").config(); // Load environment variables

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
})
   .then(() => console.log("MongoDB connected"))
   .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.post("/signup", async (req, res) => {
   const { username, email, password } = req.body;
   const userExists = await User.findOne({ email });

   if (userExists) {
      return res.status(400).json({ message: "User already exists" });
   }

   const newUser = new User({ username, email, password, stories: [] });
   await newUser.save();
   res.status(201).json({ message: "User created successfully" });
});

app.post("/login", async (req, res) => {
   const { email, password } = req.body;
   const user = await User.findOne({ email, password });

   if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
   }

   res.status(200).json({ message: "Login successful", user });
});

// Save Story Route (With Title and Content)
app.post('/save-story', async (req, res) => {
    const { email, title, content } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const existingStory = user.stories.find(story => story.title === title);
        if (existingStory) {
            return res.status(400).json({ message: "Story with this title already exists." });
        }

        user.stories.push({ title, content });
        await user.save();
        res.status(200).json({ message: "Story saved successfully!" });
    } catch (error) {
        console.error("Error saving story:", error);
        res.status(500).json({ message: "Failed to save story." });
    }
});

app.get("/get-stories", async (req, res) => {
    const { email } = req.query;
    const user = await User.findOne({ email });

    if (user) {
        res.status(200).json({ stories: user.stories });
    } else {
        res.status(404).json({ message: "User not found" });
    }
});

// Check if Story Exists Route
app.get('/check-story-existence', async (req, res) => {
    const { email, title } = req.query;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storyExists = user.stories.some(story => story.title === title);
        res.json({ exists: storyExists });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error checking story existence' });
    }
});

// Delete Story Route
app.delete('/delete-story', async (req, res) => {
    const { email, title, content } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { email },
            { $pull: { stories: { title, content } } }
        );
        if (user) {
            res.status(200).json({ message: "Story deleted successfully." });
        } else {
            res.status(404).json({ message: "Story not found." });
        }
    } catch (error) {
        console.error("Error deleting story:", error);
        res.status(500).json({ message: "Failed to delete story." });
    }
});

// Image Generation Route
app.post("/generate-image", async (req, res) => {
   const description = req.body.description;

   let browser;
   try {
       browser = await puppeteer.launch({
           executablePath: '/opt/render/.cache/puppeteer/chrome/linux-130.0.6723.116/chrome-linux64/chrome',
           headless: true,
           defaultViewport: null,
           args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--remote-debugging-port=9222',
            '--disable-software-rasterizer'
          ],
       });

       const page = await browser.newPage();
       await page.goto("https://deepai.org/machine-learning-model/text2img", {
           waitUntil: "networkidle2",
           timeout: 60000,
       });

       await page.waitForSelector("textarea", { timeout: 60000 });
       await page.type("textarea", description, { delay: 0 });

       await page.click("#modelSubmitButton");

       await page.waitForFunction(
           () => {
               const imgElement = document.querySelector(".try-it-result-area img");
               return imgElement && imgElement.src !== "https://images.deepai.org/machine-learning-models/337e9a4fd9ff4552ae72c4943aea2b7a/image-gen-loading.svg";
           },
           { timeout: 180000 }
       );

       const content = await page.content();
       const $ = cheerio.load(content);
       const imageUrl = $(".try-it-result-area img").attr("src");

       if (imageUrl && imageUrl !== "https://images.deepai.org/machine-learning-models/337e9a4fd9ff4552ae72c4943aea2b7a/image-gen-loading.svg") {
           res.json({ imageUrl });
       } else {
           res.status(404).send("Image not found or took too long to generate. Please try again.");
       }
   } catch (error) {
       console.error("Error during image generation:", error);
       res.status(500).send("Image generation failed");
   } finally {
       if (browser) {
           await browser.close();
       }
   }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
