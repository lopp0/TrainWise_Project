import axios from "axios";

const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export const getGPTResponse = async (messages) => {
  if (!apiKey) {
    console.error(
      "[openai.js] EXPO_PUBLIC_OPENAI_API_KEY is not set. Check your .env file.",
    );
    return "API key not configured. Please check your .env file.";
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    const detail = error?.response?.data?.error?.message || error?.message || "Unknown error";
    const status = error?.response?.status;
    console.error("[openai.js] OpenAI request failed:", status, detail);
    return `Error ${status ? `(${status})` : ""}: ${detail}`;
  }
};
