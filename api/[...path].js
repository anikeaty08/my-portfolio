import { createApiApp, ensureDb } from "../server/apiApp.js";

const { app } = createApiApp();

export default async function handler(req, res) {
  await ensureDb();
  return app(req, res);
}

