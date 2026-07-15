import createFetchClient from "openapi-react-query";
import client from "@/lib/api/client";

/**
 * Typed react-query wrapper over the openapi-fetch client.
 * Usage: $api.useQuery("get", "/v1/tasks/")
 */
export const $api = createFetchClient(client);
