import createFetchHook from "openapi-react-query";
import type { paths } from "@/api/generated/types";
import client from "@/api/client";

// Create typed hooks
const { useQuery, useMutation, useSuspenseQuery } = createFetchHook<paths>(client);

export { useQuery as useTypedQuery, useMutation as useTypedMutation, useSuspenseQuery as useTypedSuspenseQuery };

// Export the client for direct usage
export { client };
