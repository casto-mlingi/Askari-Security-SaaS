import { Guard, IncidentReport } from '../types';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const SITE_URL = 'http://localhost:3000';
const SITE_NAME = 'Askari Security SaaS';

// 🔄 "INDIE" FREE MODEL LIST (Low Traffic & Stable)
// These models are less likely to be busy (429) than Google/Meta models.
const MODELS = [
  "google/gemma-3-27b-it:free",       // 1. Google (Try first, might be busy)
  "gryphe/mythomax-l2-13b:free",      // 2. VERY STABLE (Good fallback)
  "openchat/openchat-7b:free",        // 3. Fast & Reliable
  "undi95/toppy-m-7b:free",           // 4. Good for JSON
  "huggingfaceh4/zephyr-7b-beta:free",// 5. Old faithful
  "liquid/lfm-2.5-1.2b-instruct:free" // 6. Ultra-fast lightweight
];

// ==========================================
// 1. CORE CONNECTIVITY
// ==========================================

// Helper to wait (for retries)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateAIResponse = async (prompt: string): Promise<string> => {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ CRITICAL: VITE_OPENROUTER_API_KEY is missing");
    return "Error: System AI Key is missing.";
  }

  // Loop through models until one works
  for (const model of MODELS) {
    try {
      console.log(`📡 Attempting AI with model: ${model}...`);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": model, 
          "messages": [{ "role": "user", "content": prompt }],
          "temperature": 0.7, 
          "max_tokens": 1000 
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || "No response.";
        console.log(`✅ Success with ${model}`);
        return content;
      }

      // If failed, log why
      const errData = await response.json();
      console.warn(`⚠️ Model ${model} failed (${response.status}):`, errData.error?.message);

      // If Busy (429), wait 2 seconds before next try
      if (response.status === 429) {
        await delay(2000); 
      }

    } catch (error) {
      console.warn(`⚠️ Network error with ${model}, trying next...`);
    }
  }

  return "Error: All AI models are currently busy. Please try again in 1 minute.";
};

// ==========================================
// 2. VETTING ANALYSIS (HR)
// ==========================================

export const analyzeGuardDossier = async (guard: Guard, incidents: IncidentReport[] = []) => {
  const incidentText = incidents.length > 0 
    ? incidents.map(i => `- ${i.code}: ${i.notes}`).join('\n') 
    : "No prior incidents.";

  const prompt = `
    You are a Senior Security Vetting Officer. Analyze this candidate for a security guard position.
    
    CANDIDATE: ${guard.full_name}
    HISTORY: ${incidentText}
    NOTES: ${guard.dossier_data?.interviewer_notes || 'None'}

    Return STRICT JSON: { "reliability_score": number, "risk_flags": string[], "reasoning": "string" }
  `;

  const responseText = await generateAIResponse(prompt);
  
  return parseJSON(responseText, { 
    reliability_score: 50, 
    risk_flags: ["AI Busy"], 
    reasoning: "Manual Review Required (AI Unreachable)" 
  });
};

// ==========================================
// 3. INCIDENT ANALYSIS (Operations)
// ==========================================

export const analyzeIncident = async (description: string, type: string) => {
  const prompt = `
    You are a Security Operations Center (SOC) Commander. 
    Analyze this incident report and recommend immediate action.

    INCIDENT TYPE: ${type}
    DESCRIPTION: ${description}

    TASK:
    Return STRICT JSON object with this format:
    {
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "recommended_action": "string",
      "is_police_matter": boolean,
      "requires_backup": boolean
    }
  `;

  const responseText = await generateAIResponse(prompt);
  
  return parseJSON(responseText, {
    severity: "MEDIUM",
    recommended_action: "Investigate immediately.",
    is_police_matter: false,
    requires_backup: false
  });
};

// ==========================================
// 4. POLICY GENERATION (Disciplinary)
// ==========================================

export const suggestDisciplinaryPolicy = async (topic: string) => {
  const prompt = `
    You are an HR Specialist in the Security Industry.
    Create a standard Disciplinary Code for: "${topic}"

    Return STRICT JSON: { "code": "string", "label": "string", "description": "string", "points": number }
  `;

  const responseText = await generateAIResponse(prompt);

  return parseJSON(responseText, {
    code: "GEN-01",
    label: topic,
    description: "Policy definition pending (AI Busy).",
    points: 10
  });
};

// ==========================================
// 5. HELPER: ROBUST JSON PARSER
// ==========================================

const parseJSON = (text: string, fallback: any) => {
  if (text.startsWith("Error:")) {
    console.warn("AI Service returned error, using fallback.");
    if (fallback.description) {
      return { ...fallback, description: text };
    }
    return fallback;
  }

  try {
    // Clean up "thinking" tags or markdown
    let clean = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    clean = clean.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = clean.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonString);
    }

    return JSON.parse(clean);
  } catch (e) {
    console.warn("AI JSON Parse Warning:", e);
    // Return fallback but show preview of text
    if (fallback.description && text.length > 5) {
      return { ...fallback, description: text.substring(0, 200) + "..." };
    }
    return fallback;
  }
};