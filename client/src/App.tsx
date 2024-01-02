import { log } from 'console';
import { useEffect, useRef, useState } from 'react'

const ENDPOINT = "https://localhost:4433";
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

interface Log {
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
}

const LOG_COLOR = {
  info: 'text-gray-900',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-300 text-green-800',
};

function App() {
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([] as Log[]);

  const logsRef = useRef(null as HTMLDivElement | null);

  const onEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  function appendLog(log: Log) {
    setLogs((logs) => [...logs, log]);
  }

  // async function readDatagram(datagramReader: ReadableStreamDefaultReader<Uint8Array>) {
  //   while (isDatagramReaderClosed === false) {
  //     const { done, value } = await datagramReader.read();
  //     if (done) {
  //       break;
  //     }
  //     appendLog({ message: `Datagram read: ${value}`, type: 'info' });
  //   }
  // }

  async function readData(dataReader: ReadableStreamDefaultReader<Uint8Array>, from: string) {
    let isOpen = true;
    dataReader.closed.then(() => isOpen = false);

    while (isOpen) {
      const { done, value } = await dataReader.read();
      if (done) {
        break;
      }
      appendLog({ message: `Read from ${from}: ${value}`, type: 'info' });
    }
  }

  async function readStream(readableStream: ReadableStream, streamType: string) {
    const reader = readableStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }

      appendLog({ message: `Received ${streamType} stream`, type: 'info' })
      readData(value.readable.getReader(), streamType);

      // value is an instance of WebTransportBidirectionalStream
      console.log("Received stream", {
        readable: value.readable,
        writable: value.writable
      })
    }
  }

  async function setupWebTransport(wt: WebTransport) {
    wt.closed.then((e) => {
      appendLog({ message: 'WebTransport is closed', type: 'info' });
    }).catch((e) => {
      appendLog({ message: e.toString(), type: 'error' });
    });

    wt.ready.then(() => {
      setIsReady(true);
      appendLog({ message: 'WebTransport is ready', type: 'success' });

      const datagramReader = wt.datagrams.readable.getReader();
      readData(datagramReader, "datagram");

      readStream(wt.incomingBidirectionalStreams, "bidirectional");
      readStream(wt.incomingUnidirectionalStreams, "unidirectional");

    }).catch((e) => {
      appendLog({ message: e.toString(), type: 'error' });
    });
  }

  useEffect(() => {
    let wt: WebTransport;

    const abortController = new AbortController();
    const signal = abortController.signal;

    fetch(`${ENDPOINT}/fingerprint`, { method: "GET", signal }).
      then((res) => res.json()).
      then((fingerprint) => {
        const pubKey = new Uint8Array(fingerprint);

        const options = (isFirefox) ? undefined : {
          // requireUnreliable: true,
          // congestionControl: "default", // "low-latency" || "throughput"

          // Firefox doesn't support "serverCertificateHashes" option yet
          serverCertificateHashes: [{
            algorithm: 'sha-256',
            value: pubKey.buffer
          }]
        };

        wt = new WebTransport(ENDPOINT, options);
        setupWebTransport(wt);
      });

    return () => {
      if (wt) {
        wt.close();

      } else {
        abortController.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex">
      <div className="flex-grow">
        <h2 className="font-semibold text-xl mb-2">API</h2>
        <form action="">
          <label className="text-sm uppercase mr-2" htmlFor="endpoint">Endpoint</label>
          <input className="p-2 rounded bg-slate-200 border border-slate-300 disabled:cursor-not-allowed" disabled={true} type="text" name="endpoint" id="endpoint" value={ENDPOINT} onChange={onEndpointChange} />
        </form>

        <form>
          <h3 className="font-semibold text-lg">Incoming Bidirectional Streams</h3>
          <button></button>
        </form>

        <p>xxxx</p>

      </div>

      <div className="flex-grow">
        <h2 className="font-semibold text-xl mb-2">Logs</h2>

        <div ref={logsRef} className="bg-gray-100 rounded-lg p-4 text-sm text-gray-900 overflow-auto max-h-96"><pre>
          <code>{
          logs.map((log) =>
            (
              <div key={log.message} className={`${LOG_COLOR[log.type]} rounded p-1`}>
                {log.message}
              </div>
            )
          )
          }</code>
        </pre></div>

      </div>
    </div>
  )
}

export default App
