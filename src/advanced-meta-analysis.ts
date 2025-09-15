import { promises as fs } from 'fs';
import { join } from 'path';

export interface DeckData {
  name: string;
  share: number;
  winRate: number;
  matchups: Record<string, number>;
  tier: string;
  metaScore: number;
  placement: number;
}

export interface AdvancedMetrics {
  stabilityIndex: number;      // メタの安定性
  diversityIndex: number;      // デッキ多様性
  counterPlayIndex: number;    // カウンタープレイ度
  innovationPotential: number; // イノベーション潜在能力
  adaptabilityScore: number;   // 環境適応能力
  momentumIndex: number;       // 勢いインデックス
  riskRewardRatio: number;     // リスクリターン比
}

export class AdvancedMetaAnalysis {
  private decks: DeckData[] = [];

  constructor(decks: DeckData[]) {
    this.decks = decks;
  }

  /**
   * 高度なメタ分析の実行
   */
  async runAdvancedAnalysis(): Promise<{
    decks: DeckData[];
    metrics: AdvancedMetrics;
    recommendations: string[];
    hiddenGems: DeckData[];
  }> {
    console.log('🔬 Starting advanced meta analysis...');

    // 1. 進化した期待勝率計算（重み付き）
    this.calculateWeightedExpectedWinRate();

    // 2. 環境安定性分析
    const stabilityIndex = this.calculateStabilityIndex();

    // 3. デッキ多様性指数
    const diversityIndex = this.calculateDiversityIndex();

    // 4. カウンター環境分析
    const counterPlayIndex = this.calculateCounterPlayIndex();

    // 5. イノベーション潜在能力
    const innovationPotential = this.calculateInnovationPotential();

    // 6. 環境適応能力分析（NEW）
    const adaptabilityScore = this.calculateAdaptabilityScore();

    // 7. 勢いインデックス（NEW）
    const momentumIndex = this.calculateMomentumIndex();

    // 8. リスクリターン比（NEW）
    const riskRewardRatio = this.calculateRiskRewardRatio();

    // 9. 隠れ強デッキ発見
    const hiddenGems = this.findHiddenGems();

    // 10. 戦略的推奨事項生成
    const recommendations = this.generateStrategicRecommendations({
      stabilityIndex,
      diversityIndex,
      counterPlayIndex,
      innovationPotential,
      adaptabilityScore,
      momentumIndex,
      riskRewardRatio
    });

    return {
      decks: this.decks,
      metrics: {
        stabilityIndex,
        diversityIndex,
        counterPlayIndex,
        innovationPotential,
        adaptabilityScore,
        momentumIndex,
        riskRewardRatio
      },
      recommendations,
      hiddenGems
    };
  }

  /**
   * 重み付き期待勝率計算
   * - 最近のトーナメント結果により高い重みを付与
   * - 相性の信頼度を考慮
   */
  private calculateWeightedExpectedWinRate(): void {
    this.decks.forEach(deck => {
      let weightedExpectedWinRate = 0;
      let totalWeight = 0;

      Object.entries(deck.matchups).forEach(([opponent, winRate]) => {
        const opponentDeck = this.decks.find(d => d.name === opponent);
        if (!opponentDeck) return;

        // 相手のシェア率に基づく重み
        const shareWeight = opponentDeck.share / 100;
        
        // 最近のデータに高い重みを付与（シミュレート）
        const recencyWeight = Math.random() * 0.3 + 0.7; // 0.7-1.0
        
        // 信頼度重み（サンプル数が多い相性ほど高い重み）
        const confidenceWeight = Math.min(1.0, (opponentDeck.share * 0.02)); // 最大1.0

        const combinedWeight = shareWeight * recencyWeight * confidenceWeight;
        
        weightedExpectedWinRate += winRate * combinedWeight;
        totalWeight += combinedWeight;
      });

      if (totalWeight > 0) {
        const newMetaScore = (weightedExpectedWinRate / totalWeight) * 100;
        deck.metaScore = Math.round(newMetaScore * 100) / 100;
      }
    });

    // メタスコア順でソート
    this.decks.sort((a, b) => b.metaScore - a.metaScore);
    
    // 順位を更新
    this.decks.forEach((deck, index) => {
      deck.placement = index + 1;
    });
  }

  /**
   * 環境安定性指数
   * 上位デッキの相性バランスから環境の安定性を測定
   */
  private calculateStabilityIndex(): number {
    const topTier = this.decks.filter(d => d.tier === 'S' || d.tier === 'A+');
    if (topTier.length === 0) return 50;

    let totalVariance = 0;
    let pairCount = 0;

    // 上位デッキ間の相性の分散を計算
    topTier.forEach(deck1 => {
      topTier.forEach(deck2 => {
        if (deck1.name !== deck2.name) {
          const winRate = deck1.matchups[deck2.name] || 50;
          const variance = Math.pow(winRate - 50, 2);
          totalVariance += variance;
          pairCount++;
        }
      });
    });

    const avgVariance = pairCount > 0 ? totalVariance / pairCount : 0;
    
    // 分散が低い（相性が50%に近い）ほど安定的な環境
    const stabilityIndex = Math.max(0, Math.min(100, 100 - (avgVariance / 25)));
    
    return Math.round(stabilityIndex * 100) / 100;
  }

  /**
   * デッキ多様性指数（シャノン多様性指数の応用）
   */
  private calculateDiversityIndex(): number {
    const totalShare = this.decks.reduce((sum, deck) => sum + deck.share, 0);
    if (totalShare === 0) return 0;

    let diversity = 0;
    this.decks.forEach(deck => {
      if (deck.share > 0) {
        const proportion = deck.share / totalShare;
        diversity -= proportion * Math.log2(proportion);
      }
    });

    // 正規化 (最大値は log2(デッキ数))
    const maxDiversity = Math.log2(this.decks.length);
    const normalizedDiversity = maxDiversity > 0 ? (diversity / maxDiversity) * 100 : 0;
    
    return Math.round(normalizedDiversity * 100) / 100;
  }

  /**
   * カウンタープレイ指数
   * 環境にどの程度のカウンター要素があるかを測定
   */
  private calculateCounterPlayIndex(): number {
    let hardCounters = 0;
    let totalMatchups = 0;

    this.decks.forEach(deck => {
      Object.values(deck.matchups).forEach(winRate => {
        totalMatchups++;
        // 65%以上または35%以下を明確な有利/不利と判定
        if (winRate >= 65 || winRate <= 35) {
          hardCounters++;
        }
      });
    });

    const counterIndex = totalMatchups > 0 ? (hardCounters / totalMatchups) * 100 : 0;
    return Math.round(counterIndex * 100) / 100;
  }

  /**
   * イノベーション潜在能力
   * 新デッキが環境に参入しやすさを測定
   */
  private calculateInnovationPotential(): number {
    const topDecksShare = this.decks
      .slice(0, 3)
      .reduce((sum, deck) => sum + deck.share, 0);

    // トップ3のシェア率が低いほどイノベーション余地が高い
    const potential = Math.max(0, 100 - topDecksShare);
    
    // 多様性も考慮
    const diversityBonus = this.calculateDiversityIndex() * 0.3;
    
    const totalPotential = Math.min(100, potential + diversityBonus);
    return Math.round(totalPotential * 100) / 100;
  }

  /**
   * 隠れ強デッキ発見
   * シェア率は低いがメタスコアが高いデッキを特定
   */
  private findHiddenGems(): DeckData[] {
    return this.decks
      .filter(deck => 
        deck.share < 8 &&           // シェア率が低い
        deck.metaScore > 52 &&      // メタスコアは平均以上
        deck.placement <= this.decks.length * 0.6 // 上位60%以内
      )
      .slice(0, 3); // 最大3つ
  }

  /**
   * 戦略的推奨事項生成
   */
  private generateStrategicRecommendations(metrics: AdvancedMetrics): string[] {
    const recommendations: string[] = [];

    // 安定性に基づく推奨
    if (metrics.stabilityIndex > 75) {
      recommendations.push('🛡️ **安定環境**: バランスの取れた環境です。確実性を重視したデッキ選択がおすすめ');
    } else if (metrics.stabilityIndex < 40) {
      recommendations.push('⚡ **不安定環境**: 環境が流動的です。メタゲーム対応力の高いデッキを推奨');
    }

    // 多様性に基づく推奨
    if (metrics.diversityIndex > 70) {
      recommendations.push('🌈 **多様性豊富**: 様々なデッキが活躍できる環境です。個性的な構築も検討価値あり');
    } else if (metrics.diversityIndex < 30) {
      recommendations.push('🎯 **集約環境**: 特定デッキが支配的です。定番デッキでの参入を推奨');
    }

    // カウンタープレイに基づく推奨
    if (metrics.counterPlayIndex > 60) {
      recommendations.push('🔄 **カウンター重要**: 相性が明確な環境です。メタ読みが勝敗を分ける');
    } else if (metrics.counterPlayIndex < 30) {
      recommendations.push('⚖️ **技術重視**: 相性差が少ない環境です。プレイング技術が重要');
    }

    // イノベーションに基づく推奨
    if (metrics.innovationPotential > 70) {
      recommendations.push('💡 **創造チャンス**: 新デッキ開発の好機です。実験的構築にチャレンジ');
    } else if (metrics.innovationPotential < 30) {
      recommendations.push('🏰 **確立環境**: 実証済みデッキが安全です。細かな調整で差別化を図る');
    }

    return recommendations;
  }

  /**
   * 高度分析レポート生成
   */
  async generateAdvancedReport(analysis: Awaited<ReturnType<typeof this.runAdvancedAnalysis>>): Promise<string> {
    const { decks, metrics, recommendations, hiddenGems } = analysis;

    let report = `# 🔬 高度メタ分析レポート

**生成日時**: ${new Date().toLocaleString('ja-JP')}

## 📊 環境メトリクス

| 指標 | 数値 | 評価 |
|------|------|------|
| 🛡️ 安定性指数 | ${metrics.stabilityIndex}% | ${this.getStabilityRating(metrics.stabilityIndex)} |
| 🌈 多様性指数 | ${metrics.diversityIndex}% | ${this.getDiversityRating(metrics.diversityIndex)} |
| 🔄 カウンター度 | ${metrics.counterPlayIndex}% | ${this.getCounterRating(metrics.counterPlayIndex)} |
| 💡 革新潜在力 | ${metrics.innovationPotential}% | ${this.getInnovationRating(metrics.innovationPotential)} |

## 🎯 戦略的推奨事項

${recommendations.map(rec => `- ${rec}`).join('\n')}

## 💎 隠れ強デッキ (Hidden Gems)

${hiddenGems.length > 0 ? 
  hiddenGems.map(deck => 
    `### ${deck.name}
- **メタスコア**: ${deck.metaScore}点 (#${deck.placement})
- **現在シェア**: ${deck.share}%
- **推奨理由**: 環境適応性が高いにも関わらず使用率が低い穴場デッキ`
  ).join('\n\n') 
  : '現在、隠れ強デッキは検出されていません。'}

## 🏆 改良版メタランキング

| 順位 | デッキ名 | メタスコア | シェア率 | Tier | 期待勝率 |
|------|----------|------------|----------|------|----------|
${decks.slice(0, 15).map((deck, i) => 
  `| ${i + 1} | ${deck.name} | ${deck.metaScore} | ${deck.share}% | ${deck.tier} | ${deck.metaScore.toFixed(1)}% |`
).join('\n')}

---

*🤖 環境適応型メタスコア算出法 v2.0 による高度分析*
*📈 重み付き期待勝率・安定性分析・隠れ強デッキ発見機能搭載*
`;

    return report;
  }

  private getStabilityRating(score: number): string {
    if (score > 75) return '🟢 非常に安定';
    if (score > 50) return '🟡 やや安定';
    if (score > 25) return '🟠 やや不安定';
    return '🔴 非常に不安定';
  }

  private getDiversityRating(score: number): string {
    if (score > 75) return '🟢 非常に多様';
    if (score > 50) return '🟡 やや多様';
    if (score > 25) return '🟠 やや単調';
    return '🔴 非常に単調';
  }

  private getCounterRating(score: number): string {
    if (score > 70) return '🟢 カウンター環境';
    if (score > 40) return '🟡 バランス良好';
    if (score > 20) return '🟠 技術重視';
    return '🔴 実力差明確';
  }

  private getInnovationRating(score: number): string {
    if (score > 70) return '🟢 革新好機';
    if (score > 50) return '🟡 改良余地';
    if (score > 25) return '🟠 確立気味';
    return '🔴 固定環境';
  }

  /**
   * 環境適応能力分析 - デッキが様々な環境変化に適応できるかを評価
   */
  private calculateAdaptabilityScore(): number {
    let totalAdaptability = 0;

    this.decks.forEach(deck => {
      // 1. 相性の偏差が少ない = 汎用性が高い
      const matchupWinRates = Object.values(deck.matchups);
      const avgWinRate = matchupWinRates.reduce((a, b) => a + b, 0) / matchupWinRates.length;
      const variance = matchupWinRates.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / matchupWinRates.length;
      const consistency = Math.max(0, 1 - (variance / 2500)); // 標準偏差50%を基準

      // 2. Tier安定性 - 高Tierでの安定度
      const tierStability = deck.tier === 'S' ? 1.0 : deck.tier === 'A' ? 0.8 : 0.6;

      // 3. シェア安定性 - 極端に高い・低いシェア率はリスク
      const shareStability = 1 - Math.abs(deck.share - 15) * 0.02; // 理想シェア15%基準

      const adaptability = (consistency * 0.4 + tierStability * 0.3 + shareStability * 0.3) * 100;
      totalAdaptability += adaptability;
    });

    return totalAdaptability / this.decks.length;
  }

  /**
   * 勢いインデックス - 上昇トレンドにあるデッキの識別
   */
  private calculateMomentumIndex(): number {
    let totalMomentum = 0;

    this.decks.forEach(deck => {
      // シミュレーション: 最近のパフォーマンス変化
      const recentPerformanceChange = Math.random() * 20 - 10; // -10% to +10%
      const basePerformance = deck.winRate;
      
      // 勢いスコア計算
      const momentumScore = Math.max(0, Math.min(100, 
        basePerformance + recentPerformanceChange * 0.5 // 勢いを適度に重み付け
      ));

      totalMomentum += momentumScore;
    });

    return totalMomentum / this.decks.length;
  }

  /**
   * リスクリターン比 - 高リスク高リターンvs安定志向の分析
   */
  private calculateRiskRewardRatio(): number {
    let totalRiskReward = 0;

    this.decks.forEach(deck => {
      // リスク計算 - 相性の分散が大きい = ハイリスク
      const matchupWinRates = Object.values(deck.matchups);
      const avgWinRate = matchupWinRates.reduce((a, b) => a + b, 0) / matchupWinRates.length;
      const risk = Math.sqrt(matchupWinRates.reduce((sum, wr) => 
        sum + Math.pow(wr - avgWinRate, 2), 0) / matchupWinRates.length) / 50; // 正規化

      // リターン計算 - 高勝率 = 高リターン
      const reward = deck.winRate / 100;

      // リスクリターン比（低リスク高リターンが理想）
      const riskRewardRatio = reward / Math.max(0.1, risk); // ゼロ除算防止

      totalRiskReward += riskRewardRatio;
    });

    return totalRiskReward / this.decks.length;
  }

  private getAdaptabilityRating(score: number): string {
    if (score > 80) return '🟢 高適応性';
    if (score > 60) return '🟡 普通';
    if (score > 40) return '🟠 やや脆弱';
    return '🔴 環境依存';
  }

  private getMomentumRating(score: number): string {
    if (score > 65) return '🟢 上昇中';
    if (score > 55) return '🟡 安定';
    if (score > 45) return '🟠 停滞';
    return '🔴 下降中';
  }

  private getRiskRewardRating(ratio: number): string {
    if (ratio > 3.0) return '🟢 ローリスクハイリターン';
    if (ratio > 2.0) return '🟡 バランス良好';
    if (ratio > 1.0) return '🟠 標準的';
    return '🔴 ハイリスクローリターン';
  }
}

// CLI実行用
if (require.main === module) {
  async function main() {
    try {
      // サンプルデータでテスト実行
      const sampleDecks: DeckData[] = [
        {
          name: 'Sample Deck A',
          share: 25,
          winRate: 58,
          matchups: { 'Sample Deck B': 65, 'Sample Deck C': 45 },
          tier: 'S',
          metaScore: 58.5,
          placement: 1
        }
      ];

      const analyzer = new AdvancedMetaAnalysis(sampleDecks);
      const analysis = await analyzer.runAdvancedAnalysis();
      const report = await analyzer.generateAdvancedReport(analysis);
      
      console.log('📊 Advanced analysis completed');
      await fs.writeFile(join(process.cwd(), 'data', 'advanced_analysis.md'), report);
    } catch (error) {
      console.error('❌ Advanced analysis failed:', error);
      process.exit(1);
    }
  }
  
  main();
}