const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger.js');

/**
 * Script để chuẩn bị và thiết lập dashboard cho Luna AI
 * Script này sẽ:
 * 1. Cài đặt các gói phụ thuộc cần thiết
 * 2. Tạo các thư mục cần thiết
 * 3. Sao chép các tệp tin cần thiết từ dashboard gốc
 * 4. Tùy chỉnh giao diện theo Luna AI
 */

// Đường dẫn đến thư mục gốc của dự án
const rootDir = path.join(__dirname, '..');

// Đường dẫn đến thư mục dashboard
const dashboardDir = path.join(rootDir, 'Luna-Dashboard');

// Các gói phụ thuộc cần cài đặt
const dependencies = [
  'express',
  'express-session',
  'passport',
  'passport-discord',
  'body-parser',
  'ejs',
  'connect-mongo',
  'crypto',
  'multer',
  'fs-extra'
];

// Tạo thư mục nếu chưa tồn tại
function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Đã tạo thư mục: ${dir}`);
  }
}

// Sao chép thư mục
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Chỉnh sửa tệp package.json để thêm các gói phụ thuộc
function updatePackageJson() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const dashboardPackageJsonPath = path.join(dashboardDir, 'src', 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error('Không tìm thấy file package.json trong thư mục gốc của dự án');
    return;
  }

  if (!fs.existsSync(dashboardPackageJsonPath)) {
    console.error('Không tìm thấy file package.json trong thư mục dashboard');
    return;
  }

  // Đọc package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dashboardPackageJson = JSON.parse(fs.readFileSync(dashboardPackageJsonPath, 'utf8'));

  // Thêm các gói từ dashboard vào package.json chính
  for (const [dependency, version] of Object.entries(dashboardPackageJson.dependencies || {})) {
    if (!packageJson.dependencies[dependency]) {
      packageJson.dependencies[dependency] = version;
    }
  }

  // Cập nhật package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Đã cập nhật file package.json');
}

// Cài đặt các gói phụ thuộc
function installDependencies() {
  return new Promise((resolve, reject) => {
    console.log('Đang cài đặt các gói phụ thuộc...');
    
    const installCommand = 'npm install ' + dependencies.join(' ');
    
    exec(installCommand, { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Lỗi khi cài đặt các gói phụ thuộc: ${error.message}`);
        reject(error);
        return;
      }
      
      console.log('Đã cài đặt xong các gói phụ thuộc');
      resolve();
    });
  });
}

// Tùy chỉnh giao diện theo Luna AI
function customizeTheme() {
  // Đường dẫn đến thư mục theme
  const themeDir = path.join(dashboardDir, 'src', 'themes', 'default');
  
  // Kiểm tra xem thư mục theme có tồn tại không
  if (!fs.existsSync(themeDir)) {
    console.error('Không tìm thấy thư mục theme');
    return;
  }
  
  // Đường dẫn đến file CSS
  const cssFile = path.join(themeDir, 'style.css');
  
  // Kiểm tra xem file CSS có tồn tại không
  if (!fs.existsSync(cssFile)) {
    console.error('Không tìm thấy file CSS');
    return;
  }
  
  // Đọc nội dung file CSS
  let cssContent = fs.readFileSync(cssFile, 'utf8');
  
  // Thay đổi màu chủ đạo
  cssContent = cssContent.replace(
    /:root {[\s\S]*?}/,
    `:root {
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
}`
  );
  
  // Lưu nội dung file CSS
  fs.writeFileSync(cssFile, cssContent);
  console.log('Đã tùy chỉnh giao diện thành công');
}

// Tạo cấu hình dashboard
function createDashboardConfig() {
  const configDir = path.join(dashboardDir, 'src', 'config');
  
  // Kiểm tra xem thư mục config có tồn tại không
  if (!fs.existsSync(configDir)) {
    console.error('Không tìm thấy thư mục config');
    return;
  }
  
  // Đường dẫn đến file config.json
  const configFile = path.join(configDir, 'config.json');
  
  // Đường dẫn đến file config.default.json
  const defaultConfigFile = path.join(configDir, 'config.default.json');
  
  // Kiểm tra xem file config.default.json có tồn tại không
  if (!fs.existsSync(defaultConfigFile)) {
    console.error('Không tìm thấy file config.default.json');
    return;
  }
  
  // Đọc nội dung file config.default.json
  const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigFile, 'utf8'));
  
  // Kiểm tra xem file .env có tồn tại không
  const envFile = path.join(rootDir, '.env');
  
  if (fs.existsSync(envFile)) {
    // Tạo config mới từ config.default.json
    const newConfig = { ...defaultConfig };
    
    // Lưu config mới
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
    console.log('Đã tạo file config.json cho dashboard');
  } else {
    // Sao chép config.default.json sang config.json
    fs.copyFileSync(defaultConfigFile, configFile);
    console.log('Đã sao chép file config.default.json sang config.json');
  }
  
  // Cập nhật theme.json
  const themeJsonPath = path.join(configDir, 'theme.json');
  const themeConfig = {
    theme: "default"
  };
  fs.writeFileSync(themeJsonPath, JSON.stringify(themeConfig, null, 2));
  console.log('Đã cập nhật file theme.json');
}

// Hàm chính
async function setup() {
  try {
    console.log('Bắt đầu thiết lập dashboard cho Luna AI...');
    
    // Kiểm tra xem thư mục dashboard có tồn tại không
    if (!fs.existsSync(dashboardDir)) {
      console.error('Không tìm thấy thư mục Luna-Dashboard, hãy chạy lệnh `git clone https://github.com/LachlanDev/Discord-BOT-Dashboard-V2.git Luna-Dashboard` trước');
      return;
    }
    
    // Tạo thư mục scripts nếu chưa tồn tại
    createDirectoryIfNotExists(path.join(rootDir, 'scripts'));
    
    // Cập nhật package.json
    updatePackageJson();
    
    // Cài đặt các gói phụ thuộc
    await installDependencies();
    
    // Tùy chỉnh giao diện
    customizeTheme();
    
    // Tạo cấu hình dashboard
    createDashboardConfig();
    
    console.log('Đã thiết lập dashboard cho Luna AI thành công, bây giờ bạn có thể khởi động bot');
    console.log('Để truy cập dashboard, hãy mở trình duyệt và truy cập địa chỉ http://localhost:3000');
  } catch (error) {
    console.error('Lỗi khi thiết lập dashboard:', error);
  }
}

// Chạy hàm chính nếu file được chạy trực tiếp
if (require.main === module) {
  setup();
}

module.exports = { setup }; 