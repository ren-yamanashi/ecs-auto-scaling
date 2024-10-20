import { Hono } from "hono";
import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const port = 80;
const app = new Hono();

// 負荷をかけるための関数
function heavyComputation() {
  const start = Date.now();
  // 500ms程度の処理時間をかける
  while (Date.now() - start < 500) {
    Math.sqrt(Math.random()); // 無意味な計算を繰り返す
  }
}

app.get("/", (c) => {
  heavyComputation();
  return c.text("Heavy computation done!");
});

serve({
  fetch: app.fetch,
  port,
});

// eslint-disable-next-line no-console
console.log(`🚀  Server ready at ${process.env.API_URL}:${port}/`);
