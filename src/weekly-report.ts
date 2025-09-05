import { DeckScraper } from './scraper/decks.js';
import { DeckOptimizer } from './analyzer/optimizer.js';
import { DataStorage } from './storage/database.js';
import { ReportGenerator } from './utils/report.js';
import type { StoredData } from './api/types.js';

/**
 * 週次環境分析レポート生成
 * 毎週金曜日15:00 JST に自動実行される
 */
async function generateWeeklyReport() {
  console.log('📅 週次環境分析レポート生成開始...');
  console.log(`⏰ 実行時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
  console.log('📊 環境適応型メタスコア算出法による分析\n');

  const storage = new DataStorage();

  try {
    // 1. 全デッキのデータ取得（80%カバレッジ用）
    console.log('🎴 Step 1: 全デッキデータ取得中（80%カバレッジ用）...');
    const scraper = new DeckScraper();
    await scraper.initialize();
    
    let decks = await scraper.scrapeDecks();
    if (decks.length === 0) {
      throw new Error('デッキデータの取得に失敗しました');
    }
    
    // 80%カバレッジでデッキ選択
    const { selectDecksByCoverage, displayCoverageStats } = await import('./utils/coverage.js');
    const selectedDecks = selectDecksByCoverage(decks, 80);
    displayCoverageStats(decks, selectedDecks);
    console.log(`✅ ${selectedDecks.length}デッキのデータ取得完了`);

    // 2. 全相性データを自動取得
    console.log('\n⚔️  Step 2: 全相性データ自動収集...');
    const matchups = await scraper.scrapeAllMatchups(selectedDecks);
    await scraper.close();
    
    console.log(`✅ ${matchups.size}デッキ分の相性データ取得完了`);

    // 相性データが不足している場合のエラーハンドリング
    if (matchups.size < 30) {
      console.warn(`⚠️  相性データが不足しています (${matchups.size}/40)`);
      console.warn('分析は継続しますが、精度が低下する可能性があります');
    }

    // 3. 週次アーカイブ用のデータ保存
    console.log('\n💾 Step 3: 週次データ保存中...');
    const timestamp = new Date().toISOString();
    const weeklyData: StoredData = {
      decks: selectedDecks,
      matchups: Array.from(matchups.entries()).map(([key, value]) => ({
        deck: key,
        matchups: Array.from(value.entries())
      })),
      timestamp,
      coverage: selectedDecks.reduce((sum, d) => sum + d.share, 0)
    };

    // 週次アーカイブフォルダを作成
    await storage.ensureWeeklyReportsDir();

    // 通常保存 (latest更新)
    const dataFilename = await storage.saveData(weeklyData);
    console.log(`✅ データ保存完了: ${dataFilename}`);

    // 週次アーカイブ保存
    const weeklyFilename = await storage.saveWeeklyArchive(weeklyData);
    console.log(`📚 週次アーカイブ保存: ${weeklyFilename}`);

    // 4. 環境適応型メタ分析実行
    console.log('\n🧠 Step 4: 環境適応型メタ分析実行中...');
    const optimizer = new DeckOptimizer(selectedDecks, matchups);
    const analyses = optimizer.analyzeAllDecks();
    const lineup = optimizer.recommendTournamentLineup();
    
    // 5. 週次レポート生成
    console.log('\n📄 Step 5: 週次レポート生成中...');
    const reportGenerator = new ReportGenerator();
    
    // 通常レポート (latest更新)
    const reportData = {
      timestamp,
      coverage: weeklyData.coverage,
      deckCount: selectedDecks.length,
      matchupCount: Array.from(matchups.values()).reduce((sum, m) => sum + m.size, 0),
      analyses,
      lineup,
      optimizer // Pass the optimizer for complete report generation
    };

    await reportGenerator.generateDetailedReport(reportData);
    console.log('📄 詳細レポート生成: latest_report.md');

    // 週次アーカイブレポート
    const weeklyReportPath = await reportGenerator.generateWeeklyReport(reportData);
    console.log(`📚 週次レポート生成: ${weeklyReportPath}`);

    // 6. CSVエクスポート
    const csvFilename = await storage.exportToCSV(weeklyData);
    console.log(`📊 CSV出力完了: ${csvFilename}`);

    // 7. サマリー表示
    console.log('\n🏆 === 週次環境分析結果 ===\n');
    
    const topTierCount = analyses.filter(a => a.tier === 'SS').length;
    const sTierCount = analyses.filter(a => a.tier === 'S').length;
    const usableCount = analyses.filter(a => a.expectedWinRate >= 53).length;
    
    console.log(`📊 分析規模:`);
    console.log(`   • 分析対象: ${selectedDecks.length}デッキ (シェア率40位まで)`);
    console.log(`   • 環境カバー率: ${weeklyData.coverage.toFixed(1)}%`);
    console.log(`   • 相性データ: ${matchups.size}デッキ分`);
    console.log(`   • 総マッチアップ数: ${reportData.matchupCount}件`);

    console.log(`\n🎯 Tier構成:`);
    console.log(`   SS: ${topTierCount}デッキ`);
    console.log(`   S: ${sTierCount}デッキ`);
    console.log(`   実用レベル(53%+): ${usableCount}デッキ`);

    // トップ5の期待勝率
    const top5 = analyses
      .sort((a, b) => b.expectedWinRate - a.expectedWinRate)
      .slice(0, 5);

    console.log(`\n📈 期待勝率ランキング (Top 5):`);
    top5.forEach((deck, i) => {
      const diff = deck.expectedWinRate - deck.deck.winRate;
      const diffIcon = diff > 1 ? '📈' : diff < -1 ? '📉' : '➡️';
      console.log(`${i + 1}. ${deck.deck.name}`);
      console.log(`     期待勝率: ${deck.expectedWinRate.toFixed(2)}% ${diffIcon} (基本: ${deck.deck.winRate.toFixed(2)}%)`);
      console.log(`     ${deck.tier} | シェア: ${deck.deck.share.toFixed(1)}% | 信頼度: ${(deck.confidenceLevel * 100).toFixed(0)}%`);
    });

    // 最強構成
    console.log(`\n🏅 最強構成:`);
    console.log(`👑 メイン: ${lineup.main.deck.name}`);
    console.log(`   • ${lineup.main.tier}`);
    console.log(`   • 期待勝率: ${lineup.main.expectedWinRate.toFixed(2)}%`);
    console.log(`   • 環境シェア: ${lineup.main.deck.share.toFixed(1)}%`);
    
    if (lineup.sub) {
      console.log(`🥈 サブ: ${lineup.sub.deck.name} (期待${lineup.sub.expectedWinRate.toFixed(1)}%)`);
    }
    
    if (lineup.meta) {
      console.log(`🥉 メタ: ${lineup.meta.deck.name} (期待${lineup.meta.expectedWinRate.toFixed(1)}%)`);
    }

    // 隠れ強デッキ
    const hiddenGems = analyses
      .filter(a => a.deck.share < 5 && a.expectedWinRate >= 53)
      .sort((a, b) => b.expectedWinRate - a.expectedWinRate);

    if (hiddenGems.length > 0) {
      console.log(`\n🔍 隠れ強デッキ (シェア5%未満, 期待53%+):`);
      hiddenGems.slice(0, 5).forEach(deck => {
        console.log(`   • ${deck.deck.name}: 期待${deck.expectedWinRate.toFixed(1)}% (シェア${deck.deck.share.toFixed(1)}%)`);
      });
    }

    console.log(`\n📂 出力ファイル:`);
    console.log(`   📄 最新レポート: data/latest_report.md`);
    console.log(`   📚 週次アーカイブ: ${weeklyReportPath}`);
    console.log(`   📊 生データ: data/latest.json`);
    console.log(`   📈 CSV分析用: data/${csvFilename}`);

    console.log('\n✨ 週次環境分析レポート生成完了！');
    
    return {
      success: true,
      timestamp,
      coverage: weeklyData.coverage,
      deckCount: selectedDecks.length,
      matchupCount: reportData.matchupCount,
      topDeck: lineup.main.deck.name,
      reportPath: weeklyReportPath
    };

  } catch (error) {
    console.error('❌ 週次レポート生成中にエラーが発生しました:', error);
    
    // エラーの詳細をログに記録
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    await storage.saveErrorLog(errorReport);
    
    throw error;
  }
}

// 直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  generateWeeklyReport()
    .then(result => {
      console.log('\n🎉 週次レポート生成成功:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 週次レポート生成失敗:', error.message);
      process.exit(1);
    });
}

export { generateWeeklyReport };