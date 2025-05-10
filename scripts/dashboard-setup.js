const { fixDashboard } = require('./fix-dashboard');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Paths
const rootDir = path.join(__dirname, '..');
const dashboardDir = path.join(rootDir, 'Luna-Dashboard');

// Check and create .env file if it doesn't exist
async function checkEnvFile() {
  const envPath = path.join(rootDir, '.env');
  const exampleEnvPath = path.join(rootDir, 'example.env');
  
  if (!fs.existsSync(envPath) && fs.existsSync(exampleEnvPath)) {
    console.log('Creating .env file from example.env...');
    fs.copyFileSync(exampleEnvPath, envPath);
    console.log('Created .env file. Please edit it with your actual credentials.');
  }
}

// Verify the dependencies in package.json
async function verifyDependencies() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDeps = {
      'express': '^4.18.2',
      'express-session': '^1.17.3',
      'passport': '^0.6.0',
      'passport-discord': '^0.1.4', 
      'body-parser': '^1.20.2',
      'ejs': '^3.1.9',
      'connect-mongo': '^5.0.0'
    };
    
    let missingDeps = [];
    
    // Check for missing dependencies
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!packageJson.dependencies[dep]) {
        missingDeps.push(`${dep}@${version}`);
      }
    }
    
    // Install missing dependencies
    if (missingDeps.length > 0) {
      console.log(`Installing missing dependencies: ${missingDeps.join(', ')}`);
      
      return new Promise((resolve, reject) => {
        exec(`npm install ${missingDeps.join(' ')} --save`, { cwd: rootDir }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error installing dependencies: ${error.message}`);
            return reject(error);
          }
          console.log('Successfully installed missing dependencies');
          resolve();
        });
      });
    }
  }
}

// Main dashboard setup function
async function setupDashboard() {
  try {
    console.log('🚀 Starting Luna AI Dashboard setup...');
    
    // Check and create .env file if needed
    await checkEnvFile();
    
    // Verify dependencies
    await verifyDependencies();
    
    // Fix dashboard
    await fixDashboard();
    
    console.log('✅ Dashboard setup completed successfully!');
    console.log('');
    console.log('What to do next:');
    console.log('1. Make sure your .env file contains all necessary variables:');
    console.log('   - CLIENT_SECRET (Discord Bot Client Secret)');
    console.log('   - CALLBACK_URL (default: http://localhost:3000/login/api)');
    console.log('   - DASHBOARD_PORT (default: 3000)');
    console.log('');
    console.log('2. Start your bot with: npm start');
    console.log('3. Access the dashboard at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error setting up dashboard:', error);
    console.log('Please run the setup again or check the error logs.');
  }
}

// Run if executed directly
if (require.main === module) {
  setupDashboard();
}

module.exports = { setupDashboard }; 