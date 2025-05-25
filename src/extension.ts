import {
	ExtensionContext,
	StatusBarAlignment,
	StatusBarItem,
	ViewColumn,
	window,
} from "vscode";

export function activate(context: ExtensionContext): void {
	const hint = window.createStatusBarItem(StatusBarAlignment.Right, -1);
	context.subscriptions.push(hint);

	hint.name = "IstrainLess";
	hint.show();

	main(hint);
}

async function main(hint: StatusBarItem, progress = 0): Promise<void> {
	const timeout = 25 * 60;

	const start = Date.now();
	const tick = () => {
		const now = Date.now();
		const delta = now - start;

		const next = new Date(timeout * 1000 - delta).toJSON().slice(14, -5);
		hint.text = `$(watch) Next ${next}`;
	};
	const update = setInterval(tick, 500);

	await new Promise((res) => setTimeout(res, timeout * 1000));

	clearInterval(update);
	hint.text = "On Break";

	const duration = progress !== 2 ? 5 * 60 : 25 * 60;
	await pomodori(duration);

	main(hint, ++progress % 3);
}

async function pomodori(duration: number): Promise<void> {
	const quotes = [
		"Closing your eyes allows you to see the world more clearly.",
		"To rest your eyes is to let them gaze upon something beautiful.",
		"Rest your eyes, let them wander and explore the world at their own pace.",
		"In the stillness of closing the eyes, the soul finds the freedom to soar.",
		"Rest your eyes upon gentleness, so as to behold beauty with clarity and wonder.",
		"Let your eyes feast upon the world, give them moments of tranquil rest from constant seeking.",
	];

	const panel = window.createWebviewPanel(
		"Pomodori",
		"IstrainLess",
		ViewColumn.One,
		{ enableScripts: true },
	);

	// minified from ./pomodoro.html
	panel.webview.html = `<!DOCTYPE html><html><head><style>html,body{height:100%}body{color:var(--vscode-editor-foreground);font:var(--vscode-editor-font-weight)calc(var(--vscode-editor-font-size)*1.5)var(--vscode-editor-font-family);flex-direction:column;justify-content:center;align-items:center;display:flex}@keyframes elapse{0%{width:85%}to{width:0}}#bar{background-color:var(--vscode-editor-foreground);border-radius:.5rem;height:1.5rem;margin-block:1.5rem;animation:${
		duration - 1
	}s linear elapse}</style></head><body><p style="max-width:85%">${
		quotes[~~(quotes.length * Math.random())]
	}</p><div id="bar"></div><p id="time"></p><script>const t=document.getElementById("time"),e=Date.now(),n=()=>{const n=Date.now()-e;t.textContent=new Date(${
		duration * 1000
	}-n).toJSON().slice(14,-5)};n();setInterval(n,500)</script></body></html>`;

	await new Promise<void>(async (res) => {
		const dispose = () => {
			reopen.dispose();
			reveal.dispose();
			panel.dispose();
		};

		const onEscape = () => {
			dispose();
			res(pomodori(duration));
		};
		const reopen = panel.onDidDispose(onEscape);
		const reveal = panel.onDidChangeViewState(onEscape);

		await new Promise((res) => setTimeout(res, duration * 1000));

		dispose();
		res();
	});
}

export function deactivate(): void {}
