import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// @ts-expect-error Three is JS-only in this isolated theme.
import {PerspectiveCamera,MathUtils} from 'three';
import {pose,toWeb} from '../src/scripts/main-street/navigation.js';

test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});
test.afterEach(async({page},testInfo)=>{
  if(testInfo.status!==testInfo.expectedStatus){
    const events=await page.evaluate(()=>(window as any).__townAudioEvents||null).catch(()=>null);
    if(events)await testInfo.attach('audio-events',{body:JSON.stringify(events,null,2),contentType:'application/json'});
  }
});

test('cafe biography, guestbook and contact stay inside Main Street',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/main-street/#about/bio');
  const reader=page.getByRole('dialog',{name:'About',exact:true});
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('heading',{name:'Rohan Kulshrestha'})).toBeVisible();
  await reader.getByRole('link',{name:'Guestbook',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Guestbook',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('link',{name:'Contact card',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Contact',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link',{name:'GitHub'})).toHaveAttribute('href','https://github.com/rohanz');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/\/main-street\/#about$/);
  // Reader close above must not wait for 3D. Its separate cold-load readiness
  // gate uses the same allowance as the physical-object journeys below.
  await expect(page.getByRole('button',{name:'Read the newspaper'})).toBeEnabled({timeout:45_000});
  await page.goBack();
  await expect(page.getByRole('dialog',{name:'Contact',exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/\/main-street\/#about$/);
  expect(errors).toEqual([]);
});

test('music previews play one at a time and stop on leaving the reader',async({page})=>{
  // Establish playback while the town is genuinely still downloading, then
  // release it and verify playback survives initialization. A software-GPU
  // first frame can monopolize the browser for longer than a media poll; that
  // is not evidence that the track stopped or failed to start.
  let releaseModel!:()=>void;
  const modelGate=new Promise<void>(resolve=>{releaseModel=resolve;});
  await page.route('**/assets/main-street/town.glb',async route=>{await modelGate;await route.continue();});
  await page.addInitScript(()=>{
    const events:any[]=[];(window as any).__townAudioEvents=events;
    for(const type of ['play','playing','pause','waiting','stalled','ended'])document.addEventListener(type,event=>{
      if(!(event.target instanceof HTMLAudioElement))return;
      const target=event.target;
      queueMicrotask(()=>{events.push({type,src:target.getAttribute('src'),time:performance.now(),
        players:[...document.querySelectorAll<HTMLAudioElement>('#venue-reader audio')].map(a=>({src:a.getAttribute('src'),paused:a.paused,ended:a.ended,duration:a.duration,time:a.currentTime,ready:a.readyState}))});});
    },true);
  });
  await page.goto('/main-street/#music/listen');
  const reader=page.getByRole('dialog',{name:'Music',exact:true});await expect(reader).toBeVisible();
  const audio=reader.locator('audio');await expect(audio).toHaveCount(4);
  await audio.nth(0).evaluate((el:HTMLAudioElement)=>el.play());
  await expect.poll(()=>audio.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0);
  const beforeInitialization=await audio.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime);
  releaseModel();
  await expect(page.locator('#town-loading')).toBeHidden({timeout:45_000});
  await expect.poll(()=>audio.nth(0).evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(beforeInitialization);
  // The real preview is only 16 seconds long: on a software GPU it may finish
  // naturally during the first frame. An ended preview is not an early pause.
  expect(await audio.nth(0).evaluate((el:HTMLAudioElement)=>!el.paused||el.ended)).toBe(true);
  // Ensure the exclusivity assertion starts with a genuinely active first
  // player even if that cold-load interval consumed the complete preview.
  await audio.nth(0).evaluate((el:HTMLAudioElement)=>el.play());
  expect(await audio.nth(0).evaluate((el:HTMLAudioElement)=>el.paused)).toBe(false);
  await audio.nth(1).evaluate((el:HTMLAudioElement)=>el.play());
  await expect.poll(()=>audio.nth(0).evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true);
  await reader.getByRole('button',{name:'Back to record store ↗'}).click();
  await expect(reader).not.toBeVisible();
  expect(await audio.evaluateAll(els=>els.every(el=>(el as HTMLAudioElement).paused))).toBe(true);
  await expect(page).toHaveURL(/\/main-street\/#music$/);
});

test('the visible newspaper, guestbook and business card are physical reader entry points',async({page})=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/main-street/navigation.json',import.meta.url),'utf8'));
  await page.goto('/main-street/#about');
  await expect(page.getByRole('button',{name:'Read the newspaper'})).toBeEnabled({timeout:45_000});
  const canvas=page.locator('#town-scene canvas');
  for(const [target,title] of [['about/bio','About'],['about/testimonials','Guestbook'],['about/contact','Contact']]){
    const rect=(await canvas.boundingBox())!;
    const view=pose(manifest.views['about/inside']),aspect=rect.width/rect.height;
    const camera=new PerspectiveCamera(MathUtils.radToDeg(2*Math.atan(36/(2*view.lens*aspect))),aspect,.03,300);
    camera.position.copy(view.position);camera.quaternion.copy(view.quaternion);camera.updateMatrixWorld(true);
    const binding=manifest.bindings.find((b:{target:string})=>b.target===target);
    const p=toWeb(binding.center).project(camera);
    await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
    await expect(page.getByRole('dialog',{name:title,exact:true})).toBeVisible();
    await expect(page).toHaveURL(new RegExp('#'+target+'$'));
    await page.getByRole('button',{name:'Back to coffee shop ↗'}).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button',{name:'Read the newspaper'})).toBeEnabled();
  }
});

test('project index, article and return stay inside the workshop',async({page})=>{
  await page.goto('/main-street/#projects');
  const reader=page.getByRole('dialog');await expect(reader).toBeVisible();
  const cards=reader.locator('[data-project]');expect(await cards.count()).toBeGreaterThan(3);
  const slug=await cards.first().getAttribute('data-project');await cards.first().click();
  await expect(page).toHaveURL(new RegExp('#projects/'+slug+'$'));
  await expect(reader.locator(`[data-article="${slug}"]`)).toBeVisible();
  await reader.getByRole('link',{name:'← All projects'}).click();
  await expect(reader.locator('#project-index')).toBeVisible();
  await reader.getByRole('button',{name:/Back to workshop/}).click();
  await expect(reader).not.toBeVisible();await expect(page).toHaveURL(/#workshop$/);
});

test('the turntable and four featured sleeves open the music reader directly',async({page})=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/main-street/navigation.json',import.meta.url),'utf8'));
  await page.goto('/main-street/#music');
  await expect(page.getByRole('button',{name:'Listen to records'})).toBeEnabled({timeout:45_000});
  const bindings=manifest.bindings.filter((b:{target:string,center:number[]})=>b.target.startsWith('music/')&&b.center[1]>5);
  expect(bindings).toHaveLength(5);
  for(const binding of bindings){
    const rect=(await page.locator('#town-scene canvas').boundingBox())!;
    const view=pose(manifest.views['music/inside']),aspect=rect.width/rect.height;
    const camera=new PerspectiveCamera(MathUtils.radToDeg(2*Math.atan(36/(2*view.lens*aspect))),aspect,.03,300);
    camera.position.copy(view.position);camera.quaternion.copy(view.quaternion);camera.updateMatrixWorld(true);
    const p=toWeb(binding.center).project(camera);
    await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
    await expect(page.getByRole('dialog',{name:'Music',exact:true})).toBeVisible();
    await expect(page).toHaveURL(new RegExp('#'+binding.target+'$'));
    await page.getByRole('button',{name:'Back to record store ↗'}).click();
    await expect(page).toHaveURL(/#music$/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button',{name:'Listen to records'})).toBeEnabled();
  }
});

test('the physical repair ledger opens projects from the workshop bench',async({page})=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/main-street/navigation.json',import.meta.url),'utf8'));
  await page.goto('/main-street/#workshop');
  await expect(page.getByRole('button',{name:'Open project ledger'})).toBeEnabled({timeout:45_000});
  const rect=(await page.locator('#town-scene canvas').boundingBox())!;
  const view=pose(manifest.views['projects/inside']),aspect=rect.width/rect.height;
  const camera=new PerspectiveCamera(MathUtils.radToDeg(2*Math.atan(36/(2*view.lens*aspect))),aspect,.03,300);
  camera.position.copy(view.position);camera.quaternion.copy(view.quaternion);camera.updateMatrixWorld(true);
  const p=toWeb(manifest.bindings.find((b:{target:string})=>b.target==='projects/index').center).project(camera);
  await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
  const reader=page.getByRole('dialog');await expect(reader).toBeVisible();
  await expect(page).toHaveURL(/#projects$/);
  expect(await reader.locator('[data-project]').count()).toBeGreaterThan(3);
  await reader.getByRole('button',{name:/Back to workshop/}).click();
  await expect(reader).not.toBeVisible();await expect(page).toHaveURL(/#workshop$/);
});

test('narrow desktop keeps every shop and reader usable with reduced motion',async({page},testInfo)=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto('/main-street/');
  await expect(page.getByRole('button',{name:'Coffee shop About',exact:true})).toBeEnabled({timeout:45_000});
  for(const [shop,action,room] of [
    ['Coffee shop About','Read the newspaper','about'],
    ['Record store Music','Listen to records','music'],
    ['Workshop Projects','Open project ledger','projects']
  ]){
    await page.getByRole('button',{name:shop,exact:true}).click();
    const entry=page.getByRole('button',{name:action,exact:true});await expect(entry).toBeEnabled();
    const box=(await entry.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(1024);
    expect(box.y+box.height).toBeLessThanOrEqual(768);
    await page.screenshot({path:testInfo.outputPath(room+'-narrow.png'),animations:'disabled'});
    await entry.click();const reader=page.getByRole('dialog');await expect(reader).toBeVisible();
    const readerBox=(await reader.boundingBox())!;
    expect(readerBox.width).toBeLessThanOrEqual(1024);expect(readerBox.height).toBeLessThanOrEqual(768);
    await page.keyboard.press('Escape');await expect(reader).not.toBeVisible();
    await page.getByRole('button',{name:'← Back to street',exact:true}).click();
  }
});

for(const asset of ['town.glb','navigation.json'])test(`content remains available if ${asset} fails`,async({page})=>{
  await page.route('**/assets/main-street/'+asset,route=>route.abort());
  await page.goto('/main-street/');await expect(page.locator('#town-fallback')).toBeVisible();
  if(asset==='navigation.json')await expect(page.locator('#town-scene canvas')).toHaveCount(0);
  await page.locator('#town-fallback').getByRole('link',{name:'About',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'About',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#town-fallback').getByRole('link',{name:'Music',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Music',exact:true})).toBeVisible();
});

test('phones go to the equivalent classic content before downloading the town',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();let townRequested=false;
  page.on('request',r=>{if(r.url().endsWith('/town.glb'))townRequested=true;});
  await page.goto('/main-street/#projects/bqst');
  await expect(page).toHaveURL(/\/projects\/bqst\/?$/);expect(townRequested).toBe(false);
  await context.close();
});

test('project demos are live, mounted one article at a time and cleaned on close',async({page})=>{
  await page.route('**/assets/main-street/town.glb',route=>route.abort());
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/main-street/#projects/bqst');
  const reader=page.getByRole('dialog');await expect(reader).toBeVisible();
  await expect(page.locator('[data-article]')).toHaveCount(1);
  const knob=reader.getByRole('slider',{name:'BQST saturation drive'}).first();
  await expect(knob).toHaveAttribute('aria-valuenow','0.0');
  await knob.focus();await page.keyboard.press('ArrowUp');
  await expect.poll(async()=>Number(await knob.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  const chart=reader.locator('#bqst-transfer-visual canvas');
  expect(await chart.evaluate((el:HTMLCanvasElement)=>el.width)).toBeGreaterThan(100);
  await reader.getByRole('link',{name:'← All projects'}).click();
  await expect(page.locator('[data-article]')).toHaveCount(0);
  await reader.locator('[data-project="bqst"]').click();
  await expect(reader.getByRole('slider',{name:'BQST saturation drive'}).first()).toHaveAttribute('aria-valuenow','0.0');
  await page.keyboard.press('Escape');await expect(page.locator('[data-article]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('image zoom and glossary stay above the native workshop reader',async({page})=>{
  await page.route('**/assets/main-street/town.glb',route=>route.abort());
  await page.goto('/main-street/#projects/bqst');
  const reader=page.locator('#project-reader');await expect(reader).toBeVisible();
  const expand=reader.getByRole('button',{name:/Expand image/}).first();
  await expand.click();await expect(reader.locator('.image-lightbox')).toHaveClass(/is-visible/);
  await expect(reader.locator('.image-lightbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(reader.locator('.image-lightbox')).not.toHaveClass(/is-visible/);
  await expect(reader).toBeVisible();await expect(expand).toBeFocused();
  const term=reader.locator('.gloss-term').first();await term.focus();
  await expect(reader.getByRole('tooltip')).toBeVisible();
  await expect(term).toHaveAttribute('aria-describedby','gloss-tooltip');
});

test('workshop Quantlab roster loads shared data and supports keyboard resizing',async({page})=>{
  await page.route('**/assets/main-street/town.glb',route=>route.abort());
  await page.goto('/main-street/#projects/quantlab-analyst');
  const roster=page.locator('#qla-roster-visual');
  const grip=roster.getByRole('separator',{name:/resize the memo pane/i});
  await expect(grip).toBeVisible();await grip.focus();
  const memo=roster.locator('.qla-roster-memo');
  const before=await memo.evaluate(el=>el.getBoundingClientRect().height);
  await page.keyboard.press('ArrowUp');
  await expect.poll(()=>memo.evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(Math.round(before)-40);
  await expect(page).toHaveURL(/main-street\/#projects\/quantlab-analyst$/);
});
