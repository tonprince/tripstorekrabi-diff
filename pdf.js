import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { exec } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { promisify } from 'util';

const execPromise = promisify(exec);
dotenv.config();

const pdfPath = 'SPC Contract_Rate-2025-2026-R1.pdf';
const outputJsonPath = `output/${pdfPath.replace(".pdf", ".json")}`;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = "gemini-1.5-pro-latest";
const MAX_OUTPUT_TOKENS = 65536;

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function exportPdf(items = []) {
  try {
    const validRoutes = new Set(items.map(item => `${item.from.trim()}|${item.to.trim()}`));
    const { stdout } = await execPromise(`pdftotext -layout "${pdfPath}" -`);

    let lastNumber = 0;
    let allExtractedItems = []

    if (existsSync(outputJsonPath)) {
      console.log(`JSON file '${outputJsonPath}' found. Using existing data to save processing time.`);
      const fileData = readFileSync(outputJsonPath, 'utf8');
      allExtractedItems = JSON.parse(fileData);
    } else {
      const extractedLines = [];
      for (const line of stdout.split("\n")) {
        const match = line.match(/^(\d+)/);
        if (match) {
          const currentNumber = parseInt(match[1], 10);
          if (currentNumber > lastNumber || currentNumber === 1) {
            extractedLines.push(line);
            lastNumber = currentNumber;
          }
        }
      }

      const chunks = chunkArray(extractedLines, 20);
      for (const chunk of chunks) {
        const prompt = `
        You are a text-to-JSON extraction assistant.
        Extract ALL data from the text below and convert it into a JSON array of objects.
        Do not skip any records.

        For each row, create a JSON object with the following fields:
        - "contractId": string
        - "from": string
        - "to": string
        - "schedule": string in 24 hour format (e.g., "12:00 - 14:00")
        - "adultSellingPrice": number
        - "childSellingPrice": number
        - "adultNetPrice": number
        - "childNetPrice": number
        - "notes": string
        - "availability": string

        The data records will have a number at the beginning of each line, followed by the fields mentioned above.

        Raw Text to Parse:
        
        ${chunk.join("\n")}
      `;

        try {
          const result = await ai.models.generateContent({
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

          const jsonObject = await result.text;
          const parsedArray = JSON.parse(jsonObject ?? "[]");
          allExtractedItems.push(...parsedArray);
          writeFileSync(outputJsonPath, JSON.stringify(allExtractedItems, null, 2));
        } catch (error) {
          console.error("Error calling Gemini API for a chunk:", error);
        }
      }
    }

    allExtractedItems.forEach((item) => {
      item.from = normailizeFromTo(item.from);
      item.to = normailizeFromTo(item.to);
      item.schedule = normailizeSchedule(item.schedule);
    });

    allExtractedItems = allExtractedItems.filter((item) => item.notes !== "No Service");
    allExtractedItems = allExtractedItems.filter((item) => validRoutes.has(`${item.from}|${item.to}`));

    allExtractedItems.sort((a, b) => {
      const fromComparison = a.from.localeCompare(b.from);
      if (fromComparison !== 0) {
        return fromComparison;
      }

      const toComparison = a.to.localeCompare(b.to);
      if (toComparison !== 0) {
        return toComparison;
      }

      return a.schedule.localeCompare(b.schedule);
    });

    let outputRows = allExtractedItems.map(row => `${row.from}, ${row.to}, ${row.schedule}, ${row.adultSellingPrice}, ${row.childSellingPrice}, ${row.adultNetPrice}, ${row.childNetPrice}`);

    writeFileSync(
      `output/${pdfPath.replace(".pdf", ".csv")}`,
      outputRows.join('\n')
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

function normailizeFromTo(text) {
  return text.replaceAll("koh", "Koh").
    replaceAll("Buloan", "Bulone").
    replaceAll("Railay", "Railay Beach").
    replaceAll("Pakbara pier", "Pakbara Pier").
    replaceAll("Phiphi", "Phi Phi").
    replaceAll("PhiPhi", "Phi Phi").
    replaceAll(/(?<!Koh )Lanta/g, "Koh Lanta").
    replaceAll("Koh Langkawi", "Langkawi").
    replaceAll("(Telaga )", "").
    replaceAll("Ao-nang", "Ao Nang").
    replaceAll("Hatyai", "Hat Yai").trim()
}

function normailizeSchedule(schedule) {
  return schedule
    .replaceAll(" - ", "#TEMP#") // Temporarily protect " - "
    .replaceAll(/\s\s+/g, " ") // Replace multiple spaces with a single space
    .replaceAll(" ", " - ") // Replace single spaces with " - "
    .replaceAll("#TEMP#", " - ") // Restore " - "
    .replaceAll("(THT)", "")
    .replaceAll("(MYT)", "").trim()
}