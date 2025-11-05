/* eslint-disable no-console */
/* eslint-disable no-process-exit */

import app from "./app";
import config from "./config";
import mongoose from "mongoose";

// Handle uncaught exceptions. Happens synchronously!
process.on("uncaughtException", (err) => {
  console.log("Unhandled exception 💥! Application shutting down!");
  console.log(err.name, err.message);
  process.exit(1);
});

const PORT = config.api.port || 5000;
const DB = config.db.url || "";

mongoose
  .connect(DB, {
    dbName: config.db.name,
  })
  .then(() => {
    console.log("MongoDB connection successfull! 🔥");
  })
  .catch((err) => {
    console.log(`Error found! Error: ${err}`);
  });

const server = app.listen(PORT, () => {
  console.log(`Application running on Express.js on port ${PORT}! 👍`);
});

// Handle unhandled rejections --- the middleware stack will end here.
process.on("unhandledRejection", (err: any) => {
  console.log("Unhandled rejection 💥! Application shutting down!");
  console.log(err.name, err.message);

  // Finish all requests that are still pending, the shutdown gracefully.
  server.close(() => {
    process.exit(1);
  });
});