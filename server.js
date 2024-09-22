import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import session from 'express-session';

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

// Session middleware configuration
app.use(session({
    secret: 'yourSecretKey', // Change to a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure to true in production with HTTPS
}));

// Middleware to check for user authentication and pass 'user' to all views
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                req.user = null;
            } else {
                req.user = user;
            }
            res.locals.user = req.user; // Pass 'user' to all routes and views
            next();
        });
    } else {
        req.user = null;
        res.locals.user = null; // Ensure 'user' is passed as null if not logged in
        next();
    }
};

app.use(authenticateJWT);

// Middleware to check if the user is logged in as an admin
const ensureAdmin = (req, res, next) => {
    if (req.session && req.session.adminEmail) {
        return next();
    } else {
        return res.redirect('/admin');
    }
};

// Middleware to ensure only the owner can access certain routes
const ensureOwner = (req, res, next) => {
    if (req.session && req.session.ownerLoggedIn) {
        return next();
    } else {
        return res.redirect('/owner');
    }
};

const readJsonFile = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writeJsonFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Root route to handle GET /
app.get('/', (req, res) => {
    const posts = readJsonFile('./data/posts.json'); // Assuming posts are being displayed on the home page
    res.render('index', { posts });
});


// Registration route
app.get('/registration', (req, res) => {
    res.render('registration');
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
    res.render('login');
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

// Admin login route
app.get('/admin', (req, res) => {
    res.render('admin');
});

app.post('/admin', (req, res) => {
    const admins = readJsonFile('./data/admin.json');
    const { email, password } = req.body;

    const admin = admins.find(a => a.email === email && a.password === password);
    if (admin) {
        req.session.adminEmail = admin.email;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin', { error: 'Invalid email or password' });
    }
});

// Admin dashboard
app.get('/admin/dashboard', ensureAdmin, (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    res.render('dashboard', { posts });
});

// Admin delete post route
app.post('/admin/delete/:id', ensureAdmin, (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        posts.splice(postId, 1);
        writeJsonFile('./data/posts.json', posts);
        res.redirect('/admin/dashboard');
    } else {
        res.status(404).send('Post not found');
    }
});

// Admin create post route
app.get('/admin/create', ensureAdmin, (req, res) => {
    res.render('create');
});

app.post('/admin/create', ensureAdmin, (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    posts.push({ title: req.body.title, content: req.body.content });
    writeJsonFile('./data/posts.json', posts);
    res.redirect('/admin/dashboard');
});

// Admin edit post route
app.get('/admin/edit/:id', ensureAdmin, (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        const post = posts[postId];
        res.render('edit', { post, postId });
    } else {
        res.status(404).send('Post not found');
    }
});

app.post('/admin/edit/:id', ensureAdmin, (req, res) => {
    const posts = readJsonFile('./data/posts.json');
    const postId = req.params.id;

    if (postId >= 0 && postId < posts.length) {
        posts[postId] = { title: req.body.title, content: req.body.content };
        writeJsonFile('./data/posts.json', posts);
        res.redirect('/admin/dashboard');
    } else {
        res.status(404).send('Post not found');
    }
});

// Owner login route
app.get('/owner', (req, res) => {
    res.render('ownerLogin'); // Ensure that ownerLogin.ejs exists
});

app.post('/owner', (req, res) => {
    const { mobile, password } = req.body;
    const ownerDataPath = './data/owner.json';

    fs.readFile(ownerDataPath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send('Error reading owner data');
        const owners = JSON.parse(data || '[]');
        const owner = owners.find(o => o.mobile === mobile && o.password === password);

        if (owner) {
            req.session.ownerLoggedIn = true; // Set session for owner
            res.redirect('/create-admin');
        } else {
            res.status(401).send('Invalid mobile number or password.');
        }
    });
});



// Use ensureOwner for creating admin route
app.get('/create-admin', ensureOwner, (req, res) => {
    res.render('create-admin', { user: req.user });
});

app.post('/create-admin', ensureOwner, (req, res) => {
    const admins = readJsonFile('./data/admin.json');
    const newAdmin = {
        email: req.body.email,
        password: req.body.password
    };
    admins.push(newAdmin);
    writeJsonFile('./data/admin.json', admins);
    res.redirect('/admin/dashboard');
});


// Owner logout route
app.get('/owner/logout', (req, res) => {
    req.session.ownerLoggedIn = false;
    res.redirect('/owner');
});

// Server start
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
