import React, { useState, useRef, useCallback } from 'react';
import { getFinancialAdvice, getTextToSpeechAudio } from '../services/geminiService';
import type { FinancialAdvice, Recommendation, GroundingChunk } from '../types';
import { decode, decodeAudioData } from '../utils/audio';
import { LoadingIcon, SpeakerIcon, StopIcon, UpTrendIcon, DownTrendIcon, StableTrendIcon } from './icons/Icons';

const FinanceAdvisor: React.FC = () => {
    const [investmentAmount, setInvestmentAmount] = useState(5000);
    const [riskTolerance, setRiskTolerance] = useState('Medium');
    const [investmentHorizon, setInvestmentHorizon] = useState(5);
    const [language, setLanguage] = useState('English');
    const [advice, setAdvice] = useState<FinancialAdvice | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const stopPlayback = useCallback(() => {
        if (audioSourceRef.current) {
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
        if (!advice) return;
        if (isSpeaking) {
            stopPlayback();
            return;
        }

        setIsSpeaking(true);
        setError(null);
        try {
            const fullTextToSpeak = `${advice.summary} Here are the recommendations. ${advice.recommendations.map(r => `${r.category}: ${r.name}. Rationale: ${r.rationale}`).join('. ')}`;
            const audioData = await getTextToSpeechAudio(fullTextToSpeak, language);
            
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const context = audioContextRef.current;
            
            if (context.state === 'suspended') {
                await context.resume();
            }
            
            const decodedBytes = decode(audioData);
            const audioBuffer = await decodeAudioData(decodedBytes, context, 24000, 1);
            
            if (audioSourceRef.current) { // Stop any previous sound
                audioSourceRef.current.stop();
            }

            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
            source.onended = () => {
                setIsSpeaking(false);
                audioSourceRef.current = null;
            };
            source.start();
            audioSourceRef.current = source;
            
        } catch (err) {
            setError('Failed to generate or play audio.');
            setIsSpeaking(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setAdvice(null);
        setSources([]);
        stopPlayback();

        try {
            const { advice: newAdvice, sources: newSources } = await getFinancialAdvice(investmentAmount, riskTolerance, investmentHorizon, language);
            setAdvice(newAdvice);
            setSources(newSources);
        } catch (err) {
            setError('An error occurred while fetching financial advice. Please try again.');
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

    const RecommendationCard: React.FC<{ item: Recommendation }> = ({ item }) => {
        const confidenceColor = {
            High: 'text-green-400',
            Medium: 'text-yellow-400',
            Low: 'text-red-400',
        }[item.confidence];
    
        return (
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col">
                <h3 className="text-xl font-bold text-emerald-400 mb-2">{item.name}</h3>
                <p className="text-sm font-semibold text-gray-400 mb-4">{item.category}</p>
                <p className="text-gray-300 mb-4 flex-grow">{item.rationale}</p>
                <div className="mt-auto space-y-3">
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
            <h2 className="text-3xl font-bold text-center mb-2 text-emerald-300">Personalized Financial Plan</h2>
            <p className="text-center text-gray-400 mb-8">Enter your criteria to receive AI-powered investment suggestions.</p>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-end">
                <div>
                    <label htmlFor="amount" className="block mb-2 text-sm font-medium text-gray-300">Investment Amount ($)</label>
                    <input type="number" id="amount" value={investmentAmount} onChange={e => setInvestmentAmount(Number(e.target.value))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5" />
                </div>
                <div>
                    <label htmlFor="risk" className="block mb-2 text-sm font-medium text-gray-300">Risk Tolerance</label>
                    <select id="risk" value={riskTolerance} onChange={e => setRiskTolerance(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5">
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="horizon" className="block mb-2 text-sm font-medium text-gray-300">Horizon (Years)</label>
                    <input type="number" id="horizon" value={investmentHorizon} onChange={e => setInvestmentHorizon(Number(e.target.value))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5" />
                </div>
                 <div>
                    <label htmlFor="language" className="block mb-2 text-sm font-medium text-gray-300">Language</label>
                    <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5">
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Marathi</option>
                    </select>
                </div>
                <div className="lg:col-span-4 text-center">
                    <button type="submit" disabled={isLoading} className="text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-800 font-medium rounded-lg text-lg px-8 py-3 text-center w-full md:w-auto transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center mx-auto">
                        {isLoading ? <><LoadingIcon /> Generating Plan...</> : 'Get Advice'}
                    </button>
                </div>
            </form>

            {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg text-center">{error}</div>}

            {isLoading && <div className="text-center my-8">
                <p className="text-lg text-emerald-400">Analyzing market data with AI...</p>
                <p className="text-gray-400">This may take a moment for complex queries.</p>
            </div>}
            
            {advice && (
                <div className="mt-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-emerald-300">Your AI-Generated Strategy</h3>
                        <button onClick={handleSpeak} disabled={!advice} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSpeaking ? <><StopIcon /> Stop</> : <><SpeakerIcon /> Speak</>}
                        </button>
                    </div>
                    <p className="bg-gray-800/50 p-4 rounded-lg text-gray-300 mb-8">{advice.summary}</p>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {advice.recommendations.map(item => <RecommendationCard key={item.name} item={item} />)}
                    </div>

                    {sources.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-lg font-semibold text-gray-400 mb-2">Sources:</h4>
                            <ul className="list-disc list-inside text-sm">
                                {/* FIX: Check for source.web.uri as it can be optional. Also provide a fallback for title. */}
                                {sources.map((source, index) => source.web?.uri && (
                                    <li key={index} className="mb-1">
                                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{source.web.title || source.web.uri}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-6 text-center italic">Disclaimer: This is AI-generated information and not professional financial advice. Always do your own research.</p>
                </div>
            )}
        </div>
    );
};

export default FinanceAdvisor;