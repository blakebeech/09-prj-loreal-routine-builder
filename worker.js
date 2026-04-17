/*
  Cloudflare Worker for L'Oreal Routine Builder
  ---------------------------------------------
  This worker handles two request types:
  1) type: "routine" - creates a beauty routine from selected products
  2) type: "chat" - answers follow-up questions using chat history

  It uses OPENAI_API_KEY from Worker environment variables.
*/

/* CORS headers so the browser app can call this Worker */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* Helper to return JSON responses with CORS */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    /* Handle browser preflight requests */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    /* Only allow POST */
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      /* Read the incoming JSON body */
      const body = await request.json();
      const { type } = body;

      /* Build messages for OpenAI based on request type */
      let openaiMessages = [];

      if (type === "routine") {
        const selectedProducts = Array.isArray(body.selectedProducts)
          ? body.selectedProducts
          : [];

        if (selectedProducts.length === 0) {
          return jsonResponse({ error: "No selected products provided" }, 400);
        }

        openaiMessages = [
          {
            role: "system",
            content:
              "You are a beauty advisor. Build a routine using only the provided selected products. Organize the routine into two sections: Morning and Night. For each step, include the product name and a short, simple explanation of why it is used. Do not add products that are not in the selected list.",
          },
          {
            role: "user",
            content: `Create a clear morning and night routine using only these selected products: ${JSON.stringify(selectedProducts)}`,
          },
        ];
      } else if (type === "chat") {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const selectedProducts = Array.isArray(body.selectedProducts)
          ? body.selectedProducts
          : [];

        if (messages.length === 0) {
          return jsonResponse({ error: "No chat messages provided" }, 400);
        }

        /* Keep guidance focused on beauty and the selected routine context */
        const beautySystemMessage = {
          role: "system",
          content:
            "You are a beauty advisor. Only answer beauty-related questions (skincare, haircare, makeup, fragrance, or the generated routine). Use the conversation history for context. Keep responses concise and helpful. If a question is unrelated, politely redirect the user back to beauty topics.",
        };

        openaiMessages = [
          beautySystemMessage,
          {
            role: "system",
            content: `Selected products context: ${JSON.stringify(selectedProducts)}`,
          },
          ...messages,
        ];
      } else {
        return jsonResponse(
          { error: "Invalid type. Use 'routine' or 'chat'." },
          400,
        );
      }

      /* Call OpenAI Chat Completions API using fetch */
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: openaiMessages,
            temperature: 0.7,
          }),
        },
      );

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        return jsonResponse(
          { error: "OpenAI request failed", details: errorText },
          500,
        );
      }

      const data = await openaiResponse.json();
      const reply =
        data.choices?.[0]?.message?.content || "No reply generated.";

      /* Return reply in the required format */
      return jsonResponse({ reply });
    } catch (error) {
      /* Basic error handling for bad JSON or unexpected errors */
      return jsonResponse(
        {
          error: "Server error",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
};
