import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});

test('Classic article switches into its Main Street reader and back without being recaptured',async({page})=>{
  await page.goto('/projects/careersphere');
  await page.getByRole('link',{name:'main street',exact:true}).click();
  await expect(page).toHaveURL(/\/main-street\/#projects\/careersphere$/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('site:themePref'))).toBe('main-street');
  const reader=page.locator('#project-reader');
  await expect(reader).toBeVisible();
  await reader.locator('summary').click();
  const classic=reader.getByRole('link',{name:'Classic',exact:true});
  await expect(classic).toHaveAttribute('href','/projects/careersphere');
  await classic.click();
  await expect(page).toHaveURL(/\/projects\/careersphere\/?$/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('site:themePref'))).toBe('default');
});

test('theme menu remains usable without WebGL and Escape closes it before the reader',async({page})=>{
  await page.route('**/assets/main-street/town.glb',route=>route.abort());
  await page.goto('/main-street/#about/contact');
  const reader=page.locator('#venue-reader');await expect(reader).toBeVisible();
  await reader.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(reader.getByRole('link',{name:'Transit',exact:true})).toHaveAttribute('href','/transit/about');
  await page.keyboard.press('Escape');
  await expect(reader).toBeVisible();await expect(reader.locator('details')).not.toHaveAttribute('open','');
  await expect(reader.locator('summary')).toBeFocused();
  await page.keyboard.press('Enter');await reader.getByRole('link',{name:'Transit',exact:true}).click();
  await expect(page).toHaveURL(/\/transit\/about\/?$/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('site:themePref'))).toBe('transit');
});

test('stored Main Street preference does not redirect a Classic entry',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('site:themePref','main-street'));
  await page.goto('/music');await expect(page).toHaveURL(/\/music\/?$/);
  await expect(page.locator('html')).toHaveClass(/theme-default/);
});

for(const source of ['/projects/careersphere','/transit/projects/careersphere']){
  test(`${source} opens a responsive Main Street reader even when graphics fail`,async({page})=>{
    await page.route('**/assets/main-street/town.glb',route=>route.abort());
    await page.goto(source);
    await page.locator('[data-theme-pref="main-street"]').click();
    const reader=page.locator('#project-reader');
    await expect(reader).toBeVisible();
    // Real clicks require animation-frame progress and hit testing. A forced
    // click or focus-only test would miss the frozen incoming document bug.
    await reader.locator('summary').click();
    await reader.getByRole('link',{name:'Classic',exact:true}).click();
    await expect(page).toHaveURL(/\/projects\/careersphere\/?$/);
  });
}

test('Blueprint and Main Street retain About context in both directions',async({page})=>{
  await page.route('**/assets/main-street/town.glb',route=>route.abort());
  await page.goto('/blueprint/?p=/about');
  await page.locator('#theme-btn').click();
  await page.locator('[data-theme="main-street"]').click();
  await expect(page).toHaveURL(/\/main-street\/#about\/bio$/);
  const reader=page.locator('#venue-reader');
  await reader.locator('summary').click();
  await reader.getByRole('link',{name:'Blueprint',exact:true}).click();
  await expect(page).toHaveURL(/\/blueprint\/about\/?$/);
  await expect(page.locator('#theme-btn')).toBeVisible();
});
