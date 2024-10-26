// https://developers.codegpt.co/reference/completion-beta

import { env } from '$env/dynamic/private';
import { convertToCoreMessages } from 'ai';
import type { RequestHandler } from './$types';

export const POST = (async ({ request }) => {
	const { messages } = await request.json();

	async function* streamReader(response: Response) {
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Response body is not readable');

		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			yield JSON.stringify(chunk);
		}
	}

	function createSSEStream(response: Response) {
		const encoder = new TextEncoder();

		return new ReadableStream({
			async start(controller) {
				for await (const message of streamReader(response)) {
					//console.log(message);
					controller.enqueue(encoder.encode(`0:${message}\n`));
				}
				controller.close();
			}
		});
	}

	const response = await fetch('https://api.codegpt.co/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.CODEGPT_API_KEY}`
		},
		body: JSON.stringify({
			agentId: `${env.CODEGPT_AGENT_ID}`,
			messages: convertToCoreMessages(messages),
			format: 'text',
			stream: true
		})
	});

	if (!response.ok) {
		return new Response(response.statusText, {
			status: response.status
		});
	}

	const stream = createSSEStream(response);

	console.log(response.body);

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}) satisfies RequestHandler;
