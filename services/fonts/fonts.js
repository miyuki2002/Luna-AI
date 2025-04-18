const { registerFont } = require('canvas');
const path = require('path');

class FontManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Khởi tạo và đăng ký fonts
   * @param {string} assetsPath - Đường dẫn tới thư mục assets
   */
  async initialize(assetsPath) {
    if (this.initialized) return;

    try {
      const fontsPath = path.join(assetsPath, 'fonts');
      
      // Map giữa weights dạng chữ và số
      const fontWeightMappings = {
        'Thin': 100,
        'ExtraLight': 200,
        'Light': 300,
        'Regular': 400,
        'Medium': 500,
        'SemiBold': 600,
        'Bold': 700,
        'ExtraBold': 800,
        'Black': 900
      };
      
      // Đăng ký tất cả các biến thể của Montserrat
      const fontVariants = [
        { file: 'Montserrat-Thin.otf', weight: 'Thin', style: 'normal' },
        { file: 'Montserrat-ThinItalic.otf', weight: 'Thin', style: 'italic' },
        { file: 'Montserrat-ExtraLight.otf', weight: 'ExtraLight', style: 'normal' },
        { file: 'Montserrat-ExtraLightItalic.otf', weight: 'ExtraLight', style: 'italic' },
        { file: 'Montserrat-Light.otf', weight: 'Light', style: 'normal' },
        { file: 'Montserrat-LightItalic.otf', weight: 'Light', style: 'italic' },
        { file: 'Montserrat-Regular.otf', weight: 'Regular', style: 'normal' },
        { file: 'Montserrat-Italic.otf', weight: 'Regular', style: 'italic' },
        { file: 'Montserrat-Medium.otf', weight: 'Medium', style: 'normal' },
        { file: 'Montserrat-MediumItalic.otf', weight: 'Medium', style: 'italic' },
        { file: 'Montserrat-SemiBold.otf', weight: 'SemiBold', style: 'normal' },
        { file: 'Montserrat-SemiBoldItalic.otf', weight: 'SemiBold', style: 'italic' },
        { file: 'Montserrat-Bold.otf', weight: 'Bold', style: 'normal' },
        { file: 'Montserrat-BoldItalic.otf', weight: 'Bold', style: 'italic' },
        { file: 'Montserrat-ExtraBold.otf', weight: 'ExtraBold', style: 'normal' },
        { file: 'Montserrat-ExtraBoldItalic.otf', weight: 'ExtraBold', style: 'italic' },
        { file: 'Montserrat-Black.otf', weight: 'Black', style: 'normal' },
        { file: 'Montserrat-BlackItalic.otf', weight: 'Black', style: 'italic' }
      ];
      
      // Đăng ký fonts với các cách khác nhau để tăng khả năng tương thích với Pango
      for (const variant of fontVariants) {
        try {
          // Cách 1: Đăng ký với tên weight
          registerFont(path.join(fontsPath, variant.file), {
            family: 'Montserrat',
            weight: variant.weight === 'Regular' ? 'normal' : variant.weight.toLowerCase(),
            style: variant.style
          });
          
          // Cách 2: Đăng ký với số weight
          registerFont(path.join(fontsPath, variant.file), {
            family: 'Montserrat',
            weight: fontWeightMappings[variant.weight].toString(),
            style: variant.style
          });
          
          // Cách 3: Đăng ký không có rotation
          registerFont(path.join(fontsPath, variant.file), {
            family: 'Montserrat',
            weight: variant.weight === 'Regular' ? 'normal' : variant.weight.toLowerCase(),
            style: variant.style,
            rotate: false
          });
          
          // Cách 4: Đăng ký không có rotation với số weight
          registerFont(path.join(fontsPath, variant.file), {
            family: 'Montserrat',
            weight: fontWeightMappings[variant.weight].toString(),
            style: variant.style,
            rotate: false
          });
        } catch (err) {
          console.warn(`Không thể đăng ký font ${variant.file}:`, err);
        }
      }
      
      console.log('Đã đăng ký fonts thành công');
      this.initialized = true;
    } catch (error) {
      console.error('Lỗi khi đăng ký fonts:', error);
      console.warn('Sẽ sử dụng font dự phòng');
    }
  }
}

// Export instance duy nhất của FontManager
module.exports = new FontManager();