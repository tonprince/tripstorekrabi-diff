const { exec } = require('child_process');
const fs = require('fs');

const pdfPath = 'SPC Contract_Rate-2025-2026-R1.pdf';

exec(`pdftotext -layout "${pdfPath}" -`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error converting PDF: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`pdftotext stderr: ${stderr}`);
    return;
  }

  const textWithSpaces = stdout;
  const parsedData = [];

  textWithSpaces.split('\n').forEach(line => {
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

  const csvRows = parsedData.map(row => {
    const rowValues = [
      row.from,
      row.to,
      row.schedule.replace('-', ' - '),
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