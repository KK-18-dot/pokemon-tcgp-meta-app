export interface Deck {
  rank: number;
  name: string;
  count: number;
  share: number;
  score: string;
  winRate: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface Matchup {
  deck1: string;
  deck2: string;
  deck1WinRate: number;
  matches: number;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  players: number;
  format: string;
}

export interface DeckData {
  rank: number;
  name: string;
  count: number;
  share: number;
  score: string;
  winRate: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface MatchupData {
  opponent: string;
  winRate: number;
  matches: number;
  wins: number;
  losses: number;
}

export interface EnvironmentalAnalysis {
  deck: DeckData;
  expectedWinRate: number;
  tier: string;
  confidenceLevel: number;
  stability: number;
  weaknesses: string[];
  strengths: string[];
  recommendation?: string;
}

export interface WeeklyComparison {
  current: DeckData;
  previous?: DeckData;
  shareChange: number;
  winRateChange: number;
  rankChange: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface TournamentRecommendation {
  main: EnvironmentalAnalysis;
  sub?: EnvironmentalAnalysis;
  meta?: EnvironmentalAnalysis;
  expectedWinRate: number;
  reasoning: string;
}

// Legacy interfaces - keeping for backward compatibility
export interface DeckAnalysis extends EnvironmentalAnalysis {
  // Alias for EnvironmentalAnalysis for backward compatibility
}

export interface StoredMetadata {
  totalDecks: number;
  shareCoverage: number;
  majorDecks: number;
  diversityIndex: number;
  collectionTime: string;
  version: string;
}

export interface StoredData {
  decks: DeckData[];
  matchups: Array<{
    deck: string;
    matchups: Array<[string, number]>;
  }>;
  timestamp: string;
  coverage: number;
  metadata?: StoredMetadata;
}

export interface MetaCycle {
  decks: string[];
  strength: number;
}

export interface TimeSeries {
  date: string;
  decks: Deck[];
}

export interface MetaPrediction {
  risingDecks: string[];
  decliningDecks: string[];
  confidenceLevel: number;
}

export interface SkillBasedRecommendation {
  beginner: DeckAnalysis[];
  intermediate: DeckAnalysis[];
  expert: DeckAnalysis[];
}