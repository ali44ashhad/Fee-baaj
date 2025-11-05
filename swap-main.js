const fs = require("fs");
const path = require("path");

if (process.argv.length < 3) {
  console.error("Usage: node swap-main.js [prod|dev]");
  process.exit(1);
}

const mode = process.argv[2];
const targetMain = mode === "prod" ? "dist/index.js" : "src/index.ts";

// List of package.json files to update
const packageJsonFiles = [
    path.resolve(__dirname, "packages/schemas/package.json"),
  path.resolve(__dirname, "packages/types/package.json"),
  path.resolve(__dirname, "packages/lib/package.json"),
  path.resolve(__dirname, "packages/models/package.json"),
];

packageJsonFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.error(`Error: package.json not found at ${file}`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(file, "utf8"));

  if (packageJson.main === targetMain) {
    console.log(`Skipping: ${file} already set to ${targetMain}`);
    return;
  }

  packageJson.main = targetMain;
  fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + "\n");

  console.log(`Updated 'main' to: ${targetMain} in ${file}`);
});
