import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as defaultStdin, stdout as defaultStdout } from "node:process";

export function processCommandLines() {
  if (process.platform === "win32") {
    const script = "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" });
    if (result.status !== 0 || !result.stdout.trim()) return [];
    const parsed = JSON.parse(result.stdout);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .filter((item) => item.CommandLine)
      .map((item) => `${item.ProcessId} ${item.CommandLine}`);
  }
  const result = spawnSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export function chromeUserDataRootCandidates() {
  if (process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT) {
    return [process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT];
  }
  if (process.platform === "darwin") {
    return [join(homedir(), "Library/Application Support/Google/Chrome")];
  }
  if (process.platform === "win32") {
    return [
      join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local"), "Google/Chrome/User Data"),
    ];
  }
  return [
    join(homedir(), ".config/google-chrome"),
    join(homedir(), ".config/chromium"),
  ];
}

export function chromeLocalStatePath() {
  const root = chromeUserDataRootCandidates().find((candidate) => existsSync(join(candidate, "Local State")));
  if (!root) {
    throw new Error(`Chrome Local State was not found. Checked: ${chromeUserDataRootCandidates().join(", ")}`);
  }
  return join(root, "Local State");
}

export function readChromeLocalState() {
  return JSON.parse(readFileSync(chromeLocalStatePath(), "utf8"));
}

export function listChromeProfiles() {
  const localState = readChromeLocalState();
  const infoCache = localState.profile?.info_cache ?? {};
  return Object.entries(infoCache)
    .map(([profileDir, profile]) => ({
      profileDir,
      profileName: profile.name || profile.shortcut_name || profileDir,
      email: profile.user_name || "",
      gaiaName: profile.gaia_name || "",
      avatarIcon: profile.avatar_icon || "",
    }))
    .sort((a, b) => {
      if (a.profileDir === "Default") return -1;
      if (b.profileDir === "Default") return 1;
      return a.profileDir.localeCompare(b.profileDir);
    });
}

export function formatProfileLine(profile, index) {
  const email = profile.email || "email未確認";
  const gaia = profile.gaiaName && profile.gaiaName !== profile.profileName ? ` / ${profile.gaiaName}` : "";
  return `${index + 1}. ${profile.profileName} / ${profile.profileDir} / ${email}${gaia}`;
}

export function assertUniqueProfileWindowLabel(profileConfig, profiles = listChromeProfiles()) {
  const expectedName = String(profileConfig?.profileName ?? "").trim();
  if (!expectedName) {
    throw new Error("Selected Chrome profile has no profileName; profile-safe window routing cannot verify it.");
  }
  const matches = profiles.filter((profile) => String(profile.profileName ?? "").trim() === expectedName);
  const otherMatches = matches.filter((profile) => profile.profileDir !== profileConfig.profileDir);
  if (otherMatches.length) {
    throw new Error([
      `Multiple Chrome profiles share the visible profile name "${expectedName}".`,
      "macOS AppleScript can only verify the visible Chrome window label, so duplicate profile names are unsafe.",
      `Selected: ${profileConfig.profileDir} / ${profileConfig.email ?? ""}`,
      `Duplicates: ${otherMatches.map((profile) => `${profile.profileDir} / ${profile.email || "email未確認"}`).join(", ")}`,
      "Rename one Chrome profile or choose a uniquely named profile, then re-run --setup-profile.",
    ].join(" "));
  }
  return true;
}

export function printServiceProfileCandidates({
  service,
  serviceLabel,
  profileConfigPath,
  profiles = listChromeProfiles(),
}) {
  console.log(`${serviceLabel}処理に使う通常Chromeプロファイル候補:`);
  for (const [index, profile] of profiles.entries()) {
    console.log(formatProfileLine(profile, index));
  }
  console.log("");
  console.log("保存する例:");
  console.log(`node scripts/process-service-queue.mjs --setup-profile --service ${service} --profile-choice <番号> --profile-config ${profileConfigPath}`);
  console.log("");
  console.log("この設定保存ではChromeを起動しません。保存後の実行は、保存済みの通常Chromeプロファイルだけを使います。");
}

async function chooseChromeProfile({
  service,
  serviceLabel,
  profileChoice,
  profileConfigPath,
  input = defaultStdin,
  output = defaultStdout,
  profiles,
}) {
  if (profileChoice) {
    const index = Number(profileChoice) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= profiles.length) {
      throw new Error(`Invalid --profile-choice ${profileChoice}; choose 1-${profiles.length}`);
    }
    return profiles[index];
  }
  if (!input.isTTY) {
    printServiceProfileCandidates({ service, serviceLabel, profileConfigPath, profiles });
    throw new Error("No --profile-choice was provided in a non-interactive shell.");
  }
  printServiceProfileCandidates({ service, serviceLabel, profileConfigPath, profiles });
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("番号を入力してください: ");
    const index = Number(answer.trim()) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= profiles.length) {
      throw new Error(`Invalid selection ${answer}; choose 1-${profiles.length}`);
    }
    return profiles[index];
  } finally {
    rl.close();
  }
}

export async function setupServiceChromeProfile({
  service,
  serviceLabel,
  profileChoice,
  profileConfigPath,
  input = defaultStdin,
  output = defaultStdout,
}) {
  const profiles = listChromeProfiles();
  if (!profiles.length) throw new Error("No Chrome profiles were found in Local State.");
  const selected = await chooseChromeProfile({
    service,
    serviceLabel,
    profileChoice,
    profileConfigPath,
    input,
    output,
    profiles,
  });
  if (!selected.email) {
    throw new Error(`Selected profile has no confirmed email in Chrome Local State. Choose a signed-in profile: ${JSON.stringify(selected)}`);
  }
  const config = {
    schemaVersion: 1,
    service,
    chrome: {
      profileDir: selected.profileDir,
      profileName: selected.profileName,
      email: selected.email,
    },
    createdAt: new Date().toISOString(),
    note: `Local-only image-arranger ${serviceLabel} normal Chrome profile selection. Do not commit this file.`,
  };
  mkdirSync(dirname(profileConfigPath), { recursive: true });
  writeFileSync(profileConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    saved: profileConfigPath,
    selected: config.chrome,
  }, null, 2));
}

function normalizeServiceProfileConfig(raw, { service, serviceLabel, profileConfigPath }) {
  if (raw?.automationChrome || raw?.viduAutomationChrome) {
    throw new Error(`${serviceLabel} profile config contains a rejected automation profile. Re-run --setup-profile --service ${service}; config path: ${profileConfigPath}`);
  }
  if (raw?.service && raw.service !== service) {
    throw new Error(`${serviceLabel} profile config was saved for service "${raw.service}", not "${service}". Re-run --setup-profile --service ${service}; config path: ${profileConfigPath}`);
  }
  const source = raw?.chrome ?? raw?.sourceChromeProfile ?? raw ?? {};
  const config = {
    profileDir: source.profileDir,
    profileName: source.profileName,
    email: source.email || "",
    bridgeClientId: source.bridgeClientId || raw?.bridgeClientId || "",
    bridgeExtensionId: source.bridgeExtensionId || raw?.bridgeExtensionId || "",
  };
  if (!config.profileDir || !config.profileName || !config.email) {
    throw new Error(`Invalid ${serviceLabel} Chrome profile config. Re-run --setup-profile --service ${service}; config path: ${profileConfigPath}`);
  }
  return config;
}

export function readServiceProfileConfig({ service, serviceLabel, profileConfigPath }) {
  if (!existsSync(profileConfigPath)) {
    const profiles = listChromeProfiles();
    printServiceProfileCandidates({ service, serviceLabel, profileConfigPath, profiles });
    throw new Error(`${serviceLabel} Chrome profile is not configured. Choose one with --setup-profile --service ${service} --profile-choice <number>. Config path: ${profileConfigPath}`);
  }
  const parsed = JSON.parse(readFileSync(profileConfigPath, "utf8"));
  return normalizeServiceProfileConfig(parsed, { service, serviceLabel, profileConfigPath });
}

export function assertRequiredChromeProfile(profileConfig, { service, serviceLabel }) {
  const localState = readChromeLocalState();
  const profile = localState.profile?.info_cache?.[profileConfig.profileDir];
  if (!profile) {
    throw new Error(`Chrome profile ${profileConfig.profileDir} was not found in Local State. Re-run --setup-profile --service ${service}.`);
  }
  const actual = {
    profileDir: profileConfig.profileDir,
    profileName: profile.name || profile.shortcut_name || profileConfig.profileDir,
    email: profile.user_name || "",
    bridgeClientId: profileConfig.bridgeClientId || "",
    bridgeExtensionId: profileConfig.bridgeExtensionId || "",
  };
  if (actual.profileName !== profileConfig.profileName || actual.email !== profileConfig.email) {
    throw new Error(`${serviceLabel} profile config no longer matches Chrome Local State. Re-run --setup-profile --service ${service}: ${JSON.stringify({
      expected: profileConfig,
      actual,
    })}`);
  }
  if (!actual.email) {
    throw new Error(`Selected Chrome profile has no confirmed email in Local State. Re-run --setup-profile --service ${service} with a signed-in profile.`);
  }
  if (process.platform === "darwin") {
    assertUniqueProfileWindowLabel(actual);
  }
  return actual;
}

export function loadServiceChromeProfile({ service, serviceLabel, profileConfigPath }) {
  const config = readServiceProfileConfig({ service, serviceLabel, profileConfigPath });
  return {
    chrome: assertRequiredChromeProfile(config, { service, serviceLabel }),
    configPath: profileConfigPath,
  };
}

export function assertNoUserDataDirProcesses({ label, rejectedPaths, commandLines = processCommandLines() }) {
  const normalizedRejected = rejectedPaths.flatMap((path) => {
    const value = String(path);
    return [value, value.replaceAll("\\", "/"), value.replaceAll("/", "\\")];
  });
  const bad = commandLines.filter((line) => (
    line.includes("--user-data-dir=")
    && normalizedRejected.some((path) => line.includes(path))
  ));
  if (bad.length) {
    throw new Error(`${label} is still running. Close it before using the selected normal Chrome profile route:\n${bad.join("\n")}`);
  }
}

export function bindServiceBridgeClientId({ profileConfigPath, profile, bridgeClientId, bridgeExtensionId = "" }) {
  if (!profileConfigPath || !profile || !bridgeClientId) return profile;
  if (profile.bridgeClientId === bridgeClientId && (!bridgeExtensionId || profile.bridgeExtensionId === bridgeExtensionId)) return profile;
  const parsed = existsSync(profileConfigPath)
    ? JSON.parse(readFileSync(profileConfigPath, "utf8"))
    : {};
  const next = {
    ...parsed,
    chrome: {
      ...(parsed.chrome ?? {}),
      profileDir: profile.profileDir,
      profileName: profile.profileName,
      email: profile.email,
      bridgeClientId,
      bridgeExtensionId,
    },
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(profileConfigPath, `${JSON.stringify(next, null, 2)}\n`);
  profile.bridgeClientId = bridgeClientId;
  if (bridgeExtensionId) profile.bridgeExtensionId = bridgeExtensionId;
  return profile;
}
