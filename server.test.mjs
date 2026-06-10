import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { composeAnalyzePrompt, createImageArrangerServer, createSeedState, parseKitParts, runDoctor } from "./server.mjs";


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
  assert.equal(character.images[0].useBaseRefs, true);
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
        sourceFile: png,
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
    assert.equal(queueResult.state.characters[0].images[0].assets[0].requestStatus, "requested");

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
    assert.equal(firstCancel.state.characters[0].images[0].assets[0].requestStatus, "requested");

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
    assert.equal(cancelResult.state.characters[0].images[0].assets[0].requestStatus, "idle");

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
        sourceFile: png,
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
        sourceFile: png,
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
        sourceFile: png,
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

    const png = join(temp, "candidate.png");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const entryId = characterResult.state.characters[0].images[0].id;
    const assetResult = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "sample-character",
        entryId,
        sourceFile: png,
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
      body: JSON.stringify({ characterId: "sample-character", entryId, sourceFile: png, name: "key-visual", adopted: true }),
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
