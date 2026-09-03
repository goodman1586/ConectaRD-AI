import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 10000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/health", (req, res) => res.json({ ok: true, service: "ConectaRD AI", version: "7.1" }));

app.post("/api/ai", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "Falta el mensaje." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY no configurada en Render." });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions: "Eres el asistente de ConectaRD AI, una plataforma dominicana de delivery. Ayuda al cliente a elegir productos, entender precios y preparar su pedido. Sé breve, amable y claro. No inventes productos ni precios.",
      input: message
    });
    res.json({ reply: response.output_text || "No pude generar una respuesta." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al conectar con la IA." });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`ConectaRD AI 7.1 running on port ${PORT}`));
