const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger.js') || console;

// Paths
const rootDir = path.join(__dirname, '..');
const dashboardDir = path.join(rootDir, 'Luna-Dashboard');
const routesDir = path.join(dashboardDir, 'src', 'routes');
const publicDir = path.join(dashboardDir, 'src', 'public');

// Create the routes directory if it doesn't exist
function createDirectories() {
  const directories = [
    path.join(dashboardDir, 'src'),
    routesDir,
    publicDir,
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

// Create error template
function createBasicErrorTemplate() {
  const errorTemplate = path.join(publicDir, 'error.ejs');
  
  if (!fs.existsSync(errorTemplate)) {
    console.log('Creating basic error template...');
    
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
    
    fs.writeFileSync(errorTemplate, errorEjs);
    console.log('Created error.ejs template');
  }
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
    
    // Create error template
    createBasicErrorTemplate();
    
    console.log('Successfully created dashboard routes!');
    console.log('Note: Using existing views in the public folder');
  } catch (error) {
    console.error('Error creating dashboard routes:', error);
  }
}

// Run if directly called
if (require.main === module) {
  createDashboardRoutes();
}

module.exports = { createDashboardRoutes }; 