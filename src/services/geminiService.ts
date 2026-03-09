import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateTestCasesWithAI = async (functionalityName: string, moduleName: string) => {
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
      contents: prompt,
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
    console.error("Error generating test cases:", error);
    throw error;
  }
};
