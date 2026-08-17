export const GITHUB_VIMASTO_ORG_URL = "https://github.com/vimasto";

export const EMAIL_DOMAIN_VALUES = ["usm.cl", "sansano.usm.cl", "postgrado.usm.cl"] as const;

export type EmailDomain = {
  value: (typeof EMAIL_DOMAIN_VALUES)[number];
  label: string;
};

export const EMAIL_DOMAINS: readonly EmailDomain[] = EMAIL_DOMAIN_VALUES.map(
  function createEmailDomain(value) {
    return { value, label: value };
  },
);

export const DEFAULT_EMAIL_DOMAIN = EMAIL_DOMAIN_VALUES[0];
