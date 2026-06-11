# Course Introduction: Vibium Beginner

Welcome to the course. Before we start writing tests, I want to take a few minutes to orient you — what you're getting into, what you'll build, and how to use these materials.

---

## Who this course is for

This course is for developers and QA engineers who want to write reliable browser automation tests in TypeScript. You don't need any prior test automation experience. You do need to be comfortable with JavaScript/TypeScript basics — variables, functions, async/await, modules.

If you've struggled with flaky Selenium tests, been intimidated by Playwright's surface area, or never written any browser automation at all, this is a good place to start. Vibium's API is concise and the learning curve is shallow.

If you're an experienced tester who wants to understand Vibium specifically, you can skim the early chapters and focus on Chapters 7–11 where the more interesting patterns live.

---

## What you'll build

Over 12 chapters, you'll build a complete test suite for a real e-commerce application: **automation-exercise.daisyladybug.com**. By the end of the course you'll have:

- A homepage and products-page smoke test
- A checkout flow integration test covering 12 form fields and validation
- A cart state test with dynamic assertion on DOM updates
- A Vitest test suite with Page Objects, `beforeEach`/`afterEach` lifecycle, and proper isolation
- Tests for browser dialog interception, console capture, and file downloads
- Network interception tests that stub API responses for edge cases
- A GitHub Actions workflow that runs the suite on every push, using a pre-baked Docker image
- An understanding of how the Vibium MCP interface connects to AI agent workflows

All of it runs against a real application. Real DOM, real navigation, real forms.

---

## Tools you'll need

Before you start Chapter 3, make sure you have:

- **Node.js 18 or later** — run `node --version` to check. Download from nodejs.org if needed.
- **npm** — ships with Node.js.
- **A code editor** — VS Code is recommended for TypeScript autocomplete.
- **A terminal** — any will do.
- **A GitHub account** — needed for Chapter 9 (CI) onward.

You do not need to install Chrome or configure any WebDriver paths. Vibium manages its own browser binaries.

---

## How the course is structured

Each chapter covers a distinct concept and builds on the previous ones. Within each chapter you'll find:

- **Lecture content** — the concept explained with examples
- **Code snippets** — TypeScript you can run immediately
- **An exercise** — a specific coding task to apply what you just read
- **A solution** — a reference implementation to compare against
- **A quiz** — 5 questions to check your understanding

The chapters roughly divide into three arcs:

**Foundation (Chapters 1–3):** The landscape of browser testing, how Vibium is architected, and your first complete test with assertions and error handling.

**Core patterns (Chapters 4–8):** Forms, assertions, dynamic waiting, Page Objects, captures, and network interception — the techniques that make up 90% of real-world test code.

**Infrastructure (Chapters 9–11):** Taking the test suite to CI with GitHub Actions and a Docker image. How the daemon lifecycle works in a container. How to debug CI-only failures.

**Beyond (Chapter 12):** The MCP interface — where AI agents drive the same browser engine your tests use.

---

## How to use the course materials

Each chapter has both a lecture-notes HTML file (what you're reading) and a corresponding TypeScript source directory in the `src/` folder of the course repository.

**Clone the repository** at [github.com/lana-20/vibium-beginner-course](https://github.com/lana-20/vibium-beginner-course) to get all the example code.

**Run examples locally** using `npx tsx path/to/file.ts`. The `package.json` has npm scripts for each chapter — `npm run ch03:complete`, `npm run ch06:suite`, etc.

**Do the exercises.** The lecture content alone won't make the patterns stick. The exercises are short, targeted, and runnable. Do them before looking at the solution.

**Use the cheat sheet.** The Vibium API reference card in the `reference/` folder consolidates every pattern from the course on one page. Print it or keep it open in a tab.

---

## One thing before we start

The application you're testing throughout this course — automation-exercise.daisyladybug.com — is a purpose-built sandbox. It behaves predictably. Real-world applications don't always cooperate this nicely.

The patterns you'll learn here are designed to be robust: explicit waits instead of sleeps, semantic locators instead of fragile CSS paths, Page Objects that isolate selectors from test logic. They hold up in production applications because they're based on observable DOM state rather than timing assumptions.

When you apply these patterns to a real codebase and something doesn't work as expected, that's normal. The debugging tools — recordings, verbose logging, the CLI — are part of the course for exactly that reason.

Let's get started.
