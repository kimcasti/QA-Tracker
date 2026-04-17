import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GROQ_MODEL = 'llama-3.1-8b-instant';

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

type ProjectInsightInput = {
  name: string;
  description?: string;
  purpose?: string;
  coreRequirements?: string[];
  businessRules?: string;
};

function getEnvValue(value: unknown) {
  return String(value || '').trim();
}

export const getGeminiApiKey = () =>
  getEnvValue(import.meta.env.VITE_GEMINI_API_KEY) || getEnvValue(process.env.GEMINI_API_KEY);

export const getGroqApiKey = () =>
  getEnvValue(import.meta.env.VITE_GROQ_API_KEY) || getEnvValue(process.env.GROQ_API_KEY);

export const hasAiProviderConfigured = () => Boolean(getGeminiApiKey() || getGroqApiKey());

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

function shouldFallbackToGroq(error: unknown) {
  const raw: any = (error as any)?.error ?? error;
  const status = raw?.status;
  const code = raw?.code;
  const message = (raw?.message || raw?.error?.message || (error as any)?.message || '')
    .toString()
    .toLowerCase();

  return (
    code === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    message.includes('quota exceeded') ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('api key not valid') ||
    message.includes('reported as leaked')
  );
}

function extractJsonPayload<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const firstObject = candidate.indexOf('{');
    const firstArray = candidate.indexOf('[');
    const jsonStart =
      firstObject === -1
        ? firstArray
        : firstArray === -1
          ? firstObject
          : Math.min(firstObject, firstArray);

    const lastObject = candidate.lastIndexOf('}');
    const lastArray = candidate.lastIndexOf(']');
    const jsonEnd = Math.max(lastObject, lastArray);

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(candidate.slice(jsonStart, jsonEnd + 1)) as T;
    }

    throw new Error('AI_PROVIDER_INVALID_JSON');
  }
}

async function requestGroqCompletion(prompt: string) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY_MISSING');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente de QA. Responde exactamente en el formato solicitado y no agregues texto fuera de ese formato.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorMessage =
      errorPayload?.error?.message || `Groq request failed with status ${response.status}`;
    const error = new Error(errorMessage) as Error & { code?: number; error?: unknown };
    error.code = response.status;
    error.error = errorPayload?.error || errorPayload;
    throw error;
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('No se recibió respuesta de Groq');
  }

  return text;
}

async function withAiFallback<T>(
  geminiRequest: () => Promise<T>,
  groqRequest: () => Promise<T>,
) {
  const hasGemini = Boolean(getGeminiApiKey());
  const hasGroq = Boolean(getGroqApiKey());

  if (!hasGemini && !hasGroq) {
    throw new Error('AI_PROVIDER_MISSING');
  }

  if (hasGemini) {
    try {
      return await geminiRequest();
    } catch (error) {
      if (hasGroq && shouldFallbackToGroq(error)) {
        console.warn('Gemini no disponible, usando fallback Groq.', error);
        return groqRequest();
      }

      normalizeGeminiError(error);
      throw error;
    }
  }

  return groqRequest();
}

function buildProjectContext(input: ProjectInsightInput) {
  return `Proyecto: ${input.name}
Descripcion general: ${input.description || 'No definida'}
Objetivo del proyecto:
${input.purpose || 'No definido'}

Requisitos basicos:
${(input.coreRequirements || []).join('\n') || 'No definidos'}

Normas empresariales:
${input.businessRules || 'No definidas'}`;
}

export async function generateTestCasesWithAI(functionalityName: string, moduleName: string) {
  const prompt = `Genera 3 casos de prueba detallados para la funcionalidad "${functionalityName}" del módulo "${moduleName}".
Devuelve un array de objetos JSON con la siguiente estructura:
[
  {
    "title": "Título del caso",
    "description": "Descripción breve",
    "preconditions": "Precondiciones",
    "testSteps": "1. Paso 1\\n2. Paso 2...",
    "expectedResult": "Resultado esperado",
    "testType": "Funcional",
    "priority": "Medio"
  }
]
Asegúrate de que los tipos de prueba sean uno de: Integración, Funcional, Sanity, Regresión, Smoke, Exploratoria, UAT.
Asegúrate de que la prioridad sea uno de: Crítico, Alto, Medio, Bajo.`;

  try {
    return await withAiFallback(
      async () => {
        const ai = createGeminiClient();
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
      },
      async () => {
        const groqPrompt = `${prompt}

Responde únicamente con JSON válido. No uses Markdown ni texto adicional.`;
        return extractJsonPayload(await requestGroqCompletion(groqPrompt));
      },
    );
  } catch (error) {
    console.error('Error generating test cases:', error);
    throw error;
  }
}

export async function improveMeetingNotesWithAI(notes: string) {
  const prompt = `Reorganiza las siguientes notas de reunión en un formato estructurado con las siguientes secciones:
1. Resumen de la reunión
2. Decisiones
3. Acciones a realizar
4. Próximos pasos

Notas:
${notes}

Responde únicamente con un objeto JSON que tenga las llaves: summary, decisions, actions, nextSteps.`;

  try {
    return await withAiFallback(
      async () => {
        const ai = createGeminiClient();
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
      },
      async () => {
        const result = extractJsonPayload<{
          summary?: string;
          decisions?: string;
          actions?: string;
          nextSteps?: string;
        }>(
          await requestGroqCompletion(`${prompt}\n\nResponde únicamente con JSON válido.`),
        );

        return {
          summary: result?.summary || '',
          decisions: result?.decisions || '',
          actions: result?.actions || '',
          nextSteps: result?.nextSteps || '',
        };
      },
    );
  } catch (error) {
    console.error('Error improving meeting notes:', error);
    throw error;
  }
}

export async function recommendExecutionFunctionalitiesWithAI(input: {
  testType: string;
  selectedModules: string[];
  selectedFunctionalities: ExecutionRecommendationCandidate[];
  candidateFunctionalities: ExecutionRecommendationCandidate[];
  maxSuggestions?: number;
}) {
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
    return await withAiFallback(
      async () => {
        const ai = createGeminiClient();
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
      },
      async () =>
        extractJsonPayload<ExecutionRecommendation[]>(
          await requestGroqCompletion(`${prompt}\n\nResponde únicamente con JSON válido.`),
        ),
    );
  } catch (error) {
    console.error('Error recommending execution functionalities:', error);
    throw error;
  }
}

export async function analyzeProjectWithAI(input: ProjectInsightInput) {
  const prompt = `Actua como consultor senior de gestion de proyectos y QA.
Analiza la siguiente informacion del proyecto y devuelve recomendaciones utiles en espanol.

${buildProjectContext(input)}

Necesito una respuesta en Markdown con estas secciones exactas:
## Resumen ejecutivo
## Desafios probables
## Riesgos y dependencias
## Vacios de definicion
## Recomendaciones de gestion
## Sugerencias QA
## Preguntas para validar con el cliente

Reglas:
- Se concreto y accionable.
- Enfatiza hallazgos que ayuden a planificar, priorizar y alinear al equipo.
- No inventes integraciones tecnicas no mencionadas.
- Si falta informacion, dilo como supuesto o pregunta abierta.

Responde solo con Markdown.`;

  try {
    return await withAiFallback(
      async () => {
        const ai = createGeminiClient();
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
        });

        const text = response.text;
        if (!text) {
          throw new Error('No se recibio respuesta de la IA');
        }

        return text.trim();
      },
      async () => requestGroqCompletion(prompt),
    );
  } catch (error) {
    console.error('Error analyzing project with AI:', error);
    throw error;
  }
}

export async function generateProjectWireframeBrief(input: ProjectInsightInput) {
  const coreRequirements = (input.coreRequirements || []).join('\n') || 'No definidos';
  const businessRules = input.businessRules || 'No definidas';
  const description = input.description || 'No definida';
  const purpose = input.purpose || 'No definido';

  const prompt = `Act as a senior product designer and UX strategist.
Using the real project information below, generate a reusable wireframe brief in Markdown.
The result must keep a structure similar to a multi-screen low-fidelity wireframe request, but it must adapt to the actual project context instead of forcing generic screens.

Project context:
- Project name: ${input.name}
- General description: ${description}
- Project goal: ${purpose}
- Core requirements:
${coreRequirements}
- Business rules:
${businessRules}

Return the answer in Spanish, but keep the final block "Wireframe prompt listo para pegar" written in English so it can be pasted directly into Stitch or a similar wireframing tool.

Necesito una respuesta en Markdown con estas secciones exactas:
## Objetivo del wireframe
## Usuarios principales
## Escenas principales sugeridas
## Contenido clave por escena
## Componentes sugeridos
## Flujo recomendado entre escenas
## Consideraciones de negocio
## Wireframe prompt listo para pegar

Reglas:
- Propone entre 4 y 7 escenas principales.
- Las escenas deben ser sencillas, editables y pensadas para una primera version.
- No fuerces modulos que no tengan relacion con el proyecto.
- Deduce las pantallas mas relevantes segun descripcion, objetivo, requisitos y normas empresariales.
- Prioriza estructura, layout, jerarquia de informacion y flujo de usuario.
- Evita sobrecargar cada escena con demasiados widgets, KPIs o formularios.
- En "Escenas principales sugeridas" incluye para cada escena: nombre, objetivo y acciones principales.
- En "Contenido clave por escena" indica los bloques o datos que deberia tener cada pantalla.
- En "Flujo recomendado entre escenas" explica como se conectan las pantallas principales.
- Si falta contexto, completa con supuestos razonables, pero sin inventar integraciones muy especificas.

Reglas especificas para "Wireframe prompt listo para pegar":
- Debe parecerse estructuralmente a un prompt de multi-screen low-fidelity wireframe set.
- Debe pedir varias escenas principales sencillas, no una sola pantalla compleja.
- Debe mencionar explicitamente el nombre real del proyecto.
- Debe incorporar el contexto del proyecto y adaptar las pantallas al dominio detectado.
- Debe pedir low-fidelity wireframes, grayscale, sketch-style or rough SaaS wireframe.
- Debe pedir simple boxes, placeholders, labels y una composicion clara.
- Debe indicar que solo incluya las opciones mas relevantes para luego seguir editando.
- Debe cerrar con un goal similar a: continue refining the product structure and make UI adjustments later.

Responde solo con Markdown.`;

  try {
    return await withAiFallback(
      async () => {
        const ai = createGeminiClient();
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
        });

        const text = response.text;
        if (!text) {
          throw new Error('No se recibio respuesta de la IA');
        }

        return text.trim();
      },
      async () => requestGroqCompletion(prompt),
    );
  } catch (error) {
    console.error('Error generating wireframe brief with AI:', error);
    throw error;
  }
}
