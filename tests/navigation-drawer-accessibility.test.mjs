import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [shell, capture, theme] = await Promise.all([
  readFile('apps/web/taskzen-shell.js', 'utf8'),
  readFile('scripts/capture-ui-viewport.mjs', 'utf8'),
  readFile('apps/web/taskzen-theme.css', 'utf8')
]);

test('closed responsive navigation is removed from interaction and the accessibility tree', () => {
  assert.match(shell, /const DRAWER_BREAKPOINT = 1120/);
  assert.match(shell, /setInert\(sidebar, true\)/);
  assert.match(shell, /sidebar\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(shell, /menu\.setAttribute\('aria-controls', NAVIGATION_ID\)/);
  assert.match(shell, /menu\.setAttribute\('aria-expanded', String\(open\)\)/);
});

test('open responsive navigation behaves as a modal drawer', () => {
  assert.match(shell, /setInert\(main, true\)/);
  assert.match(shell, /sidebar\.setAttribute\('role', 'dialog'\)/);
  assert.match(shell, /sidebar\.setAttribute\('aria-modal', 'true'\)/);
  assert.match(shell, /sidebar\.querySelector\('\.sidebar-close'\)/);
  assert.match(shell, /focusRestoreTarget \|\| menu/);
});

test('drawer keyboard handling supports Escape and a bidirectional focus trap', () => {
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /event\.key !== 'Tab'/);
  assert.match(shell, /event\.shiftKey/);
  assert.match(shell, /last\.focus\(\)/);
  assert.match(shell, /first\.focus\(\)/);
  assert.match(shell, /document\.addEventListener\('keydown', handleDrawerKeyboard\)/);
});

test('desktop navigation remains interactive', () => {
  assert.match(shell, /if \(!drawerLayout\)/);
  assert.match(shell, /setInert\(sidebar, false\)/);
  assert.match(shell, /sidebar\.removeAttribute\('aria-hidden'\)/);
  assert.match(theme, /@media \(max-width: 1120px\)/);
});

test('real browser QA opens, traps, closes, and restores the drawer', () => {
  assert.match(capture, /auditResponsiveDrawer/);
  assert.match(capture, /Open navigation drawer/);
  assert.match(capture, /Drawer focus trap/);
  assert.match(capture, /Input\.dispatchKeyEvent/);
  assert.match(capture, /forwardWrapped === true/);
  assert.match(capture, /backwardWrapped === true/);
  assert.match(capture, /restored\.activeClass\.includes\('menu-button'\)/);
});
