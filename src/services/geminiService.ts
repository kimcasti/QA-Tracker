import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3-flash-preview';

function getEnvValue(value: unknown) {
  return String(value || '').trim();
}

export const getGeminiApiKey = () =>
  getEnvValue(import.meta.env.VITE_GEMINI_API_KEY) || getEnvValue(process.env.GEMINI_API_KEY);

function createGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  return new GoogleGenAI({ apiKey });
}

function normalizeGeminiError(error: unknown) {
  const raw: any = (error as any)?.error ?? error;
  const reason = raw?.details?.[0]?.reason;
  const message = (raw?.message || raw?.error?.message || (error as any)?.message || '').toString();

  if (reason === 'API_KEY_INVALID' || /api key not valid/i.test(message)) {
    throw new Error('GEMINI_API_KEY_INVALID');
  }

  if (/reported as leaked/i.test(message)) {
    throw new Error('GEMINI_API_KEY_LEAKED');
  }

  throw error;
}

export async function generateTestCasesWithAI(functionalityName: string, moduleName: string) {
  const ai = createGeminiClient();

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
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
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
              priority: { type: Type.STRING },
            },
            required: [
              'title',
              'description',
              'preconditions',
              'testSteps',
              'expectedResult',
              'testType',
              'priority',
            ],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No se recibió respuesta de la IA');
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Error generating test cases:', error);
    normalizeGeminiError(error);
  }
}

export async function improveMeetingNotesWithAI(notes: string) {
  const ai = createGeminiClient();

  const prompt = `Reorganiza las siguientes notas de reunión en un formato estructurado con las siguientes secciones:
1. Resumen de la reunión
2. Decisiones
3. Acciones a realizar
4. Próximos pasos

Notas:
${notes}

Responde únicamente con un objeto JSON que tenga las llaves: summary, decisions, actions, nextSteps.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            decisions: { type: Type.STRING },
            actions: { type: Type.STRING },
            nextSteps: { type: Type.STRING },
          },
          required: ['summary', 'decisions', 'actions', 'nextSteps'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No se recibió respuesta de la IA');
    }

    const result = JSON.parse(text);
    return {
      summary: result?.summary || '',
      decisions: result?.decisions || '',
      actions: result?.actions || '',
      nextSteps: result?.nextSteps || '',
    };
  } catch (error) {
    console.error('Error improving meeting notes:', error);
    normalizeGeminiError(error);
  }
}
