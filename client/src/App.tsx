import { useEffect, useRef, useState } from 'react'
import CodeBlock from './CodeBlock';

// ←
// →

const ENDPOINT = `https://${window.location.hostname}:4433`;
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

interface Log {
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
}

type StreamType = "datagram" | "bidirectional" | "unidirectional";

const LOG_COLOR = {
  info: 'text-gray-900',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-300 text-green-800',
};

const initialCount = {
  datagram: 0,
  bidirectional: 0,
  unidirectional: 0,
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

  const [incomingCount, setIncomingCount] = useState(initialCount);
  const [isLogsScrollAtBottom, setIsLogsScrollAtBottom] = useState(true);

  const logsRef = useRef(null as HTMLDivElement | null);
  const transportRef = useRef(null as WebTransport | null);

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

  async function readData(dataReader: ReadableStreamDefaultReader<Uint8Array>, from: StreamType) {
    let isOpen = true;

    dataReader.closed
      .catch((e) => console.log("Failed to close", e.toString()))
      .finally(() => isOpen = false);

    while (isOpen) {
      try {
        const { done, value } = await dataReader.read();
        if (done) { break; }

        if (from === "datagram") {
          setIncomingCount((count) => ({ ...count, [from]: count[from] + 1 }));
        }

        appendLog({ message: `← (${from}): ${value}`, type: 'info' })
      } catch (e: any) {
        console.log("Failed to read...", e.toString());
        break;
      }
    }
  }

  async function readStream(readableStream: ReadableStream, streamType: StreamType) {
    const reader = readableStream.getReader();
    // reader.closed.catch(e => console.log(streamType, "closed", e.toString()));

    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }

      appendLog({ message: `← ${streamType} stream`, type: 'info' })
      setIncomingCount((count) => ({ ...count, [streamType]: count[streamType] + 1 }));

      const streamReadable = value.readable.getReader();
      streamReadable.closed.catch((e: any) => console.log(streamType, "closed", e.toString()));
      readData(streamReadable, streamType);

      // value is an instance of WebTransportBidirectionalStream
      console.log("Received stream", {
        readable: value.readable,
        writable: value.writable
      })
    }
  }

  function connect(abortController?: AbortController) {
    setIncomingCount(initialCount);

    let certificateHash: Uint8Array;
    let options: WebTransportOptions | undefined;

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

      }).finally(() => {
        // proceed only if not request aborted
        if (!abortController || !abortController.signal.aborted) {
          transportRef.current = new WebTransport(endpoint, options);
          setupWebTransport(transportRef.current);
        }
      });
  }

  async function setupWebTransport(transport: WebTransport) {
    transport.closed.then((_) => {
      appendLog({ message: 'WebTransport is closed', type: 'info' });
    }).catch((e) => {
      appendLog({ message: e.toString(), type: 'error' });
    }).finally(() => {
      setIsReady(false);
    });

    transport.ready.then(() => {
      setIsReady(true);
      appendLog({ message: 'WebTransport is ready', type: 'success' });

      const datagramReader = transport.datagrams.readable.getReader();
      readData(datagramReader, "datagram");

      // const bidi = transport.createBidirectionalStream();
      // bidi.then((stream) => {
      //   const reader = stream.readable.getReader();
      //   reader.closed.catch(e => console.log("bidi readable closed", e.toString()));
      //   const writer = stream.writable.getWriter();
      //   writer.closed.catch(e => console.log("bidi writable closed", e.toString()));
      // });
      // bidi.catch(() => console.log("Failed to create bidirectional stream"));

      readStream(transport.incomingBidirectionalStreams, "bidirectional");
      readStream(transport.incomingUnidirectionalStreams, "unidirectional");

    }).catch((e) => {
      appendLog({ message: e.toString(), type: 'error' });
    }).finally(() => {
      console.log("transport.ready.finally() ...");
    });
  }

  const onClickConnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    connect();
  };

  const onClickDisconnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      transportRef.current?.close({ closeCode: 0, reason: "all good" });
    } catch (e) {
      console.log("Error closing WebTransport", e);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    connect(abortController);

    return () => {
      if (transportRef.current) {
        transportRef.current.close()

      } else {
        abortController.abort();
      }
    };
  }, []);

  const onClickScrollToBottom = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const logsElement = logsRef.current;
    if (logsElement) {
      // only scroll to bottom if user is already at the bottom
      const isAtBottom = logsElement.scrollHeight - Math.ceil(logsElement.scrollTop) < logsElement.clientHeight + 40;
      if (isAtBottom) {
        logsElement.scrollTop = logsElement.scrollHeight;
      }
      setIsLogsScrollAtBottom(isAtBottom);
    }
  }, [logs]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex-grow">
        {/* <h2 className="font-semibold text-xl mb-2">API</h2> */}
        <form action="" className="mb-2">
          <div className="mb-2">
            <input placeholder="Endpoint" className="p-2 rounded bg-gray-100 border border-slate-300 disabled:cursor-not-allowed mr-1" type="text" name="endpoint" id="endpoint" value={endpoint} onChange={onEndpointChange} />
            {(isReady) ? (
              <button className="p-2 rounded bg-red-500 border border-red-800 hover:bg-red-600 hover:border-red-800 active:bg-red-900 text-white" onClick={onClickDisconnect}>Disconnect</button>
            ) : (
              <button className="p-2 rounded bg-green-500 border border-green-800 text-white" onClick={onClickConnect}>Connect</button>
            )}
          </div>

          <h2 className="font-semibold my-2 text-sm">Connecting with WebTransport</h2>
          <CodeBlock code={`const transport = new WebTransport("${endpoint}");`}></CodeBlock>

        </form>

        <h3 className="mt-4 font-semibold text-lg cursor-pointer" onClick={toggleOpenDatagram}>
          <span className={`caret inline-block transition-all ${(isDatagramBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Datagrams <small>({incomingCount["datagram"]})</small>
        </h3>

        {(isDatagramBlockOpen) && (
          <div className="mb-2 pl-4 border-l border-gray-200">
            <h2 className="font-semibold my-2 text-sm">Reading datagrams:</h2>
            <CodeBlock code={`const readableStream = transport.datagrams.readable.getReader();
readData(readableStream);

async function readData(reader) {
  reader.closed
    .catch((e) => console.log("Failed to close", e.toString()))
    .finally(() => isOpen = false);

  while (isOpen) {
    try {
      const { done, value } = await reader.read();
      if (done) { break; }

      console.log("Received:", value);
    } catch (e: any) {
      console.log("Failed to read...", e.toString());
      break;
    }
  }
}`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Writing datagrams:</h2>
            <CodeBlock code={`const writer = transport.datagrams.writable.getWriter();
writer.write(new Uint8Array([1, 2, 3]));`}></CodeBlock>
          </div>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenIncomingBidi}>
          <span className={`caret inline-block transition-all ${(isIncomingBidiBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Incoming Bidirectional Streams <small>({incomingCount["bidirectional"]})</small>
        </h3>
        {(isIncomingBidiBlockOpen) && (
          <div className="mb-2">

            <h2 className="font-semibold my-2 text-sm">Read incoming stream:</h2>
            <CodeBlock code={`const reader = transport.incomingBidirectionalStreams.getReader();
const { done, value } = await reader.read();`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Reading data from a bidirectional stream:</h2>
            <CodeBlock code={`const readableStream = value.readable.getReader();
readData(readableStream);`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Writing data into a bidirectional stream:</h2>
            <CodeBlock code={`const writer = value.writable.getWriter();
writer.write(new Uint8Array([1, 2, 3]));`}></CodeBlock>

          </div>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenIncomingUni}>
          <span className={`caret inline-block transition-all ${(isIncomingUniBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Incoming Unidirectional Streams <small>({incomingCount["unidirectional"]})</small>
        </h3>
        {(isIncomingUniBlockOpen) && (
          <div className="mb-2">

            <h2 className="font-semibold my-2 text-sm">Read incoming stream:</h2>
            <CodeBlock code={`const reader = transport.incomingUnidirectionalStreams.getReader();
const { done, value } = await reader.read();`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Reading data from a unidirectional stream:</h2>
            <CodeBlock code={`const readableStream = value.readable.getReader();
readData(readableStream);`}></CodeBlock>

          </div>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenBidi}>
          <span className={`caret inline-block transition-all ${(isBidiBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Bidirectional Streams
        </h3>
        {(isBidiBlockOpen) && (
          <div className="mb-2">

            <h2 className="font-semibold my-2 text-sm">Creating a bidirectional stream:</h2>
            <CodeBlock code={`const stream = await transport.createBidirectionalStream();`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Reading data from a bidirectional stream:</h2>
            <CodeBlock code={`const readableStream = stream.readable.getReader();
readData(readableStream);`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Writing data into a bidirectional stream:</h2>
            <CodeBlock code={`const writer = stream.writable.getWriter();
writer.write(new Uint8Array([1, 2, 3]));`}></CodeBlock>

          </div>
        )}

        <h3 className="font-semibold text-lg cursor-pointer" onClick={toggleOpenUni}>
          <span className={`caret inline-block transition-all ${(isUniBlockOpen) ? "rotate-90" : "rotate-0"} mr-1`}>▶</span>
          Unidirectional Streams
        </h3>
        {(isUniBlockOpen) && (
          <form className="mb-2">

            <h2 className="font-semibold my-2 text-sm">Creating a unidirectional stream:</h2>
            <CodeBlock code={`const stream = await transport.createBidirectionalStream();`}></CodeBlock>

            <h2 className="font-semibold my-2 text-sm mt-4">Writing data into a unidirectional stream:</h2>
            <CodeBlock code={`const writer = stream.writable.getWriter();
writer.write(new Uint8Array([1, 2, 3]));`}></CodeBlock>

          </form>
        )}
      </div>

      <div className="flex-grow">
        <h2 className="font-semibold text-xl mb-2">Logs</h2>

        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-900 relative">
          {(!isLogsScrollAtBottom) && (
            <button onClick={onClickScrollToBottom} className="absolute w-32 left-0 right-0 bottom-4 mx-auto text-center bg-blue-600 rounded-lg p-3 text-white text-xs">Scroll to bottom</button>
          )}
          <div ref={logsRef} className="overflow-y-auto overflow-x-none max-h-96">
            <pre><code>{
            logs.map((log, i) =>
              (
                <div key={i} className={`${LOG_COLOR[log.type]} rounded p-1`}>
                  {log.message}
                </div>
              )
            )
            }</code></pre>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
