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
  const [endpoint, setEndpoint] = useState(ENDPOINT);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([] as Log[]);

  const [isDatagramBlockOpen, setIsDatagramBlockOpen] = useState(false);
  const [isIncomingBidiBlockOpen, setIsIncomingBidiBlockOpen] = useState(false);
  const [isIncomingUniBlockOpen, setIsIncomingUniBlockOpen] = useState(false);
  const [isBidiBlockOpen, setIsBidiBlockOpen] = useState(false);
  const [isUniBlockOpen, setIsUniBlockOpen] = useState(false);

  const logsRef = useRef(null as HTMLDivElement | null);
  const wtRef = useRef(null as WebTransport | null);

  const toggleOpenDatagram = () => setIsDatagramBlockOpen(!isDatagramBlockOpen);
  const toggleOpenIncomingBidi = () => setIsIncomingBidiBlockOpen(!isIncomingBidiBlockOpen);
  const toggleOpenIncomingUni = () => setIsIncomingUniBlockOpen(!isIncomingUniBlockOpen);
  const toggleOpenBidi = () => setIsBidiBlockOpen(!isBidiBlockOpen);
  const toggleOpenUni = () => setIsUniBlockOpen(!isUniBlockOpen);

  const onEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setEndpoint(e.target.value);
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

  function connect(abortController?: AbortController) {
    let certificateHash: Uint8Array;
    let options: WebTransportOptions | undefined;
    let error: Error;



    fetch(`${endpoint}/fingerprint`, { method: "GET", signal: abortController?.signal }).
      then((res) => res.json()).
      then((fingerprint) => {
        certificateHash = new Uint8Array(fingerprint);

        options = (isFirefox) ? undefined : {
          // requireUnreliable: true,
          // congestionControl: "default", // "low-latency" || "throughput"

          // Firefox doesn't support "serverCertificateHashes" option yet
          serverCertificateHashes: [{
            algorithm: 'sha-256',
            value: certificateHash.buffer
          }]
        };
      }).catch((e) => {
        console.error(e);
        error = e;

      }).finally(() => {
        // proceed only if not request aborted
        if (!abortController || !abortController.signal.aborted) {
          wtRef.current = new WebTransport(endpoint, options);
          setupWebTransport(wtRef.current);
        }
      });
  }

  async function setupWebTransport(wt: WebTransport) {
    wt.closed.then((e) => {
      appendLog({ message: 'WebTransport is closed', type: 'info' });
    }).catch((e) => {
      appendLog({ message: e.toString(), type: 'error' });
    }).finally(() => {
      setIsReady(false);
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

  const onClickConnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    connect();
  };

  const onClickDisconnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    wtRef.current?.close();
  };

  useEffect(() => {
    const abortController = new AbortController();
    connect(abortController);

    return () => {
      if (wtRef.current) {
        wtRef.current.close();

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
        {/* <h2 className="font-semibold text-xl mb-2">API</h2> */}
        <form action="" className="mb-2">
          <label className="text-sm uppercase mr-2" htmlFor="endpoint">Endpoint</label>
          <input className="p-2 rounded bg-gray-100 border border-slate-300 disabled:cursor-not-allowed mr-1" type="text" name="endpoint" id="endpoint" value={endpoint} onChange={onEndpointChange} />
          {(isReady) ? (
            <button className="p-2 rounded bg-red-500 border border-red-800 hover:bg-red-600 hover:border-red-800 active:bg-red-900 text-white" onClick={onClickDisconnect}>Disconnect</button>
          ) : (
            <button className="p-2 rounded bg-green-500 border border-green-800 text-white" onClick={onClickConnect}>Connect</button>
          )}
        </form>

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenDatagram}>
          <span className={`caret inline-block transition-all ${(isDatagramBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Datagrams
        </h3>

        {(isDatagramBlockOpen) && (
          <form className="mb-2">
            <button>Read</button>
          </form>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenIncomingBidi}>
          <span className={`caret inline-block transition-all ${(isIncomingBidiBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Incoming Bidirectional Streams
        </h3>
        {(isIncomingBidiBlockOpen) && (
          <form className="mb-2">
            <button>Read</button>
          </form>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenIncomingUni}>
          <span className={`caret inline-block transition-all ${(isIncomingUniBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Incoming Unidirectional Streams
        </h3>
        {(isIncomingUniBlockOpen) && (
          <form className="mb-2">
            <button>Read</button>
          </form>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenBidi}>
          <span className={`caret inline-block transition-all ${(isBidiBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Bidirectional Streams
        </h3>
        {(isBidiBlockOpen) && (
          <form className="mb-2">
            <button className="rounded p-4 inline-block ">Create</button>
          </form>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenUni}>
          <span className={`caret inline-block transition-all ${(isUniBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Unidirectional Streams
        </h3>
        {(isUniBlockOpen) && (
          <form className="mb-2">
            <button>Create</button>
          </form>
        )}
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
