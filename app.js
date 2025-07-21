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

// const connection = mysql.createConnection({
//     host: 'localhost',
//     port: 3306,
//     user: 'root',
//     password: 'Republic_C207',
//     database: 'C237DatabaseTeam8_dulleatmad'
// });

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
app.use(express.urlencoded({ extended: true }));

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
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
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
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');  // Redirect logged-in users to dashboard
    }
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
        errors: req.flash('error'),
        messages: req.flash('success')
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
            if (req.session.user.role === 'user') {
                res.redirect('/dashboard');
            } else {
                res.redirect('/admin');
            }
        } else {
            // Invalid login credentials
            req.flash('error', 'Invalid email or password');
            res.redirect('/login');
        }
    });
});

// Dashboard route - shows budgets and expenses for logged-in user
app.get('/dashboard', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    // Get month from query param or default to current month (YYYY-MM)
    const now = new Date();
    const year = now.getFullYear();
    const monthNum = now.getMonth() + 1;
    const month = monthNum < 10 ? '0' + monthNum : '' + monthNum;

    const selectedMonth = `${year}-${month}`;  // e.g. "2025-07"

    const sqlBudgets = `
    SELECT b.budgetId, b.category, b.month, SUM(b.amount) AS budgeted, IFNULL(SUM(e.amount), 0) AS spent
    FROM budgets b
    LEFT JOIN expenses e
      ON b.userId = e.userId
      AND b.category = e.category
      AND DATE_FORMAT(b.month, '%Y-%m') = DATE_FORMAT(e.date, '%Y-%m')
    WHERE b.userId = ?
      AND DATE_FORMAT(b.month, '%Y-%m') = ?  -- This line filters by currentMonth
    GROUP BY b.budgetId, b.category, b.month
    ORDER BY b.category
  `;

    const sqlExpenses = `
    SELECT * FROM expenses
    WHERE userId = ?
    AND DATE_FORMAT(date, '%Y-%m') = ?
    ORDER BY date DESC
    LIMIT 5
  `;

    connection.query(sqlBudgets, [userId, selectedMonth], (error, budgets) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error fetching budgets');
        }

        if (budgets.length > 0) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedBudgets = budgets.map(b => {
                const date = new Date(b.month);
                const monthName = months[date.getMonth()];
                const year = date.getFullYear();
                return {
                    ...b,
                    formattedMonth: monthName + ' ' + year
                };
            });

            connection.query(sqlExpenses, [userId, selectedMonth], (err, expenses) => {
                if (err) {
                    console.error('Database query error:', err.message);
                    return res.status(500).send('Error fetching expenses');
                }

                res.render('dashboard', {
                    user: req.session.user,
                    budgets: formattedBudgets,
                    expenses,
                    selectedMonth
                });
            });

        } else {
            res.render('dashboard', {
                user: req.session.user,
                budgets: [],
                expenses: [],
                selectedMonth
            });
        }
    });
});

// Admin dashboard route
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = "SELECT * FROM users";
    connection.query(sql, (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error Retrieving user by ID");
        }

        res.render('admin', {
            user: req.session.user,
            users: results
        });
    });
});

app.get("/admin/:id", (req, res) => {
    const userId = req.params.id;
    const sql = "SELECT * FROM users WHERE id = ?";
    connection.query(sql, [userId], (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error Retrieving user by ID");
        }
        if (results.length === 0) {
            return res.status(404).send("User not found");
        }
        const user = results[0];

        const now = new Date();
        const year = now.getFullYear();
        const monthNum = now.getMonth() + 1;
        const month = monthNum < 10 ? '0' + monthNum : '' + monthNum;

        const selectedMonth = `${year}-${month}`;  // e.g. "2025-07"

        const sqlBudgets = `
        SELECT b.budgetId, b.category, b.month, SUM(b.amount) AS budgeted, IFNULL(SUM(e.amount), 0) AS spent
        FROM budgets b
        LEFT JOIN expenses e
        ON b.userId = e.userId
        AND b.category = e.category
        AND DATE_FORMAT(b.month, '%Y-%m') = DATE_FORMAT(e.date, '%Y-%m')
        WHERE b.userId = ?
        AND DATE_FORMAT(b.month, '%Y-%m') = ?  -- This line filters by currentMonth
        GROUP BY b.budgetId, b.category, b.month
        ORDER BY b.category
    `;

        const sqlExpenses = `
        SELECT * FROM expenses
        WHERE userId = ?
        AND DATE_FORMAT(date, '%Y-%m') = ?
        ORDER BY date DESC
        LIMIT 5
    `;

        connection.query(sqlBudgets, [userId, selectedMonth], (error, budgets) => {
            if (error) {
                console.error('Database query error:', error.message);
                return res.status(500).send('Error fetching budgets');
            }

            if (budgets.length > 0) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const formattedBudgets = budgets.map(b => {
                    const date = new Date(b.month);
                    const monthName = months[date.getMonth()];
                    const year = date.getFullYear();
                    return {
                        ...b,
                        formattedMonth: monthName + ' ' + year
                    };
                });

                connection.query(sqlExpenses, [userId, selectedMonth], (err, expenses) => {
                    if (err) {
                        console.error('Database query error:', err.message);
                        return res.status(500).send('Error fetching expenses');
                    }

                    res.render('user', {
                        user: user,
                        budgets: formattedBudgets,
                        expenses,
                        selectedMonth
                    });
                });

            } else {
                res.render('user', {
                    user:   user,
                    budgets: [],
                    expenses: [],
                    selectedMonth
                });
            }
        });
    });
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

// Add Budget route
app.get('/addBudget', checkAuthenticated, (req, res) => {
    res.render('addBudget', { user: req.session.user });
});

app.post('/addBudget', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { category, month, amount } = req.body;

    // Make month into a full date (e.g. 2025-07 → 2025-07-01)
    const formattedMonth = month + '-01';

    const sql = 'INSERT INTO budgets (userId, category, month, amount) VALUES (?, ?, ?, ?)';
    connection.query(sql, [userId, category, formattedMonth, amount], (err, result) => {
        if (err) {
            console.error('Error adding budget:', err);
            return res.status(500).send('Error saving budget');
        }
        req.flash('success', 'Budget added successfully!');
        res.redirect('/dashboard');
    });
});

// Update Budget route
app.get('/updateBudget/:id', (req, res) => {
    const budgetId = req.params.id;
    const userId = req.session.user.id;
    const sql = 'SELECT * FROM budgets WHERE budgetId =? AND userId = ?';

    connection.query(sql, [budgetId, userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving budget by ID');
        }

        if (results.length > 0) {
            res.render('updateBudget', { budget: results[0] });

        } else {
            res.status(404).send('Budget not found');
        }
    });
});

app.post('/updateBudget/:id', (req, res) => {
    const budgetId = req.params.id;
    const userId = req.session.user.id;
    // Extract product data from the request body
    const { category, month, amount } = req.body;

    const sql = 'UPDATE budgets SET category = ? , month = ?, amount = ? WHERE budgetId = ? AND userId = ?';

    // Insert the new product into the database
    connection.query(sql, [category, month, amount, budgetId, userId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating budget:", error);
            res.status(500).send('Error updating budget');
        } else {
            //Send a success responsse
            res.redirect('/');
        }
    });
});

// Update Expense route
app.get('/updateExpense/:id', (req, res) => {
    const expenseId = req.params.id;
    const userId = req.session.user.id;
    const sql = 'SELECT * FROM expenses WHERE expenseId =? AND userId = ?';

    connection.query(sql, [expenseId, userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving expense by ID');
        }

        if (results.length > 0) {
            res.render('updateExpense', { expense: results[0] });

        } else {
            res.status(404).send('Expense not found');
        }
    });
});

app.post('/updateExpense/:id', (req, res) => {
    const expenseId = req.params.id;
    // Extract product data from the request body
    const { title, category, amount, date } = req.body;

    const sql = 'UPDATE expenses SET title = ? , category = ?, amount = ?, date = ? WHERE expenseId = ? AND userId = ?';

    // Insert the new product into the database
    connection.query(sql, [title, category, amount, date, expenseId, req.session.user.id], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating expense:", error);
            res.status(500).send('Error updating expense');
        } else {
            //Send a success responsse
            res.redirect('/');
        }
    });
});

app.get('/deleteProduct/:id', (req, res) => {
    const expenseId = req.params.id;

    connection.query('DELETE FROM expenses WHERE expenseId = ?', [expenseId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting product:", error);
            res.status(500).send('Error deleting product');
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});


// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));