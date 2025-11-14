import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon, XMarkIcon } from './icons/Icons';

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


// --- Component ---
interface LiveAgentModalProps {
  onClose: () => void;
}

export const LiveAgentModal: React.FC<LiveAgentModalProps> = ({ onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Idle. Press Start to talk.');
  const [transcripts, setTranscripts] = useState<{ user: string, model: string }[]>([]);
  const [currentInterim, setCurrentInterim] = useState({ user: '', model: ''});

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
    
    // Stop all playing audio
    playingSourcesRef.current.forEach(source => {
        try {
            source.stop();
        } catch(e) {
            console.warn("Could not stop audio source", e);
        }
    });
    playingSourcesRef.current.clear();

    setIsListening(false);
    setStatus('Conversation ended.');
  }, []);

  const startConversation = async () => {
    if (isListening) return;

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
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are a helpful and friendly agent designed for testing n8n prompts.'
        },
        callbacks: {
          onopen: () => {
            setStatus('Connected. Start speaking...');
            if (!audioContextRef.current || !mediaStreamRef.current) return;
            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
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
                source.onended = () => {
                    playingSourcesRef.current.delete(source);
                }
            }
            if (message.serverContent?.turnComplete) {
                setTranscripts(prev => [...prev, {user: currentInputTranscription.current, model: currentOutputTranscription.current}]);
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
          onclose: () => {
             // Handled by user action
          }
        }
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setStatus('Failed to get microphone. Please grant permission and try again.');
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
        stopConversation();
    };
  }, [stopConversation]);

  const handleClose = () => {
    stopConversation();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Live Agent Test</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-8 h-8"/>
          </button>
        </div>

        <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto mb-4">
            {transcripts.map((t, i) => (
                <div key={i}>
                    <p className="text-indigo-300"><strong className="font-semibold">You:</strong> {t.user}</p>
                    <p className="text-cyan-300 mb-3"><strong className="font-semibold">Gemini:</strong> {t.model}</p>
                </div>
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
  );
};