import {
	ExtensionContext,
	MarkdownString,
	StatusBarAlignment,
	StatusBarItem,
	ThemeColor,
	ViewColumn,
	commands,
	window,
	workspace,
} from "vscode";

let enabled: boolean;
let statusBarItem: StatusBarItem;
const disposableIntervals: {
	updateTimer?: NodeJS.Timeout;
	timerCorrection?: NodeJS.Timeout;
} = {};

export async function activate(context: ExtensionContext): Promise<void> {
	registerCommands(context);
	enabled =
		(await window.showInformationMessage(
			`Enable IstrainLess?\n
			You can enable IstrainLess by clicking on the status bar item later.`,
			"Yes",
			"No",
		)) === "Yes";

	await commands.executeCommand("workbench.action.showMultipleEditorTabs");
	createStatusBarItem(context);
	if (enabled) main();
}

export function deactivate(): void {
	enabled = false;
	clearInterval(disposableIntervals.updateTimer);
	clearInterval(disposableIntervals.timerCorrection);
}

async function main(): Promise<void> {
	statusBarItem.text = "";
	statusBarItem.command = undefined;
	commands.executeCommand("setContext", "istrainless.enabled", true);

	let configs = workspace.getConfiguration("istrainless");
	workspace.onDidChangeConfiguration((ev) => {
		if (ev.affectsConfiguration("istrainless")) {
			configs = workspace.getConfiguration("istrainless");
		}
	});

	while (enabled) {
		const minibreakTimeout: number = configs.get("minibreakTimeout");
		let breakTimeout: number = configs.get("breakTimeout");
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
		disposableIntervals.updateTimer = setInterval(updateTimer, 1e3);
		disposableIntervals.timerCorrection = setInterval(timerCorrection, 3e4);

		await setTimedInterval(
			breakTimeout * 6e4,
			async () => {
				clearInterval(disposableIntervals.updateTimer);
				clearInterval(disposableIntervals.timerCorrection);

				statusBarItem.text = statusBarItem.tooltip = "On Minibreak";
				await breakSession(configs.get("minibreakDuration"));

				timeTillMinibreak = minibreakTimeout * 60;
				miniTime30elapsed = 0;
				statusBarItem.color = null;
				updateTimer();
				disposableIntervals.updateTimer = setInterval(updateTimer, 1e3);
				disposableIntervals.timerCorrection = setInterval(timerCorrection, 3e4);
			},
			minibreakTimeout * 6e4,
			{
				cleanup: () => (nextIsMinibreak = false),
			},
		);

		clearInterval(disposableIntervals.updateTimer);
		clearInterval(disposableIntervals.timerCorrection);
		statusBarItem.text = statusBarItem.tooltip = "On Break";
		statusBarItem.color = new ThemeColor("statusBarItem.warningForeground");
		await breakSession(configs.get("breakDuration"));
	}
}

async function breakSession(duration: number): Promise<void> {
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
	const breakSec = duration * 60;
	const breakMs = breakSec * 1e3;

	const panel = window.createWebviewPanel("istrainless.break", "IstrainLess", ViewColumn.One, {
		enableScripts: true,
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
				animation: timeout ${breakSec}s linear;
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
		const sec = ${Math.round(breakSec)};

		let timeLeft = sec;
		let time30elapsed = 0;
		timeout.textContent = getFormattedTime(timeLeft--);
		setInterval(() => (timeout.textContent = getFormattedTime(timeLeft--)), 1e3);
		setInterval(() => (timeLeft = sec - 30 * ++time30elapsed - 1), 3e4);
	</script>
	</html>`;

	commands.executeCommand("workbench.action.hideEditorTabs");
	await new Promise<void>(async (res) => {
		const dispose = () => {
			forceReveal.dispose();
			forceOpen.dispose();
		};
		const penalty = () => {
			dispose();
			res(breakSession(duration));
		};
		const forceReveal = panel.onDidChangeViewState(penalty);
		const forceOpen = panel.onDidDispose(penalty);

		await sleep(breakMs);
		dispose();
		res();
	});

	panel.dispose();
	await commands.executeCommand("workbench.action.showMultipleEditorTabs");
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
			getTimeCommandFactory("Minibreak Timeout", { min: 5, max: 90 }, true, "minibreakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setMinibreakDuration",
			getTimeCommandFactory("Minibreak Duration", { min: 0.25, max: 60 }, false, "minibreakDuration"),
		),
		commands.registerCommand(
			"istrainless.setBreakTimeout",
			getTimeCommandFactory("Break Timeout", { min: 15, max: 150 }, true, "breakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setBreakDuration",
			getTimeCommandFactory("Minibreak Timeout", { min: 1, max: 30 }, false, "breakDuration"),
		),
	);
}

function getTimeCommandFactory(
	name: string,
	options: { min: number; max: number },
	isTimeout: boolean,
	configName: string,
): () => Promise<void> {
	const validateInput = (input: string) => {
		const num = parseFloat(input);
		if (isNaN(num)) return `Invalid ${name}`;
		const rangePrompt = `Value should be between ${options.min} and ${options.max}`;
		if (num < options.min) {
			return `${name} too short. ${
				isTimeout ? "Counterproductive" : "Eyestrain"
			} alert! ${rangePrompt}`;
		}
		if (num > options.max) {
			return `${name} too long. ${
				isTimeout ? "Eyestrain" : "Counterproductive"
			} alert! ${rangePrompt}`;
		}
	};
	return async () => {
		const input = await window.showInputBox({
			title: `IstrainLess: ${name}`,
			prompt: `Enter New ${name} in Minutes`,
			validateInput: validateInput,
		});
		if (!input) return;
		const config = workspace.getConfiguration("istrainless");
		await config.update(configName, parseFloat(input), true);
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
