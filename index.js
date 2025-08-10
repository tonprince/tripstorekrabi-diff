import { exportHero } from "./hero.js";
import { exportPdf } from "./pdf.js";

exportHero().then((result) => exportPdf(result));