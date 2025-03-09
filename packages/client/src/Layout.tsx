import logo from './assets/webtransport-dummy-logo.png'

const linkClasses = "text-cyan-600 hover:text-cyan-500 hover:underline";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="max-w-6xl mx-auto">
			<header className="py-6 flex border-b mb-8 px-4">
				<a href="/">
					<img src={logo} width="120" alt="WebTransport Logo" />
				</a>
				<div className="my-auto ml-4">
					<h1 className="font-semibold text-3xl ">WebTransport in Node.js</h1>
					<p>Playground for experimenting with WebTransport in JavaScript | <a href="https://github.com/endel/webtransport-playground" className={linkClasses}>Fork it on GitHub</a>.</p>
				</div>
			</header>

			<main>
				<div className="px-4">
					{children}
				</div>
			</main>


			<footer>
				<hr className="border-t my-8" />
				<div className="px-4">
					<h3 className="font-semibold text-base mb-2">External references:</h3>
					<ul className="list ml-5 list-disc gap-1 flex flex-col">
						<li><a target="_blank" href="https://web.dev/webtransport/" className={linkClasses}><small className="rounded p-1 bg-cyan-600 text-white">Documentation</small> Using WebTransport <small>(web.dev)</small></a></li>
						<li><a target="_blank" href="https://www.w3.org/TR/webtransport/" className={linkClasses}><small className="rounded p-1 bg-cyan-600 text-white">Spec</small> W3C Working Draft <small>(w3c.org)</small></a></li>
						<li><a target="_blank" href="https://github.com/w3c/webtransport/issues/511" className={linkClasses}><small className="rounded p-1 bg-cyan-600 text-white">Thread</small> Node.js support for WebTransport <small>(github.com)</small></a></li>
					</ul>
				</div>

				<hr className="border-t my-8" />

				<div className="text-center">
					Made with ☕️ by <a href="https://github.com/endel" className={linkClasses}>Endel</a>
				</div>

			</footer>
		</div>
	)
}