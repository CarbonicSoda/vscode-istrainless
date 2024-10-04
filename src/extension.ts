import * as vscode from "vscode";

let statusBarItem: vscode.StatusBarItem;
let active: boolean;

export async function activate() {
	active = true;

	vscode.commands.registerCommand("istrainless.setBreakTimeout", async () => {
		const input = await vscode.window.showInputBox({
			title: "IstrainLess Break Timeout",
			prompt: "Enter New Break Timeout in Minutes",
			validateInput: (input) => {
				const num = parseFloat(input);
				if (isNaN(num)) return "Invalid Timeout";
				if (num < 1) return "Timeout Too Short";
			},
		});
		if (!input) return;
		const config = vscode.workspace.getConfiguration("istrainless");
		config.update("breakTimeout", parseFloat(input), true);
	});
	vscode.commands.registerCommand("istrainless.setBreakDuration", async () => {
		const input = await vscode.window.showInputBox({
			title: "IstrainLess Break Duration",
			prompt: "Enter New Break Duration in Minutes",
			validateInput: (input) => {
				const num = parseFloat(input);
				if (isNaN(num)) return "Invalid Duration";
				if (num < 0.25) return "Duration Too Short";
			},
		});
		if (!input) return;
		const config = vscode.workspace.getConfiguration("istrainless");
		config.update("breakDuration", parseFloat(input), true);
	});

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
	statusBarItem.name = "IstrainLess";
	statusBarItem.show();

	mainLoop();
}

async function mainLoop() {
	while (active) {
		const config = vscode.workspace.getConfiguration("istrainless");
		const breakTimeout: number = config.get("breakTimeout");
		const breakDuration: number = config.get("breakDuration");

		let timeLeft = breakTimeout * 60;
		const updateStatusBarItem = async () => {
			let time = await getTime(timeLeft--);
			statusBarItem.text = `$(watch) ${time}`;
			statusBarItem.tooltip = `${time} Until Next Break`;
			statusBarItem.backgroundColor =
				timeLeft < 60 ? new vscode.ThemeColor("statusBarItem.warningBackground") : null;
		};
		statusBarItem.color = null;
		await updateStatusBarItem();
		const timeElapse = setInterval(updateStatusBarItem, 1e3);

		await sleep(breakTimeout * 6e4);
		clearInterval(timeElapse);
		statusBarItem.text = statusBarItem.tooltip = "On Break";
		statusBarItem.color = new vscode.ThemeColor("statusBarItem.warningForeground");
		statusBarItem.backgroundColor = null;

		await startBreakSession(breakDuration);
	}
}

async function startBreakSession(duration: number) {
	const quotes = [
		"Peek Outside the Window for Some Shaft of Light!",
		"Take the Time to Do Some Stretching~",
		"Good Time to Wash Your Face!",
		"Touch Some Grass!",
	];

	const panel = vscode.window.createWebviewPanel("istrainless.break", "IstrainLess", vscode.ViewColumn.One, {
		enableScripts: true,
		retainContextWhenHidden: true,
	});
	panel.webview.html = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>IstrainLess</title>
		<style>
			html, body {
				height: 100%;
				width: auto;
			}
			#main {
				height: 100%;
				width: 100%;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
			}
			#quote {
				font-family: var(--vscode-editor-font-family);
				font-weight: var(--vscode-editor-font-weight);
				font-size: calc(var(--vscode-editor-font-size) * 1.3);
				color: var(--vscode-editor-foreground);
			}
			@keyframes timeout {
				from {width: 80%;}
				to {width: 0;}
			}
			#timeout-bar {
				height: 4%;
				border-radius: 3px;
				background-color: var(--vscode-editor-foreground);
				animation: timeout ${duration * 60}s linear;
			}
			#timeout {
				font-family: var(--vscode-editor-font-family);
				font-weight: var(--vscode-editor-font-weight);
				font-size: var(--vscode-editor-font-size);
				color: var(--vscode-editor-foreground);
			}
		</style>
		<script>
			${getTime}
		</script>
	</head>
	<body>
		<div id="main">
			<h1 id="quote">${quotes[Math.trunc(quotes.length * Math.random())]}</h1>
			<div id="timeout-bar"></div>
			<p id="timeout">--:--</p>
		</div>
	</body>
	<script>
		let timeLeft = ${Math.round(duration * 60)};
		const timeout = document.getElementById("timeout");
		const countdown = setInterval(async () => timeout.textContent = await getTime(timeLeft--), 1e3);
		setTimeout(async () => clearInterval(countdown), ${duration * 6e4});
		(async () => timeout.textContent = await getTime(timeLeft--))();
	</script>
	</html>`;

	const forceReveal = panel.onDidChangeViewState(async () => panel.reveal(vscode.ViewColumn.One));
	await sleep(duration * 6e4);
	forceReveal.dispose();
	panel.dispose();
}

export async function deactivate() {
	active = false;
	statusBarItem?.dispose();
}

async function sleep(ms: number) {
	return await new Promise((res) => setTimeout(res, ms));
}

async function getTime(sec: number) {
	const m = Math.trunc(sec / 60);
	const s = Math.trunc(sec - m * 60);
	return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
