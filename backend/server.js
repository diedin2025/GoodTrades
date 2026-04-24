import { createAppServer } from "./app.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

const server = createAppServer();

server.listen(PORT, HOST, () => {
  console.log(`GoodTrades backend running at http://${HOST}:${PORT}`);
});
