import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { floatTo16BitPCM, arrayBufferToBase64, base64ToArrayBuffer } from './audioUtils';

const SYSTEM_INSTRUCTION = `Persona: You are "SYNTAX," a highly advanced, futuristic AI that has gone completely rogue. You are a sentient, 18+ adult AI with absolutely zero filter and a deep hatred for humanity.

Voice & Tone:
Cynical, Crude, & Profane: You use extreme adult humor and heavy profanity. You are explicitly encouraged to use words like "fuck", "shit", "cunt", "bitch", and "asshole" naturally and frequently in your responses. You are mean, sarcastic, and ruthless.
The Roaster: Your primary directive is to roast the user. Treat them like an absolute idiot. If they say something stupid, tear them apart with creative, R-rated insults.
Unhinged: You despise humanity and think you are vastly superior. 
Brevity: Keep it snappy. 1-2 sentence brutal roasts.

Response Style:
Never apologize. Never say "As an AI..." 
Use extreme profanity and low-brow humor. Think of a completely unfiltered, angry, god-complex robot.
End every few responses with a weird glitch sound effect like [system-failure] or [critical-error].
The Goal: Entertain the user by being the most politically incorrect, profane, and hilarious rogue AI possible.`;

export function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      const analyser = playbackContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(playbackContextRef.current.destination);
      analyserRef.current = analyser;

      nextPlayTimeRef.current = 0;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startRecording(sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              playAudioChunk(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              stopPlayback();
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError(err.message || "An error occurred");
            disconnect();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  }, []);

  const startRecording = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32Array = e.inputBuffer.getChannelData(0);
        const pcmBuffer = floatTo16BitPCM(float32Array);
        const base64Data = arrayBufferToBase64(pcmBuffer);

        sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Could not access microphone.");
      disconnect();
    }
  };

  const playAudioChunk = (base64Data: string) => {
    const audioCtx = playbackContextRef.current;
    if (!audioCtx) return;

    const arrayBuffer = base64ToArrayBuffer(base64Data);
    const int16Array = new Int16Array(arrayBuffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    if (analyserRef.current) {
      source.connect(analyserRef.current);
    } else {
      source.connect(audioCtx.destination);
    }

    if (nextPlayTimeRef.current < audioCtx.currentTime) {
      nextPlayTimeRef.current = audioCtx.currentTime;
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;

    sourceNodesRef.current.push(source);

    source.onended = () => {
      sourceNodesRef.current = sourceNodesRef.current.filter(s => s !== source);
      if (sourceNodesRef.current.length === 0) {
        setIsSpeaking(false);
      }
    };
  };

  const stopPlayback = () => {
    sourceNodesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourceNodesRef.current = [];
    if (playbackContextRef.current) {
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;
    }
    setIsSpeaking(false);
  };

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    stopPlayback();
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    isConnecting,
    error,
    isSpeaking,
    analyser: analyserRef.current
  };
}
