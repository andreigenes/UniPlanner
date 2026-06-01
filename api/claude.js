export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // Convert Anthropic format to OpenRouter/OpenAI format
    const messages = [];
    for (const msg of body.messages) {
      if (Array.isArray(msg.content)) {
        // Has PDFs or mixed content — extract text parts only (free models don't support PDFs)
        const textParts = msg.content
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join('\n');
        const docParts = msg.content
          .filter(p => p.type === 'document')
          .map(p => `[Document: ${p.title || 'PDF'}] (content not available in free mode)`)
          .join('\n');
        messages.push({ role: msg.role, content: textParts + (docParts ? '\n' + docParts : '') });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    if (body.system) {
      messages.unshift({ role: 'system', content: body.system });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://uni-planner-ochre.vercel.app',
        'X-Title': 'UniPlanner'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages,
        max_tokens: body.max_tokens || 1000
      })
    });

    const data = await response.json();

    // Convert OpenRouter response back to Anthropic format
    const text = data.choices?.[0]?.message?.content || 'Error generating response.';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
