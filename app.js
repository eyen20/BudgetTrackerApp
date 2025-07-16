const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
    host: 't6gdg4.h.filess.io',
    port: 61002,
    user: 'C237DatabaseTeam8_dulleatmad',
    password: '396ec17ca276380b5b1015a2727a4af8ad42d4c8',
    database: 'C237DatabaseTeam8_dulleatmad'
  });

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

// TO DO: Create a middlewware function validateRegistration
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, coontact } = req.body;

    if (!username || !email || !password || !address || !coontact) {
        return res.status(400).send('All fields are required');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user}, { messages: req.flash('success') });
});

// TO DO: Integrate into the registration route
app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact) VALUES (?, ?, SHA(?), ?, ?)';
    db.query(sql, [username, email, password, address, contact], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// TO DO: Insert code for login routes to render login page below
app.get('/login', (req, res) => {

    res.render('login', { 
        message: req.flash('success'),
        error: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            res.redirect('/');
        } else {
            // Invalid login credientials
            req.flash('error', 'Invalid email or password');
            res.redirect('/login');
        }
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));