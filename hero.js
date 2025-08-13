import { firestore } from './firebase.js';
import { writeFileSync } from 'fs';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

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
        let availability = "";
        const scheduleObject = item.availability.schedules[schedule];

        if (scheduleObject.mode === "blockout") {
          if (scheduleObject.blockoutPeriods ?? [].length > 0) {
            availability = scheduleObject.blockoutPeriods.map(period => {
              let currentYear = dayjs().year();

              const blockoutStart = dayjs(period.start + "." + currentYear, 'DD.MM.YYYY');
              const blockoutEnd = dayjs(period.end + "." + currentYear, 'DD.MM.YYYY');
              const availableStart = blockoutEnd.add(1, 'day');
              let availableEnd = blockoutStart.add(-1, 'day').add(1, "year");

              if (availableEnd.isBefore(availableStart)) {
                availableEnd = availableEnd.add(1, 'year');
              }

              return `${availableStart.format('D MMM YYYY')} - ${availableEnd.format('D MMM YYYY')}`;
            });
          } else {
            availability = "Daily";
          }
        } else if (scheduleObject.mode === "singleDates") {
          availability = "Single dates";
        } else {
          availability = "No service";
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
            availability
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
    return `${row.from}, ${row.to}, ${row.schedule}, ${row.adultSellingPrice}, ${row.childSellingPrice}, ${row.adultNetPrice}, ${row.childNetPrice}, ${row.availability}`;
  });

  writeFileSync(
    'output/hero.csv',
    outputRows.join('\n')
  );

  return tempOutputRows;
}
exportHero();