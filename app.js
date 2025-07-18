const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// Set up MySQL connection
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

// Set up view engine and middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Session and flash
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// Middleware to check if a user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if a user is an admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied. Admins only.');
        res.redirect('/dashboard');
    }
};

// Middleware function to validate registration
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

// Routes
app.get('/',  (req, res) => {
    res.render('index', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('success'),
        errors: req.flash('error'),
        formData: req.flash('formData')[0] || {}
    });
});

// Integrate into the registration route
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            req.flash('error', 'Registration failed.');
            req.flash('formData', req.body); // <--- this saves the values they already typed
            return res.redirect('/register');
        }

        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// Login routes to render login page below
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
    connection.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            // Invalid login credientials
            req.flash('error', 'Invalid email or password');
            res.redirect('/login');
        }
    });
});

// Dashboard route
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// Admin dashboard route
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

// Add Expense route
app.get('/addExpense', checkAuthenticated, (req, res) => {
    res.render('addExpense', { user: req.session.user });
});

app.post('/addExpense', checkAuthenticated, (req, res) => {
    const { title, category, amount, date } = req.body;
    const userId = req.session.user.id;

    const sql = 'INSERT INTO expenses (userId, title, category, amount, date) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [userId, title, category, amount, date], (err, result) => {
        if (err) {
            console.error('Error adding expense:', err);
            return res.status(500).send('Error adding expense');
        }
        req.flash('success', 'Expense added successfully!');
        res.redirect('/dashboard');
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
