# Chapter 10: The GitHub Actions Workflow

In the previous chapter we covered the local CI setup — headless mode, daemon lifecycle, env vars, recordings. This chapter puts it all together into the GitHub Actions workflow that runs your suite on every push, and shows you exactly how to watch it run.

---

## GitHub Actions in 60 seconds

If you haven't used GitHub Actions before, here's the minimum you need to know.

A **workflow** is a YAML file in `.github/workflows/` in your repository. GitHub runs it automatically in response to events you define — for us, a push to `main` or a pull request targeting `main`. The `on:` key defines these triggers.

A workflow contains **jobs**. Each job runs on a **runner** — a temporary virtual machine GitHub spins up and discards when the job finishes. The `runs-on:` key specifies the operating system.

A job contains **steps**, which run sequentially. Each step either uses a pre-built action (`uses: actions/checkout@v4`) or runs a shell command (`run: npm ci`). Steps can pass data to each other through environment variables.

That's the whole model. Everything else in this chapter is Vibium-specific configuration layered on top of it.

---

## The complete GitHub Actions workflow

Create `.github/workflows/tests.yml` in your repository:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    container: ghcr.io/lana-20/vibium-ci:latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start Vibium daemon
        run: vibium daemon start
        env:
          HOME: /root

      - name: Run tests
        run: npm run test:ci
        env:
          CI: true
          HOME: /root
          AUT_BASE_URL: ${{ vars.AUT_BASE_URL }}

      - name: Stop Vibium daemon
        if: always()
        run: vibium daemon stop
        env:
          HOME: /root
```

Walk through it step by step.

**`container: ghcr.io/lana-20/vibium-ci:latest`** tells GitHub Actions to run every step inside a pre-built Docker image rather than directly on the runner. That image already has Chrome downloaded and patched. When the job starts, Chrome is ready immediately — no download, no setup step. Chapter 11 explains how that image is built.

**`HOME: /root`** appears on every step that touches Vibium. The CI image was built as root, so Chrome lives at `/root/.cache/vibium`. GitHub Actions containers run with a non-root user by default, so each step that invokes Vibium must override `HOME` to point to the right directory.

**`workflow_dispatch`** makes the workflow manually triggerable from the Actions tab — useful when you want to re-run without pushing a commit.

**`AUT_BASE_URL`** comes from your repo's Settings → Secrets and variables → Actions → Variables tab. Leave it unset to use the default; set it to point tests at a different environment (staging, preview, local tunnel).

**`npm run test:ci`** uses the verbose reporter (`vitest run --reporter=verbose`) so each test name appears individually in the log output.

---

## Watching it run

Push the workflow file and open your repository on github.com. Click the **Actions** tab. You'll see the workflow run start within seconds.

Click into the run. You'll see each step execute in real time: checkout → setup-node → install → daemon start → tests → daemon stop. Green checkmarks as each step completes.

Click into the "Run tests" step to see Vitest output. In verbose mode it prints each test name and its pass/fail status — you can see exactly which tests ran and which failed without reading the whole log.

---

## Deliberately breaking a test

The best way to understand the CI feedback loop is to see it fail. Change one assertion in your test suite to something wrong — assert the page title equals `"wrong title"`. Push. Watch the Actions tab go red.

Click into the failing step. You'll see Vitest output with the failure message and the recording URL (if you added `vibium.record()` in Chapter 9). Open the recording at `player.vibium.dev`, scrub to the failing assertion, and read the DOM panel. It shows exactly what the browser had on screen at the moment the test failed.

Revert the change. Push. Watch it go green. That sequence — push, fail, record, fix, green — is the CI feedback loop you'll use for the rest of your career. Get comfortable with it now.

---

## Exercise

Set up GitHub Actions for your course project and run through the full feedback loop:

1. Create `.github/workflows/tests.yml` with the workflow from this chapter
2. Push it to your GitHub repo and confirm the Actions tab shows a green run
3. Intentionally break one test (wrong expected title), push, confirm the run goes red
4. Find the failing step in the Actions log and read the Vitest error output
5. If you added recording in Chapter 9, find the `player.vibium.dev` URL and open it
6. Revert the break, push, confirm the run goes green

After completing this, you have a working CI pipeline. Every future push will run your test suite automatically.

---

## Quiz

**1.** What does the `container:` key in a GitHub Actions job do?

- A. Runs each test in an isolated Docker container
- B. Tells GitHub to run every step inside a specified Docker image instead of on the bare runner
- C. Builds a Docker image as part of the job
- D. Restricts the job to specific runner labels

**2.** Why does `HOME: /root` appear on the daemon start, test, and daemon stop steps?

- A. It sets the working directory for the step
- B. GitHub Actions containers use a non-root user; Vibium's Chrome is at `/root/.cache/vibium`, so `HOME` must be overridden for each step that calls Vibium
- C. It is required by `npm ci`
- D. Without it, the daemon starts as a different user

**3.** `workflow_dispatch:` in the `on:` block allows:

- A. Running the workflow on a schedule
- B. Triggering the workflow manually from the Actions tab without a push
- C. Running on pull requests only
- D. Running the workflow inside a Docker container

**4.** The `AUT_BASE_URL` variable is set under Settings → Variables rather than Secrets because:

- A. Variables run faster than secrets in CI
- B. Base URLs are not sensitive — they can be visible in logs; secrets are for credentials
- C. Secrets are not available to `vars.*` syntax
- D. Variables are required for container jobs; secrets are not

**5.** `npm run test:ci` uses `--reporter=verbose` in CI because:

- A. The default reporter fails on Linux
- B. Verbose output prints each test name and status individually, making log scanning faster when looking for a specific failure
- C. It is required by the Vitest container integration
- D. Verbose mode retries flaky tests automatically

**Answers:** 1-B, 2-B, 3-B, 4-B, 5-B

## Solution

The solution for this chapter is the `.github/workflows/tests.yml` file itself. Here it is with inline comments explaining each decision:

```yaml
name: Tests

on:
  push:
    branches: [main]          # run on every push to main
  pull_request:
    branches: [main]          # run on PRs targeting main
  workflow_dispatch:          # allow manual trigger from Actions tab

jobs:
  test:
    runs-on: ubuntu-latest
    container: ghcr.io/lana-20/vibium-ci:latest   # pre-baked Chrome

    steps:
      - uses: actions/checkout@v4                  # get the code

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'                             # cache node_modules for speed

      - name: Install dependencies
        run: npm ci                                # clean install from lockfile

      - name: Start Vibium daemon
        run: vibium daemon start
        env:
          HOME: /root                             # find Chrome at /root/.cache/vibium

      - name: Run tests
        run: npm run test:ci                       # vitest run --reporter=verbose
        env:
          CI: true                                # triggers headless mode in test code
          HOME: /root
          AUT_BASE_URL: ${{ vars.AUT_BASE_URL }}  # optional: override base URL

      - name: Stop Vibium daemon
        if: always()                              # run even if tests failed
        run: vibium daemon stop
        env:
          HOME: /root
```
