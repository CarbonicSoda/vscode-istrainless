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

let breakTimerItem: StatusBarItem;
let breakLoopEnabled: boolean;

export async function activate(context: ExtensionContext): Promise<void> {
	breakLoopEnabled = true;
	registerCommands(context);
	createBreakTimerItem();
	mainLoop();
}

export async function deactivate(): Promise<void> {
	breakLoopEnabled = false;
	breakTimerItem?.dispose();
	breakTimerItem = null;
}

async function registerCommands(context: ExtensionContext): Promise<void> {
	context.subscriptions.push(
		commands.registerCommand(
			"istrainless.setMinibreakTimeout",
			await getTimeFactory("Minibreak Timeout", { min: 5, max: 90 }, true, "minibreakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setMinibreakDuration",
			await getTimeFactory("Minibreak Duration", { min: 0.25, max: 60 }, false, "minibreakDuration"),
		),
		commands.registerCommand(
			"istrainless.setBreakTimeout",
			await getTimeFactory("Break Timeout", { min: 15, max: 150 }, true, "breakTimeout"),
		),
		commands.registerCommand(
			"istrainless.setBreakDuration",
			await getTimeFactory("Minibreak Timeout", { min: 5, max: 120 }, false, "breakDuration"),
		),
	);
}

async function createBreakTimerItem(): Promise<void> {
	breakTimerItem?.dispose();
	breakTimerItem = window.createStatusBarItem(StatusBarAlignment.Right, -1);
	breakTimerItem.name = "IstrainLess Timer";
	breakTimerItem.show();
}

async function mainLoop(): Promise<void> {
	let config = workspace.getConfiguration("istrainless");
	workspace.onDidChangeConfiguration(async (ev) => {
		if (ev.affectsConfiguration("istrainless")) config = workspace.getConfiguration("istrainless");
	});
	while (breakLoopEnabled) {
		const minibreakTimeout: number = config.get("minibreakTimeout");
		let breakTimeout: number = config.get("breakTimeout");
		if (breakTimeout < minibreakTimeout) breakTimeout = minibreakTimeout;

		let timeTillMinibreak = minibreakTimeout * 60;
		let timeTillBreak = breakTimeout * 60;
		let timer30 = 0;
		let nextIsMinibreak = Math.round(breakTimeout / minibreakTimeout) > 1;

		const updateBreakTimer = async () => {
			const [minibreakTime, breakTime] = [timeTillMinibreak--, timeTillBreak--];
			const breakType = nextIsMinibreak ? "Minibreak" : "Break";
			const timeLeft = nextIsMinibreak ? minibreakTime : breakTime;

			breakTimerItem.text = `$(watch) ${breakType} ${await getTime(timeLeft)}`;
			breakTimerItem.tooltip = new MarkdownString(
				`Next Minibreak:  \n**${
					nextIsMinibreak ? await getTime(minibreakTime) : "--:--"
				}**\n\nNext Break:  \n**${await getTime(breakTime)}**`,
			);
			breakTimerItem.backgroundColor = timeLeft < 60 ? new ThemeColor("statusBarItem.warningBackground") : null;
		};
		const timerCorrection = async () => {
			timer30++;
			timeTillMinibreak = minibreakTimeout * 60 - 30 * timer30 - 1;
			timeTillBreak = breakTimeout * 60 - 30 * timer30 - 1;
		};
		breakTimerItem.color = null;
		await updateBreakTimer();
		let updateTimerInterval = setInterval(updateBreakTimer, 1e3);
		let timerCorrectionInterval = setInterval(timerCorrection, 3e4);

		await setTimedInterval(
			breakTimeout * 6e4,
			async () => {
				clearInterval(updateTimerInterval);
				clearInterval(timerCorrectionInterval);

				breakTimerItem.text = breakTimerItem.tooltip = "On Minibreak";
				breakTimerItem.color = new ThemeColor("statusBarItem.warningForeground");
				breakTimerItem.backgroundColor = null;
				await startBreakSession(config.get("minibreakDuration"));

				timeTillMinibreak = minibreakTimeout * 60;
				await updateBreakTimer();
				updateTimerInterval = setInterval(updateBreakTimer, 1e3);
				timerCorrectionInterval = setInterval(timerCorrection, 3e4);
			},
			minibreakTimeout * 6e4,
			{
				cleanup: async () => (nextIsMinibreak = false),
			},
		);

		clearInterval(updateTimerInterval);
		clearInterval(timerCorrectionInterval);
		breakTimerItem.text = breakTimerItem.tooltip = "On Break";
		breakTimerItem.color = new ThemeColor("statusBarItem.warningForeground");
		breakTimerItem.backgroundColor = null;
		await startBreakSession(config.get("breakDuration"));
	}
}

async function getTimeFactory(
	name: string,
	options: { min: number; max: number },
	isTimeout: boolean,
	configName: string,
): Promise<() => Promise<void>> {
	const validateInput = (input: string) => {
		const num = parseFloat(input);
		if (isNaN(num)) return `Invalid ${name}`;
		if (num < options.min) return `${name} Too Short. ${isTimeout ? "Counterproductive" : "Eyestrain"} alert!`;
		if (num > options.max) return `${name} Too Long. ${isTimeout ? "Eyestrain" : "Counterproductive"} alert!`;
	};
	return async () => {
		const input = await window.showInputBox({
			title: `IstrainLess: ${name}`,
			prompt: `Enter New ${name} in Minutes`,
			validateInput: validateInput,
		});
		if (!input) return;
		const config = workspace.getConfiguration("istrainless");
		config.update(configName, parseFloat(input), true);
	};
}

async function startBreakSession(duration: number): Promise<void> {
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
		const sec = ${Math.round(breakSec)};
		let timeLeft = sec;
		let timer30 = 0;
		const timeout = document.getElementById("timeout");
		(async () => (timeout.textContent = await getTime(timeLeft--)))();
		setInterval(async () => (timeout.textContent = await getTime(timeLeft--)), 1e3);
		setInterval(async () => (timeLeft = sec - 30 * ++timer30 - 1), 3e4);
	</script>
	</html>`;

	const forceReveal = panel.onDidChangeViewState(async () => panel.reveal(ViewColumn.One));
	await sleep(breakMs);
	forceReveal.dispose();
	panel.dispose();
}

async function sleep(ms: number): Promise<null> {
	return await new Promise((res) => setTimeout(async () => res(null), ms));
}

async function setTimedInterval(
	timeout: number,
	callback: () => Promise<any>,
	ms: number,
	options?: { cleanup?: () => Promise<any> },
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

async function getTime(sec: number): Promise<string> {
	const m = Math.trunc(sec / 60);
	const s = Math.trunc(sec - m * 60);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
