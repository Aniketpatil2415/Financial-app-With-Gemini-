import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { FinancialAdvice, GroundingChunk, PortfolioPrediction } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

let chatInstance: Chat | null = null;

export const getFinancialAdvice = async (
    investmentAmount: number,
    riskTolerance: string,
    investmentHorizon: number,
    language: string
): Promise<{ advice: FinancialAdvice, sources: GroundingChunk[] }> => {
    try {
        const prompt = `
          Analyze the current financial market and provide investment advice in ${language} based on the following criteria:
          - Investment Amount: $${investmentAmount}
          - Risk Tolerance: ${riskTolerance}
          - Investment Horizon: ${investmentHorizon} years

          Your task is to:
          1. Provide a concise summary of the investment strategy.
          2. Recommend up to three options for each category: Mutual Funds, SIPs (Systematic Investment Plan), and Stocks.
          3. For each recommendation, provide its name, a detailed rationale (including key metrics and performance insights), a confidence level (High, Medium, or Low), and a future trend prediction ('Up', 'Down', or 'Stable').
          4. Use your search capabilities to ensure all information is up-to-date.

          The final output MUST be a single, valid JSON object and nothing else. Do not include any text before or after it. Do not use markdown formatting like \`\`\`json.
          The JSON structure must be:
          {
            "summary": "string",
            "recommendations": [
              {
                "category": "string",
                "name": "string",
                "rationale": "string",
                "confidence": "string ('High', 'Medium', or 'Low')",
                "prediction": "string ('Up', 'Down', or 'Stable')"
              }
            ]
          }
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingBudget: 32768 },
            }
        });

        let responseText = response.text.trim();
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = responseText.match(jsonRegex);
        if (match && match[1]) {
          responseText = match[1];
        }

        const advice: FinancialAdvice = JSON.parse(responseText);
        const sources: GroundingChunk[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        return { advice, sources };
    } catch (error) {
        console.error("Error getting financial advice:", error);
        throw new Error("Failed to fetch financial advice from the AI.");
    }
};

export const getInvestmentPrediction = async (
    portfolio: string,
    language: string
): Promise<{ prediction: PortfolioPrediction, sources: GroundingChunk[] }> => {
    try {
        const prompt = `
          You are an expert financial analyst. Based on current market data and trends, analyze the following investment portfolio and provide a future outlook in ${language}.
          User's portfolio:
          ---
          ${portfolio}
          ---

          For each item in the portfolio, provide:
          1. A brief analysis of its current standing.
          2. A potential future outlook (e.g., potential for growth, stability, or risks).
          3. A confidence score for your prediction (High, Medium, Low).
          4. A future trend prediction ('Up', 'Down', or 'Stable').
          5. An overall summary of the portfolio's outlook.

          Use your search capabilities to find the most recent information. Your response must be a single, valid JSON object and nothing else. Do not use markdown. The structure should be:
          {
            "portfolioAnalysis": [
              {
                "name": "string (e.g., 'AAPL Stock', 'Vanguard S&P 500 ETF')",
                "currentAnalysis": "string",
                "futureOutlook": "string",
                "confidence": "string ('High', 'Medium', or 'Low')",
                "prediction": "string ('Up', 'Down', or 'Stable')"
              }
            ],
            "overallSummary": "string"
          }
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingBudget: 32768 },
            }
        });

        let responseText = response.text.trim();
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = responseText.match(jsonRegex);
        if (match && match[1]) {
          responseText = match[1];
        }
        
        const prediction: PortfolioPrediction = JSON.parse(responseText);
        const sources: GroundingChunk[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        return { prediction, sources };

    } catch (error)
        {
        console.error("Error getting investment prediction:", error);
        throw new Error("Failed to fetch investment prediction from the AI.");
    }
};


export const getChatResponse = async (message: string): Promise<string> => {
    try {
        if (!chatInstance) {
            chatInstance = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: "You are a helpful assistant. Keep your answers concise and friendly.",
                }
            });
        }
        const response: GenerateContentResponse = await chatInstance.sendMessage({ message });
        return response.text;
    } catch (error) {
        console.error("Error getting chat response:", error);
        throw new Error("Failed to get chat response from the AI.");
    }
};

export const getTextToSpeechAudio = async (text: string, language: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `In a clear, professional voice, say the following in ${language}: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore has good multi-language support
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error getting TTS audio:", error);
        throw new Error("Failed to generate speech from the AI.");
    }
};