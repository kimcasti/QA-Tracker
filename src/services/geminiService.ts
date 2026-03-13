import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_KEY_STORAGE = "GEMINI_API_KEY";

export const getGeminiApiKey = () => {
  const envKey = (process.env.GEMINI_API_KEY || "").toString().trim();
  const storedKey =
    typeof window !== "undefined" ? (localStorage.getItem(GEMINI_KEY_STORAGE) || "").trim() : "";
  // Prefer user-provided key so it can override a baked-in env key.
  return storedKey || envKey;
};

export const generateTestCasesWithAI = async (functionalityName: string, moduleName: string) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `Genera 3 casos de prueba detallados para la funcionalidad "${functionalityName}" del módulo "${moduleName}". 
  Devuelve un array de objetos JSON con la siguiente estructura:
  {
    "title": "Título del caso",
    "description": "Descripción breve",
    "preconditions": "Precondiciones",
    "testSteps": "1. Paso 1\\n2. Paso 2...",
    "expectedResult": "Resultado esperado",
    "testType": "Funcional",
    "priority": "Medio"
  }
  Asegúrate de que los tipos de prueba sean uno de: Integración, Funcional, Sanity, Regresión, Smoke, Exploratoria, UAT.
  Asegúrate de que la prioridad sea uno de: Crítico, Alto, Medio, Bajo.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              preconditions: { type: Type.STRING },
              testSteps: { type: Type.STRING },
              expectedResult: { type: Type.STRING },
              testType: { type: Type.STRING },
              priority: { type: Type.STRING }
            },
            required: ["title", "description", "preconditions", "testSteps", "expectedResult", "testType", "priority"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No se recibió respuesta de la IA");
    
    return JSON.parse(text);
  } catch (error) {
    // Normalize common SDK error shapes to stable error codes for the UI.
    const raw: any = (error as any)?.error ?? error;
    const reason = raw?.details?.[0]?.reason;
    const message = (raw?.message || raw?.error?.message || (error as any)?.message || "").toString();

    if (reason === "API_KEY_INVALID" || /api key not valid/i.test(message)) {
      throw new Error("GEMINI_API_KEY_INVALID");
    }

    if (/reported as leaked/i.test(message)) {
      throw new Error("GEMINI_API_KEY_LEAKED");
    }

    console.error("Error generating test cases:", error);
    throw error;
  }
};

export const improveMeetingNotesWithAI = async (notes: string) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `Reorganiza las siguientes notas de reunión en un formato estructurado con las siguientes secciones:
  1. Resumen de la reunión
  2. Decisiones
  3. Acciones a realizar
  4. Próximos pasos

  Notas:
  ${notes}

  Responde ÚNICAMENTE con un objeto JSON que tenga las llaves: summary, decisions, actions, nextSteps.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            decisions: { type: Type.STRING },
            actions: { type: Type.STRING },
            nextSteps: { type: Type.STRING }
          },
          required: ["summary", "decisions", "actions", "nextSteps"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No se recibió respuesta de la IA");

    const result = JSON.parse(text);
    return {
      summary: result?.summary || "",
      decisions: result?.decisions || "",
      actions: result?.actions || "",
      nextSteps: result?.nextSteps || ""
    };
  } catch (error) {
    // Keep the same normalized error codes used by the UI.
    const raw: any = (error as any)?.error ?? error;
    const reason = raw?.details?.[0]?.reason;
    const message = (raw?.message || raw?.error?.message || (error as any)?.message || "").toString();

    if (reason === "API_KEY_INVALID" || /api key not valid/i.test(message)) {
      throw new Error("GEMINI_API_KEY_INVALID");
    }

    if (/reported as leaked/i.test(message)) {
      throw new Error("GEMINI_API_KEY_LEAKED");
    }

    console.error("Error improving meeting notes:", error);
    throw error;
  }
};
