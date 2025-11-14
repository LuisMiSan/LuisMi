
import React from 'react';
import { Model } from '../types';
import { SparklesIcon, MicrophoneIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from './icons/Icons';

interface HeaderProps {
  model: Model;
  setModel: (model: Model) => void;
  thinkingMode: boolean;
  setThinkingMode: (enabled: boolean) => void;
  onLiveAgentClick: () => void;
  onExport: () => void;
  onSearchChange: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ model, setModel, thinkingMode, setThinkingMode, onLiveAgentClick, onExport, onSearchChange }) => {
  return (
    <header className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700 h-16 shadow-md">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path></svg>
        </div>
        <h1 className="text-xl font-bold text-white">n8n Visual Prompt Builder</h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-48 pl-10 p-2 transition-all duration-300 focus:w-64"
            aria-label="Search nodes"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="model-select" className="text-sm font-medium text-gray-400">Model:</label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value as Model)}
            disabled={thinkingMode}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2"
          >
            <option value={Model.PRO}>Gemini 2.5 Pro</option>
            <option value={Model.FLASH}>Gemini 2.5 Flash</option>
            <option value={Model.FLASH_LITE}>Gemini 2.5 Flash Lite</option>
          </select>
        </div>

        <div className="flex items-center">
          <label htmlFor="thinking-mode-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input type="checkbox" id="thinking-mode-toggle" className="sr-only" checked={thinkingMode} onChange={() => setThinkingMode(!thinkingMode)} />
              <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
              <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition"></div>
            </div>
             <div className="ml-3 text-gray-300 font-medium flex items-center">
                <SparklesIcon className="w-5 h-5 text-yellow-400 mr-1" />
                Thinking Mode
            </div>
          </label>
           <style>{`
            input:checked ~ .dot {
              transform: translateX(100%);
              background-color: #6366f1;
            }
          `}</style>
        </div>
        
        <button
          onClick={onExport}
          className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          Export
        </button>

        <button 
          onClick={onLiveAgentClick}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          <MicrophoneIcon className="w-5 h-5 mr-2" />
          Live Agent Test
        </button>
      </div>
    </header>
  );
};