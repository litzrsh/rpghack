#!/usr/bin/env node
"use strict";

// CheatEngine 플러그인들을 대상 RPG Maker MV/MZ 게임에 설치한다.
// 사용법: node install.js <게임 폴더 경로>
//
// 무엇을 하는가:
//   1) plugins/ 안의 파일들을 대상 게임의 js/plugins/ 로 복사한다.
//   2) 대상 게임의 js/plugins.js ($plugins 배열)에 해당 플러그인 항목을
//      추가(없으면 새로 추가)하거나 활성화(status: true)한다. 원본은
//      plugins.js.bak 으로 백업한 뒤 수정한다.
//
// 어떤 플러그인이 설치되는가 (게임 확장 규칙):
//   - CheatEngine_Core.js / CheatEngine_UI.js 는 공통 코어이므로 항상 설치한다.
//   - 그 외 "CheatEngine_<GameId>.js" 또는 "CheatEngine_<GameId>_*.js" 형태의
//     파일은 게임 전용 확장으로 취급한다. <GameId>가 대상 게임 폴더명 또는
//     package.json의 name에 (대소문자 무시) 포함될 때만 설치한다.
//   - 즉, 새 게임을 지원하려면 그 게임 폴더명/패키지명과 매칭되는 이름으로
//     plugins/CheatEngine_<GameId>.js 파일을 추가하기만 하면 되고, 이 설치
//     스크립트는 수정할 필요가 없다.

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(__dirname, "plugins");
const CORE_PLUGINS = ["CheatEngine_Core.js", "CheatEngine_UI.js"];
const GAME_PLUGIN_PATTERN = /^CheatEngine_([A-Za-z0-9]+)(?:_.+)?\.js$/;

function fail(message) {
    console.error(`설치 실패: ${message}`);
    process.exit(1);
}

function isCorePlugin(fileName) {
    return CORE_PLUGINS.includes(fileName);
}

// 소스 plugins/ 폴더 안의 "CheatEngine_*.js" 파일 전체 (Core/UI 포함)
function listSourcePlugins() {
    return fs
        .readdirSync(SOURCE_DIR)
        .filter((f) => /^CheatEngine_.*\.js$/.test(f))
        .sort();
}

// 게임 전용 플러그인 파일이 이 대상(targetDir)에 해당하는지 판단한다.
// 판단 기준: 파일명에서 뽑아낸 GameId 문자열이 (1) 대상 폴더명 또는
// (2) 대상 package.json의 name 필드 에 대소문자 무시하고 포함되는지.
function matchesTarget(fileName, targetDir) {
    const m = fileName.match(GAME_PLUGIN_PATTERN);
    if (!m) return false;
    const gameId = m[1];
    const pattern = new RegExp(gameId, "i");

    if (pattern.test(path.basename(targetDir))) return true;

    const pkgPath = path.join(targetDir, "package.json");
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            if (typeof pkg.name === "string" && pattern.test(pkg.name)) return true;
        } catch (e) {
            console.warn(`경고: package.json 파싱 실패 (${e.message}) - 이 판단 기준은 건너뜁니다.`);
        }
    }

    return false;
}

function copyPlugin(fileName, pluginsDir) {
    const src = path.join(SOURCE_DIR, fileName);
    const dest = path.join(pluginsDir, fileName);
    fs.copyFileSync(src, dest);
    console.log(`파일 복사됨: ${fileName}`);
}

// 파일의 (한국어판이 아닌) 첫 @plugindesc 텍스트를 plugins.js description으로 사용
function extractDescription(sourceFilePath) {
    const src = fs.readFileSync(sourceFilePath, "utf8");
    const m = src.match(/@plugindesc\s+(.+)/);
    return m ? m[1].trim() : "";
}

function readPluginsList(pluginsJsPath) {
    const raw = fs.readFileSync(pluginsJsPath, "utf8");
    const headerMatch = raw.match(/^([\s\S]*?)var\s+\$plugins\s*=/);
    const bodyMatch = raw.match(/var\s+\$plugins\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    if (!headerMatch || !bodyMatch) {
        fail(`plugins.js 형식을 해석할 수 없습니다 (var $plugins = [...] 패턴을 찾지 못함): ${pluginsJsPath}`);
    }
    let list;
    try {
        list = JSON.parse(bodyMatch[1]);
    } catch (e) {
        fail(`plugins.js 파싱 실패: ${e.message}`);
    }
    return { list, header: headerMatch[1] };
}

function writePluginsList(pluginsJsPath, header, list) {
    const body = `[\n${list.map((p) => JSON.stringify(p)).join(",\n")}\n]`;
    fs.writeFileSync(pluginsJsPath, `${header}var $plugins =\n${body}\n;\n`, "utf8");
}

// 이미 목록에 있으면 status만 true로 켜고, 없으면 새 항목을 끝에 추가한다.
// 기존 항목의 parameters/위치는 건드리지 않는다 (사용자가 손댄 설정을 보존).
function upsertPluginEntry(list, fileName, sourceFilePath) {
    const name = path.basename(fileName, ".js");
    const existing = list.find((p) => p.name === name);
    if (existing) {
        if (existing.status === true) return "already-enabled";
        existing.status = true;
        return "enabled";
    }
    list.push({
        name,
        status: true,
        description: extractDescription(sourceFilePath),
        parameters: {}
    });
    return "added";
}

function main() {
    const targetArg = process.argv[2];
    if (!targetArg) {
        fail("대상 게임 폴더 경로를 인자로 입력하세요.\n사용법: node install.js <게임 폴더 경로>");
    }

    const targetDir = path.resolve(targetArg);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
        fail(`대상 폴더를 찾을 수 없습니다: ${targetDir}`);
    }

    const jsDir = path.join(targetDir, "js");
    if (!fs.existsSync(jsDir) || !fs.statSync(jsDir).isDirectory()) {
        fail(`RPG Maker MV/MZ 게임 폴더가 아닌 것 같습니다 (js 폴더 없음): ${jsDir}`);
    }

    const pluginsJsPath = path.join(jsDir, "plugins.js");
    if (!fs.existsSync(pluginsJsPath)) {
        fail(`plugins.js를 찾을 수 없습니다: ${pluginsJsPath}`);
    }

    const sourceFiles = listSourcePlugins();
    for (const f of CORE_PLUGINS) {
        if (!sourceFiles.includes(f)) fail(`소스 플러그인 파일을 찾을 수 없습니다: ${f}`);
    }

    const gameSpecific = sourceFiles
        .filter((f) => !isCorePlugin(f))
        .filter((f) => matchesTarget(f, targetDir));

    const toInstall = [...CORE_PLUGINS, ...gameSpecific];

    console.log(`대상 게임 폴더: ${targetDir}`);
    console.log(`플러그인 설치 위치: ${path.join(jsDir, "plugins")}`);
    console.log(`설치할 플러그인: ${toInstall.map((f) => path.basename(f, ".js")).join(", ")}\n`);

    const pluginsDir = path.join(jsDir, "plugins");
    fs.mkdirSync(pluginsDir, { recursive: true });
    for (const f of toInstall) {
        copyPlugin(f, pluginsDir);
    }

    const backupPath = `${pluginsJsPath}.bak`;
    fs.copyFileSync(pluginsJsPath, backupPath);
    console.log(`\nplugins.js 백업: ${backupPath}`);

    const { list, header } = readPluginsList(pluginsJsPath);
    const outcomes = toInstall.map((f) => {
        const outcome = upsertPluginEntry(list, f, path.join(SOURCE_DIR, f));
        return { name: path.basename(f, ".js"), outcome };
    });
    writePluginsList(pluginsJsPath, header, list);

    console.log("\nplugins.js 갱신 결과:");
    const LABELS = { added: "새로 추가 + 활성화", enabled: "기존 항목 활성화", "already-enabled": "이미 활성화됨" };
    for (const { name, outcome } of outcomes) {
        console.log(`  - ${name}: ${LABELS[outcome]}`);
    }

    console.log("\n설치가 완료되었습니다.");
}

main();
