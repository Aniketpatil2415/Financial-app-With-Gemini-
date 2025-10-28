import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getInvestmentPrediction, getTextToSpeechAudio } from '../services/geminiService';
import type { PortfolioPrediction, PortfolioAnalysisItem, GroundingChunk } from '../types';
import { decode, decodeAudioData } from '../utils/audio';
import { LoadingIcon, SpeakerIcon, StopIcon, PredictionIcon, UpTrendIcon, DownTrendIcon, StableTrendIcon } from './icons/Icons';

const InvestmentPredictor: React.FC = () => {
    const [portfolio, setPortfolio] = useState('');
    const [language, setLanguage] = useState('English');
    const [prediction, setPrediction] = useState<PortfolioPrediction | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isStoppedManuallyRef = useRef<boolean>(false);

    const playNextInQueue = useCallback(async () => {
        if (isStoppedManuallyRef.current || audioQueueRef.current.length === 0) {
            setIsSpeaking(false);
            isStoppedManuallyRef.current = false;
            return;
        }

        const text = audioQueueRef.current.shift();
        if (!text) return;

        try {
            const audioData = await getTextToSpeechAudio(text, language);
            
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const context = audioContextRef.current;
            
            if (context.state === 'suspended') {
                await context.resume();
            }
            
            const decodedBytes = decode(audioData);
            const audioBuffer = await decodeAudioData(decodedBytes, context, 24000, 1);
            
            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
            source.onended = () => {
                audioSourceRef.current = null;
                playNextInQueue();
            };
            source.start();
            audioSourceRef.current = source;
        } catch (err) {
            setError('Failed to generate or play audio for a segment.');
            setIsSpeaking(false);
        }
    }, [language]);


    const stopPlayback = useCallback(() => {
        isStoppedManuallyRef.current = true;
        audioQueueRef.current = [];
        if (audioSourceRef.current) {
            audioSourceRef.current.onended = null;
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.suspend();
        }
        setIsSpeaking(false);
    }, []);

    const handleSpeak = async () => {
        if (!prediction) return;
        if (isSpeaking) {
            stopPlayback();
            return;
        }

        setError(null);
        setIsSpeaking(true);
        isStoppedManuallyRef.current = false;
        
        const textChunks = [
            `Here is the overall summary of your portfolio prediction: ${prediction.overallSummary}`,
            ...prediction.portfolioAnalysis.map(item => `${item.name}. Analysis: ${item.currentAnalysis}. Outlook: ${item.futureOutlook}`)
        ];

        audioQueueRef.current = textChunks;
        playNextInQueue();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPlayback();
        }
    }, [stopPlayback]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!portfolio.trim()) {
            setError("Portfolio cannot be empty.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setPrediction(null);
        setSources([]);
        stopPlayback();

        try {
            const { prediction: newPrediction, sources: newSources } = await getInvestmentPrediction(portfolio, language);
            setPrediction(newPrediction);
            setSources(newSources);
        } catch (err) {
            setError('An error occurred while fetching the prediction. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const PredictionDisplay: React.FC<{ prediction: 'Up' | 'Down' | 'Stable' }> = ({ prediction }) => {
        const predictionStyles = {
            Up: { icon: <UpTrendIcon />, color: 'text-green-400', text: 'Upward Trend' },
            Down: { icon: <DownTrendIcon />, color: 'text-red-400', text: 'Downward Trend' },
            Stable: { icon: <StableTrendIcon />, color: 'text-yellow-400', text: 'Stable Trend' },
        };
        const style = predictionStyles[prediction] || predictionStyles.Stable;
        return (
            <div className={`flex items-center gap-2 ${style.color}`}>
                {style.icon}
                <span className="font-semibold">{style.text}</span>
            </div>
        );
    };

    const PredictionCard: React.FC<{ item: PortfolioAnalysisItem }> = ({ item }) => {
        const confidenceColor = {
            High: 'text-green-400',
            Medium: 'text-yellow-400',
            Low: 'text-red-400',
        }[item.confidence];
    
        return (
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg flex flex-col">
                <h3 className="text-xl font-bold text-emerald-400 mb-2">{item.name}</h3>
                <div className="flex-grow space-y-3">
                    <p className="text-gray-300"><strong className="text-gray-400 block">Analysis:</strong> {item.currentAnalysis}</p>
                    <p className="text-gray-300"><strong className="text-gray-400 block">Outlook:</strong> {item.futureOutlook}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-400">Prediction:</span>
                        <PredictionDisplay prediction={item.prediction} />
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-400">Confidence:</span>
                        <span className={confidenceColor}>{item.confidence}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-900 p-4 sm:p-6 md:p-8 rounded-xl shadow-2xl border border-gray-700">
            <h2 className="text-3xl font-bold text-center mb-2 text-emerald-300">Investment Portfolio Prediction</h2>
            <p className="text-center text-gray-400 mb-8">Enter your current investments (e.g., AAPL stock, Vanguard S&P 500) for an AI-powered analysis.</p>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-8">
                <div>
                    <label htmlFor="portfolio" className="block mb-2 text-sm font-medium text-gray-300">Your Investments (one per line)</label>
                    <textarea 
                        id="portfolio" 
                        rows={4}
                        value={portfolio} 
                        onChange={e => setPortfolio(e.target.value)} 
                        placeholder="e.g.&#10;Tesla Inc. (TSLA) Stock&#10;Nifty 50 Index Fund SIP&#10;Bitcoin"
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5"
                    />
                </div>
                 <div>
                    <label htmlFor="pred_language" className="block mb-2 text-sm font-medium text-gray-300">Language</label>
                    <select id="pred_language" value={language} onChange={e => setLanguage(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5">
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Marathi</option>
                    </select>
                </div>
                <div className="text-center">
                    <button type="submit" disabled={isLoading} className="text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-800 font-medium rounded-lg text-lg px-8 py-3 text-center w-full md:w-auto transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center mx-auto">
                        {isLoading ? <><LoadingIcon /> Analyzing...</> : <><PredictionIcon /> Analyze & Predict</>}
                    </button>
                </div>
            </form>

            {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg text-center my-4">{error}</div>}

            {isLoading && <div className="text-center my-8">
                <p className="text-lg text-emerald-400">Consulting market data with AI...</p>
                <p className="text-gray-400">This may take a moment for complex analysis.</p>
            </div>}
            
            {prediction && (
                <div className="mt-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-emerald-300">Prediction Results</h3>
                         <button onClick={handleSpeak} disabled={!prediction} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSpeaking ? <><StopIcon /> Stop</> : <><SpeakerIcon /> Speak</>}
                        </button>
                    </div>
                    <p className="bg-gray-800/50 p-4 rounded-lg text-gray-300 mb-8"><strong>Overall Summary:</strong> {prediction.overallSummary}</p>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {prediction.portfolioAnalysis.map(item => <PredictionCard key={item.name} item={item} />)}
                    </div>

                    {sources.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-lg font-semibold text-gray-400 mb-2">Sources:</h4>
                            <ul className="list-disc list-inside text-sm">
                                {sources.map((source, index) => source.web?.uri && (
                                    <li key={index} className="mb-1">
                                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{source.web.title || source.web.uri}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                     <p className="text-xs text-gray-500 mt-6 text-center italic">Disclaimer: This is AI-generated information and not professional financial advice. Predictions are not guaranteed. Always do your own research.</p>
                </div>
            )}
        </div>
    );
};

export default InvestmentPredictor;