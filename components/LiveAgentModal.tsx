import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, Tool } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon, XMarkIcon, ArrowPathIcon } from './icons/Icons';

// --- LocalStorage Keys ---
const LS_KEYS = {
  SYSTEM_INSTRUCTION: 'n8n-live-agent-system-instruction',
  TOOLS_JSON: 'n8n-live-agent-tools-json',
};

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Component Types ---
type Transcript = {
    speaker: 'user' | 'model' | 'system';
    content: string;
};

interface LiveAgentModalProps {
  onClose: () => void;
  initialPromptJson: string;
}

const commonInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-mono text-sm disabled:opacity-50";
const commonLabelClass = "block text-sm font-medium text-gray-300 mb-1";

// --- Component ---
export const LiveAgentModal: React.FC<LiveAgentModalProps> = ({ onClose, initialPromptJson }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Configure your test and press Start.');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [currentInterim, setCurrentInterim] = useState({ user: '', model: '' });

  const [systemInstruction, setSystemInstruction] = useState('');
  const [toolsJson, setToolsJson] = useState('[]');
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    // On mount, load from localStorage first. If empty, fall back to canvas prompt.
    const savedInstruction = localStorage.getItem(LS_KEYS.SYSTEM_INSTRUCTION);
    const savedTools = localStorage.getItem(LS_KEYS.TOOLS_JSON);

    if (savedInstruction !== null && savedTools !== null) {
      setSystemInstruction(savedInstruction);
      setToolsJson(savedTools);
    } else {
        try {
            if (initialPromptJson) {
                const parsedPrompt = JSON.parse(initialPromptJson);
                setSystemInstruction(parsedPrompt.config?.systemInstruction || 'You are a helpful and friendly agent designed for testing n8n prompts.');
                setToolsJson(JSON.stringify(parsedPrompt.config?.tools || [], null, 2));
            }
        } catch (error) {
            console.error("Failed to parse initial prompt JSON:", error);
            setSystemInstruction('Error parsing initial prompt.');
            setToolsJson('[]');
        }
    }
  }, []); // Run only once on mount

  // Save system instruction to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_KEYS.SYSTEM_INSTRUCTION, systemInstruction);
  }, [systemInstruction]);

  // Save tools JSON to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_KEYS.TOOLS_JSON, toolsJson);
  }, [toolsJson]);


  const stopConversation = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if(mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    
    playingSourcesRef.current.forEach(source => {
        try {
            source.stop();
        } catch(e) {
            console.warn("Could not stop audio source", e);
        }
    });
    playingSourcesRef.current.clear();

    setIsListening(false);
    setStatus('Conversation ended. You can adjust the config and start again.');
  }, []);

  const startConversation = async () => {
    if (isListening) return;
    
    let tools: Tool[] = [];
    try {
        tools = JSON.parse(toolsJson);
        setJsonParseError(null);
    } catch (e) {
        setJsonParseError('Invalid Tools JSON. Please fix it before starting.');
        return;
    }

    setTranscripts([]);
    setCurrentInterim({ user: '', model: '' });
    setIsListening(true);
    setStatus('Connecting to Gemini...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
      
      const config: any = {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (tools && tools.length > 0) {
        config.tools = tools;
      }
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config,
        callbacks: {
          onopen: () => {
            setStatus('Connected. Start speaking...');
            if (!audioContextRef.current || !mediaStreamRef.current) return;
            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = { data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    const callDetails = `Function Call: ${fc.name}(${JSON.stringify(fc.args)})`;
                    setTranscripts(prev => [...prev, { speaker: 'system', content: callDetails }]);
                    sessionPromiseRef.current?.then(session => {
                        session.sendToolResponse({
                            functionResponses: { id: fc.id, name: fc.name, response: { result: `Tool call ${fc.name} acknowledged.` } }
                        });
                    });
                }
            }

            if (message.serverContent?.inputTranscription) {
                currentInputTranscription.current += message.serverContent.inputTranscription.text;
                setCurrentInterim(prev => ({ ...prev, user: currentInputTranscription.current }));
            }
            if(message.serverContent?.outputTranscription) {
                currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                setCurrentInterim(prev => ({...prev, model: currentOutputTranscription.current}));
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if(base64Audio && outputAudioContextRef.current) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current.destination);
                
                const currentTime = outputAudioContextRef.current.currentTime;
                const startTime = Math.max(currentTime, nextStartTimeRef.current);
                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;

                playingSourcesRef.current.add(source);
                source.onended = () => playingSourcesRef.current.delete(source);
            }
            if (message.serverContent?.turnComplete) {
                setTranscripts(prev => [...prev, {speaker: 'user', content: currentInputTranscription.current}, {speaker: 'model', content: currentOutputTranscription.current}]);
                currentInputTranscription.current = '';
                currentOutputTranscription.current = '';
                setCurrentInterim({ user: '', model: ''});
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus('An error occurred. Please try again.');
            stopConversation();
          },
          onclose: () => {}
        }
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setStatus('Failed to get microphone. Please grant permission and try again.');
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => stopConversation();
  }, [stopConversation]);

  const handleClose = () => {
    stopConversation();
    onClose();
  };

  const handleResetToCanvas = () => {
    try {
        if (initialPromptJson) {
            const parsedPrompt = JSON.parse(initialPromptJson);
            setSystemInstruction(parsedPrompt.config?.systemInstruction || 'You are a helpful and friendly agent designed for testing n8n prompts.');
            setToolsJson(JSON.stringify(parsedPrompt.config?.tools || [], null, 2));
        }
    } catch (error) {
        console.error("Failed to parse initial prompt JSON for reset:", error);
        setStatus("Error resetting from canvas prompt.");
    }
  };
  
  const getSpeakerStyle = (speaker: Transcript['speaker']) => {
    switch(speaker) {
        case 'user': return 'text-indigo-300';
        case 'model': return 'text-cyan-300';
        case 'system': return 'text-yellow-400 italic';
        default: return 'text-gray-300';
    }
  }
  const getSpeakerLabel = (speaker: Transcript['speaker']) => {
    switch(speaker) {
        case 'user': return 'You';
        case 'model': return 'Gemini';
        case 'system': return 'System';
        default: return 'Unknown';
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Live Agent Test</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-8 h-8"/>
          </button>
        </div>
        
        <div className="flex-grow flex gap-6 overflow-hidden">
            {/* Config Panel */}
            <div className="w-1/3 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Configuration</h3>
                    <button
                        onClick={handleResetToCanvas}
                        disabled={isListening}
                        className="flex items-center text-sm px-2 py-1 bg-gray-600 text-indigo-300 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Reset configuration to match the current state of the main canvas"
                    >
                        <ArrowPathIcon className="w-4 h-4 mr-1" />
                        Reset to Canvas
                    </button>
                </div>
                <div>
                    <label htmlFor="system-instruction" className={commonLabelClass}>System Instruction</label>
                    <textarea 
                        id="system-instruction"
                        value={systemInstruction}
                        onChange={(e) => setSystemInstruction(e.target.value)}
                        disabled={isListening}
                        className={`${commonInputClass} h-32`}
                        rows={5}
                    />
                </div>
                 <div>
                    <label htmlFor="tools-json" className={commonLabelClass}>Tools (JSON)</label>
                    <textarea 
                        id="tools-json"
                        value={toolsJson}
                        onChange={(e) => setToolsJson(e.target.value)}
                        disabled={isListening}
                        className={`${commonInputClass} flex-grow`}
                    />
                    {jsonParseError && <p className="text-red-400 text-xs mt-1">{jsonParseError}</p>}
                </div>
            </div>

            {/* Conversation Panel */}
            <div className="w-2/3 flex flex-col">
                <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto mb-4">
                    {transcripts.map((t, i) => (
                        t.content && <p key={i} className={`${getSpeakerStyle(t.speaker)} mb-2`}><strong className="font-semibold">{getSpeakerLabel(t.speaker)}:</strong> {t.content}</p>
                    ))}
                    {currentInterim.user && <p className="text-indigo-300 opacity-70"><strong className="font-semibold">You:</strong> {currentInterim.user}</p>}
                    {currentInterim.model && <p className="text-cyan-300 opacity-70"><strong className="font-semibold">Gemini:</strong> {currentInterim.model}</p>}

                    {transcripts.length === 0 && !currentInterim.user && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Conversation will appear here.</p>
                        </div>
                    )}
                </div>
                
                <div className="flex-shrink-0 text-center">
                    <p className="text-gray-400 mb-4 h-5">{status}</p>
                    {!isListening ? (
                        <button onClick={startConversation} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full flex items-center mx-auto transition-all">
                            <MicrophoneIcon className="w-6 h-6 mr-2" />
                            Start Conversation
                        </button>
                    ) : (
                        <button onClick={stopConversation} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full flex items-center mx-auto transition-all">
                            <StopCircleIcon className="w-6 h-6 mr-2" />
                            Stop Conversation
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};