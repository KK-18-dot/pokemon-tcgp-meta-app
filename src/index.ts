import { LimitlessAPIClient } from './api/client.js';
import { DeckScraper } from './scraper/decks.js';
import { DeckOptimizer } from './analyzer/optimizer.js';
import { AdvancedMetaAnalyzer } from './analyzer/advanced.js';
import { DataStorage, type StoredData } from './storage/database.js';
import type { Deck } from './api/types.js';

// テストデータ生成関数
function generateTestData(): Deck[] {
  return [
    { rank: 1, name: 'Pikachu ex', count: 1234, share: 15.4, score: '1234-456-78', winRate: 54.2, wins: 1234, losses: 456, ties: 78 },
    { rank: 2, name: 'Charizard ex Arcanine', count: 987, share: 12.3, score: '987-345-62', winRate: 52.8, wins: 987, losses: 345, ties: 62 },
    { rank: 3, name: 'Mewtwo ex Gardevoir', count: 856, share: 10.7, score: '856-298-51', winRate: 53.6, wins: 856, losses: 298, ties: 51 },
    { rank: 4, name: 'Starmie ex Articuno ex', count: 743, share: 9.3, score: '743-267-43', winRate: 51.9, wins: 743, losses: 267, ties: 43 },
    { rank: 5, name: 'Venusaur ex', count: 612, share: 7.6, score: '612-223-38', winRate: 52.4, wins: 612, losses: 223, ties: 38 },
    { rank: 6, name: 'Buzzwole ex Pheromosa', count: 489, share: 6.1, score: '489-201-29', winRate: 54.65, wins: 489, losses: 201, ties: 29 },
    { rank: 7, name: 'Dragonite', count: 367, share: 4.6, score: '367-178-22', winRate: 50.8, wins: 367, losses: 178, ties: 22 },
    { rank: 8, name: 'Alakazam ex', count: 289, share: 3.6, score: '289-145-18', winRate: 49.7, wins: 289, losses: 145, ties: 18 },
    { rank: 9, name: 'Blastoise ex', count: 234, share: 2.9, score: '234-123-15', winRate: 51.3, wins: 234, losses: 123, ties: 15 },
    { rank: 10, name: 'Guzzlord ex Naganadel', count: 134, share: 1.67, score: '134-56-8', winRate: 52.45, wins: 134, losses: 56, ties: 8 },
    { rank: 11, name: 'Machamp ex', count: 156, share: 1.95, score: '156-67-9', winRate: 48.9, wins: 156, losses: 67, ties: 9 },
    { rank: 12, name: 'Gyarados ex', count: 123, share: 1.54, score: '123-54-7', winRate: 50.2, wins: 123, losses: 54, ties: 7 }
  ];
}

function generateTestMatchups(decks: Deck[]): Map<string, Map<string, number>> {
  const matchups = new Map<string, Map<string, number>>();
  
  // 主要デッキのマッチアップデータを生成
  const majorDecks = decks.filter(d => d.share >= 3);
  
  for (const deck of majorDecks) {
    const deckMatchups = new Map<string, number>();
    
    for (const opponent of majorDecks) {
      if (deck.name !== opponent.name) {
        // ランダムな勝率を生成（35-65%の範囲）
        let winRate = 50 + (Math.random() - 0.5) * 30;
        
        // 特定の相性を設定
        if (deck.name === 'Guzzlord ex Naganadel') {
          // 隠れ強デッキとして環境上位に有利
          if (opponent.name === 'Pikachu ex') winRate = 62;
          if (opponent.name === 'Charizard ex Arcanine') winRate = 58;
          if (opponent.name === 'Mewtwo ex Gardevoir') winRate = 55;
        }
        
        if (deck.name === 'Buzzwole ex Pheromosa') {
          // 環境上位に不利
          if (opponent.name === 'Pikachu ex') winRate = 38;
          if (opponent.name === 'Mewtwo ex Gardevoir') winRate = 42;
        }
        
        deckMatchups.set(opponent.name, Math.round(winRate * 10) / 10);
      }
    }
    
    matchups.set(deck.name, deckMatchups);
  }
  
  return matchups;
}

async function collectDecksOnly() {
  console.log('🎴 デッキデータのみ収集モード\n');
  
  const storage = new DataStorage();

  try {
    // 1. APIでデータ取得を試みる
    console.log('🔌 APIでのデッキデータ取得を試行中...');
    const apiClient = new LimitlessAPIClient();
    let decks = await apiClient.getDecks();

    // 2. APIが失敗したらスクレイピング
    if (!decks.length) {
      console.log('❌ APIが利用できないため、スクレイピングを実行します...');
      
      const scraper = new DeckScraper();
      try {
        await scraper.initialize();
        decks = await scraper.scrapeDecks();
        
        if (decks.length === 0) {
          console.log('⚠️  スクレイピングでデータが取得できませんでした。デモデータを使用します。');
          decks = generateTestData();
        }
      } catch (error) {
        console.log('⚠️  スクレイピングでエラーが発生しました。デモデータを使用します。');
        console.log(`エラー詳細: ${error}`);
        decks = generateTestData();
      } finally {
        await scraper.close();
      }
    } else {
      console.log('✅ APIでのデッキデータ取得に成功');
    }

    // 3. デッキデータのみ保存（マッチアップなし）
    console.log('\n💾 デッキデータを保存中...');
    const storedData: StoredData = {
      decks,
      matchups: [], // マッチアップデータなし
      timestamp: new Date().toISOString(),
      coverage: decks.reduce((sum, d) => sum + d.share, 0)
    };

    const dataFilename = await storage.saveData(storedData);
    console.log(`✅ ${decks.length}個のデッキデータを保存しました: ${dataFilename}`);

    // 4. CSVエクスポート
    const csvFilename = await storage.exportToCSV(storedData);
    console.log(`📊 CSVファイルを作成しました: ${csvFilename}`);

    // 5. 簡易サマリー表示
    console.log('\n📈 === デッキデータサマリー ===');
    console.log(`📊 環境カバー率: ${storedData.coverage.toFixed(1)}%`);
    console.log(`🎴 分析対象デッキ数: ${decks.length}個\n`);
    
    console.log('📋 上位10デッキ:');
    decks.slice(0, 10).forEach((deck, i) => {
      console.log(`${i + 1}. ${deck.name}`);
      console.log(`   シェア: ${deck.share.toFixed(1)}% | 勝率: ${deck.winRate.toFixed(1)}% | 試合数: ${deck.wins + deck.losses + deck.ties}`);
    });

    console.log(`\n📁 データフォルダ: data/`);
    console.log(`📄 最新データ: data/latest.json`);
    console.log(`📊 最新CSV: data/${csvFilename}`);

  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error);
  }
}

async function collectMatchupsOnly(targetDeck?: string) {
  console.log('⚔️  マッチアップデータのみ収集モード\n');
  
  if (targetDeck) {
    console.log(`🎯 対象デッキ: ${targetDeck}`);
  }

  try {
    // 既存のデッキデータを読み込み
    const storage = new DataStorage();
    const existingData = await storage.loadLatestData();
    
    if (!existingData || existingData.decks.length === 0) {
      console.log('❌ 既存のデッキデータが見つかりません。先に "collect-decks" を実行してください。');
      return;
    }

    console.log(`✅ 既存データを読み込み: ${existingData.decks.length}デッキ分`);
    
    const matchups = new Map<string, Map<string, number>>();
    const scraper = new DeckScraper();
    
    try {
      await scraper.initialize();
      
      // 対象デッキの決定
      let targetDecks: Deck[];
      if (targetDeck) {
        targetDecks = existingData.decks.filter(d => 
          d.name.toLowerCase().includes(targetDeck.toLowerCase())
        );
        if (targetDecks.length === 0) {
          console.log(`❌ "${targetDeck}" に該当するデッキが見つかりません`);
          return;
        }
      } else {
        // 主要デッキ（シェア3%以上）のマッチアップを収集
        targetDecks = existingData.decks.filter(d => d.share >= 3);
      }

      console.log(`📈 ${targetDecks.length}個のデッキのマッチアップデータを収集します...\n`);
      
      for (const deck of targetDecks) {
        console.log(`⚔️  ${deck.name} のマッチアップデータを取得中...`);
        const deckMatchups = await scraper.scrapeMatchups(deck.name);
        if (deckMatchups && deckMatchups.size > 0) {
          matchups.set(deck.name, deckMatchups);
          console.log(`   ✅ ${deckMatchups.size}件のマッチアップデータを取得`);
        } else {
          console.log(`   ⚠️  マッチアップデータが取得できませんでした`);
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } finally {
      await scraper.close();
    }

    // データを更新して保存
    const updatedData: StoredData = {
      ...existingData,
      matchups: Array.from(matchups.entries()).map(([key, value]) => ({
        deck: key,
        matchups: Array.from(value.entries())
      })),
      timestamp: new Date().toISOString()
    };

    const dataFilename = await storage.saveData(updatedData);
    console.log(`\n✅ マッチアップデータを追加保存しました: ${dataFilename}`);
    console.log(`📊 マッチアップデータ: ${matchups.size}デッキ分`);

    // マッチアップサマリー表示
    console.log('\n⚔️  === マッチアップサマリー ===');
    for (const [deckName, deckMatchups] of matchups) {
      console.log(`\n🎴 ${deckName}:`);
      const sortedMatchups = Array.from(deckMatchups.entries())
        .sort((a, b) => b[1] - a[1]);
      
      const favorable = sortedMatchups.filter(([, winRate]) => winRate >= 55);
      const unfavorable = sortedMatchups.filter(([, winRate]) => winRate <= 45);
      
      if (favorable.length > 0) {
        console.log(`   📈 有利: ${favorable.map(([name, rate]) => `${name}(${rate}%)`).join(', ')}`);
      }
      if (unfavorable.length > 0) {
        console.log(`   📉 不利: ${unfavorable.map(([name, rate]) => `${name}(${rate}%)`).join(', ')}`);
      }
    }

  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error);
  }
}

async function main() {
  console.log('🎴 Limitless TCG Pocket データ収集開始...\n');
  console.log('📊 環境適応型メタスコア算出法を適用\n');

  const storage = new DataStorage();

  try {
    // 1. APIでデータ取得を試みる
    console.log('🔌 APIでのデータ取得を試行中...');
    const apiClient = new LimitlessAPIClient();
    let decks = await apiClient.getDecks();
    let matchups = new Map<string, Map<string, number>>();

    // 2. APIが失敗したらスクレイピング
    if (!decks.length) {
      console.log('❌ APIが利用できないため、スクレイピングを実行します...');
      
      // デモ用: スクレイピングが失敗した場合のテストデータ
      if (process.argv.includes('--demo')) {
        console.log('🎮 デモモード: テストデータを使用します');
        decks = generateTestData();
        matchups = generateTestMatchups(decks);
      } else {
        const scraper = new DeckScraper();
        try {
          await scraper.initialize();
          decks = await scraper.scrapeDecks();
          
          if (decks.length === 0) {
            console.log('⚠️  スクレイピングでデータが取得できませんでした。デモデータを使用します。');
            decks = generateTestData();
            matchups = generateTestMatchups(decks);
          } else {
            // 主要デッキの相性データを収集
            console.log('🔍 相性データを収集中...');
            const majorDecks = decks.filter(d => d.share >= 3);
            console.log(`📈 主要デッキ ${majorDecks.length}個の相性データを収集します...`);
            
            for (const deck of majorDecks) {
              console.log(`⚔️  ${deck.name} のマッチアップデータを取得中...`);
              const deckMatchups = await scraper.scrapeMatchups(deck.name);
              if (deckMatchups && deckMatchups.size > 0) {
                matchups.set(deck.name, deckMatchups);
                console.log(`   ✅ ${deckMatchups.size}件のマッチアップデータを取得`);
              }
              
              // レート制限対策
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          console.log('⚠️  スクレイピングでエラーが発生しました。デモデータを使用します。');
          console.log(`エラー詳細: ${error}`);
          decks = generateTestData();
          matchups = generateTestMatchups(decks);
        } finally {
          await scraper.close();
        }
      }
    } else {
      console.log('✅ APIでのデータ取得に成功');
      
      // APIから相性データも取得を試みる
      console.log('🔍 APIから相性データを収集中...');
      const majorDecks = decks.filter(d => d.share >= 3);
      for (const deck of majorDecks) {
        const deckMatchups = await apiClient.getMatchups(deck.name);
        if (deckMatchups.size > 0) {
          matchups.set(deck.name, deckMatchups);
        }
      }
    }

    if (decks.length === 0) {
      console.error('❌ データの取得に失敗しました');
      return;
    }

    // 3. データを保存
    console.log('\n💾 データを保存中...');
    const storedData: StoredData = {
      decks,
      matchups: Array.from(matchups.entries()).map(([key, value]) => ({
        deck: key,
        matchups: Array.from(value.entries())
      })),
      timestamp: new Date().toISOString(),
      coverage: decks.reduce((sum, d) => sum + d.share, 0)
    };

    const dataFilename = await storage.saveData(storedData);
    console.log(`✅ ${decks.length}個のデッキデータを保存しました: ${dataFilename}`);

    // 4. 環境適応型分析
    console.log('\n🧠 環境適応型メタ分析を実行中...');
    const optimizer = new DeckOptimizer(decks, matchups);
    const analyses = optimizer.analyzeAllDecks();
    const lineup = optimizer.recommendTournamentLineup();

    // 5. 高度な分析
    const advancedAnalyzer = new AdvancedMetaAnalyzer();
    const historicalData = await storage.getStoredDataHistory(10);
    
    // 基本レポート生成
    let report = optimizer.generateDetailedReport();
    
    // 高度な分析を追加
    if (analyses.length > 0) {
      report += advancedAnalyzer.generateAdvancedReport(
        analyses, 
        historicalData.map(d => ({ date: d.timestamp, decks: d.decks }))
      );
    }

    // レポート保存
    const reportFilename = await storage.saveReport(report);
    console.log(`📄 詳細レポートを保存しました: ${reportFilename}`);

    // 6. コンソールに主要な分析結果を表示
    displayResults(analyses, lineup, storedData.coverage, matchups.size);

    // 7. CSVエクスポート
    const csvFilename = await storage.exportToCSV(storedData);
    console.log(`📊 CSVファイルを作成しました: ${csvFilename}`);

  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error);
  }
}

function displayResults(
  analyses: any[], 
  lineup: any, 
  coverage: number, 
  matchupsCount: number
) {
  console.log('\n🏆 === 環境分析結果 ===\n');
  
  console.log(`📊 分析概要:`);
  console.log(`   • 環境カバー率: ${coverage.toFixed(1)}%`);
  console.log(`   • マッチアップデータ: ${matchupsCount}デッキ分`);
  console.log(`   • 分析対象デッキ数: ${analyses.length}個\n`);
  
  console.log('📈 期待勝率トップ5:');
  analyses.slice(0, 5).forEach((a, i) => {
    const diff = a.expectedWinRate - a.deck.winRate;
    const trend = diff > 0.5 ? '📈' : diff < -0.5 ? '📉' : '➡️';
    console.log(`${i + 1}. ${a.deck.name}`);
    console.log(`   期待勝率: ${a.expectedWinRate.toFixed(2)}% ${trend} (全体: ${a.deck.winRate.toFixed(2)}%)`);
    console.log(`   Tier: ${a.tier} | シェア: ${a.deck.share.toFixed(1)}%`);
  });

  console.log('\n🎯 推奨トーナメント構成:');
  console.log(`メイン: ${lineup.main.deck.name}`);
  console.log(`   • 期待勝率: ${lineup.main.expectedWinRate.toFixed(2)}%`);
  console.log(`   • 信頼度: ${(lineup.main.confidenceLevel * 100).toFixed(0)}%`);
  
  if (lineup.sub) {
    console.log(`サブ: ${lineup.sub.deck.name}`);
    console.log(`   • 期待勝率: ${lineup.sub.expectedWinRate.toFixed(2)}%`);
    console.log(`   • メインの弱点をカバー`);
  }
  
  if (lineup.meta) {
    console.log(`メタ: ${lineup.meta.deck.name}`);
    console.log(`   • 期待勝率: ${lineup.meta.expectedWinRate.toFixed(2)}%`);
    console.log(`   • 隠れた強デッキ (シェア${lineup.meta.deck.share.toFixed(1)}%)`);
  }

  // 注目すべき発見を表示
  const undervalued = analyses.filter(a => 
    a.expectedWinRate - a.deck.winRate > 2.0 && a.deck.share < 10
  );
  
  if (undervalued.length > 0) {
    console.log('\n🔍 注目の隠れ強デッキ:');
    undervalued.slice(0, 3).forEach(a => {
      const boost = a.expectedWinRate - a.deck.winRate;
      console.log(`• ${a.deck.name}: 期待勝率+${boost.toFixed(1)}% (シェア${a.deck.share.toFixed(1)}%)`);
    });
  }

  console.log(`\n📁 データフォルダ: data/`);
  console.log(`📄 最新レポート: data/latest_report.md`);
}

async function scheduleCollection() {
  console.log('⏰ 定期実行モードを開始します...');
  
  const runCollection = async () => {
    console.log(`\n📅 ${new Date().toLocaleString('ja-JP')} - 定期収集を実行`);
    await main();
  };
  
  // 初回実行
  await runCollection();
  
  // 6時間ごとに実行
  setInterval(runCollection, 6 * 60 * 60 * 1000);
  
  console.log('⏰ 6時間ごとの自動収集を設定しました');
}

async function fullAnalysis() {
  console.log('🚀 完全版環境分析開始...\n');
  console.log('📊 80%カバレッジ目標 + 全相性データ + 環境適応型分析\n');

  const { selectDecksByCoverage, displayCoverageStats } = await import('./utils/coverage.js');
  const storage = new DataStorage();

  try {
    // 1. 全デッキデータ取得
    console.log('🎴 Step 1: 全デッキデータ取得中...');
    const scraper = new DeckScraper();
    await scraper.initialize();
    
    let allDecks = await scraper.scrapeDecks();
    if (allDecks.length === 0) {
      console.log('⚠️  実データ取得失敗。デモデータを使用します。');
      allDecks = generateTestData();
    }
    
    // 2. 80%カバレッジでデッキ選択
    console.log('\n🎯 Step 2: 80%カバレッジ方式でデッキ選択...');
    const selectedDecks = selectDecksByCoverage(allDecks, 80);
    displayCoverageStats(allDecks, selectedDecks);

    // 3. 全相性データを自動取得
    console.log('\n⚔️  Step 3: 全相性データ自動収集...');
    const matchups = await scraper.scrapeAllMatchups(selectedDecks);
    await scraper.close();
    
    console.log(`✅ ${matchups.size}デッキ分の相性データ取得完了`);

    // 4. データ保存
    console.log('\n💾 Step 4: データ保存中...');
    const storedData: StoredData = {
      decks: selectedDecks,
      matchups: Array.from(matchups.entries()).map(([key, value]) => ({
        deck: key,
        matchups: Array.from(value.entries())
      })),
      timestamp: new Date().toISOString(),
      coverage: selectedDecks.reduce((sum, d) => sum + d.share, 0)
    };

    const dataFilename = await storage.saveData(storedData);
    console.log(`✅ データ保存完了: ${dataFilename}`);

    // 5. 環境適応型メタ分析実行
    console.log('\n🧠 Step 5: 環境適応型メタ分析実行中...');
    const optimizer = new DeckOptimizer(selectedDecks, matchups);
    const analyses = optimizer.analyzeAllDecks();
    const lineup = optimizer.recommendTournamentLineup();
    
    // 6. ガイド準拠の詳細レポート生成
    const report = optimizer.generateDetailedReport();
    const reportFilename = await storage.saveReport(report);
    console.log(`📄 詳細レポート生成: ${reportFilename}`);

    // 7. 結果表示
    displayFullAnalysisResults(analyses, lineup, storedData.coverage, matchups.size, selectedDecks.length);

    // 8. CSV出力
    const csvFilename = await storage.exportToCSV(storedData);
    console.log(`📊 CSV出力完了: ${csvFilename}`);

  } catch (error) {
    console.error('❌ フル分析中にエラーが発生しました:', error);
  }
}

function displayFullAnalysisResults(
  analyses: any[], 
  lineup: any, 
  coverage: number, 
  matchupsCount: number,
  totalDecks: number
) {
  console.log('\n🏆 === 完全版環境分析結果 ===\n');
  
  console.log(`📊 分析規模:`);
  console.log(`   • 分析対象: ${totalDecks}デッキ (シェア率40位まで)`);
  console.log(`   • 環境カバー率: ${coverage.toFixed(1)}%`);
  console.log(`   • 相性データ: ${matchupsCount}デッキ分`);
  console.log(`   • 総マッチアップ数: ${analyses.reduce((sum, a) => sum + (a.strengths?.length || 0) + (a.weaknesses?.length || 0), 0)}件\n`);
  
  // Tier別統計
  const tierCounts = new Map<string, number>();
  analyses.forEach(a => {
    const tier = a.tier.split(' ')[0];
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
  });
  
  console.log('🎯 Tier構成:');
  for (const [tier, count] of tierCounts) {
    console.log(`   ${tier}: ${count}デッキ`);
  }
  console.log();

  // トップ10表示
  console.log('📈 期待勝率ランキング (Top 10):');
  analyses.slice(0, 10).forEach((a, i) => {
    const diff = a.expectedWinRate - a.deck.winRate;
    const trend = diff > 0.5 ? '📈' : diff < -0.5 ? '📉' : '➡️';
    console.log(`${String(i + 1).padStart(2, ' ')}. ${a.deck.name}`);
    console.log(`     期待勝率: ${a.expectedWinRate.toFixed(2)}% ${trend} (基本: ${a.deck.winRate.toFixed(2)}%)`);
    console.log(`     ${a.tier} | シェア: ${a.deck.share.toFixed(1)}% | 信頼度: ${(a.confidenceLevel * 100).toFixed(0)}%`);
  });

  console.log('\n🏅 最強構成 (ガイド準拠):');
  console.log(`👑 メイン: ${lineup.main.deck.name}`);
  console.log(`   • ${lineup.main.tier}`);
  console.log(`   • 期待勝率: ${lineup.main.expectedWinRate.toFixed(2)}%`);
  console.log(`   • 環境シェア: ${lineup.main.deck.share.toFixed(1)}%`);
  
  if (lineup.main.strengths?.length > 0) {
    console.log(`   • 有利: ${lineup.main.strengths.slice(0, 3).join(', ')}`);
  }
  if (lineup.main.weaknesses?.length > 0) {
    console.log(`   • 不利: ${lineup.main.weaknesses.slice(0, 3).join(', ')}`);
  }
  
  if (lineup.sub) {
    console.log(`🥈 サブ: ${lineup.sub.deck.name} (期待${lineup.sub.expectedWinRate.toFixed(1)}%)`);
  }
  if (lineup.meta) {
    console.log(`🥉 メタ: ${lineup.meta.deck.name} (期待${lineup.meta.expectedWinRate.toFixed(1)}%)`);
  }

  // 隠れ強デッキ
  const hidden = analyses.filter(a => 
    a.deck.share < 5 && a.expectedWinRate >= 53
  ).slice(0, 5);
  
  if (hidden.length > 0) {
    console.log('\n🔍 隠れ強デッキ (シェア5%未満, 期待53%+):');
    hidden.forEach(a => {
      console.log(`   • ${a.deck.name}: 期待${a.expectedWinRate.toFixed(1)}% (シェア${a.deck.share.toFixed(1)}%)`);
    });
  }

  console.log(`\n📂 出力ファイル:`);
  console.log(`   📄 詳細レポート: data/latest_report.md`);
  console.log(`   📊 生データ: data/latest.json`);
  console.log(`   📈 CSV分析用: data/latest.csv`);
}

async function monitorMetaShift() {
  console.log('🔍 メタ変化の監視を開始します...');
  
  const storage = new DataStorage();
  const history = await storage.getStoredDataHistory(5);
  
  if (history.length < 2) {
    console.log('❌ 比較用の履歴データが不足しています');
    return;
  }
  
  const latest = history[0]!;
  const previous = history[1]!;
  
  console.log('\n📊 メタ変化分析:');
  console.log(`最新: ${new Date(latest.timestamp).toLocaleString('ja-JP')}`);
  console.log(`前回: ${new Date(previous.timestamp).toLocaleString('ja-JP')}`);
  
  // シェア率の変化を分析
  const changes: Array<{name: string, change: number, current: number}> = [];
  
  for (const currentDeck of latest.decks) {
    const previousDeck = previous.decks.find(d => d.name === currentDeck.name);
    if (previousDeck) {
      const change = currentDeck.share - previousDeck.share;
      if (Math.abs(change) >= 0.5) { // 0.5%以上の変化
        changes.push({
          name: currentDeck.name,
          change,
          current: currentDeck.share
        });
      }
    }
  }
  
  changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  console.log('\n📈 大きな変化があったデッキ:');
  changes.slice(0, 10).forEach(change => {
    const trend = change.change > 0 ? '📈' : '📉';
    const sign = change.change > 0 ? '+' : '';
    console.log(`${trend} ${change.name}: ${sign}${change.change.toFixed(1)}% (現在: ${change.current.toFixed(1)}%)`);
  });
}

// CLIコマンド
const command = process.argv[2];

switch (command) {
  case 'collect':
    main().catch(console.error);
    break;
  case 'collect-decks':
    collectDecksOnly().catch(console.error);
    break;
  case 'collect-matchups':
    const targetDeck = process.argv[3];
    collectMatchupsOnly(targetDeck).catch(console.error);
    break;
  case 'full-analysis':
    fullAnalysis().catch(console.error);
    break;
  case 'schedule':
    scheduleCollection().catch(console.error);
    break;
  case 'monitor':
    monitorMetaShift().catch(console.error);
    break;
  default:
    console.log(`
🎴 Limitless TCG Scraper - 使用方法:

🚀 推奨コマンド:
  npm run full-analysis               # 【一発実行】40デッキ+全相性+完全分析

📊 従来コマンド:
  npm run collect                     # 完全分析（デッキ+マッチアップ+分析）
  npm run collect-decks               # デッキデータのみ収集
  npm run collect-matchups            # マッチアップデータのみ収集
  npm run collect-matchups "Pikachu"  # 特定デッキのマッチアップのみ

⚙️  運用コマンド:
  npm run schedule                    # 6時間ごとの定期実行
  npm run monitor                     # メタ変化の監視

🎯 full-analysisの特徴:
  • 40デッキ（シェア率40位まで）のデータを自動取得
  • 全デッキの相性データを網羅的に収集
  • 環境適応型メタスコア算出法による高精度分析
  • ガイド準拠のTier判定とレポート生成
  • 隠れ強デッキの自動発見

📈 出力例:
  - 📄 詳細分析レポート (data/latest_report.md)  
  - 📊 生データ (data/latest.json)
  - 📈 CSV形式 (data/latest.csv)
    `);
}