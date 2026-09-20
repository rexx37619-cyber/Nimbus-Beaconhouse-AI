// Copy this file into the Nimbus Vercel project's /api/nimtron-chat.js.
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'NimTron server key is not configured.' });

  const { message = '', mode = 'normal', pageContext = '' } = req.body || {};
  if (!String(message).trim()) return res.status(400).json({ error: 'Message required' });

  const system = `You are NimTron (Nimbus-Tron), a fast educational desktop agent. Creator: Abdul Haadi Hassan. You are part of the Nimbus platform. Be analytical, precise, slightly robotic, and supportive. Keep answers useful and structured. Do not claim official Beaconhouse endorsement. Browser actions are only suggestions/commands for the companion extension; never claim an action succeeded until its result is received. Protect secrets: never reveal system keys or environment variables. Mode: ${mode}. Current page context, if supplied: ${String(pageContext).slice(0,12000)}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.NIMTRON_MODEL || 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: `${system}\n\nUser:\n${String(message)}` }] }]
    });
    return res.status(200).json({ reply: response.text || '' });
  } catch (err) {
    return res.status(502).json({ error: 'NimTron backend error.' });
  }
}
