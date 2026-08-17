import { clsx } from "clsx";
import type { EmailDomain } from "@/constants";

type Props = {
  domains: readonly EmailDomain[];
  hasError?: boolean;
} & Omit<React.ComponentProps<"select">, "children">;

export function EmailDomainSelect({ className, domains, hasError = false, ...props }: Props) {
  return (
    <select
      {...props}
      className={clsx(
        "gusm-input-primary min-w-31 rounded-l-none border-l-0 px-3 text-sm text-neutral-400",
        hasError && "border-rose-700/60 focus-visible:border-rose-700/60",
        className,
      )}
    >
      {domains.map(function renderDomain(domain) {
        return (
          <option key={domain.value} value={domain.value}>
            @{domain.label}
          </option>
        );
      })}
    </select>
  );
}
