// Start Expo web on the port the preview tool assigns (PORT env), falling back to 8081.
// Expo CLI ignores PORT and only takes --port, so pass it through. Extra args (e.g. --clear) are forwarded.
const { spawn } = require("child_process");
const path = require("path");

const port = process.env.PORT || "8081";
const cwd = path.join(__dirname, "..", "iot-lab-management");
const args = ["expo", "start", "--web", "--port", port, ...process.argv.slice(2)];

const child = spawn("npx", args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
