import express from 'express';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const PORT = process.env.PORT || 3000;

  // Server-side Gemini API endpoint
  app.post('/api/generate-algorithm', async (req, res) => {
    try {
      const { prompt, apiKey } = req.body;
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;

      if (!keyToUse) {
        return res.status(400).json({ error: 'GEMINI_API_KEY não configurada no servidor ou fornecida.' });
      }

      const ai = new GoogleGenAI({ apiKey: keyToUse });

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          algoritmo_pratico: {
            type: Type.STRING,
            description: "Passos diretos e telegráficos no formato '1. [Ferramenta/Menu] -> [Ação exata]'."
          },
          delta_resumo: {
            type: Type.STRING,
            description: "Apenas o conhecimento novo descoberto neste turno."
          }
        },
        required: ["algoritmo_pratico", "delta_resumo"]
      };

      let response: any;
      let retries = 3;
      let delay = 2000;

      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: responseSchema,
              temperature: 0.2,
            }
          });
          break;
        } catch (apiErr: any) {
          const errStr = JSON.stringify(apiErr);
          if (apiErr?.status === 429 || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota')) {
            retries--;
            if (retries === 0) {
              throw new Error('Limite de cota excedido (Rate Limit 429). Por favor, aguarde alguns segundos e tente novamente.');
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
          } else {
            throw apiErr;
          }
        }
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Resposta vazia da IA.');
      }

      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (error: any) {
      console.error('Erro no servidor /api/generate-algorithm:', error);
      res.status(500).json({ error: error.message || 'Erro interno ao gerar algoritmo.' });
    }
  });

  // Serve static production build directly to eliminate Vite dev client WebSocket injection
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
