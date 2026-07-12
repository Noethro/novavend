'use client';

import { formatLindenDollars, formatPercentage } from '../i18n/formatters';
import { useLocale } from '../i18n/locale-provider';

export function OverviewPage() {
  const { locale, t } = useLocale();
  const cards = [
    { key: 'summary.products' as const, value: '3' },
    { key: 'summary.sales' as const, value: formatLindenDollars(1250, locale) },
    { key: 'summary.deliveries' as const, value: '2' },
    { key: 'summary.devices' as const, value: '1' },
  ];
  const checklist = [
    'quick.profile',
    'quick.avatar',
    'quick.delivery',
    'quick.product',
  ] as const;

  return (
    <div className="page-stack" data-dashboard-marker="novavend-dashboard">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('previewBadge')}</p>
          <h1>{t('overview.title')}</h1>
          <p>{t('overview.welcome')}</p>
        </div>
        <span className="preview-pill">{t('frontendOnly')}</span>
      </section>

      <section className="setup-card" aria-labelledby="setup-title">
        <div>
          <h2 id="setup-title">{t('setup.title')}</h2>
          <p>{t('setup.description')}</p>
        </div>
        <div className="setup-progress">
          <strong>{formatPercentage(0.25, locale)}</strong>
          <span>{t('setup.progress')}</span>
        </div>
      </section>

      <section className="summary-grid" aria-label={t('overview.title')}>
        {cards.map((card) => (
          <article className="summary-card" key={card.key}>
            <span>{t(card.key)}</span>
            <strong>{card.value}</strong>
            <small>{t('sampleValue')}</small>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>{t('activity.title')}</h2>
          <div className="empty-state">
            <span aria-hidden="true">◇</span>
            <p>{t('activity.empty')}</p>
          </div>
        </article>
        <article className="panel">
          <h2>{t('health.title')}</h2>
          <div className="empty-state">
            <span aria-hidden="true">◌</span>
            <p>{t('health.empty')}</p>
          </div>
        </article>
      </section>

      <section className="panel quick-start">
        <h2>{t('quick.title')}</h2>
        <ol>
          {checklist.map((key, index) => (
            <li key={key}>
              <span>{index + 1}</span>
              {t(key)}
              <small>{t('comingSoon')}</small>
            </li>
          ))}
        </ol>
      </section>

      <p className="live-notice">{t('overview.liveNotice')}</p>
    </div>
  );
}
