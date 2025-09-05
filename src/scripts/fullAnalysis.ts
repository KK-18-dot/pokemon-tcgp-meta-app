#!/usr/bin/env tsx

// Import the existing fullAnalysis function from main index.ts
import { execSync } from 'child_process';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 完全分析実行スクリプト - 改良版
 * 既存のfull-analysisコマンドを使用しつつ、詳細な実行時間計測とエラーハンドリングを提供
 */
async function runFullAnalysis() {
  console.log('🚀 === ポケモンTCGポケット 完全環境分析 ===');
  console.log(`📅 ${format(new Date(), 'yyyy年MM月dd日 HH:mm:ss', { locale: ja })}`);
  console.log('=' .repeat(50));
  console.log();
  
  const startTime = Date.now();
  
  try {
    console.log('📊 Phase 1: データ収集開始');
    console.log('   目標: シェア率80%以上のカバー率');
    console.log('   予想時間: 5-10分\n');
    
    // 既存のfull-analysisコマンドを実行
    console.log('🔄 npm run full-analysis を実行中...\n');
    execSync('npm run full-analysis', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ === 完全分析完了 ===');
    console.log(`⏱️  実行時間: ${minutes}分${seconds}秒`);
    console.log('=' .repeat(50));
    
    // 成功通知
    console.log('\n📝 生成されたファイル:');
    console.log('   • data/latest.json - 最新データ');
    console.log('   • data/latest_report.md - 最新分析レポート');
    console.log('   • data/decks_[日付].csv - CSV形式データ');
    console.log();
    console.log('💡 レポートをブラウザで見る:');
    console.log('   open data/latest_report.md');
    console.log();
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    
    if (error instanceof Error) {
      console.error('エラー詳細:', error.message);
    }
    
    console.log('\n💡 トラブルシューティング:');
    console.log('   1. ネットワーク接続を確認');
    console.log('   2. Playwrightがインストールされているか確認: npx playwright install');
    console.log('   3. APIエンドポイントが利用可能か確認');
    console.log('   4. レート制限に引っかかっている可能性 - 時間を置いて再実行');
    
    process.exit(1);
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullAnalysis().catch(console.error);
}

export { runFullAnalysis };