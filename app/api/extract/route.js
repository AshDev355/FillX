import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildExtractionPrompt } from "@/lib/prompts";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { documentText } = body;

    if (!documentText || typeof documentText !== "string" || documentText.trim() === "") {
      return NextResponse.json(
        { error: "Missing or empty 'documentText' in request body." },
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

    const prompt = buildExtractionPrompt(documentText);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let profileData;
    try {
      profileData = JSON.parse(responseText);
    } catch (err) {
      // Strip markdown code fences and retry once
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        profileData = JSON.parse(cleanedText);
      } catch (retryErr) {
        console.error("Failed to parse Gemini output as JSON:", cleanedText);
        return NextResponse.json(
          { error: "Failed to parse data from AI response." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ profile: profileData });
  } catch (error) {
    console.error("Error in /api/extract:", error);
    return NextResponse.json(
      { error: "Internal server error during extraction process." },
      { status: 500 }
    );
  }
}
