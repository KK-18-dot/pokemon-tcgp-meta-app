import * as fs from 'fs/promises';
import * as path from 'path';
import type { Deck } from '../api/types.js';

export interface StoredData {
  decks: Deck[];
  matchups: Array<{
    deck: string;
    matchups: Array<[string, number]>;
  }>;
  timestamp: string;
  coverage: number;
}

export class DataStorage {
  private dataDir: string;
  private weeklyDir: string;

  constructor(dataDir: string = 'data') {
    this.dataDir = path.resolve(dataDir);
    this.weeklyDir = path.resolve('weekly-reports');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async saveData(data: StoredData): Promise<string> {
    await this.initialize();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `decks_${timestamp}.json`;
    const filepath = path.join(this.dataDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    // 最新データのシンボリックリンクを作成（または更新）
    const latestPath = path.join(this.dataDir, 'latest.json');
    try {
      await fs.unlink(latestPath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
    
    // Windows環境ではコピーを作成
    await fs.copyFile(filepath, latestPath);
    
    return filename;
  }

  async loadLatestData(): Promise<StoredData | null> {
    try {
      const latestPath = path.join(this.dataDir, 'latest.json');
      const data = await fs.readFile(latestPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Latest data not found, trying to find most recent file...');
      return this.loadMostRecentData();
    }
  }

  async loadMostRecentData(): Promise<StoredData | null> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.dataDir);
      const dataFiles = files
        .filter(file => file.startsWith('decks_') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (dataFiles.length === 0) {
        return null;
      }
      
      const mostRecentFile = dataFiles[0];
      const data = await fs.readFile(path.join(this.dataDir, mostRecentFile), 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load data:', error);
      return null;
    }
  }

  async saveReport(report: string): Promise<string> {
    await this.initialize();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report_${timestamp}.md`;
    const filepath = path.join(this.dataDir, filename);
    
    await fs.writeFile(filepath, report);
    
    // 最新レポートのシンボリックリンクを作成
    const latestReportPath = path.join(this.dataDir, 'latest_report.md');
    try {
      await fs.unlink(latestReportPath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
    
    await fs.copyFile(filepath, latestReportPath);
    
    return filename;
  }

  async getStoredDataHistory(limit: number = 10): Promise<StoredData[]> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.dataDir);
      const dataFiles = files
        .filter(file => file.startsWith('decks_') && file.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
      
      const history: StoredData[] = [];
      
      for (const file of dataFiles) {
        try {
          const data = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
          history.push(JSON.parse(data));
        } catch (error) {
          console.warn(`Failed to load historical data from ${file}:`, error);
        }
      }
      
      return history;
    } catch (error) {
      console.error('Failed to get data history:', error);
      return [];
    }
  }

  async cleanOldFiles(keepDays: number = 30): Promise<void> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.dataDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      
      for (const file of files) {
        if (file === 'latest.json' || file === 'latest_report.md') {
          continue; // 最新ファイルは削除しない
        }
        
        const filepath = path.join(this.dataDir, file);
        const stat = await fs.stat(filepath);
        
        if (stat.mtime < cutoffDate) {
          await fs.unlink(filepath);
          console.log(`Cleaned old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to clean old files:', error);
    }
  }

  async exportToCSV(data: StoredData): Promise<string> {
    await this.initialize();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `decks_${timestamp}.csv`;
    const filepath = path.join(this.dataDir, filename);
    
    // CSVヘッダー
    const headers = [
      'Rank', 'Name', 'Count', 'Share', 'Score', 'WinRate', 'Wins', 'Losses', 'Ties'
    ];
    
    // CSVデータ
    const csvLines = [
      headers.join(','),
      ...data.decks.map(deck => [
        deck.rank,
        `"${deck.name}"`, // デッキ名はクォートで囲む
        deck.count,
        deck.share,
        `"${deck.score}"`,
        deck.winRate,
        deck.wins,
        deck.losses,
        deck.ties
      ].join(','))
    ];
    
    await fs.writeFile(filepath, csvLines.join('\n'));
    
    return filename;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * 週次レポート用のディレクトリを確保
   */
  async ensureWeeklyReportsDir(): Promise<void> {
    await fs.mkdir(this.weeklyDir, { recursive: true });
  }

  /**
   * 週次アーカイブとしてデータを保存
   */
  async saveWeeklyArchive(data: StoredData): Promise<string> {
    await this.ensureWeeklyReportsDir();
    
    const date = new Date();
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    
    const filename = `weekly-${year}-W${week.toString().padStart(2, '0')}_${timestamp}.json`;
    const filepath = path.join(this.weeklyDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    return filename;
  }

  /**
   * エラーログを保存
   */
  async saveErrorLog(errorData: { timestamp: string; error: string; stack?: string }): Promise<string> {
    await this.initialize();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error_${timestamp}.json`;
    const filepath = path.join(this.dataDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(errorData, null, 2));
    
    return filename;
  }

  /**
   * 週番号を取得（ISO 8601準拠）
   */
  private getWeekNumber(date: Date): number {
    const tempDate = new Date(date.getTime());
    const dayOfWeek = (tempDate.getDay() + 6) % 7; // 月曜日を0とする
    tempDate.setDate(tempDate.getDate() - dayOfWeek + 3); // 木曜日に設定
    const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
    return Math.ceil(((tempDate.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * 週次レポートディレクトリのパスを取得
   */
  getWeeklyDir(): string {
    return this.weeklyDir;
  }

  /**
   * 多様性指数の計算（Shannon's diversity index）
   */
  calculateDiversityIndex(decks: any[]): number {
    const totalShare = decks.reduce((sum, d) => sum + d.share, 0);
    if (totalShare === 0) return 0;
    
    const diversity = decks.reduce((sum, deck) => {
      const proportion = deck.share / totalShare;
      return sum - (proportion * Math.log(proportion));
    }, 0);
    
    return Math.exp(diversity); // Convert to effective number of species
  }

  /**
   * 日本語デッキ名翻訳
   */
  translateDeckName(name: string): string {
    const translations: Record<string, string> = {
      'Charizard ex': 'リザードンex',
      'Pikachu ex': 'ピカチュウex', 
      'Mewtwo ex': 'ミュウツーex',
      'Starmie ex': 'スターミーex',
      'Alakazam': 'フーディン',
      'Blastoise': 'カメックス',
      'Venusaur': 'フシギバナ',
      'Arcanine ex': 'ウインディex',
      'Machamp ex': 'カイリキーex',
      'Wigglytuff ex': 'プクリンex',
      'Sandslash': 'サンドパン',
      'Marowak ex': 'ガラガラex',
      'Dragonite': 'カイリュー',
      'Articuno ex': 'フリーザーex',
      'Zapdos ex': 'サンダーex',
      'Moltres ex': 'ファイヤーex'
    };
    
    return translations[name] || name;
  }

  /**
   * Tier分類の取得
   */
  getTier(expectedWinRate: number): string {
    if (expectedWinRate >= 57) return 'SS';
    if (expectedWinRate >= 55) return 'S';
    if (expectedWinRate >= 53) return 'A+';
    if (expectedWinRate >= 51) return 'A';
    if (expectedWinRate >= 49) return 'B';
    return 'C';
  }

  /**
   * 週次アーカイブ作成（改善版）
   */
  async createWeeklyArchive(): Promise<string> {
    try {
      const latestData = await this.loadLatestData();
      if (!latestData) {
        throw new Error('No latest data found for archiving');
      }

      return await this.saveWeeklyArchive(latestData);
    } catch (error) {
      console.error('Failed to create weekly archive:', error);
      throw error;
    }
  }
}