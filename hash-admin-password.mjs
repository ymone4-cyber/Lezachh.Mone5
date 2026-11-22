import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

function hiddenInput(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== "function") return reject(new Error("Lancez ce script dans un terminal interactif."));
    let value = "";
    const cleanup = () => { input.setRawMode(false); input.pause(); input.removeListener("data", onData); process.stdout.write("\n"); };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === "\u0003") { cleanup(); reject(new Error("Opération annulée.")); return; }
        if (char === "\r" || char === "\n") { cleanup(); resolve(value); return; }
        if (char === "\u007f" || char === "\b") { value = Array.from(value).slice(0, -1).join(""); process.stdout.write("\b \b"); continue; }
        value += char; process.stdout.write("•");
      }
    };
    process.stdout.write(prompt); input.setRawMode(true); input.setEncoding("utf8"); input.resume(); input.on("data", onData);
  });
}

try {
  const password = await hiddenInput("Mot de passe admin (10 caractères minimum) : ");
  const confirmation = await hiddenInput("Confirmez le mot de passe : ");
  const first = Buffer.from(password, "utf8"), second = Buffer.from(confirmation, "utf8");
  if (Array.from(password).length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");
  if (first.length !== second.length || !timingSafeEqual(first, second)) throw new Error("Les mots de passe ne correspondent pas.");
  const rounds = 310000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(first, salt, rounds, 32, "sha256");
  console.log(`Empreinte à copier dans le secret ADMIN_PASSWORD_HASH :\npbkdf2-sha256$${rounds}$${salt.toString("base64url")}$${hash.toString("base64url")}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
