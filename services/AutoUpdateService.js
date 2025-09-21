const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { execSync } = require('child_process');

class AutoUpdateService {
    constructor() {
        this.git = simpleGit();
        this.repositoryPath = process.cwd();
        this.packageJsonPath = path.join(this.repositoryPath, 'package.json');
    }

    /**
     * Kiểm tra và thực hiện auto-update từ GitHub
     */
    async checkAndUpdate() {
        try {
            logger.info('SYSTEM', 'Kiểm tra cập nhật từ GitHub...');
            
            const isGitRepo = await this.isGitRepository();
            if (!isGitRepo) {
                logger.warn('SYSTEM', 'Không phải Git repository, bỏ qua auto-update');
                return false;
            }

            const currentBranch = await this.getCurrentBranch();
            logger.info('SYSTEM', `Branch hiện tại: ${currentBranch}`);

            await this.git.fetch();
            
            const status = await this.git.status();
            const localCommit = await this.git.revparse(['HEAD']);
            const remoteCommit = await this.git.revparse([`origin/${currentBranch}`]);

            if (localCommit === remoteCommit) {
                logger.info('SYSTEM', 'Code đã được cập nhật mới nhất');
                return false;
            }

            logger.info('SYSTEM', 'Phát hiện version mới, đang cập nhật...');

            if (status.files.length > 0) {
                logger.warn('SYSTEM', 'Có thay đổi local chưa commit, tạo stash...');
                await this.git.stash();
            }

            const pullResult = await this.git.pull('origin', currentBranch);
            
            if (pullResult.summary.changes > 0) {
                logger.info('SYSTEM', `Đã cập nhật ${pullResult.summary.changes} files`);
                
                const packageChanged = pullResult.files.some(file => file.includes('package.json'));
                
                if (packageChanged) {
                    logger.info('SYSTEM', 'Package.json đã thay đổi, cập nhật dependencies...');
                    await this.updateDependencies();
                }

                logger.info('SYSTEM', 'Chuẩn bị restart bot để áp dụng thay đổi...');
                
                setTimeout(() => {
                    logger.info('SYSTEM', 'Restarting bot...');
                    process.exit(0);
                }, 2000);

                return true;
            }

        } catch (error) {
            logger.error('SYSTEM', 'Lỗi khi auto-update:', error.message);
            return false;
        }
    }

    /**
     * Kiểm tra xem có phải Git repository không
     */
    async isGitRepository() {
        try {
            await this.git.revparse(['--git-dir']);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Lấy tên branch hiện tại
     */
    async getCurrentBranch() {
        try {
            const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
            return branch.trim();
        } catch (error) {
            return 'main'; // fallback
        }
    }

    /**
     * Cập nhật dependencies nếu package.json thay đổi
     */
    async updateDependencies() {
        try {
            logger.info('SYSTEM', 'Đang cài đặt dependencies mới...');
            
            const hasYarnLock = fs.existsSync(path.join(this.repositoryPath, 'yarn.lock'));
            const hasPackageLock = fs.existsSync(path.join(this.repositoryPath, 'package-lock.json'));
            
            let command;
            if (hasYarnLock) {
                command = 'yarn install --frozen-lockfile';
            } else if (hasPackageLock) {
                command = 'npm ci';
            } else {
                command = 'npm install';
            }

            execSync(command, { 
                cwd: this.repositoryPath,
                stdio: 'inherit'
            });

            logger.info('SYSTEM', 'Dependencies đã được cập nhật');
        } catch (error) {
            logger.error('SYSTEM', 'Lỗi khi cập nhật dependencies:', error.message);
            throw error;
        }
    }

    /**
     * Lấy thông tin version hiện tại
     */
    getCurrentVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
            return packageJson.version || '1.0.0';
        } catch (error) {
            logger.error('SYSTEM', 'Không thể đọc version từ package.json:', error.message);
            return '1.0.0';
        }
    }

    /**
     * Tạo backup trước khi update (optional)
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(this.repositoryPath, 'backups', `backup-${timestamp}`);
            
            fs.mkdirSync(backupDir, { recursive: true });
            
            logger.info('SYSTEM', `Tạo backup tại: ${backupDir}`);
            
            return backupDir;
        } catch (error) {
            logger.error('SYSTEM', `Lỗi khi tạo backup:`, error.message);
            return null;
        }
    }
}

module.exports = AutoUpdateService;
