# Releasing

A release is one click: **Actions → Release → Run workflow**, pick a bump type,
and the workflow bumps the version, writes the changelog, builds the extension,
tags and pushes, creates the GitHub release, and submits the ZIP to the Chrome
Web Store.

| Input            | Default   | Effect                                                     |
| ---------------- | --------- | ---------------------------------------------------------- |
| `bump`           | —         | `patch` \| `minor` \| `major`                              |
| `publish_to_cws` | `true`    | Uncheck to cut a GitHub release only                       |
| `cws_target`     | `default` | `default` = everyone, `trustedTesters` = your tester group |

The Chrome Web Store step runs last, so a store failure never leaves a
half-finished git state. If it fails, fix the cause and re-submit the same
artifact by hand — no version re-bump needed:

```bash
CWS_EXTENSION_ID=… CWS_CLIENT_ID=… CWS_CLIENT_SECRET=… CWS_REFRESH_TOKEN=… pnpm publish:cws release/crx-linear-web-clipper-2.2.3.zip
```

## One-time setup: Chrome Web Store credentials

The store step needs four repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret              | Where it comes from                                       |
| ------------------- | --------------------------------------------------------- |
| `CWS_EXTENSION_ID`  | The 32-character ID in the item's Developer Dashboard URL |
| `CWS_CLIENT_ID`     | Google Cloud OAuth client                                 |
| `CWS_CLIENT_SECRET` | Google Cloud OAuth client                                 |
| `CWS_REFRESH_TOKEN` | The OAuth flow below                                      |

### 1. Create an OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project and enable the **Chrome Web Store API**.
2. Configure the OAuth consent screen as **External**, and add your developer
   account as a test user. It can stay in "Testing" — no verification needed.
3. **Credentials → Create credentials → OAuth client ID → Desktop app.** Copy
   the client ID and client secret.

### 2. Get a refresh token

Open this URL in a browser, signed in as the account that owns the extension
(substitute your client ID):

```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&access_type=offline&prompt=consent
```

Approve, copy the authorization code, and exchange it — this is the only time
the code works, and `refresh_token` is only returned on this first exchange:

```bash
curl -s https://oauth2.googleapis.com/token -d client_id=YOUR_CLIENT_ID -d client_secret=YOUR_CLIENT_SECRET -d code=YOUR_AUTH_CODE -d grant_type=authorization_code -d redirect_uri=urn:ietf:wg:oauth:2.0:oob
```

Store the `refresh_token` from the response as `CWS_REFRESH_TOKEN`. While the
consent screen is in "Testing" mode, Google expires refresh tokens after 7 days
— publish the consent screen (no verification required for this scope) to get a
long-lived one.

### 3. Verify without touching the store

```bash
CWS_EXTENSION_ID=… CWS_CLIENT_ID=… CWS_CLIENT_SECRET=… CWS_REFRESH_TOKEN=… pnpm publish:cws release/crx-linear-web-clipper-2.2.3.zip --dry-run
```

`--dry-run` checks the credentials are present and the ZIP exists, then exits
before any API call. To upload a draft without submitting it for review, use
`--upload-only`. For a staged rollout, add `--deploy-percentage=25`.

## What the store does after submission

Publishing is a submission, not an instant release — the new version goes live
only after Google's review, which usually takes hours but can take days. A
rejected review shows up in the Developer Dashboard, not in this workflow: the
workflow only reports whether the submission was accepted.
