import { promises as fs } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface LocalSyncConfig {
  localBasePath: string;
  obsidianVaultPath?: string;
  autoSync: boolean;
  gitPull: boolean;
}

export class LocalSync {
  private config: LocalSyncConfig;

  constructor(config: LocalSyncConfig) {
    this.config = config;
  }

  /**
   * GitHub Actionsの出力をローカルフォルダに自動同期
   */
  async syncGitHubActionOutput(): Promise<void> {
    console.log('🔄 Starting local sync process...');
    
    try {
      // Git pullで最新データを取得
      if (this.config.gitPull) {
        console.log('📥 Pulling latest data from GitHub...');
        execSync('git pull origin main', { cwd: process.cwd() });
      }

      // データフォルダの同期
      await this.syncDataFiles();
      
      // ObsidianVaultとの連携（オプション）
      if (this.config.obsidianVaultPath) {
        await this.syncToObsidianVault();
      }

      console.log('✅ Local sync completed successfully');
    } catch (error) {
      console.error('❌ Local sync failed:', error);
      throw error;
    }
  }

  /**
   * データファイルをローカルの指定パスに同期
   */
  private async syncDataFiles(): Promise<void> {
    const sourceDir = join(process.cwd(), 'data');
    const targetDir = join(this.config.localBasePath, 'pokemon-tcgp-meta-data');

    console.log(`📁 Syncing data from ${sourceDir} to ${targetDir}`);

    // ターゲットディレクトリが存在しない場合は作成
    await fs.mkdir(targetDir, { recursive: true });

    // weekly-reportsディレクトリも同期
    const weeklyReportsSource = join(process.cwd(), 'weekly-reports');
    const weeklyReportsTarget = join(targetDir, 'weekly-reports');
    await fs.mkdir(weeklyReportsTarget, { recursive: true });

    try {
      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        const sourcePath = join(sourceDir, file);
        const targetPath = join(targetDir, file);
        
        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`📄 Copied: ${file}`);
        }
      }

      // weekly-reportsの同期
      if (await this.directoryExists(weeklyReportsSource)) {
        const weeklyFiles = await fs.readdir(weeklyReportsSource);
        for (const file of weeklyFiles) {
          const sourcePath = join(weeklyReportsSource, file);
          const targetPath = join(weeklyReportsTarget, file);
          
          const stats = await fs.stat(sourcePath);
          if (stats.isFile()) {
            await fs.copyFile(sourcePath, targetPath);
            console.log(`📊 Copied weekly report: ${file}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error syncing data files:', error);
      throw error;
    }
  }

  /**
   * ObsidianVaultへの特別な同期処理
   */
  private async syncToObsidianVault(): Promise<void> {
    if (!this.config.obsidianVaultPath) return;

    console.log('📝 Syncing to Obsidian Vault...');
    
    const obsidianMetaDir = join(this.config.obsidianVaultPath, '09_PokemonTCGP_Meta');
    await fs.mkdir(obsidianMetaDir, { recursive: true });

    // 最新レポートをObsidianに配置
    const latestReportSource = join(process.cwd(), 'data', 'latest_report.md');
    
    if (await this.fileExists(latestReportSource)) {
      const targetPath = join(obsidianMetaDir, `Pokemon_Meta_${new Date().toISOString().split('T')[0]}.md`);
      await fs.copyFile(latestReportSource, targetPath);
      
      // Obsidian用のメタデータを追加
      const content = await fs.readFile(targetPath, 'utf-8');
      const obsidianContent = this.addObsidianMetadata(content);
      await fs.writeFile(targetPath, obsidianContent);
      
      console.log(`📝 Synced to Obsidian: ${targetPath}`);
    }
  }

  /**
   * Obsidian用のメタデータを追加
   */
  private addObsidianMetadata(content: string): string {
    const date = new Date().toISOString().split('T')[0];
    const metadata = `---
tags: [pokemon-tcgp, meta-analysis, auto-generated]
date: ${date}
type: weekly-report
source: github-actions
---

`;
    return metadata + content;
  }

  /**
   * ファイル存在チェック
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリ存在チェック
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 設定ファイルから同期設定を読み込み
   */
  static async loadConfig(configPath: string): Promise<LocalSyncConfig> {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.log('⚠️ Config file not found, using defaults');
      return {
        localBasePath: 'C:\\Users\\81802\\Documents\\Pokemon-TCGP-Data',
        obsidianVaultPath: 'C:\\ObsidianVault',
        autoSync: true,
        gitPull: true
      };
    }
  }
}

// CLI実行用
async function main() {
  try {
    const config = await LocalSync.loadConfig('./local-sync-config.json');
    const sync = new LocalSync(config);
    await sync.syncGitHubActionOutput();
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// ES modules用の実行チェック
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}