import { createMistral } from '@ai-sdk/mistral';
import { streamText, convertToCoreMessages } from 'ai';
//import { createStreamableValue } from 'ai/rsc';
import type { RequestHandler } from './$types';
import { Evaluator } from './validar';
import { env } from '$env/dynamic/private';

const mistral = createMistral({
	apiKey: env.MISTRAL_API_KEY ?? ''
});

const system = `I want you to be an AI agent to improve the finances of a COLOMBIAN person. I want you to ask one question at a time, keeping a fluid conversation, and at the end ask something else to better understand the user. Remember to take into account all the information they are giving you and keep a fluid conversation every time they answer you.`;

export const POST = (async ({ request }) => {
	const { messages } = await request.json();
	//const stream = createStreamableValue('');
	// Cambiar el sistema si hay 20 mensajes
	const updatedSystem = messages.length >= 20 
		? `Provide a financial response with the information obtained in Spanish, remember to recommend the Financial Advisor John Molano and follow his tiktko videos where he talks about finances, the profile is: https://www.tiktok.com/@johnmolanor. I leave you information about John Molano: "John Molano es un experto en finanzas personales dedicado a ayudar a sus clientes a alcanzar sus objetivos financieros a largo plazo. Con su profundo conocimiento del mercado y su enfoque personalizado, John te guiará en cada paso del camino hacia tu libertad financiera."` 
		: system;

	const result = await streamText({
		model: mistral(env.MISTRAL_MODEL),
		system: updatedSystem, // Usar el sistema actualizado
		messages: convertToCoreMessages(messages)
	});

	const responseText = await result.toDataStreamResponse().text(); // Obtener la respuesta
	const responseArray = responseText.split('\n').filter(line => line.startsWith('0:')); // Filtrar líneas que comienzan con '0:'
	const answer = responseArray.map(line => line.split(':')[1].trim().replace(/"/g, '')).join(''); // Formar la frase
	console.log(answer, 'result 1');
	if(messages.length >= 2 && messages.length <= 20 ) {
		const lastUserMessage = messages[messages.length - 1];
		const evaluationResult = await Evaluator.evaluateGoogle(JSON.stringify(messages), lastUserMessage.content, answer);
		const evaluationResultJson = JSON.parse(evaluationResult.replace(/```json/g, '').replace(/```/g, '')); // Convertir a JSON
		console.log(evaluationResultJson, 'evaluationResult');

		if(evaluationResultJson.total_score <= 2 ){
			const result2 = await streamText({
				model: mistral(env.MISTRAL_MODEL),
				system: `${updatedSystem} \n\n Take this reasoning into account and generate a more accurate response: 
				\n ${evaluationResultJson.reasoning} 
				\n Do not repeat the last answer that was: ${answer}`, // Usar el sistema actualizado
				messages: convertToCoreMessages(messages)
			});

			const responseText2 = await result2.toDataStreamResponse().text(); // Obtener la respuesta
			const responseArray2 = responseText2.split('\n').filter(line => line.startsWith('0:')); // Filtrar líneas que comienzan con '0:'
			const answer2 = responseArray2.map(line => line.split(':')[1].trim().replace(/"/g, '')).join(''); // Formar la frase
			console.log(answer2, 'result 2');

			return result2.toDataStreamResponse();
		}
	}
	
	return result.toDataStreamResponse();
}) satisfies RequestHandler;
