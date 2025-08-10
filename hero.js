import { firestore } from './firebase.js';
import { writeFileSync } from 'fs';

export async function exportHero() {
  let snapshot = await firestore.collection("products").where("operator.default.name", "==", "Satun Pakbara Speed Boat Club").get();
  let items = snapshot.docs.map((item) => (item.data())).sort(((d1, d2) => d1.title.localeCompare(d2.title)));

  const validRoutes = new Set();
  items.forEach(item => {
    validRoutes.add(`${item.from}-${item.to}`);
  });

  let tempOutputRows = [];
  items.forEach((item) => {
    if (item.availability && item.availability.schedules) {
      Object.keys(item.availability.schedules).forEach((schedule) => {
        let blockoutPeriods = "";
        let scheduleObject = item.availability.schedules[schedule];

        if (scheduleObject.blockoutPeriods ?? [].length > 0) {
          blockoutPeriods = scheduleObject.blockoutPeriods.map((item) => `${item.start}-${item.end}`).join(",")
        }
        if (item.from && item.to && item.pricing && item.pricing.volumes && item.pricing.volumes.length > 0) {
          tempOutputRows.push({
            from: item.from,
            to: item.to,
            schedule: schedule,
            adultSellingPrice: item.pricing.volumes[0].adult.sellingPrice,
            childSellingPrice: item.pricing.volumes[0].child.sellingPrice,
            adultNetPrice: item.pricing.volumes[0].adult.operatorNetPrice,
            childNetPrice: item.pricing.volumes[0].child.operatorNetPrice,
          });
        }
      });
    }
  });

  tempOutputRows.sort((d1, d2) => {
    const fromComparison = d1.from.localeCompare(d2.from);
    if (fromComparison !== 0) return fromComparison;

    const toComparison = d1.to.localeCompare(d2.to);
    if (toComparison !== 0) return toComparison;

    return d1.schedule.localeCompare(d2.schedule);
  });

  let outputRows = tempOutputRows.map(row => {
    return `${row.from}, ${row.to}, ${row.schedule}, ${row.adultSellingPrice}, ${row.childSellingPrice}, ${row.adultNetPrice}, ${row.childNetPrice}`;
  });

  writeFileSync(
    'output/hero.csv',
    outputRows.join('\n')
  );
}