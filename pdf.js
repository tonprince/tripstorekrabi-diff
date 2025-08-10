import { exec } from 'child_process';
import fs from 'fs';

const pdfPath = 'SPC Contract_Rate-2025-2026-R1.pdf';

export async function exportPdf() {
  return exec(`pdftotext -layout "${pdfPath}" -`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error converting PDF: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`pdftotext stderr: ${stderr}`);
      return;
    }

    const textWithSpaces = stdout;
    let parsedData = [];

    textWithSpaces.split('\n').forEach(line => {
      line = addTwoSpacesBeforeKoh(line);
      line = replaceLanta(line);
      line = line.replaceAll("koh", "Koh").
        replaceAll("Buloan", "Bulone").
        replaceAll("Railay", "Railay Beach").
        replaceAll("Pakbara pier ", "Pakbara Pier").
        replaceAll("PhiPhi", "Phi Phi");

      const lineRegex = /^\s*(\d+)\s+(\d+)\s+([\w\s]+?)\s{2,}([\w\s]+?)\s{2,}(\d{2}:\d{2})\s{2,}(\d{2}:\d{2})\s{2,}([\d,\s]+)\s{2,}([A-Za-z]+)\s{2,}(.*)/;
      const match = line.match(lineRegex);

      if (match) {
        const prices = match[7]
          .trim()
          .split(/\s+/)
          .map(price => parseInt(price.replace(/,/g, ''), 10));

        parsedData.push({
          id: match[1],
          number: match[2],
          from: match[3].trim(),
          to: match[4].trim(),
          schedule: `${match[5]} - ${match[6]}`,
          adultSellingPrice: prices[0],
          childSellingPrice: prices[1],
          adultNetPrice: prices[2],
          childNetPrice: prices[3],
          vehicle: match[8].trim(),
          notes: match[9].trim()
        });
      } else {
        return null;
      }
    });

    parsedData.sort((a, b) => {
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

    parsedData = parsedData.filter((item) => item.notes !== "No Service");

    const csvRows = parsedData.map(row => {
      const rowValues = [
        row.from,
        row.to,
        row.schedule,
        row.adultSellingPrice,
        row.childSellingPrice,
        row.adultNetPrice,
        row.childNetPrice
      ];
      return rowValues.join(', ');
    });

    fs.writeFileSync(
      'spsc.csv',
      csvRows.join('\n')
    );
  });
}

function addTwoSpacesBeforeKoh(text) {
  // This regex finds a single space (`\s`) that is immediately followed by "Koh"
  // The `(?=Koh)` is a positive lookahead; it asserts that "Koh" is present but
  // doesn't include it in the text that gets replaced.
  return text.replace(/\s(?=Koh)/, '   ');
}

function replaceLanta(text) {
  // Check if "Koh Lanta" already exists in the string.
  // The 'if' condition will only be true if it's not found.
  if (!text.includes('Koh Lanta')) {
    // This regex matches the whole word "Lanta" using word boundaries (\b).
    // The 'g' flag ensures all occurrences are replaced.
    return text.replace(/\bLanta\b/g, 'Koh Lanta');
  }

  // If "Koh Lanta" is already present, return the original text unchanged.
  return text;
}