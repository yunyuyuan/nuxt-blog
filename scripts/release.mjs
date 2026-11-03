// 发布 npm 包 @yunyuyuan/nuxt-blog（layer/ 目录）。
//
//   pnpm release                     发布 layer/package.json 中的当前版本
//   pnpm release <x.y.z>             先把版本改成 x.y.z，再发布
//   pnpm release patch|minor|major   按规则递增版本，再发布
//   pnpm release --starter-only      不发布，只把 starter/ 推送到模板仓库（例如发布后推送模板失败时）
//
// 选项：
//   --dry-run        只做检查、打包和预览。不修改文件，不发布，不推送
//   --skip-ci        不检查 GitHub 上这个 commit 的 CI 结果
//   --remote <name>  上游仓库的 remote 名称，默认 origin
//
// 脚本先完成所有检查，再打包并用 npm publish --dry-run 预览，输入版本号确认后才发布。
// 发布的是预览过的同一个 tarball。发布成功后，才提交版本号、打 tag 并推送。
// 最后把 starter/ 作为一个新 commit 推送到 GitHub 模板仓库，所以模板只在发布新版本后更新。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const PACKAGE = "@yunyuyuan/nuxt-blog";
// pnpm pack 生成的文件名：scoped 包名去掉 "@"，"/" 换成 "-"
const TARBALL_PREFIX = PACKAGE.replace(/^@/, "").replace("/", "-");
const REPO = "yunyuyuan/nuxt-blog";
const BRANCH = "master";
// GitHub 模板仓库，内容是发布时的 starter/。用户在这个仓库中点击 "Use this template" 创建站点
const STARTER_REPO = "yunyuyuan/nuxt-blog-starter";
const STARTER_BRANCH = "main";
// 固定为官方 registry。本地如果配置了镜像（例如 npmmirror），发布到镜像会失败
const REGISTRY = "https://registry.npmjs.org/";
// .github/workflows/check.yml 中的 job。starter job 用打包后的 layer 安装和构建 starter
const REQUIRED_CHECKS = ["check", "starter", "e2e"];
// 与 layer/app/plugins/github-token.client.ts 中读取最新主版本号的正则相同
const CHANGELOG_VERSION = /##\s*\[v(\d+)\]/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layerPkgPath = path.join(root, "layer", "package.json");
const isWindows = process.platform === "win32";

const USAGE = `用法：pnpm release [<x.y.z> | patch | minor | major] [--dry-run] [--skip-ci] [--remote <name>]
      pnpm release --starter-only [--dry-run] [--remote <name>]`;

class ReleaseError extends Error {}

function fail(message) {
  throw new ReleaseError(message);
}

function step(message) {
  console.log(`\n==> ${message}`);
}

function quoteForShell(arg) {
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, "\\\"")}"`;
}

/** 运行命令。capture 为 true 时返回输出；否则输出直接显示在终端，npm 可以在终端中询问一次性密码 */
function run(cmd, args, { capture = false, allowFail = false } = {}) {
  const options = { cwd: root, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" };
  // Windows 上 npm 和 pnpm 是 .cmd 文件，要通过 shell 运行
  const result = isWindows && cmd !== "git"
    ? spawnSync([cmd, ...args].map(quoteForShell).join(" "), { ...options, shell: true })
    : spawnSync(cmd, args, options);
  if (result.error) {
    fail(`无法运行 ${cmd}：${result.error.message}`);
  }
  const output = { status: result.status, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
  if (result.status !== 0 && !allowFail) {
    const detail = capture ? `\n${output.stderr || output.stdout}` : "";
    fail(`命令失败（退出码 ${result.status}）：${cmd} ${args.join(" ")}${detail}`);
  }
  return output;
}

function git(...args) {
  return run("git", args, { capture: true }).stdout;
}

function parseVersion(version) {
  const match = SEMVER.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      return x[i] - y[i];
    }
  }
  return 0;
}

function bumpVersion(version, kind) {
  const [major, minor, patch] = parseVersion(version);
  if (kind === "major") {
    return `${major + 1}.0.0`;
  }
  if (kind === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function parseArgs(argv) {
  const options = { target: null, dryRun: false, skipCi: false, starterOnly: false, remote: "origin", help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-ci") {
      options.skipCi = true;
    } else if (arg === "--starter-only") {
      options.starterOnly = true;
    } else if (arg === "--remote") {
      options.remote = argv[++i];
      if (!options.remote) {
        fail("--remote 后面要写 remote 的名称");
      }
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--") {
      continue;
    } else if (arg.startsWith("-")) {
      fail(`未知选项：${arg}\n${USAGE}`);
    } else if (options.target) {
      fail(`只能指定一个版本\n${USAGE}`);
    } else {
      options.target = arg;
    }
  }
  if (options.starterOnly && options.target) {
    fail(`--starter-only 不发布，不能同时指定版本\n${USAGE}`);
  }
  return options;
}

/** 检查分支、工作区和 remote，返回 HEAD 的 commit */
function checkGit(remote) {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== BRANCH) {
    fail(`当前分支是 ${branch}。请切换到 ${BRANCH} 后再发布`);
  }
  const status = git("status", "--porcelain");
  if (status) {
    fail(`工作区有未提交的改动：\n${status}`);
  }
  const url = run("git", ["remote", "get-url", remote], { capture: true, allowFail: true });
  if (url.status !== 0) {
    fail(`没有名为 ${remote} 的 remote。请用 --remote 指定上游仓库的 remote`);
  }
  if (!new RegExp(`[/:]${REPO}(\\.git)?/?$`).test(url.stdout)) {
    fail(`remote ${remote} 指向 ${url.stdout}，不是 ${REPO}。请用 --remote 指定上游仓库的 remote`);
  }
  run("git", ["fetch", "--quiet", "--tags", remote, BRANCH], { capture: true });
  const head = git("rev-parse", "HEAD");
  const remoteHead = git("rev-parse", `refs/remotes/${remote}/${BRANCH}`);
  if (head !== remoteHead) {
    fail(`本地 ${BRANCH}（${head.slice(0, 7)}）与 ${remote}/${BRANCH}（${remoteHead.slice(0, 7)}）不一致。请先 pull 或 push`);
  }
  return head;
}

/** 模板仓库的地址，与上游 remote 使用相同的协议，所以推送时用同样的凭据。checkGit 已经确认 remote 指向 REPO */
function starterUrl(remote) {
  const url = git("remote", "get-url", remote);
  return url.replace(new RegExp(`([/:])${REPO}(\\.git)?/?$`), `$1${STARTER_REPO}.git`);
}

/** 模板仓库中 STARTER_BRANCH 的 commit。分支还不存在（空仓库）时返回空字符串 */
function starterHead(url) {
  return git("ls-remote", url, `refs/heads/${STARTER_BRANCH}`).split(/\s+/)[0] || "";
}

function checkTag(remote, tag) {
  if (run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { capture: true, allowFail: true }).status === 0) {
    fail(`本地已有 tag ${tag}`);
  }
  if (git("ls-remote", "--tags", remote, `refs/tags/${tag}`)) {
    fail(`${remote} 上已有 tag ${tag}`);
  }
}

function npmUser() {
  const result = run("npm", ["whoami", "--registry", REGISTRY], { capture: true, allowFail: true });
  if (result.status !== 0 || !result.stdout) {
    fail(`没有登录 ${REGISTRY}。请先运行：npm login --registry ${REGISTRY}`);
  }
  return result.stdout;
}

/** npm 上已发布的版本和维护者。包还不存在时都为空 */
function npmPackageInfo() {
  const result = run("npm", ["view", PACKAGE, "versions", "maintainers", "--json", "--registry", REGISTRY], { capture: true, allowFail: true });
  let data;
  try {
    data = JSON.parse(result.stdout || "{}");
  } catch {
    fail(`无法解析 npm view 的输出：\n${result.stdout || result.stderr}`);
  }
  if (data.error) {
    if (data.error.code === "E404") {
      return { versions: [], maintainers: [] };
    }
    fail(`npm view 失败：${data.error.summary || data.error.code}`);
  }
  if (result.status !== 0) {
    fail(`npm view 失败：\n${result.stderr}`);
  }
  const list = value => (value === undefined ? [] : [].concat(value));
  // maintainers 的格式是 "名字 <邮箱>"
  return { versions: list(data.versions), maintainers: list(data.maintainers).map(m => String(m).split(" ")[0]) };
}

function readStarterPackage() {
  return JSON.parse(fs.readFileSync(path.join(root, "starter", "package.json"), "utf8"));
}

/** starter 依赖的框架版本范围要包含 version */
function checkStarterRange(version) {
  const major = parseVersion(version)[0];
  const range = readStarterPackage().dependencies?.[PACKAGE] || "";
  const rangeMajor = /^\^(\d+)\./.exec(range);
  if (!rangeMajor || Number(rangeMajor[1]) !== major) {
    fail(`starter/package.json 中 ${PACKAGE} 的版本范围是 "${range}"，不包含 ${version}。请改成 "^${major}.0.0"`);
  }
}

/**
 * 模板中没有 lockfile，starter/package.json 中 nuxt 的范围决定用户安装哪个 Nuxt。
 * 这个范围只接受补丁更新（~），并且与根目录 pnpm-lock.yaml 中测试过的 Nuxt 属于同一个小版本
 */
function checkStarterNuxt() {
  const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  const importer = /^importers:\n\n {2}\.:\n([\s\S]*?)\n\n(?=\S| {2}\S)/m.exec(lock)?.[1] || "";
  const locked = /\n {6}nuxt:\n {8}specifier: .+\n {8}version: (\d+\.\d+\.\d+)/.exec(`\n${importer}`)?.[1];
  if (!locked) {
    fail("pnpm-lock.yaml 中没有找到根目录的 nuxt 版本");
  }
  const range = readStarterPackage().dependencies?.nuxt || "";
  const match = /^~(\d+)\.(\d+)\.(\d+)$/.exec(range);
  const [major, minor, patch] = parseVersion(locked);
  if (!match || Number(match[1]) !== major || Number(match[2]) !== minor || Number(match[3]) > patch) {
    fail(`starter/package.json 中 nuxt 的版本范围是 "${range}"，请改成 "~${locked}"。`
      + `模板中没有 lockfile，这个范围决定用户安装的 Nuxt，要与根目录 pnpm-lock.yaml 中测试过的 ${locked} 属于同一个小版本`);
  }
  return range;
}

/** 后台的升级提示按 CHANGELOG 判断主版本；starter 的依赖范围要包含新版本 */
function checkMajorVersion(version) {
  const major = parseVersion(version)[0];
  const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const match = CHANGELOG_VERSION.exec(changelog);
  if (!match) {
    fail("CHANGELOG.md 中没有 ## [vN] 格式的条目");
  }
  if (Number(match[1]) !== major) {
    fail(`CHANGELOG.md 中最新的条目是 v${match[1]}，要发布的主版本是 v${major}。`
      + `后台的升级提示用 CHANGELOG.md 判断主版本，请先在 CHANGELOG.md 中加入 ## [v${major}]`);
  }
  checkStarterRange(version);
}

/**
 * 把 commit 中的 starter/ 作为一个新 commit 推送到模板仓库。新 commit 的父 commit 是模板仓库当前的 HEAD，
 * 所以推送是 fast-forward。内容没有变化时不推送
 */
function syncStarter(url, commit, label, dryRun) {
  const tree = git("rev-parse", `${commit}:starter`);
  const head = starterHead(url);
  if (head) {
    run("git", ["fetch", "--quiet", "--no-tags", url, `refs/heads/${STARTER_BRANCH}`], { capture: true });
    if (git("rev-parse", `${head}^{tree}`) === tree) {
      console.log(`${STARTER_REPO} 中的内容与 starter/ 相同，不需要推送`);
      return;
    }
  }
  if (dryRun) {
    console.log(`--dry-run：不推送。会把 ${commit.slice(0, 7)} 的 starter/ 推送到 ${url} 的 ${STARTER_BRANCH}`);
    return;
  }
  const message = `${label}\n\nstarter/ of ${REPO}@${commit}`;
  const created = git("commit-tree", tree, ...(head ? ["-p", head] : []), "-m", message);
  run("git", ["push", url, `${created}:refs/heads/${STARTER_BRANCH}`]);
  console.log(`已推送：https://github.com/${STARTER_REPO}/commit/${created}`);
}

/** 只推送模板仓库：starter/ 依赖的框架主版本必须已经发布到 npm */
function starterOnly(options) {
  step("检查 git");
  const sha = checkGit(options.remote);
  console.log(`${BRANCH} 与 ${options.remote}/${BRANCH} 一致：${sha.slice(0, 7)}`);

  step("检查 starter/");
  const latest = npmPackageInfo().versions.filter(v => parseVersion(v)).sort(compareVersions).at(-1);
  if (!latest) {
    fail(`${PACKAGE} 还没有发布过。模板依赖 npm 上的包，请先发布`);
  }
  checkStarterRange(latest);
  console.log(`nuxt：${checkStarterNuxt()}；${PACKAGE}：npm 上的最新版本 ${latest}`);

  step(`推送 starter/ 到 ${STARTER_REPO}`);
  const label = run("git", ["describe", "--tags", "--match", "v*"], { capture: true, allowFail: true }).stdout || sha.slice(0, 7);
  syncStarter(starterUrl(options.remote), sha, label, options.dryRun);
}

/** 通过 GitHub 的公开 API 检查这个 commit 的 CI 结果，不需要登录 */
async function checkCi(sha) {
  const url = `https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?per_page=100`;
  const hint = "确认 CI 已通过后，可以加 --skip-ci 跳过这项检查";
  let response;
  try {
    response = await fetch(url, { headers: { "Accept": "application/vnd.github+json", "User-Agent": "nuxt-blog-release" } });
  } catch (error) {
    fail(`无法读取 CI 结果：${error.message}。${hint}`);
  }
  if (!response.ok) {
    fail(`无法读取 CI 结果：HTTP ${response.status}。${hint}`);
  }
  const runs = (await response.json()).check_runs || [];
  const problems = [];
  for (const name of REQUIRED_CHECKS) {
    const check = runs.find(r => r.name === name);
    if (!check) {
      problems.push(`${name}：没有运行`);
    } else if (check.status !== "completed") {
      problems.push(`${name}：还没有完成（${check.status}）`);
    } else if (check.conclusion !== "success") {
      problems.push(`${name}：${check.conclusion}`);
    }
  }
  for (const check of runs) {
    if (!REQUIRED_CHECKS.includes(check.name) && check.status === "completed" && !["success", "skipped", "neutral"].includes(check.conclusion)) {
      problems.push(`${check.name}：${check.conclusion}`);
    }
  }
  if (problems.length) {
    fail(`${sha.slice(0, 7)} 的 CI 没有全部通过：\n  ${problems.join("\n  ")}\n查看：https://github.com/${REPO}/commit/${sha}`);
  }
  console.log(`${REQUIRED_CHECKS.join("、")} 都已通过`);
}

function pack(dir, version) {
  run("pnpm", ["--dir", "layer", "pack", "--pack-destination", dir], { capture: true });
  const tarball = path.join(dir, `${TARBALL_PREFIX}-${version}.tgz`);
  if (!fs.existsSync(tarball)) {
    fail(`打包后没有找到 ${tarball}`);
  }
  return tarball;
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const controller = new AbortController();
  rl.on("SIGINT", () => controller.abort());
  rl.on("close", () => controller.abort());
  try {
    return await rl.question(question, { signal: controller.signal });
  } catch {
    return "";
  } finally {
    rl.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  if (Number(process.versions.node.split(".")[0]) < 22) {
    fail(`需要 Node.js 22 或更高版本，当前是 ${process.versions.node}`);
  }
  if (options.starterOnly) {
    starterOnly(options);
    return;
  }

  step("检查 git");
  const sha = checkGit(options.remote);
  console.log(`${BRANCH} 与 ${options.remote}/${BRANCH} 一致：${sha.slice(0, 7)}`);

  step("检查 npm");
  const user = npmUser();
  const info = npmPackageInfo();
  if (info.maintainers.length && !info.maintainers.includes(user)) {
    fail(`npm 账号 ${user} 不是 ${PACKAGE} 的维护者（${info.maintainers.join("、")}）`);
  }
  const latest = info.versions.filter(v => parseVersion(v)).sort(compareVersions).at(-1);
  console.log(`npm 账号：${user}；npm 上的最新版本：${latest || "还没有发布过"}`);

  step("检查版本号");
  const pkgText = fs.readFileSync(layerPkgPath, "utf8");
  const current = JSON.parse(pkgText).version;
  if (!parseVersion(current)) {
    fail(`layer/package.json 中的版本 ${current} 格式不对，应为 x.y.z`);
  }
  const kinds = ["patch", "minor", "major"];
  const target = !options.target ? current : kinds.includes(options.target) ? bumpVersion(current, options.target) : options.target;
  if (!parseVersion(target)) {
    fail(`版本 ${target} 格式不对，应为 x.y.z、patch、minor 或 major`);
  }
  if (compareVersions(target, current) < 0) {
    fail(`版本 ${target} 低于 layer/package.json 中的 ${current}`);
  }
  if (info.versions.includes(target)) {
    fail(`${PACKAGE}@${target} 已经发布过。发布下一个版本：pnpm release patch`);
  }
  if (latest && compareVersions(target, latest) <= 0) {
    fail(`版本 ${target} 不高于 npm 上的最新版本 ${latest}`);
  }
  const tag = `v${target}`;
  checkTag(options.remote, tag);
  checkMajorVersion(target);
  const bumped = target !== current;
  console.log(bumped ? `${current} -> ${target}` : `${target}（layer/package.json 中的当前版本）`);

  step("检查模板仓库");
  console.log(`starter/package.json 中 nuxt 的范围：${checkStarterNuxt()}`);
  const templateUrl = starterUrl(options.remote);
  const templateHead = starterHead(templateUrl);
  console.log(`${STARTER_REPO}：${templateHead ? `${STARTER_BRANCH} 在 ${templateHead.slice(0, 7)}` : "还是空仓库"}`);

  step("检查 CI");
  if (options.skipCi) {
    console.log("已跳过（--skip-ci）");
  } else {
    await checkCi(sha);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${TARBALL_PREFIX}-release-`));
  let released = false;
  try {
    if (bumped) {
      fs.writeFileSync(layerPkgPath, pkgText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${target}$2`));
    }
    step("打包 layer/");
    const tarball = pack(tmp, target);
    console.log(tarball);

    step("预览发布内容（npm publish --dry-run）");
    run("npm", ["publish", tarball, "--dry-run", "--access", "public", "--registry", REGISTRY]);

    console.log(`
包：      ${PACKAGE}@${target}
npm 账号：${user}
commit：  ${sha.slice(0, 7)}${bumped ? `，发布后提交 "chore(release): ${tag}"` : ""}
tag：     ${tag}，发布后推送到 ${options.remote}
模板仓库：发布后把 starter/ 推送到 ${STARTER_REPO} 的 ${STARTER_BRANCH}`);
    if (options.dryRun) {
      console.log("\n--dry-run：到此结束。没有修改文件，没有发布，也没有推送。");
      return;
    }
    const answer = await ask(`\n输入 ${target} 确认发布：`);
    if (answer.trim() !== target) {
      fail("输入的内容与版本号不一致，已取消。没有发布任何内容");
    }

    step("发布到 npm");
    run("npm", ["publish", tarball, "--access", "public", "--registry", REGISTRY]);
    released = true;
  } finally {
    // 没有发布成功时恢复版本号，工作区回到运行前的状态
    if (bumped && !released) {
      fs.writeFileSync(layerPkgPath, pkgText);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  step("提交、打 tag 并推送");
  const gitSteps = [
    ...(bumped ? [{ name: "提交 layer/package.json", args: ["commit", "-m", `chore(release): ${tag}`, "--", "layer/package.json"] }] : []),
    { name: `打 tag ${tag}`, args: ["tag", "-a", tag, "-m", tag] },
    { name: `推送 ${BRANCH} 和 tag ${tag}`, args: ["push", "--atomic", options.remote, `HEAD:refs/heads/${BRANCH}`, `refs/tags/${tag}`] }
  ];
  for (const [index, gitStep] of gitSteps.entries()) {
    try {
      run("git", gitStep.args);
    } catch (error) {
      const done = gitSteps.slice(0, index).map(s => s.name);
      const todo = gitSteps.slice(index).map(s => `git ${s.args.map(quoteForShell).join(" ")}`);
      fail(`${PACKAGE}@${target} 已经发布到 npm，但“${gitStep.name}”失败：${error.message}\n`
        + `已完成：${done.length ? done.join("、") : "无"}\n请手动运行：\n  ${todo.join("\n  ")}`);
    }
  }

  step(`推送 starter/ 到 ${STARTER_REPO}`);
  try {
    syncStarter(templateUrl, git("rev-parse", "HEAD"), tag, false);
  } catch (error) {
    fail(`${PACKAGE}@${target} 已经发布，tag ${tag} 已推送，但模板仓库没有更新：${error.message}\n`
      + `修好后运行：pnpm release --starter-only`);
  }

  console.log(`\n完成：${PACKAGE}@${target} 已发布，tag ${tag} 已推送，模板仓库已更新。`);
  console.log(`查看：https://www.npmjs.com/package/${PACKAGE}/v/${target}`);
}

main().catch((error) => {
  if (error instanceof ReleaseError) {
    console.error(`\n发布中止：${error.message}`);
    process.exit(1);
  }
  throw error;
});
