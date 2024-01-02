import path from "path";
import mime from "mime";
import { readFile } from "node:fs/promises";
import http from "http";
import https from "https";
import { Http3Server } from "@fails-components/webtransport";
import { generateWebTransportCertificate } from './mkcert';

const PORT = 4433;

const proxy = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: 'localhost',
    port: 5173,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, {
      end: true
    });
  });

  clientReq.pipe(proxyReq, {
    end: true
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy request error:', err);
    clientRes.end();
  });
});

async function main() {
  const certificate = await generateWebTransportCertificate([
    { shortName: 'C', value: 'BR' },
    { shortName: 'ST', value: 'Rio Grande do Sul' },
    { shortName: 'L', value: 'Sapiranga' },
    { shortName: 'O', value: 'Colyseus WebTransport' },
    { shortName: 'CN', value: 'localhost' },
  ], {
    days: 10,
  });

  /**
   * Create a HTTPS server to serve static files
   */
  https.createServer({
    cert: certificate?.cert,
    key: certificate?.private
  }, async function (req, res) {
    const filename = req.url?.substring(1) || "index.html"; // fallback to "index.html"

    if (filename === "fingerprint") {
      const fingerprint = certificate?.fingerprint!.split(":").map((hex) => parseInt(hex, 16));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(fingerprint));
      return;
    }

    proxy.emit('request', req, res);
  }).listen(PORT);

  // https://github.com/fails-components/webtransport/blob/master/test/testsuite.js

  const h3Server = new Http3Server({
    host: "localhost",
    port: PORT,
    secret: "mysecret",
    cert: certificate?.cert,
    privKey: certificate?.private,
  });

  h3Server.startServer();

  let isKilled: boolean = false;

  function handle(e: any) {
    console.log("SIGNAL RECEIVED:", e);
    isKilled = true;
    h3Server.stopServer();
  }

  process.on("SIGINT", handle);
  process.on("SIGTERM", handle);

  try {
    const sessionStream = await h3Server.sessionStream("/");
    const sessionReader = sessionStream.getReader();

    while (!isKilled) {
      console.log("sessionReader.read() - waiting for session...");
      const { done, value } = await sessionReader.read();
      if (done) {
        console.log("done! break loop.");
        break;
      }

      value.ready.then(() => {
        console.log("session ready!");

        value.createBidirectionalStream().then((bidi) => {
          const writer = bidi.writable.getWriter();
          const reader = bidi.readable.getReader();
        });

        // reading datagrams
        const datagramReader = value.datagrams.readable.getReader();

        // writing datagrams
        const datagramWriter = value.datagrams.writable.getWriter();
        datagramWriter.write(new Uint8Array([1, 2, 3, 4, 5]));
        datagramWriter.write(new Uint8Array([6, 7, 8, 9, 10]));

      }).catch((e) => {
        console.log("session failed to be ready!");
      });
      // console.log(value);
      // console.log("sessionReader.read() =>", value);
    }

  } catch (e) {
    console.error("error:", e);

  } finally {
    console.log("will stop the server!");
    // stop the server!
    h3Server.stopServer();
  }
}

main();
