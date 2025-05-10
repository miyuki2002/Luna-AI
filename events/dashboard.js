const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const ejs = require('ejs');
const MongoStore = require('connect-mongo');
const logger = require('../utils/logger.js');
const mongoClient = require('../services/mongoClient.js');

// Custom dashboard modules
const routes = {
  main: require('../Luna-Dashboard/src/routes/main'),
  auth: require('../Luna-Dashboard/src/routes/auth'),
  api: require('../Luna-Dashboard/src/routes/api'),
  commands: require('../Luna-Dashboard/src/routes/commands'),
  admin: require('../Luna-Dashboard/src/routes/admin'),
  plugins: require('../Luna-Dashboard/src/routes/plugins')
};

let dashboardApp;

async function initDashboard(client) {
  try {
    logger.info('DASHBOARD', '🔄 Khởi tạo dashboard...');

    // Dashboard config
    const config = {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET || '',
      callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/login/api',
      Admin: process.env.OWNER_ID ? [process.env.OWNER_ID] : [],
      token: process.env.DISCORD_TOKEN,
      port: process.env.DASHBOARD_PORT || 3000
    };

    // Initialize Express app
    dashboardApp = express();

    // Set up view engine
    dashboardApp.set('view engine', 'ejs');
    dashboardApp.set('views', path.join(__dirname, '../Luna-Dashboard/src/views'));
    
    // Middleware
    dashboardApp.use(bodyParser.json());
    dashboardApp.use(bodyParser.urlencoded({ extended: true }));

    // Static directories
    dashboardApp.use(express.static(path.join(__dirname, '../Luna-Dashboard/src/public')));
    dashboardApp.use('/themes', express.static(path.join(__dirname, '../Luna-Dashboard/src/themes')));

    // Session configuration
    const sessionConfig = {
      secret: 'luna-dashboard-secret',
      cookie: {
        maxAge: 60000 * 60 * 24 // 24 hours
      },
      saveUninitialized: false,
      resave: false,
      name: 'luna-dashboard-cookie'
    };

    // Use MongoDB for session storage if available
    try {
      const db = mongoClient.getDb();
      if (db) {
        sessionConfig.store = MongoStore.create({
          client: mongoClient.getMongoClient(),
          dbName: db.databaseName,
          collectionName: 'dashboard_sessions'
        });
        logger.info('DASHBOARD', '✅ Đã kết nối MongoDB cho phiên đăng nhập dashboard');
      }
    } catch (error) {
      logger.warn('DASHBOARD', '⚠️ Không thể sử dụng MongoDB cho phiên đăng nhập, sử dụng bộ nhớ');
    }

    dashboardApp.use(session(sessionConfig));

    // Passport setup
    passport.serializeUser((user, done) => {
      done(null, user);
    });
    
    passport.deserializeUser((obj, done) => {
      done(null, obj);
    });

    passport.use(new DiscordStrategy({
      clientID: config.clientID,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackURL,
      scope: ['identify', 'guilds']
    }, function(accessToken, refreshToken, profile, done) {
      process.nextTick(function() {
        return done(null, profile);
      });
    }));

    dashboardApp.use(passport.initialize());
    dashboardApp.use(passport.session());

    // Global variables for templates
    dashboardApp.locals.bot = client;
    dashboardApp.locals.config = config;
    dashboardApp.locals.themeConfig = {
      theme: "default"
    };

    // Add Luna-specific data
    dashboardApp.locals.luna = {
      version: require('../package.json').version,
      name: "Luna AI Dashboard"
    };

    // Middleware for auth check
    function checkAuth(req, res, next) {
      if (req.isAuthenticated()) return next();
      req.session.backURL = req.url;
      res.redirect('/login');
    }

    // Admin middleware
    function checkAdmin(req, res, next) {
      if (req.isAuthenticated() && config.Admin.includes(req.user.id)) return next();
      req.session.backURL = req.originalUrl;
      res.redirect('/login');
    }

    // Set up routes
    dashboardApp.use('/', routes.main);
    dashboardApp.use('/login', routes.auth);
    dashboardApp.use('/api', routes.api);
    dashboardApp.use('/commands', routes.commands);
    dashboardApp.use('/admin', routes.admin);
    dashboardApp.use('/plugins', routes.plugins);

    // Custom 404 handler
    dashboardApp.use((req, res) => {
      res.status(404).render('error', {
        title: '404 - Không tìm thấy trang',
        error: '404 - Không tìm thấy trang',
        subtitle: 'Trang bạn đang tìm kiếm không tồn tại!'
      });
    });

    // Start the server
    const server = dashboardApp.listen(config.port, () => {
      logger.info('DASHBOARD', `✅ Dashboard đã khởi động tại cổng ${config.port}`);
    });

    return dashboardApp;
  } catch (error) {
    logger.error('DASHBOARD', '❌ Lỗi khi khởi tạo dashboard:', error);
  }
}

function getDashboard() {
  return dashboardApp;
}

module.exports = { 
  initDashboard,
  getDashboard
}; 