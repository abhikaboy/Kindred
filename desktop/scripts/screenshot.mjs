// Screenshot the running dev server for visual verification.
// Usage: bun scripts/screenshot.mjs [route ...]   (defaults to a standard set)
// Auth: drop {access_token, refresh_token} into desktop/.screenshot-auth.json
//       (gitignored) so protected routes render instead of bouncing to /login.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SCREENSHOT_URL || "http://localhost:1420";
const OUT = path.resolve("screenshots");
const THEMES = (process.env.SCREENSHOT_THEMES || "light,dark").split(",");
fs.mkdirSync(OUT, { recursive: true });

let auth = null;
const authFile = path.resolve(".screenshot-auth.json");
if (fs.existsSync(authFile)) {
    auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
} else {
    console.warn("⚠ no .screenshot-auth.json — protected routes will redirect to /login");
}

const routes = process.argv.slice(2);
const targets = routes.length ? routes : ["/login", "/", "/profile", "/settings"];

const slug = (r) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/\//g, "-"));

const browser = await chromium.launch({ channel: "chrome" });
try {
    for (const theme of THEMES) {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            colorScheme: theme,
        });
        // Seed auth + forced theme before the app boots.
        await context.addInitScript(
            ([a, t]) => {
                if (a) localStorage.setItem("auth_data", JSON.stringify(a));
                localStorage.setItem("kindred-theme", t);
            },
            [auth, theme],
        );
        const page = await context.newPage();
        for (const route of targets) {
            await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
            // Wait for any lazy images (banners, avatars) to actually decode.
            await page
                .evaluate(() =>
                    Promise.all(
                        Array.from(document.images).map((img) =>
                            img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }),
                        ),
                    ),
                )
                .catch(() => {});
            await page.waitForTimeout(1000);
            const finalPath = new URL(page.url()).pathname;
            const redirected = finalPath !== route ? ` (→ ${finalPath})` : "";
            const file = path.join(OUT, `${slug(route)}.${theme}.png`);
            await page.screenshot({ path: file, fullPage: true });
            console.log(`saved ${path.relative(process.cwd(), file)}${redirected}`);
        }
        await context.close();
    }
} finally {
    await browser.close();
}
