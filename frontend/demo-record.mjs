// Records REAL app navigation (smooth scroll + clicks) as video per scene,
// plus animated intro/problem/outcome cards. Timing per scene comes from
// ../demo/scenes.json (written by build_video.py from the VO durations).
import { chromium } from "playwright";
import { mkdirSync, renameSync, readFileSync, rmSync } from "fs";

const FE = "http://localhost:5173";
const BE = "http://127.0.0.1:8000";
const ORTHANC = "http://localhost:8042";
const REC = "../demo/rec";
const W = 1920,
  H = 1080;

rmSync(REC, { recursive: true, force: true });
mkdirSync(REC, { recursive: true });

const scenes = JSON.parse(readFileSync("../demo/scenes.json", "utf-8"));

async function login(pn, pw) {
  const r = await fetch(`${BE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personal_number: pn, password: pw }),
  });
  if (!r.ok) throw new Error("login failed " + pn);
  return r.json();
}

// ---------- animated title cards ----------
const SNAKE = `<svg viewBox="0 0 32 32" width="120" height="120" fill="none">
  <path d="M21 9 C 12 9, 12 15, 16 16 C 20 17, 20 23, 11 23" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="21" cy="8.7" r="2.9" fill="white"/>
  <path d="M23.6 8.2 L26 7 M26 7 L24.4 5.8 M26 7 L25.7 5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="21.6" cy="7.9" r="0.85" fill="#0a1326"/></svg>`;

function shell(inner, extraCss = "") {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");
  *{margin:0;box-sizing:border-box;font-family:Inter,system-ui,sans-serif}
  body{width:${W}px;height:${H}px;color:#e6eaf2;overflow:hidden;position:relative;background:#070b14}
  .glowwrap{position:absolute;inset:0;
    background:
      radial-gradient(60rem 32rem at 82% -10%, rgba(25,200,182,0.20), transparent 60%),
      radial-gradient(50rem 30rem at -6% 6%, rgba(52,224,208,0.12), transparent 55%);
    animation:breathe 6s ease-in-out infinite}
  .grid{position:absolute;inset:0;background-image:radial-gradient(rgba(148,163,184,0.06) 1.4px,transparent 1.4px);background-size:34px 34px;
    -webkit-mask-image:radial-gradient(80% 60% at 50% 0%,#000 30%,transparent 100%);opacity:0;animation:fadein 1.4s .2s forwards}
  .ecg{position:absolute;bottom:64px;left:0;right:0;opacity:.85}
  .ecg path{stroke-dasharray:1800;stroke-dashoffset:1800;animation:draw 2.6s .5s ease-out forwards}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 130px}
  .badge{width:130px;height:130px;border-radius:30px;background:linear-gradient(135deg,#14b8a6,#34e0d0);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px -15px rgba(25,200,182,.6)}
  .grad{background:linear-gradient(135deg,#2dd4c4,#34e0d0);-webkit-background-clip:text;background-clip:text;color:transparent}
  .pop{animation:pop .9s cubic-bezier(.2,.85,.25,1) both}
  .up{animation:up .9s cubic-bezier(.2,.85,.25,1) both}
  .u1{animation-delay:.25s}.u2{animation-delay:.5s}.u3{animation-delay:.7s}.u4{animation-delay:.9s}.u5{animation-delay:1.1s}
  @keyframes pop{from{opacity:0;transform:scale(.55) translateY(24px)}to{opacity:1;transform:none}}
  @keyframes up{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
  @keyframes fadein{to{opacity:1}}
  @keyframes draw{to{stroke-dashoffset:0}}
  @keyframes breathe{0%,100%{opacity:.7}50%{opacity:1}}
  ${extraCss}
  </style></head><body>
  <div class="glowwrap"></div><div class="grid"></div>
  <div class="ecg"><svg viewBox="0 0 1200 80" preserveAspectRatio="none" width="100%" height="80" fill="none" stroke="#19c8b6" stroke-width="3" stroke-opacity="0.4" stroke-linecap="round" stroke-linejoin="round"><path d="M0 40 H420 l24 -30 l28 60 l26 -52 l20 22 H760 l18 -18 l24 36 l20 -26 H1200"/></svg></div>
  <div class="wrap">${inner}</div></body></html>`;
}

const INTRO = shell(`
  <div class="pop" style="display:flex;align-items:center;gap:34px;margin-bottom:30px">
    <div class="badge">${SNAKE}</div>
    <div class="up u1" style="font-size:128px;font-weight:900;letter-spacing:-4px;line-height:1">ska<span class="grad">Nova</span></div>
  </div>
  <div class="up u2" style="font-size:46px;font-weight:600;color:#cbd5e1;letter-spacing:-1px">Inteligjencë Artificiale për Imazherinë Mjekësore &amp; PACS</div>
  <div class="up u3" style="font-size:26px;color:#8aa0b8;margin-top:18px">Ngarko → Analizë me AI → Arkivim në PACS → Akses ndërdepartamental</div>
`);

const PROBLEM = shell(`
  <div class="up" style="font-size:26px;font-weight:700;letter-spacing:3px;color:#19c8b6;text-transform:uppercase;margin-bottom:22px">Problemi</div>
  <div class="up u1" style="font-size:58px;font-weight:800;letter-spacing:-2px;line-height:1.15;max-width:1250px">
    Vonesa diagnostike. Arkivim i shpërndarë.<br>Mungesë aksesi mes departamenteve.</div>
  <div style="display:flex;gap:20px;margin-top:46px">
    ${["Humbje nga interpretimi manual", "Pa sistem qendror arkivimi", "Pa akses ndërdepartamental"]
      .map((t, i) => `<div class="up u${i + 2}" style="flex:1;background:rgba(17,26,43,.65);border:1px solid #1e2840;border-radius:20px;padding:28px 26px;font-size:24px;color:#cbd5e1">${t}</div>`).join("")}
  </div>
`);

const OUTCOME = shell(`
  <div class="up" style="font-size:26px;font-weight:700;letter-spacing:3px;color:#19c8b6;text-transform:uppercase;margin-bottom:22px">Ndikimi</div>
  <div class="up u1" style="font-size:60px;font-weight:900;letter-spacing:-2.5px;line-height:1.1;max-width:1300px">
    Zbulim më i hershëm. <span class="grad">Më pak vonesa.</span><br>Vendime klinike të bazuara në të dhëna.</div>
  <div style="display:flex;gap:18px;margin-top:42px;flex-wrap:wrap">
    ${["Trajnuar mbi NIH &amp; RSNA", "Zgjerohet te CT · MRI · Ultratingull", "PACS real (Orthanc · DICOM)", "Raport dygjuhësh EN/SQ"]
      .map((t, i) => `<div class="up u${i + 2}" style="background:rgba(25,200,182,.12);border:1px solid rgba(25,200,182,.3);border-radius:999px;padding:14px 24px;font-size:22px;color:#7fe9dc">${t}</div>`).join("")}
  </div>
  <div class="up u5" style="display:flex;align-items:center;gap:18px;margin-top:58px">
    <div style="width:62px;height:62px;border-radius:16px;background:linear-gradient(135deg,#14b8a6,#34e0d0);display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 32 32" width="38" height="38" fill="none"><path d="M21 9 C 12 9, 12 15, 16 16 C 20 17, 20 23, 11 23" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="8.7" r="2.9" fill="white"/></svg></div>
    <div style="font-size:40px;font-weight:900;letter-spacing:-1.5px">ska<span class="grad">Nova</span></div>
    <div style="font-size:24px;color:#8aa0b8;margin-left:14px">JunctionX Tirana 2026</div>
  </div>
`);

const CARDS = { "01_intro": INTRO, "02_problem": PROBLEM, "13_outcome": OUTCOME };

// smooth eased scroll over `ms`, captured by the recording
async function smoothScroll(page, to, ms) {
  await page.evaluate(
    ({ to, ms }) =>
      new Promise((res) => {
        const start = window.scrollY;
        const max = document.body.scrollHeight - window.innerHeight;
        const dist = Math.max(0, Math.min(to, max)) - start;
        const t0 = performance.now();
        function step(now) {
          const k = Math.min(1, (now - t0) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          window.scrollTo(0, start + dist * e);
          if (k < 1) requestAnimationFrame(step);
          else res();
        }
        requestAnimationFrame(step);
      }),
    { to, ms },
  );
}

let HERO = null;

async function action(page, shot) {
  if (CARDS[shot]) {
    await page.setContent(CARDS[shot], { waitUntil: "domcontentloaded" });
    return;
  }
  switch (shot) {
    case "03_login":
      await page.goto(FE, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      try { await page.locator("input").first().fill("1234567890"); } catch {}
      await page.waitForTimeout(500);
      try { await page.locator('input[type="password"]').first().fill("demo1234"); } catch {}
      break;
    case "04_worklist":
      await page.goto(FE, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1300);
      await smoothScroll(page, 380, 3800);
      break;
    case "05_upload":
      await page.goto(`${FE}/upload`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await smoothScroll(page, 240, 3000);
      break;
    case "06_study_top":
      await page.goto(`${FE}/study/${HERO}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2400); // heatmap load
      await smoothScroll(page, 150, 2800);
      await smoothScroll(page, 0, 1600);
      break;
    case "07_study_findings":
      await page.goto(`${FE}/study/${HERO}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2200);
      await smoothScroll(page, 760, 5000);
      break;
    case "08_report_sq":
      await page.goto(`${FE}/study/${HERO}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await smoothScroll(page, 1250, 3200);
      try { await page.getByRole("button", { name: "SQ", exact: true }).click({ timeout: 2500 }); } catch {}
      await page.waitForTimeout(700);
      await smoothScroll(page, 1750, 2200);
      break;
    case "12_pacs":
      await page.goto(`${ORTHANC}/app/explorer.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);
      try { await page.click("text=Ardit Krasniqi", { timeout: 3000 }); } catch {}
      await page.waitForTimeout(1800);
      break;
    case "09_board":
      await page.goto(`${FE}/board`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1300);
      await smoothScroll(page, 320, 3800);
      break;
    case "10_print":
      await page.goto(`${FE}/study/${HERO}/print`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);
      await smoothScroll(page, 650, 4500);
      break;
    case "11_patient":
      await page.goto(FE, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1300);
      await smoothScroll(page, 280, 3000);
      break;
  }
}

function tokenFor(shot, doc, pat) {
  if (shot === "03_login" || CARDS[shot]) return null; // logged out / card
  if (shot === "11_patient") return pat;
  return doc;
}

async function run() {
  const doc = await login("1234567890", "demo1234");
  const pat = await login("9876543210", "demo1234");
  const studies = await (
    await fetch(`${BE}/api/studies?sort=risk`, {
      headers: { Authorization: `Bearer ${doc.token}` },
    })
  ).json();
  const hero =
    studies.find((s) => s.heatmap_available && s.risk_band === "High") ||
    studies.find((s) => s.heatmap_available) ||
    studies[0];
  HERO = hero.id;
  console.log("hero study:", hero.id, hero.patient.name);

  const browser = await chromium.launch();

  for (const sc of scenes) {
    const recMs = Math.round((sc.target + 0.6) * 1000);
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      recordVideo: { dir: REC, size: { width: W, height: H } },
    });
    const acc = tokenFor(sc.shot, doc, pat);
    if (acc) {
      await ctx.addInitScript(
        ([t, a]) => {
          localStorage.setItem("radguard_token", t);
          localStorage.setItem("radguard_account", a);
        },
        [acc.token, JSON.stringify(acc.account)],
      );
    }
    const page = await ctx.newPage();
    const t0 = Date.now();
    await action(page, sc.shot);
    const remain = recMs - (Date.now() - t0);
    if (remain > 0) await page.waitForTimeout(remain);
    const vid = page.video();
    await ctx.close();
    const p = await vid.path();
    renameSync(p, `${REC}/${sc.shot}.webm`);
    console.log("rec", sc.shot, `${sc.target.toFixed(1)}s`);
  }

  await browser.close();
  console.log("DONE");
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
