'use client';

import { useLocale } from '../i18n/locale-provider';

export function SystemStatusPage() {
  const { t } = useLocale();
  const services = [
    ['status.frontend', true],
    ['status.api', false],
    ['status.database', false],
    ['status.redis', false],
    ['status.authentication', false],
    ['status.deviceNetwork', false],
  ] as const;

  return (
    <div className="page-stack" data-status-marker="novavend-status">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('previewBadge')}</p>
          <h1>{t('status.title')}</h1>
          <p>{t('status.subtitle')}</p>
        </div>
        <span className="preview-pill">{t('frontendOnly')}</span>
      </section>

      <section className="status-list" aria-label={t('status.title')}>
        {services.map(([key, available]) => (
          <article className="status-row" key={key}>
            <span
              className={`status-dot${available ? ' is-available' : ''}`}
              aria-hidden="true"
            />
            <div>
              <h2>{t(key)}</h2>
              <p>
                {t(
                  available ? 'status.frontendDetail' : 'status.unhostedDetail',
                )}
              </p>
            </div>
            <strong className={available ? 'available' : 'neutral'}>
              {t(available ? 'status.available' : 'status.notConnected')}
            </strong>
          </article>
        ))}
      </section>
    </div>
  );
}
