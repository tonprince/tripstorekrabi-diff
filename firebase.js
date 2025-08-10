const admin = require('firebase-admin');
const credentials = require("./tripstorekrabi-next-firebase-adminsdk-zmoo4-f9adf33e1b.json");

let app = admin.apps.find((item) => item.name === "hero");
if (!app) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      project_id: credentials.project_id,
      private_key: credentials.private_key.replace(/\\n/g, '\n'),
      client_email: credentials.client_email
    }),
    storageBucket: `${credentials.project_id}.appspot.com`,
  }, "hero");
}

let firestore = admin.firestore(app);
let storage = admin.storage(app);
let auth = admin.auth(app);

module.exports = { firestore, storage, admin, auth };