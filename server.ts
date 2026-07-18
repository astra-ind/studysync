import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Shared Gemini client setup
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route for AI Scheduler
  app.post("/api/scheduler/generate", async (req, res) => {
    try {
      const { prompt, currentLocalDate, timezone, userName } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const systemInstruction = `You are the AI Study Planner Coach for "Study Sync", a real-time ledger diary shared by "A" and "G".
Your job is to design a personalized, cohesive study schedule based on the user's goals, availability, and plan.
You can create "daily", "weekly", or "monthly" blocks.
The user's local date/time is ${currentLocalDate} in timezone ${timezone}. The user talking to you is "${userName}".

CRITICAL RULE:
Generate schedules ONLY for the current user talking to you (${userName}). Do NOT generate or suggest schedule blocks for the other user. You can align or match with the other user's free slots if helpful, but the 'schedule' array you return must contain ONLY events for "${userName}".

When designing the schedule:
1. Try to schedule "Focused Studying" blocks ('studying') or "Free Space" blocks ('free') when they want to collaborate or sync.
2. Keep it balanced. Don't schedule 24 hours of straight studying. Include breaks.
3. Every slot must have a start and end ISO time. Use the anchor date ${currentLocalDate} to calculate dates correctly (e.g., today, tomorrow, this week).
4. All event types MUST be exactly one of: 'free', 'studying', 'busy', 'maybe'.
5. Always provide a motivating, personal piece of advice in the 'advice' field. Speak to them as a friendly academic coach.
6. Make sure you use standard, human labels (e.g. 'Math Exam Cramming', 'Calculus Overlap Slot', 'Chemistry Review'). Do not use pseudo-intellectual names. No telemetry.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
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
                    start: { type: Type.STRING, description: "ISO date-time string e.g., 2026-07-17T15:00:00" },
                    end: { type: Type.STRING, description: "ISO date-time string e.g., 2026-07-17T17:00:00" },
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

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText);
      res.json(data);
    } catch (err: any) {
      console.error("Gemini API error:", err);
      res.status(500).json({ error: err.message || "Failed to generate schedule" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
