/**
 * Browser half: a "Formula" entry in the left sidebar opening the Race Log page with the
 * full circuit, and a live Sector Cam toggle in the chat session header.
 */
import React from 'react';
import { DICT } from './i18n.jsx';
import { makeChatHud } from './chat-hud.jsx';
import { makePage } from './page.jsx';
import { CSS } from './styles.js';

const PKG = '@local/dsh-trajecable';
const NS = 'local-trajecable';
const PANEL_ID = 'local-trajecable';

export const inject = ['slots', 'locale'];

function TrajectoryIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 3.5v17" />
      <circle cx="5.5" cy="8" r="2" />
      <circle cx="5.5" cy="16.5" r="2" />
      <path d="M9 8h7M9 16.5h10" />
    </svg>
  );
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: { panel: DICT.zh.panel }, en: { panel: DICT.en.panel } }), 'dsh-trajecable: dictionary');
  const t = ctx.locale.bind(NS);

  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = PKG;
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, 'dsh-trajecable: styles');

  const openSession = (sessionId) => {
    const workspace = ctx.get('uiWorkspace');
    ctx.get('layout')?.selectPanel(null);
    if (workspace) workspace.openSession(sessionId);
  };
  const TrajectoryPage = makePage({ openSession, locale: ctx.locale });

  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: PANEL_ID, locale: NS,
  }, TrajectoryPage)), 'dsh-trajecable: page');

  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: PANEL_ID, order: 11, locale: NS, label: () => t('panel'),
  }, TrajectoryIcon)), 'dsh-trajecable: sidebar entry');

  const ChatHud = makeChatHud({ locale: ctx.locale });
  ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities', id: 'trajecable-sector-cam', order: -10, locale: NS, label: () => t('panel'),
  }, ChatHud)), 'dsh-trajecable: chat sector cam');
}
