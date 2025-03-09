# WebTransport / HTTP3 in Node.js

- Uses [fails-components/webtransport](https://github.com/fails-components/webtransport) as HTTP/3 layer.
- Node.js 20+

![](screenshot.png)

## Running locally

Install and run both the server and the frontend:

```
npm install
npm start
```

Open `https://localhost:4433` in your browser. (Currently only Chrome is capable of connecting)

## Deploying

WIP

- Get a LetsEncrypt certificate for your domain.
- ~SSL certificate must be set to expire in less than 14 days~ (This doesn't seem to be required [?])

(TODO: see thread https://community.letsencrypt.org/t/nginx-http3-letsencrypt/181112/13)

## License

MIT
