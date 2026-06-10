# Chapter 3: Your First Test

At this point you understand the testing landscape and how Vibium's architecture fits into it. Now it's time to write actual code. In this chapter we'll install Vibium, navigate to the app we'll be testing throughout the course, read information from the page, and write our first assertion. By the end you'll have a complete, runnable test.

---

## 3.1 Installing Vibium

Start by creating a new directory for your course project and initializing a Node.js project:

```bash
mkdir my-vibium-tests
cd my-vibium-tests
npm init -y
```

Then install the Vibium TypeScript client and `tsx`, which lets you run TypeScript files directly without a separate compile step:

```bash
npm install vibium
npm install --save-dev tsx typescript
```

Create a minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

That's the complete setup. Vibium manages its own browser binaries — there are no additional prerequisites.

---

## 3.2 Your First Navigation

Create a file called `navigate.ts` and add this:

```typescript
import vibium from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.go(AUT)

  console.log('navigated successfully')
  await browser.close()
}

main()
```

Run it:

```bash
npx tsx navigate.ts
```

A browser window opens, navigates to the app, and closes. You should see "navigated successfully" in your terminal.

`headless: false` is the key option here. During development and learning, always run headed so you can see what the browser is doing. Once you're confident your tests work, switch to `headless: true` for speed.

---

## 3.3 Reading the Page

Navigating is a start, but tests need to read the page to know what's there. Vibium gives you two primary ways to do this: `page.title()` and `page.find()`.

`page.title()` returns the document title — the text you see in the browser tab:

```typescript
const title = await page.title()
console.log(title)
// "automation-exercise | E-commerce Testing Sandbox"
```

`page.find()` locates an element and gives you back an object you can inspect:

```typescript
const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
const headingText = await heading.text()
console.log(headingText)
// "automation-exercise"
```

We're using `{ role: 'heading', text: '...' }` rather than a CSS selector. As we discussed in Chapter 2, role-plus-text selectors stay stable as the page's structure changes. The browser confirms there's exactly one heading with this text, regardless of what HTML tag or class it happens to use.

---

## 3.4 Your First Assertion

Reading the page is useful for debugging, but the whole point of a test is to verify that what you see matches what you expect. That's what assertions do.

Node.js ships with a built-in `assert` module. We don't need a testing framework yet — we'll introduce one in a later chapter. For now, `assert` is enough:

```typescript
import assert from 'node:assert/strict'
```

The `/strict` import means failed assertions throw errors with clear messages. Two methods you'll use constantly:

`assert.equal(actual, expected)` — checks that two values are identical:

```typescript
const title = await page.title()
assert.equal(title, 'automation-exercise | E-commerce Testing Sandbox')
console.log('✓ page title correct')
```

`assert.ok(value)` — checks that a value is truthy. Useful for element state:

```typescript
const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
assert.ok(await heading.isVisible())
console.log('✓ hero heading is visible')
```

If an assertion fails, it throws an `AssertionError` explaining what went wrong. The test stops immediately and the error appears in your terminal.

---

## 3.5 A Complete Test

Let's put everything together. A few good habits to establish from the start:

- Wrap the test body in `try/finally` so the browser always closes, even if an assertion fails
- Call `process.exit(1)` on failure so the process exits with a non-zero code (important for CI)
- Use the third argument to `assert.equal` and `assert.ok` as a label — it appears in error messages and helps you locate failing assertions quickly

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function testHomepage() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)

    assert.equal(
      await page.title(),
      'automation-exercise | E-commerce Testing Sandbox',
      'page title'
    )

    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    assert.ok(await hero.isVisible(), 'hero heading visible')

    const featured = await page.find({ role: 'heading', text: 'Featured Products' })
    assert.ok(await featured.isVisible(), 'Featured Products section visible')

    const product = await page.find({ text: 'Wireless Headphones Pro' })
    assert.ok(await product.isVisible(), 'first featured product visible')

    const cta = await page.find({ role: 'link', text: 'Explore Products' })
    assert.ok(await cta.isVisible(), 'Explore Products CTA visible')

    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

testHomepage().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Work through each assertion:

1. The page title matches exactly — a smoke test that catches total navigation failures immediately.
2. The hero heading is visible — checking rendered state, not just DOM presence.
3. The "Featured Products" section is visible — confirming the page rendered past the hero.
4. "Wireless Headphones Pro" is visible — confirming product data loaded.
5. The "Explore Products" CTA link is visible — confirming the page's main call to action is present.

---

## 3.6 Running It

Add a script to your `package.json`:

```json
"scripts": {
  "test:homepage": "npx tsx src/ch03-first-test/03-complete-test.ts"
}
```

Run it:

```bash
npm run test:homepage
```

A browser window opens, runs through the page, and closes. In the terminal:

```
All assertions passed.
```

To see what a failure looks like, change one assertion to something wrong — assert the title equals `"wrong title"`. You'll see:

```
Test failed: Expected values to be strictly equal:
+ actual - expected

+ 'automation-exercise | E-commerce Testing Sandbox'
- 'wrong title'
```

The `+` line is what you actually got; the `-` line is what you expected. That's a clear, actionable failure message. Revert the change and confirm the test passes cleanly before moving on.
