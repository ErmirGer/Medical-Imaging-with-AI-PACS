// Captures authenticated screenshots of every skaNova page + the Orthanc PACS
// database + branded title cards, for the demo video.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const FE = "http://localhost:5173";
const BE = "http://127.0.0.1:8000";
const ORTHANC = "http://localhost:8042";
const OUT = "../demo/shots";
mkdirSync(OUT, { recursive: true });

const W = 1920,
  H = 1080;

async function login(pn, pw) {
  const r = await fetch(`${BE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personal_number: pn, password: pw }),
  });
  if (!r.ok) throw new Error("login failed " + pn);
  return r.json();
}

const SNAKE = `<svg viewBox="0 0 32 32" width="120" height="120" fill="none">
  <path d="M21 9 C 12 9, 12 15, 16 16 C 20 17, 20 23, 11 23" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="21" cy="8.7" r="2.9" fill="white"/>
  <path d="M23.6 8.2 L26 7 M26 7 L24.4 5.8 M26 7 L25.7 5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="21.6" cy="7.9" r="0.85" fill="#0a1326"/></svg>`;

const ECG = `<svg viewBox="0 0 1200 80" preserveAspectRatio="none" width="100%" height="80" fill="none" stroke="#19c8b6" stroke-width="3" stroke-opacity="0.35" stroke-linecap="round" stroke-linejoin="round"><path d="M0 40 H420 l24 -30 l28 60 l26 -52 l20 22 H760 l18 -18 l24 36 l20 -26 H1200"/></svg>`;

function cardHTML(inner) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");
  *{margin:0;box-sizing:border-box;font-family:Inter,system-ui,sans-serif}
  body{width:${W}px;height:${H}px;background:
    radial-gradient(60rem 32rem at 82% -10%, rgba(25,200,182,0.18), transparent 60%),
    radial-gradient(50rem 30rem at -6% 6%, rgba(52,224,208,0.10), transparent 55%),
    #070b14;color:#e6eaf2;overflow:hidden;position:relative}
  .grid{position:absolute;inset:0;background-image:radial-gradient(rgba(148,163,184,0.06) 1.4px,transparent 1.4px);background-size:34px 34px;
    -webkit-mask-image:radial-gradient(80% 60% at 50% 0%,#000 30%,transparent 100%)}
  .ecg{position:absolute;bottom:60px;left:0;right:0;opacity:.8}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 130px}
  .badge{width:130px;height:130px;border-radius:30px;background:linear-gradient(135deg,#14b8a6,#34e0d0);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px -15px rgba(25,200,182,.55)}
  .grad{background:linear-gradient(135deg,#2dd4c4,#34e0d0);-webkit-background-clip:text;background-clip:text;color:transparent}
  </style></head><body><div class="grid"></div><div class="ecg">${ECG}</div><div class="wrap">${inner}</div></body></html>`;
}

const INTRO = cardHTML(`
  <div style="display:flex;align-items:center;gap:34px;margin-bottom:34px">
    <div class="badge">${SNAKE}</div>
    <div style="font-size:120px;font-weight:900;letter-spacing:-4px;line-height:1">ska<span class="grad">Nova</span></div>
  </div>
  <div style="font-size:44px;font-weight:600;color:#cbd5e1;letter-spacing:-1px">Inteligjencë Artificiale për Imazherinë Mjekësore &amp; PACS</div>
  <div style="font-size:26px;color:#8aa0b8;margin-top:18px">Ngarko një skanim → analizë me AI → arkivim në PACS → akses ndërdepartamental</div>
`);

const PROBLEM = cardHTML(`
  <div style="font-size:26px;font-weight:700;letter-spacing:3px;color:#19c8b6;text-transform:uppercase;margin-bottom:22px">Problemi</div>
  <div style="font-size:58px;font-weight:800;letter-spacing:-2px;line-height:1.15;max-width:1250px">
    Vonesa diagnostike. Arkivim i shpërndarë.<br>Mungesë aksesi mes departamenteve.</div>
  <div style="display:flex;gap:20px;margin-top:46px">
    ${["Humbje nga interpretimi manual","Pa sistem qendror arkivimi","Pa akses ndërdepartamental"]
      .map(t=>`<div style="flex:1;background:rgba(17,26,43,.6);border:1px solid #1e2840;border-radius:20px;padding:28px 26px;font-size:24px;color:#cbd5e1;backdrop-filter:blur(8px)">${t}</div>`).join("")}
  </div>
`);

const OUTCOME = cardHTML(`
  <div style="font-size:26px;font-weight:700;letter-spacing:3px;color:#19c8b6;text-transform:uppercase;margin-bottom:22px">Ndikimi</div>
  <div style="font-size:62px;font-weight:900;letter-spacing:-2.5px;line-height:1.1;max-width:1300px">
    Zbulim më i hershëm. <span class="grad">Më pak vonesa.</span><br>Vendime klinike të bazuara në të dhëna.</div>
  <div style="display:flex;gap:18px;margin-top:44px;flex-wrap:wrap">
    ${["Model i trajnuar mbi NIH &amp; RSNA","Zgjerohet te CT · MRI · Ultratingull","PACS real (Orthanc · DICOM)","Raport dygjuhësh EN/SQ"]
      .map(t=>`<div style="background:rgba(25,200,182,.12);border:1px solid rgba(25,200,182,.3);border-radius:999px;padding:14px 24px;font-size:22px;color:#7fe9dc">${t}</div>`).join("")}
  </div>
  <div style="display:flex;align-items:center;gap:18px;margin-top:60px">
    <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#14b8a6,#34e0d0);display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 32 32" width="40" height="40" fill="none"><path d="M21 9 C 12 9, 12 15, 16 16 C 20 17, 20 23, 11 23" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="8.7" r="2.9" fill="white"/></svg></div>
    <div style="font-size:40px;font-weight:900;letter-spacing:-1.5px">ska<span class="grad">Nova</span></div>
    <div style="font-size:24px;color:#8aa0b8;margin-left:14px">JunctionX Tirana 2026</div>
  </div>
`);

async function run() {
  const doc = await login("1234567890", "demo1234");
  const pat = await login("9876543210", "demo1234");

  // pick a hero chest study (has heatmap, highest risk)
  const studies = await (
    await fetch(`${BE}/api/studies?sort=risk`, {
      headers: { Authorization: `Bearer ${doc.token}` },
    })
  ).json();
  const hero =
    studies.find((s) => s.heatmap_available && s.risk_band === "High") ||
    studies.find((s) => s.heatmap_available) ||
    studies[0];
  console.log("hero study:", hero.id, hero.patient.name);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });

  async function auth(acc) {
    await ctx.addInitScript(
      ([t, a]) => {
        localStorage.setItem("radguard_token", t);
        localStorage.setItem("radguard_account", a);
      },
      [acc.token, JSON.stringify(acc.account)],
    );
  }

  const page = await ctx.newPage();

  async function shot(name, ms = 1600) {
    await page.waitForTimeout(ms);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("shot", name);
  }
  async function card(name, html) {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("card", name);
  }

  // title cards
  await card("01_intro", INTRO);
  await card("02_problem", PROBLEM);

  // login page (logged out) — clear storage
  await page.goto(FE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(FE, { waitUntil: "domcontentloaded" });
  await shot("03_login");

  // authenticated as doctor
  await auth(doc);
  await page.goto(FE, { waitUntil: "domcontentloaded" });
  await shot("04_worklist");

  await page.goto(`${FE}/upload`, { waitUntil: "domcontentloaded" });
  await shot("05_upload");

  // study detail — top (heatmap + risk + confidence)
  await page.goto(`${FE}/study/${hero.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200); // let images load
  await page.screenshot({ path: `${OUT}/06_study_top.png` });
  console.log("shot 06_study_top");

  // scroll for findings / population / clinical / report
  await page.evaluate(() => window.scrollTo(0, 540));
  await shot("07_study_findings", 1200);

  // bilingual report -> switch to SQ then capture
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const sq = btns.find((b) => b.textContent.trim() === "SQ");
    if (sq) sq.click();
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot("08_report_sq", 1200);

  // department board
  await page.goto(`${FE}/board`, { waitUntil: "domcontentloaded" });
  await shot("09_board");

  // print report
  await page.goto(`${FE}/study/${hero.id}/print`, { waitUntil: "domcontentloaded" });
  await shot("10_print", 2000);

  // patient view
  await ctx.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await auth(pat);
  await page.goto(FE, { waitUntil: "domcontentloaded" });
  await shot("11_patient");

  // Orthanc PACS (local database)
  try {
    await page.goto(`${ORTHANC}/app/explorer.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    // try to open the patients list
    await page
      .click("text=All patients", { timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/12_pacs.png` });
    console.log("shot 12_pacs");
  } catch (e) {
    console.log("orthanc shot failed:", e.message);
  }

  // outcome / jury card
  await card("13_outcome", OUTCOME);

  await browser.close();
  console.log("DONE");
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
