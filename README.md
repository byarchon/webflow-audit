# Webflow Audit Toolkit

Browser-based audit checks for Webflow sites. Runs automatically on staging
(`*.webflow.io` subdomains), dormant on production.

Surfaces common Webflow gotchas in the DevTools console:

- Navigation inconsistency between desktop and mobile menus
- Broken images (failed loads)
- Empty CMS states leaking into the page
- Missing alt text on images
- Console errors during page load

## Install

Add to your Webflow project: **Project Settings → Custom Code → Footer Code**

​```html
<script src="https://cdn.jsdelivr.net/gh/byarchon/webflow-audit@main/audit/webflow-audit.js" defer></script>
​```

The script auto-runs on `*.webflow.io` URLs only. Production traffic on your
custom domain is unaffected.

## Configuration (optional)

If your nav uses non-default class names, configure selectors before the script loads:

​```html
<script>
window.WEBFLOW_AUDIT_CONFIG = {
  nav: {
    desktopRoot: '.my-desktop-nav',
    mobileRoot: '.my-mobile-drawer',
    desktopLinks: '.nav-link',
    mobileLinks: '.drawer-link',
    dropdownRoot: '.products-dropdown',
    dropdownLinks: '.product-card'
  }
};
</script>
<script src="https://cdn.jsdelivr.net/gh/byarchon/webflow-audit@main/audit/webflow-audit.js" defer></script>
​```

Defaults assume:
- `.desctop-nav` / `.desktop-nav` (typo-tolerant) for desktop
- `.mobile-nav` for mobile
- `.navigation-links > a` and `.link-menu-item` for nav items

## Usage

Open DevTools console on any staging page. Audit runs automatically and
prints a grouped report:

​```
🔍 Webflow Audit
Page: /model/example · 17:42:31
✅ 3 pass  ⚠️ 1 warn  ❌ 1 fail

❌ nav-consistency — 6 desktop / 6 mobile links
  labelMismatches:
  ┌─────┬───────────┬─────────────────────────┬─────────────┐
  │ idx │   href    │        desktop          │   mobile    │
  ├─────┼───────────┼─────────────────────────┼─────────────┤
  │  0  │ /history  │ history of brand        │   history   │
  └─────┴───────────┴─────────────────────────┴─────────────┘
​```

## Manual API

​```js
webflowAudit.run()                 // re-run audit
webflowAudit.checks                // list available checks
webflowAudit.version               // toolkit version
window.WEBFLOW_AUDIT_RESULTS       // last run's raw results
​```

## Available checks

| Check               | What it catches                                      | Severity |
|---------------------|------------------------------------------------------|----------|
| nav-consistency     | Desktop/mobile nav link & label mismatches           | fail     |
| cms-empty-fields    | Visible "No category found" CMS empty states         | fail     |
| broken-images       | `<img>` with `naturalWidth === 0` (failed to load)   | fail     |
| missing-alt         | `<img>` without alt attribute (a11y)                 | warn     |
| console-errors      | `console.error` calls during page load               | warn     |

## License

MIT © byarchon
