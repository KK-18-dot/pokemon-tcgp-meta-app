import type { Deck, DeckAnalysis } from '../api/types.js';


export interface TournamentLineup {
  main: DeckAnalysis & { 
    confidence?: number; 
    favorableMatchups?: Array<[string, number]>; 
    unfavorableMatchups?: Array<[string, number]>; 
  };
  sub: DeckAnalysis | null;
  meta: DeckAnalysis | null;
}

export class DeckOptimizer {
  private decks: Deck[];
  private matchups: Map<string, Map<string, number>>;
  private environmentCoverage: number;

  constructor(decks: Deck[], matchups: Map<string, Map<string, number>>) {
    this.decks = decks.sort((a, b) => b.share - a.share); // シェア率でソート
    this.matchups = matchups;
    this.environmentCoverage = this.calculateEnvironmentCoverage();
  }

  /**
   * 環境適応型期待勝率を計算
   * 核心概念：実際の環境分布を考慮した期待勝率
   */
  calculateExpectedWinRate(deckName: string): number {
    const deck = this.decks.find(d => d.name === deckName);
    if (!deck) return 0;

    let weightedWinRate = 0;
    let totalWeight = 0;

    // 各対戦相手に対する重み付き勝率を計算
    for (const opponent of this.decks) {
      if (opponent.name === deckName) continue;

      // 相性データがあれば使用、なければ全体勝率を使用
      const matchupData = this.matchups.get(deckName);
      const winRateVsOpponent = matchupData?.get(opponent.name) ?? deck.winRate;
      
      // 環境でのシェア率を重みとして適用
      const weight = opponent.share;
      weightedWinRate += winRateVsOpponent * weight;
      totalWeight += weight;
    }

    // 分析対象外の環境（残り%）は全体勝率を適用
    const remainingShare = 100 - this.environmentCoverage;
    if (remainingShare > 0) {
      weightedWinRate += deck.winRate * remainingShare;
      totalWeight += remainingShare;
    }

    return totalWeight > 0 ? weightedWinRate / totalWeight : deck.winRate;
  }

  /**
   * 環境カバー率を計算
   */
  private calculateEnvironmentCoverage(): number {
    return this.decks.reduce((sum, deck) => sum + deck.share, 0);
  }

  /**
   * Tier分類
   */
  private getTier(expectedWinRate: number): string {
    if (expectedWinRate >= 57.0) return 'SS (環境支配)';
    if (expectedWinRate >= 55.0) return 'S (最強候補)';
    if (expectedWinRate >= 53.0) return 'A+ (実用最強)';
    if (expectedWinRate >= 51.0) return 'A (実用可能)';
    if (expectedWinRate >= 49.0) return 'B (条件付き採用)';
    return 'C (非推奨)';
  }

  /**
   * 全デッキを分析してランキング作成
   */
  analyzeAllDecks(): DeckAnalysis[] {
    const analyses: DeckAnalysis[] = [];

    for (const deck of this.decks) {
      const expectedWinRate = this.calculateExpectedWinRate(deck.name);
      const { strengths, weaknesses } = this.analyzeMatchups(deck.name);

      analyses.push({
        deck,
        expectedWinRate,
        tier: this.getTier(expectedWinRate),
        confidenceLevel: this.calculateConfidence(deck),
        stability: this.calculateStability(deck.name),
        strengths,
        weaknesses
      });
    }

    // 期待勝率でソート
    analyses.sort((a, b) => b.expectedWinRate - a.expectedWinRate);
    return analyses;
  }

  /**
   * 最適な3デッキ構成を推奨
   */
  recommendTournamentLineup(): TournamentLineup {
    const analyses = this.analyzeAllDecks();
    
    // メインデッキ：期待勝率最高
    const baseMain = analyses[0];
    
    // メインデッキに追加情報を付与
    const main = {
      ...baseMain,
      confidence: Math.round(baseMain.confidenceLevel * 100),
      favorableMatchups: this.getFavorableMatchups(baseMain.deck.name),
      unfavorableMatchups: this.getUnfavorableMatchups(baseMain.deck.name)
    };
    
    // サブデッキ：メインの弱点をカバーする高勝率デッキ
    let sub: DeckAnalysis | null = null;
    for (const analysis of analyses.slice(1, 10)) {
      // メインデッキの弱点に強いデッキを探す
      const coversWeakness = main.weaknesses.some(weakness => {
        const weakDeck = weakness.split(' ')[0];
        return analysis.strengths.some(strength => strength.includes(weakDeck));
      });
      
      if (coversWeakness && analysis.expectedWinRate >= 51) {
        sub = analysis;
        break;
      }
    }

    // メタ読みデッキ：環境読みによる調整枠
    const meta = analyses.find(a => 
      a.deck.share < 5 && // 使用率が低い
      a.expectedWinRate >= 53 && // 期待勝率が高い
      a !== main && a !== sub
    ) || null;

    return { main, sub, meta };
  }

  /**
   * 詳細レポート生成
   */
  generateDetailedReport(): string {
    const analyses = this.analyzeAllDecks();
    const lineup = this.recommendTournamentLineup();
    const timestamp = new Date().toLocaleString('ja-JP');

    return `# ポケモンカード環境分析レポート
## 環境適応型メタスコア算出法による分析
生成日時: ${timestamp}
環境カバー率: ${this.environmentCoverage.toFixed(1)}%
分析対象デッキ数: ${this.decks.length}個

---

## 🏆 推奨トーナメント構成

### メインデッキ
**${lineup.main.deck.name}**
- Tier: ${lineup.main.tier}
- 期待勝率: ${lineup.main.expectedWinRate.toFixed(2)}%
- 全体勝率: ${lineup.main.deck.winRate.toFixed(2)}%
- 環境シェア: ${lineup.main.deck.share.toFixed(1)}%
- 信頼度: ${(lineup.main.confidenceLevel * 100).toFixed(0)}%

${lineup.main.strengths.length > 0 ? `**有利な相性:**
${lineup.main.strengths.map(s => `- ${s}`).join('\n')}` : ''}

${lineup.main.weaknesses.length > 0 ? `**不利な相性:**
${lineup.main.weaknesses.map(w => `- ${w}`).join('\n')}` : ''}

### サブデッキ
${lineup.sub ? `**${lineup.sub.deck.name}**
- Tier: ${lineup.sub.tier}
- 期待勝率: ${lineup.sub.expectedWinRate.toFixed(2)}%
- メインデッキの弱点をカバー` : '適切なサブデッキが見つかりません'}

### メタ読みデッキ
${lineup.meta ? `**${lineup.meta.deck.name}**
- Tier: ${lineup.meta.tier}
- 期待勝率: ${lineup.meta.expectedWinRate.toFixed(2)}%
- 低使用率の隠れた強デッキ` : '該当なし'}

---

## 📊 Tierリスト（期待勝率順）

${this.formatTierList(analyses)}

---

## 📈 環境分析サマリー

### 主要な発見
${this.generateInsights(analyses)}

### 推奨戦略
${this.generateStrategy(analyses, lineup)}

---

*このレポートは環境適応型メタスコア算出法に基づいています。*
*継続的な環境変化に対応するため、定期的な更新を推奨します。*
`;
  }

  /**
   * Tierリストをフォーマット
   */
  private formatTierList(analyses: DeckAnalysis[]): string {
    const tiers = ['SS', 'S', 'A+', 'A', 'B', 'C'];
    let tierList = '';
    
    for (const tierLevel of tiers) {
      const tierDecks = analyses.filter(a => a.tier.startsWith(tierLevel + ' '));
      
      if (tierDecks.length > 0) {
        const tierDescription = this.getTierDescription(tierLevel);
        tierList += `### ${tierLevel}階層 (${tierDescription})\n\n`;
        
        tierDecks.forEach((deck, index) => {
          const shareClass = deck.deck.share >= 5 ? '主力' : deck.deck.share >= 2 ? '実用' : '特殊';
          tierList += `${index + 1}. **${deck.deck.name}**\n`;
          tierList += `   - 期待勝率: ${deck.expectedWinRate.toFixed(1)}% (基本: ${deck.deck.winRate.toFixed(1)}%)\n`;
          tierList += `   - 環境シェア: ${deck.deck.share.toFixed(1)}% (${shareClass})\n`;
          tierList += `   - 信頼度: ${(deck.confidenceLevel * 100).toFixed(0)}%\n\n`;
        });
        
        tierList += '\n';
      }
    }
    
    if (tierList === '') {
      tierList = '分析データが不足しています。\n';
    }
    
    return tierList;
  }

  /**
   * Tier説明を取得
   */
  private getTierDescription(tier: string): string {
    const descriptions: Record<string, string> = {
      'SS': '環境支配',
      'S': '最強候補', 
      'A+': '実用最強',
      'A': '実用可能',
      'B': '条件付き採用',
      'C': '非推奨'
    };
    return descriptions[tier] || '';
  }

  /**
   * インサイトを生成
   */
  private generateInsights(analyses: DeckAnalysis[]): string {
    const topDeck = analyses[0];
    const hiddenGems = analyses.filter(a => 
      a.deck.share < 5 && a.expectedWinRate - a.deck.winRate > 1.0
    ).slice(0, 3);
    
    const viableDecks = analyses.filter(a => a.expectedWinRate >= 53).length;
    
    let insights = `- **使用率1位の${analyses.find(a => a.deck.share === Math.max(...analyses.map(d => d.deck.share)))?.deck.name || 'トップデッキ'}より、期待勝率では${topDeck.deck.name}が優秀**\n`;
    
    if (hiddenGems.length > 0) {
      const bestGem = hiddenGems[0];
      const boost = bestGem.expectedWinRate - bestGem.deck.winRate;
      insights += `- **注目の隠れ強デッキ**: ${bestGem.deck.name} (期待勝率+${boost.toFixed(1)}%)\n`;
    }
    
    insights += `- **実用レベル(53%+)のデッキ数**: ${viableDecks}個 - ${viableDecks >= 8 ? '多様な環境' : viableDecks >= 5 ? 'バランス環境' : '固着環境'}\n`;
    
    return insights;
  }

  /**
   * 戦略を生成
   */
  private generateStrategy(analyses: DeckAnalysis[], lineup: TournamentLineup): string {
    const topMeta = analyses.slice(0, 3).map(a => a.deck.name);
    
    let strategy = `- **${lineup.main.deck.name}を軸とした構築**が現環境で最も期待値が高い\n`;
    strategy += `- 環境上位デッキ（${topMeta.join(', ')}）への対策が重要\n`;
    
    if (lineup.sub) {
      strategy += `- サブデッキに${lineup.sub.deck.name}を採用してメタ対応\n`;
    }
    
    return strategy;
  }

  private analyzeMatchups(deckName: string): { strengths: string[], weaknesses: string[] } {
    const matchupData = this.matchups.get(deckName);
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (!matchupData) return { strengths, weaknesses };

    // 環境上位デッキ（シェア3%以上）との相性を重点的に分析
    const majorDecks = this.decks.filter(d => d.share >= 3.0);

    for (const opponent of majorDecks) {
      const winRate = matchupData.get(opponent.name);
      if (winRate === undefined) continue;

      if (winRate >= 60) {
        strengths.push(`${opponent.name} (${winRate.toFixed(1)}%)`);
      } else if (winRate <= 40) {
        weaknesses.push(`${opponent.name} (${winRate.toFixed(1)}%)`);
      }
    }

    return { strengths, weaknesses };
  }

  private calculateConfidence(deck: Deck): number {
    const estimatedMatches = deck.wins + deck.losses + deck.ties;
    
    // サンプル数に基づく信頼度計算
    if (estimatedMatches >= 1000) return 1.0;
    if (estimatedMatches >= 500) return 0.9;
    if (estimatedMatches >= 200) return 0.8;
    if (estimatedMatches >= 100) return 0.7;
    if (estimatedMatches >= 50) return 0.6;
    return 0.5;
  }

  private calculateStability(deckName: string): number {
    const matchupData = this.matchups.get(deckName);
    if (!matchupData || matchupData.size === 0) return 0.5;

    const winRates = Array.from(matchupData.values());
    if (winRates.length === 0) return 0.5;
    
    const mean = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const variance = winRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / winRates.length;
    const stdDev = Math.sqrt(variance);
    
    // 標準偏差が小さいほど安定
    return Math.max(0, Math.min(1, 1 - (stdDev / 20)));
  }


  /**
   * 有利な相性を取得
   */
  private getFavorableMatchups(deckName: string): Array<[string, number]> {
    const matchups = this.matchups.get(deckName);
    if (!matchups) return [];
    
    return Array.from(matchups.entries())
      .filter(([, winRate]) => winRate >= 55)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }

  /**
   * 不利な相性を取得
   */
  private getUnfavorableMatchups(deckName: string): Array<[string, number]> {
    const matchups = this.matchups.get(deckName);
    if (!matchups) return [];
    
    return Array.from(matchups.entries())
      .filter(([, winRate]) => winRate <= 45)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
  }
}