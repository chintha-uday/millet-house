import { copyFile, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("./dist/", import.meta.url);
const storefrontFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "products.js",
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of storefrontFiles) {
  await copyFile(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}
