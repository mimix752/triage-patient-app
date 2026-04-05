import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { LOCAL_ADMIN_EMAIL_STORAGE_KEY, LOCAL_ADMIN_PASSWORD_STORAGE_KEY } from "../../shared/accessControl";
import { trpc } from "./lib/trpc";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const getLocalAdminHeaders = () => {
  if (typeof window === "undefined") {
    return {};
  }

  const email = window.sessionStorage.getItem(LOCAL_ADMIN_EMAIL_STORAGE_KEY) || "";
  const password = window.sessionStorage.getItem(LOCAL_ADMIN_PASSWORD_STORAGE_KEY) || "";

  if (!email || !password) {
    return {};
  }

  return {
    "x-local-admin-email": email,
    "x-local-admin-password": password,
  };
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  const hasLocalAdminSession = Boolean(
    window.sessionStorage.getItem(LOCAL_ADMIN_EMAIL_STORAGE_KEY) &&
      window.sessionStorage.getItem(LOCAL_ADMIN_PASSWORD_STORAGE_KEY),
  );

  if (!isUnauthorized || hasLocalAdminSession) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const headers = new Headers(init?.headers || {});
        const localAdminHeaders = getLocalAdminHeaders();
        Object.entries(localAdminHeaders).forEach(([key, value]) => headers.set(key, value));

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
