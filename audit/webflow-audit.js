/**
 * Webflow Audit Toolkit
 * Browser-based audit checks for Webflow sites. Runs on staging only.
 *
 * Repo:    github.com/byarchon/webflow-audit
 * Author:  byarchon
 * License: MIT
 * Version: 1.0.0
 */
(function () {
  'use strict';

  // === GUARD: only on Webflow staging subdomain ===
  if (!location.hostname.includes('webflow.io')) return;

  // === REGISTRY ===
  const checks = [];
  const register = (name, fn) => checks.push({ name, fn });

  // === HELPERS ===
  const extractLinks = (root, selector) =>
    Array.from(root.querySelectorAll(selector))
      .map(a => ({
        href: (a.getAttribute('href') || '').trim(),
        text: a.textContent.trim().toLowerCase().replace(/\s+/g, ' ')
      }))
      .filter(l => l.href && l.href !== '#' && !l.href.startsWith('javascript:'));

  // === CHECK 1: Nav consistency (desktop vs mobile) ===
  // Configure via window.WEBFLOW_AUDIT_CONFIG.nav before script loads:
  //   { desktopRoot: '.my-desktop-nav', mobileRoot: '.my-mobile-nav', ... }
  register('nav-consistency', () => {
    const cfg = (window.WEBFLOW_AUDIT_CONFIG || {}).nav || {};
    const desktopRoot = document.querySelector(cfg.desktopRoot || '.desctop-nav, .desktop-nav');
    const mobileRoot = document.querySelector(cfg.mobileRoot || '.mobile-nav');

    if (!desktopRoot || !mobileRoot) {
      return { status: 'skip', reason: 'Nav roots not found on this page' };
    }

    const desktopMain = extractLinks(
      desktopRoot,
      cfg.desktopLinks || '.navigation-links > a, .navigation-links .nav-link'
    );
    const mobileMain = extractLinks(
      mobileRoot,
      cfg.mobileLinks || '.link-menu-item'
    );

    const dHrefs = new Set(desktopMain.map(l => l.href));
    const mHrefs = new Set(mobileMain.map(l => l.href));

    const issues = {
      onlyDesktop: desktopMain.filter(l => !mHrefs.has(l.href)),
      onlyMobile: mobileMain.filter(l => !dHrefs.has(l.href)),
      labelMismatches: desktopMain
        .map(d => {
          const m = mobileMain.find(x => x.href === d.href);
          return m && m.text !== d.text
            ? { href: d.href, desktop: d.text, mobile: m.text }
            : null;
        })
        .filter(Boolean)
    };

    // Optional: secondary dropdown (e.g. product dropdown)
    if (cfg.dropdownRoot) {
      const dropdownRoot = document.querySelector(cfg.dropdownRoot);
      if (dropdownRoot) {
        const dDrop = extractLinks(dropdownRoot, cfg.dropdownLinks || 'a[href]');
        const mDrop = extractLinks(mobileRoot, cfg.mobileDropdownLinks || cfg.dropdownLinks || 'a[href]');
        const dDropHrefs = new Set(dDrop.map(l => l.href));
        const mDropHrefs = new Set(mDrop.map(l => l.href));
        issues.dropdownOnlyDesktop = dDrop.filter(l => !mDropHrefs.has(l.href));
        issues.dropdownOnlyMobile = mDrop.filter(l => !dDropHrefs.has(l.href));
      }
    }

    const hasIssues = Object.values(issues).some(arr => Array.isArray(arr) && arr.length > 0);
    return {
      status: hasIssues ? 'fail' : 'pass',
      issues,
      summary: `${desktopMain.length} desktop / ${mobileMain.length} mobile links`
    };
  });

  // === CHECK 2: Empty CMS states ===
  register('cms-empty-fields', () => {
    const empty = Array.from(document.querySelectorAll('.w-dyn-empty'))
      .filter(el => el.offsetParent !== null);
    return {
      status: empty.length ? 'fail' : 'pass',
      issues: {
        emptyStates: empty.map(el => ({
          text: el.textContent.trim().substring(0, 60),
          location: el.closest('section')?.className?.substring(0, 50) || 'unknown'
        }))
      }
    };
  });

  // === CHECK 3: Broken images ===
  register('broken-images', () => {
    const broken = Array.from(document.querySelectorAll('img'))
      .filter(img => img.complete && img.naturalWidth === 0)
      .map(img => ({
        src: img.src.substring(img.src.lastIndexOf('/') + 1, img.src.length).substring(0, 60),
        alt: img.alt || '(no alt)'
      }));
    return {
      status: broken.length ? 'fail' : 'pass',
      issues: { broken },
      summary: `${broken.length} broken image(s)`
    };
  });

  // === CHECK 4: Missing alt text (a11y warning) ===
  register('missing-alt', () => {
    const missing = Array.from(document.querySelectorAll('img:not([alt]), img[alt=""]'))
      .filter(img => !img.closest('[role="presentation"]') && !img.closest('[aria-hidden="true"]'))
      .map(img => ({
        src: img.src.substring(img.src.lastIndexOf('/') + 1).substring(0, 60)
      }));
    return {
      status: missing.length > 0 ? 'warn' : 'pass',
      issues: { missing: missing.slice(0, 10) },
      summary: `${missing.length} image(s) without alt text`
    };
  });

  // === CHECK 5: Console errors collector ===
  // Monitors console.error calls during page load
  const errorLog = [];
  const originalError = console.error;
  console.error = function (...args) {
    errorLog.push(args.map(a => String(a).substring(0, 200)).join(' '));
    originalError.apply(console, args);
  };
  register('console-errors', () => {
    return {
      status: errorLog.length ? 'warn' : 'pass',
      issues: { errors: errorLog.slice(0, 5) },
      summary: `${errorLog.length} console error(s) during load`
    };
  });

  // === RUNNER ===
  const run = () => {
    console.group('%c🔍 Webflow Audit', 'color:#c8102e;font-weight:bold;font-size:13px;');
    console.log(`Page: ${location.pathname} · ${new Date().toLocaleTimeString('cs-CZ')}`);

    const results = checks.map(({ name, fn }) => {
      try {
        return { name, ...fn() };
      } catch (e) {
        return { name, status: 'error', error: e.message };
      }
    });

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warned = results.filter(r => r.status === 'warn').length;
    const skipped = results.filter(r => r.status === 'skip').length;
    const errored = results.filter(r => r.status === 'error').length;

    console.log(
      `%c✅ ${passed} pass  %c⚠️ ${warned} warn  %c❌ ${failed} fail  %c⏭️ ${skipped} skip${errored ? `  💥 ${errored} error` : ''}`,
      'color:#22c55e;', 'color:#eab308;', 'color:#ef4444;', 'color:#6b7280;'
    );

    results.forEach(r => {
      if (r.status === 'pass' || r.status === 'skip') return;

      const icon = { fail: '❌', warn: '⚠️', error: '💥' }[r.status];
      const summaryText = r.summary ? ` — ${r.summary}` : '';
      console.group(`${icon} ${r.name}${summaryText}`);

      if (r.error) {
        console.error(r.error);
      } else if (r.reason) {
        console.log(r.reason);
      } else if (r.issues) {
        Object.entries(r.issues).forEach(([key, val]) => {
          if (Array.isArray(val) && val.length) {
            console.log(`%c${key}:`, 'font-weight:bold;');
            console.table(val);
          }
        });
      }
      console.groupEnd();
    });

    console.groupEnd();

    window.WEBFLOW_AUDIT_RESULTS = results;
    return results;
  };

  // === EXPOSE PUBLIC API ===
  window.webflowAudit = {
    run,
    checks: checks.map(c => c.name),
    version: '1.0.0'
  };

  // === AUTO-RUN ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    // Slight delay to let other scripts initialize
    setTimeout(run, 100);
  }
})();
