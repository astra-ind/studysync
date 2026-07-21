import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { HardcodedUser } from '../config';
import { db, collection, addDoc, doc, setDoc, onSnapshot } from '../lib/firebase';
import { Sparkles, Calendar, Send, CheckCircle2, RotateCw, Check, Loader2, Info, Sliders, Lock } from 'lucide-react';
import { useToast } from './Toast';

interface AISchedulerCoachProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
}

interface AIEvent {
  title: string;
  type: 'free' | 'studying' | 'busy' | 'maybe';
  start: string;
  end: string;
  topic?: string;
  notes?: string;
}

interface AIResponse {
  schedule: AIEvent[];
  advice: string;
  metadata?: {
    modelUsed?: string;
  };
}

export default function AISchedulerCoach({ currentUser, partner }: AISchedulerCoachProps) {
  const { toast } = useToast();
  const [goalInput, setGoalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [isProgrammed, setIsProgrammed] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Settings & Customization state
  const [personalContext, setPersonalContext] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSettingsSaved, setShowSettingsSaved] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Subscribe to persistent personalized context from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const contextDocRef = doc(db, 'user_contexts', currentUser.id);
    const unsubscribe = onSnapshot(contextDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPersonalContext(docSnap.data().context || '');
      } else {
        setPersonalContext('');
      }
    });

    // Load independent custom API key from localStorage
    const savedKey = localStorage.getItem(`gemini_api_key_${currentUser.id}`) || '';
    setCustomApiKey(savedKey);

    return () => unsubscribe();
  }, [currentUser]);

  // Save Settings to Firestore & Local Storage
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      // 1. Save personal context permanently to Firestore so it syncs
      await setDoc(doc(db, 'user_contexts', currentUser.id), {
        context: personalContext.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // 2. Save Custom API Key locally in the browser
      if (customApiKey.trim()) {
        localStorage.setItem(`gemini_api_key_${currentUser.id}`, customApiKey.trim());
      } else {
        localStorage.removeItem(`gemini_api_key_${currentUser.id}`);
      }

      setShowSettingsSaved(true);
      toast('AI Coach preferences saved successfully!', 'success');
      setTimeout(() => setShowSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Error saving AI coach customization:', err);
      toast('Failed to save preferences.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Helper to ensure dates are perfectly parsed relative to user's local timezone
  // strips any trailing "Z" or offset before converting to correct local Date and toISOString (UTC)
  const toLocalISOString = (dateStr: string) => {
    let cleanStr = dateStr;
    if (cleanStr.endsWith('Z')) {
      cleanStr = cleanStr.slice(0, -1);
    }
    const offsetRegex = /[+-]\d{2}:\d{2}$/;
    cleanStr = cleanStr.replace(offsetRegex, '');

    // Robust local parsing of "YYYY-MM-DDTHH:mm:ss" to avoid differences between browser engines
    const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/) 
               || cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/)
               || cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
               || cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed month
      const day = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const second = match[6] ? parseInt(match[6], 10) : 0;
      
      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }

    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  // Helper to format Date timezone-naive for stable fallback blocks
  const formatTimezoneNaive = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Submit request to Express API route or run client-side Gemini
  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;

    setIsLoading(true);
    setAiResult(null);
    setIsProgrammed(false);
    setApiError(null);

    // Calculate actual local YYYY-MM-DD date rather than UTC slice
    const localDateObj = new Date();
    const localYear = localDateObj.getFullYear();
    const localMonth = String(localDateObj.getMonth() + 1).padStart(2, '0');
    const localDay = String(localDateObj.getDate()).padStart(2, '0');
    const localDateStr = `${localYear}-${localMonth}-${localDay}`;
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let successData: AIResponse | null = null;
    let fallbackToClient = false;

    // Detect if we are running in a static web environment with no active backend
    const isStaticDeployment = window.location.hostname.includes('netlify.app') || 
                               window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('github.io');

    if (isStaticDeployment && !customApiKey.trim()) {
      setApiError("This site is deployed on Netlify (static hosting) which doesn't have an active Express backend. To use the AI Coach here, please open settings (the gear icon above) and enter your own Google Gemini API Key!");
      setIsLoading(false);
      return;
    }

    // Try server first if we are not strictly forced or on a static environment with a custom key
    if (!isStaticDeployment || !customApiKey.trim()) {
      try {
        const response = await fetch('/api/scheduler/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: goalInput.trim(),
            currentLocalDate: localDateStr,
            timezone: userTimezone,
            userName: currentUser.name,
            customApiKey: customApiKey.trim() || undefined,
            personalContext: personalContext.trim() || undefined,
          }),
        });

        let data: any = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (jsonErr) {
            throw new Error('Failed to parse API response as JSON.');
          }
        } else {
          const text = await response.text();
          if (text.trim().startsWith('<')) {
            // Netlify/static hosting returns HTML (404/index.html fallback) for routes it doesn't recognize
            fallbackToClient = true;
          } else {
            throw new Error(`Server error (Status ${response.status}): ${text.slice(0, 100)}`);
          }
        }

        if (!fallbackToClient) {
          if (!response.ok) {
            let errMsg = 'API server returned an error';
            if (data && data.error) {
              try {
                const parsedError = JSON.parse(data.error);
                if (parsedError.error && parsedError.error.message) {
                  errMsg = parsedError.error.message;
                } else if (parsedError.message) {
                  errMsg = parsedError.message;
                } else {
                  errMsg = data.error;
                }
              } catch {
                errMsg = data.error;
              }
            }
            throw new Error(errMsg);
          }

          successData = data;
        }
      } catch (err: any) {
        console.warn('Backend scheduler route failed, checking client-side capability:', err);
        if (customApiKey.trim()) {
          fallbackToClient = true;
        } else {
          setApiError(err.message || 'Failed to communicate with AI Coach');
          setIsLoading(false);
          return;
        }
      }
    } else {
      fallbackToClient = true;
    }

    if (fallbackToClient) {
      const apiKeyToUse = customApiKey.trim();
      if (!apiKeyToUse) {
        setApiError("The server backend is unavailable on this host. Please open settings and enter your custom Gemini API key to utilize the AI study planner here.");
        setIsLoading(false);
        return;
      }

      try {
        const clientAi = new GoogleGenAI({
          apiKey: apiKeyToUse,
        });

        let systemInstruction = `You are the AI Study Planner Coach for "Study Sync", a real-time ledger diary shared by "A" and "G".
Your job is to design a personalized, cohesive study schedule based on the user's goals, availability, and plan.
You can create "daily", "weekly", or "monthly" blocks.
The user's local date/time is ${localDateStr} in timezone ${userTimezone}. The user talking to you is "${currentUser.name}".`;

        if (personalContext && personalContext.trim()) {
          systemInstruction += `\n\nUSER'S PERMANENT PERSONAL PREFERENCES AND STUDY CONTEXT (Adhere strictly to these):
${personalContext.trim()}`;
        }

        systemInstruction += `\n\nCRITICAL RULE:
Generate schedules ONLY for the current user talking to you (${currentUser.name}). Do NOT generate or suggest schedule blocks for the other user. You can align or match with the other user's free slots if helpful, but the 'schedule' array you return must contain ONLY events for "${currentUser.name}".

When designing the schedule:
1. Try to schedule "Focused Studying" blocks ('studying') or "Free Space" blocks ('free') when they want to collaborate or sync.
2. Keep it balanced. Don't schedule 24 hours of straight studying. Include breaks.
3. Every slot must have a start and end ISO time. Use the anchor date ${localDateStr} to calculate dates correctly (e.g., today, tomorrow, this week).
4. All date-times for 'start' and 'end' MUST be generated as timezone-naive local date-time strings (e.g., "YYYY-MM-DDTHH:MM:SS" without any trailing "Z" or offset).
5. All event types MUST be exactly one of: 'free', 'studying', 'busy', 'maybe'.
6. Always provide a motivating, personal piece of advice in the 'advice' field. Speak to them as a friendly academic coach.
7. Make sure you use standard, human labels (e.g. 'Math Exam Cramming', 'Calculus Overlap Slot', 'Chemistry Review'). Do not use pseudo-intellectual names. No telemetry.`;

        const candidateModels = [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
        ];

        let responseText = '';
        let usedModel = '';

        for (const modelName of candidateModels) {
          try {
            const response = await clientAi.models.generateContent({
              model: modelName,
              contents: goalInput.trim(),
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    schedule: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING, description: "Friendly name of the session" },
                          type: { type: Type.STRING, description: "Must be 'free', 'studying', 'busy', or 'maybe'" },
                          start: { type: Type.STRING, description: "Local date-time string without Z or offset, e.g., 2026-07-17T15:00:00" },
                          end: { type: Type.STRING, description: "Local date-time string without Z or offset, e.g., 2026-07-17T17:00:00" },
                          topic: { type: Type.STRING, description: "Optional subject or chapter details" },
                          notes: { type: Type.STRING, description: "Optional notes about the goals of this session" }
                        },
                        required: ["title", "type", "start", "end"]
                      }
                    },
                    advice: { type: Type.STRING, description: "Encouraging, friendly commentary about how this plan helps them reach their goals" }
                  },
                  required: ["schedule", "advice"]
                }
              }
            });

            if (response && response.text) {
              responseText = response.text;
              usedModel = modelName;
              break;
            }
          } catch (modelErr) {
            console.warn(`Direct model ${modelName} attempt failed:`, modelErr);
          }
        }

        if (!responseText) {
          throw new Error("All tried client-side Gemini models failed to generate content. Check your Custom API Key.");
        }

        const data = JSON.parse(responseText);
        if (typeof data === "object" && data !== null) {
          data.metadata = { modelUsed: `${usedModel} (Direct Client)` };
        }
        successData = data;
      } catch (clientErr: any) {
        console.error('Client-side generation failure:', clientErr);
        setApiError(`Client-Side AI Generation Failed: ${clientErr.message || 'Verification failed'}`);
        setIsLoading(false);
        return;
      }
    }

    if (successData) {
      setAiResult(successData);
      toast('AI Coach has drafted your plan successfully!', 'success');
    } else {
      // Setup timezone-safe fallback mock data to prevent crashes
      setAiResult({
        schedule: [
          {
            title: `Study Session: ${currentUser.name}`,
            type: 'studying',
            start: formatTimezoneNaive(new Date()),
            end: formatTimezoneNaive(new Date(Date.now() + 2 * 60 * 60 * 1000)),
            topic: 'Core Review',
            notes: 'AI fallback block. Check your custom API Key / settings.',
          }
        ],
        advice: `⚠️ AI Coach Warning: The scheduling engine failed to connect to Gemini. Please configure your custom Gemini API Key in settings or check your connection.`,
      });
      toast('Direct client-side fallback loaded.', 'info');
    }

    setIsLoading(false);
  };

  // Program schedule directly into Firestore
  const handleProgramToDatabase = async () => {
    if (!aiResult || aiResult.schedule.length === 0) return;

    try {
      for (const ev of aiResult.schedule) {
        await addDoc(collection(db, 'events'), {
          userId: currentUser.id,
          title: ev.title,
          type: ev.type,
          // Guarantee it is parsed as local timezone and saved as proper UTC
          start: toLocalISOString(ev.start),
          end: toLocalISOString(ev.end),
          recurrence: 'none' as const,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          topic: ev.topic || '',
          notes: ev.notes || '',
          createdAt: new Date().toISOString(),
        });
      }

      // Add standard notifications so other user sees the study lock
      await addDoc(collection(db, 'notifications'), {
        text: `🤖 AI Study Sync: ${currentUser.name} scheduled study slots via AI Coach matching context. Programmed ${aiResult.schedule.length} slots!`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'success',
      });

      setIsProgrammed(true);
      setGoalInput('');
      toast(`Scheduled ${aiResult.schedule.length} AI study slots into your Ledger!`, 'success');
    } catch (err) {
      console.error('Error programming events:', err);
      toast('Failed to program AI slots into calendar.', 'error');
    }
  };

  return (
    <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] space-y-4">
      {/* Intro Header */}
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 font-mono">
            <Sparkles className="h-4.5 w-4.5 text-amber-600 animate-pulse" />
            AI Study Planner Coach
          </h3>
          <p className="text-xs text-stone-500 font-sans leading-relaxed">
            Personalized, cohesive schedules suited to your specific study goals. Fully programmable into the shared ledger calendar.
          </p>
        </div>
        
        <button
          type="button"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          className={`p-2 rounded-xl border-2 flex items-center gap-1.5 cursor-pointer transition shrink-0 text-xs font-black font-mono ${
            showSettingsPanel 
              ? 'bg-[#FCFBF7] border-[#D9D1C0] text-stone-900 shadow-inner' 
              : 'bg-white border-stone-200 text-stone-500 hover:text-stone-950 hover:border-stone-400'
          }`}
          title="Configure AI Preferences"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettingsPanel && (
        <div className="p-4 rounded-xl border-2 border-[#D9D1C0] bg-[#FCFBF8] space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 border-b border-stone-200/60 pb-2">
            <Sliders className="h-4 w-4 text-[#B59F74]" />
            <h4 className="text-xs font-black uppercase tracking-widest text-stone-900 font-mono">AI Customization Panel</h4>
          </div>

          {/* Personal context textarea */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider font-mono flex items-center gap-1">
              📝 Study Context / Preferences (Persistent)
            </label>
            <textarea
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
              placeholder="e.g., I study best in the evenings between 6pm and 9pm. Keep Saturdays free of studying. Focus on Calculus chapters 1-3. Schedule 45-minute study intervals with 10-minute short breaks."
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl border-2 border-stone-200 bg-white text-stone-950 focus:outline-none focus:border-stone-800 transition"
            />
            <span className="text-[9px] text-stone-400 font-sans leading-relaxed block">
              This context is saved permanently to Firestore and is passed into all future AI prompt requests.
            </span>
          </div>

          {/* Custom API Key input */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider font-mono flex items-center gap-1">
              🔑 Custom Gemini API Key (Optional Override)
            </label>
            <div className="relative">
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="AI Studio API Key (forces independent client-side work)"
                className="w-full text-xs p-2.5 pl-8.5 rounded-xl border-2 border-stone-200 bg-white text-stone-950 focus:outline-none focus:border-stone-800 transition font-mono"
              />
              <Lock className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-3.5" />
            </div>
            <span className="text-[9px] text-stone-400 font-sans leading-relaxed block">
              Allows the AI coach to work independently outside this Cloud sandbox. Saved locally in your browser.
            </span>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              {showSettingsSaved ? (
                <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1 font-mono">
                  <Check className="h-3.5 w-3.5" /> Preferences saved!
                </span>
              ) : (
                <span className="text-[9px] text-stone-400 italic">Saved preferences apply to all queries.</span>
              )}
            </div>
            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:opacity-50 shrink-0 border-2 border-stone-900"
            >
              {isSavingSettings ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Input Prompt Form */}
      <form onSubmit={handleGeneratePlan} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            required
            disabled={isLoading}
            placeholder={
              personalContext 
                ? "What study plan are we outlining today (using your preferences)?" 
                : "e.g., Physics Exam next Tuesday. Schedule 3 hours studying every evening..."
            }
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            className="flex-1 rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={isLoading || !goalInput.trim()}
            className="px-4.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{isLoading ? 'Planning' : 'Plan'}</span>
          </button>
        </div>
      </form>

      {/* Reassuring Loader Messages */}
      {isLoading && (
        <div className="p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/20 text-center space-y-1.5 animate-pulse">
          <p className="text-xs font-serif italic text-stone-700">"Consulting textbook syllabus and cross-checking sync diaries..."</p>
          <p className="text-[10px] text-stone-400 font-sans">Gemini is curating blocks that optimize collaboration without causing burnout.</p>
        </div>
      )}

      {/* API Error Panel */}
      {apiError && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs flex gap-2">
          <Info className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">AI Generation Alert</p>
            <p className="text-[11px] leading-relaxed opacity-90">{apiError}</p>
            <p className="text-[10px] font-mono opacity-85 pt-1">
              Tip: Ensure a valid API Key is set in settings, or check .env.example configuration.
            </p>
          </div>
        </div>
      )}

      {/* AI Success Presentation Card */}
      {aiResult && (
        <div className="p-4 rounded-xl border-2 border-stone-200 bg-[#FCFBF8] space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          {/* Coach Advice Bubble */}
          <div className="p-3.5 rounded-lg border-2 border-[#D9D1C0] bg-white text-xs font-serif text-stone-800 leading-relaxed italic relative">
            <span className="text-xs font-black uppercase tracking-widest font-mono text-[#A58D56] block not-italic mb-1">
              🎓 Coach's Study Strategy Advice:
            </span>
            {aiResult.advice}
          </div>

          {/* Schedule Preview Checklist */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block font-mono">
              Proposed Calendar Slots:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {aiResult.schedule.map((slot, idx) => {
                let badge = 'bg-stone-100 text-stone-700 border-stone-200';
                if (slot.type === 'studying') badge = 'bg-sky-50 text-sky-800 border-sky-200';
                if (slot.type === 'free') badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (slot.type === 'maybe') badge = 'bg-amber-50 text-amber-800 border-amber-200';

                // Parse timezone-safeguarded start & end
                const localStart = new Date(toLocalISOString(slot.start));
                const localEnd = new Date(toLocalISOString(slot.end));

                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-stone-200 bg-white flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate">{slot.title}</p>
                      {slot.topic && <p className="text-[10px] text-[#A58D56] font-mono">📚 {slot.topic}</p>}
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {localStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                        {localStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {localEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${badge}`}>
                      {slot.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Used Metadata Indicator */}
          {aiResult.metadata?.modelUsed && (
            <div className="flex justify-end px-1 -mt-2">
              <span className="text-[9px] text-stone-400 font-mono">
                Succeeded using model: <span className="font-bold text-[#A58D56]">{aiResult.metadata.modelUsed}</span>
              </span>
            </div>
          )}

          {/* Commit Actions */}
          <div className="flex gap-2">
            {isProgrammed ? (
              <div className="w-full text-center p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-950 text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                <span>Programmed in Study Sync Ledger Diary!</span>
              </div>
            ) : (
              <button
                onClick={handleProgramToDatabase}
                className="w-full flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition shadow-md cursor-pointer border-2 border-stone-900"
              >
                <Calendar className="h-4 w-4 text-amber-200" />
                <span>Program Schedule into Ledger</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
