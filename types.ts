export interface Recommendation {
  category: string;
  name: string;
  rationale: string;
  confidence: 'High' | 'Medium' | 'Low';
  prediction: 'Up' | 'Down' | 'Stable';
}

export interface FinancialAdvice {
  summary: string;
  recommendations: Recommendation[];
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

export interface GroundingChunk {
  web?: {
    // FIX: made uri and title optional to match @google/genai's GroundingChunk type.
    uri?: string;
    title?: string;
  };
}

export interface PortfolioAnalysisItem {
  name: string;
  currentAnalysis: string;
  futureOutlook: string;
  confidence: 'High' | 'Medium' | 'Low';
  prediction: 'Up' | 'Down' | 'Stable';
}

export interface PortfolioPrediction {
  portfolioAnalysis: PortfolioAnalysisItem[];
  overallSummary: string;
}