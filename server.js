const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CKEditor Integration Script
const CKEDITOR_SCRIPT = '<script src="https://cdn.ckeditor.com/4.16.0/standard/ckeditor.js"></script>';

// Basic authentication middleware
const auth = (req, res, next) => {
    const auth = { login: '790343', password: '123' };
    
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (login && password && login === auth.login && password === auth.password) {
        return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
};

// Routes
app.get('/', (req, res) => {
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        const blogs = JSON.parse(data);
        res.send(renderIndexPage(blogs));
    });
});

app.get('/wp-admin', auth, (req, res) => {
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        const blogs = JSON.parse(data);
        res.send(renderAdminPage(blogs));
    });
});

app.post('/add-blog', auth, (req, res) => {
    const { title, content } = req.body;
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        const blogs = JSON.parse(data);
        blogs.push({ title, content });
        fs.writeFile('blogs.json', JSON.stringify(blogs, null, 2), (err) => {
            if (err) throw err;
            res.redirect('/wp-admin');
        });
    });
});

app.post('/update-blog/:id', auth, (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    const { title, content } = req.body;
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        const blogs = JSON.parse(data);
        blogs[blogId] = { title, content };
        fs.writeFile('blogs.json', JSON.stringify(blogs, null, 2), (err) => {
            if (err) throw err;
            res.redirect('/wp-admin');
        });
    });
});

app.post('/delete-blog/:id', auth, (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        let blogs = JSON.parse(data);
        blogs = blogs.filter((blog, index) => index !== blogId);
        fs.writeFile('blogs.json', JSON.stringify(blogs, null, 2), (err) => {
            if (err) throw err;
            res.redirect('/wp-admin');
        });
    });
});

// Route to view individual blog post
app.get('/blog/:id', (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    fs.readFile('blogs.json', (err, data) => {
        if (err) throw err;
        const blogs = JSON.parse(data);
        const blog = blogs[blogId];
        if (blog) {
            res.send(renderBlogPage(blog));
        } else {
            res.status(404).send('Blog not found');
        }
    });
});

const renderIndexPage = (blogs) => {
    let blogList = blogs.map((blog, index) => `
        <div class="card" onclick="window.location.href='/blog/${index}'">
            <h2>${blog.title}</h2>
            <div>${blog.content.substring(0, 100)}...</div>
            <p><strong>Likes:</strong> ${blog.likes}</p>
        </div>
    `).join('');
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Poshidaraj Blog</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f8ff; }
                header { background-color: #008080; color: white; padding: 10px 0; text-align: center; }
                section { padding: 20px; margin: 0 auto; max-width: 800px; }
                footer { background-color: #008080; color: white; text-align: center; padding: 10px 0; position: static; width: 100%; }
                .card { background-color: white; margin: 10px 0; padding: 10px; border-radius: 5px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); cursor: pointer; }
                .card h2 { margin: 0; }
                .card p { color: gray; }
                @media (max-width: 600px) {
                    section { padding: 10px; margin: 10px; }
                    .card { margin: 10px 0; }
                }
            </style>
        </head>
        <body>
            <header>
                <h1>Poshidaraj Blog</h1>
                <p>Enhancing Marital Bliss through Islamic Principles</p>
            </header>
            <section>
                ${blogList}
            </section>
            <footer>
                <p>&copy; 2024 Poshidaraj. All rights reserved.</p>
            </footer>
        </body>
        </html>
    `;
};

const renderAdminPage = (blogs) => {
    let blogList = blogs.map((blog, index) => `
        <div class="admin-card">
            <h2>${blog.title}</h2>
            <form action="/update-blog/${index}" method="POST">
                <label for="title-${index}">Title:</label>
                <input type="text" id="title-${index}" name="title" value="${blog.title}" required>
                <label for="content-${index}">Content:</label>
                <textarea id="content-${index}" name="content" rows="5" required>${blog.content}</textarea>
                <button type="submit">Update Blog</button>
            </form>
            <form action="/delete-blog/${index}" method="POST">
                <button type="submit">Delete Blog</button>
            </form>
        </div>
    `).join('');
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin - Poshidaraj Blog</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #18181b; color: white; margin: 0; padding: 20px; }
                header { background-color: #008080; color: white; padding: 10px 0; text-align: center; }
                section { padding: 20px; margin: 0 auto; max-width: 800px; }
                footer { background-color: #008080; color: white; text-align: center; padding: 10px 0; position: static; width: 100%; }
                .admin-card { background-color: #333; margin: 10px 0; padding: 20px; border-radius: 5px; }
                form { display: flex; flex-direction: column; }
                label, input, textarea, button { margin-bottom: 10px; }
                input, textarea { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
                button { background-color: #008080; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; }
                button:hover { background-color: #006666; }
            </style>
            <script src="https://cdn.ckeditor.com/4.16.0/standard/ckeditor.js"></script>
        </head>
        <body>
            <header>
                <h1>Admin - Poshidaraj Blog</h1>
            </header>
            <section>
                <h2>Add a New Blog Entry</h2>
                <form action="/add-blog" method="POST">
                    <label for="title">Title:</label>
                    <input type="text" id="title" name="title" required>
                    <label for="content">Content:</label>
                    <textarea id="content" name="content" rows="10" required></textarea>
                    <button type="submit">Add Blog</button>
                </form>
                <h2>Manage Existing Blog Entries</h2>
                ${blogList}
            </section>
            <footer>
                <p>&copy; 2024 Poshidaraj. All rights reserved.</p>
            </footer>
            <script>
                CKEDITOR.replace('content');
                ${blogs.map((_, index) => `CKEDITOR.replace('content-${index}');`).join('')}
            </script>
        </body>
        </html>
    `;
};

const renderBlogPage = (blog) => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${blog.title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f8ff; }
                header { background-color: #008080; color: white; padding: 10px 0; text-align: center; }
                section { padding: 20px; margin: 20px; }
                footer { background-color: #008080; color: white; text-align: center; padding: 10px 0; position: fixed; bottom: 0; width: 100%; }
            </style>
        </head>
        <body>
            <header>
                <h1>${blog.title}</h1>
            </header>
            <section>
                <p>${blog.content}</p>
            </section>
            <footer>
                <p>&copy; 2024 Poshidaraj. All rights reserved.</p>
            </footer>
        </body>
        </html>
    `;
};

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
