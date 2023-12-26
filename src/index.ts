import path from "path";
import mime from "mime";
import { readFile } from "node:fs/promises";
import { createServer } from "https";
import { Http3Server } from "@fails-components/webtransport";
import { generateWebTransportCertificate } from './mkcert';

const PORT = 4433;

let isKilled: boolean = false;

async function loop(h3Server: Http3Server) {
  try {
    const sessionStream = await h3Server.sessionStream("/");
    const sessionReader = sessionStream.getReader();

    while (!isKilled) {
      console.log("sessionReader.read()");
      const { done, value } = await sessionReader.read();
      if (done) {
        console.log("done! break loop.");
        break;
      }

      console.log(value);

      console.log("sessionReader.read() =>", value);
    }

  } catch (e) {
    console.error("error:", e);

  } finally {
    console.log("will stop the server!");
    // stop the server!
    h3Server.stopServer();
  }
}

async function main() {
  const certificate = await generateWebTransportCertificate([
    { shortName: 'C', value: 'BR' },
    { shortName: 'ST', value: 'Rio Grande do Sul' },
    { shortName: 'L', value: 'Sapiranga' },
    { shortName: 'O', value: 'Colyseus WebTransport' },
    { shortName: 'CN', value: '0.0.0.0' }
  ], {
    days: 12,
  });

  /**
   * Create a HTTPS server to serve static files
   */
  createServer({
    cert: certificate?.cert,
    key: certificate?.private
  }, async function (req, res) {
    try {
      const filename = req.url?.substring(1) || "index.html"; // fallback to "index.html"
      const contents = await readFile(path.join(__dirname, "..", "public", filename));
      res.writeHead(200, { "content-type": mime.getType(filename) || "text/plain" });
      res.end(contents);

    } catch (e) {
      console.error(e);
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not Found");
    }
  }).listen(PORT);

  // https://github.com/fails-components/webtransport/blob/master/test/testsuite.js

  const h3Server = new Http3Server({
    host: "0.0.0.0",
    port: PORT,
    secret: "mysecret",
    cert: certificate?.cert,
    privKey: certificate?.private,
  });

  h3Server.startServer();
  loop(h3Server);

  function handle(e: any) {
    console.log("SIGNAL RECEIVED:", e);
    isKilled = true;
    h3Server.stopServer();
  }

  process.on("SIGINT", handle);
  process.on("SIGTERM", handle);

}


main();
