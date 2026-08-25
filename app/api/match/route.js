import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildMatchingPrompt } from "@/lib/prompts";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fields, profile } = body;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'fields' array in request body." },
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

    const prompt = buildMatchingPrompt(fields, profile);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let matchData;
    try {
      matchData = JSON.parse(responseText);
    } catch (err) {
      // Strip markdown code fences and retry once
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        matchData = JSON.parse(cleanedText);
      } catch (retryErr) {
        console.error("Failed to parse Gemini output as JSON:", cleanedText);
        return NextResponse.json(
          { error: "Failed to parse matching data from AI response." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(matchData);
  } catch (error) {
    console.error("Error in /api/match:", error);
    return NextResponse.json(
      { error: "Internal server error during matching process." },
      { status: 500 }
    );
  }
}
