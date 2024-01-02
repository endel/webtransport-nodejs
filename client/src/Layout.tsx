import logo from './assets/webtransport-dummy-logo.png'

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="max-w-6xl mx-auto">
			<header className="py-6 flex border-b mb-8 px-4">
				<a href="/">
					<img src={logo} width="120" alt="WebTransport Logo" />
				</a>
				<div className="my-auto ml-4">
					<h1 className="font-semibold text-3xl ">WebTransport in Node.js</h1>
					<p>Playground for experimenting with WebTransport in JavaScript | <a href="https://github.com/endel/webtransport-playground" className="underline text-gray-800 hover:text-gray-500">Fork it on GitHub</a>.</p>
				</div>
			</header>

			<main>
				<div className="px-4">
					{children}
				</div>
			</main>

			<footer className="border-t mt-8 py-6">
				<div className="px-4">
					<h3 className="font-semibold text-xl mb-2">External references:</h3>
					<ul className="list">
						<li><a href="https://web.dev/webtransport/">Using WebTransport <small>(web.dev)</small></a></li>
						<li><a href="https://www.w3.org/TR/webtransport/">W3C Working Draft <small>(w3c.org)</small></a></li>
					</ul>
				</div>
			</footer>
		</div>
	)
}