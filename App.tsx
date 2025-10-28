import React from 'react';
import FinanceAdvisor from './components/FinanceAdvisor';
import ChatBot from './components/ChatBot';
import InvestmentPredictor from './components/InvestmentPredictor';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <header className="bg-gray-800 shadow-md p-4">
        <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-emerald-400 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path><path d="M13 7h-2v5.414l3.293 3.293 1.414-1.414L13 11.586z"></path></svg>
                <span>Finance Advisor</span>
            </h1>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 flex-grow">
        <FinanceAdvisor />
        <div className="my-12 border-t border-gray-700"></div>
        <InvestmentPredictor />
      </main>

      <ChatBot />

      <footer className="bg-gray-800 text-center p-4 mt-8">
        <p className="text-gray-400 text-sm">Created by Aniket patil</p>
      </footer>
    </div>
  );
}

export default App;