import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const destination = resolve(root, "app", "favicon.ico");

/*
  Valid Windows ICO containing a 32x32 PNG favicon.

  Design:
  - full dark navy background
  - white TraceDesk T
  - electric-blue incident pulse

  This ICO has been validated as:
  format: ICO
  dimensions: 32x32
  mode: RGBA
*/

const faviconBase64 =
  "AAABAAEAICAAAAAAIAD8AAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAgAAAAIAgGAAAAc3p69AAAAMNJREFUeJxjZJOw+s8wgIBpIC0fdcCgcAALIQWfHh2l2BI+OWuccnhDgBqWEzJnwKNg1AGD2wH4Ui8pAJ85jOTUBbhSNTkOHtxRMCIcQLAoxgcs8xHs4xPJM2PAQ4BsByD7HhufWEAwCrQDMbMcetBjsxybvqvrMbMpVaMAZik2y3EBihwAS3jkJkAGBiqWhNiiAVuQowOqRQF6KBBjOVUdQC6gqCBCB8T6GhkMeAiQ5QBs1S65bQeycgE1wdCMgmHlAABWqSuwGkMCdwAAAABJRU5ErkJggg==";

await mkdir(dirname(destination), {
  recursive: true
});

await writeFile(
  destination,
  Buffer.from(faviconBase64, "base64")
);

console.log("Generated valid app/favicon.ico");
