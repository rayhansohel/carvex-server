const express = require('express');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const app = express();

// Environment variables
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB URI
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.62t6y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    app.post('/add-car', async (req, res) => {
      try {
        const carData = req.body;
        await carCollection.insertOne(carData);
        res.status(201).json({ message: 'Car added successfully!' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding car' });
      }
    });

  } finally {
  
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


