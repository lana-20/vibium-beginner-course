# Chapter 11: The Docker CI Image

The previous chapter used `ghcr.io/lana-20/vibium-ci:latest` as the container image in our workflow. This chapter explains what that image is, why it exists, and how to build and maintain your own.

---

## Why a pre-baked image

The standard GitHub Actions approach downloads Chrome on every run — that's around 300 MB each time, costing 20–30 seconds per workflow run. Multiply that by dozens of runs per day across a team and it adds up.

The better approach: build a Docker image with Chrome already inside it, push it to a registry, and point your workflow at that image. Chrome is always there, ready immediately. The download cost is paid once, at image build time, not on every test run.

---

## The Dockerfile

This is `Dockerfile.ci` at the root of the course repository:

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libnspr4 libnss3 \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxext6 \
    libxi6 libxrender1 libxtst6 libdbus-1-3 \
    fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g vibium && vibium install

RUN CHROME=$(find /root/.cache/vibium -name "chrome" -not -name "chromedriver" | head -1) \
    && mv "$CHROME" "${CHROME}.real" \
    && printf '#!/bin/sh\nexec "%s.real" --no-sandbox --disable-dev-shm-usage "$@"\n' "$CHROME" > "$CHROME" \
    && chmod +x "$CHROME"

ENV HOME=/root
```

Each layer serves a specific purpose.

**The `apt-get install` block** installs the system libraries Chrome needs on Debian Bookworm. Many are predictable — `libnspr4`/`libnss3` for networking, `libgbm1` for GPU buffer management. The non-obvious one is `libcairo2`. Chrome uses Cairo for 2D rendering even in headless mode. If it's missing, Chrome exits immediately with exit code 1 and no output — a silent failure that's hard to diagnose without running Chrome directly.

**`npm install -g vibium && vibium install`** installs the Vibium CLI globally and downloads Chrome for Testing. The binary lands at `/root/.cache/vibium/chrome-for-testing/...`.

**The three-line RUN block** creates a wrapper script around the real Chrome binary. Two flags are required for Linux CI containers:

- `--no-sandbox` — AppArmor on Ubuntu CI runners blocks Chrome's process sandbox. This bypasses it.
- `--disable-dev-shm-usage` — Docker containers limit `/dev/shm` to 64 MB. Chrome exhausts this immediately when rendering pages. This flag tells Chrome to use `/tmp` instead.

The wrapper renames the real Chrome binary to `chrome.real`, then creates a shell script at the original path that prepends both flags before passing all arguments through. Vibium launches Chrome by path — it finds the wrapper, the wrapper finds the real binary, both flags are always present.

**`ENV HOME=/root`** bakes the environment variable into the image. When Node.js calls `os.homedir()` inside the container, it returns `/root` — where Chrome was downloaded. Without this, Vibium can't find its Chrome binary.

---

## Publishing the image

To publish the image to the GitHub Container Registry:

```bash
# Authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Build and push
docker build -f Dockerfile.ci -t ghcr.io/YOUR_USERNAME/vibium-ci:latest .
docker push ghcr.io/YOUR_USERNAME/vibium-ci:latest
```

Update your workflow's `container:` key to reference your image:

```yaml
container: ghcr.io/YOUR_USERNAME/vibium-ci:latest
```

---

## Auto-rebuilding the image

A second workflow, `.github/workflows/build-ci-image.yml`, rebuilds and republishes the image whenever `Dockerfile.ci` changes:

```yaml
name: Build CI image

on:
  push:
    branches: [main]
    paths:
      - Dockerfile.ci
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.ci
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/vibium-ci:latest
```

The `paths:` filter means this workflow only runs when `Dockerfile.ci` actually changes — not on every push. Update the Dockerfile, push, and the next test workflow run automatically picks up the new image.

---

## The full CI loop in practice

At this point your CI setup has three moving parts that stay synchronized:

1. **`Dockerfile.ci`** defines the environment
2. **`build-ci-image.yml`** rebuilds the image when the Dockerfile changes
3. **`tests.yml`** runs your tests on every push, using the pre-built image

When you need a new system dependency, add it to `Dockerfile.ci` and push — the image rebuilds automatically and the next test run uses it. When your tests need a new Node.js version, update `node-version:` in the test workflow. The image and the workflow are independent concerns.

---

## Exercise

Build and publish your own CI image:

1. Copy `Dockerfile.ci` from the course repository into your project root
2. Build the image locally: `docker build -f Dockerfile.ci -t ghcr.io/YOUR_USERNAME/vibium-ci:latest .`
3. Authenticate with GHCR and push: `docker push ghcr.io/YOUR_USERNAME/vibium-ci:latest`
4. Update your `tests.yml` to reference your image instead of `ghcr.io/lana-20/vibium-ci:latest`
5. Push and confirm the workflow runs using your image (check the "Set up job" step in the Actions log for the image pull)
6. Create `.github/workflows/build-ci-image.yml` so future Dockerfile changes trigger an automatic rebuild

---

## Quiz

**1.** The primary reason for using a pre-baked Docker image is:

- A. Docker images are faster than bare runners
- B. Chrome is already inside the image, eliminating the ~300 MB download and 20–30 second setup cost on every run
- C. Docker containers provide better test isolation than bare runners
- D. The GitHub Container Registry is faster than other registries

**2.** `--no-sandbox` is required in the Docker CI image because:

- A. Chrome always requires `--no-sandbox` on Linux
- B. AppArmor on Ubuntu CI runners blocks Chrome's process sandbox
- C. Docker containers don't support sandboxed processes
- D. The Vibium CLI requires it

**3.** The Chrome wrapper script approach (rename to `.real`, replace with shell script) is used because:

- A. It is the only way to set environment variables for Chrome
- B. Vibium launches Chrome by binary path; the wrapper intercepts that path and injects required flags before passing arguments through
- C. Docker requires wrapper scripts for any binary that opens network connections
- D. It prevents Chrome from writing to `/dev/shm`

**4.** `ENV HOME=/root` in the Dockerfile is needed because:

- A. Root is the only user permitted to run Chrome
- B. Node.js uses `os.homedir()` to locate the Vibium Chrome cache; the variable must point to `/root` where `vibium install` placed it
- C. The daemon writes PID files to `$HOME`
- D. GitHub Actions containers reset `HOME` to an empty value

**5.** The `paths: [Dockerfile.ci]` filter on the image rebuild workflow means:

- A. The workflow only runs on changes to files inside the Docker build context
- B. The workflow runs only when `Dockerfile.ci` itself changes, not on every push
- C. The workflow ignores changes to all other files in the repo
- D. Docker builds only include files matching the path filter

**Answers:** 1-B, 2-B, 3-B, 4-B, 5-B

## Solution

The solution for this chapter is operational rather than code-based. The expected output after completing the exercise is:

1. A `Dockerfile.ci` at your project root matching the one in this chapter
2. A published image at `ghcr.io/YOUR_USERNAME/vibium-ci:latest` visible under your GitHub profile → Packages
3. `tests.yml` referencing your image
4. A green Actions run that shows "Pulling from ghcr.io/YOUR_USERNAME/vibium-ci" in the "Set up job" step
5. A `build-ci-image.yml` that triggers when `Dockerfile.ci` changes

To verify the image is correct, you can run it locally and test Chrome:

```bash
docker run --rm ghcr.io/YOUR_USERNAME/vibium-ci:latest \
  /bin/sh -c 'vibium --version && echo "Chrome OK"'
```

If Chrome is found and the version prints, the image is working.
