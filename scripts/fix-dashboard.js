const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createDashboardRoutes } = require('./create-dashboard-routes');

// Paths
const rootDir = path.join(__dirname, '..');
const dashboardDir = path.join(rootDir, 'Luna-Dashboard');

// Check if dashboard directory exists and create if not
function checkDashboardDir() {
  if (!fs.existsSync(dashboardDir)) {
    console.log('Luna-Dashboard directory not found. Creating it...');
    fs.mkdirSync(dashboardDir, { recursive: true });
    return false;
  }
  return true;
}

// Create necessary dashboard directories
function createDashboardDirs() {
  const dirs = [
    path.join(dashboardDir, 'src'),
    path.join(dashboardDir, 'src', 'config'),
    path.join(dashboardDir, 'src', 'routes'),
    path.join(dashboardDir, 'src', 'public'),
    path.join(dashboardDir, 'src', 'themes', 'default')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Create a basic package.json for the dashboard
function createPackageJson() {
  const packageJsonPath = path.join(dashboardDir, 'src', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    const packageJson = {
      name: "luna-dashboard",
      version: "1.0.0",
      description: "Dashboard for Luna AI Discord Bot",
      main: "index.js",
      dependencies: {
        "express": "^4.18.2",
        "express-session": "^1.17.3",
        "passport": "^0.6.0",
        "passport-discord": "^0.1.4",
        "body-parser": "^1.20.2",
        "ejs": "^3.1.9",
        "connect-mongo": "^5.0.0"
      }
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Created package.json for dashboard');
  }
}

// Create a default config
function createDefaultConfig() {
  const configDir = path.join(dashboardDir, 'src', 'config');
  const defaultConfigPath = path.join(configDir, 'config.default.json');
  
  if (!fs.existsSync(defaultConfigPath)) {
    const defaultConfig = {
      "clientID": "BOT_CLIENT_ID",
      "clientSecret": "BOT_CLIENT_SECRET",
      "callbackURL": "http://localhost:3000/login/api",
      "Admin": [],
      "port": 3000
    };
    
    fs.writeFileSync(defaultConfigPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created default config file');
  }
  
  const configPath = path.join(configDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(defaultConfigPath, configPath);
    console.log('Created config.json from default');
  }
  
  const themeConfigPath = path.join(configDir, 'theme.json');
  if (!fs.existsSync(themeConfigPath)) {
    const themeConfig = {
      theme: "default"
    };
    fs.writeFileSync(themeConfigPath, JSON.stringify(themeConfig, null, 2));
    console.log('Created theme config');
  }
}

// Install necessary packages
function installPackages() {
  return new Promise((resolve, reject) => {
    console.log('Installing necessary packages...');
    
    const packages = [
      'express',
      'express-session',
      'passport',
      'passport-discord',
      'body-parser',
      'ejs',
      'connect-mongo'
    ];
    
    const cmd = `npm install ${packages.join(' ')} --save`;
    
    exec(cmd, { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error installing packages: ${error.message}`);
        return reject(error);
      }
      console.log('Successfully installed necessary packages');
      resolve();
    });
  });
}

// Update reference in events/dashboard.js
function updateDashboardImports() {
  const dashboardJsPath = path.join(rootDir, 'events', 'dashboard.js');
  
  if (fs.existsSync(dashboardJsPath)) {
    let content = fs.readFileSync(dashboardJsPath, 'utf8');
    
    // Update view engine configuration if needed
    if (content.includes("set('views', path.join(__dirname, '../Luna-Dashboard/src/views'))")) {
      content = content.replace(
        "dashboardApp.set('views', path.join(__dirname, '../Luna-Dashboard/src/views'))",
        "dashboardApp.set('views', path.join(__dirname, '../Luna-Dashboard/src/public'))"
      );
      console.log('Updated view path in dashboard.js');
    }
    
    // Update route imports
    const oldImports = `const routes = {
  main: require('../Luna-Dashboard/src/routes/main'),
  auth: require('../Luna-Dashboard/src/routes/auth'),
  api: require('../Luna-Dashboard/src/routes/api'),
  commands: require('../Luna-Dashboard/src/routes/commands'),
  admin: require('../Luna-Dashboard/src/routes/admin'),
  plugins: require('../Luna-Dashboard/src/routes/plugins')
};`;

    // For each route, we'll check if the file exists and create a dynamic variable
    const newImports = `// Custom dashboard modules
const routePaths = {
  main: '../Luna-Dashboard/src/routes/main',
  auth: '../Luna-Dashboard/src/routes/auth',
  api: '../Luna-Dashboard/src/routes/api',
  commands: '../Luna-Dashboard/src/routes/commands',
  admin: '../Luna-Dashboard/src/routes/admin',
  plugins: '../Luna-Dashboard/src/routes/plugins'
};

// Import routes
const routes = {};
Object.entries(routePaths).forEach(([key, path]) => {
  try {
    routes[key] = require(path);
  } catch (error) {
    logger.warn('DASHBOARD', \`⚠️ Route module \${path} not found, will create a default\`);
    // A default route will be created by the setup script
  }
});`;

    content = content.replace(oldImports, newImports);
    
    fs.writeFileSync(dashboardJsPath, content);
    console.log('Updated dashboard.js imports');
  }
}

// Setup theme with Luna colors
function setupTheme() {
  const themePath = path.join(dashboardDir, 'src', 'themes', 'default', 'style.css');
  
  // Create default theme directory if it doesn't exist
  const themeDir = path.join(dashboardDir, 'src', 'themes', 'default');
  if (!fs.existsSync(themeDir)) {
    fs.mkdirSync(themeDir, { recursive: true });
  }
  
  // Create or update theme file with Luna colors
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
}`;

  fs.writeFileSync(themePath, cssContent);
  console.log('Created Luna theme CSS');
}

// Main fix function
async function fixDashboard() {
  try {
    console.log('Starting dashboard fix process...');
    
    // Check if dashboard directory exists
    const dashboardExists = checkDashboardDir();
    
    // Create necessary directories
    createDashboardDirs();
    
    // Create package.json if needed
    createPackageJson();
    
    // Create default config
    createDefaultConfig();
    
    // Update dashboard.js imports
    updateDashboardImports();
    
    // Setup theme
    setupTheme();
    
    // Install necessary packages
    await installPackages();
    
    // Create dashboard routes
    await createDashboardRoutes();
    
    console.log('Dashboard fix process completed successfully!');
    console.log('You can now run the bot with the dashboard functionality.');
  } catch (error) {
    console.error('Error fixing dashboard:', error);
  }
}

// Run if script is executed directly
if (require.main === module) {
  fixDashboard();
}

module.exports = { fixDashboard }; 