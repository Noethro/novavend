import { loadWebConfig } from '@novavend/config';

export const getWebConfig = () => loadWebConfig(process.env);
