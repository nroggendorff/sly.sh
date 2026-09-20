import fs from "node:fs";
import path from "node:path";

const dist = "dist";
const assetsDir = path.join(dist, "assets");

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync("assets/box.glb", path.join(assetsDir, "box.glb"));

fs.cpSync("pages", dist, { recursive: true });

const hashed = {};
for (const file of fs.readdirSync(assetsDir)) {
  const match = file.match(/^(.+)-[A-Za-z0-9_-]{8}\.(\w+)$/);
  if (match) hashed[`${match[1]}.${match[2]}`] = file;
}

const htmlFiles = fs
  .readdirSync(dist, { recursive: true })
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.join(dist, file));

for (const file of htmlFiles) {
  const original = fs.readFileSync(file, "utf8");
  let content = original;
  for (const [name, hashedName] of Object.entries(hashed)) {
    const pattern = new RegExp(
      `https://sly\.sh/assets/${name.replace(/\./g, "\.")}`,
      "g",
    );
    content = content.replace(pattern, `https://sly.sh/assets/${hashedName}`);
  }
  if (content !== original) fs.writeFileSync(file, content);
}

fs.writeFileSync(path.join(dist, "CNAME"), "sly.sh\n");
