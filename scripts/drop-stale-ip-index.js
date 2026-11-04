/**
 * One-time script: drop the stale ip_1 unique index on the ratelimits collection.
 * The schema was changed from `ip` to `ipHash` but the old unique index was never removed,
 * causing E11000 errors when multiple documents have ip: null.
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.mongodbURL);
  const coll = mongoose.connection.collection("ratelimits");

  const indexes = await coll.indexes();
  const hasIpIndex = indexes.some((i) => i.name === "ip_1");

  if (hasIpIndex) {
    await coll.dropIndex("ip_1");
    console.log("Dropped stale index ip_1 from ratelimits");
  } else {
    console.log("Index ip_1 does not exist — nothing to do");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
