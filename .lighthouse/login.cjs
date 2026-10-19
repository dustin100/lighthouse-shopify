// Unlocks the password-protected storefront before Lighthouse audits each URL.
// The session cookie survives between runs because lighthouserc sets disableStorageReset.
module.exports = async (browser, context) => {
  const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;
  if (!password) throw new Error('SHOPIFY_STOREFRONT_PASSWORD is not set');

  const { origin } = new URL(context.url);
  const page = await browser.newPage();
  await page.goto(`${origin}/password`, { waitUntil: 'networkidle2' });

  const input = await page.$('input[type="password"]');
  if (input) {
    await input.type(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.$eval('form:has(input[type="password"])', (form) => form.submit()),
    ]);
  }
  await page.close();
};
