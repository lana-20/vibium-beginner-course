# Chapter 2: How Vibium Works — Architecture Overview

Now that you have a sense of the testing landscape, let's look at how Vibium itself is designed. Understanding the architecture before writing your first test will save you a lot of confusion later. You don't need to understand every internal detail — but you do need a clear mental model of the moving parts.

---

## 2.1 The Engine and the Interfaces

At its core, Vibium is a single automation engine with three different ways to interact with it.

The **CLI** is a standalone binary you run from the terminal. You give it commands directly — "navigate to this URL," "click this button," "take a screenshot" — and it executes them one at a time. This is great for quick tasks and for understanding what Vibium can do, but it's not how you write automated test suites.

The **MCP server** implements the Model Context Protocol, an open standard originally developed by Anthropic for connecting AI assistants to tools. When Vibium runs as an MCP server, any AI agent that speaks MCP can use it to drive a browser without you writing any glue code. This is the interface that makes Vibium particularly well-suited to agent-driven automation — something we'll revisit toward the end of this course.

The **client libraries** — available for TypeScript, Python, and Java — give you a full programmatic API. You import Vibium, write code that calls its methods, and run that code directly. This is how most automated test suites are built, and this is the interface we'll be using throughout this course.

All three interfaces talk to the same underlying engine. The CLI, the MCP server, and the TypeScript client all result in the same browser actions. Skills you develop writing TypeScript tests will transfer directly if you later work with the CLI for quick checks or with an AI agent using MCP.

---

## 2.2 How a Test Actually Runs

When you call `vibium.start()` in TypeScript, several things happen in sequence. Vibium launches a browser process on your machine — by default, a Chromium-based browser. It opens a browser context, which you can think of as a fresh browser profile. Inside that context, it creates a page, which corresponds to a single browser tab. Your TypeScript code then talks to that page through Vibium's API.

The browser can run in two modes. In **headed mode**, a visible browser window opens on your screen and you can watch your test execute in real time. This is very useful when you're writing or debugging tests. In **headless mode**, the browser runs invisibly in the background — no window appears, but the browser is fully functional. Headless mode is what you'll typically use in CI/CD pipelines where there's no display to render to.

Throughout a test run, your code sends instructions to Vibium, Vibium forwards them to the browser, the browser executes them, and results come back. This back-and-forth happens fast enough that from your code's perspective it feels like direct control, but Vibium is handling the communication protocol for you.

---

## 2.3 The Object Hierarchy

Vibium organizes browser automation around four levels, from outermost to innermost: `Browser`, `BrowserContext`, `Page`, and `Element`.

The **Browser** is the browser process itself. In most tests you'll deal with exactly one browser per test run. You start it, use it, and close it.

The **BrowserContext** is an isolated session within that browser. Think of it as a private browsing window — each context has its own cookies, local storage, and authentication state. Contexts are completely isolated from each other. This matters when you're writing tests that need to run in parallel: you can spin up multiple contexts within one browser process and run them simultaneously without interference. Each context sees a clean, independent state.

The **Page** is a single browser tab within a context. Most tests work with one page at a time, though some scenarios — like testing a flow that opens a new tab — require managing multiple pages.

The **Element** is a specific DOM node on the page: a button, an input field, a heading, a link. Once Vibium finds an element, you can interact with it — click it, read its text, fill it if it's a form field, check whether it's visible or enabled.

In TypeScript, you'll see this hierarchy reflected directly in the API:

```typescript
const browser = await vibium.start()
const context = await browser.newContext()
const page = await context.newPage()
await page.go('https://automation-exercise.daisyladybug.com/')
const button = await page.find({ role: 'button', text: 'Shop Now' })
await button.click()
await browser.close()
```

You don't always have to create the context and page manually — Vibium provides convenience methods that handle the common case of one context and one page — but it's important to understand what those shortcuts are doing under the hood.

---

## 2.4 Finding Elements

Before you can interact with anything on a page, you have to locate it. This is one of the most important — and most error-prone — parts of browser automation, and Vibium's approach is worth understanding carefully.

Vibium's primary method for locating elements is `page.find()`. You pass it a descriptor that describes what you're looking for, and Vibium searches the DOM for a matching element.

The most reliable form is `{ role, text }`:

```typescript
const button = await page.find({ role: 'button', text: 'Add to Cart' })
```

This finds an element that has the ARIA role `button` and visible text matching `'Add to Cart'`. Role-plus-text selectors are robust because they describe what the element *is* and what it *says* — two things that stay stable even as a page's HTML structure changes.

You can also find by CSS selector:

```typescript
const input = await page.find({ css: '#search-input' })
```

And by text alone:

```typescript
const heading = await page.find({ text: 'Featured Products' })
```

Text-only searches return the outermost element that contains that text. This is fine for reading content but can be surprising when you're targeting interactive elements. For buttons, inputs, and links, always use `{ role, text }`.

One more thing to know: `find()` matches against the actual DOM text content, not rendered text. CSS properties like `text-transform: uppercase` don't affect what `find()` sees. If the DOM contains `"add to cart"` and the page renders it as `"ADD TO CART"`, you search for `"add to cart"`.

---

## 2.5 Actions, Captures, and Waits

Vibium's API divides into three categories of operations. Understanding the distinction makes the whole API much easier to navigate.

**Actions** are things you do to the page: navigating to a URL, clicking an element, typing into an input, scrolling, hovering. These are the verbs of your test.

```typescript
await page.go('https://automation-exercise.daisyladybug.com/')
await button.click()
await input.fill('running shoes')
```

**Captures** are ways of listening for browser events that happen asynchronously. The most common example is a dialog. When your test clicks a button that triggers a `window.alert()`, you need to be listening for that alert *before* the click happens — otherwise the dialog will block and your test will hang. Vibium's `capture.dialog()` handles this:

```typescript
const [dialog] = await Promise.all([
  page.capture.dialog(),
  button.click()
])
console.log(dialog.message)
await dialog.accept()
```

Notice the pattern: you set up the capture and trigger the action at the same time, inside a `Promise.all`. The capture registers the listener first, then the click fires. This is a pattern you'll use repeatedly throughout the course.

Other captures include `capture.console()` for listening to `console.log` output, and `capture.download()` for intercepting file downloads.

**Waits** let you pause test execution until a specific condition is true. Vibium automatically waits for elements to be ready before most actions — you won't usually need explicit waits just to click a button. But sometimes you need to wait for something specific: a URL change after a form submission, a piece of text to appear after an API call returns, a loading spinner to disappear.

```typescript
await page.waitForURL('**/checkout/success')
await page.waitForText('Order confirmed')
```

Waits are different from captures: a wait blocks until a condition is met, while a capture registers a listener for a future event. Both deal with the asynchronous nature of the browser, but they're used in different situations.

---

## 2.6 Network Layer

Vibium includes a network interception API that lets you intercept browser requests and either modify them, block them, or substitute a mock response. This is useful in advanced scenarios — returning a controlled API response without hitting a real server, or blocking third-party scripts to reduce test noise.

```typescript
await page.route('**/api/products', route => {
  route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) })
})
```

You won't need this for the exercises in this course — we'll work with real pages and real network calls on the automation-exercise app. But knowing the feature exists is useful context. If you ever encounter flaky tests caused by an unstable external API, network interception is often the cleanest solution.

---

With this mental model in place — engine, object hierarchy, finding elements, and the three interaction modes — you have everything you need to start writing real tests. That's what we'll do in Chapter 3.
