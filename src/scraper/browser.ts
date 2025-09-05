import { chromium, Browser, Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(headless: boolean = true) {
    this.browser = await chromium.launch({ 
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // ヘッダーを設定してより自然なリクエストにする
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    });

    // User Agentを設定
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    // ネットワークリクエストを監視（API検出用）
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('json') || url.includes('graphql')) {
        console.log('🔍 API Call detected:', url);
        try {
          const json = await response.json();
          if (json && Object.keys(json).length > 0) {
            console.log('📊 Response data sample:', JSON.stringify(json, null, 2).substring(0, 500) + '...');
          }
        } catch (e) {
          // JSONでない場合は無視
        }
      }
    });

    return this.page;
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async navigateWithRetry(url: string, maxRetries: number = 3): Promise<void> {
    const page = await this.getPage();
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        return;
      } catch (error) {
        console.warn(`Navigation attempt ${i + 1} failed for ${url}:`, error);
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      }
    }
  }

  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    const page = await this.getPage();
    await page.waitForSelector(selector, { timeout });
  }
}