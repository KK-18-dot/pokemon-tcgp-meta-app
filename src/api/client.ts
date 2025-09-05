import axios from 'axios';
import type { Deck, Matchup, Tournament } from './types.js';

export class LimitlessAPIClient {
  private baseURL = 'https://play.limitlesstcg.com';
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  async getDecks(format: string = 'POCKET'): Promise<Deck[]> {
    try {
      // まずページにアクセスしてセッションを確立
      const response = await axios.get(`${this.baseURL}/decks?game=${format}`, {
        headers: this.headers
      });
      
      // APIエンドポイントを探す（開発者ツールで確認）
      // 例: /api/v2/decks/pocket/stats
      const apiResponse = await axios.get(`${this.baseURL}/api/v2/decks/pocket/stats`, {
        headers: this.headers
      });
      
      return this.parseDecksData(apiResponse.data);
    } catch (error) {
      console.error('API request failed, falling back to scraping:', error);
      return [];
    }
  }

  async getMatchups(deckName: string): Promise<Map<string, number>> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v2/decks/pocket/matchups/${encodeURIComponent(deckName)}`, {
        headers: this.headers
      });
      
      return this.parseMatchupsData(response.data);
    } catch (error) {
      console.error(`Failed to get matchups for ${deckName}:`, error);
      return new Map();
    }
  }

  async getTournaments(format: string = 'POCKET'): Promise<Tournament[]> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v2/tournaments?game=${format}`, {
        headers: this.headers
      });
      
      return this.parseTournamentsData(response.data);
    } catch (error) {
      console.error('Failed to get tournaments:', error);
      return [];
    }
  }

  private parseDecksData(data: any): Deck[] {
    // データ形式に応じてパース
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        rank: item.rank || 0,
        name: item.name || '',
        count: item.count || 0,
        share: item.share || 0,
        score: item.score || '',
        winRate: item.winRate || item.win_rate || 0,
        wins: item.wins || 0,
        losses: item.losses || 0,
        ties: item.ties || 0
      }));
    }
    
    // データ形式が異なる場合の処理
    if (data.decks) {
      return this.parseDecksData(data.decks);
    }
    
    return [];
  }

  private parseMatchupsData(data: any): Map<string, number> {
    const matchups = new Map<string, number>();
    
    if (Array.isArray(data)) {
      data.forEach((matchup: any) => {
        if (matchup.opponent && matchup.winRate !== undefined) {
          matchups.set(matchup.opponent, matchup.winRate);
        }
      });
    } else if (data.matchups) {
      Object.entries(data.matchups).forEach(([opponent, winRate]) => {
        matchups.set(opponent, Number(winRate));
      });
    }
    
    return matchups;
  }

  private parseTournamentsData(data: any): Tournament[] {
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        date: item.date || '',
        players: item.players || 0,
        format: item.format || 'POCKET'
      }));
    }
    
    return [];
  }
}