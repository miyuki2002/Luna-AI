const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger.js') || console;

// Paths
const rootDir = path.join(__dirname, '..');
const dashboardDir = path.join(rootDir, 'Luna-Dashboard');
const routesDir = path.join(dashboardDir, 'src', 'routes');

// Create the routes directory if it doesn't exist
function createDirectories() {
  const directories = [
    path.join(dashboardDir, 'src'),
    routesDir,
    path.join(dashboardDir, 'src', 'views'),
    path.join(dashboardDir, 'src', 'public'),
    path.join(dashboardDir, 'src', 'themes', 'default')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Route templates
const routes = {
  main: `
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    bot: req.app.locals.bot,
    title: 'Dashboard',
    user: req.user || null
  });
});

module.exports = router;
  `,
  
  auth: `
const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.user) {
    res.redirect('/');
  } else {
    res.redirect('/login/auth');
  }
});

router.get('/auth', passport.authenticate('discord', { 
  scope: ['identify', 'guilds'],
  prompt: 'none'
}));

router.get('/api', passport.authenticate('discord', { 
  failureRedirect: '/' 
}), (req, res) => {
  res.redirect(req.session.backURL || '/');
});

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;
  `,
  
  api: `
const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Get bot information
router.get('/info', checkAuth, (req, res) => {
  const bot = req.app.locals.bot;
  res.json({
    username: bot.user.username,
    id: bot.user.id,
    guilds: bot.guilds.cache.size,
    users: bot.users.cache.size
  });
});

// Get user guilds
router.get('/guilds', checkAuth, (req, res) => {
  res.json(req.user.guilds || []);
});

module.exports = router;
  `,
  
  commands: `
const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.session.backURL = req.originalUrl;
  res.redirect('/login');
}

router.get('/', checkAuth, (req, res) => {
  const bot = req.app.locals.bot;
  const commands = Array.from(bot.commands.values()).map(cmd => ({
    name: cmd.data?.name || 'Unknown',
    description: cmd.data?.description || 'No description',
    category: cmd.category || 'Uncategorized'
  }));
  
  res.render('commands', {
    title: 'Commands',
    commands,
    user: req.user
  });
});

module.exports = router;
  `,
  
  admin: `
const express = require('express');
const router = express.Router();

// Middleware to check if user is an admin
function checkAdmin(req, res, next) {
  const config = req.app.locals.config;
  if (req.isAuthenticated() && config.Admin.includes(req.user.id)) return next();
  req.session.backURL = req.originalUrl;
  res.redirect('/login');
}

router.get('/', checkAdmin, (req, res) => {
  const bot = req.app.locals.bot;
  
  // Get basic stats
  const stats = {
    guilds: bot.guilds.cache.size,
    users: bot.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
    channels: bot.channels.cache.size,
    uptime: Math.floor(bot.uptime / 1000),
    commands: bot.commands ? bot.commands.size : 0
  };
  
  res.render('admin', {
    title: 'Admin Panel',
    stats,
    user: req.user
  });
});

module.exports = router;
  `,
  
  plugins: `
const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.session.backURL = req.originalUrl;
  res.redirect('/login');
}

router.get('/', checkAuth, (req, res) => {
  res.render('plugins', {
    title: 'Plugins',
    user: req.user
  });
});

module.exports = router;
  `
};

// Create a basic view file
function createBasicViews() {
  const viewsDir = path.join(dashboardDir, 'src', 'views');
  
  // Create an index.ejs file with a basic template
  const indexEjs = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | Luna AI</title>
  <link rel="stylesheet" href="/themes/default/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Luna AI Dashboard</h1>
      <% if (user) { %>
        <div class="user-info">
          Welcome, <%= user.username %>
          <a href="/login/logout">Logout</a>
        </div>
      <% } else { %>
        <div class="login-btn">
          <a href="/login">Login with Discord</a>
        </div>
      <% } %>
    </header>
    
    <main>
      <h2>Welcome to Luna AI Dashboard</h2>
      <p>This dashboard allows you to manage your Discord bot settings and monitor its activity.</p>
      
      <% if (user) { %>
        <div class="dashboard-links">
          <a href="/commands">View Commands</a>
          <% if (user && locals.config && locals.config.Admin.includes(user.id)) { %>
            <a href="/admin">Admin Panel</a>
          <% } %>
        </div>
      <% } %>
    </main>
    
    <footer>
      <p>Luna AI Dashboard v<%= locals.luna ? locals.luna.version : '1.0' %></p>
    </footer>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(viewsDir, 'index.ejs'), indexEjs);
  console.log('Created basic index.ejs view');
  
  // Create a basic error.ejs template
  const errorEjs = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | Luna AI</title>
  <link rel="stylesheet" href="/themes/default/style.css">
</head>
<body>
  <div class="container error-container">
    <h1><%= error %></h1>
    <p><%= subtitle %></p>
    <a href="/">Return to Home</a>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(viewsDir, 'error.ejs'), errorEjs);
  console.log('Created basic error.ejs view');
  
  // Create minimal CSS file
  const themesDir = path.join(dashboardDir, 'src', 'themes', 'default');
  const cssContent = `:root {
  --primary: #7F5AF0;
  --secondary: #d580ff;
  --success: #72E9B5;
  --danger: #FF8E8E;
  --dark: #16161A;
  --background: #242629;
  --light: #FFFFFE;
  --text: #94A1B2;
  --card-color: #16161A;
  --border-radius: 0.4rem;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  background-color: var(--background);
  color: var(--text);
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--primary);
}

h1, h2, h3 {
  color: var(--light);
}

a {
  color: var(--primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.login-btn a, .dashboard-links a {
  display: inline-block;
  background-color: var(--primary);
  color: var(--light);
  padding: 8px 16px;
  border-radius: var(--border-radius);
  text-decoration: none;
  margin-right: 10px;
  margin-top: 10px;
}

.login-btn a:hover, .dashboard-links a:hover {
  background-color: var(--secondary);
}

footer {
  margin-top: 50px;
  text-align: center;
  font-size: 14px;
}

.error-container {
  text-align: center;
  padding: 50px 0;
}

.error-container h1 {
  font-size: 36px;
  margin-bottom: 20px;
}`;

  fs.writeFileSync(path.join(themesDir, 'style.css'), cssContent);
  console.log('Created basic CSS stylesheet');
}

// Create route files
function createRouteFiles() {
  Object.entries(routes).forEach(([name, content]) => {
    const filePath = path.join(routesDir, `${name}.js`);
    fs.writeFileSync(filePath, content.trim());
    console.log(`Created route file: ${filePath}`);
  });
}

// Main function
async function createDashboardRoutes() {
  try {
    console.log('Starting creation of dashboard routes...');
    
    // Create directories
    createDirectories();
    
    // Create route files
    createRouteFiles();
    
    // Create basic views
    createBasicViews();
    
    console.log('Successfully created dashboard routes and basic views!');
  } catch (error) {
    console.error('Error creating dashboard routes:', error);
  }
}

// Run if directly called
if (require.main === module) {
  createDashboardRoutes();
}

module.exports = { createDashboardRoutes }; 