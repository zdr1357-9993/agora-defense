import { test, expect } from '@playwright/test';

for (const viewport of [{width:390,height:844},{width:1024,height:768},{width:768,height:1024}]) {
  test(`image journey ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.route(/supabase\.co/, route=>route.abort());
    await page.goto('/?qa-screen=home');
    await expect(page.locator('#home')).toBeVisible();
    await page.locator('[data-chapter="1"]').click();
    const map=page.locator('.image-route-viewport');
    await expect(map).toBeVisible();
    await expect.poll(()=>page.locator('.image-route-art').evaluate((im:HTMLImageElement)=>im.naturalWidth)).toBeGreaterThan(0);
    const nodes=page.locator('.image-route-stop');await expect(nodes).toHaveCount(4);
    const last=nodes.last();await last.scrollIntoViewIfNeeded();await last.click();
    await expect(page.locator('#j-go')).toHaveText('이동 중…');
    await expect(last).toHaveAttribute('aria-pressed','true',{timeout:10000});
    await expect(page.locator('.image-route-avatar')).not.toHaveClass(/walking/);
    await expect(page.locator('#j-go')).toBeEnabled();
    await page.locator('.image-route-recenter').click();
    await expect(page.locator('.image-route-avatar')).toBeInViewport();
    const bounds=await map.evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
    const file=info.outputPath(`agora-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({path:file});await info.attach('image-journey',{path:file,contentType:'image/png'});
    // Keyboard selection and reduced motion follow the same destination rule.
    await page.emulateMedia({reducedMotion:'reduce'});
    await nodes.first().focus();await page.keyboard.press('Enter');
    await expect(nodes.first()).toHaveAttribute('aria-pressed','true');
    await page.locator('#j-go').click();
    await expect(page.locator('#battle')).toBeVisible();
  });
}
