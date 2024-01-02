import logo from './assets/webtransport-dummy-logo.png'

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="max-w-6xl mx-auto">
			<header className="py-6 flex border-b mb-8 px-4">
				<a href="/">
					<img src={logo} width="120" alt="WebTransport Logo" />
				</a>
				<h1 className="font-semibold text-3xl my-auto ml-4">WebTransport Playground</h1>
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