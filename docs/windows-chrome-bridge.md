# Windows Chrome Bridge Setup

image-arranger's server and request files work on Windows with Node 20+. Browser
queue automation needs Node 22+ and the image-arranger Chrome Bridge extension
installed in the exact normal Chrome profile selected for the target service.

The bridge exists to preserve the same safety rule as macOS: queue processors
reuse a marker tab in the selected signed-in Chrome profile. They do not launch a
new Chrome profile, do not use a generated `--user-data-dir`, and do not switch
to Codex-local image generation.

## One-Time Setup

1. Start image-arranger:

   ```powershell
   npm start
   ```

2. Choose the Chrome profile for each service:

   ```powershell
   node scripts/process-service-queue.mjs --setup-profile --service chatgpt
   node scripts/process-service-queue.mjs --setup-profile --service vidu
   ```

   The selected profile is saved under `workspace/.local/<service>-profile.json`.
   Do not commit those files.

3. In the same selected Chrome profile, install the bridge extension:

   - Open `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked**.
   - Select the repository folder `extensions/chrome-bridge`.
   - Keep the extension enabled in that profile.
   - The extension must show the `identity.email` permission. Without it, Chrome
     does not expose the signed-in profile email and the bridge fails closed.

4. Ensure the marker URL printed by the check command is open in the same
   selected Chrome profile. Prefer a profile-safe Chrome-control setup/repair
   route when available; manual opening in that selected profile is the
   fallback. The URL must include both `profile-directory` and `profile-email`.
   Example:

   ```text
   https://www.vidu.com/ja/create/img2video?agent-work=image-arranger-vidu&profile-directory=Default&profile-email=you@example.com
   ```

## Preflight

Run the service check from PowerShell:

```powershell
node scripts/process-service-queue.mjs --check --service vidu --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --check --service chatgpt --ensure-tab --server http://127.0.0.1:4217
```

On Windows, these commands start a local-only relay on `127.0.0.1:4218`. The
installed bridge extension long-polls that relay and executes commands only in a
tab whose URL contains the expected marker. If no extension is connected from
the selected profile, the command times out instead of falling back to a wrong
profile.

The bridge checks the Chrome profile email reported by the extension against the
`profile-email` marker. Chrome extensions cannot read Chrome's profile directory
name directly, so the first successful `--check` also records the bridge
extension's `clientId` and `extensionId` into
`workspace/.local/<service>-profile.json`. Later runs send commands only to that
bound extension client. If you reinstall the extension, clear the saved
`bridgeClientId` / `bridgeExtensionId` by rerunning `--setup-profile` and then
run `--check` again.

Do not keep the bridge extension enabled in multiple Chrome profiles using the
same Google account during the first binding check. If the host sees the marker
only through the wrong profile, the wrong extension client can be bound; remove
the bridge from non-selected profiles, rerun setup, and bind again. When more
than one unbound bridge client reports the same email, the scripts stop before
binding instead of guessing.

Before the first binding, the selected email must also be unique in Chrome
`Local State`. If two Chrome profiles use the same signed-in email, the scripts
stop because the extension API cannot prove Chrome's profile directory name.
After a profile has a saved `bridgeClientId` / `bridgeExtensionId`, later runs
use that saved binding.

The bridge listens on fixed port `4218`. Do not change the port for normal
Windows use; the unpacked extension polls that fixed local address.

## Processing

After preflight passes:

```powershell
node scripts/process-service-queue.mjs --dry-run --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217
```

ChatGPT image targets attach reference images as browser `File` objects in the
bound marker tab, insert the prompt, click the visible ChatGPT send button, wait
on the same bound tab after it becomes `/c/...`, click the normal ChatGPT image
save button, and copy the downloaded file into the requested `outputDir`.

Vidu targets use `inputs.startFrame` and `inputs.endFrame`, then submit and save
through the normal Vidu UI.

## Troubleshooting

- If the check says no connected client exists, confirm the extension is loaded
  in the selected Chrome profile and that Chrome is running.
- If the error says the bridge email is unavailable, reload the extension and
  confirm the `identity.email` permission is present. Also confirm Chrome is
  signed in to the intended profile.
- If `allConnectedClients` shows a different email, the extension is loaded in
  the wrong Chrome profile. Install it in the selected profile instead.
- If the check finds no marker tab, prepare the exact URL printed by the script
  in the selected profile. Use a profile-safe Chrome-control route when
  available; manual opening in that selected profile is the fallback.
- If the Chrome extension shows a debugger warning, that is expected. The bridge
  uses Chrome's extension `debugger` permission to evaluate page JavaScript in the
  marker tab without launching a CDP automation profile.
- Do not fix Windows failures by using `--user-data-dir`, `--profile-directory`,
  Codex image generation, screenshots, placeholder files, or browser cache/blob
  extraction.
