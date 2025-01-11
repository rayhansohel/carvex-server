// Required modules
const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Validate environment variables
if (!process.env.MONGO_USER || !process.env.MONGO_PASS) {
  throw new Error(
    "Missing required environment variables (MONGO_USER or MONGO_PASS)"
  );
}

// MongoDB URI
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.62t6y.mongodb.net/carvex?retryWrites=true&w=majority`;
// MongoDB connection setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Set up file storage with multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Initialize Database
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    // MongoDB database and collection
    const db = client.db("carvex");
    const carCollection = db.collection("cars");

    // Routes

    // Health Check Route
    app.get("/", (req, res) => {
      res.send("Server is running...");
    });

    // POST: Add a new car
    app.post("/cars", upload.array("images", 5), async (req, res) => {
      try {
        const carData = req.body;
        const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);

        const carWithImages = {
          ...carData,
          images: imagePaths,
          bookingCount: 0,
          createdAt: new Date(),
        };

        await carCollection.insertOne(carWithImages);
        res.status(201).json({ message: "Car added successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error adding car" });
      }
    });

    // GET: Fetch all cars
    app.get("/cars", async (req, res) => {
      try {
        const cars = await carCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).json(cars);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching cars" });
      }
    });

    // GET: Fetch car by ID
    app.get("/cars/:id", async (req, res) => {
      const { id } = req.params;
      try {
        // Corrected to query the carCollection
        const car = await carCollection.findOne({ _id: new ObjectId(id) });
        if (!car) {
          return res.status(404).json({ error: "Car not found" });
        }
        res.status(200).json(car);
      } catch (error) {
        console.error("Failed to fetch car details:", error);
        res.status(500).json({ error: "Failed to fetch car details" });
      }
    });

    // Get cars by User Email
    app.get("/cars/user/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const cars = await carCollection.find({ email }).toArray();
        res.status(200).json(cars);
      } catch (error) {
        console.error("Failed to fetch user's car:", error);
        res.status(500).json({ error: "Failed to fetch cars" });
      }
    });

    // PUT: Update car details
    app.put("/cars/:id", async (req, res) => {
      try {
        const carId = req.params.id;
        const updateData = req.body;

        if (!ObjectId.isValid(carId)) {
          return res.status(400).json({ message: "Invalid Car ID" });
        }

        const result = await carCollection.updateOne(
          { _id: new ObjectId(carId) },
          { $set: updateData }
        );
        if (result.modifiedCount === 0)
          return res
            .status(404)
            .json({ message: "Car not found or no changes made" });

        res.status(200).json({ message: "Car updated successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating car" });
      }
    });

    // DELETE: Remove car by ID
    app.delete("/cars/:id", async (req, res) => {
      try {
        const carId = req.params.id;

        if (!ObjectId.isValid(carId)) {
          return res.status(400).json({ message: "Invalid Car ID" });
        }

        const result = await carCollection.deleteOne({
          _id: new ObjectId(carId),
        });
        if (result.deletedCount === 0)
          return res.status(404).json({ message: "Car not found" });

        res.status(200).json({ message: "Car deleted successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting car" });
      }
    });

    // POST: Book a car (increment booking count)
    app.post("/cars/:id/book", async (req, res) => {
      try {
        const carId = req.params.id;

        if (!ObjectId.isValid(carId)) {
          return res.status(400).json({ message: "Invalid Car ID" });
        }

        const result = await carCollection.updateOne(
          { _id: new ObjectId(carId) },
          { $inc: { bookingCount: 1 } }
        );
        if (result.modifiedCount === 0)
          return res.status(404).json({ message: "Car not found" });

        res.status(200).json({ message: "Car booked successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error booking car" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

// Start Server
(async () => {
  try {
    await run(); // Correct function name here
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
