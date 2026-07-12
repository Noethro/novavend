# Internationalization

NovaVend's dashboard localization is a static-export-safe client-side boundary. It uses committed,
reviewable dictionaries and the platform `Intl` APIs. It never sends interface text to a machine
translation service.

## Supported locales

| Locale  | Native name |
| ------- | ----------- |
| `en`    | English     |
| `tr`    | Türkçe      |
| `de`    | Deutsch     |
| `ru`    | Русский     |
| `zh-CN` | 简体中文    |
| `ja`    | 日本語      |

English (`en`) is the fallback locale.

## Resolution and persistence

On the first browser visit, the locale provider checks:

1. The saved preference in `novavend.locale`.
2. The browser language list, including regional mappings such as `tr-*`, `de-*`, `ru-*`,
   `zh-CN`, `zh-SG`, `zh-Hans-*`, and `ja-*`.
3. English.

Blocked or unavailable local storage is caught and treated as an absent preference. Locale state
continues in memory, and the root document `lang` attribute follows every selection. The shell is
hidden only until the initial client locale is resolved, preventing an English-to-localized flash or
hydration mismatch.

## Source structure

- `apps/web/src/i18n/locales.ts`: typed locale identifiers, browser normalization, persistence, and
  resolution.
- `apps/web/src/i18n/dictionaries.ts`: the canonical English key set and all six source dictionaries.
- `apps/web/src/i18n/auth-dictionaries.ts`: complete authentication/onboarding text for all six locales.
- `apps/web/src/i18n/avatar-dictionaries.ts`: complete avatar-pairing text for all six locales.
- `apps/web/src/i18n/locale-provider.tsx`: the single React locale state boundary and typed translator.
- `apps/web/src/i18n/formatters.ts`: shared date, time, integer, decimal, percentage, and `L$`
  formatting.
- `apps/web/src/i18n/navigation.ts`: typed navigation definitions using translation keys.

Components request only typed `TranslationKey` values. Runtime lookup falls back first to English and
then to the canonical English dictionary value, so missing content never renders blank or crashes.

## Adding a translation key

1. Add the key and English text to `englishDictionary`.
2. Add reviewed translations to each of the five non-English dictionaries.
3. Use the inferred `TranslationKey` through `t(key)` in the component.
4. Run `pnpm --filter @novavend/web test` and `pnpm typecheck`.

The `Dictionary` type and completeness test reject missing keys.

## Adding a language

1. Add its identifier to `supportedLocales` and its native label to `localeNativeNames`.
2. Extend browser normalization when applicable.
3. Add a complete, human-reviewed dictionary and register it in `dictionaries`.
4. Add locale resolution, representative render, formatting, and Playwright coverage.
5. Review responsive layout with the new language at 320px and desktop widths.

## Formatting

Use the helpers in `formatters.ts`; do not construct scattered `Intl` formatters in components. Dates
and times use UTC in shared helpers for deterministic rendering and tests. Second Life values format
the numeric portion for the selected locale and retain the `L$` label without currency conversion.

## Testing and static export

Unit tests cover locale validation, browser mapping, precedence, fallback, storage errors,
persistence, dictionary completeness, missing-key fallback, formatting, and navigation boundaries.
React tests cover the provider, all dictionaries, selector updates, status neutrality, lack of fetches,
and mobile navigation. Playwright checks persisted language switching, non-Latin text, `/status`
navigation, and a 320px viewport.

The strategy uses neither locale-prefixed routes nor middleware. GitHub Pages routes remain
`/novavend/` and `/novavend/status/`; Next.js applies the `/novavend` base path to links and assets at
build time. Static output verification checks both HTML files, repository-scoped assets, and dashboard
markers.

Authentication routes use the same provider and browser preference. `/login`, `/register`, and
`/onboarding` are not locale-prefixed and remain exportable beneath `/novavend`. Preview mode renders
localized forms but disables submission before any network request.

`/avatars` uses the same provider and remains statically exportable. Preview mode renders pairing
instructions and explicitly non-usable sample states while disabling all pairing network actions.
