import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { composeAnalyzePrompt, createImageArrangerServer, createSeedState, createEmptyState, parseKitParts, runDoctor } from "./server.mjs";


async function withServer(callback, options = {}) {
  const temp = mkdtempSync(join(tmpdir(), "image-arranger-"));
  const projectRoot = options.projectRoot ?? temp;
  const created = createImageArrangerServer({
    port: 0,
    stateFile: join(temp, "deck.json"),
    requestDir: join(temp, "requests"),
    outputDir: join(temp, "outputs"),
    assetDir: options.assetDir ?? join(projectRoot, "assets"),
    projectRoot,
    init: options.init ?? "sample",
  });
  await new Promise((resolve) => created.server.listen(0, "127.0.0.1", resolve));
  const port = created.server.address().port;
  try {
    await callback({ ...created, temp, port, baseUrl: `http://127.0.0.1:${port}` });
  } finally {
    await new Promise((resolve) => created.server.close(resolve));
  }
}

test("default seed state is public-safe sample data", () => {
  const state = createSeedState();
  const character = state.characters[0];

  assert.equal(state.schema, "image-arranger.v1");
  assert.equal(character.id, "sample-character");
  assert.equal(character.workflow, "character");
  assert.ok(character.images.some((entry) => entry.id === "image-sample-character-studio-smile"));
  assert.doesNotMatch(JSON.stringify(state), /Fishing Fitness|Punching Arranger|\/Users\//);
});

test("server creates request files and updates target status", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const state = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const target = state.characters[0].images[0];
    const result = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: state.characters[0].id,
        mode: "image",
        targets: [{
          entryId: target.id,
          overview: target.overview,
          prompt: target.prompt,
          inputs: { startFrame: null, endFrame: null, refImages: ["assets/base-reference.png"] },
        }],
      }),
    }).then((response) => response.json());

    assert.equal(result.ok, true);
    assert.equal(result.request.status, "requested");
    assert.equal(result.request.character, "sample-character");
    assert.equal(result.request.characterName, "Sample Character");
    assert.equal(result.request.service, "chatgpt");
    assert.deepEqual(result.request.targets[0].inputs.refImages, ["assets/base-reference.png"]);
    assert.equal(result.request.targets[0].outputDir, "outputs/sample-character");
    assert.equal(result.state.characters[0].images[0].requestStatus, "requested");
    assert.match(readFileSync(join(context.requestDir, `${result.request.requestId}.json`), "utf8"), /chatgpt/);

    const completeResult = await fetch(`${baseUrl}/api/requests/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: result.request.requestId,
        targetIndex: 0,
        results: [{ file: "assets/sample-character/generated.png", assetId: "asset-generated" }],
      }),
    }).then((response) => response.json());

    assert.equal(completeResult.ok, true);
    assert.equal(completeResult.completed, 1);
    assert.equal(completeResult.requests.length, 0);
    assert.equal(completeResult.state.characters[0].images[0].requestStatus, "idle");

    const completedPayload = JSON.parse(readFileSync(join(context.requestDir, `${result.request.requestId}.json`), "utf8"));
    assert.equal(completedPayload.status, "completed");
    assert.equal(completedPayload.targets[0].status, "completed");
    assert.deepEqual(completedPayload.targets[0].results, [{ file: "assets/sample-character/generated.png", assetId: "asset-generated" }]);
  });
});

test("server queues mixed generation and improvement targets and cancels them", async () => {
  await withServer(async ({ baseUrl, context, temp }) => {
    const initial = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const entryId = initial.characters[0].images[0].id;
    const png = join(temp, "existing.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId,
        sourceFile: basename(png),
        name: "existing-candidate",
        adopted: true,
      }),
    }).then((response) => response.json());
    const asset = assetResult.asset;
    const queueResult = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        mode: "image",
        targets: [
          {
            action: "generate",
            entryId,
            overview: "new image route",
            prompt: "create a new image",
            inputs: { startFrame: null, endFrame: null, refImages: [] },
          },
          {
            action: "improve",
            entryId,
            assetId: asset.id,
            assetName: asset.name,
            assetFile: asset.file,
            overview: "improve existing route",
            prompt: "improve the existing image",
            improvementPrompt: "make the silhouette cleaner",
            service: "chatgpt",
            inputs: { startFrame: null, endFrame: null, refImages: [asset.file], sourceAsset: asset.file },
          },
        ],
      }),
    }).then((response) => response.json());

    assert.equal(queueResult.ok, true);
    assert.equal(queueResult.request.targets.length, 2);
    assert.equal(queueResult.request.targets[0].action, "generate");
    assert.equal(queueResult.request.targets[1].action, "improve");
    assert.equal(queueResult.request.targets[1].assetId, asset.id);
    assert.equal(queueResult.request.targets[0].outputDir, "outputs/sample-character");
    assert.equal(queueResult.request.targets[1].outputDir, "outputs/sample-character/improvements");
    assert.equal(queueResult.state.characters[0].images[0].requestStatus, "requested");
    assert.equal(queueResult.state.characters[0].images[0].assets.find((item) => item.id === asset.id).requestStatus, "requested");

    const listed = await fetch(`${baseUrl}/api/requests`).then((response) => response.json());
    assert.equal(listed.requests.length, 2);
    assert.equal(listed.requests[0].requestId, queueResult.request.requestId);
    const generateRow = listed.requests.find((item) => item.action === "generate");
    const improveRow = listed.requests.find((item) => item.action === "improve");

    const firstCancel = await fetch(`${baseUrl}/api/requests/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targets: [{ requestId: generateRow.requestId, targetIndex: generateRow.targetIndex }],
      }),
    }).then((response) => response.json());
    assert.equal(firstCancel.ok, true);
    assert.equal(firstCancel.cancelled, 1);
    assert.equal(firstCancel.state.characters[0].images[0].requestStatus, "idle");
    assert.equal(firstCancel.state.characters[0].images[0].assets.find((item) => item.id === asset.id).requestStatus, "requested");

    const cancelResult = await fetch(`${baseUrl}/api/requests/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targets: [{ requestId: improveRow.requestId, targetIndex: improveRow.targetIndex }],
      }),
    }).then((response) => response.json());
    assert.equal(cancelResult.ok, true);
    assert.equal(cancelResult.cancelled, 1);
    assert.equal(cancelResult.state.characters[0].images[0].requestStatus, "idle");
    assert.equal(cancelResult.state.characters[0].images[0].assets.find((item) => item.id === asset.id).requestStatus, "idle");

    const requestFile = readFileSync(join(context.requestDir, `${queueResult.request.requestId}.json`), "utf8");
    const requestPayload = JSON.parse(requestFile);
    assert.equal(requestPayload.status, "cancelled");
    assert.deepEqual(requestPayload.targets.map((target) => target.status), ["cancelled", "cancelled"]);
  });
});

test("server updates queued request content and source deck fields", async () => {
  await withServer(async ({ baseUrl, context, temp }) => {
    const initial = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const entryId = initial.characters[0].images[0].id;
    const png = join(temp, "candidate.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId,
        sourceFile: basename(png),
        name: "candidate-for-update",
      }),
    }).then((response) => response.json());
    const asset = assetResult.asset;

    const queueResult = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        mode: "image",
        targets: [
          {
            action: "generate",
            entryId,
            overview: "generate update target",
            prompt: "before generate prompt",
            inputs: { startFrame: null, endFrame: null, refImages: [] },
          },
          {
            action: "improve",
            entryId,
            assetId: asset.id,
            assetName: asset.name,
            assetFile: asset.file,
            overview: "improve update target",
            prompt: "before improve prompt",
            improvementPrompt: "before improvement prompt",
            service: "chatgpt",
            inputs: { startFrame: null, endFrame: null, refImages: [asset.file], sourceAsset: asset.file },
          },
        ],
      }),
    }).then((response) => response.json());

    const generateUpdate = await fetch(`${baseUrl}/api/requests/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: queueResult.request.requestId,
        targetIndex: 0,
        prompt: "after generate prompt",
      }),
    }).then((response) => response.json());
    assert.equal(generateUpdate.ok, true);
    assert.equal(generateUpdate.deckUpdated, true);
    assert.equal(generateUpdate.state.characters[0].images[0].prompt, "after generate prompt");

    const improveUpdate = await fetch(`${baseUrl}/api/requests/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: queueResult.request.requestId,
        targetIndex: 1,
        prompt: "after improve prompt",
        improvementPrompt: "after improvement prompt",
      }),
    }).then((response) => response.json());
    assert.equal(improveUpdate.ok, true);
    assert.equal(
      improveUpdate.state.characters[0].images[0].assets.find((item) => item.id === asset.id).improvementPrompt,
      "after improvement prompt",
    );
    assert.equal(
      improveUpdate.state.characters[0].images[0].assets.filter((item) => item.improvementPrompt === "after improvement prompt").length,
      1,
    );

    const requestPayload = JSON.parse(readFileSync(join(context.requestDir, `${queueResult.request.requestId}.json`), "utf8"));
    assert.equal(requestPayload.targets[0].prompt, "after generate prompt");
    assert.equal(requestPayload.targets[1].prompt, "after improve prompt");
    assert.equal(requestPayload.targets[1].improvementPrompt, "after improvement prompt");

    const listed = await fetch(`${baseUrl}/api/requests`).then((response) => response.json());
    const improveRow = listed.requests.find((item) => item.action === "improve");
    assert.equal(improveRow.prompt, "after improve prompt");
    assert.equal(improveRow.improvementPrompt, "after improvement prompt");
    assert.deepEqual(improveRow.inputs.refImages, [asset.file]);
  });
});

test("server accepts assets on custom base categories", async () => {
  await withServer(async ({ baseUrl, temp }) => {
    const state = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const character = state.characters[0];
    character.categoryLabels.scene = { ja: "場面", en: "Scene" };
    character.base.scene = [{
      id: "base-scene-rain",
      overview: "雨の場面",
      prompt: "rainy street scene",
      version: 1,
      checked: false,
      requestStatus: "idle",
      tags: [],
      assets: [],
    }];
    await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).then((response) => response.json());

    const png = join(temp, "scene.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId: "base-scene-rain",
        sourceFile: basename(png),
        name: "scene-candidate",
        adopted: true,
      }),
    }).then((response) => response.json());

    assert.equal(assetResult.ok, true);
    assert.equal(assetResult.asset.adopted, true);
    assert.match(assetResult.asset.file, /assets\/sample-character\/base-scene-rain\/scene-candidate\.png/);

    const refResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId: "base-scene-rain",
        sourceFile: basename(png),
        name: "scene-source",
        reference: true,
      }),
    }).then((response) => response.json());
    assert.equal(refResult.ok, true);
    assert.deepEqual(refResult.asset.tags, ["source-reference"]);
  });
});

test("server creates characters and registers copied asset candidates", async () => {
  const tempProject = mkdtempSync(join(tmpdir(), "image-arranger-project-"));
  await withServer(async ({ baseUrl, temp }) => {
    const characterResult = await fetch(`${baseUrl}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Character",
        description: "created by test",
      }),
    }).then((response) => response.json());
    assert.equal(characterResult.ok, true);
    assert.equal(characterResult.character.id, "Test-Character");
    assert.equal(characterResult.character.workflow, undefined);
    assert.ok(characterResult.character.base.master.some((entry) => entry.overview === "全身ベース"));
    assert.equal(characterResult.character.images.length, 0);

    const png = join(tempProject, "candidate.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const entryId = characterResult.state.characters[0].images[0].id;
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId,
        sourceFile: basename(png),
        name: "candidate-a",
        adopted: true,
      }),
    }).then((response) => response.json());

    assert.equal(assetResult.ok, true);
    assert.equal(assetResult.asset.adopted, true);
    assert.match(assetResult.asset.file, /assets\/sample-character\/image-sample-character-studio-smile\/candidate-a\.png/);
    assert.equal(assetResult.state.characters[0].images[0].assets.at(-1).name, "candidate-a");
  }, { projectRoot: tempProject, assetDir: join(tempProject, "assets") });
});

test("server updates characters and cascades queued targets on delete", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const initial = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const character = initial.characters[0];
    const entryId = character.images[0].id;
    const queueResult = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        mode: "image",
        targets: [{
          action: "generate",
          entryId,
          overview: "queued before delete",
          prompt: "queued prompt",
          inputs: { startFrame: null, endFrame: null, refImages: [] },
        }],
      }),
    }).then((response) => response.json());
    assert.equal(queueResult.ok, true);

    const updateResult = await fetch(`${baseUrl}/api/characters/${character.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed Character", description: "updated description" }),
    }).then((response) => response.json());
    assert.equal(updateResult.character.name, "Renamed Character");
    assert.equal(updateResult.character.description, "updated description");

    const deleteResult = await fetch(`${baseUrl}/api/characters/${character.id}`, {
      method: "DELETE",
    }).then((response) => response.json());
    assert.equal(deleteResult.ok, true);
    assert.equal(deleteResult.cancelled, 1);
    assert.equal(deleteResult.state.characters.some((item) => item.id === character.id), false);
    assert.equal(deleteResult.requests.length, 0);

    const requestPayload = JSON.parse(readFileSync(join(context.requestDir, `${queueResult.request.requestId}.json`), "utf8"));
    assert.equal(requestPayload.status, "cancelled");
    assert.equal(requestPayload.targets[0].status, "cancelled");
  });
});

test("analyze prompt lets the AI choose parts from the vocabulary", () => {
  const prompt = composeAnalyzePrompt("Sample Character");
  assert.match(prompt, /画像生成は不要です/);
  assert.match(prompt, /YOU decide which parts to include/);
  assert.match(prompt, /key: face-front/);
  assert.match(prompt, /key: wings/);
  assert.match(prompt, /Skip vocabulary parts that do not apply/);
  assert.match(prompt, /"character": "Sample Character"/);
  assert.match(prompt, /exactly ONE isolated reference image/);
  assert.doesNotMatch(prompt, /User-requested additions/);

  const withExtra = composeAnalyzePrompt("Sample Character", undefined, "靴も別パーツにしてほしい");
  assert.match(withExtra, /User-requested additions/);
  assert.match(withExtra, /靴も別パーツにしてほしい/);
});

test("parseKitParts accepts raw JSON, fenced blocks, and objects", () => {
  const parts = [{ key: "face-front", label: "顔", category: "master", prompt: "face prompt" }];
  assert.deepEqual(parseKitParts(parts), parts);
  assert.deepEqual(parseKitParts({ character: "x", parts }), parts);
  assert.deepEqual(parseKitParts(JSON.stringify({ parts })), parts);
  assert.deepEqual(parseKitParts("```json\n" + JSON.stringify({ parts }) + "\n```"), parts);
  assert.throws(() => parseKitParts("not json"));
});

test("base kit: analyze request, complete with parts, and paste import create base entries", async () => {
  await withServer(async ({ baseUrl, context, temp }) => {
    const initial = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const entryId = initial.characters[0].images[0].id;
    const png = join(temp, "key-visual.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: "sample-character", entryId, sourceFile: basename(png), name: "key-visual", adopted: true }),
    }).then((response) => response.json());
    const sourceAsset = assetResult.asset;

    const presets = await fetch(`${baseUrl}/api/base-kit/presets`).then((response) => response.json());
    assert.equal(presets.ok, true);
    assert.ok(presets.parts.some((part) => part.key === "face-front"));

    const analyze = await fetch(`${baseUrl}/api/base-kit/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        sourceEntryId: entryId,
        sourceAssetId: sourceAsset.id,
        extraRequest: "靴も別パーツにしてほしい",
      }),
    }).then((response) => response.json());
    assert.equal(analyze.ok, true);
    assert.equal(analyze.request.targets[0].action, "analyze");
    assert.equal(analyze.request.targets[0].parts.length, presets.parts.length);
    assert.match(analyze.request.targets[0].prompt, /YOU decide which parts to include/);
    assert.match(analyze.request.targets[0].prompt, /靴も別パーツにしてほしい/);
    assert.equal(analyze.request.service, "chatgpt");
    assert.deepEqual(analyze.request.targets[0].inputs.refImages, [sourceAsset.file]);
    assert.match(analyze.request.targets[0].prompt, /画像分析タスク/);
    const queuedAsset = analyze.state.characters[0].images[0].assets.find((item) => item.id === sourceAsset.id);
    assert.equal(queuedAsset.requestStatus, "requested");
    assert.equal(analyze.requests[0].action, "analyze");

    const partsJson = {
      character: "Sample Character",
      parts: [
        { key: "face-front", label: "顔アップ（正面）", category: "master", prompt: "face close-up prompt" },
        { key: "horns", label: "角", category: "accessory", prompt: "horns prompt" },
        { key: "broken", label: "", category: "accessory", prompt: "" },
      ],
    };
    const complete = await fetch(`${baseUrl}/api/requests/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: analyze.request.requestId,
        targetIndex: 0,
        parts: partsJson,
      }),
    }).then((response) => response.json());
    assert.equal(complete.ok, true);
    assert.equal(complete.completed, 1);
    assert.equal(complete.kitResultsStored, 1);
    // complete stores the analysis for user selection; no entries are created yet
    assert.equal(complete.state.characters[0].base.master.some((item) => item.id.startsWith("base-kit")), false);
    assert.equal(complete.kitResults.length, 1);
    assert.equal(complete.kitResults[0].requestId, analyze.request.requestId);
    assert.equal(complete.kitResults[0].parts.length, 3);
    const completedAsset = complete.state.characters[0].images[0].assets.find((item) => item.id === sourceAsset.id);
    assert.equal(completedAsset.requestStatus, "idle");
    const requestPayload = JSON.parse(readFileSync(join(context.requestDir, `${analyze.request.requestId}.json`), "utf8"));
    assert.equal(requestPayload.status, "completed");
    assert.equal(requestPayload.targets[0].analysisParts.length, 3);

    const listedResults = await fetch(`${baseUrl}/api/base-kit/results`).then((response) => response.json());
    assert.equal(listedResults.kitResults.length, 1);

    // user selects only the face part and imports
    const selected = await fetch(`${baseUrl}/api/base-kit/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        sourceEntryId: entryId,
        sourceAssetId: sourceAsset.id,
        requestId: analyze.request.requestId,
        targetIndex: 0,
        parts: [partsJson.parts[0]],
      }),
    }).then((response) => response.json());
    assert.equal(selected.ok, true);
    assert.equal(selected.created.length, 1);
    const character = selected.state.characters[0];
    const faceEntry = character.base.master.find((item) => item.id.startsWith("base-kit-face-front"));
    assert.equal(faceEntry.prompt, "face close-up prompt");
    assert.deepEqual(faceEntry.tags, ["base-kit"]);
    assert.equal(faceEntry.assets[0].name, "source-reference");
    assert.equal(faceEntry.assets[0].file, sourceAsset.file);
    // 参照画像は「採用」の対象外（採用は生成画像だけの概念）
    assert.equal(faceEntry.assets[0].adopted, false);
    assert.deepEqual(faceEntry.assets[0].tags, ["source-reference"]);
    assert.equal(character.base.accessory.some((item) => item.id.startsWith("base-kit-horns")), false);
    // imported result no longer appears as pending
    assert.equal(selected.kitResults.length, 0);

    const pasted = await fetch(`${baseUrl}/api/base-kit/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        sourceEntryId: entryId,
        sourceAssetId: sourceAsset.id,
        json: "```json\n" + JSON.stringify({ parts: [{ key: "tail", label: "尻尾", category: "accessory", prompt: "tail prompt" }] }) + "\n```",
      }),
    }).then((response) => response.json());
    assert.equal(pasted.ok, true);
    assert.equal(pasted.created.length, 1);
    const tailEntry = pasted.state.characters[0].base.accessory.find((item) => item.id.startsWith("base-kit-tail"));
    assert.equal(tailEntry.prompt, "tail prompt");

    const badImport = await fetch(`${baseUrl}/api/base-kit/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: "sample-character", json: "not json at all" }),
    });
    assert.equal(badImport.status, 400);
    assert.equal((await badImport.json()).error, "Invalid analysis JSON");
  });
});

test("error reporting marks targets and deck entries, allowing retry", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const state = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const entryId = state.characters[0].images[0].id;
    const queued = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: state.characters[0].id,
        mode: "image",
        targets: [{ entryId, overview: "will fail", prompt: "p", inputs: { startFrame: null, endFrame: null, refImages: [] } }],
      }),
    }).then((response) => response.json());

    const errored = await fetch(`${baseUrl}/api/requests/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: queued.request.requestId,
        targetIndex: 0,
        error: "コンテンツポリシーで2回拒否",
      }),
    }).then((response) => response.json());
    assert.equal(errored.ok, true);
    assert.equal(errored.errored, 1);
    assert.equal(errored.completed, 0);
    assert.equal(errored.state.characters[0].images[0].requestStatus, "error");
    assert.equal(errored.requests.length, 0);
    const payload = JSON.parse(readFileSync(join(context.requestDir, `${queued.request.requestId}.json`), "utf8"));
    assert.equal(payload.status, "error");
    assert.equal(payload.targets[0].status, "error");
    assert.equal(payload.targets[0].errorMessage, "コンテンツポリシーで2回拒否");

    // 再キュー（リトライ）すると requested に戻る
    const retry = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: state.characters[0].id,
        mode: "image",
        targets: [{ entryId, overview: "retry", prompt: "p2", inputs: { startFrame: null, endFrame: null, refImages: [] } }],
      }),
    }).then((response) => response.json());
    assert.equal(retry.state.characters[0].images[0].requestStatus, "requested");
  });
});

test("binary upload registers the file into workspace assets", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const state = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
    const entryId = state.characters[0].images[0].id;
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const uploaded = await fetch(
      `${baseUrl}/api/assets/upload?characterId=sample-character&entryId=${encodeURIComponent(entryId)}&filename=${encodeURIComponent("My Sheet.png")}`,
      { method: "POST", body },
    ).then((response) => response.json());
    assert.equal(uploaded.ok, true);
    assert.match(uploaded.asset.file, /assets\/sample-character\/.+\/My-Sheet\.png$/);
    const absolute = join(context.projectRoot, uploaded.asset.file);
    assert.deepEqual([...readFileSync(absolute)], [...body]);
    const entry = uploaded.state.characters[0].images.find((item) => item.id === entryId);
    assert.equal(entry.assets.at(-1).id, uploaded.asset.id);

    const bad = await fetch(`${baseUrl}/api/assets/upload?characterId=sample-character&entryId=${encodeURIComponent(entryId)}&filename=evil.exe`, { method: "POST", body });
    assert.equal(bad.status, 400);
  });
});

test("doctor passes public sample workspace", () => {
  const temp = mkdtempSync(join(tmpdir(), "image-arranger-doctor-"));
  const result = runDoctor({
    stateFile: join(temp, "deck.json"),
    requestDir: join(temp, "requests"),
    outputDir: join(temp, "outputs"),
    assetDir: join(temp, "assets"),
    projectRoot: temp,
    init: "sample",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.publish.errors, []);
});

test("server rejects unsafe paths and oversized bodies with sanitized errors", async () => {
  await withServer(async ({ baseUrl }) => {
    const traversal = await fetch(`${baseUrl}/asset?path=../server.mjs`);
    assert.equal(traversal.status, 403);
    const traversalPayload = await traversal.json();
    assert.equal(traversalPayload.error, "Path is outside the allowed directory");
    assert.doesNotMatch(JSON.stringify(traversalPayload), /server\.mjs/);

    const tooLarge = await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: `"${"x".repeat(1_000_001)}"`,
    });
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).error, "Request body too large");
  });
});

test("PUT /api/state rejects a stale snapshot with 409", async () => {
  await withServer(async ({ baseUrl }) => {
    const snapshot = await (await fetch(`${baseUrl}/api/state`)).json();
    const first = await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    assert.equal(first.status, 200);

    const stale = await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).ok, false);
  });
});

test("draft-prompt completion imports the prompt and auto-queues generation", async () => {
  await withServer(async ({ baseUrl }) => {
    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    const character = state.characters[0];
    const entryItem = character.images[0];
    assert.ok(entryItem, "sample deck should have an image entry");

    const created = await (await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        mode: "image",
        targets: [{
          action: "draft-prompt",
          entryId: entryItem.id,
          overview: entryItem.overview,
          prompt: "",
          referenceUrl: "https://x.com/example/status/1",
          inputs: { startFrame: null, endFrame: null, refImages: [] },
        }],
      }),
    })).json();
    assert.equal(created.request.targets[0].action, "draft-prompt");
    assert.equal(created.request.targets[0].referenceUrl, "https://x.com/example/status/1");

    const completed = await (await fetch(`${baseUrl}/api/requests/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: created.request.requestId,
        targetIndex: 0,
        overview: "Drafted title",
        prompt: "Drafted prompt from the reference URL",
      }),
    })).json();
    assert.equal(completed.completed, 1);
    assert.equal(completed.draftQueued.length, 1);

    const updatedEntry = completed.state.characters
      .find((item) => item.id === character.id).images
      .find((item) => item.id === entryItem.id);
    assert.equal(updatedEntry.prompt, "Drafted prompt from the reference URL");
    assert.equal(updatedEntry.overview, "Drafted title");

    const queued = completed.requests.find((row) => row.requestId === completed.draftQueued[0]);
    assert.ok(queued, "generation request should be queued");
    assert.equal(queued.action, "generate");
    assert.equal(queued.overview, "Drafted title");
    assert.equal(queued.prompt, "Drafted prompt from the reference URL");
    assert.equal(queued.referenceUrl, "https://x.com/example/status/1");
    assert.equal(updatedEntry.requestStatus, "requested");
  });
});

test("requests with a non-loopback Host header are rejected", async () => {
  await withServer(async ({ baseUrl }) => {
    const ok = await fetch(`${baseUrl}/api/state`);
    assert.equal(ok.status, 200);

    // fetch() refuses to override Host, so issue a raw HTTP request.
    const { request: httpRequest } = await import("node:http");
    const status = await new Promise((resolveStatus, rejectStatus) => {
      const req = httpRequest(`${baseUrl}/api/state`, { headers: { Host: "evil.example" } }, (res) => {
        res.resume();
        resolveStatus(res.statusCode);
      });
      req.on("error", rejectStatus);
      req.end();
    });
    assert.equal(status, 403);
  });
});

test("state-changing requests with a foreign Origin are rejected", async () => {
  await withServer(async ({ baseUrl }) => {
    const evilOrigin = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({}),
    });
    assert.equal(evilOrigin.status, 403);

    const localOrigin = await fetch(`${baseUrl}/api/requests/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ targets: [{ entryId: "missing-entry" }] }),
    });
    assert.notEqual(localOrigin.status, 403);
  });
});

test("non-JSON bodies are rejected with 415", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "characterId=sample",
    });
    assert.equal(response.status, 415);
  });
});

test("/asset serves only workspace asset and output files", async () => {
  await withServer(async ({ baseUrl, context, temp }) => {
    writeFileSync(join(context.assetDir, "ok.png"), "png-bytes");
    const served = await fetch(`${baseUrl}/asset?path=${encodeURIComponent(join(context.assetDir, "ok.png").slice(context.projectRoot.length + 1))}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("access-control-allow-origin"), null);

    for (const path of ["server.mjs", "deck.json", "../etc/hosts"]) {
      const blocked = await fetch(`${baseUrl}/asset?path=${encodeURIComponent(path)}`);
      assert.ok([403, 404].includes(blocked.status), `${path} should not be served (got ${blocked.status})`);
    }
  });
});

test("absolute sourceFile paths are rejected when registering assets", async () => {
  await withServer(async ({ baseUrl, temp }) => {
    const outside = join(temp, "outside.png");
    writeFileSync(outside, "png-bytes");
    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    const character = state.characters[0];
    const response = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        entryId: character.images[0].id,
        sourceFile: outside,
      }),
    });
    assert.equal(response.status, 400);
  });
});

test("sample init seeds placeholder assets with provenance", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    const character = state.characters[0];
    const masterAssets = character.base.master[0].assets;
    const imageAssets = character.images[0].assets;
    assert.equal(masterAssets.length, 1);
    assert.equal(masterAssets[0].adopted, true);
    assert.equal(imageAssets.length, 2);
    assert.equal(imageAssets.filter((asset) => asset.adopted).length, 1);
    for (const asset of [...masterAssets, ...imageAssets]) {
      assert.ok(asset.sourceLicense, "placeholder has a sourceLicense");
      assert.equal(typeof asset.aiGenerated, "boolean");
      const served = await fetch(`${baseUrl}/asset?path=${encodeURIComponent(asset.file)}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get("content-type"), "image/png");
    }
    assert.ok(masterAssets[0].file.endsWith("base-reference.png"));
  });
});

// ---------------------------------------------------------------------------
// P3-DATA-2: schema migration guard + lossless legacy migration
// ---------------------------------------------------------------------------

test("legacy prompt-deck.v1 deck migrates losslessly to current schema", async () => {
  const temp = mkdtempSync(join(tmpdir(), "image-arranger-migrate-"));
  const stateFile = join(temp, "deck.json");
  const legacy = createEmptyState();
  legacy.schema = "prompt-deck.v1";
  // give a character a legacy material workflow + an asset missing new fields
  legacy.characters[0].workflow = "material";
  legacy.characters[0].images.push({
    id: "legacy-image",
    overview: "Legacy entry",
    prompt: "legacy prompt",
    version: 1,
    checked: false,
    requestStatus: "idle",
    tags: ["keepme"],
    assets: [{ id: "legacy-asset", kind: "image", file: "assets/x.png", name: "x" }],
  });
  writeFileSync(stateFile, JSON.stringify(legacy, null, 2));

  const created = createImageArrangerServer({
    port: 0,
    stateFile,
    requestDir: join(temp, "requests"),
    outputDir: join(temp, "outputs"),
    assetDir: join(temp, "assets"),
    projectRoot: temp,
    init: "empty",
  });
  await new Promise((resolve) => created.server.listen(0, "127.0.0.1", resolve));
  const port = created.server.address().port;
  let migrated;
  try {
    migrated = await (await fetch(`http://127.0.0.1:${port}/api/state`)).json();
  } finally {
    await new Promise((resolve) => created.server.close(resolve));
  }

  assert.equal(migrated.schema, "image-arranger.v1");
  // user data preserved losslessly
  const entry = migrated.characters[0].images.find((item) => item.id === "legacy-image");
  assert.ok(entry, "legacy image entry survives migration");
  assert.equal(entry.prompt, "legacy prompt");
  assert.deepEqual(entry.tags, ["keepme"]);
  // migration backfills provenance fields on existing assets
  const asset = entry.assets[0];
  assert.equal(asset.id, "legacy-asset");
  assert.equal(asset.sourceLicense, "");
  assert.equal(typeof asset.aiGenerated, "boolean");
  assert.equal(typeof asset.humanReviewed, "boolean");
});

test("a deck with a newer schema triggers the forward-compat guard and is backed up", async () => {
  await withServer(async ({ baseUrl, context }) => {
    // Overwrite the on-disk deck with one claiming a schema from a future server.
    const newer = createEmptyState();
    newer.schema = "image-arranger.v999";
    writeFileSync(context.stateFile, JSON.stringify(newer, null, 2));

    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.equal(payload.ok, false);

    // The newer deck must be preserved (a backup written), not silently mutated.
    assert.ok(existsSync(`${context.stateFile}.bak`), "newer deck is backed up before refusal");
    const onDisk = JSON.parse(readFileSync(context.stateFile, "utf8"));
    assert.equal(onDisk.schema, "image-arranger.v999", "newer deck on disk is left untouched");
  });
});

test("PUT /api/state with a newer-schema body is refused", async () => {
  await withServer(async ({ baseUrl }) => {
    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    state.schema = "image-arranger.v999";
    const response = await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    assert.equal(response.status, 409);
  });
});

// ---------------------------------------------------------------------------
// P3-DATA-1: backup-on-save + full-deck JSON export/import round-trip
// ---------------------------------------------------------------------------

test("mutating the deck writes a .bak and a rotating .history snapshot", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    state.characters[0].description = "edited for backup test";
    const saved = await fetch(`${baseUrl}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    assert.equal(saved.status, 200);

    assert.ok(existsSync(`${context.stateFile}.bak`), "deck.json.bak exists after a save");
    const historyDir = join(context.stateFile, "..", ".history");
    const snapshots = readdirSync(historyDir).filter((name) => name.startsWith("deck.json."));
    assert.ok(snapshots.length >= 1, "a timestamped history snapshot was written");
  });
});

test("full deck export/import round-trips through JSON endpoints", async () => {
  await withServer(async ({ baseUrl }) => {
    const original = await (await fetch(`${baseUrl}/api/state`)).json();

    const exported = await fetch(`${baseUrl}/api/deck/export`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-type"), /application\/json/);
    assert.match(exported.headers.get("content-disposition"), /image-arranger-deck-.*\.json/);
    const exportedDeck = await exported.json();
    assert.equal(exportedDeck.schema, original.schema);

    // mutate the deck, then re-import the exported snapshot to restore it
    exportedDeck.characters[0].description = "restored via import";
    const imported = await fetch(`${baseUrl}/api/deck/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck: exportedDeck }),
    });
    assert.equal(imported.status, 200);
    const importPayload = await imported.json();
    assert.equal(importPayload.ok, true);
    assert.equal(importPayload.state.characters[0].description, "restored via import");

    const reread = await (await fetch(`${baseUrl}/api/state`)).json();
    assert.equal(reread.characters[0].description, "restored via import");
    assert.equal(reread.characters.length, original.characters.length);
  });
});

test("deck import rejects a body that is not a deck", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/deck/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "a deck" }),
    });
    assert.equal(response.status, 400);
  });
});

// ---------------------------------------------------------------------------
// P3-PERF-1: HTTP Range / 206 support
// ---------------------------------------------------------------------------

test("/asset honors Range requests with 206 Partial Content", async () => {
  await withServer(async ({ baseUrl, context }) => {
    const bytes = Buffer.from(Array.from({ length: 2048 }, (_, i) => i % 256));
    writeFileSync(join(context.assetDir, "clip.png"), bytes);
    const rel = encodeURIComponent("assets/clip.png");

    const full = await fetch(`${baseUrl}/asset?path=${rel}`);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(full.headers.get("content-length"), String(bytes.length));

    const partial = await fetch(`${baseUrl}/asset?path=${rel}`, { headers: { Range: "bytes=10-19" } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), `bytes 10-19/${bytes.length}`);
    assert.equal(partial.headers.get("content-length"), "10");
    const partialBytes = Buffer.from(await partial.arrayBuffer());
    assert.deepEqual([...partialBytes], [...bytes.subarray(10, 20)]);

    const suffix = await fetch(`${baseUrl}/asset?path=${rel}`, { headers: { Range: "bytes=-8" } });
    assert.equal(suffix.status, 206);
    const suffixBytes = Buffer.from(await suffix.arrayBuffer());
    assert.deepEqual([...suffixBytes], [...bytes.subarray(bytes.length - 8)]);

    const unsatisfiable = await fetch(`${baseUrl}/asset?path=${rel}`, { headers: { Range: "bytes=99999-100000" } });
    assert.equal(unsatisfiable.status, 416);
    assert.equal(unsatisfiable.headers.get("content-range"), `bytes */${bytes.length}`);
  });
});

// ---------------------------------------------------------------------------
// P3-SEC-1: Content-Security-Policy on HTML responses
// ---------------------------------------------------------------------------

test("HTML responses carry a strict Content-Security-Policy", async () => {
  await withServer(async ({ baseUrl }) => {
    const html = await fetch(`${baseUrl}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type"), /text\/html/);
    const csp = html.headers.get("content-security-policy");
    assert.ok(csp, "CSP header present on HTML");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);

    // Non-HTML responses (JSON API) should not carry the HTML CSP.
    const api = await fetch(`${baseUrl}/api/state`);
    assert.equal(api.headers.get("content-security-policy"), null);
  });
});

// ---------------------------------------------------------------------------
// P3-CQ-3: doctor / validateStateForPublish safety scanner
// ---------------------------------------------------------------------------

test("doctor flags secret strings, absolute paths, and missing provenance", () => {
  const temp = mkdtempSync(join(tmpdir(), "image-arranger-doctor-bad-"));
  const stateFile = join(temp, "deck.json");
  const state = createEmptyState();
  const character = state.characters[0];
  // a secret-like string embedded in a prompt
  character.base.master[0].prompt = "use key sk-abcdef0123456789ABCDEF for the model";
  // an entry whose asset has an absolute path and no sourceLicense
  character.images.push({
    id: "bad-image",
    overview: "Bad",
    prompt: "p",
    version: 1,
    checked: false,
    requestStatus: "idle",
    tags: [],
    assets: [{
      id: "bad-asset",
      kind: "image",
      file: "/Users/someone/secret/photo.png",
      name: "leak",
      adopted: true,
      prompt: "",
      // sourceLicense intentionally omitted
    }],
  });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));

  const result = runDoctor({
    stateFile,
    requestDir: join(temp, "requests"),
    outputDir: join(temp, "outputs"),
    assetDir: join(temp, "assets"),
    projectRoot: temp,
    init: "empty",
  });

  assert.equal(result.ok, false, "doctor fails when errors are present");
  const errors = result.checks.publish.errors.join("\n");
  const warnings = result.checks.publish.warnings.join("\n");
  // secret pattern matched
  assert.match(errors, /Secret-like text/);
  // absolute asset path is an error
  assert.match(errors, /absolute path/);
  // absolute /Users/ path also trips the project-specific warning
  assert.match(warnings, /Project-specific text|outside project-relative/);
  // missing sourceLicense surfaces as a warning
  assert.match(warnings, /missing sourceLicense/);
});

test("doctor passes a clean empty deck with no findings", () => {
  const temp = mkdtempSync(join(tmpdir(), "image-arranger-doctor-clean-"));
  const stateFile = join(temp, "deck.json");
  writeFileSync(stateFile, JSON.stringify(createEmptyState(), null, 2));
  const result = runDoctor({
    stateFile,
    requestDir: join(temp, "requests"),
    outputDir: join(temp, "outputs"),
    assetDir: join(temp, "assets"),
    projectRoot: temp,
    init: "empty",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.publish.errors, []);
});
