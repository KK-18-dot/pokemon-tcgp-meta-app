import { BrowserManager } from './browser.js';
import type { Deck } from '../api/types.js';

export class DeckScraper {
  private browserManager: BrowserManager;
  private deckUrlMap: Map<string, string> = new Map(); // デッキ名 -> URL マッピング

  constructor() {
    this.browserManager = new BrowserManager();
  }

  async initialize() {
    await this.browserManager.initialize();
  }

  async scrapeDecks(): Promise<Deck[]> {
    const page = await this.browserManager.getPage();
    
    console.log('🎴 Navigating to Limitless TCG Pocket decks page...');
    await this.browserManager.navigateWithRetry('https://play.limitlesstcg.com/decks?game=POCKET');

    // ページの読み込み完了を待つ
    try {
      await page.waitForSelector('body', { timeout: 10000 });
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.warn('⚠️  Timeout waiting for page to load, proceeding anyway');
    }
    
    // 動的コンテンツの読み込み完了を待つ
    await page.waitForTimeout(5000);
    
    // 追加: デッキリンクの読み込みを待つ
    try {
      await page.waitForSelector('a[href*="/decks/"]', { timeout: 10000 });
      console.log('✅ Deck links loaded');
    } catch (error) {
      console.warn('⚠️  No deck links found, trying alternative selectors');
    }

    console.log('📊 Extracting deck data from page...');
    
    // ページ内容を確認
    const content = await page.content();
    console.log('📄 Page title:', await page.title());
    
    if (content.includes('Access Denied') || content.includes('blocked')) {
      console.error('❌ Access denied by the website');
      return [];
    }
    
    const result = await page.evaluate(() => {
      console.log('🔍 Starting deck extraction...');
      
      // WebFetchで判明した構造に基づく: テーブル構造での抽出
      const tables = document.querySelectorAll('table');
      console.log(`Found ${tables.length} tables on page`);
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr, tr');
        console.log(`Table has ${rows.length} rows`);
        
        // テーブルにデッキリンクがあるかチェック
        const hasDecks = table.querySelector('a[href*="/decks/"]');
        if (!hasDecks) continue;
        
        console.log('Found table with deck links');
        
        const decks = [];
        const deckUrls = [];
        
        // 各行から情報を抽出 (ヘッダー行を除く)
        let deckCount = 0;
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length < 6) continue; // 最低6列必要 (rank, images, name, count, share, record, winrate)
          
          const deckLink = row.querySelector('a[href*="/decks/"]:not([href*="/matchups"])');
          if (!deckLink) continue;
          
          deckCount++;
          // 80%カバレッジシステムで動的に選択するため、スクレイピング時は制限を解除
          // サイトから取得可能なすべてのデッキを取得
          if (deckCount > 100) break; // 安全上限のみ設定
          
          const deckHref = deckLink.getAttribute('href');
          const deckName = deckLink.textContent?.trim() || '';
          
          // 各列からデータを抽出
          const rank = parseInt(cells[0]?.textContent?.trim()) || deckCount;
          const count = parseInt(cells[3]?.textContent?.trim()) || 0;
          const shareText = cells[4]?.textContent?.trim() || '0%';
          const recordText = cells[5]?.textContent?.trim() || '';
          const winRateText = cells[6]?.textContent?.trim() || '50%';
          
          // パーセンテージ抽出
          const shareMatch = shareText.match(/(\d+\.?\d*)%/);
          const share = shareMatch ? parseFloat(shareMatch[1]) : 0;
          
          const winRateMatch = winRateText.match(/(\d+\.?\d*)%/);
          const winRate = winRateMatch ? parseFloat(winRateMatch[1]) : 50;
          
          // Win-Loss-Tie抽出
          let wins = 0, losses = 0, ties = 0;
          const recordMatch = recordText.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
          if (recordMatch) {
            wins = parseInt(recordMatch[1]);
            losses = parseInt(recordMatch[2]);
            ties = parseInt(recordMatch[3]);
          }
          
          console.log(`Row ${deckCount}: ${deckName} | Count: ${count} | Share: ${share}% | WinRate: ${winRate}% | Record: ${recordText}`);
          
          const deckData = {
            rank,
            name: deckName || `Deck ${rank}`,
            count,
            share,
            score: recordText,
            winRate,
            wins,
            losses,
            ties
          };
          
          decks.push(deckData);
          
          // URLマッピングを保存
          if (deckHref && deckData.name) {
            deckUrls.push([deckData.name, deckHref]);
            console.log(`URL mapping: ${deckData.name} -> ${deckHref}`);
          }
        }
        
        if (decks.length > 0) {
          console.log(`Extracted ${decks.length} decks with ${deckUrls.length} URL mappings`);
          return { decks, deckUrls };
        }
      }
      
      // フォールバック: 従来のテーブル構造
      console.log('🔍 Fallback: Looking for table structure...');
      const fallbackTables = document.querySelectorAll('table');
      let targetTable = null;
      
      for (const table of fallbackTables) {
        const headerText = table.querySelector('thead')?.textContent || '';
        if (headerText.includes('Deck') || headerText.includes('Name') || headerText.includes('Share')) {
          targetTable = table;
          break;
        }
      }
      
      if (targetTable) {
        const rows = targetTable.querySelectorAll('tbody tr, tr:not(thead tr)');
        const decks = [];
        const deckUrls = [];
        
        for (let index = 0; index < Math.min(rows.length, 100); index++) { // 安全上限100デッキ
          const row = rows[index];
          const cells = row.querySelectorAll('td, th');
          if (cells.length < 3) continue;
          
          const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
          
          // デッキ名のリンクを取得
          let deckHref = '';
          for (const cell of cells) {
            const linkElement = cell.querySelector('a');
            if (linkElement?.getAttribute('href')?.includes('/decks/')) {
              deckHref = linkElement.getAttribute('href') || '';
              break;
            }
          }
          
          const rank = parseInt(cellTexts[0]) || (index + 1);
          let name = cellTexts[1] || '';
          for (let i = 1; i < cellTexts.length; i++) {
            if (cellTexts[i].length > name.length && cellTexts[i].length > 5) {
              name = cellTexts[i];
            }
          }
          
          const percentages = cellTexts.map(text => {
            const match = text.match(/(\d+\.?\d*)%/);
            return match ? parseFloat(match[1]) : null;
          }).filter(val => val !== null);
          
          const numbers = cellTexts.map(text => {
            const match = text.match(/^\d+$/);
            return match ? parseInt(match[0]) : null;
          }).filter(val => val !== null);
          
          let wins = 0, losses = 0, ties = 0;
          const recordMatch = row.textContent?.match(/(\d+)-(\d+)-(\d+)/);
          if (recordMatch) {
            wins = parseInt(recordMatch[1]);
            losses = parseInt(recordMatch[2]);
            ties = parseInt(recordMatch[3]);
          }
          
          const deckData = {
            rank,
            name: name || `Deck ${rank}`,
            count: numbers[0] || 0,
            share: percentages[0] || 0,
            score: cellTexts.find(text => text.includes('-')) || '',
            winRate: percentages[1] || percentages[0] || 50,
            wins,
            losses,
            ties
          };
          
          decks.push(deckData);
          
          if (deckHref && deckData.name) {
            deckUrls.push([deckData.name, deckHref]);
            console.log(`URL mapping: ${deckData.name} -> ${deckHref}`);
          }
        }
        
        console.log(`Fallback extracted ${decks.length} decks with ${deckUrls.length} URL mappings`);
        return { decks, deckUrls };
      }
      
      console.log('❌ No deck data found');
      return { decks: [], deckUrls: [] };
    });

    const { decks, deckUrls } = result;

    // URLマッピングを内部保存
    this.deckUrlMap.clear();
    for (const [name, url] of deckUrls) {
      this.deckUrlMap.set(name, url);
    }
    
    console.log(`✅ Extracted ${decks.length} decks from page (URLs: ${deckUrls.length})`);
    
    // デッキ名が取得できているかチェック
    const validDecks = decks.filter(deck => deck.name && deck.name.length > 0);
    if (validDecks.length !== decks.length) {
      console.warn(`⚠️  ${decks.length - validDecks.length} decks had invalid names`);
    }

    return validDecks;
  }

  async scrapeMatchups(deckName: string): Promise<Map<string, number> | null> {
    const page = await this.browserManager.getPage();
    
    try {
      console.log(`🔍 Getting matchup data for ${deckName}...`);
      
      // 保存されたURLを使用してマッチアップページに直接アクセス
      const deckBaseUrl = this.deckUrlMap.get(deckName);
      if (!deckBaseUrl) {
        console.log(`⚠️ ${deckName}: URL not found in mapping`);
        return null;
      }
      
      // WebFetchで成功した形式のマッチアップURLを構築
      // deckBaseUrlから既存のクエリパラメータを削除して、/matchupsを追加
      const baseUrlWithoutQuery = deckBaseUrl.split('?')[0];
      const matchupUrl = `https://play.limitlesstcg.com${baseUrlWithoutQuery}/matchups?game=POCKET&format=standard&set=A4a`;
      console.log(`📊 Accessing: ${matchupUrl}`);
      
      await this.browserManager.navigateWithRetry(matchupUrl);
      
      // マッチアップページの読み込み完了を待つ
      await page.waitForTimeout(3000);
      
      // ページ内容の確認（デバッグ用）
      const title = await page.title();
      const url = page.url();
      console.log(`📄 Page title: "${title}", URL: ${url}`);
      
      const matchups = await page.evaluate(() => {
        const matchupMap = new Map<string, number>();
        
        console.log('🔍 Searching for matchup data in table format...');
        
        // WebFetchで判明した正確な構造に基づく: テーブルベースのマッチアップデータを探す
        const tables = document.querySelectorAll('table');
        console.log(`Found ${tables.length} tables on matchup page`);
        
        for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
          const table = tables[tableIndex];
          const rows = table.querySelectorAll('tbody tr, tr');
          console.log(`Table ${tableIndex + 1} has ${rows.length} rows`);
          
          let foundMatchups = false;
          
          for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const cells = row.querySelectorAll('td');
            
            // 正確な構造: 5セル（画像、デッキ名リンク、マッチ数、記録、勝率）
            if (cells.length >= 5) {
              // 2番目のセル: デッキ名（リンクテキスト）
              const nameCell = cells[1];
              const deckLink = nameCell.querySelector('a');
              const deckName = deckLink ? deckLink.textContent?.trim() : nameCell.textContent?.trim();
              
              // 5番目のセル: 勝率（パーセンテージ）
              const winRateCell = cells[4];
              const winRateText = winRateCell.textContent?.trim() || '';
              
              console.log(`Row ${rowIndex + 1}: "${deckName}" -> "${winRateText}"`);
              
              if (deckName && deckName.length > 3 && winRateText.includes('%')) {
                const winRateMatch = winRateText.match(/(\d+\.?\d*)%/);
                
                if (winRateMatch) {
                  const winRate = parseFloat(winRateMatch[1]);
                  if (!isNaN(winRate) && winRate >= 0 && winRate <= 100) {
                    matchupMap.set(deckName, winRate);
                    console.log(`✅ Added matchup: ${deckName} -> ${winRate}%`);
                    foundMatchups = true;
                  }
                }
              }
            }
            // 4セル構造の場合もチェック（構造が異なる可能性）
            else if (cells.length === 4) {
              const nameCell = cells[0];
              const deckLink = nameCell.querySelector('a');
              const deckName = deckLink ? deckLink.textContent?.trim() : nameCell.textContent?.trim();
              
              const winRateCell = cells[3];
              const winRateText = winRateCell.textContent?.trim() || '';
              
              console.log(`Alt Row ${rowIndex + 1}: "${deckName}" -> "${winRateText}"`);
              
              if (deckName && deckName.length > 3 && winRateText.includes('%')) {
                const winRateMatch = winRateText.match(/(\d+\.?\d*)%/);
                
                if (winRateMatch) {
                  const winRate = parseFloat(winRateMatch[1]);
                  if (!isNaN(winRate) && winRate >= 0 && winRate <= 100) {
                    matchupMap.set(deckName, winRate);
                    console.log(`✅ Alt Added matchup: ${deckName} -> ${winRate}%`);
                    foundMatchups = true;
                  }
                }
              }
            }
          }
          
          // マッチアップデータが見つかったテーブルで処理を終了
          if (foundMatchups) {
            console.log(`Found matchups in table ${tableIndex + 1}`);
            break;
          }
        }
        
        console.log(`Final matchup count: ${matchupMap.size}`);
        return Array.from(matchupMap.entries());
      });
      
      const matchupMap = new Map(matchups);
      console.log(`📈 Found ${matchupMap.size} matchup records for ${deckName}`);
      
      if (matchupMap.size === 0) {
        console.warn(`⚠️ No matchup data found for ${deckName} at ${matchupUrl}`);
      }
      
      return matchupMap.size > 0 ? matchupMap : null;
      
    } catch (error) {
      console.error(`❌ Failed to scrape matchups for ${deckName}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 指定されたデッキ全ての相性データを自動取得
   */
  async scrapeAllMatchups(decks: Deck[]): Promise<Map<string, Map<string, number>>> {
    const allMatchups = new Map<string, Map<string, number>>();
    const targetDecks = decks; // 渡されたデッキをそのまま使用
    
    console.log(`\n🎯 ${targetDecks.length}デッキの相性データ収集を開始...`);
    
    for (let i = 0; i < targetDecks.length; i++) {
      const deck = targetDecks[i];
      console.log(`\n[${i + 1}/${targetDecks.length}] ${deck.name}`);
      
      const matchups = await this.scrapeMatchups(deck.name);
      if (matchups && matchups.size > 0) {
        allMatchups.set(deck.name, matchups);
      }
      
      // レート制限対策（最後以外は待機）
      if (i < targetDecks.length - 1) {
        console.log('⏱️ Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n✨ 相性データ収集完了: ${allMatchups.size}デッキ分`);
    return allMatchups;
  }

  async close() {
    await this.browserManager.close();
  }
}