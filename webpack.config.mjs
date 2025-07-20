//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

import path from "path";
import TerserPlugin from "terser-webpack-plugin";

/** @type WebpackConfig */
const config = {
	target: "node",
	entry: "./src/extension.ts",
	output: {
		path: path.resolve(import.meta.dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	devtool: "source-map",
	externals: { vscode: "commonjs vscode" },
	resolve: { extensions: [".ts", ".js"] },
	module: {
		rules: [{ test: /\.ts$/, exclude: /node_modules/, use: [{ loader: "ts-loader" }] }],
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				terserOptions: { compress: { passes: 3 } },
				extractComments: false,
			}),
		],
	},
};

/** @type WebpackConfig */
const browserConfig = {
	mode: "none",
	target: "webworker",
	entry: { "web-extension": "./src/extension.ts" },
	output: {
		filename: "[name].js",
		path: path.join(import.meta.dirname, "./dist"),
		libraryTarget: "commonjs",
	},
	resolve: { mainFields: ["module", "main"], extensions: [".ts", ".js", ".mjs"] },
	module: {
		rules: [{ test: /\.ts$/, exclude: /node_modules/, use: [{ loader: "ts-loader" }] }],
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				terserOptions: { compress: { passes: 3 } },
				extractComments: false,
			}),
		],
	},
	externals: { vscode: "commonjs vscode" },
	performance: { hints: false },
	devtool: "source-map",
};

export default [config, browserConfig];
