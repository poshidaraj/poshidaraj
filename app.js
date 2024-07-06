const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for authentication
const auth = (req, res, next) => {
    const auth = { login: 'admin', password: 'password' };
    
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (login && password && login === auth.login && password === auth.password) {
        return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
};

// Read and write JSON data
const readData = (file) => {
    return new Promise((resolve, reject) => {
        fs.readFile(file, (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
};

const writeData = (file, data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(file, JSON.stringify(data, null, 2), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// Routes
app.get('/', async (req, res) => {
    try {
        const blogs = await readData('blogs.json');
        res.send(renderIndexPage(blogs));
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.get('/wp-admin', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/add-blog', auth, async (req, res) => {
    const { title, content } = req.body;
    try {
        const blogs = await readData('blogs.json');
        blogs.push({ title, content, likes: 0, comments: [] });
        await writeData('blogs.json', blogs);
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.get('/blog/:id', async (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    try {
        const blogs = await readData('blogs.json');
        const blog = blogs[blogId];
        if (blog) {
            res.send(renderBlogPage(blog, blogId));
        } else {
            res.status(404).send('Blog not found');
        }
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.post('/like-blog/:id', async (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    try {
        const blogs = await readData('blogs.json');
        if (blogs[blogId]) {
            blogs[blogId].likes += 1;
            await writeData('blogs.json', blogs);
            res.send({ likes: blogs[blogId].likes });
        } else {
            res.status(404).send('Blog not found');
        }
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.post('/comment-blog/:id', async (req, res) => {
    const blogId = parseInt(req.params.id, 10);
    const { comment } = req.body;
    try {
        const blogs = await readData('blogs.json');
        if (blogs[blogId]) {
            blogs[blogId].comments.push(comment);
            await writeData('blogs.json', blogs);
            res.redirect(`/blog/${blogId}`);
        } else {
            res.status(404).send('Blog not found');
        }
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

const renderIndexPage = (blogs) => {
    let blogList = blogs.map((blog, index) => `
        <div class="card" onclick="window.location.href='/blog/${index}'">
            <h2>${blog.title}</h2>
            // <p>${blog.content.substring(0, 100)}...</p>
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

const renderBlogPage = (blog, blogId) => {
    let comments = blog.comments.map(comment => `
        <div class="comment">
            <p>${comment}</p>
        </div>
    `).join('');
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
                section { padding: 20px; margin: 20px; word-wrap: break-word; max-width: 800px; margin: 0 auto; }
                footer { background-color: #008080; color: white; text-align: center; padding: 10px 0; position: static; width: 100%; }
                .like-button { margin-top: 10px; }
                .comments { margin-top: 20px; }
                @media (max-width: 600px) {
                    section { padding: 10px; margin: 10px; }
                }
            </style>
        </head>
        <body>
            <header>
                <h1>${blog.title}</h1>
            </header>
            <section>
                <p>${blog.content}</p>
                <button class="like-button" onclick="likeBlog(${blogId})">Like (${blog.likes})</button>
                <div class="comments">
                    <h3>Comments:</h3>
                    ${comments}
                    <form action="/comment-blog/${blogId}" method="POST">
                        <textarea name="comment" rows="4" required></textarea>
                        <button type="submit">Add Comment</button>
                    </form>
                </div>
            </section>
            <footer>
                <p>&copy; 2024 Poshidaraj. All rights reserved.</p>
            </footer>
            <script>
                function likeBlog(blogId) {
                    fetch(\`/like-blog/\${blogId}\`, { method: 'POST' })
                        .then(response => response.json())
                        .then(data => {
                            document.querySelector('.like-button').innerText = \`Like (\${data.likes})\`;
                        });
                }
            </script>
        </body>
        </html>
    `;
};

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
