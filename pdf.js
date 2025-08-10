import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { exec } from 'child_process';
import { writeFileSync } from 'fs';

dotenv.config();

const pdfPath = 'SPC Contract_Rate-2025-2026-R1.pdf';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = "gemini-1.5-pro-latest";
const MAX_OUTPUT_TOKENS = 65536;

export async function exportPdf(items) {
  //const validRoutes = new Set(items.map(item => `${item.from.trim()}|${item.to.trim()}`));

  return exec(`pdftotext -layout "${pdfPath}" -`, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error converting PDF: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`pdftotext stderr: ${stderr}`);
      return;
    }

    let lastNumber = 0;
    const extractedLines = [];
    for await (const line of stdout.split("\n")) {
      const match = line.match(/^(\d+)/);

      if (match) {
        const currentNumber = parseInt(match[1], 10);
        if (currentNumber > lastNumber) {
          extractedLines.push(line);
          lastNumber = currentNumber;
        }
        else if (currentNumber === 1) {
          extractedLines.push(line);
          lastNumber = 1;
        }
      }
    }

    try {
      const prompt = `
        You are a text-to-JSON extraction assistant.
        Extract ALL data from the raw text provided below and convert it into a JSON array of objects.
        Do not skip any records. Your goal is to produce exactly 200 items in the JSON array.

        For each row, create a JSON object with the following fields:
        - "contractId": string
        - "from": string
        - "to": string
        - "schedule": string (e.g., "12:00-14:00")
        - "adultSellingPrice": number
        - "childSellingPrice": number
        - "adultNetPrice": number
        - "childNetPrice": number
        - "notes": string
        - "availability": string

        The data records will have a number at the beginning of each line, followed by the fields mentioned above.

        Raw Text to Parse:

        ${extractedLines.join("\n")}
        `;
      const result = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                contractId: { type: "string" },
                from: { type: "string" },
                to: { type: "string" },
                schedule: { type: "string" },
                adultSellingPrice: { type: "number" },
                childSellingPrice: { type: "number" },
                adultNetPrice: { type: "number" },
                childNetPrice: { type: "number" },
                notes: { type: "string" },
                availability: { type: "string" },
              },
              required: ["contractId", "from", "to", "schedule", "adultSellingPrice", "childSellingPrice", "adultNetPrice", "childNetPrice", "notes", "availability"],
            },
          },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let fullResponse = "";

      for await (const chunk of result) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      const jsonObject = JSON.parse(fullResponse);
      console.log(jsonObject.length);
    } catch (error) {
      console.error("Error calling Gemini API:", error);
    }
  });
}

function addTwoSpacesBeforeKoh(text) {
  return text.replace(/\s+(?=Koh)/, '  ');
}

function replaceLanta(text) {
  if (!text.includes('Koh Lanta')) {
    return text.replace(/\bLanta\b/g, 'Koh Lanta');
  }

  return text;
}

function fixScheduleSpacing(scheduleString) {
  return scheduleString.replace(/(\d{2}:\d{2})\s(\d{2}:\d{2})/, '$1   $2');
}
function addSpacesAfterSchedule(scheduleString) {
  return scheduleString.replace(/(\d{2}:\d{2})$/, '$1  ');
}


exportPdf();