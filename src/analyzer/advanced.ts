import type { DeckAnalysis, MetaCycle, TimeSeries, MetaPrediction, SkillBasedRecommendation, Deck } from '../api/types.js';

export class AdvancedMetaAnalyzer {
  /**
   * メタゲームの循環を検出
   * Rock-Paper-Scissors的な相性関係を発見
   */
  detectMetaCycles(analyses: DeckAnalysis[]): MetaCycle[] {
    const cycles: MetaCycle[] = [];
    const majorDecks = analyses.filter(a => a.deck.share >= 3.0).slice(0, 20); // 上位20デッキに限定
    
    for (let i = 0; i < majorDecks.length; i++) {
      for (let j = i + 1; j < majorDecks.length; j++) {
        for (let k = j + 1; k < majorDecks.length; k++) {
          const deck1 = majorDecks[i];
          const deck2 = majorDecks[j];
          const deck3 = majorDecks[k];
          
          if (this.formsCycle(deck1, deck2, deck3)) {
            cycles.push({
              decks: [deck1.deck.name, deck2.deck.name, deck3.deck.name],
              strength: this.calculateCycleStrength(deck1, deck2, deck3)
            });
          }
        }
      }
    }
    
    return cycles.sort((a, b) => b.strength - a.strength);
  }

  private formsCycle(deck1: DeckAnalysis, deck2: DeckAnalysis, deck3: DeckAnalysis): boolean {
    // A beats B, B beats C, C beats A のような関係を検出
    const deck1BeatsDesk2 = deck1.strengths.some(s => s.includes(deck2.deck.name));
    const deck2BeatsDesk3 = deck2.strengths.some(s => s.includes(deck3.deck.name));
    const deck3BeatsDesk1 = deck3.strengths.some(s => s.includes(deck1.deck.name));
    
    return deck1BeatsDesk2 && deck2BeatsDesk3 && deck3BeatsDesk1;
  }

  private calculateCycleStrength(deck1: DeckAnalysis, deck2: DeckAnalysis, deck3: DeckAnalysis): number {
    const totalShare = deck1.deck.share + deck2.deck.share + deck3.deck.share;
    const avgWinRate = (deck1.expectedWinRate + deck2.expectedWinRate + deck3.expectedWinRate) / 3;
    
    return totalShare * (avgWinRate / 100);
  }

  /**
   * 環境の多様性指数を計算（Simpson's Diversity Index）
   */
  calculateDiversityIndex(decks: Deck[]): number {
    const totalShare = decks.reduce((sum, d) => sum + d.share, 0);
    if (totalShare === 0) return 0;
    
    const simpsonIndex = decks.reduce((sum, d) => {
      const proportion = d.share / totalShare;
      return sum + (proportion * proportion);
    }, 0);
    
    return 1 - simpsonIndex; // 0-1の範囲、1に近いほど多様
  }

  /**
   * 時系列でのメタ変化を予測
   */
  predictMetaEvolution(historicalData: TimeSeries[]): MetaPrediction {
    if (historicalData.length < 2) {
      return {
        risingDecks: [],
        decliningDecks: [],
        confidenceLevel: 0
      };
    }

    const trends = this.analyzeTrends(historicalData);
    const risingDecks = this.identifyRisingDecks(trends);
    const decliningDecks = this.identifyDecliningDecks(trends);
    
    return {
      risingDecks,
      decliningDecks,
      confidenceLevel: this.calculatePredictionConfidence(historicalData)
    };
  }

  private analyzeTrends(historicalData: TimeSeries[]): Map<string, number[]> {
    const trends = new Map<string, number[]>();
    
    // 各デッキのシェア率の推移を追跡
    for (const dataPoint of historicalData) {
      for (const deck of dataPoint.decks) {
        if (!trends.has(deck.name)) {
          trends.set(deck.name, []);
        }
        trends.get(deck.name)!.push(deck.share);
      }
    }
    
    return trends;
  }

  private identifyRisingDecks(trends: Map<string, number[]>): string[] {
    const risingDecks: Array<{name: string, slope: number}> = [];
    
    for (const [deckName, shares] of trends) {
      if (shares.length < 2) continue;
      
      // 線形回帰で傾きを計算
      const slope = this.calculateSlope(shares);
      
      // 上昇傾向かつ最新のシェア率が3%以上
      if (slope > 0.1 && shares[shares.length - 1] >= 3.0) {
        risingDecks.push({ name: deckName, slope });
      }
    }
    
    return risingDecks
      .sort((a, b) => b.slope - a.slope)
      .slice(0, 5)
      .map(d => d.name);
  }

  private identifyDecliningDecks(trends: Map<string, number[]>): string[] {
    const decliningDecks: Array<{name: string, slope: number}> = [];
    
    for (const [deckName, shares] of trends) {
      if (shares.length < 2) continue;
      
      const slope = this.calculateSlope(shares);
      
      // 下降傾向かつ元々人気があった
      if (slope < -0.1 && shares[0] >= 5.0) {
        decliningDecks.push({ name: deckName, slope: Math.abs(slope) });
      }
    }
    
    return decliningDecks
      .sort((a, b) => b.slope - a.slope)
      .slice(0, 5)
      .map(d => d.name);
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // sum of squares
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculatePredictionConfidence(historicalData: TimeSeries[]): number {
    // データ点の数と時間間隔に基づいて信頼度を計算
    const dataPoints = historicalData.length;
    
    if (dataPoints >= 10) return 0.9;
    if (dataPoints >= 5) return 0.7;
    if (dataPoints >= 3) return 0.5;
    return 0.3;
  }

  /**
   * プレイヤースキルレベル別の推奨デッキ
   */
  recommendBySkillLevel(analyses: DeckAnalysis[]): SkillBasedRecommendation {
    return {
      beginner: analyses
        .filter(a => 
          a.stability > 0.7 && // 安定性が高い
          a.expectedWinRate >= 51 && // 実用可能
          a.deck.share >= 5 // ある程度使用率がある（情報が多い）
        )
        .slice(0, 3),
      
      intermediate: analyses
        .filter(a =>
          a.expectedWinRate >= 53 && // より高い期待勝率
          a.confidenceLevel >= 0.6 // 信頼できるデータがある
        )
        .slice(0, 5),
      
      expert: analyses
        .filter(a =>
          a.deck.share < 5 && // 低使用率
          a.expectedWinRate >= 55 && // 高期待勝率
          a.stability > 0.5 // 最低限の安定性
        )
        .slice(0, 3) // スキルで差をつけられる隠れ強デッキ
    };
  }

  /**
   * メタ分析レポートの生成
   */
  generateAdvancedReport(analyses: DeckAnalysis[], historicalData?: TimeSeries[]): string {
    const diversity = this.calculateDiversityIndex(analyses.map(a => a.deck));
    const cycles = this.detectMetaCycles(analyses);
    const skillRecommendations = this.recommendBySkillLevel(analyses);
    
    let report = `## 🔬 高度なメタ分析

### 環境の多様性
- **多様性指数**: ${(diversity * 100).toFixed(1)}% ${this.getDiversityComment(diversity)}
- **実用デッキ数**: ${analyses.filter(a => a.expectedWinRate >= 51).length}個

### メタサイクル分析
${cycles.length > 0 ? cycles.slice(0, 3).map((cycle, index) => 
`**サイクル ${index + 1}**: ${cycle.decks.join(' → ')} → ${cycle.decks[0]}
- 強度: ${cycle.strength.toFixed(2)}`).join('\n') : '明確なメタサイクルは検出されませんでした'}

### スキル別推奨デッキ

#### 初心者向け（安定性重視）
${skillRecommendations.beginner.map(a => 
`- **${a.deck.name}**: 期待勝率${a.expectedWinRate.toFixed(1)}%, 安定性${(a.stability * 100).toFixed(0)}%`).join('\n')}

#### 中級者向け（期待値重視）
${skillRecommendations.intermediate.map(a => 
`- **${a.deck.name}**: 期待勝率${a.expectedWinRate.toFixed(1)}%, シェア${a.deck.share.toFixed(1)}%`).join('\n')}

#### 上級者向け（隠れ強デッキ）
${skillRecommendations.expert.map(a => 
`- **${a.deck.name}**: 期待勝率${a.expectedWinRate.toFixed(1)}%, シェア${a.deck.share.toFixed(1)}%`).join('\n')}

`;

    // 時系列データがあれば予測を追加
    if (historicalData && historicalData.length >= 2) {
      const prediction = this.predictMetaEvolution(historicalData);
      report += `### 📈 メタ変化予測
      
**上昇傾向のデッキ:**
${prediction.risingDecks.map(deck => `- ${deck}`).join('\n')}

**下降傾向のデッキ:**
${prediction.decliningDecks.map(deck => `- ${deck}`).join('\n')}

*予測信頼度: ${(prediction.confidenceLevel * 100).toFixed(0)}%*

`;
    }

    return report;
  }

  private getDiversityComment(diversity: number): string {
    if (diversity >= 0.8) return '(非常に多様)';
    if (diversity >= 0.6) return '(多様)';
    if (diversity >= 0.4) return '(中程度)';
    if (diversity >= 0.2) return '(限定的)';
    return '(単調)';
  }
}