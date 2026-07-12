'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useLocale } from '../i18n/locale-provider';
import { navigationItems } from '../i18n/navigation';
import { LanguageSelector } from './language-selector';

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav aria-label="NovaVend">
      <ul className="navigation-list">
        {navigationItems.map((item) => {
          const label = t(item.key);
          if (item.comingSoon) {
            return (
              <li key={item.key}>
                <span
                  className="navigation-item is-disabled"
                  aria-disabled="true"
                >
                  <span>{label}</span>
                  <small>{t('comingSoon')}</small>
                </span>
              </li>
            );
          }
          const active =
            item.href === '/' ? pathname === '/' : pathname.endsWith(item.href);
          return (
            <li key={item.key}>
              <Link
                className={`navigation-item${active ? ' is-active' : ''}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { ready, t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="dashboard-shell" data-locale-ready={ready}>
      <a className="skip-link" href="#main-content">
        {t('skipToContent')}
      </a>

      <aside className="desktop-sidebar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <strong>NovaVend</strong>
            <span>{t('previewBadge')}</span>
          </div>
        </div>
        <Navigation />
        <p className="sidebar-note">{t('frontendOnly')}</p>
      </aside>

      <div className="dashboard-main">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={mobileOpen ? t('closeMenu') : t('mobileMenu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileOpen ? '×' : '☰'}</span>
          </button>
          <div className="mobile-brand">NovaVend</div>
          <div className="workspace-placeholder">
            <span>{t('workspaceLabel')}</span>
            <strong>{t('workspacePlaceholder')}</strong>
          </div>
          <LanguageSelector />
        </header>

        {mobileOpen ? (
          <div className="mobile-navigation" id="mobile-navigation">
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </div>
        ) : null}

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
