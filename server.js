import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret'; // Change this to a secure key in production

// Get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

// Middleware to check for user authentication
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        req.user = null;
        next();
    }
};

app.use(authenticateJWT);

const readJsonFile = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writeJsonFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Registration route
app.get('/registration', (req, res) => {
    res.render('registration', { user: req.user });
});

app.post('/register', async (req, res) => {
    const users = readJsonFile('./data/users.json');
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({ email: req.body.email, password: hashedPassword });
    writeJsonFile('./data/users.json', users);
    res.redirect('/login');
});

// Login route
app.get('/login', (req, res) => {
    res.render('login', { user: req.user });
});

app.post('/login', async (req, res) => {
    const users = readJsonFile('./data/users.json');
    const user = users.find(u => u.email === req.body.email);
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        return res.redirect('/');
    }
    res.redirect('/login');
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// Post route
app.get('/post/:id', (req, res) => {
    if (!req.user) {
        return res.status(403).send('You need to log in to access this post.');
    }

    const postId = req.params.id;
    const postsPath = path.join(__dirname, 'data', 'posts.json');

    fs.readFile(postsPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading posts');
        }

        const posts = JSON.parse(data);
        const post = posts[postId]; // assuming posts is an array

        if (!post) {
            return res.status(404).send('Post not found');
        }

        res.render('post', { post, user: req.user });
    });
});

// Index route
app.get('/', (req, res) => {
    const yourPostsArray = readJsonFile('./data/posts.json');
    res.render('index', { posts: yourPostsArray, user: req.user });
});

app.post('/admin/login', (req, res) => {
    const admins = readJsonFile('./data/admin.json');
    const admin = admins.find(a => a.email === req.body.email && a.password === req.body.password);

    if (admin) {
        // Redirect to dashboard if admin login is successful
        res.redirect('/admin/dashboard');
    } else {
        // Redirect back to admin login page if credentials are incorrect
        res.redirect('/admin');
    }
});


// Admin routes
app.get('/admin', (req, res) => {
    res.render('admin', { user: req.user });
});

app.get('/admin/dashboard', (req, res) => {
    // Ensure you have an authentication check if needed
    const posts = readJsonFile('./data/posts.json');
    res.render('dashboard', { posts, user: req.user });
});

app.post('/admin/delete/:id', (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        posts.splice(postId, 1); // Post ko remove karte hain
        writeJsonFile('./data/posts.json', posts);
        res.redirect('/admin/dashboard'); // Redirect to dashboard
    } else {
        res.status(404).send('Post not found');
    }
});

// GET route for edit form
app.get('/admin/edit/:id', (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        const post = posts[postId];
        res.render('edit', { post, postId }); // Render edit form with post data
    } else {
        res.status(404).send('Post not found');
    }
});

app.post('/admin/edit/:id', (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        posts[postId] = { 
            title: req.body.title, 
            content: req.body.content 
        };
        writeJsonFile('./data/posts.json', posts);
        res.redirect('/admin/dashboard'); // Redirect back to admin dashboard
    } else {
        res.status(404).send('Post not found');
    }
});

// GET route for creating a new post
app.get('/admin/create', (req, res) => {
    res.render('create'); // Render a create.ejs form
});


// POST route to handle the creation of a new post
app.post('/admin/create', (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    
    // Push the new post data
    posts.push({ 
        title: req.body.title, 
        content: req.body.content 
    });
    
    // Save the updated posts array
    writeJsonFile('./data/posts.json', posts);
    
    // Redirect to the admin dashboard after creating the post
    res.redirect('/admin/dashboard');
});


// Login Route
app.get('/arshad', (req, res) => {
    res.render('ownerLogin'); // Render login.ejs
});

app.post('/arshad', (req, res) => {
    const { mobile, password } = req.body;
    const ownerDataPath = './data/owner.json';

    fs.readFile(ownerDataPath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send('Error reading owner data');
        const owners = JSON.parse(data || '[]');
        const owner = owners.find(o => o.mobile === mobile && o.password === password);

        if (owner) {
            // Grant access logic (e.g., set session or JWT token)
            res.send('Access granted!'); // Or redirect to a protected route
        } else {
            res.status(401).send('Invalid mobile number or password.'); // Handle error
        }
    });
});

// Create Admin Route
app.get('/create-admin', (req, res) => {
    res.render('create-admin'); // Render create-admin.ejs
});

app.post('/create-admin', (req, res) => {
    const { name, mobile, email, password } = req.body;
    const adminDataPath = './data/owner.json';

    fs.readFile(adminDataPath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send('Error reading admin data');
        
        let admins = JSON.parse(data || '[]');

        admins.push({ name, mobile, email, password }); // Save admin data
        
        fs.writeFile(adminDataPath, JSON.stringify(admins), (err) => {
            if (err) return res.status(500).send('Error saving admin data');
            res.redirect('/login'); // Redirect to login
        });
    });
});

// Other admin routes remain the same...

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
