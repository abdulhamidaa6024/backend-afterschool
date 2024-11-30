const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');  // Add this import

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static('/images')); 
app.use(express.static(path.join(__dirname, 'images))); 

// Add a route to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rest of your existing code remains the same (MongoDB connection, routes, etc.)
const uri = process.env.MONGODB_URI || "mongodb+srv://naibiabdulhamid:naibi@cluster0.l9uodaf.mongodb.net/afterschool?retryWrites=true&w=majority";
let db;

// ... (rest of the original code)

// Lesson data for reset
const initialLessons = [
    {
        "subject": "Mathematics",
        "location": "Hendon",
        "price": 100,
        "spaces": 5,
        "image": "/images/math.png"
    },
    {
        "subject": "English",
        "location": "Colindale",
        "price": 90,
        "spaces": 5,
        "image": "/images/english.png"
    },
    {
        "subject": "Science",
        "location": "Brent Cross",
        "price": 110,
        "spaces": 5,
        "image": "/images/science.png"
    },
    {
        "subject": "Art",
        "location": "Golders Green",
        "price": 85,
        "spaces": 5,
        "image": "/images/art.png"
    },
    {
        "subject": "Music",
        "location": "Hendon",
        "price": 95,
        "spaces": 5,
        "image": "/images/music.png"
    },
    {
        "subject": "Physical Education",
        "location": "Colindale",
        "price": 80,
        "spaces": 5,
        "image": "/images/pe.png"
    },
    {
        "subject": "Computer Science",
        "location": "Brent Cross",
        "price": 120,
        "spaces": 5,
        "image": "/images/cs.png"
    },
    {
        "subject": "History",
        "location": "Golders Green",
        "price": 88,
        "spaces": 5,
        "image": "/images/history.png"
    },
    {
        "subject": "Geography",
        "location": "Hendon",
        "price": 92,
        "spaces": 5,
        "image": "/images/geography.png"
    },
    {
        "subject": "Drama",
        "location": "Colindale",
        "price": 87,
        "spaces": 5,
        "image": "/images/drama.png"
    }
];

// Connect to MongoDB and reset lessons
async function connectToDB() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db('afterschool');
    console.log('Connected to MongoDB');

    // Reset spaces for lessons
    const resetPromises = initialLessons.map(async lesson => {
        await db.collection('lessons').updateOne(
            { subject: lesson.subject, location: lesson.location }, // Match by unique fields
            { $set: { spaces: lesson.spaces } }, // Reset spaces
            { upsert: true } // Create the document if it doesn't exist
        );
    });

    await Promise.all(resetPromises);
    console.log('Lessons reset to initial spaces');
}

// Middleware to check if the database is connected
function checkDB(req, res, next) {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    next();
}

// Start the server
connectToDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Database connection error:', err);
});

// Routes

// Get all lessons
app.get('/api/lessons', checkDB, async (req, res) => {
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch lessons' });
    }
});

// Search lessons
app.get('/api/search', checkDB, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Search query is required' });

    try {
        const lessons = await db.collection('lessons').find({
            $or: [
                { subject: { $regex: query, $options: 'i' } },
                { location: { $regex: query, $options: 'i' } }
            ]
        }).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: 'Error searching lessons' });
    }
});

// Place an order
app.post('/api/orders', checkDB, async (req, res) => {
    const { name, phone, lessons: lessonIds } = req.body;

    if (!name || !phone || !Array.isArray(lessonIds)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Find lessons in the database
        const lessons = await db.collection('lessons').find({
            _id: { $in: lessonIds.map(id => new ObjectId(id)) }
        }).toArray();

        // Check if any lessons are fully booked
        const isFull = lessons.some(lesson => lesson.spaces <= 0);
        if (isFull) {
            return res.status(400).json({ error: 'Some lessons are fully booked' });
        }

        // Decrement spaces for each lesson
        for (const id of lessonIds) {
            await db.collection('lessons').updateOne(
                { _id: new ObjectId(id) },
                { $inc: { spaces: -1 } }
            );
        }

        // Create the order
        const order = {
            name,
            phone,
            lessonIds,
            orderDate: new Date()
        };
        await db.collection('orders').insertOne(order);

        res.json({ message: 'Order placed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error placing order' });
    }
});

// Update lesson spaces
app.put('/api/lessons/:id', checkDB, async (req, res) => {
    const { id } = req.params;
    const { spaces } = req.body;

    if (!ObjectId.isValid(id) || typeof spaces !== 'number' || spaces < 0) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const result = await db.collection('lessons').updateOne(
            { _id: new ObjectId(id) },
            { $set: { spaces } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: 'Lesson updated' });
    } catch (err) {
        res.status(500).json({ error: 'Error updating lesson' });
    }
});
