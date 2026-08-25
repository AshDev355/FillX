import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildGenerationPrompt } from "@/lib/prompts";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { question, keywords, profile } = body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return NextResponse.json(
        { error: "Missing or invalid 'question' string in request body." },
        { status: 400 }
      );
    }

    if (!keywords || typeof keywords !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'keywords' string in request body." },
        { status: 400 }
      );
    }

    if (!profile || typeof profile !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'profile' object in request body." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        { error: "Server configuration error: GEMINI_API_KEY is not set correctly." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = buildGenerationPrompt(question, keywords, profile);
    const result = await model.generateContent(prompt);
    
    // Clean up any extra whitespace from the response
    const answer = result.response.text().trim();

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error in /api/generate:", error);
    return NextResponse.json(
      { error: "Internal server error during generation process." },
      { status: 500 }
    );
  }
}
