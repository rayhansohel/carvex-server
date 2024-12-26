const express = require('express');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();

// Environment variables
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB URI
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.62t6y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Set up file storage with multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// MongoDB connection setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");

    // MongoDB database and collection
    const db = client.db("carvex");
    const carCollection = db.collection("cars");

    // POST route to add car
    app.post('/cars', upload.array('images', 5), async (req, res) => { // max 5 images
      try {
        const carData = req.body;

        // Collect image file paths
        const imagePaths = req.files.map(file => file.path);

        // Add images and bookingCount (default 0) to carData
        const carWithImages = {
          ...carData,
          images: imagePaths,
          bookingCount: 0,
        };

        // Insert into MongoDB
        await carCollection.insertOne(carWithImages);
        res.status(201).json({ message: 'Car added successfully!' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding car' });
      }
    });

  } finally {
    // Nothing here for now
  }
}
run().catch(console.dir);

// Routes
app.get('/', (req, res) => {
  res.send('Carvex Server is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
