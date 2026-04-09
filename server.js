const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully');
        seedAdmin();
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('Check if your IP is whitelisted in MongoDB Atlas and if the URI is correct.');
    });

// MongoDB Schemas
const LanguageSchema = new mongoose.Schema({
    name: String,
    slug: { type: String, unique: true }
});
const Language = mongoose.model('Language', LanguageSchema);

const TopicSchema = new mongoose.Schema({
    title: String,
    content: String,
    language_id: String, // Changed to String to accommodate MongoDB IDs
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language' },
    created_at: { type: Date, default: Date.now }
});
const Topic = mongoose.model('Topic', TopicSchema);

const AdminSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String
});
const Admin = mongoose.model('Admin', AdminSchema);

// Explicitly seed the requested user into MongoDB
const seedAdmin = async () => {
    try {
        await Admin.findOneAndUpdate(
            { email: 'golupatel23723@gmail.com' },
            { name: 'vishal patel', password: '123456' },
            { upsert: true, returnDocument: 'after' }
        );
        console.log("✅ Admin user verified in MongoDB");
    } catch (err) {
        console.error("Error seeding admin:", err);
    }
};

// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const admin = await Admin.findOne({ email, password });
        if (admin) {
            res.json({ success: true, user: { name: admin.name, email: admin.email } });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
});

// Routes
// Get all languages from MongoDB
app.get('/api/languages', async (req, res) => {
    try {
        const results = await Language.find();
        // Return matching format (using _id as id)
        const formatted = results.map(l => ({ id: l._id, name: l.name, slug: l.slug }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Add a language
app.post('/api/languages', async (req, res) => {
    const { name, slug } = req.body;
    try {
        const newLang = new Language({ name, slug });
        const saved = await newLang.save();
        res.json({ id: saved._id, name, slug });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Delete a language
app.delete('/api/languages/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Topic.deleteMany({ language: id });
        await Language.findByIdAndDelete(id);
        res.json({ message: "Language deleted" });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get topics by language from MongoDB
app.get('/api/topics/:languageId', async (req, res) => {
    try {
        const results = await Topic.find({ language: req.params.languageId });
        const formatted = results.map(t => ({ 
            id: t._id, 
            title: t.title, 
            content: t.content, 
            language_id: t.language,
            created_at: t.created_at 
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get all topics from MongoDB
app.get('/api/topics', async (req, res) => {
    try {
        const results = await Topic.find().populate('language');
        const formatted = results.map(t => ({ 
            id: t._id, 
            title: t.title, 
            content: t.content, 
            language_id: t.language ? t.language._id : null,
            language_name: t.language ? t.language.name : 'Unknown',
            created_at: t.created_at 
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get single topic from MongoDB
app.get('/api/topic/:id', async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        if (!topic) return res.status(404).json({ message: "Topic not found" });
        res.json({ 
            id: topic._id, 
            title: topic.title, 
            content: topic.content, 
            language_id: topic.language,
            created_at: topic.created_at 
        });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Add a topic
app.post('/api/topics', async (req, res) => {
    const { title, content, language_id } = req.body;
    try {
        const newTopic = new Topic({ 
            title, 
            content, 
            language: language_id 
        });
        const saved = await newTopic.save();
        res.json({ id: saved._id, title, content, language_id });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Update a topic
app.put('/api/topics/:id', async (req, res) => {
    const { title, content, language_id } = req.body;
    try {
        await Topic.findByIdAndUpdate(req.params.id, { 
            title, 
            content, 
            language: language_id 
        });
        res.json({ message: "Topic updated" });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Delete a topic
app.delete('/api/topics/:id', async (req, res) => {
    try {
        await Topic.findByIdAndDelete(req.params.id);
        res.json({ message: "Topic deleted" });
    } catch (err) {
        res.status(500).json(err);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
