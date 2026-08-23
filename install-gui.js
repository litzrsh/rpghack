#!/usr/bin/env node
"use strict";

// Zero-dependency, browser-based GUI installer for the CheatEngine plugins.
// Serves a single-page app (index.html) over a small local HTTP server and
// performs the same job install.js does (copy plugin files, register them in
// the target game's plugins.js), but with live engine detection, a scanned
// list of game-specific "custom cheats", and step-by-step progress streamed
// back to the browser as the install runs. Also exposes a matching
// /api/uninstall endpoint that reverts an install: restores plugins.js (from
// its .bak backup, or by stripping Cheat Engine entries directly if no
// backup exists) and deletes the plugin files from disk.
//
// Deliberately uses ONLY Node core modules (http, fs, path, child_process) --
// no npm packages, so it runs with nothing but a plain `node install-gui.js`.
//
// Usage: node install-gui.js
//   - Starts a local server (default port 3000, auto-falls back to the next
//     free port if that one is busy) and opens it in the default browser.
//   - Press Ctrl+C in the terminal to stop it; it also shuts itself down
//     automatically when the browser tab is closed (see /api/shutdown below).

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { exec } = require("child_process");

const ROOT_DIR = __dirname;
const CORE_PLUGINS_DIR = path.join(ROOT_DIR, "plugins");
const CUSTOM_CHEATS_DIR = path.join(ROOT_DIR, "custom_cheats");
const INDEX_HTML_PATH = path.join(ROOT_DIR, "index.html");

const CORE_PLUGIN_FILES = ["CheatEngine_Core.js", "CheatEngine_UI.js"];
const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;

// Custom cheat files live in custom_cheats/ and are named directly after the
// game's RJ product ID (e.g. "RJ258412.js" or "RJ258412.json"), NOT prefixed
// with "CheatEngine_" the way the bundled plugins/ files are -- this list is
// meant for cheats a user drops in for their own game, independent of what
// ships in plugins/.
const RJ_FILENAME_PATTERN = /^RJ[0-9A-Za-z]*\.(js|json)$/i;
const RJ_ID_PATTERN = /^RJ\d+$/i;
// Matches a plugins.js registry entry's "name" field (filename, no
// extension) for a custom RJ cheat -- looser than RJ_ID_PATTERN since a
// scanned custom_cheats/ file may carry letters after "RJ", not just digits.
const RJ_NAME_PATTERN = /^RJ[0-9A-Za-z]*$/i;

//-----------------------------------------------------------------------
// Small helpers
//-----------------------------------------------------------------------

function ensureCustomCheatsDir() {
    return fsp.mkdir(CUSTOM_CHEATS_DIR, { recursive: true });
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

// Reads and JSON-parses a request body, capping its size so a malformed or
// hostile request can't exhaust memory.
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        let tooLarge = false;
        req.on("data", (chunk) => {
            data += chunk;
            if (data.length > 1_000_000) {
                tooLarge = true;
                req.destroy();
            }
        });
        req.on("end", () => {
            if (tooLarge) return reject(new Error("Request body too large."));
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (err) {
                reject(new Error("Request body is not valid JSON."));
            }
        });
        req.on("error", reject);
    });
}

// Extracts the (English, default-locale) @plugindesc line from a plugin
// source file, used as the description shown in the RPG Maker Plugin Manager.
function extractDescription(filePath) {
    try {
        const src = fs.readFileSync(filePath, "utf8");
        const m = src.match(/@plugindesc\s+(.+)/);
        return m ? m[1].trim() : "";
    } catch (err) {
        return "";
    }
}

//-----------------------------------------------------------------------
// Engine detection
//-----------------------------------------------------------------------

// Figures out whether gameDir is an RPG Maker MV or MZ project, and where
// its plugins directory / plugins.js live.
//   - MV projects keep everything under a "www/" subfolder: www/js/plugins/
//   - MZ projects put js/ directly at the project root: js/plugins/
// Returns null if neither layout is found.
function detectEngine(gameDir) {
    const mvRoot = path.join(gameDir, "www");
    if (fs.existsSync(mvRoot) && fs.statSync(mvRoot).isDirectory()) {
        return {
            engine: "MV",
            pluginsDir: path.join(mvRoot, "js", "plugins"),
            pluginsJsPath: path.join(mvRoot, "js", "plugins.js")
        };
    }

    const mzPluginsDir = path.join(gameDir, "js", "plugins");
    if (fs.existsSync(mzPluginsDir) && fs.statSync(mzPluginsDir).isDirectory()) {
        return {
            engine: "MZ",
            pluginsDir: mzPluginsDir,
            pluginsJsPath: path.join(gameDir, "js", "plugins.js")
        };
    }

    return null;
}

//-----------------------------------------------------------------------
// plugins.js reading / writing
// (Same "var $plugins = [...]" format both MV and MZ use.)
//-----------------------------------------------------------------------

function readPluginsList(pluginsJsPath) {
    const raw = fs.readFileSync(pluginsJsPath, "utf8");
    const headerMatch = raw.match(/^([\s\S]*?)var\s+\$plugins\s*=/);
    const bodyMatch = raw.match(/var\s+\$plugins\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    if (!headerMatch || !bodyMatch) {
        throw new Error(
            `Could not parse plugins.js (expected a "var $plugins = [...]" declaration): ${pluginsJsPath}`
        );
    }
    let list;
    try {
        list = JSON.parse(bodyMatch[1]);
    } catch (err) {
        throw new Error(`Failed to parse the $plugins array as JSON: ${err.message}`);
    }
    return { list, header: headerMatch[1] };
}

function writePluginsList(pluginsJsPath, header, list) {
    const body = `[\n${list.map((p) => JSON.stringify(p)).join(",\n")}\n]`;
    fs.writeFileSync(pluginsJsPath, `${header}var $plugins =\n${body}\n;\n`, "utf8");
}

// Adds a plugin entry if it's missing, or just flips status back to true if
// it's already registered (but disabled). Never touches an existing entry's
// parameters/description, so a user's own configuration is preserved.
function upsertPluginEntry(list, name, description) {
    const existing = list.find((p) => p.name === name);
    if (existing) {
        if (existing.status === true) return "already-enabled";
        existing.status = true;
        return "enabled";
    }
    list.push({ name, status: true, description, parameters: {} });
    return "added";
}

//-----------------------------------------------------------------------
// Skeleton generator for a manually-typed RJ ID that has no scanned file yet
//-----------------------------------------------------------------------

function buildSkeletonCheatSource(rjId) {
    return `//=============================================================================
// ${rjId}.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] ${rjId} v1.0.0 - Game-specific cheat tab skeleton for ${rjId} (extends CheatEngine_UI.js).
 * @author rpghack
 * @base CheatEngine_Core
 * @base CheatEngine_UI
 * @orderAfter CheatEngine_Core
 * @orderAfter CheatEngine_UI
 * @url
 *
 * @help
 * ${rjId}.js
 * -----------------------------------------------------------------------------
 * Auto-generated skeleton, created by the GUI installer because no scanned
 * custom_cheats/ file matched this RJ ID. Fill in buildDescriptors() below
 * with this game's own hardcoded variable IDs / plugin commands, the same
 * way plugins/CheatEngine_RJ386773.js does it for its own game.
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (typeof RpgBridge === "undefined" || typeof CheatManager === "undefined" || !CheatManager) {
        console.error("${rjId}.js: CheatEngine_Core.js must be loaded first.");
        return;
    }
    if (typeof window.CheatEngineUI === "undefined" || typeof window.CheatEngineUI.registerTab !== "function") {
        console.error("${rjId}.js: CheatEngine_UI.js must be loaded first.");
        return;
    }

    // TODO: replace this placeholder with real descriptors for ${rjId}
    // (variable IDs, plugin commands, etc.). Use the same descriptor shape
    // as the rest of CheatEngine_UI.js: type is one of "number" | "boolean" |
    // "choice" | "action" | "info", each with a get() and (except "info")
    // a set() or action().
    function buildDescriptors() {
        return [
            { name: "TODO: add ${rjId}-specific cheats here", type: "info", get: () => "" }
        ];
    }

    window.CheatEngineUI.registerTab({
        name: "${rjId}",
        enabled: true,
        builder: buildDescriptors,
        columns: 1
    });
})();
`;
}

//-----------------------------------------------------------------------
// Streaming progress logger
// Writes newline-delimited "LOG:{...}" / "DONE:{...}" / "ERROR:{...}" chunks
// to a chunked HTTP response, so the browser can render install progress in
// real time via fetch()'s streaming ReadableStream body -- no SSE endpoint
// or WebSocket library needed.
//-----------------------------------------------------------------------

function createLogger(res) {
    let finished = false;
    return {
        log(message) {
            if (finished) return;
            res.write(`LOG:${JSON.stringify({ message })}\n`);
        },
        done(payload) {
            if (finished) return;
            finished = true;
            res.write(`DONE:${JSON.stringify(payload)}\n`);
            res.end();
        },
        fail(message) {
            if (finished) return;
            finished = true;
            res.write(`ERROR:${JSON.stringify({ message })}\n`);
            res.end();
        }
    };
}

//-----------------------------------------------------------------------
// GET /api/scan -- list custom_cheats/*.js|*.json files starting with "RJ"
//-----------------------------------------------------------------------

async function handleScan(req, res) {
    try {
        await ensureCustomCheatsDir();
        const entries = await fsp.readdir(CUSTOM_CHEATS_DIR);
        const files = entries.filter((name) => RJ_FILENAME_PATTERN.test(name)).sort();
        sendJson(res, 200, { files });
    } catch (err) {
        sendJson(res, 500, { error: `Failed to scan custom_cheats/: ${err.message}` });
    }
}

//-----------------------------------------------------------------------
// GET /api/detect?dir=... -- live engine-detection for the badge, with no
// side effects (used while the user is still typing the game folder path).
//-----------------------------------------------------------------------

function handleDetect(req, res, query) {
    const gameDirInput = query.get("dir") || "";
    if (!gameDirInput.trim()) {
        return sendJson(res, 200, { engine: null });
    }
    const gameDir = path.resolve(gameDirInput.trim());
    if (!fs.existsSync(gameDir) || !fs.statSync(gameDir).isDirectory()) {
        return sendJson(res, 200, { engine: null });
    }
    const detected = detectEngine(gameDir);
    sendJson(res, 200, { engine: detected ? detected.engine : null });
}

//-----------------------------------------------------------------------
// POST /api/inject -- the actual install
//-----------------------------------------------------------------------

async function handleInject(req, res) {
    const logger = createLogger(res);
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache"
    });

    try {
        const body = await readJsonBody(req);
        const gameDirInput = typeof body.gameDir === "string" ? body.gameDir.trim() : "";
        const selectedCheat = typeof body.selectedCheat === "string" ? body.selectedCheat.trim() : "";
        const manualRjId = typeof body.manualRjId === "string" ? body.manualRjId.trim() : "";
        const backupEnabled = !!body.backupEnabled;

        if (!gameDirInput) {
            return logger.fail("Please enter the target game folder path.");
        }
        const gameDir = path.resolve(gameDirInput);
        if (!fs.existsSync(gameDir) || !fs.statSync(gameDir).isDirectory()) {
            return logger.fail(`Folder not found: ${gameDir}`);
        }
        logger.log(`Target game folder: ${gameDir}`);

        const detected = detectEngine(gameDir);
        if (!detected) {
            return logger.fail(
                "Could not detect an RPG Maker MV or MZ project here (no www/ folder and no js/plugins/ folder found)."
            );
        }
        logger.log(`Engine detected: RPG Maker ${detected.engine}`);
        logger.log(`Plugins directory: ${detected.pluginsDir}`);

        if (!fs.existsSync(detected.pluginsJsPath)) {
            return logger.fail(`plugins.js not found: ${detected.pluginsJsPath}`);
        }

        // Resolve which custom cheat file (if any) to install, validating
        // any user-supplied filename/ID before it ever touches the
        // filesystem.
        let cheatFileName = null;
        let cheatSourcePath = null;
        let cheatIsGenerated = false;

        if (selectedCheat) {
            const isSafeName =
                RJ_FILENAME_PATTERN.test(selectedCheat) &&
                !selectedCheat.includes("/") &&
                !selectedCheat.includes("\\") &&
                !selectedCheat.includes("..");
            if (!isSafeName) {
                return logger.fail(`Invalid cheat file selection: ${selectedCheat}`);
            }
            const candidate = path.join(CUSTOM_CHEATS_DIR, selectedCheat);
            if (path.dirname(candidate) !== CUSTOM_CHEATS_DIR || !fs.existsSync(candidate)) {
                return logger.fail(`Selected cheat file was not found in custom_cheats/: ${selectedCheat}`);
            }
            cheatFileName = selectedCheat;
            cheatSourcePath = candidate;
            logger.log(`Using scanned cheat file: ${cheatFileName}`);
        } else if (manualRjId) {
            if (!RJ_ID_PATTERN.test(manualRjId)) {
                return logger.fail(`Invalid RJ ID (expected e.g. "RJ098765"): ${manualRjId}`);
            }
            cheatFileName = `${manualRjId}.js`;
            await ensureCustomCheatsDir();
            cheatSourcePath = path.join(CUSTOM_CHEATS_DIR, cheatFileName);
            fs.writeFileSync(cheatSourcePath, buildSkeletonCheatSource(manualRjId), "utf8");
            cheatIsGenerated = true;
            logger.log(`No matching scanned file, so a new skeleton was generated: custom_cheats/${cheatFileName}`);
        } else {
            logger.log("No custom cheat file selected -- installing only the core engine (CheatEngine_Core / CheatEngine_UI).");
        }

        fs.mkdirSync(detected.pluginsDir, { recursive: true });

        if (backupEnabled) {
            const backupPath = `${detected.pluginsJsPath}.bak`;
            fs.copyFileSync(detected.pluginsJsPath, backupPath);
            logger.log(`Backed up plugins.js -> ${path.basename(backupPath)}`);
        } else {
            logger.log("Safe backup is disabled -- plugins.js will be modified without a .bak copy.");
        }

        const filesToCopy = CORE_PLUGIN_FILES.map((f) => ({
            src: path.join(CORE_PLUGINS_DIR, f),
            dest: path.join(detected.pluginsDir, f),
            name: f
        }));
        if (cheatFileName) {
            filesToCopy.push({
                src: cheatSourcePath,
                dest: path.join(detected.pluginsDir, cheatFileName),
                name: cheatFileName
            });
        }

        for (const file of filesToCopy) {
            if (!fs.existsSync(file.src)) {
                return logger.fail(`Source file is missing, aborting: ${file.src}`);
            }
            fs.copyFileSync(file.src, file.dest);
            logger.log(`Copied: ${file.name}`);
        }

        const { list, header } = readPluginsList(detected.pluginsJsPath);
        const outcomes = filesToCopy.map((file) => {
            const name = path.basename(file.name, path.extname(file.name));
            const description = extractDescription(file.src);
            return { name, outcome: upsertPluginEntry(list, name, description) };
        });
        writePluginsList(detected.pluginsJsPath, header, list);

        const OUTCOME_LABEL = {
            added: "added + enabled",
            enabled: "existing entry enabled",
            "already-enabled": "already enabled"
        };
        for (const { name, outcome } of outcomes) {
            logger.log(`plugins.js: ${name} -> ${OUTCOME_LABEL[outcome]}`);
        }

        logger.log("Injection complete.");
        logger.done({
            success: true,
            action: "inject",
            engine: detected.engine,
            pluginsDir: detected.pluginsDir,
            cheatFile: cheatFileName,
            generated: cheatIsGenerated
        });
    } catch (err) {
        logger.fail(`Unexpected error: ${err.message}`);
    }
}

//-----------------------------------------------------------------------
// POST /api/uninstall -- reverts an install performed by /api/inject
//-----------------------------------------------------------------------

async function handleUninstall(req, res) {
    const logger = createLogger(res);
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache"
    });

    try {
        const body = await readJsonBody(req);
        const gameDirInput = typeof body.gameDir === "string" ? body.gameDir.trim() : "";

        if (!gameDirInput) {
            return logger.fail("Please enter the target game folder path.");
        }
        const gameDir = path.resolve(gameDirInput);
        if (!fs.existsSync(gameDir) || !fs.statSync(gameDir).isDirectory()) {
            return logger.fail(`Folder not found: ${gameDir}`);
        }
        logger.log(`Target game folder: ${gameDir}`);

        const detected = detectEngine(gameDir);
        if (!detected) {
            return logger.fail(
                "Could not detect an RPG Maker MV or MZ project here (no www/ folder and no js/plugins/ folder found)."
            );
        }
        logger.log(`Engine detected: RPG Maker ${detected.engine}`);
        logger.log(`Plugins directory: ${detected.pluginsDir}`);

        if (!fs.existsSync(detected.pluginsJsPath)) {
            return logger.fail(`plugins.js not found: ${detected.pluginsJsPath}`);
        }

        // Step 1: revert plugins.js -- restore the .bak backup if one exists,
        // otherwise strip Cheat Engine entries out of the live file directly.
        const backupPath = `${detected.pluginsJsPath}.bak`;
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, detected.pluginsJsPath);
            fs.unlinkSync(backupPath);
            logger.log(`Restored plugins.js from backup and removed ${path.basename(backupPath)}.`);
        } else {
            logger.log("No backup file found -- stripping Cheat Engine entries out of plugins.js directly.");
            const { list, header } = readPluginsList(detected.pluginsJsPath);
            const removedNames = [];
            const keptList = list.filter((p) => {
                const name = (p && p.name) || "";
                const isCoreEngine = name === "CheatEngine_Core" || name === "CheatEngine_UI";
                const isRjCustom = RJ_NAME_PATTERN.test(name);
                if (isCoreEngine || isRjCustom) {
                    removedNames.push(name);
                    return false;
                }
                return true;
            });
            writePluginsList(detected.pluginsJsPath, header, keptList);
            if (removedNames.length > 0) {
                removedNames.forEach((name) => logger.log(`plugins.js: removed entry -> ${name}`));
            } else {
                logger.log("plugins.js: no Cheat Engine entries were found to remove.");
            }
        }

        // Step 2: delete the plugin files themselves from disk -- the two
        // core files plus any scanned custom RJ*.js/json cheat files sitting
        // in the game's plugins directory.
        const filesToDelete = new Set(CORE_PLUGIN_FILES);
        if (fs.existsSync(detected.pluginsDir)) {
            for (const name of fs.readdirSync(detected.pluginsDir)) {
                if (RJ_FILENAME_PATTERN.test(name)) filesToDelete.add(name);
            }
        }
        let deletedCount = 0;
        for (const fileName of filesToDelete) {
            const filePath = path.join(detected.pluginsDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.log(`Deleted: ${fileName}`);
                deletedCount++;
            }
        }
        if (deletedCount === 0) {
            logger.log("No Cheat Engine plugin files were found on disk to delete.");
        }

        logger.log("Uninstall complete.");
        logger.done({ success: true, action: "uninstall", engine: detected.engine, pluginsDir: detected.pluginsDir });
    } catch (err) {
        logger.fail(`Unexpected error: ${err.message}`);
    }
}

//-----------------------------------------------------------------------
// Static file serving (just index.html -- this is a single-page app)
//-----------------------------------------------------------------------

function serveIndexHtml(res) {
    fs.readFile(INDEX_HTML_PATH, "utf8", (err, content) => {
        if (err) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(`Failed to load index.html: ${err.message}`);
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(content);
    });
}

//-----------------------------------------------------------------------
// Routing
//-----------------------------------------------------------------------

function requestListener(req, res) {
    let url;
    try {
        url = new URL(req.url, "http://localhost");
    } catch (err) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad Request");
        return;
    }

    if (req.method === "GET" && url.pathname === "/") {
        return serveIndexHtml(res);
    }
    if (req.method === "GET" && url.pathname === "/api/scan") {
        return handleScan(req, res);
    }
    if (req.method === "GET" && url.pathname === "/api/detect") {
        return handleDetect(req, res, url.searchParams);
    }
    if (req.method === "POST" && url.pathname === "/api/inject") {
        return handleInject(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/uninstall") {
        return handleUninstall(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/shutdown") {
        // The frontend calls this (via navigator.sendBeacon) when the
        // browser tab is closed, so the local server doesn't keep running
        // in the background after the user is done with it.
        res.writeHead(204);
        res.end();
        setImmediate(shutdown);
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
}

//-----------------------------------------------------------------------
// Server startup: port fallback + auto-launch the default browser
//-----------------------------------------------------------------------

function openBrowser(url) {
    let command;
    if (process.platform === "win32") {
        // The empty "" is a required placeholder for start's window-title
        // argument -- without it, start treats the URL itself as the title.
        command = `start "" "${url}"`;
    } else if (process.platform === "darwin") {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }
    exec(command, (err) => {
        if (err) {
            console.warn(`Could not auto-launch a browser (${err.message}). Please open ${url} manually.`);
        }
    });
}

let activeServer = null;

function shutdown() {
    console.log("\nShutting down installer server...");
    if (activeServer) {
        activeServer.close(() => process.exit(0));
    }
    // Safety net in case a lingering keep-alive connection stops close()
    // from ever firing its callback.
    setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function startServer(port, attemptsLeft) {
    const server = http.createServer(requestListener);
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
            console.warn(`Port ${port} is already in use, trying ${port + 1}...`);
            startServer(port + 1, attemptsLeft - 1);
        } else {
            console.error(`Failed to start server: ${err.message}`);
            process.exit(1);
        }
    });
    server.listen(port, () => {
        activeServer = server;
        const url = `http://localhost:${port}`;
        console.log(`RPG Maker Cheat Engine installer running at ${url}`);
        console.log("Press Ctrl+C to stop.");
        openBrowser(url);
    });
}

ensureCustomCheatsDir()
    .then(() => startServer(DEFAULT_PORT, MAX_PORT_ATTEMPTS))
    .catch((err) => {
        console.error(`Failed to prepare custom_cheats/ directory: ${err.message}`);
        process.exit(1);
    });
