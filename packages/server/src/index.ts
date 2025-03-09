import fs from "fs";
import path from "path";
import mime from "mime";
import http from "http";
import https from "https";
import { Http3Server } from "@fails-components/webtransport";
import { generateWebTransportCertificate } from './mkcert';
import { readFile } from "node:fs/promises";

const isProduction = process.env.NODE_ENV === "production";
const PORT = 4433;
const HOST = (isProduction)
  ? "demo.web-transport.io"
  : "localhost";

/**
 * Proxy to serve local development server (:5173) on HTTPS (:4433)
 */
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
  const certificate = (isProduction) ? {
    /**
     * Replace with your own certificate.
     */
    private: fs.readFileSync("/etc/letsencrypt/live/demo.web-transport.io/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/demo.web-transport.io/fullchain.pem"),
    fingerprint: "" // not used in production

  } : await generateWebTransportCertificate([
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
    key: certificate?.private,
  }, async function (req, res) {
    const filename = req.url?.substring(1) || "index.html"; // fallback to "index.html"

    if (filename === "fingerprint") {
      const fingerprint = certificate?.fingerprint!.split(":").map((hex) => parseInt(hex, 16));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(fingerprint));
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      /**
       * DEVELOPMENT:
       * Use proxy to serve local development server
       */
      proxy.emit('request', req, res);

    } else {
      /**
       * PRODUCTION:
       * Serve static files from "client/dist"
       */

      const filepath = path.join(__dirname, "..", "client", "dist", filename);
      if (fs.existsSync(filepath)) {
        res.writeHead(200, {
          "content-type": (mime.getType(filename) || "text/plain"),
          "Alt-Svc": `h3=":${PORT}"`
        });
        res.end((await readFile(filepath)));

      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    }

  }).listen(PORT);

  console.log("Listening on " + PORT);

  // https://github.com/fails-components/webtransport/blob/master/test/testsuite.js

  const h3Server = new Http3Server({
    host: HOST,
    port: PORT,
    secret: "mysecret",
    cert: certificate?.cert,
    privKey: certificate?.private,
  });

  h3Server.startServer();
  // h3Server.updateCert(certificate?.cert, certificate?.private);

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
    sessionReader.closed.catch((e: any) => console.log("session reader closed with error!", e));

    while (!isKilled) {
      console.log("sessionReader.read() - waiting for session...");
      const { done, value } = await sessionReader.read();
      if (done) {
        console.log("done! break loop.");
        break;
      }

      value.closed.then(() => {
        console.log("Session closed successfully!");
      }).catch((e: any) => {
        console.log("Session closed with error! " + e);
      });

      value.ready.then(() => {
        console.log("session ready!");

        value.createBidirectionalStream().then((bidi) => {
          const reader = bidi.readable.getReader();

          let i = 0;
          const sendingInterval = setInterval(() => {
            console.log("sending...");
            writer.write(new Uint8Array([i, i + 1, i + 2]));
            i += 3;
          }, 30);

          reader.closed.catch((e: any) => console.log("writer closed with error!", e));

          const writer = bidi.writable.getWriter();
          writer.closed.catch((e: any) => {
            console.log("writer closed with error!", e);
            clearInterval(sendingInterval);
          });

        }).catch((e: any) => {
          console.log("failed to create bidirectional stream!", e);
        });

        // reading datagrams
        const datagramReader = value.datagrams.readable.getReader();
        datagramReader.closed.catch((e: any) => console.log("datagram reader closed with error!", e));

        // writing datagrams
        const datagramWriter = value.datagrams.writable.getWriter();
        datagramWriter.closed
          .then(() => console.log("datagram writer closed successfully!"))
          .catch((e: any) => console.log("datagram writer closed with error!", e));
        datagramWriter.write(new Uint8Array([1, 2, 3, 4, 5]));
        datagramWriter.write(new Uint8Array([6, 7, 8, 9, 10]));

      }).catch((e: any) => {
        console.log("session failed to be ready!");
      });
    }

  } catch (e) {
    console.error("error:", e);

  // } finally {
  //   console.log("will stop the server!");
  //   // stop the server!
  //   h3Server.stopServer();
  }
}

main();
