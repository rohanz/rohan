import {test,expect} from '@playwright/test';

// Visual artifacts intentionally retain the normal film grade/grain. The
// accessibility suite separately checks the grain-free reduced-motion mode.
test('normal film presentation renders the street and all three interiors',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/main-street/?perf=1');
  await expect(page.getByRole('button',{name:'Coffee shop About',exact:true})).toBeEnabled({timeout:45000});
  expect(await page.locator('#town-scene canvas').evaluate((canvas:HTMLCanvasElement)=>
    canvas.getContext('webgl2')!.getContextAttributes()!.antialias)).toBe(false);
  await page.getByRole('button',{name:'Pause atmosphere',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('street-film.png')});
  for(const [room,entry,action] of [['about','Coffee shop About','Read the newspaper'],['music','Record store Music','Listen to records'],['projects','Workshop Projects','Open project ledger']]){
    await page.getByRole('button',{name:entry,exact:true}).click();
    await expect(page.getByRole('button',{name:action,exact:true})).toBeEnabled();
    await page.screenshot({path:testInfo.outputPath(room+'-film.png')});
    await page.getByRole('button',{name:'← Back to street',exact:true}).click();
  }
  expect(errors).toEqual([]);
});

test('direct-render manifests retain canvas antialiasing',async({page})=>{
  await page.route('**/assets/main-street/navigation.json',async route=>{
    const response=await route.fetch(),manifest=await response.json();
    await route.fulfill({response,json:{...manifest,night:false}});
  });
  await page.goto('/main-street/');
  await expect(page.getByRole('button',{name:'Coffee shop About',exact:true})).toBeEnabled({timeout:45000});
  expect(await page.locator('#town-scene canvas').evaluate((canvas:HTMLCanvasElement)=>
    canvas.getContext('webgl2')!.getContextAttributes()!.antialias)).toBe(true);
});
