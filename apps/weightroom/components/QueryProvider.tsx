"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AppNavigation } from "@/components/AppNavigation";
import { getQueryClient } from "@/lib/query-client";

type Props = {
  children: React.ReactNode;
};

export function QueryProvider({ children }: Props) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AppNavigation>{children}</AppNavigation>
    </QueryClientProvider>
  );
}
