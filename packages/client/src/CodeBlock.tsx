import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import * as styles  from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('javascript', js);

export default function CodeBlock ({ code }: { code: string }) {
  return (
		<div className="text-xs bg-gray-50 rounded p-2">
			<SyntaxHighlighter language="javascript" style={styles.a11yLight}>
				{code}
			</SyntaxHighlighter>
		</div>
  );
};