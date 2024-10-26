import { createMistral } from '@ai-sdk/mistral';
import { streamText, convertToCoreMessages } from 'ai';
import { env } from '$env/dynamic/private';
import { GoogleGenerativeAI } from "@google/generative-ai";

const mistral = createMistral({
	apiKey: env.MISTRAL_API_KEY ?? ''
});


export class Evaluator {
  static criteria = {
    context: 1,
    completeness: 1,
    conciseness: 1
  };

  static system = `You are an expert judge evaluating AI Assistants unsupervised answers. 
  Your task is to evaluate a given answer based on the context and topic of personal finance and questions using the criteria provided below.
  Limit responses to Output format in JSON format
  `;

  static evaluationCriteria = `
  - Add one point if the tone of the AI's response is appropriate given the user's question.
  - Add one point if the AI's response is related to the human's question.
  - Add one point if the AI's response provides a complete solution without requiring further interaction
  - Add one point if the response does not contradict previous answers.
  - Add one point if the response accurately identifies the problem raised by the problem raised by the customer
  `;

  static evaluationSteps = `
  1. Read provided context, question, and answer carefully.
  2. Go through each evaluation criterion one by one and assess whether the answer meets the criteria.
  3. Compose your reasoning for each criterion, explaining why you did or did not award a point.
  4. Calculate the total score by summing the points awarded
  5. Format your evaluation response according to the specified JSON schema.
  `;

  static jsonSchema = `
  {
    reasoning: "Your step-by-step explanation for the Evaluation Criteria, why you awarded a point or not.",
    total_score: "sum of criteria scores"
  }
  `;


  static async evaluate(context: string, question: string, answer: string) {
    const result = await streamText({
      model: mistral('ministral-3b-2410'),
      system: `${Evaluator.system} \n 
      Evaluations Criteria (Additive Score, 0-5): ${Evaluator.evaluationCriteria}
      Evaluations Steps: ${Evaluator.evaluationSteps}
      Output format: ${Evaluator.jsonSchema}
      Context: ${context}
      Question: ${question}
      Answer: ${answer}
      ` ,
      messages: convertToCoreMessages([{"role": "user", content: question},{"role": "assistant", content: answer}])
    });

    // Cambiar la forma en que se maneja la respuesta
    const respuesta = result.toDataStreamResponse();
    // Usar el método adecuado para iterar sobre el resultado
    const textParts = await result.toDataStream(); // Convertir el resultado a un ReadableStream
    const reader = textParts.getReader(); // Obtener un lector del ReadableStream
    let done, value;

    // Leer el stream de datos
    while ({ done, value } = await reader.read(), !done) {
      //console.log(new TextDecoder().decode(value)); // Decodificar y mostrar el texto
    }

    return respuesta;
  }

  static async evaluateGoogle(context: string, question: string, answer: string) {

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: env.GOOGLE_MODEL! });

    const prompt = `${Evaluator.system} \n 
      Evaluations Criteria (Additive Score, 0-5): ${Evaluator.evaluationCriteria}
      Evaluations Steps: ${Evaluator.evaluationSteps}
      Output format: ${Evaluator.jsonSchema}
      Context: ${context}
      Question: ${question}
      Answer: ${answer}
      `;

    const result = await model.generateContent([prompt]);
    //console.log(result.response.text());

    return result.response.text();
  }
}
