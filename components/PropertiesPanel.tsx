// Fix: Add types for the Web Speech API which is not standard and may not be in default TS lib files.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

import React, { useState, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { NodeData } from '../types';
import { Type } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon } from './icons/Icons';

interface PropertiesPanelProps {
  node: Node<NodeData>;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
}

const commonInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white";
const commonLabelClass = "block text-sm font-medium text-gray-300 mb-1";
const sectionClass = "p-4 border-b border-gray-700";

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, updateNodeData }) => {
  const { data, id } = node;
  
  // --- Voice Input State and Logic ---
  const [listeningNodeId, setListeningNodeId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechApiSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!speechApiSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = false;

    return () => {
      recognition.stop();
    };
  }, [speechApiSupported]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript && listeningNodeId === id) {
        const currentText = node.data.text || '';
        const newText = (currentText ? currentText + ' ' : '') + transcript.trim();
        updateNodeData(id, { text: newText });
      }
    };
    
    recognition.onend = () => {
      if (listeningNodeId === id) {
        setListeningNodeId(null);
      }
    };
    
    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (listeningNodeId === id) {
            setListeningNodeId(null);
        }
    }

  }, [id, listeningNodeId, node.data.text, updateNodeData]);


  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    const isListening = listeningNodeId === id;

    if (isListening) {
      recognition.stop();
    } else {
      if (listeningNodeId) {
        recognition.stop(); // Stop listening on any other node
      }
      setListeningNodeId(id);
      recognition.start();
    }
  };
  // --- End of Voice Input Logic ---


  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    updateNodeData(id, { text: e.target.value });
  };
  
  const handleConditionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { condition: e.target.value });
  };
  
  const handleToolNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { toolName: e.target.value });
  };

  const handleToolDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { toolDescription: e.target.value });
  };

  const handleParamChange = (index: number, field: 'key' | 'description', value: string) => {
    const newParams = [...(data.toolParameters || [])];
    newParams[index][field] = value;
    updateNodeData(id, { toolParameters: newParams });
  };

  const addParam = () => {
    const newParams = [...(data.toolParameters || []), { key: '', description: '' }];
    updateNodeData(id, { toolParameters: newParams });
  };

  const removeParam = (index: number) => {
    const newParams = (data.toolParameters || []).filter((_, i) => i !== index);
    updateNodeData(id, { toolParameters: newParams });
  };
  
  const handleSchemaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const newSchema = JSON.parse(e.target.value);
      updateNodeData(id, { responseSchema: newSchema });
    } catch (error) {
      console.error("Invalid JSON for schema");
    }
  }
  
  const renderContent = () => {
    const isListening = listeningNodeId === id;
    switch (node.type) {
      case 'system':
      case 'context':
        return (
          <div className={sectionClass}>
            <label htmlFor="text" className={commonLabelClass}>Instructions / Context</label>
            <div className="relative">
              <textarea
                id="text"
                value={data.text || ''}
                onChange={handleTextChange}
                className={`${commonInputClass} h-40 pr-10`}
                placeholder="e.g., You are a helpful assistant."
              />
              {speechApiSupported && (
                 <button
                    onClick={toggleListening}
                    title={isListening ? 'Stop recording' : 'Start recording'}
                    className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
                      isListening ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                   {isListening ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                  </button>
              )}
            </div>
             <p className="text-xs text-gray-500 mt-2">You can use n8n variables like {`{{ $json.someValue }}`}.</p>
          </div>
        );
      case 'condition':
        return (
            <div className={sectionClass}>
                 <label htmlFor="condition" className={commonLabelClass}>If Condition</label>
                <input
                  id="condition"
                  type="text"
                  value={data.condition || ''}
                  onChange={handleConditionChange}
                  className={commonInputClass}
                  placeholder="e.g., a message contains 'weather'"
                />
                 <label htmlFor="text" className={`${commonLabelClass} mt-4`}>Then, provide these instructions:</label>
                <textarea
                    id="text"
                    value={data.text || ''}
                    onChange={handleTextChange}
                    className={`${commonInputClass} h-32`}
                    placeholder="e.g., Use the weather tool."
                />
            </div>
        );
      case 'tool':
        return (
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="tool-name" className={commonLabelClass}>Tool Name</label>
              <input
                id="tool-name"
                type="text"
                value={data.toolName || ''}
                onChange={handleToolNameChange}
                className={commonInputClass}
                 placeholder="e.g., getWeather"
              />
            </div>
            <div>
              <label htmlFor="tool-desc" className={commonLabelClass}>Tool Description</label>
              <textarea
                id="tool-desc"
                value={data.toolDescription || ''}
                onChange={handleToolDescriptionChange}
                className={`${commonInputClass} h-24`}
                placeholder="e.g., Get the current weather for a given location."
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-200">Parameters</h4>
              {(data.toolParameters || []).map((param, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                    className={`${commonInputClass} flex-1`}
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={param.description || ''}
                    onChange={(e) => handleParamChange(index, 'description', e.target.value)}
                    className={`${commonInputClass} flex-1`}
                  />
                  <button onClick={() => removeParam(index)} className="p-2 bg-red-600 hover:bg-red-700 rounded-md text-white">X</button>
                </div>
              ))}
              <button onClick={addParam} className="mt-2 w-full p-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white font-semibold">
                Add Parameter
              </button>
            </div>
          </div>
        );
      case 'response':
        return (
           <div className={sectionClass}>
                <label htmlFor="schema" className={commonLabelClass}>JSON Response Schema</label>
                <textarea
                  id="schema"
                  value={JSON.stringify(data.responseSchema || { type: Type.OBJECT, properties: {} }, null, 2)}
                  onChange={handleSchemaChange}
                  className={`${commonInputClass} h-64 font-mono text-sm`}
                  placeholder="Define the expected JSON output format."
                />
                <p className="text-xs text-gray-500 mt-2">The model will do its best to conform to this schema.</p>
            </div>
        );
      case 'google_search':
        return (
            <div className="p-4 text-center text-gray-400">
                <p>This node enables Google Search grounding.</p>
                <p className="text-sm">No configuration needed.</p>
            </div>
        );
      default:
        return <div className="p-4 text-gray-500">Select a node to view its properties.</div>;
    }
  };

  return (
    <div className="h-1/2 bg-gray-800 flex flex-col overflow-y-auto">
       <h3 className="text-lg font-bold p-4 bg-gray-900 border-b border-gray-700 sticky top-0 capitalize">{node.type?.replace('_', ' ')} Node Properties</h3>
       {renderContent()}
    </div>
  );
};
