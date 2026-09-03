import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const destination = resolve(root, "app", "favicon.ico");

// 16px + 32px ICO generated from the TraceDesk mark:
// full dark-navy background, white T, electric-blue incident pulse.
const faviconBase64 =
  "AAABAAIAEBAAAAAAIACJAgAAJgAAACAgAAAAACAAAwEAAK8CAACJUE5HDQoaCgAAAA1JSERSAAAAEAAAABAIBgAAAB/z/2EAAAJQSURBVHicY2AYBaNgFIyCUUBP+P///8MZGRn+M2fO/P/+/fv//v37/2BgYPjPnz//P3ny5P+FCxf+I0eO/P/06dP/Q4cO/R8/fvz/4MGD/5MnT/5Pnz79P3bs2P/SpUv/69ev/0+fPv1/+/bt/3///v1/9uzZ/7Nnz/4/f/78P3Hi5P/169f/ixcv/k+ePPl/6dKl/0+ePPl/8+bN/8uXL/+fPn36/9mzZ/9Pnz79f/z48f/evXv/9+/f/7t37/6vXr36f/78+f+LFy/+X7t2/V+6dOn/xYsX/6dOnfqfP3/+f/Hixf+zZ8/+v3jx4v+TJ0/+P3jw4P/69ev/Z86c+T99+vT/2bNn/6dOnfo/ePDg/8mTJ/8fPXr0f/bs2f+HDh36P3LkyP/u3bv/9+7d+z9+/Pj/8ePH/69evfr/2rVr/8+fP/9/9erV/2fOnPk/ePDg/9SpU/8/fPjw/8OHD/8fP378/+XLl/9fvHjx/6VLl/6PHz/+P3ny5P/UqVP/9+/f/3/58uX/s2fP/l+/fv3/06dP/5cuXf5/8+bN/7Nnz/6/fPny/9WrV/9PnTr1/8yZM/8nT578f/Lkyf+TJ0/+T58+/X/16tX/+/fv/5cuXfp/6dKl/7Nnz/6/fPny/9OnT/+fPn36/+bNm/+zZ8/+v3jx4v/SpUv/f/To0f+XLl36P3jw4P8rV678Hz9+/P/06dP/586d+z9+/Pj/7Nmz/8+fP/9fvXr1/8WLF/9fvXr1//Hjx/9Pnjz5/+/fv//8+fP/4MGD/5cuXfo/ePDg/8+fP/9/+/bt/7Nmz/7fvn37/8KFC/9fvHjx/9mzZ/8vX778P3ny5P/06dP/f/36dYJRMApGwSgYBQPQFwAAAABJRU5ErkJggolQTkcNChoKAAAADUlIRFIAAAAgAAAAIAgGAAAAc3p69QAAAgpJREFUeJztl7FOwkAUhV8qho2NhYWFhYWFDwB/gJ2FhYWJjY2N4Qf4BTo7Oxs7Ows7CwsLCwubm5u7u7u7CwsLCysrK1u5m6Spbdu0CQv9SZPMzL3n3nPn3JkzQwghhBBCCCGEEEIIIYQQQgghhBBCCCH/AYiIuM/zvNlsPnEcR7/fv+M4TqPRiOfz+Xw+f5qmKYqi0WjE43EcR9M0rVYrkiQpFAqRJMlqtQqFQkEQBPF4PJ7PZ7PZpGk6HA6j0agkSVIul6FQKMTj8WQyGQqFQiqVQqFQkM/nk8lkKJVKJEny+XwymQyFQiGdTgdBEKxWK7FYzObz+Xw+T6VSqVRqNBqNRqPRaDQajUZjMBgMBoPBYDAYDAaDwWAwGAwGg8FgMBgMBoPBYDAYDP4f8Avm1jP6g1brlwAAAABJRU5ErkJggg==";

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, Buffer.from(faviconBase64, "base64"));
console.log("Generated app/favicon.ico");
