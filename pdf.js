import { exec } from 'child_process';
import fs from 'fs';

const pdfPath = 'SPC Contract_Rate-2025-2026-R1.pdf';

export async function exportPdf(items) {
  const validRoutes = new Set(items.map(item => `${item.from.trim()}|${item.to.trim()}`));

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
      line = line.replaceAll("koh", "Koh").
        replaceAll("Buloan", "Bulone").
        replaceAll("Railay", "Railay Beach").
        replaceAll("Pakbara pier ", "Pakbara Pier").
        replaceAll("Phiphi", "Phi Phi").
        replaceAll("PhiPhi", "Phi Phi").
        replaceAll("Koh Langkawi", "Langkawi").
        replaceAll("(MYT)", "").
        replaceAll("(THT)", "").
        replaceAll("0.0", "0:0");
      line = addTwoSpacesBeforeKoh(line);
      line = replaceLanta(line);

      const lineRegex = /^\s*(\d+)\s+(\d+)\s+([\w\s]+?)\s{2,}([\w\s]+?)\s{2,}(\d{2}:\d{2})\s{2,}(\d{2}:\d{2})\s{2,}([\d,\s]+)\s{2,}([^\s]+)\s{2,}(.*)/;
      const match = line.match(lineRegex);

      if (line.startsWith("195")) {
        console.log(line);
      }

      if (match) {
        const prices = match[7]
          .trim()
          .split(/\s+/)
          .map(price => parseInt(price.replace(/,/g, ''), 10));

        let item = {
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
        };

        const routeKey = `${item.from}|${item.to}`;
        if (validRoutes.has(routeKey)) {
          parsedData.push(item);
        }
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
      'output/spsc.csv',
      csvRows.join('\n')
    );
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