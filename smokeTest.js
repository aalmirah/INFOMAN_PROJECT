"use strict";

const TIMEOUT_MS = 10_000;

async function fetchPage(url, cookie) {
  const headers = { Accept: "text/html" };
  if (cookie) headers.Cookie = cookie;

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      status: response.status,
      finalUrl: response.url,
      body: await response.text(),
    };
  } catch (error) {
    throw new Error(`Could not reach ${url}: ${error.message}`);
  }
}

async function checkLoginPage(baseUrl) {
  const { status, finalUrl, body } = await fetchPage(`${baseUrl}/login`);
  if (status !== 200 || new URL(finalUrl).pathname !== "/login") {
    throw new Error(
      `Login page did not load correctly (HTTP ${status}, final path ${new URL(finalUrl).pathname}).`,
    );
  }
  if (
    !body.includes('id="login-email"') ||
    !body.includes('name="password"') ||
    !body.includes("Sign in")
  ) {
    throw new Error("Login page is missing its expected sign-in form.");
  }
  console.log("PASS: login page responds with the sign-in form (HTTP 200).");
}

async function checkDashboard(baseUrl, cookie) {
  if (!cookie) {
    throw new Error(
      "Dashboard check needs an authenticated QA session. Set SMOKE_TEST_COOKIE to that browser session's Cookie header.",
    );
  }

  const { status, finalUrl, body } = await fetchPage(
    `${baseUrl}/session`,
    cookie,
  );
  if (status !== 200 || new URL(finalUrl).pathname !== "/session") {
    throw new Error(
      `Dashboard did not load (HTTP ${status}, final path ${new URL(finalUrl).pathname}). Check the session cookie.`,
    );
  }
  if (!/<h1\b[^>]*>\s*Dashboard\s*<\/h1>/.test(body)) {
    throw new Error("Dashboard response is missing its expected page heading.");
  }
  console.log("PASS: authenticated dashboard loads (HTTP 200).");
}

async function main() {
  const baseUrl = (
    process.env.SMOKE_TEST_BASE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const cookie = (process.env.SMOKE_TEST_COOKIE || "").trim();

  await checkLoginPage(baseUrl);
  await checkDashboard(baseUrl, cookie);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
