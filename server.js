import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "7.2"
  })
);

app.get("/", (req, res) =>
  res.sendFile(process.cwd() + "/index.html")
);

app.post("/api/ai", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Falta el mensaje." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY no configurada en Render."
      });
    }

    const response = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey},
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "Eres el asistente de ConectaRD AI, una plataforma dominicana de delivery. Ayuda al cliente a elegir productos, entender precios y preparar su pedido. Sé breve, amable y claro. No inventes productos ni precios."
              }
            ]
          },
          contents: [
            {
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(500).json({
        error: "Error al conectar con Gemini."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude generar una respuesta.";

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al conectar con la IA."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(ConectaRD AI 7.2 running on port ${PORT});
});
      https://generativelanguage.googleapis.com/v1beta/models/gemini-3-
