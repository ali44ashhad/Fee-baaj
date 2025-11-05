// scripts/set-bucket-cors.js
require('dotenv/config');
// scripts/set-bucket-cors.js
const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const endpoint =  "https://freebaj-media.hel1.your-objectstorage.com";
const region = process.env.S3_REGION || "eu-central-1";

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId:  process.env.S3_KEY,
    secretAccessKey:  process.env.S3_SECRET
  }
});

async function run() {
  const params = {
    Bucket: process.env.S3_BUCKET || "freebaj-media",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://localhost:3001", "https://admin.freebaj.net"],
          AllowedMethods: ["GET", "PUT", "POST", "HEAD", "OPTIONS"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  };

  try {
    await s3.send(new PutBucketCorsCommand(params));
    console.log("CORS set successfully!");
  } catch (err) {
    console.error("Failed to set bucket CORS:", err);
  }
}

run();

