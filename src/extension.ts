import {
	ExtensionContext,
	MarkdownString,
	StatusBarAlignment,
	StatusBarItem,
	ThemeColor,
	ViewColumn,
	WebviewPanel,
	commands,
	window,
	workspace,
} from "vscode";

let configs = workspace.getConfiguration("istrainless");
workspace.onDidChangeConfiguration((ev) => {
	if (ev.affectsConfiguration("istrainless")) {
		configs = workspace.getConfiguration("istrainless");
	}
});

let enabled: boolean;
let statusBarItem: StatusBarItem;
const disposables: {
	sessionPanel?: WebviewPanel;
	updateTimer?: NodeJS.Timeout;
	timerCorrection?: NodeJS.Timeout;
} = {};

export async function activate(context: ExtensionContext): Promise<void> {
	registerCommands(context);
	await commands.executeCommand("workbench.action.showMultipleEditorTabs");

	enabled =
		!configs.get("confirmOnStartup") ||
		(await window.showInformationMessage(
			`Enable IstrainLess?\n
			You can enable IstrainLess by clicking on the status bar item later.`,
			"Yes",
			"No",
		)) === "Yes";

	createStatusBarItem(context);
	if (enabled) main();
}

export function deactivate(): void {
	enabled = false;
	disposables.sessionPanel.dispose();
	clearInterval(disposables.updateTimer);
	clearInterval(disposables.timerCorrection);
}

async function main(): Promise<void> {
	statusBarItem.text = "";
	statusBarItem.command = undefined;
	commands.executeCommand("setContext", "istrainless.enabled", true);

	while (enabled) {
		const minibreakTimeout = <number>configs.get("minibreakTimeout");
		let breakTimeout = <number>configs.get("breakTimeout");
		if (breakTimeout < minibreakTimeout) {
			breakTimeout = minibreakTimeout;
		}

		let timeTillMinibreak = minibreakTimeout * 60;
		let timeTillBreak = breakTimeout * 60;
		let miniTime30elapsed = 0;
		let time30elapsed = 0;
		let nextIsMinibreak = Math.round(breakTimeout / minibreakTimeout) > 1;

		const updateTimer = () => {
			const [minibreakTime, breakTime] = [timeTillMinibreak--, timeTillBreak--];
			const breakType = nextIsMinibreak ? "Minibreak" : "Break";
			const timeLeft = nextIsMinibreak ? minibreakTime : breakTime;

			statusBarItem.text = `$(watch) ${breakType} ${getFormattedTime(timeLeft)}`;
			statusBarItem.tooltip = new MarkdownString(
				`Next Minibreak:  \n**${
					nextIsMinibreak ? getFormattedTime(minibreakTime) : "--:--"
				}**\n\nNext Break:  \n**${getFormattedTime(breakTime)}**`,
			);
			statusBarItem.color = timeLeft < 60 ? new ThemeColor("statusBarItem.warningForeground") : null;
		};
		const timerCorrection = () => {
			miniTime30elapsed++;
			time30elapsed++;
			timeTillMinibreak = minibreakTimeout * 60 - 30 * miniTime30elapsed;
			timeTillBreak = breakTimeout * 60 - 30 * time30elapsed;
		};
		statusBarItem.color = null;
		updateTimer();
		disposables.updateTimer = setInterval(updateTimer, 1000);
		disposables.timerCorrection = setInterval(timerCorrection, 30000);

		await setTimedInterval(
			breakTimeout * 60000,
			async () => {
				clearInterval(disposables.updateTimer);
				clearInterval(disposables.timerCorrection);

				statusBarItem.text = statusBarItem.tooltip = "On Minibreak";
				await breakSession(<number>configs.get("minibreakDuration"));

				timeTillMinibreak = minibreakTimeout * 60;
				miniTime30elapsed = 0;
				statusBarItem.color = null;
				updateTimer();
				disposables.updateTimer = setInterval(updateTimer, 1000);
				disposables.timerCorrection = setInterval(timerCorrection, 30000);
			},
			minibreakTimeout * 60000,
			{
				cleanup: () => (nextIsMinibreak = false),
			},
		);

		clearInterval(disposables.updateTimer);
		clearInterval(disposables.timerCorrection);
		statusBarItem.text = statusBarItem.tooltip = "On Break";
		statusBarItem.color = new ThemeColor("statusBarItem.warningForeground");
		await breakSession(<number>configs.get("breakDuration"));
	}
}

async function breakSession(seconds: number): Promise<void> {
	const quotes = [
		"Closing your eyes allows you to see the world more clearly.",
		"Gaze into the distance, let your eyes relax and wander. This far-off focus will ease the strain.",
		"Gaze not too long into the brightness, lest your eyes be blinded. Rest them upon gentler things, that they may behold the beauty all around with clarity and wonder.",
		"In the stillness of closing the eyes, the soul finds the freedom to soar.",
		"Let your eyes wander and feast upon the world, but remember to give them moments of tranquil rest, for the eyes grow weary from constantly seeking.",
		"Rest your eyes, let them wander and explore the world at their own pace.",
		"Rest your eyes, they work hard all day.",
		"The best way to rest your eyes is to let them gaze upon something beautiful.",
		"When your eyes feel tired, lift your gaze and let it drift to the horizon. This long-distance view will soothe and restore them.",
		"Your eyes are the most precious jewels you will ever own.",
	];

	const panel = window.createWebviewPanel("istrainless.break", "IstrainLess", ViewColumn.One, {
		enableScripts: true,
	});
	disposables.sessionPanel = panel;
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
				width: 85%;
				padding-bottom: 2.5%;
				font-family: var(--vscode-editor-font-family);
				font-weight: var(--vscode-editor-font-weight);
				font-size: calc(var(--vscode-editor-font-size) * 1.3);
				text-align: center;
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
				animation: timeout ${seconds}s linear;
			}
			#timeout {
				font-family: var(--vscode-editor-font-family);
				font-weight: var(--vscode-editor-font-weight);
				font-size: var(--vscode-editor-font-size);
				color: var(--vscode-editor-foreground);
			}
		</style>
	</head>
	<body>
		<div id="main">
			<h1 id="quote">${quotes[Math.trunc(quotes.length * Math.random())]}</h1>
			<div id="timeout-bar"></div>
			<p id="timeout">--:--</p>
		</div>
	</body>
	<script>
		const getFormattedTime = ${getFormattedTime};

		const timeout = document.getElementById("timeout");
		const sec = ${Math.round(seconds)};

		let timeLeft = sec;
		let time30elapsed = 0;
		timeout.textContent = getFormattedTime(timeLeft--);
		setInterval(() => (timeout.textContent = getFormattedTime(timeLeft--)), 1000);
		setInterval(() => (timeLeft = sec - 30 * ++time30elapsed - 1), 30000);
	</script>
	</html>`;

	const allowEscape = <boolean>configs.get("allowEscape");
	if (!allowEscape) commands.executeCommand("workbench.action.hideEditorTabs");

	await new Promise<void>(async (res) => {
		const dispose = () => {
			forceReveal.dispose();
			forceOpen.dispose();
		};

		const onEscapeAttempt = allowEscape
			? () => {
					dispose();
					res();
			  }
			: () => {
					dispose();
					res(breakSession(seconds));
			  };
		const forceReveal = panel.onDidChangeViewState(onEscapeAttempt);
		const forceOpen = panel.onDidDispose(onEscapeAttempt);

		await sleep(seconds * 1000);
		dispose();
		res();
	});

	panel.dispose();
	if (!allowEscape) commands.executeCommand("workbench.action.showMultipleEditorTabs");
	return;
}

function registerCommands(context: ExtensionContext): void {
	context.subscriptions.push(
		commands.registerCommand("istrainless.enable", () => {
			enabled = true;
			main();
		}),
		commands.registerCommand(
			"istrainless.setMinibreakTimeout",
			getTimeCommandFactory("Minibreak Timeout", { rec: 20, min: 10, max: 60 }, true, "minibreakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setMinibreakDuration",
			getTimeCommandFactory("Minibreak Duration", { rec: 20, min: 10, max: 60 }, false, "minibreakDuration"),
		),
		commands.registerCommand(
			"istrainless.setBreakTimeout",
			getTimeCommandFactory("Break Timeout", { rec: 60, min: 30, max: 180 }, true, "breakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setBreakDuration",
			getTimeCommandFactory("Break Duration", { rec: 60, min: 30, max: 180 }, false, "breakDuration"),
		),
	);
}

function getTimeCommandFactory(
	name: string,
	options: { rec: number; min: number; max: number },
	isTimeout: boolean,
	configName: string,
): () => Promise<void> {
	const rangePrompt = `Value should be between ${options.min} and ${options.max} (default ${options.rec})`;

	const validateInput = (input: string) => {
		const num = parseFloat(input);
		if (isNaN(num)) return `Invalid ${name}`;
		if (num < options.min) {
			return `${name} too short. ${rangePrompt}`;
		}
		if (num > options.max) {
			return `${name} too long. ${rangePrompt}`;
		}
	};

	return async () => {
		const input = await window.showInputBox({
			title: `IstrainLess: ${name}`,
			prompt: `Enter New ${name} in ${isTimeout ? "Minutes" : "Seconds"}`,
			validateInput,
		});
		if (!input) return;
		configs.update(configName, parseFloat(input), true);
	};
}

function createStatusBarItem(context: ExtensionContext): void {
	statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, -1);
	context.subscriptions.push(statusBarItem);

	statusBarItem.name = "IstrainLess Timer";
	statusBarItem.text = "Enable IstrainLess";
	statusBarItem.command = "istrainless.enable";
	statusBarItem.show();
}

async function sleep(ms: number): Promise<void> {
	return await new Promise((res) => setTimeout(res, ms));
}

async function setTimedInterval(
	timeout: number,
	callback: () => any,
	ms: number,
	options?: { cleanup?: () => any },
): Promise<void> {
	let rep = Math.round(timeout / ms) - 1;
	if (rep < 0) rep = 0;
	for (let i = 0; i < rep; i++) {
		await sleep(ms);
		await callback();
	}
	await options?.cleanup?.();
	await sleep(timeout - ms * rep);
}

function getFormattedTime(sec: number): string {
	const m = Math.trunc(sec / 60);
	const s = Math.trunc(sec - m * 60);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
