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
    title: { type: String, required: true },
    content: { type: String, default: "" },
    language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', default: null },
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
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

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
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: "Internal server error during login" });
    }
});

// Routes
// Get all languages from MongoDB
app.get('/api/languages', async (req, res) => {
    try {
        const results = await Language.find().sort({ name: 1 });
        const formatted = results.map(l => ({ id: l._id, name: l.name, slug: l.slug }));
        res.json(formatted);
    } catch (err) {
        console.error('Error fetching languages:', err);
        res.status(500).json({ success: false, message: "Failed to fetch languages" });
    }
});

// Add a language
app.post('/api/languages', async (req, res) => {
    const { name, slug } = req.body;
    try {
        if (!name || !slug) {
            return res.status(400).json({ success: false, message: "Name and slug are required" });
        }
        const newLang = new Language({ name, slug });
        const saved = await newLang.save();
        res.status(201).json({ id: saved._id, name: saved.name, slug: saved.slug });
    } catch (err) {
        console.error('Error adding language:', err);
        res.status(500).json({ success: false, message: "Failed to add language" });
    }
});

// Delete a language
app.delete('/api/languages/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Language ID" });
        }
        await Topic.deleteMany({ language: id });
        await Language.findByIdAndDelete(id);
        res.json({ success: true, message: "Language and associated topics deleted" });
    } catch (err) {
        console.error('Error deleting language:', err);
        res.status(500).json({ success: false, message: "Failed to delete language" });
    }
});

// Get topics by language from MongoDB
app.get('/api/topics/:languageId', async (req, res) => {
    try {
        const { languageId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(languageId)) {
            return res.status(400).json({ success: false, message: "Invalid Language ID" });
        }

        const results = await Topic.find({ language: languageId }).populate('language');
        const formatted = results.map(t => ({ 
            id: t._id, 
            title: t.title, 
            content: t.content, 
            language_id: t.language?._id || languageId,
            language_name: t.language?.name || 'Unknown',
            created_at: t.created_at 
        }));
        res.json(formatted);
    } catch (err) {
        console.error('Error fetching topics by language:', err);
        res.status(500).json({ success: false, message: "Failed to fetch topics" });
    }
});

// Get all topics from MongoDB
app.get('/api/topics', async (req, res) => {
    try {
        console.log('Fetching all topics with language population...');
        const results = await Topic.find().populate('language').sort({ created_at: -1 });
        
        const formatted = results.map(t => ({ 
            id: t._id, 
            title: t.title || 'Untitled', 
            content: t.content || '', 
            language_id: t.language?._id || null,
            language_name: t.language?.name || 'Unknown',
            created_at: t.created_at 
        }));
        
        res.json(formatted);
    } catch (err) {
        console.error('Error fetching topics:', err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch topics", 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
    }
});

// Get single topic from MongoDB
app.get('/api/topic/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid Topic ID" });
        }
        const topic = await Topic.findById(req.params.id).populate('language');
        if (!topic) return res.status(404).json({ success: false, message: "Topic not found" });
        
        res.json({ 
            id: topic._id, 
            title: topic.title, 
            content: topic.content, 
            language_id: topic.language?._id || null,
            language_name: topic.language?.name || 'Unknown',
            created_at: topic.created_at 
        });
    } catch (err) {
        console.error('Error fetching single topic:', err);
        res.status(500).json({ success: false, message: "Failed to fetch topic" });
    }
});

// Add a topic
app.post('/api/topics', async (req, res) => {
    const { title, content, language_id } = req.body;
    
    try {
        // Validate inputs
        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        // Prepare the language object
        let languageRef = null;
        if (language_id && mongoose.Types.ObjectId.isValid(language_id)) {
            languageRef = language_id;
        }

        const newTopic = new Topic({ 
            title, 
            content: content || "", 
            language: languageRef 
        });

        const saved = await newTopic.save();
        res.status(201).json({ 
            id: saved._id, 
            title: saved.title, 
            content: saved.content, 
            language_id: saved.language 
        });
    } catch (err) {
        console.error('Error creating topic:', err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to create topic",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
    }
});

// Update a topic
app.put('/api/topics/:id', async (req, res) => {
    const { title, content, language_id } = req.body;
    try {
        const updateData = { title, content };
        
        if (language_id && mongoose.Types.ObjectId.isValid(language_id)) {
            updateData.language = language_id;
        } else {
            updateData.language = null;
        }

        const updated = await Topic.findByIdAndUpdate(
            req.params.id, 
            updateData,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: "Topic not found" });
        }

        res.json({ message: "Topic updated", id: updated._id });
    } catch (err) {
        console.error('Error updating topic:', err);
        res.status(500).json({ success: false, message: "Failed to update topic" });
    }
});

// Delete a topic
app.delete('/api/topics/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid Topic ID" });
        }
        const result = await Topic.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, message: "Topic not found" });
        }
        res.json({ success: true, message: "Topic deleted" });
    } catch (err) {
        console.error('Error deleting topic:', err);
        res.status(500).json({ success: false, message: "Failed to delete topic" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
