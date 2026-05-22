const mongoose = require("mongoose");
const { env } = require("../config/env");
const { seedDefaultUomsService } = require("../services/uom.service");

const run = async () => {
  await mongoose.connect(env.mongodbUri);
  const rows = await seedDefaultUomsService();
  const created = rows.filter((row) => row.action === "created").length;
  const updated = rows.filter((row) => row.action === "updated").length;
  console.log(`Seeded UOM defaults. Created: ${created}, updated: ${updated}.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
