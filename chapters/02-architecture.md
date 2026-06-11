# Chapter 2: How Vibium Works — Architecture Overview

In Chapter 1 we talked about *what* Vibium is — one of several browser automation tools, with a distinctive three-interface design. In this chapter I want to show you *how* it works. We're going to look at the object hierarchy that everything in this course builds on, walk through a live browser session from start to finish, and touch on the three categories of things you can do with a Vibium page. Understanding this architecture will make every chapter that follows much easier to reason about.

---

## The three interfaces

Let me start by making the three-interface story concrete, because it comes up constantly.

When you install Vibium, you get access to the same browser engine through three different surfaces:

The **CLI** lets you drive a browser from your terminal, one command at a time. You type `vibium go https://example.com` and a real browser navigates there. You type `vibium find text "Sign in"` and it tells you what element it found. This is enormously useful for exploration — when you're investigating a new page and want to quickly check what elements exist before writing any code.

The **MCP server** makes Vibium available to AI agents. When you configure Vibium as an MCP server in something like Claude Desktop, an AI assistant can navigate, click, fill forms, and read the page on your behalf, just from a natural language description of what you want. We'll look at this properly in Chapter 10.

The **TypeScript client** is what we use in this course. It gives you a full programmatic API that you control line by line. This is the right choice for writing tests — reproducible, version-controlled, CI-friendly.

All three interfaces talk to the same underlying browser engine and share the same behavior. What you learn about finding elements, filling forms, and waiting for page changes applies equally across all three.

---

## The object hierarchy: Browser → Context → Page → Element

Every interaction with Vibium follows the same four-level hierarchy. Let me walk through each level.

**Browser** is the top-level object. You create it by calling `vibium.start()`. This starts the browser process — think of it as the application itself before any tabs are open.

**BrowserContext** is an isolated session within the browser. Each context has its own cookies, storage, and authentication state. Contexts don't share anything with each other. This is important for tests: if you create two contexts, they're completely isolated — like two different users in separate incognito windows. You create a context by calling `browser.newContext()`.

**Page** represents a single tab. You navigate it to a URL, interact with its elements, and assert on its state. Create one with `context.newPage()`.

**Element** is what you get back from `page.find()`. It represents a specific DOM node — a button, a heading, an input. Elements have methods like `click()`, `fill()`, `text()`, and `isVisible()`.

In code, that hierarchy looks like this:

```typescript
import { browser as vibium } from 'vibium'

async function main() {
  const browser = await vibium.start({ headless: false })   // Browser
  const context = await browser.newContext()                 // BrowserContext
  const page = await context.newPage()                       // Page

  await page.go('https://automation-exercise.daisyladybug.com/')

  const heading = await page.find({ role: 'heading', text: 'automation-exercise' })  // Element
  console.log(await heading.text())

  await browser.stop()
}

main()
```

Notice every step down the hierarchy is an `await`. Each call returns a promise you resolve before moving to the next level. Once you hold a `page`, most things you do are `await page.something()`. Once you hold an element, it's `await element.something()`.

---

## Finding elements: the locator approach

`page.find()` is the most important method in Vibium's API. It locates a single element on the page and returns an Element object you can interact with.

The key design decision is *how* you describe the element you want. Vibium uses a locator object — a plain JavaScript object with properties that describe the element. The two most common approaches:

```typescript
// By role + text — the preferred approach
const button = await page.find({ role: 'button', text: 'Add to Cart' })

// By CSS selector — when you need structural precision
const input = await page.find('input[name=email]')
```

The role-plus-text approach describes what the element *means*, not what it *looks like*. "Button" refers to the semantic role — it doesn't matter whether the HTML is a `<button>`, an `<a>` styled as a button, or a `<div role="button">`. The text narrows it to the specific one. CSS selectors are a fallback for form inputs or elements where semantic targeting isn't precise enough.

One important detail: `page.find({ text: 'something' })` without a role returns the *outermost* DOM element containing that text. For interactive elements — buttons, links, checkboxes — always include the role.

---

## The three categories of operations

Everything you do with a Vibium page falls into one of three categories: **actions**, **captures**, and **waits**. This mental model organizes every chapter from here on.

**Actions** are things you do *to* the page:
- `page.go(url)` — navigate
- `element.click()` — click
- `element.fill(text)` — clear a field and type
- `element.selectOption(value)` — choose a dropdown option

**Captures** are events the browser sends *to* you:
- `page.capture.dialog()` — intercept an alert or confirm
- `page.capture.console()` — collect console messages
- `page.capture.download()` — intercept a file download

**Waits** block your script until a condition is true:
- `page.find({ text })` — wait until text appears (find polls until the element exists)
- `page._waitForURL(pattern)` — wait until the URL matches

The pattern you'll use constantly: trigger an action, wait for the DOM to settle, then assert. We'll dig into that in Chapter 5.

---

## OOP in Vibium: why the object model matters

You might notice that Vibium's API is object-oriented — you call methods on objects (`page.find()`, `element.click()`) rather than passing everything as arguments to standalone functions. This is intentional, and it matters for how you write good tests.

Each object in the hierarchy carries context. A `Page` object knows which browser context it belongs to. An `Element` object knows which page it came from, which DOM node it represents, and whether that node is still attached. When you call `element.click()`, Vibium doesn't re-query the DOM — it already has a reference to the exact node.

This OOP model is also the foundation for the **Page Object Pattern** in Chapter 6. When you wrap a page's interactions in a class, each method on that class translates directly to one or more Vibium calls. The `ProductsPage` class you'll build has a `filterByCategory()` method that internally calls `page.find()` and `element.selectOption()`. The test doesn't know or care about the selector — it just calls `products.filterByCategory('Electronics')`. That's OOP applied to test organization.

---

## Atomic tests

Before we get to writing code, there's one more concept worth introducing: atomic tests. An atomic test does one thing and one thing only. It sets up its own state, performs its action, asserts the outcome, and tears down cleanly. It doesn't depend on another test having run before it. It doesn't leave side effects for the next test.

Why does this matter? Because if Test B depends on Test A having run first, and Test A fails, now both tests fail — but only one of them is actually broken. Debugging becomes harder. Tests become order-dependent, which means you can't run them in parallel. And over time the test suite accumulates implicit dependencies that nobody can fully map.

In Vibium, atomicity means: every test gets its own browser context, navigates to its own starting URL, and closes the browser in `finally`. No shared state, no leftover cookies, no assumptions about what the previous test did. This is exactly what `beforeEach` and `afterEach` in Chapter 6 enforce structurally.

---

## Network interception

One more architecture-level capability: `page.route()`. This lets you intercept HTTP requests before they leave the browser and respond with synthetic data or simulate failures.

```typescript
await page.route('**/api/products', async route => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 'prod_001', name: 'Test Product' }]),
  })
})
```

We'll use this in Chapter 8. For now, just know it lives at the page level and it's one of the most powerful tools for writing tests that don't depend on a live backend.

---

## A live session

Here's a complete example that touches most of what we just covered. This is close to what you'll write in Chapter 3, but I want you to see the full shape now:

```typescript
import { browser as vibium } from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function exploreApp() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)

    const title = await page.title()
    console.log('Title:', title)

    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    console.log('Hero text:', await hero.text())

    const productsLink = await page.find({ role: 'link', text: 'Products' })
    await productsLink.click()

    // Wait for URL to update after the click
    await page._waitForURL('**/products')
    console.log('Now at:', await page.url())

  } finally {
    await browser.stop()  // always runs, even if something threw
  }
}

exploreApp()
```

Run this and you'll see the browser open, navigate home, then click through to the products page. The `try/finally` pattern is something you'll write in every test in this course. `browser.stop()` in `finally` means the browser always cleans up — whether the test passed, failed, or threw an unexpected error.

In the next chapter, we turn this foundation into a real test with assertions, proper failure handling, and a structure you can run reliably in CI. Let's go write it.
