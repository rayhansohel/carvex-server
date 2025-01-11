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

    // MongoDB database and collections
    const db = client.db("carvex");
    const carCollection = db.collection("cars");
    const bookingCollection = db.collection("bookings");

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

    // POST: Book a car (create booking)
    app.post("/bookings", async (req, res) => {
      try {
        const { userEmail, carId, startDate, endDate } = req.body;

        // Validate carId and dates
        if (!ObjectId.isValid(carId)) {
          return res.status(400).json({ message: "Invalid Car ID" });
        }

        const car = await carCollection.findOne({ _id: new ObjectId(carId) });
        if (!car) {
          return res.status(404).json({ message: "Car not found" });
        }

        // Calculate the total price
        const daysBooked =
          (new Date(endDate) - new Date(startDate)) / (1000 * 3600 * 24);
        const totalPrice = car.dailyRentalPrice * daysBooked;

        // Create a booking
        const booking = {
          userEmail,
          carId,
          carModel: car.carModel,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          bookingStatus: "Pending", // Status can be Pending, Confirmed, etc.
          totalPrice,
        };

        // Store booking in database
        await bookingCollection.insertOne(booking);

        // Increment booking count for the car
        await carCollection.updateOne(
          { _id: new ObjectId(carId) },
          { $inc: { bookingCount: 1 } }
        );

        res.status(201).json({ message: "Car booked successfully!", booking });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error booking car" });
      }
    });

    // GET: Get all bookings for a user
    app.get("/bookings/user/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const bookings = await bookingCollection
          .find({ userEmail: email })
          .toArray();
        res.status(200).json(bookings);
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        res.status(500).json({ message: "Failed to fetch bookings" });
      }
    });

    // PUT: Update booking status (e.g., Confirmed or Cancelled)
    app.put("/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Booking ID" });
        }

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { bookingStatus: status } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Booking not found or no changes made" });
        }

        res.status(200).json({ message: "Booking updated successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating booking" });
      }
    });

    // DELETE: Delete a booking
    // DELETE: Delete a booking by ID
    app.delete("/bookings/:id", async (req, res) => {
      const { id } = req.params;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Booking ID" });
        }

        const result = await bookingCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }

        // Decrease the booking count for the associated car
        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });
        if (booking) {
          await carCollection.updateOne(
            { _id: new ObjectId(booking.carId) },
            { $inc: { bookingCount: -1 } }
          );
        }

        res.status(200).json({ message: "Booking deleted successfully" });
      } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Failed to delete booking" });
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
