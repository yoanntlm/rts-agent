// Runtime-safe fallback for development before full Convex codegen has run.
// `convex codegen` will replace this with a typed API surface.
import { anyApi } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
