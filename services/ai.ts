import { GoogleGenAI, Type } from "@google/genai";
import { Guard } from "../types";

// Initialize the Gemini AI client using the injected environment variable
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Reliability Forecast: Uses Gemini 3 Pro to analyze a guard's dossier.
 * Generates a reliability score and identifies risk flags based on demographics and history.
 */
export async function analyzeGuardDossier(guard: Guard) {
  const ai = getAI();
  const prompt = `
    Role: Senior Security Vetting Officer for 'Askari', a private security firm.
    Task: Analyze this applicant's dossier for risk and reliability.
    
    Applicant Data:
    - Name: ${guard.full_name}
    - Age: ${guard.dob ? new Date().getFullYear() - new Date(guard.dob).getFullYear() : 'Unknown'}
    - NIDA: ${guard.nida_number}
    - Education: ${guard.education_history.map(e => `${e.level} (${e.year})`).join(', ') || 'None listed'}
    - Guarantors: ${guard.guarantors.length} listed
    - Armed: ${guard.is_armed ? 'Yes' : 'No'}
    
    Analyze for inconsistencies, gaps, or risk factors.
    If data is sparse, score lower.
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reliability_score: { type: Type.NUMBER, description: "0-100 reliability score. <50 is risky, >80 is excellent." },
            reasoning: { type: Type.STRING, description: "A concise executive summary of the analysis (max 30 words)." },
            risk_flags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of potential risks (e.g. 'No Guarantors', 'Underage')." 
            }
          },
          required: ["reliability_score", "reasoning", "risk_flags"]
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      reliability_score: result.reliability_score || 50,
      reasoning: result.reasoning || "Analysis failed.",
      risk_flags: result.risk_flags || []
    };

  } catch (error) {
    console.error("AI Vetting Error:", error);
    return {
      reliability_score: 50,
      reasoning: "AI Service Unavailable - Manual Review Required",
      risk_flags: ["System Error"]
    };
  }
}

/**
 * Operational Triage: Uses Gemini 3 Pro to categorize incident reports from rough notes.
 * It suggests the appropriate disciplinary code and formalizes the report text.
 */
export async function analyzeIncident(notes: string, availableCodes: string[]) {
  const ai = getAI();
  const prompt = `
    Role: Security Operations Center Controller.
    Task: Read the supervisor's rough field notes and categorize the incident.
    
    Supervisor Notes: "${notes}"
    
    Available Disciplinary Codes: ${availableCodes.join(', ')}
    
    1. Select the BEST fitting code. If unsure, use 'OTHER_REPORT'.
    2. Rewrite the notes to be formal, concise, and forensic suitable for a legal report.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended_code: { type: Type.STRING, description: "The exact code from the available list." },
            formal_notes: { type: Type.STRING, description: "Formalized version of the event description." }
          },
          required: ["recommended_code", "formal_notes"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Incident Analysis Error:", error);
    return null;
  }
}

/**
 * Policy Generator: Suggests a disciplinary code, label, and point value based on a description.
 */
export async function suggestDisciplinaryPolicy(description: string) {
  const ai = getAI();
  const prompt = `
    Role: HR Policy Architect for a security firm.
    Task: Create a disciplinary policy code based on the user's description.
    
    Description: "${description}"
    
    Requirements:
    1. Code: Uppercase, snake_case, max 20 chars (e.g. SLEEPING_ON_DUTY).
    2. Label: Professional, short title.
    3. Points: 1-100 severity score (100 is immediate termination/theft, 5 is minor).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "UPPERCASE_SNAKE_CASE code" },
            label: { type: Type.STRING, description: "Human readable label" },
            points: { type: Type.NUMBER, description: "Deduction points (1-100)" }
          },
          required: ["code", "label", "points"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Policy Generation Error:", error);
    return null;
  }
}