/**
 * 80%カバレッジ方式でデッキを選択する
 * シェア率の累積が80%を超えるまでデッキを上位から取得
 */
export function selectDecksByCoverage(decks: any[], targetCoverage: number = 80): any[] {
  if (!decks || decks.length === 0) {
    return [];
  }

  // シェア率でソート（降順）
  const sortedDecks = [...decks].sort((a, b) => b.share - a.share);
  
  const selectedDecks = [];
  let cumulativeShare = 0;
  
  for (const deck of sortedDecks) {
    selectedDecks.push(deck);
    cumulativeShare += deck.share;
    
    // 目標カバー率に到達したら終了
    if (cumulativeShare >= targetCoverage) {
      break;
    }
  }
  
  console.log(`📊 カバレッジ選択完了: ${selectedDecks.length}デッキで${cumulativeShare.toFixed(1)}%カバー (目標: ${targetCoverage}%)`);
  
  return selectedDecks;
}

/**
 * デッキリストのカバー率を計算
 */
export function calculateCoverage(decks: any[]): number {
  return decks.reduce((sum, deck) => sum + (deck.share || 0), 0);
}

/**
 * カバレッジ統計情報を表示
 */
export function displayCoverageStats(decks: any[], selectedDecks: any[]) {
  const totalDecks = decks.length;
  const selectedCount = selectedDecks.length;
  const coverage = calculateCoverage(selectedDecks);
  const efficiency = (coverage / selectedCount).toFixed(1);
  
  console.log(`🎯 カバレッジ統計:`);
  console.log(`   • 全体デッキ数: ${totalDecks}個`);
  console.log(`   • 選択デッキ数: ${selectedCount}個 (${(selectedCount/totalDecks*100).toFixed(1)}%)`);
  console.log(`   • 環境カバー率: ${coverage.toFixed(1)}%`);
  console.log(`   • 選択効率: ${efficiency}%/デッキ`);
}