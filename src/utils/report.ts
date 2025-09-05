import * as fs from 'fs/promises';
import * as path from 'path';
import type { DeckAnalysis } from '../api/types.js';
import type { TournamentLineup } from '../analyzer/optimizer.js';
import { DeckOptimizer } from '../analyzer/optimizer.js';

export interface ReportData {
  timestamp: string;
  coverage: number;
  deckCount: number;
  matchupCount: number;
  analyses: DeckAnalysis[];
  lineup: TournamentLineup;
  optimizer?: DeckOptimizer; // Optional optimizer for complete report generation
}

export class ReportGenerator {
  private dataDir: string;
  private weeklyDir: string;

  constructor(dataDir: string = 'data', weeklyDir: string = 'weekly-reports') {
    this.dataDir = path.resolve(dataDir);
    this.weeklyDir = path.resolve(weeklyDir);
  }

  /**
   * 詳細レポートを生成 (latest_report.md)
   */
  async generateDetailedReport(data: ReportData): Promise<string> {
    const report = this.buildDetailedReportContent(data);
    
    const filepath = path.join(this.dataDir, 'latest_report.md');
    await fs.writeFile(filepath, report);
    
    return 'latest_report.md';
  }

  /**
   * 週次アーカイブレポートを生成
   */
  async generateWeeklyReport(data: ReportData): Promise<string> {
    await fs.mkdir(this.weeklyDir, { recursive: true });
    
    const date = new Date();
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    
    const filename = `weekly-report-${year}-W${week.toString().padStart(2, '0')}_${timestamp}.md`;
    const filepath = path.join(this.weeklyDir, filename);
    
    // 週次レポート用の追加情報を含むコンテンツ
    const report = this.buildWeeklyReportContent(data, year, week);
    await fs.writeFile(filepath, report);
    
    return filename;
  }

  /**
   * 詳細レポートのコンテンツを構築
   */
  private buildDetailedReportContent(data: ReportData): string {
    // DeckOptimizerが利用可能な場合は、その完全なレポートを使用
    if (data.optimizer) {
      return data.optimizer.generateDetailedReport();
    }
    
    // フォールバック: 従来の簡易レポート生成
    const date = new Date(data.timestamp);
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    
    const sortedAnalyses = data.analyses.sort((a, b) => b.expectedWinRate - a.expectedWinRate);
    
    // Tier分類
    const tierGroups = {
      'SS': sortedAnalyses.filter(a => a.tier === 'SS'),
      'S': sortedAnalyses.filter(a => a.tier === 'S'),
      'A+': sortedAnalyses.filter(a => a.tier === 'A+'),
      'A': sortedAnalyses.filter(a => a.tier === 'A'),
      'B': sortedAnalyses.filter(a => a.tier === 'B'),
      'C': sortedAnalyses.filter(a => a.tier === 'C')
    };

    let report = `# ポケモンカード環境分析レポート
## 環境適応型メタスコア算出法による分析
生成日時: ${jstDate.getFullYear()}/${(jstDate.getMonth() + 1).toString().padStart(2, '0')}/${jstDate.getDate().toString().padStart(2, '0')} ${jstDate.getHours().toString().padStart(2, '0')}:${jstDate.getMinutes().toString().padStart(2, '0')}:${jstDate.getSeconds().toString().padStart(2, '0')}
環境カバー率: ${data.coverage.toFixed(1)}%
分析対象デッキ数: ${data.deckCount}個

---

## 🏆 推奨トーナメント構成

### メインデッキ
**${data.lineup.main.deck.name}**
- Tier: ${data.lineup.main.tier}
- 期待勝率: ${data.lineup.main.expectedWinRate.toFixed(2)}%
- 全体勝率: ${data.lineup.main.deck.winRate.toFixed(2)}%
- 環境シェア: ${data.lineup.main.deck.share.toFixed(1)}%
- 信頼度: ${data.lineup.main.confidence}%

`;

    // 有利/不利な相性を表示
    if (data.lineup.main.favorableMatchups && data.lineup.main.favorableMatchups.length > 0) {
      report += `**有利な相性:**\n`;
      data.lineup.main.favorableMatchups.slice(0, 3).forEach(matchup => {
        report += `- ${matchup[0]} (${matchup[1].toFixed(1)}%)\n`;
      });
      report += '\n';
    }

    if (data.lineup.main.unfavorableMatchups && data.lineup.main.unfavorableMatchups.length > 0) {
      report += `**不利な相性:**\n`;
      data.lineup.main.unfavorableMatchups.slice(0, 3).forEach(matchup => {
        report += `- ${matchup[0]} (${matchup[1].toFixed(1)}%)\n`;
      });
      report += '\n';
    }

    // サブデッキ
    report += `### サブデッキ\n`;
    if (data.lineup.sub) {
      report += `**${data.lineup.sub.deck.name}**
- Tier: ${data.lineup.sub.tier}
- 期待勝率: ${data.lineup.sub.expectedWinRate.toFixed(2)}%
- メインデッキの弱点をカバー

`;
    } else {
      report += `適切なサブデッキが見つかりません\n\n`;
    }

    // メタ読みデッキ
    report += `### メタ読みデッキ\n`;
    if (data.lineup.meta) {
      report += `**${data.lineup.meta.deck.name}**
- Tier: ${data.lineup.meta.tier}
- 期待勝率: ${data.lineup.meta.expectedWinRate.toFixed(2)}%
- 低使用率の隠れた強デッキ

`;
    } else {
      report += `メタ読み候補なし\n\n`;
    }

    report += `---

## 📊 Tierリスト（期待勝率順）

`;

    // 各Tierごとにデッキを表示
    Object.entries(tierGroups).forEach(([tier, decks]) => {
      if (decks.length > 0) {
        const tierDesc = this.getTierDescription(tier);
        report += `### Tier ${tier}\n`;
        decks.forEach(analysis => {
          const diff = analysis.expectedWinRate - analysis.deck.winRate;
          const diffIcon = diff > 1 ? '📈' : diff < -1 ? '📉' : '➡️';
          report += `- **${analysis.deck.name}**: 期待${analysis.expectedWinRate.toFixed(1)}% (全体${analysis.deck.winRate.toFixed(1)}% ${diffIcon}${Math.abs(diff).toFixed(1)}%) [シェア${analysis.deck.share.toFixed(1)}%]\n`;
        });
        report += '\n';
      }
    });

    // 環境分析サマリー
    const usableDecks = sortedAnalyses.filter(a => a.expectedWinRate >= 53).length;
    const hiddenGems = sortedAnalyses.filter(a => a.deck.share < 5 && a.expectedWinRate >= 53);
    const topUsageDeck = data.analyses.reduce((prev, curr) => prev.deck.share > curr.deck.share ? prev : curr);
    const topExpectedDeck = sortedAnalyses[0];

    report += `
---

## 📈 環境分析サマリー

### 主要な発見
- **使用率1位の${topUsageDeck.deck.name}より、期待勝率では${topExpectedDeck.deck.name}が優秀**`;

    if (hiddenGems.length > 0) {
      const bestHidden = hiddenGems[0];
      const hiddenBonus = bestHidden.expectedWinRate - bestHidden.deck.winRate;
      report += `\n- **注目の隠れ強デッキ**: ${bestHidden.deck.name} (期待勝率+${hiddenBonus.toFixed(1)}%)`;
    }

    report += `\n- **実用レベル(53%+)のデッキ数**: ${usableDecks}個 - ${this.getEnvironmentDescription(usableDecks)}

### 推奨戦略
- **${data.lineup.main.deck.name}を軸とした構築**が現環境で最も期待値が高い
- 環境上位デッキ（${topUsageDeck.deck.name}`;

    const secondUsage = data.analyses
      .filter(a => a.deck.name !== topUsageDeck.deck.name)
      .reduce((prev, curr) => prev.deck.share > curr.deck.share ? prev : curr);
    
    report += `, ${secondUsage.deck.name}）への対策が重要`;

    if (data.lineup.sub) {
      report += `\n- サブデッキに${data.lineup.sub.deck.name}を採用してメタ対応`;
    }

    report += `

---

*このレポートは環境適応型メタスコア算出法に基づいています。*
*継続的な環境変化に対応するため、定期的な更新を推奨します。*
`;

    return report;
  }

  /**
   * 週次レポート用の拡張コンテンツを構築
   */
  private buildWeeklyReportContent(data: ReportData, year: number, week: number): string {
    const baseReport = this.buildDetailedReportContent(data);
    
    // 週次レポート用のヘッダーを追加
    const weeklyHeader = `# 📅 週次環境分析レポート - ${year}年第${week}週

> **環境適応型メタスコア算出法による自動分析**  
> 生成日時: ${new Date(data.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}  
> 分析規模: ${data.deckCount}デッキ、${data.matchupCount}マッチアップ記録

`;

    // 週次統計情報を追加
    const sortedAnalyses = data.analyses.sort((a, b) => b.expectedWinRate - a.expectedWinRate);
    const weeklyStats = `
## 📊 週次統計サマリー

- **最高期待勝率**: ${sortedAnalyses[0].expectedWinRate.toFixed(1)}% (${sortedAnalyses[0].deck.name})
- **環境カバー率**: ${data.coverage.toFixed(1)}%
- **実用デッキ数**: ${sortedAnalyses.filter(a => a.expectedWinRate >= 53).length}個
- **隠れ強デッキ**: ${sortedAnalyses.filter(a => a.deck.share < 5 && a.expectedWinRate >= 53).length}個発見

---

`;

    return weeklyHeader + weeklyStats + baseReport.substring(baseReport.indexOf('## 環境適応型メタスコア算出法による分析'));
  }

  private getTierDescription(tier: string): string {
    const descriptions = {
      'SS': '環境支配',
      'S': '最強候補',
      'A+': '実用最強',
      'A': '実用可能',
      'B': '特殊戦略',
      'C': '趣味構築'
    };
    return descriptions[tier as keyof typeof descriptions] || '';
  }

  private getEnvironmentDescription(usableCount: number): string {
    if (usableCount >= 12) return '非常に多様な環境';
    if (usableCount >= 8) return '多様な環境';
    if (usableCount >= 5) return '中程度な環境';
    return '限定的な環境';
  }

  /**
   * 週番号を取得（ISO 8601準拠）
   */
  private getWeekNumber(date: Date): number {
    const tempDate = new Date(date.getTime());
    const dayOfWeek = (tempDate.getDay() + 6) % 7;
    tempDate.setDate(tempDate.getDate() - dayOfWeek + 3);
    const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
    return Math.ceil(((tempDate.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7);
  }
}