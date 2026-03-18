import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3-flash-preview';

export type ExecutionRecommendationCandidate = {
  id: string;
  name: string;
  module: string;
  priority: string;
  riskLevel: string;
  isCore: boolean;
  isRegression: boolean;
  isSmoke: boolean;
  lastFunctionalChangeAt?: string;
  roles: string[];
  testCaseCount: number;
};

export type ExecutionRecommendation = {
  functionalityId: string;
  reason: string;
};

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

export async function recommendExecutionFunctionalitiesWithAI(input: {
  testType: string;
  selectedModules: string[];
  selectedFunctionalities: ExecutionRecommendationCandidate[];
  candidateFunctionalities: ExecutionRecommendationCandidate[];
  maxSuggestions?: number;
}) {
  const ai = createGeminiClient();
  const maxSuggestions = Math.max(1, Math.min(input.maxSuggestions || 5, 5));

  const prompt = `Actua como analista QA senior.
Necesito sugerencias cortas de funcionalidades adicionales para una ejecucion de pruebas.

Contexto actual:
- Tipo de prueba: ${input.testType}
- Modulos seleccionados: ${input.selectedModules.join(', ') || 'Ninguno'}
- Funcionalidades ya seleccionadas:
${JSON.stringify(input.selectedFunctionalities, null, 2)}

Candidatas posibles:
${JSON.stringify(input.candidateFunctionalities, null, 2)}

Reglas:
- Devuelve maximo ${maxSuggestions} sugerencias.
- Usa solo functionalityId presentes en "Candidatas posibles".
- Prioriza impacto por: mismo modulo, cambio reciente, core, riesgo alto, prioridad alta, y afinidad con el tipo de prueba.
- El motivo debe ser breve, concreto y en espanol.
- Si no hay candidatas suficientemente relevantes, devuelve un array vacio.

Responde unicamente con JSON valido usando este formato:
[
  {
    "functionalityId": "ID",
    "reason": "Motivo corto"
  }
]`;

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
              functionalityId: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['functionalityId', 'reason'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No se recibió respuesta de la IA');
    }

    return JSON.parse(text) as ExecutionRecommendation[];
  } catch (error) {
    console.error('Error recommending execution functionalities:', error);
    normalizeGeminiError(error);
  }
}
